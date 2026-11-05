# IET Grid — Trusted Administrator Bootstrap and Live Acceptance

**Status:** The dedicated Supabase project has zero real users at the recorded baseline. Never create permanent fictitious university identities just to make a screenshot appear functional.

## Step 1 — Register and verify the intended first administrator

1. Open https://iet-grid.vercel.app and create your own university-authorized account with email/password. Do **not** send the password to anyone or put it in a chat, ticket, or repository.
2. Complete Supabase email confirmation if enabled.
3. In the **IET Grid** project only, open Supabase Dashboard → Authentication → Users.
4. Verify the registered identity and email independently with the university owner/administrator. Record the exact UUID; do not assume that a claimed roll number establishes identity.
5. Check the corresponding row in the profiles table. The default role should be student and verified should be false.

## Step 2 — Grant the first administrator in trusted SQL Editor

Run only after verifying the exact intended UUID. Replace the placeholder with the confirmed UUID **inside the SQL Editor**, not in tracked source files.

~~~sql
BEGIN;
SELECT id, full_name, role, verified
FROM public.profiles
WHERE id = 'PUT-VERIFIED-ADMIN-UUID-HERE'::uuid
FOR UPDATE;

-- Review the row above and stop if it is not the intended user.
UPDATE public.profiles
SET role = 'admin', verified = true
WHERE id = 'PUT-VERIFIED-ADMIN-UUID-HERE'::uuid
RETURNING id, full_name, role, verified;
COMMIT;
~~~

This one-time bootstrap must be done by a trusted operator with privileged SQL access. Never expose a public self-upgrade route or elevate a new user based on user_metadata.

## Step 3 — Provision staff and students using the guarded backend

- The verified administrator signs in and obtains their own Supabase Auth access token.
- POST /api/v1/admin/users/{user_id}/role to grant a verified faculty/coordinator role.
- POST /api/v1/admin/coordinator-scopes for an authorized coordinator's assigned building.
- POST /api/v1/admin/enrollments to attach an existing verified student to a known cohort.
- Do not import student identities unless the university has provided an authorized, verified mapping.

The API is https://iet-grid-api.vercel.app and interactive documentation is at https://iet-grid-api.vercel.app/api/docs. Authenticate with a normal user's access token, not a service-role key.

## Step 4 — Real-user acceptance checklist

- Sign in with separate confirmed admin, faculty and student accounts.
- Student POST booking → 403; unverified faculty POST booking → 403.
- Verified faculty books an eligible future room → 201, confirmed; refresh → same booking persists.
- Second conflicting booking → 409 (including concurrent attempts).
- Repeat a booking using the **same idempotency key** → same booking ID (no duplicate).
- Exam/event request → pending; admin approves → confirmed and allocation appears.
- Conflicting pending approval → 409 and pending record remains unchanged.
- Faculty cancels their booking → status cancelled and slot becomes free.
- Admin publishes in-app notice; student can read the intended cohort notice, but not another cohort's notice.
- A student cannot modify campus records, assign roles or see private faculty-only bookings.
- Confirm the calendar and spatial availability agree after every mutation.

Record redacted HTTP status, time, environment, role, request IDs, commit SHA and screenshot/log evidence. Do not expose tokens or passwords in test results.

## Step 5 — Safe rollback-only database tests

The repository includes:
- tests/integration/sql_constraints.sql — constraint tests with rollback.
- tests/integration/sql_authenticated_workflows.sql — transient Auth users under a transaction, with simulated JWT claims, reverted by ROLLBACK.

The second test directly exercises database functions and RLS but **does not** prove that a real login/session works over HTTP. Run it only in the isolated IET Grid Supabase project, and confirm no test UUID/email collides with an existing user before execution.

## Security and operational boundaries

- No service-role key in Vite, Postman collections shared publicly, GitHub Actions log output, or docs.
- Frontend API origin is https://iet-grid-api.vercel.app.
- Both frontend and backend are deployed on Vercel, but SQL migrations require a separate reviewed deployment to Supabase.
- Do not describe unfinished student-dataset import, verified blueprint tracing, real-user acceptance or 100-user concurrency benchmarks as complete.
