# IET Grid — System Specification

> Compact engineering reference. For detailed rationale see [ARCHITECTURE.md](ARCHITECTURE.md), for product scope see [PRD.md](PRD.md), and for current limitations see [MVP.md](MVP.md).

## Core responsibility

An institution-specific scheduling system that identifies suitable IET/Deeksha rooms, prevents confirmed collisions at the database layer, lets authorized faculty submit bookings and gives students academic schedule and notice access.

## Repository boundaries

- `frontend/` — React + Vite SPA, client-side room discovery/calendar and public Supabase client.
- `backend/` — Supabase SQL schema, RLS, booking/audit functions and migrations.
- `docs/` — PRD, MVP, technical/design specifications and decisions.
- Vercel builds exclusively from `frontend/`; Supabase database migrations are reviewed and applied separately. The backend folder is not a standalone web server.

## Running implementation

- Frontend: React 19 + Vite 6, hosted on Vercel.
- Backend: dedicated Supabase Auth + PostgreSQL; six RLS-enabled public tables.
- Database APIs: role-verified RPCs for booking creation, booking review and notice publication; secure triggers for profile creation and booking history.
- UI: overview, schematic floor explorer, calendar, booking list, announcements, minimal report and administrator overview.
- Room inventory: 30 seeded entries derived from organizer blueprint identifiers. Some capacities and lab classifications are unverified.
- Demo mode: explicit sample data; local-only reservations are not persisted.

## Core invariants

1. Two **confirmed** bookings cannot overlap for the same room over half-open time intervals.
2. No browser-side check substitutes for database conflict validation.
3. Role elevation never relies on user-editable metadata.
4. Student or unverified user cannot create a privileged booking or official notice.
5. Pending requests are not represented as confirmed.
6. Demo data and unverified room attributes are labeled.
7. Approved public timetables must eventually be versioned separately from editable drafts.

## Authorization target

University admin → coordinator with delegated building/department scope → verified faculty → student. The coarse roles exist; fine-grained delegated scopes and fully personalized cohort visibility are future work and must be implemented before institutional rollout.

## Major known gaps

No imported student/batch/section data, incomplete recurring official timetable model, schematic (not exact) architectural maps, incomplete approval UI and unverified real user end-to-end booking test. Full semester timetable optimization is intentionally deferred after the hackathon.

## Data migrations

- [Initial schema](../backend/supabase/migrations/001_iet_grid.sql)
- [Security hardening](../backend/supabase/migrations/002_security_hardening.sql)

## Related

[Design system](DESIGN.md) · [Decision log](DECISIONS.md) · [Test plan](TEST_PLAN.md) · [Implementation plan](IMPLEMENTATION_PLAN.md)
