# IET Grid — Hackathon MVP

**Baseline:** 5 November 2026  
**Submission deadline:** 21:00 IST, 5 November 2026  
**Product direction:** Real university platform; one reliable hackathon milestone.

## 1. MVP outcome

Demonstrate the reliable end-to-end flow:

1. Faculty signs in using a verified faculty account.
2. Faculty selects building, floor, date, time, duration and required class size.
3. Interactive spatial view displays rooms with availability; the scheduling calendar shows commitments for the selected period.
4. Faculty attempts an occupied or unsuitable room and receives a clear rejection plus eligible alternatives.
5. Faculty books a free, eligible room; the Supabase backend persists the reservation.
6. A second overlapping request cannot create another confirmed reservation for that room and time.
7. Students can see an updated timetable/booking record and the in-app announcement feed.
8. Authorized administrator can publish schedule notices; approval-required bookings have a review path.

**Judge-facing thesis:** A campus-specific, blueprint-aware reservation workflow backed by a real PostgreSQL constraint system and transparent, deterministic room recommendations. Do not claim an LLM that is not implemented.

## 2. Minimum hackathon scope

| Capability | Required MVP behavior | Acceptance evidence |
| --- | --- | --- |
| IET + Deeksha infrastructure | Both buildings present, with selectable floors and official blueprint-derived room IDs | Demonstrate both views; show original source blueprint and explain geometry caveat |
| Capacity and slot discovery | Search/filter by building, floor, date, time, duration, minimum capacity | Change filters; list changes correctly |
| Reservations | Verified faculty can create a real eligible booking | See persisted row after refresh/login |
| Collision prevention | Confirmed reservations cannot overlap on the same room | Second attempt rejected at DB level |
| Alternatives | Recommend available rooms satisfying hard constraints, ranked by suitability | Block a room, inspect alternatives |
| Academic timetable | Show booking events in a calendar; indicate recurring campus timetable as a future integration unless imported | Cross-view room/time consistency |
| Notices | In-app notices, with authorized publication | Notice appears for authorized viewers after refresh |
| Student access | Student cannot edit official bookings; can view allowed schedules and report incorrect information | Role checks and minimal report submission |
| Accountability | Persist booking actions and review changes | Audit rows + example |
| Submission | Public URL, GitHub repo, instructions, Word solution | All links open in an independent browser session |

**Important:** The official PDF requires integration of the provided student/branch/batch datasets and BOTH original building blueprints. Existing seed data and schematic floor cards do **not** fully satisfy that requirement. These remain high-priority data-integration tasks if the organizers provide the files.

## 3. Explicit scope cuts for the MVP

These are conscious cuts, **not** cancelled long-term decisions:

- No full-semester timetable auto-generation or OR-Tools solver in the hackathon slice.
- No optimizer-powered partial timetable regeneration, multi-stage collaborative timetable approval or custom permissions designer.
- No 3D building, animation-heavy floor transitions, or floor-plan editor.
- No mobile-native applications (responsive web only).
- No email, WhatsApp, SMS or push notification delivery (in-app only).
- No advanced reporting/analytics or full student complaint-ticketing system.
- No multi-university tenancy or third-party identity-provider dependency.
- No unverified integration of multiple GitHub starter repositories simply for appearances.

## 4. Critical flows and rules

### Room booking
- Hard constraints: room active, permitted type/use, verified or clearly labeled capacity, capacity sufficient, valid date/time/duration, and no overlapping **confirmed** booking.
- The UI may display advisory availability; final validation is always in PostgreSQL.
- Standard extra lectures/practicals can be confirmed instantly if role/room rules permit.
- Examinations and major events follow pending approval, with final database validation on approval.
- Pending requests must **not** be displayed as confirmed reservations. Their scheduling policy and availability impact must be explicit.

### Student / faculty boundaries
- Anonymous or unverified accounts receive no elevated privileges.
- Students may read appropriate academic information and send a minimal inaccurate-schedule report.
- Faculty may create permitted reservations, not elevate their own role.
- Coordinators and admins may operate within delegated scopes in the target system. Full delegated-scope enforcement is not yet implemented; before production this is mandatory.

### Calendar + spatial map
- Both consume the same room and booking source.
- Selecting a calendar event opens its room context in the spatial view.
- Visual statuses combine color with text and work with keyboard interaction.
- A credible floor view respects the real blueprint; never present a schematic as to-scale.

## 5. Demo storyboard (target 3–5 minutes)

- **Scene A — Context (20 s):** Two separate university buildings; faculty cannot reliably discover free space.
- **Scene B — Discovery (45 s):** Set 75 students, a date and time; inspect the IET floor view and a Deeksha alternative.
- **Scene C — Conflict (45 s):** Select a booked room; show conflict message and ranked alternatives.
- **Scene D — Transaction (45 s):** Confirm a real eligible reservation; reload and show persisted record; attempt overlap and show rejection.
- **Scene E — Communication (45 s):** Show student-facing calendar and in-app academic notice.
- **Scene F — Engineering (30 s):** Explain Auth/RLS, constraint, recommendation scoring, audit log and future timetable optimizer.

Use a real integration for the judged version. If demonstrating nonpersistent sample data as a fallback, say so prominently and do not claim persistence.

## 6. Actual implementation snapshot

| Area | As of documentation baseline | State |
| --- | --- | --- |
| React/Vite app and basic responsive navigation | Present in main branch | Implemented |
| Schematic two-building floor explorer + room inspector | Present; not accurate vector tracing | Implemented with limitation |
| Week-style calendar | Present; basic UI rather than Full Calendar package | Implemented with limitation |
| Transparent demo data + local demo reservations | Present | Implemented |
| Auth screens / Supabase client | Present, Vercel env configured | Connected in code; end-to-end unverified |
| Supabase tables / constraints / RLS / RPC | Migrations applied to dedicated project | Schema deployed |
| Verified faculty and admin logins | Not yet demonstrated end to end | Unverified |
| Real booking and approval UI | Booking RPC wired; approval RPC exists but no UI | Partial |
| Student-specific timetable mapping | Official dataset not imported | Missing |
| Original blueprint geometry digitization | Only schematic layout | Missing |
| In-app announcements | List and privileged publish RPC in code | Partial / unverified |

## 7. Definition of done

The MVP is submission-ready only when:
- deployed link works publicly and does not show a build/auth error;
- real faculty and student test accounts obey backend rules;
- one reservation persists and a collision is rejected;
- IET and Deeksha rooms and academic notices are visible;
- official required datasets/blueprints are integrated or limitations are plainly disclosed;
- README/setup instructions and written solution are consistent with what actually works.

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the ordered execution sequence.
