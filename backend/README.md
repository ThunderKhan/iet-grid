# IET Grid Backend

The application's backend is **Supabase Auth + PostgreSQL**, not a standalone Node or Python HTTP server. This folder owns database schema migrations, authorization, server-side booking RPCs, and database constraints. The frontend must not be trusted to decide privileges or finalize room availability.

## Layout

- `supabase/migrations/001_iet_grid.sql` — initial six-table schema, room seed, Row Level Security, booking and announcement functions.
- `supabase/migrations/002_security_hardening.sql` — public extension and trigger-function permission hardening.

## Setup

1. Create or select the **dedicated IET Grid** Supabase project; never apply these SQL files to unrelated projects.
2. On a **fresh database only**, run migrations in filename order using the Supabase SQL Editor. The original migration files are **not designed for repeated application**.
3. Use the project's **URL and publishable key** in the frontend environment (see `../frontend/.env.example`).
4. Verify the room inventory, Row Level Security, privileges and booking conflict checks.
5. Create real test users via Auth and provision faculty/admin permissions only via trusted administrative operations. Never use browser-editable metadata for roles.

## What runs on the backend

- `profiles`, `rooms`, `bookings`, `announcements`, `schedule_reports`, `booking_history`
- Supabase authentication and Postgres Row Level Security
- `create_room_booking`, `review_room_booking` and `publish_campus_notice` RPCs
- PostgreSQL exclusion constraint for overlapping **confirmed** bookings
- Booking history trigger

## Important limits

- Current UI derives recommendation rankings in the frontend. The **backend revalidates** each booking before storing it.
- No separate FastAPI/Express deployment exists at present; do not claim one.
- Regular university timetable imports, official student/branch/batch records, exact floor-plan geometry and coordinator scopes are not yet complete.
- Exam and event requests can be stored pending; a complete approval screen remains pending.

See `../docs/ARCHITECTURE.md`, `../docs/SYSTEM.md` and `../docs/IMPLEMENTATION_PLAN.md`.
