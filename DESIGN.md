---
version: alpha
name: IET Grid — Campus Operations Console
description: Product-specific design system for the IET Grid university classroom scheduling application.
colors:
  primary: "#315CE5"
  primary-hover: "#254ECC"
  primary-subtle: "#ECF1FF"
  on-primary: "#FFFFFF"
  sidebar: "#101B2C"
  sidebar-hover: "#1B2A42"
  sidebar-active: "#263E66"
  sidebar-text: "#D3DCEA"
  canvas: "#F6F8FB"
  surface: "#FFFFFF"
  surface-muted: "#F1F4F9"
  surface-raised: "#FFFFFF"
  text-primary: "#17243B"
  text-secondary: "#52637B"
  text-muted: "#62748A"
  border: "#DCE4EF"
  border-strong: "#B9C7DA"
  focus: "#315CE5"
  available: "#187A55"
  available-surface: "#E8F6EF"
  occupied: "#B42332"
  occupied-surface: "#FDECEF"
  pending: "#8D5B12"
  pending-surface: "#FFF3D8"
  restricted: "#6941C6"
  restricted-surface: "#F3EFFF"
  unknown: "#58677D"
  unknown-surface: "#EEF2F6"
  selected: "#244DC5"
  selected-surface: "#E4ECFF"
  blueprint-line: "#B7C9DD"
  overlay: "#101B2CB3"
typography:
  page-title:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.025em
  section-title:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: -0.015em
  card-title:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 650
    lineHeight: 1.4
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  body-large:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.45
  metric:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.03em
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.25
spacing:
  "0": "0px"
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
rounded:
  xs: "4px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  pill: "999px"
components:
  app-shell:
    navigationBackground: "{colors.sidebar}"
    navigationActive: "{colors.primary}"
    pageBackground: "{colors.canvas}"
    navigationHeight: "74px"
    mobileNavigationHeight: "64px"
  primary-button:
    background: "{colors.primary}"
    foreground: "{colors.on-primary}"
    hoverBackground: "{colors.primary-hover}"
    radius: "{rounded.md}"
    minHeight: "40px"
  card:
    background: "{colors.surface}"
    borderColor: "{colors.border}"
    radius: "{rounded.lg}"
  input:
    background: "{colors.surface}"
    borderColor: "{colors.border-strong}"
    textColor: "{colors.text-primary}"
    radius: "{rounded.sm}"
    minHeight: "40px"
  status-available:
    color: "{colors.available}"
    background: "{colors.available-surface}"
  status-occupied:
    color: "{colors.occupied}"
    background: "{colors.occupied-surface}"
  status-pending:
    color: "{colors.pending}"
    background: "{colors.pending-surface}"
  status-unknown:
    color: "{colors.unknown}"
    background: "{colors.unknown-surface}"
---

# IET Grid — DESIGN.md

> **Status:** Proposed canonical FRONTEND design contract, prepared 5 November 2026.
> **Product:** IET Grid — Intelligent Campus Scheduling & Classroom Management, Institute of Engineering & Technology, DDU Gorakhpur University.
> **Repo:** https://github.com/ThunderKhan/iet-grid
> **Target path:** `DESIGN.md` at repository root; maintained as the frontend design contract.
> **Priority:** Preserve `docs/DECISIONS.md` product decisions, authoritative data/permissions, and working frontend behavior. Resolve conflicts explicitly. Existing `docs/DESIGN.md` is the original design baseline; synchronize it when this proposal is adopted.

## Overview

### North star

**A university operations console that makes the right room, at the right time, easy to find and safe to reserve.**

The product should feel **precise, calm, trustworthy, contemporary, and efficient**. Think Linear's navigational discipline, shadcn-style enterprise dashboard hierarchy, and Notion Calendar's temporal clarity. Do not imitate any of those brands literally or combine three unrelated theme skins.

The UI is a real scheduling tool for faculty, students, coordinators, and administrators—not a promotional landing page or an AI chatbot. The distinctive feature is **the synchronized spatial room explorer and temporal calendar, backed by real collision prevention**.

### Product principles, in priority order

