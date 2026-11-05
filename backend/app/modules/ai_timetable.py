"""Admin timetable import and deterministic room reservation planning.

The timetable parser is deliberately usable without an OpenAI API key. If an
OpenAI key/model is configured, the extracted text can optionally be sent to
the model for normalization; otherwise the deterministic PDF/DOCX parser is
used. Room selection is always deterministic and is revalidated by PostgreSQL.
"""
from __future__ import annotations

import io
import os
import re
from datetime import date, datetime, time, timedelta
from uuid import UUID, uuid4, uuid5
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from app.core.auth import Principal, require_admin
from app.core.gateway import Gateway
from app.modules.campus import get_allocations, get_rooms
from app.modules.scheduling import (
    find_available,
    normalize_required_equipment,
    overlaps,
    parse_instant,
)

router = APIRouter()
IST = ZoneInfo("Asia/Kolkata")
WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}
SLOTS = [
    ("10:00", "11:00"), ("11:00", "12:00"), ("12:00", "13:00"),
    ("13:00", "14:00"), ("14:00", "15:00"), ("15:00", "16:00"),
    ("16:00", "17:00"),
]


class TimetableRow(BaseModel):
    day: str
    start_time: str
    end_time: str
    cohort: str
    course_code: str
    course_title: str | None = None
    faculty: str | None = None
    room_id: str | None = None
    kind: str = Field(default="lecture", pattern="^(lecture|practical|exam|event)$")
    required_equipment: list[str] = Field(default_factory=list, max_length=8)
    kind: str = Field(default="lecture", pattern="^(lecture|practical|exam|event)$")


class TimetableDocument(BaseModel):
    title: str = "Imported timetable"
    effective_from: date | None = None
    semester: str | None = None
    rows: list[TimetableRow]


class ParseResponse(BaseModel):
    timetable: TimetableDocument
    parser: str
    warning: str | None = None


class PreviewRequest(BaseModel):
    timetable: TimetableDocument
    occurrence_start: date
    occurrence_end: date


class ConfirmRow(BaseModel):
    row_index: int
    title: str = Field(min_length=3, max_length=180)
    room_id: str
    starts_at: datetime
    ends_at: datetime
    cohort_id: UUID | None = None
    required_capacity: int = Field(default=1, ge=1, le=2000)
    required_equipment: list[str] = Field(default_factory=list, max_length=8)
    kind: str = Field(default="lecture", pattern="^(lecture|practical|exam|event)$")


class ConfirmRequest(BaseModel):
    rows: list[ConfirmRow]
    idempotency_prefix: UUID = Field(default_factory=uuid4)


def _extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise HTTPException(500, "PDF support is not installed. Run pip install -r backend/requirements.txt") from exc
    try:
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception as exc:
        raise HTTPException(422, f"Could not read PDF: {exc}") from exc
    if len(re.sub(r"\\s+", "", text)) < 80:
        raise HTTPException(422, "This PDF appears scanned or contains too little selectable text. Use a text-based PDF for the demo.")
    return text


def _extract_docx(data: bytes) -> str:
    try:
        from docx import Document
    except ImportError as exc:
        raise HTTPException(500, "DOCX support is not installed. Run pip install -r backend/requirements.txt") from exc
    try:
        doc = Document(io.BytesIO(data))
        parts = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                parts.append("  ".join(cell.text.strip() for cell in row.cells))
        text = "\n".join(parts)
    except Exception as exc:
        raise HTTPException(422, f"Could not read DOCX: {exc}") from exc
    if len(re.sub(r"\\s+", "", text)) < 30:
        raise HTTPException(422, "The DOCX contains too little readable timetable text.")
    return text


def _parse_effective_from(text: str) -> date | None:
    match = re.search(r"Effective From:\s*(\\d{1,2})/(\\d{1,2})/(\\d{4})", text, re.I)
    if not match:
        return None
    return date(int(match.group(3)), int(match.group(2)), int(match.group(1)))


def _parse_title(text: str) -> str:
    match = re.search(r"^\\s*(.+?TIME TABLE.+?)\\s*$", text, re.I | re.M)
    return match.group(1).strip() if match else "Imported timetable"


