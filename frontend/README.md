# IET Grid Frontend

React 19 + Vite 6 application deployed to Vercel from this directory.

## Run locally

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the **IET Grid** project's URL and public publishable key (never a service-role key).

```bash
npm run build
npm run preview
```

## Integration

- The frontend uses the public Supabase client in `src/supabase.js`.
- The persisted backend logic and migrations live in `../backend/supabase/migrations/`.
- If Supabase is unconfigured, the app offers an **explicitly labeled demonstration**, with nonpersistent sample data.
- The map is currently schematic; the university-provided original blueprint and official student records need fuller integration.

Vercel project settings must use **Root Directory: `frontend`**, framework **Vite**, build `npm run build`, and output `dist`.