1. **Truth before visual polish.** Never present stale, pending, unverified, or failed data as a live confirmed reservation.
2. **Task before decoration.** A faculty member should find a suitable room and understand its availability without interpreting a dashboard full of vanity metrics.
3. **One mental model.** The same building, room, date, interval, status, and booking ID must mean the same thing in the map, calendar, room details, and reservation list.
4. **Explain state and consequences.** Make unavailable reasons, pending approval, identity restrictions, and recovery options visible.
5. **Institutional credibility.** Compact, restrained enterprise design. No gratuitous gradients, glowing glass, oversized 3D objects, or cartoon illustrations in core workflows.
6. **Fast to scan, accessible to use.** Clear hierarchy, keyboard operation, text labels with colors, usable touch targets, and predictable focus.
7. **Extendable but pragmatic.** The present app is React 19 + Vite 6 + JavaScript + CSS with Lucide icons. Do not assume Next.js, Tailwind, TypeScript, or shadcn have been installed. A future UI-library migration needs its own plan.

### Users and jobs to be done

| Persona | Top job | Primary interface | Privileges |
|---|---|---|---|
| Student | Find my class/room, read notices, report inaccurate information | Calendar, notices, room details | Read permitted campus data; minimal reporting |
| Verified faculty | Discover and book an eligible room for a class | Explore rooms, booking dialog, my bookings | Eligible reservation actions |
| Coordinator | Monitor assigned rooms and handle delegated approvals | Admin queue, building calendar | Only explicitly authorized scope |
| Administrator | Oversee campus resources, access review, notices and approvals | Admin dashboard, queues | Only actions verified by backend policy |

**Role-based visuals are usability affordances, never authorization.** The backend and database remain authoritative.

### Source of truth and provenance

- Room, building, floor, availability, approval status, and reservation data must originate from the authoritative API in authenticated mode.
- The live application requires Supabase authentication and never displays local sample records or simulates a successful save. If the API is unavailable, show an error/unknown state and leave booking actions disabled.
- If a live availability request fails or is incomplete, show **Availability unavailable / Not verified**; **never** quietly treat that as "Available".
- A pending reservation is **not a confirmed booking**. Whether pending requests block a particular time slot is a backend business rule, not a color assumption.
- Capacity values derived from provisional blueprints must be annotated *"Capacity unverified"*; do not invent classroom capacities.
- The presently coded building visualization is schematic. Show **SCHEMATIC · NOT TO SCALE** until validated SVG geometry is actually present.

### Visual/interaction inspirations (interpret, do not copy)

- **Linear:** restrained navigation, small efficient surfaces, clear selected state; https://linear.app
- **shadcn/ui dashboard and sidebar blocks:** hierarchy, spacing, primitive consistency; https://ui.shadcn.com/blocks
- **Notion Calendar:** readable time grid and event scanning; https://www.notion.so/product/calendar
- **IBM Carbon:** status, notification and data-heavy interaction patterns; https://carbondesignsystem.com
- **W3C WCAG 2.2 / ARIA APG:** accessibility acceptance bar; https://www.w3.org/TR/WCAG22/ and https://www.w3.org/WAI/ARIA/apg/
- **FullCalendar documentation:** conceptual reference for selectable time slots, overlap and time-zone handling; https://fullcalendar.io/docs (do not presume this library is installed)

## Colors

**Brand foundation:** keep existing IET Grid navy `#101B2C`, cobalt `#315CE5`, off-white page `#F6F8FB`, and white card surfaces. Blue means **interaction/selection**, not availability. Green, red, amber, purple, and neutral gray represent operational status.

### Roles

| Purpose | Token | Hex | Usage |
|---|---|---|---|
| Primary action | `primary` | `#315CE5` | Reserve room, primary CTA, focused selections |
| Global sidebar | `sidebar` | `#101B2C` | Desktop navigation, identity |
| Page canvas | `canvas` | `#F6F8FB` | Background |
| Card surface | `surface` | `#FFFFFF` | Cards, inspector, form panels |
| Primary text | `text-primary` | `#17243B` | Headings, important values |
| Supporting text | `text-secondary` | `#52637B` | Body metadata |
| Available | `available` | `#187A55` | Verified open time slot only |
| Occupied | `occupied` | `#B42332` | Confirmed time conflict/unavailable |
| Pending | `pending` | `#8D5B12` | Awaiting approval |
| Restricted | `restricted` | `#6941C6` | Permission/equipment restriction |
| Unknown | `unknown` | `#58677D` | Failed, stale, unchecked or unverified |

### Usage rules