def _parse_fixed_width_rows(text: str) -> list[TimetableRow]:
    lines = text.splitlines()
    rows: list[TimetableRow] = []
    current_day: str | None = None
    current_semester: str | None = None

    # The source timetable uses a fixed-width seven-slot layout. Find the
    # horizontal starts from its header, then slice each subsequent cohort row
    # at the same positions. This preserves empty timetable cells.
    header = next((line for line in lines if "Day" in line and "Semester" in line and "I (" in line), "")
    slot_starts = [m.start() for m in re.finditer(r"\\b(?:I|II|III|IV|V|VI|VII)\\s*\\(", header)]
    if len(slot_starts) != 7:
        slot_starts = []

    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped:
            continue
        lower = stripped.lower()
        if lower in WEEKDAYS:
            current_day = lower
            continue
        if re.fullmatch(r"odd semester|even semester|semester", lower):
            current_semester = stripped
            continue
        if not current_day or not re.search(r"^BCA\\s+", stripped, re.I):
            continue

        cohort_match = re.match(r"^(BCA\\s+.+?\\s+(?:III|V|I|II|IV|VI|VII))(?=\\s{2,}|$)", stripped, re.I)
        if not cohort_match:
            cohort_match = re.match(r"^(BCA\\s+.+?)(?:\\s{2,}|$)", stripped, re.I)
        if not cohort_match:
            continue
        cohort = cohort_match.group(1).strip()

        cells: list[str] = []
        if slot_starts:
            # The extracted line may have lost leading whitespace. Re-align
            # against the first slot start by padding only when necessary.
            line_for_slice = line
            starts = slot_starts
            for i, start in enumerate(starts):
                end = starts[i + 1] if i + 1 < len(starts) else len(line_for_slice)
                cells.append(line_for_slice[start:end].strip())
        else:
            # Fallback for DOCX/non-fixed-width extraction.
            tail = stripped[len(cohort):]
            cells = re.split(r"\\s{2,}", tail.strip())

        for slot_index, cell in enumerate(cells[:7]):
            if not cell:
                continue
            matches = list(re.finditer(
                r"(?P<code>[A-Z]{2,}[A-Z0-9]*\\d{2,}[A-Z0-9]*)\\s*"
                r"\\((?P<faculty>[^)]*)\\)\\s*(?P<room>IET\\d+)",
                cell,
                re.I,
            ))
            if not matches:
                continue
            for match in matches:
                code = match.group("code").upper()
                faculty = match.group("faculty").strip()
                room = match.group("room").upper()
                kind = "practical" if code.endswith("L") or "PR" in faculty.upper() else "lecture"
                start, end = SLOTS[slot_index]
                rows.append(TimetableRow(
                    day=current_day,
                    start_time=start,
                    end_time=end,
                    cohort=cohort,
                    course_code=code,
                    course_title=code,
                    faculty=faculty or None,
                    room_id=room,
                    kind=kind,
                ))
    if not rows:
        raise HTTPException(422, "No timetable rows could be recognized. Expected day/cohort/course/room cells.")
    return rows


async def _maybe_ai_normalize(text: str) -> TimetableDocument | None:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_TIMETABLE_MODEL", "").strip()
    if not key or not model:
        return None
    # AI is an optional normalizer only. It never selects rooms or writes bookings.
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "title": {"type": "string"},
            "effective_from": {"type": ["string", "null"]},
            "semester": {"type": ["string", "null"]},
            "rows": {"type": "array", "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "day": {"type": "string"}, "start_time": {"type": "string"},
                    "end_time": {"type": "string"}, "cohort": {"type": "string"},
                    "course_code": {"type": "string"}, "course_title": {"type": ["string", "null"]},
                    "faculty": {"type": ["string", "null"]}, "room_id": {"type": ["string", "null"]},
                    "kind": {"type": "string", "enum": ["lecture", "practical", "exam", "event"]},
                    "required_equipment": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["day","start_time","end_time","cohort","course_code","course_title",
                             "faculty","room_id","kind","required_equipment"],
            }},
        },
        "required": ["title","effective_from","semester","rows"],
    }
    payload = {
        "model": model,
        "input": [
            {"role": "system", "content": "Normalize the timetable text into the supplied JSON schema. Preserve every explicit room. Never invent rooms, dates, courses, faculty or equipment."},
            {"role": "user", "content": text[:60000]},
        ],
        "text": {"format": {"type": "json_schema", "name": "timetable", "strict": True, "schema": schema}},
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
                json=payload,
            )
        response.raise_for_status()
        body = response.json()
        output_text = body.get("output_text")
        if not output_text:
            return None
        return TimetableDocument.model_validate_json(output_text)
    except Exception:
        # A demo must remain usable if the API is unavailable or has no credit.
        return None


