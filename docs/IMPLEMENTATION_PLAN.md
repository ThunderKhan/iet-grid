# IET Grid — Implementation Plan

**Baseline:** 5 November 2026  
**Hard submission deadline:** **21:00 IST, 5 November 2026**  
**Submission:** publicly accessible deployed link, GitHub source, written Word solution and setup instructions.

## Monorepo organization

- `frontend/`: independently buildable web app, Vercel root `frontend`.
- `backend/`: independently hosted FastAPI application **plus** versioned Supabase SQL migrations; database remains authoritative.
- `docs/`: product and architecture artifacts, separate from both runtime folders.
- The dedicated Supabase project has migrations 001–008 applied. SQL migrations require reviewed deployment, independently of FastAPI/Vercel Git builds.

## Four-phase backend sprint — implementation status

| Sprint phase | Result | Remaining acceptance |
| --- | --- | --- |
| Phase 1: database redesign | **Implemented and migrated**: 20 RLS tables; room/faculty/cohort allocations; idempotent booking, cancellation, approvals; migrations 001–008 restored | Authenticated user-level transaction tests and security review |
| Phase 2: API authorization + academic import | **Implemented**: FastAPI with Supabase Auth verification; secured RPC forwarding; CSV dry-run and atomic import; recurring academic scheduling APIs | Trusted test account provisioning and real organizer dataset |
| Phase 3: scheduling/recommendations | **Implemented**: hard eligibility, capacity/type/equipment, interval/ranking, alternate slots, paginated allocations | Real student/timetable data and live user acceptance |
| Phase 4: tests + integration | **Partially verified**: GitHub Actions unit/mock tests; SQL rollback conflicts; frontend and API deployed independently; live API health/OpenAPI HTTP 200 | Real faculty/admin/student sessions, 100-request load test, screenshots |

**Important:** The database is usable but has no real registered campus profiles or imported academic timetables at the recorded baseline. The MVP is **not fully verified** until these live account/data dependencies are exercised.

See [BACKEND_IMPLEMENTATION.md](BACKEND_IMPLEMENTATION.md) for exact files, API, migrations and test evidence.

## 1. Strategy

Ship a **vertical slice**: faculty authentication → accurate vacancy search → viable recommendations → secure database booking → refreshed calendar → student academic update. The codebase may contain other features, but no incomplete feature should be advertised as tested.

### Hard precedence

1. Public deployment + working auth + secure bookings
2. Correct IET/Deeksha availability and data
3. Student/notice access + minimal issue reporting
4. Polished floor/calendar UX
5. Screenshots, documentation and presentation
6. Deferred enhancements **only if** the above are verified

The written Word document must match the implemented state. Keep a submission buffer before 21:00 rather than coding through the deadline.

## 2. Execution board

Status meanings: **DONE** = repository/infrastructure confirmed; **PARTIAL** = source exists but acceptance incomplete; **TODO** = not implemented or not verified.

| ID | Priority | Work item | Status | Gate / output |
| --- | --- | --- | --- | --- |
| INF-01 | P0 | Create repository and MIT licensing | DONE | ThunderKhan/iet-grid |
| INF-02 | P0 | Create Vite/React application shell, responsive nav and pages | DONE | Build published |
| INF-03 | P0 | Create independent Supabase project (Mumbai) | DONE | Active project; VSPH untouched |
| INF-04 | P0 | Apply schema, seed rooms and enable RLS | DONE | Six RLS tables, 30 rooms |
| INF-05 | P0 | Run security scan and restrict trigger functions | DONE | Internal trigger EXECUTE revoked |
| INF-06 | P0 | Link Vercel env and redeploy | DONE | Latest deployment reported READY |
| INF-07 | P0 | Separate frontend and backend; deploy dedicated FastAPI API | DONE | Two Vercel projects; API health/OpenAPI 200 |
| AUTH-01 | P0 | Create first administrator and verified faculty through trusted provisioning | TODO | Independent faculty/admin/student sessions |
| AUTH-02 | P0 | Verify login/logout, sessions and RLS denials | TODO | Test evidence with roles |
| BOOK-01 | P0 | Book free classroom from authenticated UI and persist | PARTIAL | API/UI implemented; verified faculty test needed |
| BOOK-02 | P0 | Reproduce collision with real sessions, verify database rejects | PARTIAL | Rolled-back SQL checks passed; two real authenticated users still needed |
| BOOK-03 | P0 | Make alternative recommendation consistent with actual official commitments | PARTIAL | Eligible options only |
| DATA-01 | P0 | Import official student/branch/batch/year/section files | BLOCKED: organizer data needed | Accurate cohort records |
| DATA-02 | P0 | Confirm exact capacities and lab/room mapping | BLOCKED: official data needed | Verified room inventory |
| MAP-01 | P0 | Integrate supplied **original** IET + Deeksha blueprints visibly/accurately | PARTIAL | Blueprint source on both buildings |
| CAL-01 | P0 | Include regular timetable commitments in availability | TODO | No false free room during recurring class |
| STUD-01 | P0 | Show student schedule, in-app notices, minimal report | PARTIAL | Student role test |
| ADMIN-01 | P0 | Approve/reject pending exam/event booking through UI | TODO | Coordinator-controlled, audited |
| NOTICE-01 | P0 | Post an exam update with admin and read as student | PARTIAL | Persisted notice after reload |
| QA-01 | P0 | Incognito deployment, mobile and role tests | TODO | Signed evidence/checklist |
| SUB-01 | P0 | Update written solution with true results, screenshots and URLs | PARTIAL | Final .docx consistent with app |
| SUB-02 | P0 | Submit URLs, source and Word solution before 21:00 IST | TODO | Submission confirmation |