- Color must be paired with **text labels** and, where useful, an icon or shape. Never use color as the sole carrier of meaning.
- Use cobalt primarily for interactive elements. A selected room may be blue **while also retaining a separate availability label**.
- Avoid making entire panels pure red or green; use quiet tinted status backgrounds and clear typography.
- Prefer real borders and spacing over large shadows.
- Minimum target: **WCAG 2.2 AA** contrast (normal text 4.5:1; large text 3:1; relevant non-text UI boundaries 3:1). Verify actual text/background combinations, including tinted status surfaces.
- Dark mode is **not** part of the hackathon MVP. Do not implement an incomplete second theme at the expense of booking flows.

### Status semantics

| State | Label | Color family | Can "Reserve" be enabled? |
|---|---|---|---|
| Verified free, role eligible | Available | Emerald | Yes, subject to final server validation |
| Occupied by confirmed allocation | Occupied | Red | No; offer alternatives |
| Pending a request | Approval pending | Amber | According to backend reservation policy |
| Maintenance/unusable | Unavailable for maintenance | Red/neutral | No |
| Wrong room type/size/equipment | Does not meet requirements | Purple/neutral | No |
| Requested data not loaded or stale | Availability not verified | Slate | No |
| Room has focus/selection | Selected | Cobalt outline | Selection alone does not imply availability |

## Typography

**Family:** Inter, with a system sans fallback. Use a consistent type scale, not per-page font improvisation.

- Page title: 30px / 700 / 1.2; `letter-spacing: -0.025em`.
- Section title: 20px / 650 / 1.3.
- Card and modal title: 16px / 650 / 1.4.
- Standard content and controls: 14px / 400–600 / roughly 1.5.
- Dense supporting labels: 13px / 600.
- Secondary captions: 12px; do not use 9–10px text for essential information.
- Numeric metric: 28px / 700, with `font-variant-numeric: tabular-nums` for times, counts and capacities.
- Reserve all-caps micro-labels for a handful of compact nonessential markers (e.g. ACCOUNT SETTINGS), not major navigation or instructions.
- Use sentence case: **"Explore rooms"**, **"My bookings"**, **"Approval pending"**.
- Room IDs are exact identifiers: `IET19`, `IET32`, `LH04`. Never stylistically insert spaces, change casing, or invent labels.

### Content and tone

Write like an institutional operations product: informative, concise, action-oriented, never playful during errors.

| Situation | Use | Avoid |
|---|---|---|
| Primary action | **Reserve room** | "Let's make magic" |
| Pending action | **Request sent for approval** | "Booking successful" |
| Collision | **IET19 was just booked for this period. Choose another available room or time.** | "Something went wrong" |
| No match | **No rooms meet the selected capacity and time. Try a smaller capacity or different slot.** | "Zero results!" |
| Network failure | **Live availability could not be checked. Try again.** | Showing a green room tile |

Use full, descriptive dates where ambiguity matters, e.g. **Thu, 5 Nov · 11:00 AM–12:00 PM IST**. Time input and display must agree with the backend's actual time-zone conversion; do not implicitly reinterpret UTC.

## Layout

### Global application shell

- Desktop: sticky **74px top navigation**, no left sidebar. Main content max width **1540px**, responsive horizontal padding up to **38px** on wide screens.
- Navigation: brand at left, single animated tab group in the center, notification/account utilities at right. The active destination must have a legible cobalt pill and label; hover/focus moves the pill toward the target and restores it on pointer exit.
- Navigation destinations: **Overview**, **Explore rooms**, **Calendar**, **My bookings**, **Announcements**, **Admin** (Admin only when role permits).
- Header: one consolidated top bar; do not render a redundant utility bar or breadcrumb above the campus map. Keep the notices control and a role-aware account/sign-out menu; do not render a demo badge.
- Keep global filters close to the page they affect. Do not repeat giant headers and hero art on every logged-in route.
- Data cards: 1px border, white background, 14px radius, 20–24px padding, 16–24px gaps.
- Use a 12-column desktop planning grid, but implement with simple responsive CSS grid as appropriate. Default page rhythm: heading → filters/context → main task content → secondary info.

### Responsive behavior

