# IET Grid — Product Requirements Document (PRD)

**Status:** Approved product direction; feature-level completion varies  
**Version:** 0.1 • 5 November 2026  
**Institution:** Institute of Engineering & Technology (IET), DDUGU

## 1. Problem statement and evidence

According to the organizer's BUILD WITH AI: DevOps 2026 problem statement, classroom allocation and timetable changes at IET are fragmented. Faculty face uncertainty when finding spaces for additional lectures, practicals, examinations and events. The document specifically describes students missing an NSS minor examination because examination arrangements were unclear or insufficiently communicated.

The campus includes IET and Deeksha Bhawan, approximately 100 m apart. Faculty need reliable vacancy information and alternative suggestions across both buildings. Students need accurate class/exam schedules and notices.

## 2. Product vision

**IET Grid** is a unified, campus-specific academic coordination platform for faculty, students and university staff. Its first value proposition is **the right room at the right time with no silent booking conflicts**. The long-term vision adds generation and supervised publication of optimized semester timetables.

Product identity is **hybrid**: independent technology brand **IET Grid**, presented as a DDUGU institutional solution.

## 3. Primary users and jobs to be done

| Persona | Core job | Permissions goal |
| --- | --- | --- |
| Student | See accurate timetable and exam location; read notices; flag mistakes | Read relevant schedules, submit minimal reports; cannot modify official bookings |
| Verified faculty | Find and book suitable rooms, manage extra sessions | Create permitted bookings; view cross-building availability |
| Building/department coordinator | Handle delegated approvals and room operations | Approve requests and publish notices only in assigned scope |
| University administrator | Maintain institutional source of truth | Manage policies, verified identities, rooms and approval oversight |

**Important:** The hierarchical scope policy above is an agreed **target**. The current database has roles but does not yet enforce granular building/department scoping.

## 4. Outcomes and success measures

- Faculty can identify viable available classrooms without checking them physically.
- Two overlapping confirmed reservations for the same room cannot coexist.
- A room conflict produces at least one valid alternative when an alternative exists.
- A schedule notice reaches the in-app academic notice feed.
- A student cannot create or modify official bookings.
- Space data remains identifiable as verified or provisional.
- The hackathon produces a working deployment, public source and documented setup.

Future institutional metrics: time-to-find-room, booking collision rate, proportion of critical changes acknowledged (requires optional acknowledgement design), room utilization and administrator effort. Do not fabricate baseline numbers.

## 5. Functional requirements

| ID | Requirement | Target priority |
| --- | --- | --- |
| FR-01 | Discover room availability by building, floor, room, date, time, duration and minimum capacity | P0 |
| FR-02 | Book a room for lecture, practical, examination or event | P0 |
| FR-03 | Reject overlapping confirmed bookings, including concurrent requests | P0 |
| FR-04 | Recommend eligible alternative rooms and time slots using validated records | P0 |
| FR-05 | Maintain regular timetable commitments and one-off reservations in one availability model | P0 target; current implementation partial |
| FR-06 | Publish cancellations, rescheduling and exam notices | P0 |
| FR-07 | Allow students to view accurate schedules and flag incorrect entries without editing official data | P0 |
| FR-08 | Enforce student/faculty/coordinator/admin permissions at backend | P0 |
| FR-09 | Keep auditable booking and status-change history | P0 |
| FR-10 | Model IET + Deeksha Bhawan from original blueprints, including room identifiers and relevant capacities | P0 |
| FR-11 | Import supplied student, branch, year, batch and section datasets | P0 (data-dependent) |
| FR-12 | Separate pending approval for examinations, large events and restricted spaces | P1 / limited MVP |
| FR-13 | Synchronize a floor-plan context with the timetable calendar | P1, demo-critical |
| FR-14 | Generate draft semester timetables from constraints; review, edit, lock and publish only after approval | P2 (long term) |
| FR-15 | Student-targeted in-app critical notices; optionally mark acknowledged | P1/P2 |
| FR-16 | Department/building-scoped coordinator authority | P1 production hardening |
| FR-17 | Support verified student self-service onboarding, faculty invitation/approval and controlled administrator provisioning | P1 production hardening |

The official 8 core challenge items are traced in [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md).

## 6. Product policies already decided

**Booking:** Hybrid approval. Routine eligible faculty bookings can be immediate; exams, major events and restricted bookings require approval. Conflicts are checked **even when** administrators approve.

