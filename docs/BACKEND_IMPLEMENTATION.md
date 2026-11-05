# IET Grid — Backend Implementation and Verification Record

**Snapshot:** 5 November 2026  
**Backend API:** https://iet-grid-api.vercel.app  
**Swagger/OpenAPI:** https://iet-grid-api.vercel.app/api/docs  
**Frontend:** https://iet-grid.vercel.app  
**Database:** isolated IET Grid Supabase PostgreSQL project in Mumbai.

This is an **implementation record**, not a guarantee of production readiness. Read alongside the [product requirements](PRD.md), [MVP](MVP.md), [architecture](ARCHITECTURE.md), [implementation plan](IMPLEMENTATION_PLAN.md) and [test plan](TEST_PLAN.md).

## 1. Deployed system

~~~text
React + Vite browser application
    |
    +-- Supabase Auth (obtains logged-in user's access token)
    |
    +-- HTTPS -> FastAPI service (separate Vercel project)
                    |
                    +-- checks Supabase Auth /auth/v1/user
                    +-- reads verified university roles from profiles
                    +-- queries authoritative availability
                    +-- evaluates room hard constraints and rankings
                    +-- forwards user's JWT to protected Supabase RPCs
                                      |
                            Supabase PostgreSQL
                            - RLS for campus records
                            - room / faculty / cohort allocations
                            - exclusion constraints for overlaps
                            - transaction-safe booking and approvals
                            - audit history and in-app notices
~~~

FastAPI is deployed **separately** from the frontend. PostgreSQL remains the only authority for booking creation/approval, role enforcement and collision prevention. This is a modular monolith, not independent reservation microservices, and it does not use Redis, Kafka or a payment system.

## 2. Completed implementation phases

| Phase | Implemented | Verified evidence |
| --- | --- | --- |
| 1. Canonical database model | Buildings, floors, rooms, cohorts, memberships, courses, teaching assignments, recurrence drafts and occurrences, maintenance blocks; canonical room/faculty/cohort allocations | Migrations 003–008 applied; 20 public application tables report RLS enabled |
| 2. Identity and REST API | FastAPI routers for campus, bookings, academics, notices, administration; Supabase bearer-token validation; coarse server role gates and scoped SQL RPCs | FastAPI deployment READY; live /health and /api/openapi.json previously returned HTTP 200 |
| 2b. Academic data import | Atomic cohort CSV upsert, server-side validation and dry-run; protected student enrollment and faculty-course assignment | Mocked import validation tests; real CSV not available |
| 3. Scheduling and ranking | Half-open interval math, hard-capacity/type/equipment checks, ranked room and nearby-slot alternatives, canonical availability reads | Pure algorithm tests and mocked API tests |
| 4. Integration/testing | GitHub Actions pytest suite, rolled-back SQL collision tests, distinct frontend/API deployments and API URL integration | CI passing after async test dependency fix; actual signed-in production flow unverified |

## 3. Database migrations — all files must be retained

| Migration | Purpose |
| --- | --- |
| 001_iet_grid.sql | Initial tables, RLS, room seed and booking RPC |
| 002_security_hardening.sql | Extensions and internal trigger privileges |
| 003_canonical_occupancy_and_academics.sql | Academic entities and canonical room allocations |
| 004_transactional_booking_engine.sql | Idempotency, faculty/cohort overlap protection, cancellation/approval |
| 005_administration_and_timetables.sql | Scoped administration, recurring academic timetables, academic notices |
| 006_imports_and_in_app_receipts.sql | Atomic cohort CSV import, teaching assignment and receipts |
| 007_fix_allocation_trigger_dispatch.sql | Prevent booking trigger from accessing academic-only fields |
| 008_scoped_reads_and_notice_publication.sql | Private booking reads, targeted notice authorization, protected acknowledgements |

Migrations **003–005 were accidentally absent from main** after earlier commits; they were restored from original Git history. They had already been applied to Supabase. Keep them in the repository to preserve reproducible setup.

All scripts reside under **backend/supabase/migrations/**. The original initial migration is not designed to be re-run blindly against an existing project. Production schema changes require a reviewed migration step; they are not auto-applied when Vercel redeploys.

## 4. Transactional invariants

- A confirmed booking, published academic lecture, or active room block reserves one room interval using a shared room_allocations table.
- Confirmed teaching sessions cannot overlap for the same faculty or cohort; relevant allocation triggers enforce this transactionally.
- Interval semantics are **[start,end)**, permitting adjacent classes without overlap.
- Exam/event and restricted-room requests remain pending until authorized review; a conflicting approval fails.
- Retries with the same idempotency key and payload return the same booking, while conflicting reused keys fail.
- Cancelled records release their allocated interval through triggers.
- Publishing recurring draft occurrences is atomic: an overlap aborts the transaction.
- Student profiles cannot write official bookings, assign their own roles or publish announcements. The API and database both validate roles.

## 5. Auth and data privacy

FastAPI calls the Supabase Auth user endpoint to validate the presented bearer token, then retrieves the caller's university role from profiles. It forwards the user's own JWT to PostgREST; no service-role key is exposed by the frontend or needed for these requests. Unverified accounts default to student permissions. Coordinators have delegated building scopes for sensitive mutations. Booking-detail and targeted-notice reads use scoped RLS policies.

**Not yet demonstrated:** a full signup/role-provisioning/booking/approval test with actual independent user accounts. There were **zero registered profiles** at the observed baseline. The security advisor may report security-definer functions callable by authenticated users; those SQL functions must always enforce role/scope checks internally and be reviewed whenever changed.

## 6. API modules

- Campus: buildings/floors/rooms; paginated canonical allocation search; availability and ranked recommendations.
- Bookings: authenticated idempotent reservation creation, list, detail, cancellation and pending approval.
- Academics: calendar, one-off official sessions, recurrence drafts and atomic publication, maintenance blocks.
- Administration: trusted role grants, scopes, cohort CSV import, student enrollment, course/teaching assignment.
- Notices: in-app publication, cohort targeting, read acknowledgement and basic incorrect-schedule reports.
- Core: Auth token verification, strict API errors, environment-based configuration and shared HTTP transport.

OpenAPI is accessible on the backend; all /api/v1 routes require authenticated Supabase user access, while /health and API documentation are public.

### Availability pagination correction

Supabase/PostgREST may cap individual responses. The availability service pages occupancy data at 500 records per request, up to a bounded maximum, and **fails closed** if the upper bound is reached. It must never show an occupied room as available because additional allocation rows were omitted. Calendar reads use the same paginated allocation source.

## 7. Verification record

**Verified previously:**
- Dedicated isolated Supabase project and 20 public RLS-enabled tables; 30 seeded room records.
- SQL transaction exercise: overlapping room reservation rejected, same cohort double booking rejected, adjacent reservation allowed, conflicting pending approval rejected; the scenario was **rolled back**.
- FastAPI production /health and /api/openapi.json returned HTTP 200.
- Initial offline pytest and mocked authorization/API contract suites passed.
- **34 pytest tests passed** in [GitHub Actions Backend checks](https://github.com/ThunderKhan/iet-grid/actions/runs/42005322777), including a migration-manifest guard, paginated availability, timezone validation, mock student/faculty authorization and scheduling algorithms.
- The repository's rollback-only [SQL authenticated workflow test](../backend/tests/integration/sql_authenticated_workflows.sql) passed using temporary Auth users and SQL-simulated identities: default student signup, verified faculty booking, idempotency, overlap denial, student RLS denial, cancellation, recurring academic series, cohort notice, and pending-to-confirmed approval. All test records were rolled back.

**Not yet verified:**
- Full authenticated production path with student, faculty and admin accounts.
- Real 100-request concurrency benchmark and pressure handling.
- Production import of genuine DDUGU student records and existing timetables.
- Precise original blueprint geometry and accurate room/department scope assignments.
- Complete user-facing administrator approval and personalized student experiences.

## 8. Current deployment variables

Backend Vercel project (root **backend/**, FastAPI): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CORS_ORIGINS, APP_ENV.

Frontend Vercel project (root **frontend/**, Vite): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL. The public API origin is https://iet-grid-api.vercel.app.

Only public Supabase publishable keys are used. Never commit private university student data, passwords, access tokens or elevated database keys.

## 9. Immediately remaining work

1. Establish the first real administrator using [the trusted bootstrap guide](../backend/BOOTSTRAP_AND_ACCEPTANCE.md), then create verified faculty and student test identities; record evidence.
2. Test one actual persisted faculty booking, then an overlapping second booking; test administrator approval.
3. Import official student, cohort, faculty and timetable data when the organizers supply it; no fabricated student records.
4. Complete blueprint spatial fidelity and administrator/student UI as separate frontend work.
5. Reconcile acceptance results with [TEST_PLAN.md](TEST_PLAN.md), screenshots and the submitted Word solution.

The automated semester-wide optimizer (OR-Tools CP-SAT) remains an agreed longer-term capability, not a completed backend feature.

## Hackathon P0 role/approval/notice implementation

Admin pending exam/event Approve/Reject UI, priority notices and read receipts, and confirmed-user faculty/student provisioning have been implemented. Migrations 009–010 are applied. Exam approval and high-priority notice creation are atomic in PostgreSQL.

**44 automated pytest tests passed** and the dedicated database passed a rollback-only multi-role provisioning → pending exam → admin approval → automatic notice → student receipt scenario. The test left no real accounts, bookings or notices.

The [live P0 acceptance checklist](HACKATHON_P0_ACCEPTANCE.md) explains the final browser test with independently registered and confirmed faculty/student test identities. Real multi-account login acceptance is not yet verified. Academic dataset import remains deferred because no official file was provided.
