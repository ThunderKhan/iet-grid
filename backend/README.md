# IET Grid Backend — FastAPI + Supabase

**Public API:** https://iet-grid-api.vercel.app  
**API documentation:** https://iet-grid-api.vercel.app/api/docs  
**Health:** https://iet-grid-api.vercel.app/health

**Administrator bootstrap:** [BOOTSTRAP_AND_ACCEPTANCE.md](BOOTSTRAP_AND_ACCEPTANCE.md). First admin role must be assigned by independently verified, privileged SQL approval, never by public signup metadata.

## Design

A separately deployed FastAPI modular monolith, backed by the dedicated Supabase PostgreSQL/Auth project. The frontend is a separate React/Vite app. The API validates Supabase access tokens with its Auth service and forwards them to PostgREST so RLS continues to apply. Only SQL RPCs mutate privileged campus records.

~~~text
React/Vite (frontend/)
  ├── Supabase Auth → user JWT
  └── FastAPI (backend/)
       ├── identity + verified institutional role
       ├── campus and availability
       ├── idempotent bookings + scoped approvals
       ├── recurring academic timetables
       ├── deterministic recommendations
       ├── cohort import + student enrollment
       └── announcements and minimal issue reports
              └── Supabase PostgreSQL
                    ├── row-level security
                    ├── canonical room/faculty/cohort allocations
                    ├── GiST overlap exclusion constraints
                    ├── authorization-checked RPCs
                    └── audit records
~~~

**Do not create a second booking write path.** PostgreSQL is the final collision and role authority.

## Modules

- app/core/auth.py — Supabase bearer validation and verified roles
- app/core/gateway.py — RLS-preserving PostgREST access and normalized errors
- app/modules/campus.py — room discovery, occupancy, alternatives
- app/modules/bookings.py — booking create/list/cancel/review
- app/modules/academics.py — calendar, official sessions, recurring series, room blocks
- app/modules/scheduling.py — pure interval, capacity, equipment and ranking algorithms
- app/modules/administration.py — privileged provisioning and atomic CSV import
- app/modules/notices.py — notices, read receipts and schedule issue reporting
- app/main.py — application, routes and lifespan
- main.py — Vercel-recognized entrypoint
- supabase/migrations/001–013 — schema, security, role checks and private profile photos
- tests/ — pure unit tests, mocked API/authorization tests, rollback SQL checks

## Run locally

~~~bash
cd backend
python -m venv .venv
# Activate the environment (PowerShell: .venv\Scripts\Activate.ps1)
python -m pip install -r requirements.txt
# Set environment variables in your shell or IDE:
# SUPABASE_URL=https://cdzvtfahwbvlfnfmbilt.supabase.co
# SUPABASE_PUBLISHABLE_KEY=sb_publishable_nUrt2zIq7TP7tDcCNwd6vA_bZBejiF3
# CORS_ORIGINS=http://localhost:5123,http://127.0.0.1:5123
uvicorn main:app --reload --port 8000
~~~

The app reads environment variables directly; copying .env.example does **not** automatically load them. Never use service-role credentials in a public browser.

## Endpoints

All /api/v1 endpoints require Authorization: Bearer followed by a Supabase user access token.

| Endpoint | Method | Use |
| --- | --- | --- |
| /health | GET | Public configuration health |
| /api/v1/me | GET | Verified identity and memberships |
| /api/v1/buildings, /floors, /rooms | GET | Campus infrastructure |
| /api/v1/availability | GET | Real room occupancy by date/capacity |
| /api/v1/recommendations | GET | Ranked eligible rooms and alternative slots |
| /api/v1/calendar | GET | Canonical room allocations |
| /api/v1/bookings | POST | Idempotent reservation; instant/pending approval |
| /api/v1/bookings/me, /pending | GET | Personal and scoped pending reservations |
| /api/v1/bookings/{id}/cancel | POST | Owner/authorized cancellation |
| /api/v1/admin/bookings/{id}/review | POST | Scope-checked approval/rejection |
| /api/v1/cohorts | GET | Cohort metadata |
| /api/v1/admin/cohorts/import | POST | Validated, transaction-atomic CSV upsert |
| /api/v1/admin/enrollments | POST | Verified student-to-cohort mapping |
| /api/v1/admin/users/{id}/role | POST | Admin-only trusted role grant |
| /api/v1/admin/coordinator-scopes | POST | Delegated building permission |
| /api/v1/admin/courses | POST | Official course metadata |
| /api/v1/admin/teaching-assignments | POST | Staff-to-cohort/course assignment |
| /api/v1/admin/sessions | POST | Official lecture and timetable occupancy |
| /api/v1/admin/series, /series/{id}/publish | POST | Draft and atomic recurring publication |
| /api/v1/admin/room-blocks | POST | Maintenance/reserved interval |
| /api/v1/announcements | GET | Cohort-aware in-app notice feed |
| /api/v1/admin/announcements | POST | Scoped notices |
| /api/v1/announcements/{id}/read | POST | Guarded read receipt |
| /api/v1/reports, /reports/me | POST/GET | Minimal schedule issue reporting |

