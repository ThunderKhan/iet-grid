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


def normalize_required_equipment(items) -> set[str]:
    """Canonical, bounded hard constraints; do not treat unknown inventory as verified."""
    result = set()
    for value in items:
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= 60:
            raise ValueError("Equipment labels must be 1–60 characters")
        result.add(value.strip().lower())
    if len(result) > 8:
        raise ValueError("At most eight required equipment features")
    return result


def room_ineligibility_reasons(
    room: dict[str, Any], min_capacity: int, kind: str,
    equipment: set[str] | None = None,
) -> list[str]:
    reasons = []
    if not room.get("active", True):
        reasons.append("inactive")
    if room.get("type") == "library":
        reasons.append("non_bookable_space")
    if int(room.get("capacity", 0)) < min_capacity:
        reasons.append("insufficient_capacity")
    if room.get("type") == "lab" and kind != "practical":
        reasons.append("lab_requires_practical")
    required = normalize_required_equipment(equipment or set())
    if required and not room.get("verified", False):
        reasons.append("equipment_unverified")
    recorded = normalize_required_equipment(room.get("equipment") or [])
    if not required.issubset(recorded):
        reasons.append("equipment_not_recorded")
    return reasons


def room_is_eligible(room: dict[str, Any], min_capacity: int, kind: str = "lecture",
                     equipment: set[str] | None = None) -> bool:
    return not room_ineligibility_reasons(room, min_capacity, kind, equipment)


def room_metadata(room: dict[str, Any], kind: str) -> dict:
    """Explicit metadata confidence and approval outcome without invented facts."""
    verified = room.get("verified") is True
    approval = kind in ("exam", "event") or bool(room.get("restricted"))
    warnings = []
    if not verified:
        warnings.append("Capacity and room details are provisional; confirm with university")
    if room.get("accessible") is None:
        warnings.append("Accessibility has not been documented")
    if not room.get("equipment"):
        warnings.append("No equipment is recorded; this does not prove none exists")
    return {
        "metadata_status": "verified" if verified else "provisional",
        "capacity_status": "verified" if verified else "estimated",
        "metadata_warnings": warnings,
        "requires_approval": approval,
        "booking_outcome": "pending_approval" if approval else "instant_if_available",
        "approval_reason": ("Exam/event requires review" if kind in ("exam", "event")
                            else "Restricted room requires review" if approval else None),
    }


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
    if room.get("restricted"):
        reasons.append("Restricted room; approval required")
    return {"score": score, "reasons": reasons, **room_metadata(room, "lecture")}


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
        # Approval policy depends on requested session type, not just the room.
        candidates.append({**room, **fit, **room_metadata(room, kind), "available": True})
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
