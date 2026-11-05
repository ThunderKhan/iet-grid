-- IET Grid Phase 2b: atomic CSV cohort import and in-app read acknowledgement.
create or replace function public.import_academic_cohorts(p_rows jsonb)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row jsonb;v_n integer:=0;v_code text;v_branch text;v_year integer;v_section text;v_batch integer;v_size integer;
begin
 if not public.iet_admin_ok() then raise exception 'FORBIDDEN: Admin required' using errcode='42501';end if;
 if jsonb_typeof(p_rows)!='array' or jsonb_array_length(p_rows) not between 1 and 500 then
  raise exception 'INVALID_IMPORT: Need 1-500 cohort rows' using errcode='22023';end if;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  v_code:=upper(trim(v_row->>'code'));v_branch:=upper(trim(v_row->>'branch'));
  v_year:=(v_row->>'academic_year')::integer;
  v_section:=upper(trim(v_row->>'section'));
  v_batch:=(v_row->>'batch_start')::integer;
  v_size:=nullif(v_row->>'expected_size','')::integer;
  if v_code !~ '^[A-Z0-9_-]{2,32}$'
   or v_branch !~ '^[A-Z0-9/+-]{2,20}$'
   or v_section !~ '^[A-Z0-9_-]{1,10}$'
   or v_year not between 1 and 6 or v_batch not between 2000 and 2100
   or (v_size is not null and v_size<1)
  then raise exception 'INVALID_IMPORT_ROW: Invalid cohort record' using errcode='22023';end if;
  insert into public.academic_cohorts(code,branch,academic_year,section,batch_start,expected_size)
  values(v_code,v_branch,v_year,v_section,v_batch,v_size)
  on conflict(code) do update set branch=excluded.branch,academic_year=excluded.academic_year,
   section=excluded.section,batch_start=excluded.batch_start,expected_size=excluded.expected_size;
  v_n:=v_n+1;
 end loop;
 return v_n;
end $$;

create or replace function public.upsert_iet_course(p_code text,p_name text,p_branch text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if not public.iet_admin_ok() then raise exception 'FORBIDDEN: Admin required' using errcode='42501';end if;
 if length(trim(p_code)) not between 2 and 30 or length(trim(p_name)) not between 3 and 180
 then raise exception 'INVALID_COURSE' using errcode='22023';end if;
 insert into public.courses(code,name,branch) values(upper(trim(p_code)),trim(p_name),p_branch)
 on conflict(code) do update set name=excluded.name,branch=excluded.branch returning id into v_id;
 return v_id;
end $$;

create or replace function public.assign_faculty_to_cohort(p_faculty_id uuid,p_cohort_id uuid,p_course_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.iet_admin_ok() then raise exception 'FORBIDDEN: Admin required' using errcode='42501';end if;
 if not exists(select 1 from public.profiles where id=p_faculty_id and verified and role='faculty')
 then raise exception 'INVALID_FACULTY' using errcode='22023';end if;
 insert into public.teaching_assignments(faculty_id,cohort_id,course_id)
 values(p_faculty_id,p_cohort_id,p_course_id) on conflict do nothing;
end $$;

create or replace function public.mark_announcement_read(p_announcement_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_cohort uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 select cohort_id into v_cohort from public.announcements where id=p_announcement_id;
 if not found then raise exception 'NOT_FOUND: Announcement missing' using errcode='22023';end if;
 if v_cohort is not null
  and not exists(select 1 from public.profiles where id=auth.uid() and role in ('faculty','coordinator','admin') and verified)
  and not exists(select 1 from public.student_memberships
    where user_id=auth.uid() and cohort_id=v_cohort and active and verified)
 then raise exception 'FORBIDDEN: Announcement not addressed to you' using errcode='42501';end if;
 insert into public.announcement_reads(announcement_id,user_id)
 values(p_announcement_id,auth.uid())
 on conflict(announcement_id,user_id) do update set read_at=now();
end $$;

revoke all on function public.import_academic_cohorts(jsonb) from public,anon;
revoke all on function public.upsert_iet_course(text,text,text) from public,anon;
revoke all on function public.assign_faculty_to_cohort(uuid,uuid,uuid) from public,anon;
revoke all on function public.mark_announcement_read(uuid) from public,anon;
grant execute on function public.import_academic_cohorts(jsonb),
 public.upsert_iet_course(text,text,text),
 public.assign_faculty_to_cohort(uuid,uuid,uuid),
 public.mark_announcement_read(uuid) to authenticated;

-- Reduce inference of staff/student identities through the allocation tables.
drop policy if exists faculty_availability_read on public.faculty_allocations;
create policy faculty_availability_read_staff on public.faculty_allocations
 for select to authenticated using(
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.verified and p.role in ('faculty','coordinator','admin'))
 );
drop policy if exists cohort_availability_read on public.cohort_allocations;
create policy cohort_availability_read_staff on public.cohort_allocations
 for select to authenticated using(
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.verified and p.role in ('faculty','coordinator','admin'))
 );
