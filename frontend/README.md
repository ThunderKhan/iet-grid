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

## Authentication redesign

The split-panel sign-in/sign-up experience lives in `src/components/AuthScreen.jsx` and is styled in `AuthScreen.css` using the root `DESIGN.md` tokens. It adapts the user-provided 21st.dev composition, including Paper Design's GrainGradient shader. The shader package is pinned to `0.0.82` (Apache-2.0); motion is reduced for users who request it.

- Email/password sign-in and first/last name signup use Supabase Auth. Names are **profile metadata only**, never authorization claims; verified faculty and admin roles require trusted provisioning.
- Forgot password sends a recovery email to `VITE_SITE_URL/?auth=reset`; the reset screen uses `supabase.auth.updateUser` after the valid recovery session is established.
- **Continue with Google** is always visible on sign-in and sign-up. Clicking checks the public Auth-provider settings (when available); if Google is disabled it shows an actionable error instead of navigating to a broken OAuth flow. When the provider is enabled it calls `supabase.auth.signInWithOAuth({provider:'google'})` with a return URL. This UI does **not** configure Google OAuth.
- To activate Google: create a Web Application OAuth client in **Google Cloud → Google Auth Platform**, add `https://iet-grid.vercel.app` as an authorized JavaScript origin and `https://cdzvtfahwbvlfnfmbilt.supabase.co/auth/v1/callback` as an authorized redirect URI. Add the Google Client ID and Client Secret to **IET Grid Supabase → Authentication → Providers → Google** and enable Google. **Never** put the client secret in Vite environment variables, GitHub, or frontend code.
- Apple is optional and remains hidden until configured using `VITE_AUTH_APPLE_ENABLED=true` with its provider credentials in Supabase.
- Add production `https://iet-grid.vercel.app/**` and any intended development or preview URLs to **Supabase Authentication → URL Configuration → Redirect URLs**. Recovery and signup redirects require these allowed URLs. Apple web OAuth also requires Apple Developer service configuration.
- Sign-in does not expose elevated institutional privileges; the server/database authorize role-dependent capabilities.
- The auth gateway intentionally has **no guest-demo button**; the former decorative campus floor-map and demo CTA were removed.

**Validation still required:** a real, confirmed email signup, password reset and optional OAuth journey in the deployment. Do not claim these flows pass production acceptance solely because the components build.

## Authenticated workspace redesign (DESIGN.md)

The five authenticated views use independent React page components in `src/components/WorkspacePages.jsx`, with shared styles in `WorkspacePages.css`. The global navigation, responsive shell and booking dialogs use `src/workspace-shell.css`. Design values and status rules follow the repository-root `DESIGN.md`.

- **Campus map (landing view):** `BlueprintBoard.jsx` uses five original black-and-white floor drawing assets extracted losslessly from the event's supplied PDF, with accessible transparent hotspots aligned to source room positions. A plan/list switch and building/floor/date/time filters connect to the existing booking API and suggestions. The former `FloorPlan.jsx` zoom-card implementation and Overview dashboard were removed.
- **Room inspector:** restrained side panel on desktop; on mobile, the existing `@radix-ui/react-dialog@1.3.1` (MIT) primitive provides an accessible bottom sheet. Reuses the established shadcn-style component conventions without introducing another UI framework.
- **Calendar:** day/week/agenda view with IST timestamps and event navigation back to the selected room.
- **Bookings:** filterable reservation records with separate confirmed, pending and past statuses.
- **Announcements:** importance/unread filters, server-backed read receipts and reporting action.
- **Admin:** existing server-backed review, announcement and authorized user-provisioning workflows in a cohesive workspace.

**Data integrity:** The five **drawing images** come from the original event-supplied blueprint on page 1 of the problem statement, included in `public/floorplans`. Their walls/corridors/stairs are source-backed; the clickable room hotspot rectangles are manually aligned interaction bounds and must be reviewed for accuracy. Capacity data and per-room scheduling eligibility are separate and must be verified through institutional records. No visual status implies an API verification was successful. Live availability is never inferred from an empty API response.

**Validation:** from `frontend/`, run `npm install`, `npm run build` and `node scripts/verify-pages.mjs`. The GitHub Actions workflow `.github/workflows/frontend-build.yml` repeats build and server-render smoke tests on UI changes. Successful builds do **not** replace browser-based mobile testing or real-user integration tests.

### Local visual preview (development only)

When Vercel deployments are temporarily unavailable, use the Vite dev server to inspect the redesigned pages with sample records:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173/?preview=1**. This route is intentionally guarded by `import.meta.env.DEV` and is compiled out of production builds. It does not grant any real institutional role, does not persist records, and displays the global **DEMO DATA** badge. Do not use this for production acceptance or real API tests. The ordinary URL without `preview=1` still uses Supabase authentication.

