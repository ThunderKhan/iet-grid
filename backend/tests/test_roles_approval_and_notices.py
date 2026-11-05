"""Hackathon P0: independent simulated admin, faculty and student HTTP sessions.

Mock Supabase Auth/PostgREST responses, not real signed production JWTs.
The real PostgreSQL/RLS test is in tests/integration/sql_p0_roles_approvals.sql.
"""
from uuid import UUID
import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import app

ACTORS = {
    "admin": {"id":"b2a46f74-ec04-4286-862c-bfb8cd94c7e1", "role":"admin", "verified":True},
    "faculty": {"id":"f3de820c-1968-4c81-bd98-a45f21b1a83e", "role":"faculty", "verified":True},
    "student": {"id":"9efb03d9-2ca2-485b-9264-9a28090aca01", "role":"student", "verified":False},
    "unverified": {"id":"324661e2-2fc6-4aa1-9528-41c22cefe78b","role":"faculty","verified":False},
}
BOOKING_ID = "ac13bd6e-e691-46d4-926c-fb2a03df0161"
NOTICE_ID = "dbc0978a-563e-4cb2-b35f-2f67db207332"

@pytest.fixture
def campus_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL","https://mock-campus.invalid")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY","sb_publishable_test")
    captured = []
    approvals = []
    notices = [{"id":NOTICE_ID,"title":"Confirmed exam room","body":"IET19, 11:00",
                "priority":"high","cohort_id":None,"created_at":"2026-11-05T11:00:00+00:00"}]
    reads = []

    def respond(request: httpx.Request):
        token = request.headers.get("Authorization","").replace("Bearer ","")
        actor = ACTORS.get(token)
        captured.append((token,request.method,request.url.path))
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200,json={"id":actor["id"]}) if actor else httpx.Response(401,json={"error":"invalid token"})
        if not actor:
            return httpx.Response(401,json={"message":"not signed in"})
        if request.url.path.endswith("/rest/v1/profiles"):
            return httpx.Response(200,json=[{"id":actor["id"],"role":actor["role"],
                "verified":actor["verified"],"full_name":"P0 test identity"}])
        if request.url.path.endswith("/rest/v1/bookings"):
            return httpx.Response(200,json=[{"id":BOOKING_ID,"title":"Minor examination",
                "room_id":"IET19","kind":"exam","status":"pending",
                "starts_at":"2026-11-07T10:00:00+00:00",
                "ends_at":"2026-11-07T11:00:00+00:00",
                "created_by":ACTORS["faculty"]["id"],"cohort_id":None}])
        if request.url.path.endswith("/rest/v1/announcements"):
            return httpx.Response(200,json=notices)
        if request.url.path.endswith("/rest/v1/announcement_reads"):
            return httpx.Response(200,json=[])
        if request.url.path.endswith("/rest/v1/rpc/review_room_booking"):
            approvals.append(request.content.decode())
            return httpx.Response(204)
        if request.url.path.endswith("/rest/v1/rpc/publish_targeted_notice"):
            import json
            body=json.loads(request.content.decode())
            notices.append({"id":NOTICE_ID,"title":body["p_title"],"body":body["p_body"],
                "priority":body["p_priority"],"cohort_id":body["p_cohort_id"],
                "created_at":"2026-11-05T12:00:00+00:00"})
            return httpx.Response(200,json=NOTICE_ID)
        if request.url.path.endswith("/rest/v1/rpc/mark_announcement_read"):
            reads.append(request.content.decode())
            return httpx.Response(204)
        if request.url.path.endswith("/rest/v1/rpc/provision_campus_user"):
            return httpx.Response(204)
        return httpx.Response(200,json=[])

    with TestClient(app) as client:
        app.state.http = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        yield client,captured,approvals,notices,reads


def hdr(actor):
    return {"Authorization":"Bearer "+actor}

def test_student_cannot_book_or_approve(campus_client):
    client,captured,approvals,_,_=campus_client
    r=client.post("/api/v1/bookings",headers=hdr("student"),json={
        "room_id":"IET19","title":"Forbidden lecture","starts_at":"2026-11-07T10:00:00+00:00",
        "ends_at":"2026-11-07T11:00:00+00:00"})
    assert r.status_code==403
    r=client.post(f"/api/v1/admin/bookings/{BOOKING_ID}/review",
                  headers=hdr("student"),json={"approve":True})
    assert r.status_code==403
    assert approvals==[]


