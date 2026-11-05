"""Campus inventory, live room availability and intelligent alternatives."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from app.core.auth import Principal, require_user
from app.core.gateway import Gateway
from app.modules.scheduling import (
    validate_interval, find_available, find_alternative_slots, overlaps, parse_instant,
    room_is_eligible,
)

router = APIRouter()
ROOM_COLUMNS = "id,building,floor,capacity,type,verified,active,restricted,equipment,accessible"


async def get_rooms(gateway: Gateway, building: str | None = None,
                    floor: str | None = None) -> list[dict]:
    params = {"select": ROOM_COLUMNS, "order": "building.asc,floor.asc,id.asc"}
    if building:
        params["building"] = "eq." + building
    if floor:
        params["floor"] = "eq." + floor
    return await gateway.select("rooms", params)


async def get_allocations(gateway: Gateway, start: datetime, end: datetime) -> list[dict]:
    return await gateway.select("room_allocations", {
        "select": "room_id,starts_at,ends_at,source_type,source_id",
        "starts_at": "lt." + end.isoformat(),
        "ends_at": "gt." + start.isoformat(),
        "order": "starts_at.asc",
        "limit": "3000",
    })


def checked_interval(start: datetime, end: datetime) -> None:
    try:
        validate_interval(start, end)
    except (ValueError, TypeError) as e:
        raise HTTPException(422, str(e))


@router.get("/buildings")
async def buildings(request: Request, me: Principal = Depends(require_user)):
    db = Gateway(request, me.token)
    rows = await db.select("buildings", {"select": "code,name,active", "order": "code"})
    return {"buildings": rows}


@router.get("/floors")
async def floors(request: Request, building: str | None = None,
                 me: Principal = Depends(require_user)):
    db = Gateway(request, me.token)
    params = {"select": "id,building_code,label,level_number", "order": "building_code,level_number"}
    if building:
        params["building_code"] = "eq." + building
    return {"floors": await db.select("floors", params)}


@router.get("/rooms")
async def rooms(request: Request, building: str | None = None, floor: str | None = None,
                me: Principal = Depends(require_user)):
    db = Gateway(request, me.token)
    return {"rooms": await get_rooms(db, building, floor)}


@router.get("/availability")
async def availability(
    request: Request, start: datetime, end: datetime,
    capacity: int = Query(1, ge=1, le=2000),
    kind: str = Query("lecture", pattern="^(lecture|practical|exam|event)$"),
    building: str | None = None, floor: str | None = None,
    equipment: str = "", me: Principal = Depends(require_user),
):
    checked_interval(start, end)
    db = Gateway(request, me.token)
    room_rows = await get_rooms(db, building, floor)
    allocations = await get_allocations(db, start, end)
    unavailable_ids = {
        a["room_id"] for a in allocations
        if overlaps(start, end, parse_instant(a["starts_at"]), parse_instant(a["ends_at"]))
    }
    required = {e.strip() for e in equipment.split(",") if e.strip()}
    output = []
    for room in room_rows:
        eligible = room_is_eligible(room, capacity, kind, required)
        conflicts = room["id"] in unavailable_ids
        output.append({**room, "available": eligible and not conflicts,
                       "reason": ("occupied" if conflicts else
                                  "ineligible" if not eligible else "available")})
    return {"start": start, "end": end, "required_capacity": capacity,
            "rooms": output, "available_count": sum(r["available"] for r in output)}


@router.get("/recommendations")
async def recommendations(
    request: Request, start: datetime, end: datetime,
    capacity: int = Query(75, ge=1, le=2000),
    kind: str = Query("lecture", pattern="^(lecture|practical|exam|event)$"),
    building: str | None = None, equipment: str = "",
    limit: int = Query(5, ge=1, le=30),
    me: Principal = Depends(require_user),
):
    checked_interval(start, end)
    db = Gateway(request, me.token)
    all_rooms = await get_rooms(db)
    allocations = await get_allocations(db, start - timedelta(hours=2),
                                         end + timedelta(hours=2))
    required = {e.strip() for e in equipment.split(",") if e.strip()}
    ranked = find_available(all_rooms, allocations, start, end, capacity, kind,
                            building, required)
    nearby = [] if ranked else find_alternative_slots(
        all_rooms, allocations, start, end, capacity, kind, building, required
    )
    return {"start": start, "end": end, "requested_capacity": capacity,
            "recommendations": ranked[:limit], "alternative_slots": nearby,
            "algorithm": "hard-constraint-filter + deterministic-capacity-location-ranking",
            "warning": "Availability is advisory; each booking is revalidated atomically by PostgreSQL."}