def _date_occurrences(start: date, end: date, weekday: int):
    cursor = start
    while cursor <= end:
        if cursor.weekday() == weekday:
            yield cursor
        cursor += timedelta(days=1)


def _local_interval(day: date, start_time: str, end_time: str) -> tuple[datetime, datetime]:
    def parse(value: str) -> time:
        return datetime.strptime(value, "%H:%M").time()
    return (
        datetime.combine(day, parse(start_time), IST),
        datetime.combine(day, parse(end_time), IST),
    )


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _match_cohort(row: TimetableRow, cohorts: list[dict]) -> dict | None:
    target = _norm(row.cohort)
    exact = [c for c in cohorts if _norm(str(c.get("code", ""))) == target]
    if exact:
        return exact[0]
    tokens = set(re.findall(r"[a-z0-9]+", row.cohort.lower()))
    scored = []
    for c in cohorts:
        hay = " ".join(str(c.get(k, "")) for k in ("code", "branch", "section", "academic_year"))
        score = sum(1 for token in tokens if len(token) > 2 and token in hay.lower())
        if score:
            scored.append((score, c))
    return max(scored, key=lambda item: item[0])[1] if scored else None


async def _plan(request: Request, token: str, body: PreviewRequest) -> dict:
    if body.occurrence_end < body.occurrence_start:
        raise HTTPException(422, "Occurrence end date must be on or after start date.")
    db = Gateway(request, token)
    rooms = await get_rooms(db)
    cohorts = await db.select("academic_cohorts", {
        "select": "id,code,branch,academic_year,section,batch_start,expected_size,active",
        "order": "code.asc",
    })
    all_start = datetime.combine(body.occurrence_start, time.min, IST)
    all_end = datetime.combine(body.occurrence_end + timedelta(days=1), time.min, IST)
    allocations = await get_allocations(db, all_start, all_end)
    room_map = {r["id"]: r for r in rooms}
    result = []
    for index, row in enumerate(body.timetable.rows):
        weekday = WEEKDAYS.get(row.day.lower())
        if weekday is None:
            result.append({"row_index": index, "status": "error", "reason": f"Unknown weekday: {row.day}"})
            continue
        cohort = _match_cohort(row, cohorts)
        capacity = int(cohort.get("expected_size") or 1) if cohort else 1
        capacity_source = "academic_cohort" if cohort and cohort.get("expected_size") else "fallback_1"
        required = normalize_required_equipment(row.required_equipment)
        for occurrence in _date_occurrences(body.occurrence_start, body.occurrence_end, weekday):
            start, end = _local_interval(occurrence, row.start_time, row.end_time)
            chosen = None
            status = "ready"
            reason = None
            warnings = []
            explicit = row.room_id.upper() if row.room_id else None
            if explicit:
                room = room_map.get(explicit)
                if not room:
                    status, reason = "conflict", f"Room {explicit} is not in the current campus inventory."
                else:
                    occupied = any(
                        a["room_id"] == explicit and overlaps(start, end, parse_instant(a["starts_at"]), parse_instant(a["ends_at"]))
                        for a in allocations
                    )
                    eligible = room_is_eligible(room, capacity, row.kind, required)
                    if occupied:
                        status, reason = "conflict", f"{explicit} is already allocated during this period."
                    elif not eligible:
                        status, reason = "conflict", f"{explicit} does not satisfy the current capacity/restriction constraints."
                    else:
                        chosen = room
            else:
                ranked = find_available(rooms, allocations, start, end, capacity, row.kind, None, required)
                if ranked:
                    chosen = ranked[0]
                else:
                    status, reason = "conflict", "No eligible room is available for this occurrence."
            if chosen and status == "ready":
                if not chosen.get("verified", False):
                    warnings.append("Room metadata is provisional.")
                if capacity_source == "fallback_1":
                    warnings.append("No matching cohort size was found; capacity 1 is a conservative fallback.")
                result.append({
                    "row_index": index, "day": row.day, "date": occurrence.isoformat(),
                    "start": start.isoformat(), "end": end.isoformat(),
                    "cohort": row.cohort, "cohort_id": str(cohort["id"]) if cohort else None,
                    "expected_size": capacity, "capacity_source": capacity_source,
                    "course_code": row.course_code, "course_title": row.course_title or row.course_code,
                    "faculty": row.faculty, "room_id": chosen["id"], "room_source": "timetable" if explicit else "auto",
                    "kind": row.kind, "status": "ready", "warnings": warnings,
                })
            else:
                result.append({
                    "row_index": index, "day": row.day, "date": occurrence.isoformat(),
                    "start": start.isoformat(), "end": end.isoformat(),
                    "cohort": row.cohort, "cohort_id": str(cohort["id"]) if cohort else None,
                    "expected_size": capacity, "capacity_source": capacity_source,
                    "course_code": row.course_code, "course_title": row.course_title or row.course_code,
                    "faculty": row.faculty, "room_id": explicit, "room_source": "timetable" if explicit else "auto",
                    "kind": row.kind, "status": status, "reason": reason,
                })
    ready = sum(1 for x in result if x["status"] == "ready")
    conflicts = len(result) - ready
    return {"occurrences": result, "ready_count": ready, "conflict_count": conflicts,
            "total_count": len(result), "parser_note": "AI normalizes text when configured; deterministic parser is used when OpenAI is unavailable."}