def test_student_cannot_publish_campus_notices(campus_client):
    client,captured,_,notices,_=campus_client
    r=client.post("/api/v1/admin/announcements",headers=hdr("student"),
                  json={"title":"Unauthorized update","body":"ignored","priority":"high"})
    assert r.status_code==403
    assert len(notices)==1


def test_unverified_faculty_cannot_book(campus_client):
    client,*_=campus_client
    r=client.post("/api/v1/bookings",headers=hdr("unverified"),
        json={"room_id":"IET19","title":"Test unverified teacher",
        "starts_at":"2026-11-07T10:00:00+00:00",
        "ends_at":"2026-11-07T11:00:00+00:00"})
    assert r.status_code==403


def test_faculty_cannot_view_pending_approval_queue(campus_client):
    client,*_=campus_client
    assert client.get("/api/v1/bookings/pending",headers=hdr("faculty")).status_code==403


def test_admin_can_review_pending_exam(campus_client):
    client,captured,approvals,_,_=campus_client
    r=client.get("/api/v1/bookings/pending",headers=hdr("admin"))
    assert r.status_code==200
    assert r.json()["bookings"][0]["kind"]=="exam"
    approved=client.post(f"/api/v1/admin/bookings/{BOOKING_ID}/review",
        headers=hdr("admin"),json={"approve":True})
    assert approved.status_code==200
    assert approved.json()["status"]=="confirmed"
    assert len(approvals)==1
    assert '"p_approve":true' in approvals[0]
    assert ("admin","POST","/rest/v1/rpc/review_room_booking") in captured


def test_admin_can_reject_pending_exam(campus_client):
    client,_,approvals,_,_=campus_client
    r=client.post(f"/api/v1/admin/bookings/{BOOKING_ID}/review",
      headers=hdr("admin"),json={"approve":False})
    assert r.status_code==200
    assert r.json()["status"]=="rejected"
    assert '"p_approve":false' in approvals[0]


def test_faculty_cannot_review_exam(campus_client):
    client,_,approvals,_,_=campus_client
    assert client.post(f"/api/v1/admin/bookings/{BOOKING_ID}/review",
      headers=hdr("faculty"),json={"approve":True}).status_code==403
    assert not approvals


def test_administrator_can_publish_priority_notice(campus_client):
    client,captured,_,notices,_=campus_client
    r=client.post("/api/v1/admin/announcements",headers=hdr("admin"),
       json={"title":"Room change alert","body":"Check official schedule","priority":"high"})
    assert r.status_code==201
    assert r.json()["status"]=="published"
    assert len(notices)==2
    assert notices[-1]["priority"]=="high"
    assert ("admin","POST","/rest/v1/rpc/publish_targeted_notice") in captured


def test_student_can_read_and_acknowledge_global_notice(campus_client):
    client,_,_,_,reads=campus_client
    r=client.get("/api/v1/announcements",headers=hdr("student"))
    assert r.status_code==200
    assert r.json()["unread_count"]==1
    assert r.json()["announcements"][0]["priority"]=="high"
    receipt=client.post(f"/api/v1/announcements/{NOTICE_ID}/read",headers=hdr("student"))
    assert receipt.status_code==200
    assert receipt.json()["read"] is True
    assert len(reads)==1


def test_only_admin_can_provision_faculty_student(campus_client):
    client,captured,_,_,_=campus_client
    for role in ("faculty","student"):
        ok=client.post(f"/api/v1/admin/users/{ACTORS[role]['id']}/role",
           headers=hdr("admin"),json={"role":role,"verified":True})
        assert ok.status_code==200
        bad=client.post(f"/api/v1/admin/users/{ACTORS[role]['id']}/role",
           headers=hdr("student"),json={"role":role,"verified":True})
        assert bad.status_code==403
    assert len([x for x in captured if x[2].endswith("/rpc/provision_campus_user")])==2