| Viewport | Navigation | Content | Scheduling |
|---|---|---|---|
| Wide ≥ 1200px | Full top navigation with animated selected tab | Full-width floor-map work area | 7-day weekly grid where legible |
| 768–1199px | Compact top bar with mobile navigation | 2 columns only if room inspector fits | 3–5 day scrollable grid or agenda |
| 375–767px | Compact top bar + accessible dropdown navigation | Single-column, sticky task actions if useful | Day/agenda view with clear date switching |
| 320–374px | Compact accessible drawer | Single-column; no clipped filters | Agenda/list fallback; horizontal map scroll permitted with instructions |

Avoid arbitrary absolute widths that break at 320px. On narrow screens, the floor-plan can be horizontally scrollable **with visible cues and an equally capable room-list alternative**. Do not hide room details behind hover-only behavior.

### Per-page compositions

**Overview**
- Welcome/context header with selected building and current time range.
- At most four meaningful KPI cards: rooms available **for the selected slot**, total verified rooms, upcoming commitments, requests awaiting approval (role-dependent). Always label denominators and time scope.
- Main row: room availability preview + upcoming schedule, then announcements.
- One direct prominent CTA: **Find a room**. Avoid unhelpful charts or numbers that are not connected to real backend data.

**Explore rooms — flagship experience**
- Compact sticky filter bar: Building, Floor, Date, Start time, Duration, Required seats, Room type/equipment if supported.
- Main desktop grid: **two-thirds** interactive floor view, **one-third** inspector/recommendations.
- Floor header: building/floor, floor selector, source/scale status; room legend remains visible.
- Room interaction: hover/focus → quick label; click/Enter → selected room; inspector gives room ID, type, capacity provenance, availability for chosen interval, reason codes, and reserve/alternative actions.
- Show ranked alternatives only when hard constraints are passed. Explain recommendations in ordinary language: "Fits 75 students; free 11:00–12:00; same building."
- Allow **Map / List** switch using the same results. List view supports sorting, keyboard and screen readers. A room-list control is a first-class interface, not a hidden accessibility apology.
- Existing floor geometry is schematic until source-backed SVGs are traced. Never label schematic rooms "accurate blueprint".

**Calendar**
- Default: week timeline on desktop, date/day navigation on compact screens; **Day / Week / Agenda** switch.
- Consistent campus operating-hour axis, with a visible date and IST label. Use 30- or 60-minute grid divisions according to real scheduling rules.
- Distinct event styling for confirmed class, examination, maintenance and pending requests; do not make a pending request look like a taught session.
- Click event → details (room, instructor/course if authorized, start/end, status) → **View room** in Explore view, preserving date/time context.
- Selecting empty time should only open a booking intent for an eligible role; never visually confirm until server acceptance.
- If multiple events overlap in a view, preserve readability, event identity and scrolling; do not hide conflicts to make the UI look cleaner.
- Same data source and interval rules as the room explorer. Calendar is not an independent local source of truth.

**My bookings**
- Status tabs/filters: Upcoming, Pending approval, Past, Cancelled.
- Table (desktop) or structured cards (mobile): title, room, building, date/time, status, actions.
- Detail drawer/dialog includes booking ID, source, start/end, creation context and cancellation rules.
- After create/cancel, refresh both list and map/calendar or invalidate the matching cached data. Provide explicit feedback.

**Announcements**
- List with subject, priority, audience (if visible/authorized), timestamp and read state.
- Clear distinction between urgent institutional notice and routine announcement.
- Use an in-app notification center, not simulated email/SMS/push delivery.

**Admin**
- Role-aware overview and dedicated actionable sections: Pending approvals, Rooms & maintenance, Academic scheduling, Notices, Access/verified roles.
- Review queue items show request context, conflict state, and explicit **Approve / Reject** actions where supported.
- For high-impact actions, use a clear confirmation/review step and show the actual server result.
- Do not expose all-campus controls to a coordinator whose server scope is narrower.

**Authentication gateway**
- Professional split composition only on wide screens: concise product explanation and clear sign-in/sign-up card.
- On mobile the sign-in form is primary. The main workspace is accessible only after a real Supabase sign-in.
- Never imply any email domain alone proves university affiliation. Verified faculty/admin privileges come from trusted role provisioning.

### Spatial/temporal synchronization contract

Global shared query state (when available): `buildingId`, `floorId`, `roomId`, `startInstant`, `endInstant`, `minCapacity`, `roomType`, `selectedEventId`. Every view reuses those semantics.

