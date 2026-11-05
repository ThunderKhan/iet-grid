# IET Grid — System Specification

## Product objective

An institution-specific academic scheduling platform for IET and Deeksha Bhawan, DDUGU, with credible faculty reservations, official timetable occupancy, student-facing schedules/announcements, conflict prevention and explainable alternatives.

## Runtime boundaries

- **frontend/**: React/Vite application on https://iet-grid.vercel.app. Handles UX, sign-in and client demonstration data.
- **backend/**: independently deployed FastAPI API on https://iet-grid-api.vercel.app, with modular routes for availability, bookings, academic operations, CSV imports, notices and administration.
- **Supabase PostgreSQL/Auth**: 20 RLS-enabled application tables, identity verification, authoritative booking RPCs and overlap constraints.
- **docs/**: PRD, MVP, architecture, design, decision log, test plan and [backend implementation record](BACKEND_IMPLEMENTATION.md).

## Invariants

1. Exactly one confirmed occupancy per room and overlapping interval across bookings, university academic sessions and maintenance blocks.
2. Faculty and cohorts cannot be scheduled into overlapping confirmed sessions.
3. Half-open intervals [start,end): back-to-back lectures are valid.
4. An availability response is advisory. The database transaction is authoritative.
5. Booking requests are idempotent; repeated equivalent requests may return their existing record.
6. Pending exam/event requests do not hold confirmed inventory, and approval revalidates collisions.
7. Verified roles come from trusted DB profiles. Students cannot modify official reservations; coordinators require delegated building scopes.
8. User-specific record access is governed by RLS; in-app cohort notices have scoped visibility.
9. Guest demonstration records are explicitly nonpersistent and never official university records.
10. Source floor geometry, room capacity, and academic datasets must be verified before representing them as accurate.

## Database

Versioned SQL migrations **001–008** are located under backend/supabase/migrations and have been applied to the dedicated project. The previously missing 003–005 files are restored in Git. Room/faculty/cohort allocation triggers, database exclusion constraints, and secure SQL RPCs provide one reservation authority.

## Verification status

Live API health/OpenAPI endpoints returned HTTP 200. Automated unit and mocked API suites have passed; PostgreSQL rolled-back collision tests passed after a trigger fix. New calendar and pagination regressions are included in CI. Real administrator/faculty/student accounts and authenticated end-to-end booking tests are still required.

## Product roadmap beyond hackathon

Real student/branch/batch file import, exact blueprint polygons, deeper academic identity verification, versioned semester drafts and optimization with OR-Tools, full administrative UI and operational monitoring.

## Related

[MVP](MVP.md) · [PRD](PRD.md) · [Architecture](ARCHITECTURE.md) · [Backend Implementation](BACKEND_IMPLEMENTATION.md) · [Test Plan](TEST_PLAN.md) · [Design](DESIGN.md)
