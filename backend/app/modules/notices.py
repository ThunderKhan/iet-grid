"""In-app academic notices and minimal student issue reporting."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from app.core.auth import Principal, require_user, require_coordinator
from app.core.gateway import Gateway

router = APIRouter()


class NoticeCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    body: str = Field(default="", max_length=5000)
    priority: str = Field(default="normal", pattern="^(normal|high)$")
    cohort_id: UUID | None = None


class ReportCreate(BaseModel):
    details: str = Field(min_length=5, max_length=2000)
    booking_id: UUID | None = None


@router.get("/announcements")
async def get_notices(request: Request, me: Principal = Depends(require_user)):
    db = Gateway(request, me.token)
    notices = await db.select("announcements", {
        "select": "id,title,body,priority,cohort_id,created_at",
        "order": "created_at.desc", "limit": "200",
    })
    receipts = await db.select("announcement_reads", {
        "select": "announcement_id,read_at",
        "user_id": "eq." + str(me.user_id), "limit": "200",
    })
    seen = {x["announcement_id"]: x["read_at"] for x in receipts}
    return {"announcements": [{**n, "read_at": seen.get(n["id"])} for n in notices],
            "unread_count": sum(n["id"] not in seen for n in notices)}


@router.post("/admin/announcements", status_code=201)
async def create_notice(body: NoticeCreate, request: Request,
                        me: Principal = Depends(require_coordinator)):
    db = Gateway(request, me.token)
    notice_id = await db.rpc("publish_targeted_notice", {
        "p_title": body.title, "p_body": body.body,
        "p_priority": body.priority,
        "p_cohort_id": str(body.cohort_id) if body.cohort_id else None,
    })
    return {"id": notice_id, "status": "published"}


@router.post("/announcements/{notice_id}/read")
async def read_notice(notice_id: UUID, request: Request,
                      me: Principal = Depends(require_user)):
    db = Gateway(request, me.token)
    await db.rpc("mark_announcement_read", {"p_announcement_id": str(notice_id)})
    return {"id": notice_id, "read": True}


@router.post("/reports", status_code=201)
async def report_schedule(body: ReportCreate, request: Request,
                          me: Principal = Depends(require_user)):
    db = Gateway(request, me.token)
    await db.call("POST", "schedule_reports", json={
        "submitted_by": str(me.user_id), "details": body.details,
        "booking_id": str(body.booking_id) if body.booking_id else None,
    })
    return {"status": "submitted", "note": "Official booking records were not modified"}


@router.get("/reports/me")
async def my_reports(request: Request, me: Principal = Depends(require_user)):
    db = Gateway(request, me.token)
    reports = await db.select("schedule_reports", {
        "select": "id,booking_id,details,status,created_at",
        "submitted_by": "eq." + str(me.user_id), "order": "created_at.desc",
        "limit": "100",
    })
    return {"reports": reports}