## Dataset import

Expected cohort CSV columns:

~~~csv
code,branch,academic_year,section,batch_start,expected_size
~~~

Send as Content-Type: text/csv with an authenticated university admin token. Dry run is the default. Pass dry_run=false only after reviewing validation output; the SQL RPC processes all rows atomically. The organizer-provided student-level dataset is **not yet available/imported**. The existing database must not be populated with made-up student identities. A university-verified identity mapping is needed before enrolling actual users.

## Database guarantees

The schema currently includes 20 RLS-protected public tables. Migrations 001–010 have been applied on the dedicated project. Do not rerun the initial create-table migration on the same database.

The canonical room_allocations table holds active reservations from confirmed bookings, academic lectures and maintenance blocks. Separate faculty_allocations and cohort_allocations prohibit the same teacher or cohort being committed to overlapping sessions. Half-open time intervals permit adjacent classes. Atomic triggers, transaction rollback, and a PostgreSQL exclusion constraint prevent partial allocations. Pending approvals are revalidated; they do not hold inventory. Idempotency keys protect retries, and cancellations release reservations automatically.

## Verification

~~~bash
python -m pip install 'pytest>=8,<10'
python -m pytest tests -q
~~~

- GitHub Actions tests: passed for initial, mocked Auth/RPC and algorithm suites.
- Database rollback integration: passed room, cohort, adjacency and approval-collision tests; records rolled back.
- Rollback-only simulated authenticated SQL integration: default student provisioning, faculty booking/idempotency, RLS denial, cancellation, recurring academic series, targeted notices and admin approvals passed. All temporary test users and records rolled back.
- **34 pytest tests passed** in GitHub Actions run https://github.com/ThunderKhan/iet-grid/actions/runs/42005322777.
- Live Vercel API: /health and /api/openapi.json returned HTTP 200.
- Missing: signed-in verified faculty and student end-to-end production test; 100-request concurrency benchmark; actual student datasets; final institutional acceptance tests.

## Deployment

Vercel project: iet-grid-api. Root Directory: backend. Framework: FastAPI. Function region: Mumbai. The public Vercel deployment uses SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and CORS_ORIGINS. Frontend Vercel project uses VITE_API_BASE_URL to call this API.

We have not built payments, a BookMyShow Redis hold system, Kafka or a trained ML model. The booking architecture is inspired by transactional reservation patterns, not cloned from BookMyShow.

## Hackathon P0 completion — 5 November 2026

Admin pending exam/event Approve/Reject UI, priority notices and read receipts, and confirmed-user faculty/student provisioning have been implemented. Migrations 009–010 are applied. Exam approval and high-priority notice creation are atomic in PostgreSQL.

**44 automated pytest tests passed** and the dedicated database passed a rollback-only multi-role provisioning → pending exam → admin approval → automatic notice → student receipt scenario. The test left no real accounts, bookings or notices.

The [live P0 acceptance checklist](../docs/HACKATHON_P0_ACCEPTANCE.md) explains the final browser test with independently registered and confirmed faculty/student test identities. Real multi-account login acceptance is not yet verified. Academic dataset import remains deferred because no official file was provided.

## Hackathon P1: verified room eligibility and audit records

[Detailed delivery and evidence](../docs/P1_RECOMMENDATIONS_AND_AUDIT.md). Migrations **011–012** add scoped audit history, transactional equipment matching, and saved booking requirements. API: `GET /api/v1/admin/audit` and `POST /api/v1/bookings` with `required_equipment`. Existing official room records remain unchanged; unverified metadata is labeled provisional. **52 backend tests passed**; P1 SQL rollback integration passed. Vercel currently has a daily deployment-quota error, so newest code has not been verified at the production URL.
