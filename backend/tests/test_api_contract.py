"""Offline FastAPI contract and authorization smoke tests."""
from fastapi.testclient import TestClient
from app.main import app


def test_health_never_exposes_credentials():
    with TestClient(app) as client:
        r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "iet-grid-api"
    assert "publishable_key" not in body
    assert "supabase_url" not in body


def test_anonymous_cannot_read_rooms():
    with TestClient(app) as client:
        r = client.get("/api/v1/rooms")
    assert r.status_code == 401


def test_anonymous_cannot_book():
    with TestClient(app) as client:
        r = client.post("/api/v1/bookings", json={
            "room_id": "IET18", "title": "Extra lecture",
            "starts_at": "2026-11-06T10:00:00+05:30",
            "ends_at": "2026-11-06T11:00:00+05:30",
            "required_capacity": 75,
        })
    assert r.status_code == 401


def test_anonymous_cannot_import_csv():
    with TestClient(app) as client:
        r = client.post("/api/v1/admin/cohorts/import",
                        headers={"Content-Type": "text/csv"},
                        content=b"code,branch,academic_year,section,batch_start\nCSE-A,CSE,2,A,2025\n")
    assert r.status_code == 401


def test_openapi_has_all_primary_modules():
    with TestClient(app) as client:
        r = client.get("/api/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    assert "/api/v1/availability" in paths
    assert "/api/v1/recommendations" in paths
    assert "/api/v1/bookings" in paths
    assert "/api/v1/calendar" in paths
    assert "/api/v1/admin/cohorts/import" in paths


def test_cors_is_restricted_to_frontend_origin():
    with TestClient(app) as client:
        allowed = client.options("/api/v1/rooms", headers={
            "Origin": "https://iet-grid.vercel.app",
            "Access-Control-Request-Method": "GET",
        })
        blocked = client.options("/api/v1/rooms", headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "GET",
        })
    assert allowed.headers.get("access-control-allow-origin") == "https://iet-grid.vercel.app"
    assert blocked.headers.get("access-control-allow-origin") is None
