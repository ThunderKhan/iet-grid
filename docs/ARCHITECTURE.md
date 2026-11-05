# IET Grid — Implemented System Architecture

**As of:** 5 November 2026. This describes code and provisioned services, not full institutional production readiness.

## Architecture diagram

~~~text
IET Grid React + Vite (frontend/; Vercel)
          |                         |
          | Supabase Auth           | HTTPS + user bearer token
          v                         v
   Supabase Identity          FastAPI modular monolith
   (auth.users)               (backend/; Vercel Mumbai)
                                   |
                  token validated against Supabase Auth
                                   |
                        user's JWT forwarded to
                         PostgREST + guarded RPCs
                                   |
                       Supabase PostgreSQL (Mumbai)
                          + RLS (20 public tables)
                          + canonical room allocations
                          + faculty / cohort allocations
                          + exclusion constraints
                          + booking + audit triggers
~~~

The API is independently hosted, but bookings are **not** a separate microservice. PostgreSQL remains the final authority, while FastAPI owns HTTP contracts, token verification, public read orchestration and deterministic ranking. No paid queue, cache, seat hold, payment service or ML model is required.

## Code ownership

| Location | Responsibility |
| --- | --- |
| frontend/src/App.jsx | Navigation, guest/login state, room explorer, booking and calendar interface |
| frontend/src/data.js | Explicit demonstration data and client-side sample logic |
| frontend/src/supabase.js | Browser Supabase Auth client |
| backend/app/main.py + backend/main.py | FastAPI application and Vercel entrypoint |
| backend/app/core/auth.py | Verify token with Supabase Auth and fetch RLS-protected verified role |
| backend/app/core/gateway.py | User-JWT-backed PostgREST/RPC gateway and standardized errors |
| backend/app/modules/campus.py | Availability, pagination and room recommendations |
| backend/app/modules/bookings.py | Booking creation, status, cancellation and approvals |
| backend/app/modules/academics.py | Calendar, one-off classes, recurrence and maintenance |
| backend/app/modules/administration.py | Cohorts, privileged provisioning and CSV import |
| backend/app/modules/notices.py | Announcements, read receipts and schedule reports |
| backend/app/modules/scheduling.py | Pure hard-constraint and deterministic ranking algorithms |
| backend/supabase/migrations/001–008 | Database design, RLS and transaction-safe operations |
| backend/tests/ | Unit, mock API, regression and rollback integration checks |

## Data model

Twenty tables grouped by domain:

**Identity:** profiles; Supabase auth.users.  
**Campus:** buildings, floors, rooms.  
**Academic:** academic_cohorts, student_memberships, courses, teaching_assignments, academic_series, academic_sessions.  
**Reservations:** bookings, room_blocks, room_allocations, faculty_allocations, cohort_allocations.  
**Administration and communication:** coordinator_scopes, announcements, announcement_reads, schedule_reports, booking_history.

### Canonical occupancy

Confirmed booking, scheduled lecture and active room block each create an active room allocation through PostgreSQL triggers. A GiST exclusion constraint rejects overlapping [start,end) ranges in the same room, including concurrent requests. Confirmed faculty and cohort commitments have separate exclusion constraints. Adjacent time ranges sharing only an endpoint do not overlap.

The authoritative booking RPC checks: signed-in verified role, room existence/type, capacity, timing, cohort teaching assignment, coordinator building scope, existing allocations, and idempotency key. It chooses confirmed or pending status. Approval repeats the database conflict guarantee. Cancellation releases allocations. Recurring series draft publication inserts all occurrences in one transaction; collisions abort publication.

**Limit:** Existing actual student cohorts and real recurring lectures have not yet been imported, so inventory does not yet represent all official university commitments.

## Recommendation engine

1. Fetch room inventory and **paginated** canonical allocations for selected interval.
2. Eliminate rooms violating capacity, room type, equipment, active status or occupied interval.
3. Rank remaining rooms by excess capacity, preferred building, and verification quality.
4. Search nearby working hours if no suitable room exists.
5. Clearly label estimates and provisional capacities; relative scores are **not probabilities**.
6. Regardless of recommendation, the SQL booking RPC always revalidates before persisting.

Supabase PostgREST responses may be capped. The read path pages allocations in batches of 500 with a bounded maximum and fails closed rather than falsely marking incomplete inventory free.

## Security

- Supabase Auth verifies JWT via the authoritative /auth/v1/user endpoint. No homemade signature validation.
- Profiles verified state and role are controlled by trusted administrative operations; never by editable user metadata.
- RLS enabled on all 20 public tables; scoped reads for bookings and targeted notices.
- Coordinator mutations verify building scope inside SQL. More granular departmental roles and identity proofing remain future work.
- No service-role key is present in the React frontend or required to invoke protected booking RPCs.
- SQL functions with SECURITY DEFINER are deliberately granted to authenticated users only where they explicitly validate privileges internally; review those permissions at every migration.

## Deployment

| App | URL | Root | Framework |
| --- | --- | --- | --- |
| Frontend | https://iet-grid.vercel.app | frontend/ | Vite |
| Backend | https://iet-grid-api.vercel.app | backend/ | FastAPI |
| Database | Dedicated IET Grid Supabase project, Mumbai | n/a | PostgreSQL/Auth |

Public browser environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL. Backend: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CORS_ORIGINS, APP_ENV. Never commit secrets or authentic university student data.

## Unfinished requirements

Student dataset import, authentic room geometry/capacity verification, provisioned staff/student test users, full end-to-end role checks, complete administrative approval interface, and automated semester-wide timetable optimization. The current spatial interface is schematic, not precise blueprint tracing.

See [BACKEND_IMPLEMENTATION.md](BACKEND_IMPLEMENTATION.md) for implementation evidence and [TEST_PLAN.md](TEST_PLAN.md) for remaining verification.
