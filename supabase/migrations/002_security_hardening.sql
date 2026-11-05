-- Supabase security advisor hardening after initial schema
create schema if not exists extensions;
alter extension btree_gist set schema extensions;
revoke all on function public.iet_grid_audit() from public, anon, authenticated;
revoke all on function public.iet_grid_profile() from public, anon, authenticated;