- Map → Calendar: choosing a room or slot filters/highlights the corresponding time and room.
- Calendar → Map: opening an event brings its building/floor/room into view without losing date context.
- Booking result → both views: invalidate/reload authoritative availability and event allocation.
- Changing a filter updates loading/skeleton status; until validated, never retain a stale green "Available" label.
- Use stable room IDs as keys and stable reservation IDs for persisted records.
- Display in **Asia/Kolkata (IST)**, while sending properly specified ISO timestamps per API contract; never drop offsets accidentally.

## Elevation & Depth

- Base background stays flat and quiet; cards use thin borders to express hierarchy.
- Card shadow: `0 2px 10px rgba(16,27,44,0.04)` maximum for normal surfaces.
- Dropdown shadow: `0 12px 28px rgba(16,27,44,0.12)`.
- Dialog shadow: `0 20px 60px rgba(16,27,44,0.22)` over a scrim; dialogs must not imply a commit happened before confirmation.
- Layering order: content < sticky header/filters < dropdown/popover < modal/backdrop < critical global alert.
- Avoid nested cards with shadows inside more shadowed cards. Use borders, headings, whitespace and typography instead.

### Motion

- Interaction transition: ~120–180ms ease-out on hover, focus and simple reveals. Sliding navigation selection uses the supplied Framer Motion cursor pattern with a ~180ms tween; hovering temporarily moves the cursor, while the selected tab remains authoritative. Disable movement under reduced-motion preferences.
- Motion must communicate interaction or continuity; do not animate cards just to appear "premium."
- No long entrance animations, parallax, spinning 3D rooms, or animated counter numbers in the task views.
- Respect `prefers-reduced-motion: reduce`; essential state changes must remain understandable without animation.
- Status transitions should be announced, not conveyed by animation alone.

## Shapes

- Card: **14px** corner radius; smaller inline elements **8–10px**; badges can be pill-shaped.
- Buttons/input fields: **8–10px**; height **40–44px** on desktop and **44px or more** on mobile where possible.
- Icons: **Lucide**, consistently 16–20px. Icon-only controls require accessible labels and visible tooltips where appropriate.
- Floor-plan rooms: geometric outlines follow validated architectural tracing when available. A selected room gets a strong outline and a visible "Selected" label in its inspector. Avoid faux 3D pseudo-perspective.
- Reserved/occupied rooms must be distinguishable by label/pattern as well as hue. Thin lines alone are insufficient for floor-plan hit targets.
- Avoid decorative emoji inside production controls and avoid mixing multiple icon families.

### Blueprint-specific contract

- Distinguish verified source geometry from temporary schematic data in the interface.
- Exact IET and Deeksha labels and floor counts must come from the approved source data. The current building/floor labels are IET Ground/First/Second and Deeksha Ground/First.
- Preserve the original room IDs (`IET19`, `LH04`, etc.), orientations, doors/corridors/stairs **only where supported by actual traced source**.
- Proposed target: accessible SVG with viewBox, room groups/polygons, clear focus behavior, semantic IDs, and fallback list/table.
- Show a north indicator only if orientation is supported; show scale only when validated. A generic orientation icon is not evidence of accuracy.
- Mark any disputed label and unverified capacity rather than silently resolving it visually.

## Components

### Reusable component inventory

| Component | Contract | Required states |
|---|---|---|
| `AppShell` | Stable navigation and content landmarks | Desktop, collapsed, mobile drawer |
| `PageHeader` | Title, context, one primary action | Loading/context variation |
| `StatusBadge` | Semantic label + icon/color | Available, occupied, pending, restricted, unknown |
| `FilterBar` | Controlled date/building/floor/capacity inputs | Default, invalid, loading, applied |
| `BuildingSwitcher` / `FloorSwitcher` | Valid source-backed options | Selected, disabled, empty |
| `FloorCanvas` | SVG or clearly labeled schematic | Loading, no floor, unavailable data, loaded |
| `RoomHotspot` | Keyboard-operable room identity | Focus, selected, unavailable, unknown |
| `RoomInspector` | Source-provenanced data and next action | Ready, invalid, unavailable, restricted |
| `RoomList` | Accessible same-data alternative | Sort, filter, empty, error |
| `RecommendationList` | Eligible alternatives with reasons | Ranked, none, loading, not verified |
| `CalendarGrid` / `AgendaList` | Same schedule source | Day/week, focus, empty, error |
| `BookingDialog` | Review details, commit only through API | Validating, submitting, conflict, success, pending |
| `BookingStatus` | Persisted server state | Confirmed, pending, rejected, cancelled |
| `NoticeItem` | Priority/audience/time and read state | New, read, urgent |
| `EmptyState` | What happened and suggested action | No matches, no data, no permission |
| `InlineAlert` / `Toast` | Correct placement and action | Success, warning, error, info |
| `Skeleton` | Structural loading without false occupancy | Loading only |
| `PermissionGate` | Hide unauthorized affordances, not backend security | Role known/unknown/forbidden |

