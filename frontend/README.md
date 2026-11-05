# IET Grid Frontend — React + Vite

Deployed independently at https://iet-grid.vercel.app from frontend/.

## Development

~~~bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
~~~

Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for Supabase Auth, and VITE_API_BASE_URL for the separate FastAPI service (http://localhost:8000 locally or https://iet-grid-api.vercel.app in production).

Live room availability, recommendation ranking, booking creation, admin notices and schedule reports use the REST API with the user's bearer token. The calendar gets room occupancy from the same backend. PostgreSQL continues to enforce final booking consistency.

Guests can view an explicitly labeled local demonstration with nonpersistent sample reservations. The map is schematic; exact blueprint geometry, official student data and full scheduling imports are pending. See ../backend/README.md and ../docs/README.md.

## Email confirmation redirects

The signup flow explicitly passes `options.emailRedirectTo` to Supabase, defaulting to `https://iet-grid.vercel.app/`. Override via `VITE_SITE_URL` if the public domain changes; this variable is embedded at **build time**.

In the dedicated Supabase project, set **Authentication → URL Configuration → Site URL** to `https://iet-grid.vercel.app` and include `https://iet-grid.vercel.app/**` in **Redirect URLs**. For local testing, add `http://localhost:5173/**` as a *development-only additional redirect*, not as the production Site URL. These dashboard Auth settings are separate from Vercel environment variables and cannot be changed by updating this code alone.

After configuring, register a new disposable test account (using an authorized address) and verify that the generated email confirmation redirects directly to production without manual URL edits. Check template settings if a custom email template hardcodes localhost.
