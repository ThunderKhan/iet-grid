# IET Grid

Intelligent campus classroom scheduling and room booking for DDUGU IET and Deeksha Bhawan.

## Run

1. npm install
2. Copy .env.example to .env.local
3. Create a **dedicated** Supabase project and run supabase/migrations/001_iet_grid.sql in its SQL editor.
4. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (publishable key only).
5. npm run dev

Demo mode is intentionally labeled and uses local sample data only. Real faculty bookings require verified faculty accounts. Grant roles via a trusted administrator process, not user-signup metadata.

## Scope
React + Vite + Supabase + PostgreSQL. Features include two-building room explorer, calendar, booking conflict prevention, capacity-aware recommendations, announcement list, basic report action, and role-separated permissions.

**Limitations:** This is a hackathon MVP. Campus floor views are schematic, not precise architectural drawings. Some capacities and lab identifiers are unverified; student dataset and official timetables still require import. Semester optimizer deferred.

See docs/SYSTEM.md and docs/DESIGN.md.
