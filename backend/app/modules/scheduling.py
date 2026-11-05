"""Pure, deterministic availability and recommendation algorithms.

These functions never mutate bookings. PostgreSQL allocations are authoritative;
the booking RPC checks all hard constraints again inside its transaction.
"""
from datetime import datetime, timedelta, timezone
from typing import Any


def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """Half-open intervals: [start,end), so back-to-back slots do not collide."""
    return a_start < b_end and b_start < a_end


def parse_instant(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise ValueError("Timestamp must have explicit timezone")
    return dt.astimezone(timezone.utc)


def validate_interval(start: datetime, end: datetime) -> None:
    if start.tzinfo is None or end.tzinfo is None:
        raise ValueError("Timezone-aware interval required")
    if end <= start or end - start > timedelta(hours=8):
        raise ValueError("Intervals must be positive and at most eight hours")


def room_is_eligible(room: dict[str, Any], min_capacity: int, kind: str = "lecture",
                     equipment: set[str] | None = None) -> bool:
    if not room.get("active", True) or room.get("type") == "library":
        return False
    if int(room.get("capacity", 0)) < min_capacity:
        return False
    if room.get("type") == "lab" and kind != "practical":
        return False
    required = equipment or set()
    return required.issubset(set(room.get("equipment") or []))


def explain_room(room: dict, min_capacity: int, preferred_building: str | None,
                 equipment: set[str] | None = None) -> dict:
    """Heuristic ranking; scores are relative suitability, not probabilities."""
    spare = max(0, int(room["capacity"]) - min_capacity)
    building_penalty = 18 if preferred_building and room["building"] != preferred_building else 0
    capacity_penalty = min(30, spare // 5)
    verification_penalty = 8 if not room.get("verified", False) else 0
    score = max(1, 100 - building_penalty - capacity_penalty - verification_penalty)
    reasons = ["Capacity satisfies request", "No conflicting room allocation"]
    if preferred_building and room["building"] == preferred_building:
        reasons.append("Preferred building")
    if room.get("verified"):
        reasons.append("Capacity record verified")
    else:
        reasons.append("Capacity requires university confirmation")
    if equipment:
        reasons.append("Required equipment present")
    return {"score": score, "reasons": reasons}


def find_available(
    rooms: list[dict], allocations: list[dict],
    start: datetime, end: datetime, min_capacity: int,
    kind: str = "lecture", preferred_building: str | None = None,
    equipment: set[str] | None = None
) -> list[dict]:
    """Deterministic candidate search against authoritative, active allocations."""
    validate_interval(start, end)
    occupied = set()
    for a in allocations:
        a_start = parse_instant(a["starts_at"])
        a_end = parse_instant(a["ends_at"])
        if overlaps(start, end, a_start, a_end):
            occupied.add(a["room_id"])
    candidates = []
    for room in rooms:
        if room["id"] in occupied or not room_is_eligible(room, min_capacity, kind, equipment):
            continue
        fit = explain_room(room, min_capacity, preferred_building, equipment)
        candidates.append({**room, **fit, "available": True})
    return sorted(candidates, key=lambda r: (-r["score"], r["id"]))


def find_alternative_slots(
    rooms: list[dict], allocations: list[dict], start: datetime, end: datetime,
    min_capacity: int, kind: str, preferred_building: str | None,
    equipment: set[str] | None = None, shift_hours: tuple[int, ...] = (-2, -1, 1, 2)
) -> list[dict]:
    """Search nearby working hours (08:00-19:00 IST) with the same duration."""
    from zoneinfo import ZoneInfo
    tz = ZoneInfo("Asia/Kolkata")
    suggestions = []
    for shift in shift_hours:
        new_start = start + timedelta(hours=shift)
        new_end = end + timedelta(hours=shift)
        local_start, local_end = new_start.astimezone(tz), new_end.astimezone(tz)
        if local_start.date() != local_end.date():
            continue
        if not (8 <= local_start.hour and (local_end.hour < 19 or (local_end.hour == 19 and local_end.minute == 0))):
            continue
        ranked = find_available(rooms, allocations, new_start, new_end, min_capacity,
                                kind, preferred_building, equipment)
        if ranked:
            suggestions.append({
                "start": new_start.isoformat(), "end": new_end.isoformat(),
                "best_room": ranked[0], "available_count": len(ranked),
            })
    return suggestions
