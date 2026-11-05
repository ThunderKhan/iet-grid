# IET Grid — Hackathon P1: Recommendations and Audit History

**Implemented in source:** 5 November 2026  
**Scope:** Two agreed P1 priorities, without importing fictional university academic records.

## 1. Recommendation and room metadata consistency

### Why this was necessary

The dedicated Supabase inventory has **30** rooms, of which **6** are marked verified and **24** are provisional. Equipment arrays contain no recorded features, and accessibility is unknown for all inventoried rooms. These are gaps in the original source data, **not** evidence that rooms are physically inaccessible or lack equipment.

IET Grid intentionally preserves the original database flags and values; no projector, capacity or accessibility verification has been fabricated.

### Implementation

- Availability and recommendation API now return explicit **capacity_status**, **metadata_status**, **metadata_warnings**, **ineligibility_reasons**, **requires_approval** and **booking_outcome**.
- Hard constraints remain: active, reservable room, adequate capacity, correct room type (practicals for labs), no overlapping canonical allocation, and recorded equipment satisfying every user requirement.
- Equipment-filtered suggestions are returned only when the room metadata is marked verified and the exact requested feature is recorded. Unknown equipment cannot be treated as present.
- Exams, events, and restricted rooms are shown as **approval required**. Their booking request can be pending even when the room is currently free.
- The ranking score is shown as a deterministic **relative fit score /100**, never as a statistical booking probability or confidence score.
- Frontend Explore Rooms shows provisional vs verified capacities, missing accessibility/equipment notices, session type, equipment requirements, and approval-needed labels on recommendations and room details.
- The booking REST API accepts **required_equipment** and forwards it to a new protected PostgreSQL RPC. The RPC rechecks equipment and lab policy **inside the booking transaction**, not just in the browser.
- Migration 012 saves canonical equipment requirements on the booking and serializes idempotent retries. A retry using the same key with changed equipment criteria is rejected.

**Important limitation:** With current missing equipment metadata, selecting Projector/Computer/Microphone may legitimately yield **no eligible rooms**. This is safer than recommending an unsupported space.

### Request examples

```http
GET /api/v1/recommendations?start=2026-11-07T10%3A00%3A00%2B05%3A30&end=2026-11-07T11%3A00%3A00%2B05%3A30&capacity=75&kind=exam&building=IET
Authorization: Bearer <normal university user token>
```

```json
{
  "room_id": "IET18",
  "title": "TEST — Algorithms lecture",
  "starts_at": "2026-11-07T10:00:00+05:30",
  "ends_at": "2026-11-07T11:00:00+05:30",
  "kind": "lecture",
  "required_capacity": 75,
  "required_equipment": [],
  "idempotency_key": "<fresh UUID>"
}
```

These snippets illustrate the request contract, not an observed or promised free slot.

## 2. Administration audit history

Existing **booking_history** trigger records actual booking creation and status-change events. The new `list_booking_audit_history` database function exposes those records securely.

- `GET /api/v1/admin/audit?limit=20&offset=0&room_id=IET19&action=status`
- Requires verified university admin or building coordinator.
- PostgreSQL **SECURITY DEFINER** RPC rechecks the role and coordinator building scope for every query. Students/faculty cannot inspect administrative history.
- Each record includes event ID, booking ID, title, room, booking kind, **current** booking status, actor ID, raw database action, event timestamp and total matching records.
- Filters: room ID, event type (created/status); pagination: 1–100 events/request, offset bounded to 10,000; newest first.
- The Admin page presents a responsive read-only table, filters, pagination, truncated actor IDs, empty/error/loading states and refresh action. **No simulated audit records** are used for connected accounts.
- Audit event `created:confirmed` and `status:pending->confirmed` describe historical transitions. The separate **Current status** column reflects current booking state, not the state at the time of every event.

## Database migrations

- `011_room_eligibility_and_scoped_audit.sql` — scoped audit RPC, audit index, transaction-safe equipment checks.
- `012_persist_equipment_booking_requirements.sql` — durable required-equipment criteria with idempotent retry integrity.

Both migrations have been **successfully applied to the dedicated Supabase project**. Earlier migrations 001–010 are retained. No official room metadata was changed in production.

## Verification evidence

- **52 Python tests passed** in GitHub Actions, including new API contract and scheduling checks.
- **Frontend Vite production build and all six page-render smoke tests passed** in GitHub Actions for the new metadata/audit UI.
- The rollback-only `backend/tests/integration/sql_p1_recommendation_audit.sql` passed against Supabase: verified projector inventory, missing/unverified equipment rejection, idempotent repeat and changed-criteria denial, restricted-room pending behavior, admin history, delegated-building history and student denial. All temporary users, bookings and room edits were rolled back.
- This is **database/API/test verification**, not human browser acceptance for the new UI.

## Deployment status — material limitation

At the final release attempt, Vercel rejected production deployment creation for **both projects** with HTTP **402 payment_required** and **api-deployments-free-per-day** (more than 100 deployments requested in 24 hours). The new code is committed and passes CI, and SQL is applied, but **the current public Vercel URLs have not been verified serving this newest commit**.

Owner action: resolve Vercel's deployment quota/plan or redeploy once permitted. Do not submit screenshots of the older deployed UI as evidence that the P1 screens are live. Existing production URLs remain the previous successfully deployed application.

## Remaining non-P1 work

Official student/branch/cohort data was not supplied. Real independent faculty/student browser acceptance tests, genuine blueprint geometry, and automatic timetable optimization are out of scope for this P1 delivery.
