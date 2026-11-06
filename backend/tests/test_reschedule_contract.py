"""Focused validation tests for same-room booking schedule changes."""
from datetime import datetime, timedelta, timezone
import pytest
from pydantic import ValidationError
from app.modules.bookings import RescheduleRequest


def make_time(hour=10):
    return datetime(2026, 11, 9, hour, tzinfo=timezone.utc)


def test_valid_reschedule_input():
    result=RescheduleRequest(
        starts_at=make_time(),ends_at=make_time()+timedelta(hours=1),
        reason="The lecture has moved"
    )
    assert result.ends_at>result.starts_at


def test_reversed_reschedule_interval_is_rejected():
    with pytest.raises(ValidationError):
        RescheduleRequest(
            starts_at=make_time(12),ends_at=make_time(10),
            reason="The lecture has moved"
        )


def test_rescheduling_reason_is_required():
    with pytest.raises(ValidationError):
        RescheduleRequest(
            starts_at=make_time(),ends_at=make_time()+timedelta(hours=1),
            reason=""
        )
