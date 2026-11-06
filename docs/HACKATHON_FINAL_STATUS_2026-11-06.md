# IET Grid — 6 November 2026 P0/P1 delivery and acceptance record

## Source and interpretation
Official DDUGU / GDG on Campus *Build With AI: DevOps 2026* challenge (three-page "Smart Campus Classroom Management System"). A source-code implementation is **not** equivalent to a live authenticated acceptance test.

## Eight core requirements
| Official item | Source implementation | Evidence / remaining work |
| --- | --- | --- |
| 1. Search rooms by building, floor, room, date, time, duration, capacity | Implemented | Interactive room explorer and live availability API; logged-in production browser test outstanding |
| 2. Faculty booking for lectures, practicals, exams, events | Implemented | Atomic PostgreSQL booking RPC and client; empty cohort dataset no longer blocks explicitly unassigned booking; human faculty-session test outstanding |
| 3. No overlap + alternative rooms | Implemented | GiST interval exclusions, canonical room/faculty/cohort allocations; deterministic API rankings; SQL rollback test passed |
| 4. Schedule cancellations, rescheduling and announcements | Implemented core workflows; limited | Owner cancellation, same-room lecture/practical rescheduling, automatic targeted change notices, exam/event approval notices; moving approved exams/events requires a new request |
| 5. Student schedule and conflict reports | Partial | Student read-only schedules, notices, and descriptive report UI; official student-specific timetable data not imported |
| 6. Role-based authorization | Implemented controls; final live test outstanding | Supabase Auth, verified role checks in FastAPI and scoped PostgreSQL RPCs; simulated-role tests pass |
| 7. Booking change history | Implemented | Existing audit triggers, scoped admin history view and new rescheduling event |
| 8. Intelligent suggestions validated against records | Implemented algorithm | Constraint-filtered ranked alternatives, hard booking validation in database. No trained AI/LLM or full-semester optimizer claimed |

## Mandatory source assets and data

- **IET + Deeksha blueprints:** Five exact source-plan PNG crops were already versioned at `frontend/public/floorplans/`. The new **Original plan** UI tab exposes those assets for each floor while keeping the live clickable schematic distinct. The schematic is not an architectural survey.
- **Building rooms:** 30 campus rooms are present in the dedicated Supabase project. Most capacities, access attributes and equipment still need institutional verification.
- **Branch/year/batch/section data:** `Admin → Academic cohort dataset` now offers a validated CSV dry run and guarded import. The database currently contains **zero official cohort records**. The user-provided PDFs contain approximate branch counts but no named student roster. **Do not fabricate identities.** When real records arrive, import with consent and confirm verified enrollment.
- **Existing live records protected:** On the 6 November SQL rollback validation, one preexisting booking remained and no test accounts or notices were retained.

## Verified changes and deployment

- **PR #3:** original-plan view, protected cohort CSV workflow, secure same-room reschedule endpoint, booking-change UI and SQL migration 014.
- **PR #4:** removed the impossible cohort requirement when no actual cohort is present; added free-text student reporting.
- Both PRs merged into `main` on 6 November 2026.
- Dedicated Supabase project: `cdzvtfahwbvlfnfmbilt` in Mumbai, **never the VSPH database**.
- Migration 014 applied; reschedule RPC and change-notification trigger present; unauthenticated role cannot execute rescheduling.
- Automated frontend build/smoke tests and backend tests passed. Rollback-only SQL test `backend/tests/integration/sql_reschedule_and_notices.sql` ran successfully, including intentional conflict rejection, audit row creation and automatic high-priority exam cancellation notice within the rolled-back transaction.
- Vercel production builds for frontend and backend show **READY** on commit `a5d23142e39e2d07da738c93a722f5631260f683`. This is not a substitute for a real-user browser test.

## Required pre-submission human checks (not claimed complete)
1. Log in as the verified campus administrator at https://iet-grid.vercel.app, confirm both **Map** and **Original plan** for IET and Deeksha.
2. Choose a known future free classroom, verify live availability, and book a `TEST —` titled lecture. With no imported cohorts, keep the booking unassigned and do **not** claim it populates a student-specific schedule.
3. Refresh **My bookings**, verify persistence and use **Reschedule** on a lecture/practical to move its time within the same room. Attempt an overlapping slot to verify rejection.
4. Use the **Cancel reservation** action; confirm the booking releases its allocation.
5. Separately register two distinct email-verified faculty/student accounts controlled by the team, grant trusted roles and verify student booking denial, notices and descriptive issue submission. **Do not impersonate university students.**
6. Publish a clearly labeled `TEST —` exam request, approve as administrator, check notice, and cancel to check the change notice. Remove test records via authorized workflows when finished.
7. Check the public frontend and API domain in a fresh browser and copy exact working links into the Word submission.

## Deferred or blocked
- Actual organizer student/branch/batch **individual dataset**: not attached / not imported.
- Independent three-role live authenticated browser acceptance: needs legitimate test accounts.
- Precise CAD/SVG physical-plan mapping, institution-certified capacities and equipment.
- Complete automatic semester timetable optimization and complex exam/event reapproval-on-edit.
- Real student-personalized timetable and production-scale concurrency benchmarking.

**Submission instruction:** Include working prototype and GitHub links, real engineering details, screenshots, and explicitly separate verified implementation from roadmap. Never say the missing student roster was imported.
