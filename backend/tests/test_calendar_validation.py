"""Reject malformed calendar windows before querying any database."""
from uuid import UUID
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import require_user, Principal

async def verified_mock():
    return Principal(
        user_id=UUID("a055b8ca-81fa-4c4c-a40b-f496d3c76012"),
        token="mock-test-token",
        role="student", verified=False, full_name="Test Student"
    )

def test_calendar_requires_timezone():
    app.dependency_overrides[require_user] = verified_mock
    try:
        with TestClient(app) as c:
            r = c.get("/api/v1/calendar", params={
                "start": "2026-11-07T09:00:00",
                "end": "2026-11-07T10:00:00+00:00",
            })
        assert r.status_code == 422, r.text
    finally:
        app.dependency_overrides.clear()

def test_calendar_rejects_window_longer_than_31_days():
    app.dependency_overrides[require_user] = verified_mock
    try:
        with TestClient(app) as c:
            r = c.get("/api/v1/calendar", params={
                "start": "2026-11-07T09:00:00+00:00",
                "end": "2026-12-10T10:00:00+00:00",
            })
        assert r.status_code == 422, r.text
    finally:
        app.dependency_overrides.clear()

def test_calendar_rejects_backwards_window():
    app.dependency_overrides[require_user] = verified_mock
    try:
        with TestClient(app) as c:
            r = c.get("/api/v1/calendar", params={
                "start": "2026-11-07T11:00:00+00:00",
                "end": "2026-11-07T10:00:00+00:00",
            })
        assert r.status_code == 422, r.text
    finally:
        app.dependency_overrides.clear()
