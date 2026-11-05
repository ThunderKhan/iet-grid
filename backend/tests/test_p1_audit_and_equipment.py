"""P1 API regression: audit authorization/filtering and equipment booking contracts.

All external Supabase calls are intercepted by an HTTPX mock transport.
"""
import json
from uuid import UUID
import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import Principal, require_user, require_coordinator, require_staff

ACTOR = UUID("7c3b3a52-36a5-48ab-b5f8-9e29c9d5c50f")
BOOKING_ID = "2a28a9f5-ebae-467b-b226-1bfce5c1d931"
AUDIT_ENTRY = {
    "event_id": 1, "booking_id": BOOKING_ID, "room_id": "IET19",
    "booking_title": "Test lecture", "booking_kind": "lecture",
    "booking_status": "confirmed", "actor_id": str(ACTOR),
    "action": "created:confirmed", "happened_at": "2026-11-05T12:00:00+00:00",
    "total_rows": 1,
}


@pytest.fixture
def backend(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://test-p1.invalid")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    calls = []
    def transport(request):
        payload = json.loads(request.content) if request.content else {}
        calls.append((request.url.path, payload))
        if request.url.path.endswith("/rpc/list_booking_audit_history"):
            return httpx.Response(200, json=[AUDIT_ENTRY])
        if request.url.path.endswith("/rpc/request_room_booking_with_equipment"):
            return httpx.Response(200, json=BOOKING_ID)
        if request.url.path.endswith("/rest/v1/bookings"):
            return httpx.Response(200, json=[{
                "id": BOOKING_ID, "room_id":"IET19", "title":"Test lecture",
                "kind":"lecture", "status":"confirmed",
                "starts_at":"2026-11-07T10:00:00Z",
                "ends_at":"2026-11-07T11:00:00Z",
                "cohort_id": None, "created_by": str(ACTOR),
                "required_equipment":["projector"],
            }])
        return httpx.Response(200,json=[])
    with TestClient(app) as client:
        original_http = app.state.http
        app.state.http = httpx.AsyncClient(transport=httpx.MockTransport(transport))
        yield client,calls
        app.state.http = original_http


def principal(role, verified=True):
    return Principal(user_id=ACTOR,token="test-p1-jwt",role=role,
                     verified=verified,full_name="P1 test")


def test_admin_history_filters_and_pagination(backend):
    client, calls = backend
    app.dependency_overrides[require_coordinator] = lambda: principal("admin")
    try:
        response = client.get("/api/v1/admin/audit",
            params={"room_id":"IET19","action":"created","limit":20,"offset":0})
        assert response.status_code == 200, response.text
        assert response.json()["events"][0]["action"] == "created:confirmed"
        assert response.json()["total"] == 1
        p = [v for name, v in calls if name.endswith("/rpc/list_booking_audit_history")][0]
        assert p == {"p_limit":20,"p_offset":0,"p_room_id":"IET19","p_action":"created"}
    finally:
        app.dependency_overrides.clear()


def test_faculty_cannot_read_audit_history(backend):
    client, calls = backend
    app.dependency_overrides[require_coordinator] = lambda: (_ for _ in ()).throw(
        __import__("fastapi").HTTPException(403, "Verified coordinator/administrator required"))
    try:
        r = client.get("/api/v1/admin/audit")
        assert r.status_code == 403
        assert not any(name.endswith("/rpc/list_booking_audit_history") for name,_ in calls)
    finally:
        app.dependency_overrides.clear()


def test_booking_transmits_canonical_required_equipment(backend):
    client, calls = backend
    app.dependency_overrides[require_staff] = lambda: principal("faculty")
    try:
        r = client.post("/api/v1/bookings",json={
            "room_id":"IET19","title":"Test lecture",
            "starts_at":"2026-11-07T10:00:00+00:00",
            "ends_at":"2026-11-07T11:00:00+00:00",
            "required_capacity":50,
            "required_equipment":["PROJECTOR"," projector "],
        })
        assert r.status_code == 201, r.text
        assert r.json()["booking"]["required_equipment"] == ["projector"]
        request = [v for name,v in calls if name.endswith("/rpc/request_room_booking_with_equipment")][0]
        assert request["p_required_equipment"] == ["projector"]
    finally:
        app.dependency_overrides.clear()


def test_equipment_input_is_bounded(backend):
    client,calls=backend
    app.dependency_overrides[require_staff]=lambda:principal("faculty")
    try:
        bad=client.post("/api/v1/bookings",json={
            "room_id":"IET19","title":"Test lecture",
            "starts_at":"2026-11-07T10:00:00+00:00",
            "ends_at":"2026-11-07T11:00:00+00:00",
            "required_equipment":[" "],
        })
        assert bad.status_code==422
        assert not any(name.endswith("/rpc/request_room_booking_with_equipment") for name,_ in calls)
    finally:
        app.dependency_overrides.clear()
