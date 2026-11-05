# IET Grid — SYSTEM.md

## Architecture
React + Vite UI, Supabase Auth, PostgreSQL with RLS and server-validated booking RPC, Vercel static hosting.

## Security
Default new accounts to unverified student. Admin verification must happen in a privileged administrative process. Only verified faculty/coordinators/admins can book. Confirmed reservations protected from time overlap by PostgreSQL GiST exclusion constraint. Sensitive mutation RPCs check role inside database. Do not expose service-role keys.

## Booking engine
Availability searches by room, date, time and capacity. Deterministic ranking penalizes excess capacity and cross-building travel. Database is the final authority. Exams and events are pending approval.

## Data caveats
Official student dataset is not yet imported. Capacities marked unverified are estimates. Blueprint shows LH13/LH14 and IET23, despite discrepancies in textual inventory. Floor UI is currently schematic, not yet an architecturally accurate SVG trace. Demo-mode data is nonpersistent.

## Deferred
Automatic semester scheduling, full timetable import, granular scope delegation, verified student section mapping, and full issue management.