Naming is a target **component contract**, not a claim that all these React components already exist.

### Buttons, forms and feedback

- Primary buttons: **one most important action per task surface**. Secondary buttons use border/neutral styling; destructive actions use unmistakable wording.
- Disable "Reserve room" until availability **and** capacity/role eligibility are known and acceptable; on submission show a progress state and prevent accidental duplicate requests.
- A failed request must never trigger a success toast. On HTTP conflict, show the exact user-relevant recovery path and refresh candidates.
- A confirmed mutation shows state, room and time, ideally with a link to My bookings. A pending mutation clearly says **"Approval pending"**.
- Show inline validation errors near fields and a summary for multi-field failures; retain entered values. Server validation is final.
- Error notices containing required recovery actions must not disappear after a few seconds. Toasts are for brief supplemental feedback only.
- Dialogs: visible heading, labelled controls, `Escape` behavior where safe, focus trapped while open, focus restored on close, clear cancel. Prefer accessible primitives; do not hand-roll ARIA without testing.

### Error and waiting states

| Situation | UI response |
|---|---|
| Initial page loading | Skeleton at card/map/calendar level, meaningful label |
| API availability error | Warning panel; room statuses Unknown; retry control |
| Empty matching rooms | "No rooms match these filters"; adjust date, time or seats |
| 401 / expired sign-in | Clear re-authentication step; preserve only safe draft state |
| 403 / role restriction | "You don't have permission to reserve rooms"; no misleading CTA |
| 409 / overlap | "This slot is no longer available"; refresh and offer alternatives |
| 422 / invalid payload | Field-specific, recoverable error |
| Successful instant booking | "Reservation confirmed"; reflect persisted server ID |
| Submitted approval request | "Request sent — approval pending"; no confirmed styling |
| Offline/network unreachable | No false cached availability; clear retry option |

### Accessibility acceptance contract

Target **WCAG 2.2 AA** on supported task views:

1. Visible focus on all controls; a sticky header cannot completely obscure the focused item.
2. Keyboard-only navigation across global shell, selectors, room map/list, calendar, dialogs, and booking actions. Escape closes an appropriate dialog; focus returns logically.
3. Use semantic controls (`button`, `a`, labels, fieldsets, headings, live status), not arbitrary clickable divs.
4. Pointer target **≥24×24 CSS px** unless an explicit WCAG exception applies; prefer **44×44px** for touch-heavy room selection and mobile actions.
5. Never encode availability by green/red alone. Every room has a readable name and status.
6. Normal text 4.5:1 contrast; large text and relevant graphical controls 3:1. Test chosen foreground/background combinations.
7. Zoom to 200% and small screens without content loss or controls being trapped offscreen.
8. Error messages identify affected inputs and explain resolution. Async mutation feedback is announced with appropriate live regions.
9. Calendar has keyboard-operable controls **and an agenda/list view**; clickable map rooms must have equally useful list alternatives.
10. Do not leak private student or staff data in card summaries, aria labels, tooltips or logs.

### Implementation contract for coding agents

- Read `docs/DECISIONS.md`, `docs/MVP.md`, and this document before implementing frontend changes.
- Preserve existing React/Vite setup until a separate refactor is approved. **shadcn is inspiration, not an installed dependency.** If introducing Tailwind/shadcn/Radix or FullCalendar, document migration cost, license, accessibility, bundle implications and test plan.
- Consolidate visual tokens in a single CSS variable layer; new components **must use shared tokens** instead of scattering raw hex colors.
- The structured YAML tokens above are normative values. Keep CSS variables and this file synchronized when changing them.
- Build reusable controls; do not keep expanding a single giant `App.jsx` when a component can be isolated safely.
- Preserve functional API contracts and database-backed status semantics. Do not change booking behavior as part of a styling PR.
- Every screen must define loading, empty, ready, permission-denied, failure and narrow-screen behavior.
- Do not make fake chart metrics or fake persistence look live. Charts need real denominators, time ranges and data provenance.
- Use responsive CSS grid/flex and semantic HTML before introducing complex UI libraries.
- No design-only claim of "AI-powered" recommendations: the current system uses explainable deterministic constraint filtering and ranking.
- Avoid edit conflicts with parallel development: read current branch, make focused changes, verify build, and review the diff before merging.