## 3. Preferred next execution sequence

### Gate A — Make real data mutation work
- Register test user with real email/password in dedicated project (never put credentials in Git).
- Provision faculty and admin roles via a trusted privileged operation.
- Verify unverified user is denied booking and notices.
- Book a future available room; refresh and confirm row persists.
- Attempt conflict; verify rejection from PostgreSQL, not only JavaScript.
- For exam/event requests, verify pending status and approval conflict behavior.

**Stop criterion:** If real booking is failing, focus here before adding cosmetic effects.

### Gate B — Satisfy mandatory data and spatial requirements
- Obtain official student/branch/batch and blueprint assets.
- Normalize student relationships and import CSV with idempotent scripts and validation.
- Reconcile LH13/LH14, IET23, laboratory placement and provisional capacities.
- Embed original plans or accurately traced SVGs for both buildings; retain room IDs.
- Add recurring schedule commitments to vacancy checks so normal lectures are not omitted.

**Stop criterion:** If official data is unavailable, mark exact blocker and do not fabricate authentic records.

### Gate C — Finish coordinator/student flow
- Add pending booking review controls to admin UI.
- Publish notice via privileged RPC and verify student read.
- Ensure students cannot modify official bookings; test minimal incorrect-schedule reporting.
- Target timetable and notices by cohort where official data supports mapping.

### Gate D — Quality, documentation and submission
- Run [TEST_PLAN.md](TEST_PLAN.md) and capture evidence.
- Verify deployment in incognito and on narrow/mobile viewport.
- Add screenshots, algorithm and architecture evidence to Word solution.
- Run a rehearsal using the 3–5-minute storyboard from [MVP.md](MVP.md).
- Submit only URLs that are verified to open.

## 4. Acceptance tests and hard blockers

Blocking failures:
- Production site blank or access-protected.
- Real booking RPC fails for authorized faculty.
- Database permits two confirmed overlapping reservations.
- Unverified student can elevate role or publish official notices.
- Demo mode masquerades as persisted campus data.
- Required IET/Deeksha data or student integration falsely claimed complete.

After each task update its test evidence rather than just marking code merged. Refer to [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md).

## 5. Post-hackathon roadmap (decision-preserving, not deadline-blocking)

### Phase 2 — Institutional data integrity
Normalized students/cohorts, subjects, faculty, academic years, semesters, recurring sessions, effective date ranges, schedule-change reasons and student-specific notifications.

### Phase 3 — Operational hardening
Scoped coordinator permissions, full profile verification, cancellation/rescheduling transactions, audit UI, backups/recovery, migrations/CI and robust monitoring.

### Phase 4 — Intelligent scheduling
OR-Tools CP-SAT or equivalent; hard constraints for room/teacher/cohort overlap, capacity, practical resources and timetable restrictions; soft preferences for room continuity and faculty availability; versioned draft → review/edit/lock → publish workflows.

### Phase 5 — Campus-wide adoption
Precisely traced maps with accessibility and wayfinding, bulk imports, capacity audits, operational dashboards and opt-in additional communication methods if the university requests them.

## 6. Submission checklist

- [ ] Production URL opens and authenticates independently.
- [ ] Faculty reservation persists; collision is rejected.
- [ ] IET + Deeksha room discovery demonstrable.
- [ ] Student read restrictions and notice/report flows validated.
- [ ] Published Word file accurately describes status and limitations.
- [ ] Root README and documentation index link to setup and implementation.
- [ ] GitHub repository is accessible.
- [ ] Final pitch presenter chosen and short flow rehearsed.
- [ ] Submission completed before 21:00 IST.
