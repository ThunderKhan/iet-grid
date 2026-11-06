"""Booking lifecycle HTTP API. PostgreSQL RPCs are the only mutation authority."""
from datetime import datetime
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel, Field, model_validator
from app.core.auth import Principal, require_user, require_staff, require_coordinator
from app.core.gateway import Gateway
from app.modules.scheduling import validate_interval, normalize_required_equipment

router = APIRouter()


class BookingCreate(BaseModel):
    room_id: str = Field(min_length=2, max_length=30)
    title: str = Field(min_length=3, max_length=180)
    starts_at: datetime
    ends_at: datetime
    kind: str = Field(default="lecture", pattern="^(lecture|practical|exam|event)$")
    required_capacity: int = Field(default=1, ge=1, le=2000)
    cohort_id: UUID | None = None
    required_equipment: list[str] = Field(default_factory=list, max_length=8)
    idempotency_key: UUID = Field(default_factory=uuid4)

    @model_validator(mode="after")
    def check_time(self):
        try:
            validate_interval(self.starts_at, self.ends_at)
            normalize_required_equipment(self.required_equipment)
        except ValueError as exc:
            raise ValueError(str(exc))
        return self


class CancelRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class RescheduleRequest(BaseModel):
    starts_at: datetime
    ends_at: datetime
    reason: str = Field(min_length=3, max_length=500)

    @model_validator(mode="after")
    def check_time(self):
        validate_interval(self.starts_at, self.ends_at)
        return self


class ApprovalRequest(BaseModel):
    approve: bool


@router.post("/bookings", status_code=201)
async def create_booking(body: BookingCreate, request: Request,
                         me: Principal = Depends(require_staff)):
    db = Gateway(request, me.token)
    booking_id = await db.rpc("request_room_booking_with_equipment", {
        "p_room_id": body.room_id,
        "p_title": body.title,
        "p_starts_at": body.starts_at.isoformat(),
        "p_ends_at": body.ends_at.isoformat(),
        "p_kind": body.kind,
        "p_required_capacity": body.required_capacity,
        "p_idempotency_key": str(body.idempotency_key),
        "p_cohort_id": str(body.cohort_id) if body.cohort_id else None,
        "p_required_equipment": sorted(normalize_required_equipment(body.required_equipment)),
    })
    rows = await db.select("bookings", {
        "select": "id,room_id,title,kind,status,starts_at,ends_at,cohort_id,created_by,required_equipment",
        "id": "eq." + str(booking_id), "limit": "1",
    })
    return {"id": booking_id, "status": rows[0]["status"] if rows else "unknown",
            "booking": rows[0] if rows else None}


@router.get("/bookings/me")
async def my_bookings(request: Request, me: Principal = Depends(require_user)):
    db = Gateway(request, me.token)
    rows = await db.select("bookings", {
        "select": "id,title,kind,room_id,starts_at,ends_at,status,created_at,cohort_id,required_equipment",
        "created_by": "eq." + str(me.user_id), "order": "starts_at.desc",
        "limit": "200",
    })
    return {"bookings": rows}


@router.get("/bookings/pending")
async def pending_bookings(request: Request, me: Principal = Depends(require_coordinator)):
    db = Gateway(request, me.token)
    rows = await db.select("bookings", {
        "select": "id,title,kind,room_id,starts_at,ends_at,created_by,cohort_id,status",
        "status": "eq.pending", "order": "created_at.asc", "limit": "200",
    })
    if me.role == "coordinator":
        scopes = await db.select("coordinator_scopes", {
            "select": "building_code", "user_id": "eq." + str(me.user_id)
        })
        rooms = await db.select("rooms", {"select": "id,building"})
        room_to_building = {r["id"]: r["building"] for r in rooms}
        permitted = {x["building_code"] for x in scopes}
        rows = [b for b in rows if room_to_building.get(b["room_id"]) in permitted]
    return {"bookings": rows}


@router.get("/bookings/{booking_id}")
async def booking_detail(booking_id: UUID, request: Request,
                         me: Principal = Depends(require_user)):
    db = Gateway(request, me.token)
    rows = await db.select("bookings", {
        "select": "id,title,kind,room_id,starts_at,ends_at,status,created_at,created_by,cohort_id",
        "id": "eq." + str(booking_id), "limit": "1",
    })
    if not rows:
        raise HTTPException(404, "Booking not found or not accessible")
    return rows[0]


@router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: UUID, body: CancelRequest,
                         request: Request, me: Principal = Depends(require_staff)):
    db = Gateway(request, me.token)
    await db.rpc("cancel_room_booking", {
        "p_booking_id": str(booking_id), "p_reason": body.reason
    })
    return {"id": booking_id, "status": "cancelled"}


@router.post("/bookings/{booking_id}/reschedule")
async def reschedule_booking(booking_id: UUID, body: RescheduleRequest,
                             request: Request, me: Principal = Depends(require_staff)):
    """Same-room time changes are validated atomically by PostgreSQL.

    Exam/event bookings need a new approval request rather than a silent move.
    A student must never access this endpoint.
    """
    db = Gateway(request, me.token)
    await db.rpc("reschedule_room_booking", {
        "p_booking_id": str(booking_id),
        "p_new_starts_at": body.starts_at.isoformat(),
        "p_new_ends_at": body.ends_at.isoformat(),
        "p_reason": body.reason,
    })
    return {"id": booking_id, "status": "confirmed",
            "note": "Room, faculty and cohort conflicts rechecked atomically"}


@router.post("/admin/bookings/{booking_id}/review")
async def review_booking(booking_id: UUID, body: ApprovalRequest, request: Request,
                         me: Principal = Depends(require_coordinator)):
    db = Gateway(request, me.token)
    await db.rpc("review_room_booking", {
        "p_booking_id": str(booking_id), "p_approve": body.approve
    })
    return {"id": booking_id, "status": "confirmed" if body.approve else "rejected"}
