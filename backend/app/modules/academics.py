"""Academic scheduling, calendar, recurrence and room maintenance."""
from datetime import date, datetime, time
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator
from app.core.auth import Principal, require_user, require_coordinator
from app.core.gateway import Gateway
from app.modules.campus import get_allocations
from app.modules.scheduling import validate_interval

router = APIRouter()


class SessionCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    room_id: str
    starts_at: datetime
    ends_at: datetime
    cohort_id: UUID | None = None
    faculty_id: UUID | None = None
    course_id: UUID | None = None

    @model_validator(mode="after")
    def valid_interval(self):
        validate_interval(self.starts_at, self.ends_at)
        return self


class SeriesCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    room_id: str
    weekday: int = Field(ge=1, le=7)
    from_date: date
    to_date: date
    local_start: time
    local_end: time
    cohort_id: UUID | None = None
    faculty_id: UUID | None = None
    course_id: UUID | None = None


class BlockCreate(BaseModel):
    room_id: str
    starts_at: datetime
    ends_at: datetime
    reason: str = Field(min_length=3, max_length=500)


@router.get("/me")
async def whoami(request: Request, me: Principal = Depends(require_user)):
    db = Gateway(request, me.token)
    memberships = await db.select("student_memberships", {
        "select": "cohort_id,verified,active", "user_id": "eq." + str(me.user_id)
    })
    return {"id": me.user_id, "role": me.role, "verified": me.verified,
            "full_name": me.full_name, "memberships": memberships}


@router.get("/cohorts")
async def cohorts(request: Request, me: Principal = Depends(require_user)):
    db = Gateway(request, me.token)
    return {"cohorts": await db.select("academic_cohorts", {
        "select": "id,code,branch,academic_year,section,batch_start,expected_size,active",
        "order": "code.asc",
    })}


@router.get("/calendar")
async def calendar(request: Request, start: datetime, end: datetime,
                   room_id: str | None = None, me: Principal = Depends(require_user)):
    if (start.tzinfo is None or end.tzinfo is None
        or start.utcoffset() is None or end.utcoffset() is None):
        raise HTTPException(422, "Calendar timestamps must include a timezone")
    if end <= start or (end - start).total_seconds() > 31 * 86400:
        raise HTTPException(422, "Calendar window must be positive and at most 31 days")
    db = Gateway(request, me.token)
    base = {
        "starts_at": "lt." + end.isoformat(),
        "ends_at": "gt." + start.isoformat(),
        "order": "starts_at.asc", "limit": "3000"
    }
    if room_id:
        base["room_id"] = "eq." + room_id
    allocations = await get_allocations(db, start, end)
    if room_id:
        allocations = [a for a in allocations if a["room_id"] == room_id]
    bookings = await db.select("bookings", {
        **base, "select": "id,title,room_id,kind,starts_at,ends_at,status"
    })
    sessions = await db.select("academic_sessions", {
        **base, "select": "id,title,room_id,cohort_id,starts_at,ends_at,status"
    })
    titles = {("booking", item["id"]): item for item in bookings}
    titles.update({("academic", item["id"]): item for item in sessions})
    events = []
    for a in allocations:
        visible = titles.get((a["source_type"], a["source_id"]))
        events.append({
            "id": a["source_id"], "room_id": a["room_id"],
            "start": a["starts_at"], "end": a["ends_at"],
            "source_type": a["source_type"],
            "title": visible["title"] if visible else "Occupied",
            "details_visible": bool(visible),
        })
    return {"events": events, "start": start, "end": end}


@router.post("/admin/sessions", status_code=201)
async def create_session(body: SessionCreate, request: Request,
                         me: Principal = Depends(require_coordinator)):
    db = Gateway(request, me.token)
    session_id = await db.rpc("create_academic_session", {
        "p_title": body.title, "p_room_id": body.room_id,
        "p_starts_at": body.starts_at.isoformat(), "p_ends_at": body.ends_at.isoformat(),
        "p_cohort_id": str(body.cohort_id) if body.cohort_id else None,
        "p_faculty_id": str(body.faculty_id) if body.faculty_id else None,
        "p_course_id": str(body.course_id) if body.course_id else None,
    })
    return {"id": session_id, "status": "scheduled"}


@router.post("/admin/sessions/{session_id}/cancel")
async def cancel_session(session_id: UUID, request: Request,
                         me: Principal = Depends(require_coordinator)):
    db = Gateway(request, me.token)
    await db.rpc("cancel_academic_session", {"p_id": str(session_id)})
    return {"id": session_id, "status": "cancelled"}


@router.post("/admin/series", status_code=201)
async def create_series(body: SeriesCreate, request: Request,
                        me: Principal = Depends(require_coordinator)):
    db = Gateway(request, me.token)
    series_id = await db.rpc("create_academic_series", {
        "p_title": body.title, "p_room_id": body.room_id,
        "p_weekday": body.weekday,
        "p_from_date": body.from_date.isoformat(),
        "p_to_date": body.to_date.isoformat(),
        "p_local_start": body.local_start.isoformat(),
        "p_local_end": body.local_end.isoformat(),
        "p_cohort_id": str(body.cohort_id) if body.cohort_id else None,
        "p_faculty_id": str(body.faculty_id) if body.faculty_id else None,
        "p_course_id": str(body.course_id) if body.course_id else None,
    })
    return {"id": series_id, "status": "draft"}


@router.post("/admin/series/{series_id}/publish")
async def publish_series(series_id: UUID, request: Request,
                         me: Principal = Depends(require_coordinator)):
    db = Gateway(request, me.token)
    count = await db.rpc("publish_academic_series", {"p_series_id": str(series_id)})
    return {"id": series_id, "status": "published", "occurrences_created": count}


@router.post("/admin/room-blocks", status_code=201)
async def block_room(body: BlockCreate, request: Request,
                     me: Principal = Depends(require_coordinator)):
    try:
        validate_interval(body.starts_at, body.ends_at)
    except ValueError as e:
        raise HTTPException(422, str(e))
    db = Gateway(request, me.token)
    block_id = await db.rpc("create_room_block", {
        "p_room_id": body.room_id,
        "p_starts_at": body.starts_at.isoformat(), "p_ends_at": body.ends_at.isoformat(),
        "p_reason": body.reason,
    })
    return {"id": block_id, "status": "active"}
