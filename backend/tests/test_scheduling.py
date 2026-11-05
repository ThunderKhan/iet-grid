"""Pure algorithm tests. No network or real campus records required."""
from datetime import datetime, timedelta, timezone
import pytest
from app.modules.scheduling import (
    overlaps, parse_instant, validate_interval, room_is_eligible,
    explain_room, find_available, find_alternative_slots
)


def instant(hour: int) -> datetime:
    return datetime(2026, 11, 6, hour, tzinfo=timezone.utc)


ROOMS = [
    {"id": "IET18", "building": "IET", "floor": "First", "type": "classroom",
     "capacity": 75, "verified": True, "active": True, "equipment": []},
    {"id": "IET19", "building": "IET", "floor": "First", "type": "classroom",
     "capacity": 100, "verified": True, "active": True, "equipment": ["projector"]},
    {"id": "LH04", "building": "DEEK", "floor": "Ground", "type": "classroom",
     "capacity": 75, "verified": False, "active": True, "equipment": []},
    {"id": "LAB", "building": "IET", "floor": "First", "type": "lab",
     "capacity": 75, "verified": True, "active": True, "equipment": []},
    {"id": "LIBRARY", "building": "IET", "floor": "Ground", "type": "library",
     "capacity": 200, "verified": True, "active": True, "equipment": []},
]


def test_adjacent_intervals_are_not_overlapping():
    assert not overlaps(instant(9), instant(10), instant(10), instant(11))


def test_partial_overlap_is_detected():
    assert overlaps(instant(9), instant(11), instant(10), instant(12))


def test_invalid_interval_rejected():
    with pytest.raises(ValueError):
        validate_interval(instant(12), instant(11))
    with pytest.raises(ValueError):
        validate_interval(instant(9), instant(18))


def test_unzoned_timestamp_rejected():
    with pytest.raises(ValueError):
        parse_instant("2026-11-06T11:00:00")


def test_library_cannot_be_booked():
    assert not room_is_eligible(ROOMS[-1], 10)


def test_lab_requires_practical():
    assert not room_is_eligible(ROOMS[3], 50, "lecture")
    assert room_is_eligible(ROOMS[3], 50, "practical")


def test_capacity_is_hard_constraint():
    assert not room_is_eligible(ROOMS[0], 76)


def test_equipment_is_hard_constraint():
    assert not room_is_eligible(ROOMS[0], 40, equipment={"projector"})
    assert room_is_eligible(ROOMS[1], 40, equipment={"projector"})


def test_occupied_room_excluded_by_authoritative_allocation():
    alloc = [{"room_id": "IET18", "starts_at": instant(10).isoformat(),
              "ends_at": instant(11).isoformat()}]
    ranked = find_available(ROOMS, alloc, instant(10), instant(11), 75,
                            preferred_building="IET")
    assert "IET18" not in [r["id"] for r in ranked]
    assert "IET19" in [r["id"] for r in ranked]


def test_best_room_prefers_capacity_and_location():
    ranked = find_available(ROOMS, [], instant(10), instant(11), 75,
                            preferred_building="IET")
    assert ranked[0]["id"] == "IET18"
    assert ranked[0]["score"] > ranked[-1]["score"]


def test_score_is_not_presented_as_probability():
    fit = explain_room(ROOMS[2], 75, "IET")
    assert 0 < fit["score"] < 100
    assert any("verification" in x.lower() or "requires university" in x.lower()
               for x in fit["reasons"])


def test_nearby_slots_are_generated_without_fake_inventory():
    alloc = [{"room_id": r["id"], "starts_at": instant(10).isoformat(),
              "ends_at": instant(11).isoformat()} for r in ROOMS]
    # Shift window to a valid India campus day, independent of server timezone.
    result = find_alternative_slots(ROOMS, alloc, instant(10), instant(11),
                                    75, "lecture", "IET")
    assert result
    for x in result:
        assert x["best_room"]["available"] is True
        assert x["start"] != instant(10).isoformat()
