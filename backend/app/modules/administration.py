"""Trusted administrative actions, validated CSV imports and role provisioning.

Never trust profile role metadata from the client. Every mutation is rechecked
inside the Supabase SQL RPC; this API's role check is defense in depth.
"""
import csv
from io import StringIO
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, ValidationError
from app.core.auth import Principal, require_admin
from app.core.gateway import Gateway

router = APIRouter()


class CohortRow(BaseModel):
    code: str = Field(pattern=r"^[A-Za-z0-9_-]{2,32}$")
    branch: str = Field(pattern=r"^[A-Za-z0-9/+-]{2,20}$")
    academic_year: int = Field(ge=1, le=6)
    section: str = Field(pattern=r"^[A-Za-z0-9_-]{1,10}$")
    batch_start: int = Field(ge=2000, le=2100)
    expected_size: int | None = Field(default=None, ge=1)


class RoleChange(BaseModel):
    role: str = Field(pattern="^(student|faculty|coordinator|admin)$")
    verified: bool = True


class CoordinatorScope(BaseModel):
    user_id: UUID
    building: str = Field(pattern="^(IET|DEEK)$")


class EnrollStudent(BaseModel):
    user_id: UUID
    cohort_id: UUID


class CourseCreate(BaseModel):
    code: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=3, max_length=180)
    branch: str | None = None


class AssignTeaching(BaseModel):
    faculty_id: UUID
    cohort_id: UUID
    course_id: UUID


@router.post("/admin/cohorts/import")
async def import_cohorts(request: Request,
                         dry_run: bool = Query(True, description="Dry run is default; pass false to commit"),
                         me: Principal = Depends(require_admin)):
    """Atomic, administrator-only import of metadata (not fabricated student identities).

    CSV header: code,branch,academic_year,section,batch_start,expected_size
    """
    if "text/csv" not in request.headers.get("content-type", ""):
        raise HTTPException(415, "Submit CSV using Content-Type: text/csv")
    raw = await request.body()
    if len(raw) > 256_000:
        raise HTTPException(413, "CSV exceeds 256 KB")
    try:
        source = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(422, "CSV must be UTF-8")
    parsed = csv.DictReader(StringIO(source))
    required = {"code", "branch", "academic_year", "section", "batch_start"}
    if not parsed.fieldnames or not required.issubset(
        {h.strip() for h in parsed.fieldnames if h}
    ):
        raise HTTPException(422, "CSV missing required columns: " + ", ".join(sorted(required)))
    rows: list[dict] = []
    codes: set[str] = set()
    for line, record in enumerate(parsed, 2):
        if line > 501:
            raise HTTPException(422, "Import limited to 500 cohorts")
        try:
            row = CohortRow.model_validate({
                key.strip(): (value.strip() if value is not None else None)
                for key, value in record.items() if key is not None
            })
        except ValidationError as e:
            raise HTTPException(422, f"Invalid CSV row {line}: {e.errors()[0]['msg']}")
        key = row.code.upper()
        if key in codes:
            raise HTTPException(422, f"Duplicate cohort code in CSV at row {line}")
        codes.add(key)
        rows.append(row.model_dump())
    if not rows:
        raise HTTPException(422, "CSV contains no cohort rows")
    if dry_run:
        return {"dry_run": True, "valid_rows": len(rows), "preview": rows[:10],
                "message": "Valid CSV. Re-submit with dry_run=false for atomic database upsert."}
    db = Gateway(request, me.token)
    count = await db.rpc("import_academic_cohorts", {"p_rows": rows})
    return {"dry_run": False, "imported_rows": count, "status": "committed",
            "note": "Existing cohort codes updated atomically; no student profiles invented."}


@router.post("/admin/users/{user_id}/role")
async def update_user_role(user_id: UUID, body: RoleChange, request: Request,
                           me: Principal = Depends(require_admin)):
    db = Gateway(request, me.token)
    await db.rpc("provision_campus_user", {
        "p_user_id": str(user_id), "p_role": body.role, "p_verified": body.verified
    })
    return {"id": user_id, "role": body.role, "verified": body.verified}


@router.post("/admin/coordinator-scopes")
async def grant_scope(body: CoordinatorScope, request: Request,
                      me: Principal = Depends(require_admin)):
    db = Gateway(request, me.token)
    await db.rpc("assign_coordinator_building", {
        "p_user_id": str(body.user_id), "p_building": body.building
    })
    return {"id": body.user_id, "building": body.building}


@router.post("/admin/enrollments")
async def enroll_student(body: EnrollStudent, request: Request,
                         me: Principal = Depends(require_admin)):
    db = Gateway(request, me.token)
    await db.rpc("enroll_verified_student", {
        "p_user_id": str(body.user_id), "p_cohort_id": str(body.cohort_id)
    })
    return {"user_id": body.user_id, "cohort_id": body.cohort_id, "verified": True}


@router.post("/admin/courses", status_code=201)
async def create_course(body: CourseCreate, request: Request,
                        me: Principal = Depends(require_admin)):
    db = Gateway(request, me.token)
    course_id = await db.rpc("upsert_iet_course", {
        "p_code": body.code, "p_name": body.name, "p_branch": body.branch
    })
    return {"id": course_id, "code": body.code}


@router.post("/admin/teaching-assignments")
async def assign_teacher(body: AssignTeaching, request: Request,
                         me: Principal = Depends(require_admin)):
    db = Gateway(request, me.token)
    await db.rpc("assign_faculty_to_cohort", {
        "p_faculty_id": str(body.faculty_id),
        "p_cohort_id": str(body.cohort_id),
        "p_course_id": str(body.course_id),
    })
    return {"status": "assigned", "faculty_id": body.faculty_id}
