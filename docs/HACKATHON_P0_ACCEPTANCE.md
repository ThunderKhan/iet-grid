# IET Grid — Hackathon P0 Live Acceptance

**Scope:** Faculty/student role isolation and examination approval + notices. Academic datasets are unavailable and deliberately not imported.

**App:** https://iet-grid.vercel.app/ — **API:** https://iet-grid-api.vercel.app/api/docs

## Implemented

- Admin → Booking approvals: a real pending exam/event queue with Approve and Reject controls.
- PostgreSQL migration 009: approved exams/events publish an in-app confirmation notice in **the same SQL transaction** as the confirmed booking. Failed approval rolls back both.
- Admin → Publish an announcement: high/normal priority and live persistence.
- Announcements: official notice feed and server-backed Mark as read.
- Admin → Faculty & student test accounts: assign a role to an already registered, confirmed user UUID.
- PostgreSQL migration 010 refuses unconfirmed emails and prevents demotion of existing administrators via test-user provisioning.
- Mocked distinct-role HTTP tests and rollback-only SQL tests passed. No fake permanent university accounts were created.

## Complete the real-account test

Only one real administrator is registered. Two additional distinct, email-confirmed accounts controlled by the team are required to test real independent browser sessions; **do not impersonate actual university users**.

1. Open https://iet-grid.vercel.app in an incognito window. Sign up using a separate email address you control and confirm it.
2. In Supabase → Authentication → Users, copy the exact UUID and confirm the email is verified.
3. In the existing admin session, open **Admin → Faculty & student test accounts**, paste the UUID, select **Faculty**, and grant the role.
4. Log in as faculty in the incognito window. Under **Explore rooms**, select a free future room. Create an **Examination** titled **TEST — Minor Exam**. Its status should be **pending**, with no confirmed room allocation.
5. In the administrator session, go to **Admin → Booking approvals**. Refresh, find the test request, and choose **Approve**.
6. The request should become confirmed; the same transaction automatically publishes an **Exam room confirmed** high-priority notice. Find it under **Announcements**.
7. Register a second distinct confirmed test account, copy its UUID, and provision it as **Student** in the admin session.
8. Sign in as Student. Booking actions should not be available, and direct booking/review/notice-publication APIs must respond **403**.
9. Under **Announcements**, confirm the campus-wide exam notice appears. Click **Mark as read** and reload; it should remain marked Read.
10. In Admin, independently publish a **TEST — Campus Update** notice with **High** priority and verify that the student can read it after refresh.
11. Submit another test exam from faculty and **Reject** it as administrator. There must be no confirmed reservation or confirmation notice for the rejected request.

**Important:** Without official cohort data, approved exam notices are campus-wide. Use TEST titles so nobody mistakes demonstration messages for actual university exam instructions.

## Evidence and security

- Capture faculty pending booking, admin approval action, resulting confirmed booking, high-priority notice, student read receipt and student 403 API denial.
- Record commit SHA, deployment URL and tester role. Never share passwords, access tokens or full student identifiers.
- Existing backend tests: **44 passing pytest cases** in GitHub Actions and SQL rollback scenarios for authorization, notices and approval.
- SQL tests use temporary identities under BEGIN/ROLLBACK; this is not equivalent to real HTTP logins.
- Actual student/branch/batch/timetable records remain absent; do not claim personalized schedules.
- Real test bookings/notices created through the site persist in Supabase. Cancel/clean them after the presentation using an authorized workflow.

## Source

- Backend tests: backend/tests/test_roles_approval_and_notices.py
- Database test: backend/tests/integration/sql_p0_roles_approvals.sql
- Migrations: backend/supabase/migrations/009_exam_approval_notices.sql and 010_confirmed_identity_provisioning.sql
