# IET Grid

**Intelligent Campus Scheduling & Classroom Management** — Institute of Engineering & Technology, Deen Dayal Upadhyaya Gorakhpur University.

| Resource | Link |
| --- | --- |
| Live frontend | https://iet-grid.vercel.app |
| Live backend | https://iet-grid-api.vercel.app |
| Backend health | https://iet-grid-api.vercel.app/health |
| Trusted admin bootstrap and acceptance | [backend/BOOTSTRAP_AND_ACCEPTANCE.md](backend/BOOTSTRAP_AND_ACCEPTANCE.md) |
| Interactive API reference | https://iet-grid-api.vercel.app/api/docs |
| Documentation hub | [docs/README.md](docs/README.md) |
| Backend implementation record | [docs/BACKEND_IMPLEMENTATION.md](docs/BACKEND_IMPLEMENTATION.md) |

## Architecture

~~~text
iet-grid/
├── frontend/       React + Vite dashboard, spatial map and calendar
│   ├── src/
│   ├── .env.example
│   └── package.json
├── backend/        Separately deployed FastAPI + Supabase/Postgres server logic
│   ├── app/core/   Auth, security and Supabase gateway
│   ├── app/modules/ Campus, academics, bookings, recommendations and notices
│   ├── supabase/migrations/ 001–013 (all restored and versioned)
│   ├── tests/      Pytest + SQL rollback test
│   ├── main.py
│   └── requirements.txt
├── docs/           PRD, MVP, decisions, architecture and test plan
└── .github/workflows/backend-tests.yml
~~~

## Run the frontend

~~~bash
cd frontend
npm install
npm run dev
~~~

Open **http://localhost:5123/**. Development uses the dedicated project's public Supabase credentials in `frontend/.env.development`, and the local API at `http://localhost:8000`. If `frontend/.env.local` exists, it overrides these values and must be updated. **Never put secret/service-role keys in Vite variables.** The main application requires actual Supabase login; there is no guest/demo data mode. For detailed PowerShell commands and Auth redirect setup, see [frontend/README.md](frontend/README.md).

## Run the backend

~~~bash
cd backend
python -m venv .venv
# Activate venv (PowerShell: .venv\Scripts\Activate.ps1)
python -m pip install -r requirements.txt
# Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in your shell
uvicorn main:app --reload --port 8000
~~~

Backend configuration is read from environment variables. Copying .env.example alone does not load values automatically. Database migrations reside in [backend/supabase/migrations](backend/supabase/migrations); they are **already applied** to the dedicated IET Grid Supabase project. Review carefully before using on a fresh project; do not re-run initial create-table SQL on an existing schema.

## Backend capabilities

Twenty RLS-protected public tables model buildings, floors, rooms, students/cohorts, regular sessions, bookings, notices and auditing. Room, faculty and cohort allocation constraints prohibit overlapping confirmed commitments. FastAPI provides authenticated endpoints for availability, alternative-room rankings, idempotent bookings, approvals, recurring sessions, validated cohort CSV imports, and in-app notifications.

**Current limitations:** Official student-level datasets and timetable records have not been imported; floor maps are simplified representations of the supplied architecture and do not certify room capacity. Human end-to-end Auth/role/booking tests remain outstanding. The application does not invent bookings or occupants when the live database is empty. Full automatic semester timetable generation is a future milestone.

## Documentation

[MVP](docs/MVP.md) · [PRD](docs/PRD.md) · [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) · [Decisions](docs/DECISIONS.md) · [Architecture](docs/ARCHITECTURE.md) · [Backend Implementation](docs/BACKEND_IMPLEMENTATION.md) · [System](docs/SYSTEM.md) · [Design](docs/DESIGN.md) · [Test Plan](docs/TEST_PLAN.md) · [Requirement Traceability](docs/REQUIREMENTS_TRACEABILITY.md)

**Submission:** 5 November 2026, 21:00 IST — public app, GitHub link, and Word written solution. Deployment READY does not by itself establish production correctness.

## Project team

- **Ayan Khan** — [@ThunderKhan](https://github.com/ThunderKhan)
- **Shreydhar Dubey** — Team member
- **Vivek Shukla** — Team member
