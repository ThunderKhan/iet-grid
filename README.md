# IET Grid

**Intelligent campus classroom scheduling and room booking** for DDUGU's Institute of Engineering & Technology (IET) and Deeksha Bhawan.

- **Live app:** https://iet-grid.vercel.app/
- **Source:** https://github.com/ThunderKhan/iet-grid
- **Documentation hub:** [docs/README.md](docs/README.md)

## Documentation

| Document | Purpose |
| --- | --- |
| [MVP](docs/MVP.md) | Hackathon scope, demo scenario, explicit cuts and definition of done |
| [PRD](docs/PRD.md) | Product requirements, personas, acceptance criteria and constraints |
| [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) | Prioritized execution board, verification and handoff |
| [Decision Log](docs/DECISIONS.md) | All agreed planning and implementation choices |
| [Architecture](docs/ARCHITECTURE.md) | Current services, data model, auth and booking algorithm |
| [System](docs/SYSTEM.md) | Short operational reference |
| [Design](docs/DESIGN.md) | Brand and interaction specification |
| [Requirements Traceability](docs/REQUIREMENTS_TRACEABILITY.md) | Organizer requirements vs implementation status |
| [Test Plan](docs/TEST_PLAN.md) | Acceptance tests and evidence requirements |

## Local setup

1. Install Node.js and run **npm install**.
2. Create a new, dedicated Supabase project, or use the separate project already provisioned for IET Grid.
3. Apply the SQL files in **supabase/migrations/** in numeric order on a fresh database.
4. Copy **.env.example** to **.env.local** and supply **VITE_SUPABASE_URL** and **VITE_SUPABASE_ANON_KEY** (only a public publishable key).
5. Run **npm run dev**; build with **npm run build**.
6. Register an account, then have a trusted administrator verify and provision faculty/coordinator/admin roles before testing privileged operations.
7. On Vercel, set the same two public environment variables and redeploy.

**Do not commit passwords, secret/service-role keys, authentication tokens or private university student data.**

## Current implementation and limitations

- React/Vite client with dashboard, schematic room map, calendar, reservations, announcements and transparent guest/demo mode.
- Dedicated Supabase Postgres schema, verified/role-based mutation functions, six RLS-enabled tables and 30 seeded blueprint-derived rooms.
- **Not yet verified end-to-end:** real faculty booking, student-profile access checks, admin approval UI, official student dataset import.
- **Spatial accuracy:** current floor view is schematic, not an accurate tracing of the organizer's architecture diagrams.
- **Timetable model:** regular recurring lecture imports and automatic semester optimization are not implemented.
- Demo bookings are intentionally nonpersistent and must never be represented as official university data.

The hackathon cutoff and all requirements are detailed in [docs/README.md](docs/README.md).
