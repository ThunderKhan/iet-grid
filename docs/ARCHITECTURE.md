# IET Grid — Architecture & Data Design

**Architecture state:** implementation snapshot as of 5 November 2026, not a claim of production readiness.

## 1. Context diagram

~~~text
Faculty / Student / Coordinator / Admin
               |
      React 19 / Vite 6
    Vercel hosted web client
        |              |
   Supabase Auth    Supabase Data API
        |              |
      auth.users    RLS-protected tables
                       |
          server-side privileged RPCs
                       |
            PostgreSQL constraints
                       |
           bookings + audit records
~~~

**Why this stack?** A single-page client and managed Postgres/Auth avoid building and hosting a separate API under a same-day deadline. No browser holds secret or service-role credentials. Long-term optimization can become a separate service without replacing the booking core.

## 2. Key application files

The project is organized into `frontend/` for the browser application and `backend/` for Supabase-managed server-side schema and logic. `docs/` remains at the repository root. This is a directory separation, not a new HTTP microservice.

| Repository location | Responsibility |
| --- | --- |
| ../frontend/src/App.jsx | App shell, navigation, login/guest flow, room and calendar UI, booking and notice actions |
| ../frontend/src/data.js | Building/room seed data, sample schedules, overlap and recommendation utilities |
| ../frontend/src/supabase.js | Browser Supabase client initialized from public environment variables |
| ../frontend/src/styles.css | Shared design tokens and responsive application styling |
| ../backend/supabase/migrations/001_iet_grid.sql | Tables, RLS policies, booking/approval/notice functions and seeded room inventory |
| ../backend/supabase/migrations/002_security_hardening.sql | Restrict trigger-function execution, move extension out of public |
| ../frontend/vercel.json | SPA route rewriting |

## 3. Current tables

| Table | Purpose | Notable fields/rules |
| --- | --- | --- |
| profiles | Role assignment and eventual university-identity mapping | ID references auth.users, role, verified, branch, academic_year, section |
| rooms | Campus inventory | ID, building, floor, capacity, type, verified, active |
| bookings | One-time classes, exams and events | Room, creator, interval, status, kind, capacity; exclusion constraint |
| announcements | Campus academic updates | Title, body, priority, author, created timestamp |
| schedule_reports | Minimal student-submitted issues | Submitter, optional booking, details, status |
| booking_history | Change auditing | Booking ID, actor, action, timestamp |

**Not yet modeled fully:** regular recurring timetable series/occurrences, cohorts/batches/sections as normalized entities, subject-to-faculty teaching assignments, institutional approval scopes, notification read/acknowledgement state, timetable drafts, hard locks, optimized versions.

## 4. Core reservation transaction

1. User signs in through Supabase Auth.
2. Browser requests room inventory and bookings visible under RLS.
3. Browser computes and renders advisory eligible rooms using interval overlap and capacity checks.
4. User submits a booking through **create_room_booking** RPC.
5. The database reads verified role from server-controlled profiles, validates capacity, future time window and booking kind, and chooses confirmation or pending status.
6. Postgres GiST exclusion constraint rejects overlapping **confirmed** time ranges for the same room. The RPC handles an exclusion conflict with a user-facing failure.
7. Booking trigger writes an audit record; client refreshes booking data.

**Interval rule:** two reservations conflict only when A.start < B.end and B.start < A.end (half-open [start,end) intervals). Adjacent classes sharing a boundary do not overlap.

**Important limitation:** current site data includes only one-time booking rows and demonstration examples; it does not yet correctly reserve all recurring official lectures. The future unified timetable must block slots derived from recurring sessions as well.

## 5. Recommendation logic

**Hard filters:** active room, sufficient capacity, acceptable room type, available interval, and any imposed resource permission constraints.

**Current preference score (heuristic):** 100 minus penalties for excess capacity, use of a nonpreferred building and selecting a lab for a generic request. Sort highest first; use stable room ID as tie-breaker.

This is deterministic constraint-based scheduling, **not** a trained AI model. Scores reflect relative suitability, not probability or confidence. A recommendation may become stale; always revalidate on booking.

**Future:** consider weighted walking distance, accessibility, equipment, instructor preferences, recurring timetable commitments and OR-Tools CP-SAT for semester drafts.

## 6. Authentication and roles

- Supabase email/password flows are present in the frontend. Google sign-in was discussed as a target but is not currently implemented.
- New user profile defaults to **student**, **verified=false**. Admin promotion must be performed by a trusted provisioning operation.
- Faculty role may book only if verified; coordinators/admins may additionally review pending requests and publish notices using server-checked functions.
- All exposed application tables have RLS enabled. Booking direct mutations are denied; sensitive changes go through permission-aware RPC.
- **Production gap:** coordinator scopes by department/building and cohort-restricted student visibility remain to be enforced.
- **Security warning:** functions designed for authenticated access may still be flagged by generalized security advisors because they use SECURITY DEFINER. Review and test every authorization path; internal trigger functions have had their public execute privilege removed.

## 7. Data mapping for spatial view

The source PDF visual contains IET: ground/first/second floors and Deeksha: ground/first. The current app shows simplified room-grid geometry; only the identifiers, broad arrangement and availability interaction are derived from the blueprint. Exact room polygons, corridor widths, stair/entry geometry and accessibility routes are **not** yet represented accurately.

Official campus data and lab designations take precedence over code sample defaults.

## 8. Deployment and configuration

- Repo: https://github.com/ThunderKhan/iet-grid
- Site: https://iet-grid.vercel.app/
- Isolated database: dedicated IET Grid Supabase project in Mumbai.
- Public frontend variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (publishable key).
- Never add service-role keys, database passwords or user passwords to committed files.
- Apply migrations in numeric order on a new database. They are not safe to blindly replay against partially configured unrelated projects.

## 9. Next architecture milestones

1. Normalize student/branch/batch/cohort tables and import official data.
2. Normalize recurring timetable event series and generate actual occurrence conflicts.
3. Enforce coordinator building/department scopes for reads and writes.
4. Add server-side exact notifications and acknowledgement records.
5. Introduce timetable draft/version/approval tables before semester generation.
6. Upgrade the spatial interface from schematic cards to verified SVG polygons.