@router.post("/admin/ai/timetable/parse", response_model=ParseResponse)
async def parse_timetable(
    request: Request,
    file: UploadFile = File(...),
    me: Principal = Depends(require_admin),
):
    filename = (file.filename or "").lower()
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "Timetable file is too large. Maximum is 10 MB.")
    if filename.endswith(".pdf"):
        text = _extract_pdf(data)
    elif filename.endswith(".docx"):
        text = _extract_docx(data)
    else:
        raise HTTPException(415, "Upload a PDF or DOCX timetable.")
    ai = await _maybe_ai_normalize(text)
    if ai and ai.rows:
        return ParseResponse(timetable=ai, parser="openai", warning=None)
    parsed = TimetableDocument(
        title=_parse_title(text),
        effective_from=_parse_effective_from(text),
        semester="ODD SEMESTER" if re.search(r"ODD SEMESTER", text, re.I) else None,
        rows=_parse_fixed_width_rows(text),
    )
    return ParseResponse(
        timetable=parsed,
        parser="deterministic",
        warning="OpenAI normalization was not used; the local timetable parser is active. This is safe for the demo and requires no API credit.",
    )


@router.post("/admin/ai/timetable/preview")
async def preview_timetable(body: PreviewRequest, request: Request, me: Principal = Depends(require_admin)):
    return await _plan(request, me.token, body)


@router.post("/admin/ai/timetable/confirm")
async def confirm_timetable(body: ConfirmRequest, request: Request, me: Principal = Depends(require_admin)):
    db = Gateway(request, me.token)
    confirmed = []
    failed = []
    for item in body.rows:
        equipment = sorted(normalize_required_equipment(item.required_equipment))
        key = uuid5(body.idempotency_prefix, f"{item.row_index}:{item.room_id}:{item.starts_at.isoformat()}")
        try:
            booking_id = await db.rpc("request_room_booking_with_equipment", {
                "p_room_id": item.room_id,
                "p_title": item.title,
                "p_starts_at": item.starts_at.isoformat(),
                "p_ends_at": item.ends_at.isoformat(),
                "p_kind": item.kind,
                "p_required_capacity": item.required_capacity,
                "p_idempotency_key": str(key),
                "p_cohort_id": str(item.cohort_id) if item.cohort_id else None,
                "p_required_equipment": equipment,
            })
            confirmed.append({"row_index": item.row_index, "booking_id": str(booking_id), "room_id": item.room_id})
        except Exception as exc:
            failed.append({"row_index": item.row_index, "room_id": item.room_id, "error": str(exc)})
    return {"confirmed": confirmed, "failed": failed, "confirmed_count": len(confirmed), "failed_count": len(failed)}