### Minimum visual/functional QA matrix

- **Desktop**: 1440×900, 1280×800.
- **Tablet**: 1024×768, 768×1024.
- **Mobile**: 390×844, 375×812, 320×568.
- **Zoom/keyboard**: 200% zoom; keyboard-only with visible focus; `prefers-reduced-motion`.
- **Roles**: unauthenticated sign-in, student, unverified faculty, verified faculty, authorized coordinator, admin.
- **Data**: empty, loading, API failure, stale response, confirmed booking, pending request, time conflict, unauthorized action.
- **Cross-view**: change date/time/capacity → map, list, recommendations and calendar agree; create booking → refresh → persistence and conflict are visible.
- **Buildings**: IET and Deeksha; each available floor; room label accuracy and explicit schematic warning.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Build a calm, dense, readable operations UI | Make a glossy landing page disguised as a dashboard |
| Retain navy/cobalt brand consistency | Import a random template with another color scheme |
| Make availability and approval statuses explicit | Color a pending or unknown room green |
| Use a map **plus** an equivalent filterable list | Force everyone to interpret tiny polygon labels |
| Use a calendar and map sharing the same query state | Maintain separate simulated event data in live mode |
| Show source-backed room capacity and geometry | Pretend schematic rectangles are precise blueprints |
| Display recovery when a booking conflicts | Flash a generic "Error" toast or silently retry as success |
| Preserve visible, keyboard-operable focus | Depend on hovering small room tiles |
| Require real authorization and verified API saves | Claim a booking was persisted without backend confirmation |
| Keep UI changes in focused, testable PRs | Replace the existing stack days before submission for appearance alone |

### Acceptance: the five-second test

On the **Explore rooms** page, a first-time faculty user should be able to answer in roughly five seconds:
1. Which building and floor am I looking at?
2. Which date/time interval am I checking?
3. Which rooms are verified available vs occupied/unknown?
4. What is the selected room's capacity and status?
5. What happens when I select **Reserve room**?

If those answers are not visually obvious, simplify the page before adding embellishment.

### Proposed implementation order (without colliding with the active backend work)

1. **P0 — Consistency:** central CSS tokens, shared page heading/filter/input/button/status styles; preserve navigation and existing API behavior.
2. **P0 — Truth:** consistent confirmed/pending/unknown states; fix misleading availability and booking messages.
3. **P0 — Flagship:** refine Explore rooms, inspector, recommendations and map/list switch; protect narrow viewports.
4. **P0 — Cross-view:** synchronize room and calendar selections, dates and time intervals.
5. **P1 — Workflow polish:** My bookings, announcements, approval queue, focused accessibility checks.
6. **P2 — Authenticity:** source-verified SVG floor tracing and official dataset import as permitted; advanced analytics and secondary themes only after core acceptance.

### Research and standards reviewed

- Google Labs, [DESIGN.md format specification](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md).
- shadcn/ui, [dashboard and sidebar building blocks](https://ui.shadcn.com/blocks) and [Vite installation guidance](https://ui.shadcn.com/docs/installation/vite).
- IBM Carbon, [notification guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/notification/guidelines).
- W3C, [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- FullCalendar, [selection overlap](https://fullcalendar.io/docs/selectOverlap) and [time-zone handling](https://fullcalendar.io/docs/timeZone).
- GOV.UK Design System, [recover from validation errors](https://design-system.service.gov.uk/patterns/validation/).
- Existing IET Grid repository documentation: `docs/DECISIONS.md`, `docs/DESIGN.md`, `docs/MVP.md`, `docs/BACKEND_IMPLEMENTATION.md`, and current `frontend/src` at the review snapshot.

*This is an implementation guideline and a proposed canonical design contract. It does not assert that unfinished components, official blueprint geometry, role provisioning or production end-to-end flows are complete.*