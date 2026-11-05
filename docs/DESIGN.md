# IET Grid — Design System & UX Specification

**Direction chosen:** Hybrid cohesive visual language (Linear-like refinement, Kiranism/shadcn-style dashboard information architecture and polished scheduling-calendar interactions). We rejected the earlier rough standalone floor-map prototype; that is not the visual benchmark.

## Brand

- **Name:** IET Grid
- **Institutional identity:** IET, Deen Dayal Upadhyaya Gorakhpur University
- **Voice:** precise, modern, credible, academically clear; not playful consumer-ticketing copy
- **Visual palette (current app):** navy sidebar **#101B2C**; cobalt accent **#315CE5**; page surface **#F6F8FB**; white cards; slate text; emerald available; warm red occupied.
- **Typography:** Inter (body and display); clean compact labels, strong hierarchy, readable numbers.
- **Shapes:** restrained 8–16px rounded corners, subtle borders/shadows; avoid flashy glass effects, giant glowing gradients or gratuitous motion.

## Global shell

- Product wordmark + institutional subtitle.
- Left navigation: **Overview**, **Explore rooms**, **Calendar**, **My bookings**, **Announcements**, **Admin**.
- Top bar: breadcrumb, date, notifications, user badge and clear **DEMO DATA** state when not connected to authoritative data.
- Main content: responsive card grid and predictable density; maintain typography/spacing tokens between pages.
- Current implementation uses a responsive collapsible sidebar on narrow screens.

## Two synchronized mental models

### Spatial — Where can I teach?
- Select building (IET or Deeksha), floor, date, time, duration and minimum seats.
- Interactive rooms support: **available**, **occupied**, **selected**, **capacity mismatch**, and **unverified/restricted**.
- Selecting a room reveals capacity, room type, precise time slot, availability and a booking action.
- Recommendations explain why a room is eligible or preferred. Scores are heuristics, not AI confidence.

### Temporal — When can I teach?
- Week/day calendar exposing commitments and free slots for the same campus records.
- Selecting an event jumps to the related room in the spatial view.
- Save/review of a booking should refresh both views.

## Floor-plan quality bar

The organizer supplied a genuine blueprint (IET ground/first/second; Deeksha ground/first). The target is a **manually traced SVG** preserving room polygon geometry, corridors, stairs and room IDs, then React-controlled clickable areas. Use original source as tracing reference, not a vague set of generic rectangles.

**Reality today:** current React UI draws a schematic room grid. It is neither to scale nor an exact blueprint. Do not represent it to judges as completed accurate tracing.

## Components

- SidebarNavigation / Breadcrumb / InstitutionBadge
- BuildingSwitcher / FloorSwitcher / DateTimeFilters
- FloorCanvas / RoomPolygon (target) / RoomInspector
- AvailabilityLegend / RecommendationCard / BookingDialog
- CalendarGrid / CalendarEvent
- AnnouncementsList / PriorityNotice / ReportIssue
- Role-aware action gates / toast and field-validation feedback

## UX states and interactions

Every data surface needs: loading, empty, success, validation failure, permission denied, network error and data-provenance indication. Never mask a failed live booking with success feedback. Pending approval needs an explicit status separate from booked.

Accessible interactions include visible keyboard focus, click/tap targets, semantic labels and status labels alongside color. At mobile widths room selection and booking must remain operable even if calendar columns scroll horizontally.

## Design QA

- All navigation destinations render without broken controls.
- No conflicting UI from mixed GitHub templates.
- Booking availability states recompute when date/time/duration changes.
- Both buildings and floors are usable on desktop and mobile.
- Room tile/shape IDs match the source data and show capacity verification status.
- User role is never inferred purely from appearance; backend authorization is separate.

See [MVP.md](MVP.md) for what is expected in the immediate submission and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for implementation order.
