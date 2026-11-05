# IET Grid — Documentation

**Intelligent Campus Scheduling & Classroom Management**  
Institute of Engineering & Technology (IET), Deen Dayal Upadhyaya Gorakhpur University (DDUGU)

> **Documentation baseline: 5 November 2026.** This is a living repository of agreed product decisions, the hackathon MVP, the design and architecture, and implementation progress. Distinguish **implemented**, **deployed**, **verified**, **planned**, and **deferred**. Deployment/build success is not equivalent to end-to-end verification.

## Start here

| Document | What it answers | Audience |
| --- | --- | --- |
| [MVP.md](MVP.md) | Exactly what must ship for the hackathon; what was cut; what we will demo | Entire team |
| [PRD.md](PRD.md) | Problem, users, feature requirements, acceptance criteria, success measures | Product + engineering |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Execution order, priorities, dependencies, quality gates and launch checklist | Engineering |
| [DECISIONS.md](DECISIONS.md) | All product choices from our planning interview and subsequent execution decisions | Entire team |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Current architecture, backend flow, access control and data model | Engineering |
| [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md) | Every official problem-statement requirement mapped to implementation status | Team + judges |
| [TEST_PLAN.md](TEST_PLAN.md) | Test scenarios, verification evidence required and release criteria | Engineering + QA |
| [SYSTEM.md](SYSTEM.md) | Concise system reference, operational invariants and known gaps | Engineering |
| [DESIGN.md](DESIGN.md) | Brand, UX structure, visual rules and spatial/calendar interaction | Design + frontend |

## Project links

- **Repository:** https://github.com/ThunderKhan/iet-grid
- **Deployment:** https://iet-grid.vercel.app/
- **Database:** separate Supabase project named **iet-grid**, Mumbai region (ap-south-1)
- **Source of requirements:** BUILD WITH AI: DevOps 2026 — Smart Campus Classroom Management System, three-page organizer PDF, especially sections 2–4.

## Product in one sentence

IET Grid lets authorized university staff discover, schedule and reserve suitable classrooms across IET and Deeksha Bhawan while students access reliable academic updates, with scheduling collisions rejected by the database.

## Current product snapshot

- **Already in repository:** React/Vite interface with overview, room explorer, schematic floor views, week-style calendar, bookings list, announcements, basic report action, authentication screens and visible demo mode; Supabase SQL migrations for six tables, RLS and booking functions.
- **Already provisioned:** dedicated Supabase project; 30 seeded room records; Vercel build reported READY.
- **Not yet proven end-to-end:** real faculty account verification, signing in and completing a database-backed booking, approval UI, real student cohort filtering, and live notice delivery.
- **Still missing mandatory input:** organizer-provided student, branch, year, batch and section data, plus authoritative room capacity/laboratory mapping.
- **Not production ready:** floor-plan geometry is schematic, not an accurately digitized tracing of the supplied blueprint.

## Working agreements

1. **Submission deadline:** 5 November 2026, **21:00 IST** (repository, deployed link and written solution).
2. **Primary goal:** real DDUGU platform, with the hackathon as the first working milestone—not a multi-university SaaS.
3. **Build priority:** trustworthy complete vertical slice over a wide, incomplete feature list.
4. **Data truth:** UI demo samples must never be presented as official campus information.
5. **Security:** all privileged decisions are enforced in the backend; no browser-accessible secret or service-role key.
6. **Scope control:** automated semester optimization remains part of the longer-term product vision but is not a blocker for the hackathon MVP.

## Documentation maintenance

- Keep [DECISIONS.md](DECISIONS.md) as the decision record; update it when the team changes a choice.
- Keep [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md) and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) current as tasks are validated.
- Mark any discrepancy between the problem statement, blueprint and supplied CSV explicitly.
- A feature is called **verified** only after its acceptance test has been executed and recorded.
