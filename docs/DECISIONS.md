# IET Grid — Decision Log

**Purpose:** Canonical record of choices made with the team, plus tactical implementation choices and unresolved issues.  
**Last consolidated:** 5 November 2026.

## 1. Planning interview — agreed decisions

| ID | Question | Confirmed choice | Consequences |
| --- | --- | --- | --- |
| D-01 | Product ambition | **B — Real university platform; hackathon is the first milestone** | Build credible extensible foundations, not a demo-only toy |
| D-02 | Product identity | **C — Hybrid independent brand + DDUGU identity** | Standalone product look with university institutional context |
| D-03 | Naming process | **D — Explore all naming styles** | Compare descriptive/modern/Indian-inspired names rather than prematurely fix one |
| D-04 | Booking permissions | **C — Hybrid instant + approvals** | Routine eligible faculty reservations immediate; examinations, large events and restricted uses require approval |
| D-05 | Administration | **C — Hierarchical institutional roles** | University admin, building/department coordinator, faculty, student; roles and scopes separate |
| D-06 | Timetable capabilities | **D — Unified schedules + automated semester generation** | Long-term engine must handle regular sessions, bookings, revisions and optimized semester drafts |
| D-07 | Generated timetable governance | **C — Generate → Review → Edit → Publish** | Human authorization required, drafts separated from published timetable versions |
| D-08 | Floor plan / calendar | **C — Dual synchronized spatial + temporal views** | Room map and calendar share the same scheduling data |
| D-09 | Account access | **C — Hybrid verified registration** | Supabase sign-in plus independent university identity proof; faculty elevated roles require trusted verification |
| D-10 | Academic notifications | **A — In-app only** | No email, SMS, push or WhatsApp in initial scope |
| D-11 | Student reporting | **Deferred advanced workflow** | Keep minimal reporting action because the organizer requires it; no full issue tracker |
| D-12 | Visual design | **D — Hybrid coherent design system** | Linear-like refinement + Kiranism/shadcn dashboard patterns + Notion Calendar-style schedule UX; avoid disconnected component collage |
| D-13 | Hackathon scope cut | **Delegated to assistant** | Aggressively reduce features but retain good algorithms, secure backend, impressive UI and all mandatory requirements |
| D-14 | Deadline | **5 November 2026 at 21:00 IST** | Same-day delivery: working app + GitHub link + Word written solution |
| D-15 | Starting state | **New project** | Fresh repository, dedicated database and new deployment |

## 2. Naming decision after the interview

**IET Grid** is the final selected working product name, despite D-03 originally keeping the naming exploration open. The user supplied and authorized the repository **ThunderKhan/iet-grid** and confirmed project name IET Grid. This supersedes ongoing name exploration for the current submission.

Use **IET Grid** in UI, documentation, screenshots and submission. Do not rename DB/app components without a separate decision.

## 3. Tactical decisions made during implementation

| ID | Decision | Rationale/status |
| --- | --- | --- |
| T-01 | Use React 19 + Vite 6 rather than planned Next.js starter | Reduce same-day migration/integration risk; **implemented** |
| T-02 | Use Supabase Auth + PostgreSQL and Vercel | Team-chosen stack; project deployed and database provisioned |
| T-03 | Avoid blind multi-repository starter integration | License/architecture mismatch and time constraints; borrow patterns, not unverified code |
| T-04 | Implement transparent deterministic recommendation scoring first | Constraint-checked room ranking is appropriate without a fabricated LLM component |
| T-05 | Database exclusion constraint rejects overlapping confirmed bookings | Server remains final integrity authority |
| T-06 | Store exams/events as pending until coordinator approval | Aligns with hybrid booking choice; approval UI still required |
| T-07 | Source building/room identifiers from the organizer blueprint, including conflicting labels | No invented room IDs; disputed rooms flagged for confirmation |
| T-08 | Mark demo data explicitly | Demo reservations are in-memory, never official records |
| T-09 | Use independent IET Grid Supabase project in Mumbai (ap-south-1) | Protect unrelated VSPH data; existing VSPH project untouched |
| T-10 | Defer semester optimizer, full role designer, 3D, native mobile, detailed issue tracker | Preserve end-to-end MVP quality and submission deadline |
| T-11 | Keep the project license MIT | Repository currently MIT; external code/assets need separate license review |
| T-12 | Store developer docs under docs/ and link from root README | Single readable, versioned source of product decisions |

## 4. Important distinction: decided vs shipped

**Decided, not yet fully implemented:** Google sign-in; reliable official student identity matching; per-building/department coordinator scopes; real time-table import; generated semester draft workflow; precise SVG tracing; fully student-personalized schedules; full administrator approval interface.

**Shipped in the repository:** Vite frontend, page navigation, basic map/calendar, Supabase Auth integration code, room booking RPC integration, announcement RPC integration, six Postgres tables and security migration.

**Independently verified in prior execution:** Supabase project active, 30 rooms inserted, RLS enabled, migrations applied, Vercel build READY. This does **not** prove user-level booking, login or UI acceptance tests.

## 5. Open decisions (do not assume answers)

1. Source-of-truth dataset and exact room capacities, lab assignments and eligibility.
2. Actual faculty/staff identity verification source and first administrator bootstrap method.
3. Recurring timetable import file format and semester validity rules.
4. Room permissions and department/building scoping for coordinators.
5. Reporting audience: all authenticated users vs cohort-only visibility (production should restrict appropriately).
6. Whether the organizer permits current schematic tracing as blueprint integration; treat it as incomplete until accepted.
7. Presenter assignment and final presentation-specific judging weights (not stated in the problem PDF).

## 6. Change-control rule

When a decision changes, append the new choice and what it supersedes. Do not silently rewrite historical choices. Keep proposal vs agreement vs implementation status explicit.