**Timetable:** Long-term unified import/editing/recurrence model plus automatic semester generation. Generated schedules follow **Generate → Review → Edit → Publish**. Drafts must never silently overwrite published schedules.

**Discovery:** Equally important, synchronized spatial and temporal views. Spatial uses room polygons traced from the source blueprint (target; current view schematic). Temporal presents day/week academic calendars and links events to rooms.

**Identity:** Supabase Auth, with university-identity verification separate from sign-in; knowing a roll number alone must not authorize a claim. Student email/password or Google sign-in is a target; current code implements email/password, not Google sign-in. Faculty elevated access needs trusted invitation/approval.

**Notifications:** In-app only for the first release. Risk: students not visiting the portal can miss urgent updates. Show critical changes prominently on next login; off-platform delivery is deferred.

**Student reports:** A minimal incorrect-information reporting action is kept to meet the official requirement; full complaint/ticketing workflows are deferred.

## 7. Data specification

The PDF's IET branch list: CSE approximately 150 (Sections A/B), AI/ML approximately 150 (A/B), AI/DS 75, ECE 75, ME 75, IT 75, across years 1–4. These are organizer-provided **approximate** figures, not a validated imported enrollment table.

Two buildings across five total floor views:
- IET ground: library, teachers' office, placement cell, director office; first floor contains room labels IET22, IET16, IET14, IET15, IET20, IET19, IET18, IET17; second floor includes IET32 seminar hall, IET24, IET25, IET30, IET29, IET28, IET23.
- Deeksha ground: LH01–LH07; first floor LH08–LH14 as shown in the blueprint.

**Conflicts in supplied materials:** prose describes fewer Deeksha rooms (LH01–LH12) than the blueprint (LH01–LH14), and omits IET23 from the textual room list. Do not discard visible rooms without confirmation. Prose indicates four laboratories, but the exact room-to-lab assignments need validation. IET first-floor classrooms are approximately 75 seats and IET32 seminar hall about 200. Unconfirmed room capacities must be configurable and clearly indicated.

## 8. Non-functional requirements

- **Correctness:** database exclusion constraint is final collision authority; validation on reservation and approval.
- **Security:** RLS on public tables, privileged RPCs with internal identity checks, no user-editable metadata as authorization source, no service-role key in browser.
- **Integrity:** pending vs confirmed status is never confused; written history for key booking changes.
- **Availability:** fresh data after mutations; explicit error on stale slot selection.
- **Performance:** one lightweight, responsive application; clear loading/error states; no mandatory LLM latency for finding rooms.
- **Accessibility:** labels accompanying color states, keyboard-operable room selection, responsive layout, visible focus.
- **Data fidelity:** official records marked verified; samples explicitly labeled.
- **Operations:** reproducible migration, environment setup, GitHub and Vercel deployment, test accounts with limited permissions.

## 9. Non-goals for the hackathon release

Native mobile apps, multi-university SaaS tenancy, elaborate 3D campus rendering, a drag/drop floor-plan editor, advanced analytics, SMS/email/WhatsApp/push notifications, custom roles builder, large-scale LLM agent orchestration and fully autonomous semester scheduling.

## 10. Dependencies, risks and assumptions

| Issue | Impact | Mitigation |
| --- | --- | --- |
| Official student/branch/batch dataset absent from provided PDF | Cannot deliver authentic personalized student view | Request/import official file; do not fabricate records |
| Room capacity and lab mapping uncertainty | Wrong recommendations | Keep verified flag and configurable capacity/type |
| Floor map schematic | Does not meet exact-blueprint aspiration | Import and trace source blueprint as SVG; explicitly label current map |
| Same-day deadline (21:00 IST) | Feature spread and integration risk | One fully working vertical slice, submission buffer |
| Free-tier Supabase availability/limits | Deployment dependency | Monitor errors, keep demo fallback clearly labeled |
| In-app-only notices | Missed urgent exam changes possible | Surface high-priority notices on next login; disclose limitation |
| Missing scoped admin authorization | Unauthorized cross-department admin potential | No real institutional rollout until scoped policies and tests |

## 11. Acceptance gates

A requirement is **done** only after a demonstrable test confirms it; source code present or deployment READY is insufficient. Use [TEST_PLAN.md](TEST_PLAN.md) to record results and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) to track blockers.
