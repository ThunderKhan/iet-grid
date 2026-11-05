# IET Grid — Frontend Design Audit

**Review started:** 5 November 2026 (Asia/Kolkata)  
**Mode:** Operate (a university scheduling and booking tool)  
**Design authority:** [Root DESIGN.md](../DESIGN.md)  
**Reference methodology:** [Impeccable](https://github.com/pbakaus/impeccable), manual application of the `critique`, `audit`, `distill`, `layout`, `typeset`, `adapt`, `harden`, `clarify`, and `optimize` guidance.

> **Scope and evidence:** This is a cross-page **source and interaction audit**, informed by supplied interface screenshots, the React component tree, CSS, backend availability contract, and GitHub Actions. We did not install or run Impeccable's launcher/detector, capture current authenticated browser renders, run Lighthouse, or test on physical devices. Do **not** interpret passing unit/SSR/build checks as a visual or WCAG certification.

## Design direction

IET Grid is a tool, not a promotional dashboard. The main action is to **find a real room, understand its eligibility and availability, inspect the floor plan, then book safely**. The floor plan remains the primary screen. Branding comes from measured proportions, typography, navy/cobalt focus and precise drawing geometry—not extra gradients, badges, dashboards or hero metrics.

The preserved visual contract is navy `#101B2C`, cobalt `#315CE5`, canvas `#F6F8FB`, white rooms, pale gray corridors, and small operational status indicators. Room geometry remains a **simplification of the supplied university blueprint**, not a certified architectural plan.

## Findings and changes

| Severity | Impeccable focus | Finding before pass | Change / verification target |
| --- | --- | --- | --- |
| **P0 — fixed** | Audit + harden | Any unsuccessful availability result that was not explicitly `ineligible` could be presented as `Occupied`, incorrectly suggesting a confirmed clash. | `resolveRoomStatus` now interprets backend `reason` values: `occupied`, `ineligible`, `available`; unknown/missing responses fail closed as **Not verified**. Regression tests cover missing data and constraints. |
| **P1 — fixed** | Critique + clarify | Laboratories could be marked ineligible for `lecture`, but the session-type control existed only inside a disabled booking dialog—a workflow dead end. | Session type is now editable alongside date, time, duration and seats **before** booking. Practical/laboratory now rechecks eligibility through the existing API. |
| **P1 — fixed** | Distill + layout | The floor plan had three decorative headers/captions, repeated temporal legend suffixes and large padding inside an SVG drawing frame. | Cropped SVG viewBox to the actual geometry (room coordinates unchanged), removed repeated drawing labels and grid decoration, and reduced the legend to one status list with one honest provenance note. |
| **P1 — fixed** | Distill + typeset | Calendar, bookings, announcements and Admin had a second global heading above their page-owned title. | Removed the duplicate `page-intro` layer; made each functional page's own title the primary `h1`, followed by supporting copy/action. |
| **P1 — fixed** | Harden + onboard | A failed calendar request looked like an empty timetable; map inventory load was visually ambiguous and missing/error states had poor recovery. | Added distinct loading and failure displays and a retry action. The map also indicates unavailable inventory without inventing classrooms. Retry paths are scoped to the failed source. |
| **P1 — fixed** | Adapt | A room selected through search on a phone might be outside the horizontally scrollable map viewport. | The map automatically scrolls to center the selected room when horizontally scrollable, respecting reduced motion. Existing floor arrows and Map/List controls remain. |
| **P2 — fixed** | Adapt + typeset | Mobile form inputs under 16px could trigger disruptive iOS focus zoom. | Mobile input text is 16px in profile, room search, calendar/admin, reservation dialog and schedule editor. |
| **P2 — fixed** | Polish + extract | `WorkspacePages.css` still carried removed dashboard, hero, inspector and old room-map rules. | Pruned roughly **13.3 KB** of obsolete CSS; preserved live pages and complex pseudo-class selectors. The earlier Polish pass also removed ~21 KB of global legacy CSS. |
| **P2 — fixed** | Audit + optimize | Many unused icon imports were inherited from the old overview. | Removed dead Lucide imports from the app and main workspace components. Tree shaking already reduced bundle impact; the source is cleaner. |
| **P2 — fixed** | Layout + polish | Small action buttons, low-contrast caption styles, and inconsistent component sizing. | Prior pass aligned typography and design tokens; this pass increases smaller calendar/admin actions and tightens map inspector / calendar heading rhythm. |
| **P2 — fixed** | Craft-floor | Repeated “eyebrow” labels copied page titles or said “INTERACTIVE FLOOR PLAN” where the floor plan itself was self-evident. | Removed these decorations instead of filling the space with another card. |

## Cross-screen assessment

### Campus map
- **Primary focal point:** the authentic room topology, not a marketing banner.
- **Controls:** building switch in map header; floor arrows on either side; Map/List toggle and room search remain.
- **Booking pathway:** selected room and status are reported separately from any *currently running* class, because the requested interval may be in the future.
- **Error provenance:** unknown API data must never be shown as available or occupied; capacity claims remain provisional where the university has not verified them.
- **Mobile:** landscape-sized drawing remains horizontally scrollable; selecting/searching a room now moves the viewport to that room.

### Calendar
- **Hierarchy:** one page-level heading plus date navigation and Day/Week/Agenda switching.
- **Truthful states:** pending fetch, failed fetch, and genuine no-events state are now distinguishable.
- **Visual system:** lighter, quieter event boundaries; 14px event titles; today retains a single cobalt indication.
- **Risk to test:** actual swipe/scroll behavior for five-day view at 320–430px.

### My bookings and announcements
- Actual list/filter counts remain; avoid invented KPIs.
- Empty states preserve navigation to the next useful action.
- Shared header and button styling are consolidated. Large titles have appropriate hierarchy.

### Admin
- Reduced duplicate headers, normalized small controls and kept original role gating.
- Server-side authorization and audit provenance remain authoritative.
- Long titles, pagination and table overflow need real-browser review.

### Profile and authentication
- Profile uses real Supabase fields and private avatar permissions; no fake saved changes.
- Mobile form inputs avoid focus zoom.
- Existing split authentication layout, gradient and working Google option remain intact.
- Browser sign-in, password reset and mobile keyboard overlay must still be validated end-to-end.

## Technical quality checks

- Existing GitHub Actions checks: frontend ESLint, Vite production build, server-render smoke tests covering Campus map, Calendar, My bookings, Announcements, Admin and Profile.
- Added explicit assertions for API reason mapping (including unknown/ineligible/occupied), lab session editing, no duplicate map drawing headings, provenance, calendar loading/error UI, and absence of the redundant global header.
- Temporary red CI runs during development were corrected. The final code revision should be judged by its **own** passing CI run.
- No Vercel deployment was initiated, per local-first development preference.

## Visual browser acceptance that remains open

This list is **not yet verified**, because the authenticated localhost and a live device browser are not connected to this audit:

1. At 1440×900 and 1920×1080: confirm no clipping, map clearly dominates first viewport, focused room remains easy to recognize, and support controls do not compete with the floor plan.
2. At 768×1024 and 1024×768: check map/list switching, date popover anchoring, calendar navigation and inspector placement.
3. At 320×700, 360×780, 390×844 and 430×932: horizontal plan scrolling, selected-room auto-centering, fixed menu height, room-details bottom sheet, safe areas and on-screen keyboard interactions.
4. With keyboard and screen reader: logical focus order through map SVG, quick-find, schedule popup, reservation dialog and account menu.
5. At 200% browser zoom and with long/RTL/emoji names: text reflow and no accidental horizontal overflow outside the map.
6. With Supabase API disconnected, calendar API blocked, missing permissions, empty room inventory, unknown capacity and concurrent booking conflict: truthful error/retry paths without fake success.
7. Check actual computed contrast ratios and Core Web Vitals in a browser; code inspection alone does not verify 4.5:1 contrast or rendering performance.

## Product constraints that must not regress

- **No** Overview landing page, sidebar, extra marketing hero, PINCHABLE canvas, synthetic reservations, browser-only successful saves, or fake university room capacities.
- **Do not** deploy to Vercel from this audit.
- Use `http://localhost:5123/` with an authenticated user and local FastAPI backend for final acceptance.
- All future visual additions should first remove an equivalent piece of clutter, not add another card layer.

## Manual inspection workflow

```powershell
cd D:\Projects\iet-grid
git pull origin main
cd frontend
npm install
npm run dev
```

Open `http://localhost:5123/`; capture full desktop, small laptop, and mobile viewport screenshots of the Campus map (first and second floors), Calendar, My bookings, reservation dialog, and profile before deciding whether another redesign is necessary.

**Next design decision:** after browser screenshots, choose one precise visual mismatch at a time—spacing, contrast, density, or responsiveness. Do not replace the approved floor-plan motif again based only on a generic dashboard reference.
