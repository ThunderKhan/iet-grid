# IET Grid frontend — real campus platform

The main application is React 19 + Vite 6, with Supabase Auth/Postgres and a separate FastAPI backend. It follows the repository-root `DESIGN.md`.

## Local development (Windows PowerShell)

The Vite server runs on the **exact port 5123**. No preview URL, guest mode, or simulated campus records are available in the application.

```powershell
git pull origin main
cd frontend
npm install
npm run dev
```

Open **http://localhost:5123/**. Sign in with an actual Supabase account. After successful authentication the main landing page is the Campus map (no Overview page).

`frontend/.env.development` contains the dedicated project's *public* Supabase URL and publishable key, the local API address (`http://localhost:8000`), and the local Auth redirect. Never commit any service-role / secret keys. A previously created `frontend/.env.local` has priority over `.env.development`: ensure it uses the same project, port 5123, and backend address, or rename/remove the stale override before restarting Vite.

## Run the local API

From a **second** PowerShell window at the repository root:

```powershell
cd backend
python -m pip install -r requirements.txt
$env:SUPABASE_URL = "https://cdzvtfahwbvlfnfmbilt.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nUrt2zIq7TP7tDcCNwd6vA_bZBejiF3"
$env:CORS_ORIGINS = "http://localhost:5123,http://127.0.0.1:5123"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Verify `http://localhost:8000/health` returns `status: ready`. The browser will use `http://localhost:8000/api/v1/*` for availability, timetables, reservations, approvals and notices. Supabase PostgreSQL and Auth remain online; only frontend and API run locally.

## Authentication redirects

The sign-in / sign-up screen comes from `src/components/AuthScreen.jsx`. In development, confirmation, Google OAuth and password reset callback URLs use the **actual local origin**, `http://localhost:5123/`. In Supabase Dashboard → Authentication → URL Configuration, add `http://localhost:5123/**` to **Redirect URLs**. Keep the production domain separately if it remains in use. Do not change a production Site URL solely to test localhost.

Google login needs the OAuth provider enabled in the IET Grid Supabase project; this code alone cannot configure its Google Cloud client or secret. Password/email confirmation must also be tested with a real authorized account.

## Features and data rules

- **Campus map:** Original two-building classroom arrangement, floor arrows, availability from the authenticated API, live running-class titles only when authorized.
- **Calendar, My bookings, Announcements:** Server-backed user-scoped records, never fabricated bookings or messages.
- **Reservation dialog:** Real registered academic cohorts from `GET /api/v1/cohorts`; only verified faculty/coordinators/admins can request permitted bookings.
- **Admin:** Verified role-based booking approval, notices, provisioning, and audit actions. Server and database permissions remain authoritative.
- **My profile:** Edit your full name, contact information, personal academic preferences, and private photo; institutional role, verification and official enrollment are read-only. Photos use the private `iet-profile-avatars` bucket.

A missing backend, missing Auth session, or failed data request **must not fall back to sample records**. Availability remains unverified when the API cannot confirm it. Official student-level datasets and full institutional timetables have not yet been imported; a blank schedule does not imply the university has no classes.

## Verification

```powershell
cd frontend
npm run build
node scripts/verify-pages.mjs
```

The `scripts/test-fixtures.js` file exists exclusively for automated UI tests. It is never imported into `src/` or displayed by the application.

No Vercel deployment is required or triggered by the local development commands.
