"""Backend integration tests with simulated Supabase Auth and PostgREST responses.

These test contract/authorization behavior without making any outbound requests.
They are NOT substitutes for real-user production acceptance tests.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from uuid import UUID
import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import app

UID = "0f1ed183-787c-4f8e-a54c-903b2c4b28b1"
BOOKING = "e0bd02fd-9cf4-4bdd-9491-4dc48c635a01"


def fake_backend(role: str, verified: bool, captured: list):
    def handle(request: httpx.Request) -> httpx.Response:
        captured.append((request.method, request.url.path, request.headers.get("authorization")))
        if request.url.path.endswith("/auth/v1/user"):
            return httpx.Response(200, json={"id": UID, "email": "example@campus.invalid"})
        if request.url.path.endswith("/rest/v1/profiles"):
            return httpx.Response(200, json=[{
                "id": UID, "full_name": "Test Student", "role": role, "verified": verified
            }])
        if request.url.path.endswith("/rest/v1/rooms"):
            return httpx.Response(200, json=[
                {"id": "IET18", "building": "IET", "floor": "First", "capacity": 75,
                 "type": "classroom", "active": True, "verified": True,
                 "equipment": [], "restricted": False, "accessible": True},
                {"id": "IET19", "building": "IET", "floor": "First", "capacity": 75,
                 "type": "classroom", "active": True, "verified": True,
                 "equipment": [], "restricted": False, "accessible": True},
            ])
        if request.url.path.endswith("/rest/v1/room_allocations"):
            return httpx.Response(200, json=[
                {"room_id": "IET18", "source_type": "academic", "source_id": BOOKING,
                 "starts_at": "2026-11-06T10:00:00+00:00",
                 "ends_at": "2026-11-06T11:00:00+00:00"}
            ])
        if request.url.path.endswith("/rest/v1/rpc/request_room_booking"):
            return httpx.Response(200, json=BOOKING)
        if request.url.path.endswith("/rest/v1/bookings"):
            return httpx.Response(200, json=[{"id": BOOKING, "status": "confirmed",
                "title": "Algorithms Lecture", "room_id": "IET19",
                "kind": "lecture", "starts_at": "2026-11-06T10:00:00+00:00",
                "ends_at": "2026-11-06T11:00:00+00:00", "cohort_id": None,
                "created_by": UID}])
        return httpx.Response(200, json=[])
    return handle


@pytest.fixture
def client_for(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://test-supabase.invalid")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    created = []

    def factory(role="student", verified=False):
        client = TestClient(app)
        client.__enter__()
        captured = []
        fake = httpx.AsyncClient(transport=httpx.MockTransport(
            fake_backend(role, verified, captured)))
        app.state.http = fake
        created.append((client, fake))
        return client, captured

    yield factory
    for client, fake in reversed(created):
        client.__exit__(None, None, None)
        asyncio.run(fake.aclose())


def test_real_auth_provider_verification_is_required(client_for):
    client, captured = client_for(role="student")
    result = client.get("/api/v1/rooms", headers={"Authorization": "Bearer sample-token"})
    assert result.status_code == 200
    assert len(result.json()["rooms"]) == 2
    assert any(path.endswith("/auth/v1/user") for _, path, _ in captured)
    assert all(auth == "Bearer sample-token" for _, _, auth in captured)


def test_student_is_denied_privileged_booking(client_for):
    client, captured = client_for(role="student", verified=True)
    response = client.post("/api/v1/bookings", headers={"Authorization": "Bearer student-token"}, json={
        "room_id": "IET19", "title": "Algorithms Lecture",
        "starts_at": "2026-11-06T10:00:00+00:00",
        "ends_at": "2026-11-06T11:00:00+00:00",
        "required_capacity": 75,
    })
    assert response.status_code == 403
    assert not any("/rpc/request_room_booking" in path for _, path, _ in captured)


def test_verified_faculty_booking_goes_to_server_rpc(client_for):
    client, captured = client_for(role="faculty", verified=True)
    response = client.post("/api/v1/bookings", headers={"Authorization": "Bearer teacher-token"}, json={
        "room_id": "IET19", "title": "Algorithms Lecture",
        "starts_at": "2026-11-06T10:00:00+00:00",
        "ends_at": "2026-11-06T11:00:00+00:00",
        "required_capacity": 75, "kind": "lecture",
    })
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "confirmed"
    assert any(method == "POST" and path.endswith("/rpc/request_room_booking") for method, path, _ in captured)
    assert all(auth == "Bearer teacher-token" for _, _, auth in captured)


def test_occupied_room_is_hidden_from_recommendations(client_for):
    client, _ = client_for(role="faculty", verified=True)
    response = client.get("/api/v1/recommendations", headers={"Authorization": "Bearer teacher-token"}, params={
        "start": "2026-11-06T10:00:00+00:00",
        "end": "2026-11-06T11:00:00+00:00",
        "capacity": 75, "kind": "lecture", "building": "IET",
    })
    assert response.status_code == 200, response.text
    ids = [r["id"] for r in response.json()["recommendations"]]
    assert "IET18" not in ids
    assert "IET19" in ids


def test_admin_import_is_dry_run_by_default(client_for):
    client, captured = client_for(role="admin", verified=True)
    response = client.post("/api/v1/admin/cohorts/import",
        headers={"Authorization": "Bearer admin-token", "Content-Type": "text/csv"},
        content=b"code,branch,academic_year,section,batch_start,expected_size\nCSE-A,CSE,2,A,2025,75\n")
    assert response.status_code == 200, response.text
    assert response.json()["dry_run"] is True
    assert response.json()["valid_rows"] == 1
    assert not any("/rpc/import_academic_cohorts" in path for _, path, _ in captured)


def test_duplicate_csv_rows_are_rejected(client_for):
    client, _ = client_for(role="admin", verified=True)
    response = client.post("/api/v1/admin/cohorts/import",
        headers={"Authorization": "Bearer admin-token", "Content-Type": "text/csv"},
        content=b"code,branch,academic_year,section,batch_start\nCSE-A,CSE,2,A,2025\nCSE-A,CSE,2,A,2025\n")
    assert response.status_code == 422


def test_unverified_admin_role_does_not_authorize_admin_actions(client_for):
    client, captured = client_for(role="admin", verified=False)
    response = client.post("/api/v1/admin/cohorts/import",
        headers={"Authorization": "Bearer admin-token", "Content-Type": "text/csv"},
        content=b"code,branch,academic_year,section,batch_start\nCSE-A,CSE,2,A,2025\n")
    assert response.status_code == 403
    assert not any("/rpc/import_academic_cohorts" in path for _, path, _ in captured)
