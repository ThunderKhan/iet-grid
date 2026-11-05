# IET Grid — Verification & Release Test Plan

**Purpose:** Run tests on the actual deployed project and record proof. A code commit or READY deployment is not proof of feature correctness.

## Backend evidence recorded on 5 November 2026

| Test category | Evidence | Result |
| --- | --- | --- |
| SQL room overlap, cohort conflict, adjacent booking and pending-approval conflict | Supabase rollback transaction, with zero lasting test rows | **PASS** |
| Simulated authenticated database workflows | [Rollback SQL script](../backend/tests/integration/sql_authenticated_workflows.sql): faculty/student RLS, idempotency, cancellation, recurrence, notices, approvals | **PASS** (SQL simulation only; not a live HTTP session) |
| Live API deployment health | Vercel-served /health response HTTP 200 | **PASS** |
| OpenAPI generated contract | Live /api/openapi.json response HTTP 200 | **PASS** |
| Offline unit and mocked authorization tests | GitHub Actions Backend checks, including anonymous denial and faculty RPC forwarding | **PASS** |
| Pagination, calendar validation, migration manifest and mock API regression tests | [GitHub Actions run 42005322777](https://github.com/ThunderKhan/iet-grid/actions/runs/42005322777): 34 pytest cases | **PASS** |
| Full production JWT→faculty booking→student read→admin approval | No verified test profiles at baseline | **NOT TESTED** |
| Official student dataset/recurring timetable import | Required source files unavailable | **BLOCKED** |
| High-load concurrent booking benchmark | No production benchmark run | **NOT TESTED** |

Current live API: https://iet-grid-api.vercel.app. Source/test details: [BACKEND_IMPLEMENTATION.md](BACKEND_IMPLEMENTATION.md).

## 1. Core test matrix

| ID | Scenario | Expected result | Baseline status |
| --- | --- | --- | --- |
| T01 | Open public site in incognito | Login/demo screen loads without Vercel protection | Not yet independently browser-verified |
| T02 | Register with valid email/password | Supabase user and unverified student profile created | Not yet tested |
| T03 | Student tries to create a booking via RPC | Database denies permission | Not yet tested |
| T04 | Verify faculty in trusted admin process; sign in | Faculty may book an eligible classroom | Not yet tested |
| T05 | Faculty books a free room and refreshes | Booking remains persisted with correct room and time | Not yet tested |
| T06 | Faculty repeats overlapping confirmed booking | Backend rejects; no duplicate confirmed row | DB constraint exercised in rolled-back SQL transaction; user-level test pending |
| T07 | Two independent sessions concurrently reserve same slot | At most one confirmed booking succeeds | Not yet tested |
| T08 | Search capacity greater than room capacity | Room excluded; booking RPC rejects invalid request | Logic present; integration not yet tested |
| T09 | Book examination/event | Request becomes pending, not silently confirmed | RPC present; UI not yet tested |
| T10 | Coordinator approves pending request with free slot | Status becomes confirmed, audited | RPC present, no approval UI |
| T11 | Coordinator approves conflicting pending request | Database rejects approval | Constraint present; not yet tested |
| T12 | Unverified/student user tries to publish notice | Database denies action | Not yet tested |
| T13 | Verified admin publishes notice | Authenticated users see it after reload | Not yet tested |
| T14 | Student submits inaccurate-schedule report | Report created, cannot modify bookings | Not yet tested |
| T15 | Move between IET + Deeksha / floors | Correct identifiable room set appears | UI implemented; manual test pending |
| T16 | Select calendar event | Opens associated room context | UI implemented; manual test pending |
| T17 | Disable network / missing env | Clear error or visibly labeled demo rather than fake success | Demo mode present; test pending |
| T18 | Browser width 375 px | No critical controls inaccessible | CSS responsive; manual test pending |
| T19 | Check RLS on all six tables | All six enabled | Previously verified via Supabase table listing |
| T20 | Check Supabase security advisor | No unexpected anonymous EXECUTE on internal triggers | Internal trigger warnings fixed; three authorized RPC advisory warnings remain |

## 2. Evidence collection

For each test record: tester, date/time IST, commit SHA, deployment URL, user role, steps, expected result, actual result, pass/fail, screenshot/log evidence and follow-up issue. Avoid including JWTs, passwords or privileged credentials in evidence.

## 3. Release blockers

- Public deployment inaccessible or blank.
- Authentication or user verification grants improper privileges.
- Two overlapping confirmed reservations can be saved.
- Incorrectly displaying local demo data as persistent university data.
- Broken required IET/Deeksha room discovery.
- Missing required written solution/GitHub URL.
- Unresolved student-dataset and blueprint requirements must be disclosed clearly and prioritized; they cannot be falsely described as complete.

## 4. Fast smoke sequence

1. Confirm production build and open it from an incognito session.
2. Check both buildings and all five floor views.
3. Sign in as verified faculty (trusted provisioning only).
4. Book a future room and refresh.
5. Attempt overlap and observe authoritative conflict.
6. Open student session and confirm no privileged edit functions.
7. Publish and read an administrator notice.
8. Check README, docs and submission URLs.

## 5. Verification discipline

Never change a test status to PASS solely because source code appears correct. Record real execution. A failure should be triaged as code, data, authorization, environment or deployment.
