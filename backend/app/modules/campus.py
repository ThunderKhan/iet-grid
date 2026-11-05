"""Campus inventory, live room availability and intelligent alternatives."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from app.core.auth import Principal, require_user
from app.core.gateway import Gateway
from app.modules.scheduling import (
    validate_interval, find_available, find_alternative_slots, overlaps, parse_instant,
    room_is_eligible, room_ineligibility_reasons, normalize_required_equipment, room_metadata,
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
    # Supabase often caps PostgREST responses at 1,000 rows. A truncated result
    # must NEVER allow a classroom to appear free. Page through every allocation.
    page_size = 500
    max_pages = 20
    entries = []
    for page in range(max_pages):
        batch = await gateway.select("room_allocations", {
            "select": "id,room_id,starts_at,ends_at,source_type,source_id",
            "starts_at": "lt." + end.isoformat(),
            "ends_at": "gt." + start.isoformat(),
            "order": "starts_at.asc,id.asc",
            "limit": str(page_size),
            "offset": str(page * page_size),
        })
        entries.extend(batch)
        if len(batch) < page_size:
            return entries
    # Fail closed if occupancy exceeds the bounded read. Never guess availability.
    raise HTTPException(503, "Availability is too large to verify safely")


def parsed_equipment(raw: str) -> set[str]:
    try:
        return normalize_required_equipment([x for x in raw.split(",") if x.strip()])
    except ValueError as exc:
        raise HTTPException(422, str(exc))


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
    inventory = await get_rooms(db, building, floor)
    return {"rooms": [{**r, **room_metadata(r, "lecture")} for r in inventory],
            "verified_room_count": sum(r.get("verified") is True for r in inventory),
            "provisional_room_count": sum(r.get("verified") is not True for r in inventory)}


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
    required = parsed_equipment(equipment)
    output = []
    for room in room_rows:
        disqualifications = room_ineligibility_reasons(room, capacity, kind, required)
        conflicts = room["id"] in unavailable_ids
        eligible = not disqualifications
        output.append({**room, **room_metadata(room, kind),
                       "available": eligible and not conflicts,
                       "ineligibility_reasons": disqualifications,
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
    required = parsed_equipment(equipment)
    ranked = find_available(all_rooms, allocations, start, end, capacity, kind,
                            building, required)
    nearby = [] if ranked else find_alternative_slots(
        all_rooms, allocations, start, end, capacity, kind, building, required
    )
    return {"start": start, "end": end, "requested_capacity": capacity,
            "recommendations": ranked[:limit], "alternative_slots": nearby,
            "algorithm": "hard-constraint-filter + deterministic-capacity-location-ranking",
            "warning": "Relative fit scores are not probabilities. Provisional capacity and equipment require institutional verification. Booking constraints are revalidated by PostgreSQL."}
