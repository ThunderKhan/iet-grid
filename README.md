# IET Grid

**Intelligent campus classroom scheduling and room booking** for DDUGU's Institute of Engineering & Technology and Deeksha Bhawan.

- **Live app:** https://iet-grid.vercel.app/
- **GitHub repository:** https://github.com/ThunderKhan/iet-grid
- **Documentation hub:** [docs/README.md](docs/README.md)

## Repository layout

```text
iet-grid/
├── frontend/                     # React + Vite web application
│   ├── src/                      # App UI, scheduling utilities, Supabase client
│   ├── index.html
│   ├── package.json
│   ├── .env.example
│   └── vercel.json
├── backend/                      # Supabase/PostgreSQL backend
│   ├── README.md
│   └── supabase/
│       └── migrations/
│           ├── 001_iet_grid.sql
│           └── 002_security_hardening.sql
├── docs/                         # Product specs and implementation decisions
│   ├── README.md
│   ├── MVP.md
│   ├── PRD.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── ...                       # Architecture, design, decisions, testing
├── LICENSE
└── README.md
```

**Backend note:** Supabase Auth, managed PostgreSQL, Row Level Security and server-side SQL functions are the backend. There is no separately deployed Node/FastAPI server in the MVP. Moving files does **not** create a second backend process; the live database was not modified during this reorganization.

## Local development

Requires Node.js and a dedicated IET Grid Supabase project.

```bash
git clone https://github.com/ThunderKhan/iet-grid.git
cd iet-grid/frontend
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `frontend/.env.local` using the Supabase project's **public publishable key** and URL. Never commit secrets or use a service-role key in the frontend.

```bash
cd frontend
npm run build
npm run preview
```

### Backend schema

See [backend/README.md](backend/README.md). The schema is under [backend/supabase/migrations/](backend/supabase/migrations/). Run those files in order **only when provisioning a fresh dedicated database**; the migrations are already applied to the connected IET Grid project. Never blindly reapply schema creation to an existing database.

### Deployment

Vercel project settings:
- **Root Directory:** `frontend`
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public values only)

Pushing `main` triggers frontend deployment. SQL changes in `backend/` are **not automatically applied** and require reviewed migrations.

## Product documentation

| File | Purpose |
| --- | --- |
| [MVP](docs/MVP.md) | Hackathon scope, critical flow, explicit cuts |
| [PRD](docs/PRD.md) | Product requirements and acceptance criteria |
| [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) | Prioritized implementation and verification |
| [Decision Log](docs/DECISIONS.md) | Product and technical decisions |
| [Architecture](docs/ARCHITECTURE.md) | Application/backend interaction and data design |
| [System](docs/SYSTEM.md) | Core constraints and backend invariants |
| [Design](docs/DESIGN.md) | Unified design language and spatial/calendar UX |
| [Requirements Traceability](docs/REQUIREMENTS_TRACEABILITY.md) | Organizer requirements and status |
| [Test Plan](docs/TEST_PLAN.md) | Acceptance verification |
 
## Current limitations

The room explorer uses **schematic**, not architecturally exact floor polygons. Some capacities and lab designations are unverified. The organizer's student/batch dataset and recurring lecture timetables have not yet been imported. Production role verification and real booking workflows need end-to-end user testing. Demo reservations are labeled and not persisted to Supabase.

See [docs/README.md](docs/README.md) for current status and the hackathon deadline.
