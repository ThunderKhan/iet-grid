# Official Requirements → IET Grid Implementation

**Source:** BUILD WITH AI: DevOps 2026, GDG on Campus, DDUGU — three-page problem statement "Smart Campus Classroom Management System".  
**Status terms:** Implemented = source exists; Deployed = live build present; Verified = acceptance test recorded; Partial = incomplete user experience/data; Missing = not implemented.

## Eight core challenge items (problem PDF sections 3–4)

| Official requirement | IET Grid coverage | Baseline status | Work remaining |
| --- | --- | --- | --- |
| 1. Search by building, floor, room, date, time, duration, capacity | Explore rooms selectors and room inventory | Implemented / partial | Live browser test; improve exact room search |
| 2. Faculty booking for extra class, minor exam, practical and events | Booking form and server create_room_booking RPC | Implemented / unverified end to end | Verified faculty test; final approval UI |
| 3. Prevent overlapping bookings and suggest alternatives | DB exclusion constraint; JS recommendation algorithm | DB constraint deployed; UI partial | Two-user concurrency test; stale availability handling |
| 4. Cancellations, rescheduling, exam notices and other updates | Announcements table and publish RPC, UI | Partial | Full cancellation/rescheduling event model, target cohorts |
| 5. Student view and report conflicts/outdated information without booking edits | Role restrictions, announcements and minimal report action | Partial | Official student mapping, personalized views and report validation |
| 6. Faculty/student/admin role-based access | Supabase profiles, RLS, privileged RPC | Partial | Test actual roles; enforce coordinator scopes |
| 7. History of important booking changes | booking_history trigger/table | Implemented / verification incomplete | Readable admin history UI and retrieval controls |
| 8. Intelligent assistance using AI or algorithms validated against bookings | Deterministic capacity/availability scoring | Partial | Validate all constraints against official recurring classes; benchmark scenarios |

## Mandatory assets and deliverables

| Requirement | Current evidence | Status / gap |
| --- | --- | --- |
| Both IET and Deeksha building blueprints in prototype | Two building selectors and schematic floors | **Partial:** original blueprint has not been integrated as accurately traced or directly viewable asset |
| Student/branch/batch/building datasets | 30 blueprint-derived room records; static sample schedules | **Missing:** organizer student files not supplied/imported |
| Actual campus infrastructure | Identifiers for IET, Deeksha, IET32, IET23 and LH01–LH14 | Partial: capacities and lab designations need verification |
| Working demonstration | Public Vercel build reported READY | Deployment ready, end-to-end browser tests pending |
| Source-code repository | https://github.com/ThunderKhan/iet-grid | Available |
| Setup instructions | Root README and SQL migrations | Available; credential and login smoke test pending |
| Test bookings clearly labeled as test data | Distinct, explicitly marked guest/demo mode | Implemented |

## Source discrepancies requiring confirmation

- Deeksha prose says LH01–LH12, but page-one drawing shows LH01–LH14.
- Second-floor prose omits IET23, which appears in the drawing.
- The four first-floor IET labs are not unambiguously assigned numbered rooms in the textual description.
- Exact capacity of most rooms is not given; default estimates are not authoritative.

## Submission honesty rule

Do not describe an unimported dataset, untested backend flow, precisely traced blueprint or unimplemented AI timetable optimizer as complete. Judges should be able to distinguish current evidence from roadmap items.
