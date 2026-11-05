-- IET Grid Phase 1: canonical occupancy and academic data model.
-- Additive migration: preserves existing rooms/bookings/profiles and demo infrastructure.
create table public.buildings (
  code text primary key,
  name text not null,
  active boolean not null default true
);
insert into public.buildings(code,name) values
('IET','Institute of Engineering and Technology'),('DEEK','Deeksha Bhawan')
on conflict(code) do update set name=excluded.name;

create table public.floors(
 id uuid primary key default gen_random_uuid(),
 building_code text not null references public.buildings(code),
 label text not null, level_number int not null,
 unique(building_code,label),unique(building_code,level_number)
);
insert into public.floors(building_code,label,level_number) values
('IET','Ground',0),('IET','First',1),('IET','Second',2),
('DEEK','Ground',0),('DEEK','First',1) on conflict(building_code,label) do nothing;
alter table public.rooms add column if not exists restricted boolean not null default false;
alter table public.rooms add column if not exists equipment text[] not null default '{}';
alter table public.rooms add column if not exists accessible boolean;
alter table public.rooms add constraint rooms_floor_reference
 foreign key(building,floor) references public.floors(building_code,label) not valid;
alter table public.rooms validate constraint rooms_floor_reference;

create table public.academic_cohorts(
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 branch text not null,academic_year int not null check(academic_year between 1 and 6),
 section text not null,batch_start int not null check(batch_start between 2000 and 2100),
 expected_size int check(expected_size>0),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.student_memberships(
 user_id uuid not null references public.profiles(id) on delete cascade,
 cohort_id uuid not null references public.academic_cohorts(id) on delete cascade,
 verified boolean not null default false,active boolean not null default true,
 primary key(user_id,cohort_id)
);
create table public.courses(
 id uuid primary key default gen_random_uuid(),
 code text not null unique,name text not null,branch text
);
create table public.teaching_assignments(
 faculty_id uuid not null references public.profiles(id),
 cohort_id uuid not null references public.academic_cohorts(id),
 course_id uuid not null references public.courses(id),
 primary key(faculty_id,cohort_id,course_id)
);
create table public.coordinator_scopes(
 user_id uuid not null references public.profiles(id) on delete cascade,
 building_code text not null references public.buildings(code),
 primary key(user_id,building_code)
);
alter table public.bookings add column if not exists cohort_id uuid references public.academic_cohorts(id);
alter table public.bookings add column if not exists idempotency_key uuid;
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings add column if not exists cancellation_reason text;
create unique index bookings_idempotency_unique
 on public.bookings(created_by,idempotency_key) where idempotency_key is not null;

create table public.academic_series(
 id uuid primary key default gen_random_uuid(),
 title text not null,
 room_id text not null references public.rooms(id),
 cohort_id uuid references public.academic_cohorts(id),
 faculty_id uuid references public.profiles(id),
 course_id uuid references public.courses(id),
 weekday int not null check(weekday between 1 and 7),
 from_date date not null,to_date date not null,
 local_start time not null,local_end time not null,
 time_zone text not null default 'Asia/Kolkata' check(time_zone='Asia/Kolkata'),
 status text not null default 'draft' check(status in ('draft','published','cancelled')),
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 check(to_date>=from_date),check(local_end>local_start)
);
create table public.academic_sessions(
 id uuid primary key default gen_random_uuid(),
 series_id uuid references public.academic_series(id),
 room_id text not null references public.rooms(id),
 cohort_id uuid references public.academic_cohorts(id),
 faculty_id uuid references public.profiles(id),
 course_id uuid references public.courses(id),
 title text not null,
 starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 check(ends_at>starts_at),
 unique(series_id,starts_at)
);
create table public.room_blocks(
 id uuid primary key default gen_random_uuid(),
 room_id text not null references public.rooms(id),
 starts_at timestamptz not null,ends_at timestamptz not null,
 reason text not null,status text not null default 'active' check(status in ('active','cancelled')),
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
-- Only this table defines room occupancy. Source rows are synced transactionally.
create table public.room_allocations(
 id uuid primary key default gen_random_uuid(),
 room_id text not null references public.rooms(id),
 source_type text not null check(source_type in ('booking','academic','block')),
 source_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,
 created_at timestamptz not null default now(),
 unique(source_type,source_id),
 check(ends_at>starts_at),
 constraint no_room_allocation_overlap exclude using gist
 (room_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
);
create index room_allocations_time_idx on public.room_allocations(starts_at,ends_at);
create index academic_sessions_cohort_time on public.academic_sessions(cohort_id,starts_at);

create or replace function public.sync_iet_grid_allocation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_type text;v_active boolean;
begin
 v_type:=case TG_TABLE_NAME when 'bookings' then 'booking' when 'academic_sessions' then 'academic' else 'block' end;
 if TG_OP='DELETE' then
  delete from public.room_allocations where source_type=v_type and source_id=old.id;
  return old;
 end if;
 v_active:=case v_type
   when 'booking' then new.status='confirmed'
   when 'academic' then new.status='scheduled'
   else new.status='active' end;
 if v_active then
  insert into public.room_allocations(room_id,source_type,source_id,starts_at,ends_at)
  values(new.room_id,v_type,new.id,new.starts_at,new.ends_at)
  on conflict(source_type,source_id) do update set
   room_id=excluded.room_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at;
 else
  delete from public.room_allocations where source_type=v_type and source_id=new.id;
 end if;
 return new;
end $$;
revoke all on function public.sync_iet_grid_allocation() from public,anon,authenticated;
create trigger iet_grid_sync_bookings after insert or update or delete on public.bookings
 for each row execute function public.sync_iet_grid_allocation();
create trigger iet_grid_sync_sessions after insert or update or delete on public.academic_sessions
 for each row execute function public.sync_iet_grid_allocation();
create trigger iet_grid_sync_blocks after insert or update or delete on public.room_blocks
 for each row execute function public.sync_iet_grid_allocation();
-- Backfill any confirmed bookings from existing deployments.
insert into public.room_allocations(room_id,source_type,source_id,starts_at,ends_at)
select room_id,'booking',id,starts_at,ends_at from public.bookings where status='confirmed'
on conflict(source_type,source_id) do nothing;

alter table public.announcements add column if not exists cohort_id uuid references public.academic_cohorts(id);
create table public.announcement_reads(
 announcement_id uuid not null references public.announcements(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 read_at timestamptz not null default now(),primary key(announcement_id,user_id)
);

-- Restrictive access by default; a public API key never confers table write permission.
do $pol$
declare t text;
begin
 foreach t in array array['buildings','floors','academic_cohorts','student_memberships',
 'courses','teaching_assignments','coordinator_scopes','academic_series','academic_sessions',
 'room_blocks','room_allocations','announcement_reads'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $pol$;

create policy buildings_read on public.buildings for select to authenticated using(true);
create policy floors_read on public.floors for select to authenticated using(true);
create policy rooms_allocations_read on public.room_allocations for select to authenticated using(true);
create policy courses_read on public.courses for select to authenticated using(true);
create policy cohorts_read on public.academic_cohorts for select to authenticated using(true);
create policy memberships_read_self on public.student_memberships for select to authenticated
 using(user_id=(select auth.uid()));
create policy assignments_read_self on public.teaching_assignments for select to authenticated
 using(faculty_id=(select auth.uid()));
create policy coordinator_scopes_read_self on public.coordinator_scopes for select to authenticated
 using(user_id=(select auth.uid()));
create policy sessions_read on public.academic_sessions for select to authenticated
 using(cohort_id is null or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.verified and p.role in ('faculty','coordinator','admin'))
 or exists(select 1 from public.student_memberships m where m.cohort_id=academic_sessions.cohort_id and m.user_id=(select auth.uid()) and m.active and m.verified));
create policy series_read_staff on public.academic_series for select to authenticated
 using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.verified and p.role in ('faculty','coordinator','admin')));
create policy blocks_read on public.room_blocks for select to authenticated using(true);
create policy reads_read_self on public.announcement_reads for select to authenticated using(user_id=(select auth.uid()));
create policy reads_insert_self on public.announcement_reads for insert to authenticated with check(user_id=(select auth.uid()));
-- Remove overly broad original booking/announcement policies.
drop policy if exists bookings_signed_in on public.bookings;
create policy bookings_read_scoped on public.bookings for select to authenticated
 using(
   created_by=(select auth.uid())
   or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.verified and p.role in ('faculty','coordinator','admin'))
   or (cohort_id is not null and exists(select 1 from public.student_memberships m where m.cohort_id=bookings.cohort_id and m.user_id=(select auth.uid()) and m.verified and m.active))
 );
drop policy if exists announcements_signed_in on public.announcements;
create policy announcements_read_scoped on public.announcements for select to authenticated
 using(cohort_id is null
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.verified and p.role in ('faculty','coordinator','admin'))
 or exists(select 1 from public.student_memberships m where m.cohort_id=announcements.cohort_id and m.user_id=(select auth.uid()) and m.verified and m.active));

-- Explicit table grants are still needed even when RLS is enabled.
grant select on public.buildings,public.floors,public.academic_cohorts,public.courses,
 public.student_memberships,public.teaching_assignments,public.coordinator_scopes,
 public.academic_series,public.academic_sessions,public.room_blocks,public.room_allocations,public.announcement_reads to authenticated;
grant insert on public.announcement_reads to authenticated;
revoke insert,update,delete on public.academic_cohorts,public.courses,public.student_memberships,
 public.teaching_assignments,public.coordinator_scopes,public.academic_series,public.academic_sessions,
 public.room_blocks,public.room_allocations from anon,authenticated;
