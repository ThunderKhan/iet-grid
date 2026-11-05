-- IET Grid Phase 2: administrator provisioning, academic sessions, recurrence and notices.
create or replace function public.iet_admin_ok() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(exists(select 1 from public.profiles
 where id=auth.uid() and role='admin' and verified),false)
$$;
revoke all on function public.iet_admin_ok() from public,anon;
grant execute on function public.iet_admin_ok() to authenticated;

create or replace function public.provision_campus_user(p_user_id uuid,p_role text,p_verified boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.iet_admin_ok() then raise exception 'FORBIDDEN: University admin required' using errcode='42501';end if;
 if p_role not in ('student','faculty','coordinator','admin') then raise exception 'INVALID_ROLE' using errcode='22023';end if;
 update public.profiles set role=p_role,verified=p_verified where id=p_user_id;
 if not found then raise exception 'NOT_FOUND: User does not exist' using errcode='22023';end if;
end $$;

create or replace function public.assign_coordinator_building(p_user_id uuid,p_building text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.iet_admin_ok() then raise exception 'FORBIDDEN: Admin required' using errcode='42501';end if;
 if not exists(select 1 from public.profiles where id=p_user_id and role='coordinator' and verified)
 then raise exception 'INVALID_ROLE: Target must be verified coordinator' using errcode='22023';end if;
 insert into public.coordinator_scopes(user_id,building_code) values(p_user_id,p_building)
 on conflict do nothing;
end $$;

create or replace function public.upsert_academic_cohort(
 p_code text,p_branch text,p_academic_year integer,p_section text,
 p_batch_start integer,p_expected_size integer default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if not public.iet_admin_ok() then raise exception 'FORBIDDEN: Admin required' using errcode='42501';end if;
 if p_code !~ '^[A-Za-z0-9_-]{2,32}$' or p_branch !~ '^[A-Za-z0-9/+-]{2,20}$'
 or p_section !~ '^[A-Za-z0-9_-]{1,10}$'
 or p_academic_year not between 1 and 6 or p_batch_start not between 2000 and 2100
 or (p_expected_size is not null and p_expected_size<1)
 then raise exception 'INVALID_COHORT: Validate code, branch, year, section, batch, size' using errcode='22023';end if;
 insert into public.academic_cohorts(code,branch,academic_year,section,batch_start,expected_size)
 values(upper(p_code),upper(p_branch),p_academic_year,upper(p_section),p_batch_start,p_expected_size)
 on conflict(code) do update set branch=excluded.branch,academic_year=excluded.academic_year,
 section=excluded.section,batch_start=excluded.batch_start,expected_size=excluded.expected_size
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.enroll_verified_student(p_user_id uuid,p_cohort_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.iet_admin_ok() then raise exception 'FORBIDDEN: Admin required' using errcode='42501';end if;
 if not exists(select 1 from public.academic_cohorts where id=p_cohort_id and active)
 then raise exception 'INVALID_COHORT' using errcode='22023';end if;
 if not exists(select 1 from public.profiles where id=p_user_id and role='student')
 then raise exception 'INVALID_STUDENT: Existing student profile required' using errcode='22023';end if;
 insert into public.student_memberships(user_id,cohort_id,verified,active)
 values(p_user_id,p_cohort_id,true,true)
 on conflict(user_id,cohort_id) do update set verified=true,active=true;
 update public.profiles set verified=true where id=p_user_id;
end $$;

create or replace function public.create_academic_session(
 p_title text,p_room_id text,p_starts_at timestamptz,p_ends_at timestamptz,
 p_cohort_id uuid default null,p_faculty_id uuid default null,p_course_id uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text;v_verified boolean;v_building text;v_id uuid;
begin
 select role,verified into v_role,v_verified from public.profiles where id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('coordinator','admin')
 then raise exception 'FORBIDDEN: Administrator/coordinator required' using errcode='42501';end if;
 select building into v_building from public.rooms where id=p_room_id and active;
 if v_building is null then raise exception 'NOT_FOUND: Room unavailable' using errcode='22023';end if;
 if v_role='coordinator' and not exists(select 1 from public.coordinator_scopes
 where user_id=auth.uid() and building_code=v_building)
 then raise exception 'FORBIDDEN: Outside building scope' using errcode='42501';end if;
 if p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at
  or p_ends_at>p_starts_at+interval '8 hours'
  or p_starts_at<now()-interval '1 day'
 then raise exception 'INVALID_TIME: Session interval invalid' using errcode='22023';end if;
 if length(trim(coalesce(p_title,''))) not between 3 and 180
 then raise exception 'INVALID_TITLE' using errcode='22023';end if;
 insert into public.academic_sessions(title,room_id,starts_at,ends_at,cohort_id,faculty_id,course_id,created_by)
 values(trim(p_title),p_room_id,p_starts_at,p_ends_at,p_cohort_id,p_faculty_id,p_course_id,auth.uid())
 returning id into v_id;
 return v_id;
exception when exclusion_violation then
 raise exception 'SCHEDULE_CONFLICT: Room, faculty or cohort is occupied' using errcode='23P01';
end $$;

create or replace function public.cancel_academic_session(p_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text;v_verified boolean;v_building text;
begin
 select role,verified into v_role,v_verified from public.profiles where id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('coordinator','admin')
 then raise exception 'FORBIDDEN: Admin required' using errcode='42501';end if;
 select r.building into v_building from public.academic_sessions s join public.rooms r on r.id=s.room_id
 where s.id=p_id and s.status='scheduled' for update of s;
 if v_building is null then raise exception 'NOT_FOUND: Scheduled session missing' using errcode='22023';end if;
 if v_role='coordinator' and not exists(select 1 from public.coordinator_scopes
 where user_id=auth.uid() and building_code=v_building)
 then raise exception 'FORBIDDEN: Outside building scope' using errcode='42501';end if;
 update public.academic_sessions set status='cancelled' where id=p_id;
end $$;

create or replace function public.create_room_block(
 p_room_id text,p_starts_at timestamptz,p_ends_at timestamptz,p_reason text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text;v_verified boolean;v_building text;v_id uuid;
begin
 select role,verified into v_role,v_verified from public.profiles where id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('coordinator','admin')
 then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select building into v_building from public.rooms where id=p_room_id;
 if v_building is null then raise exception 'NOT_FOUND' using errcode='22023';end if;
 if v_role='coordinator' and not exists(select 1 from public.coordinator_scopes
 where user_id=auth.uid() and building_code=v_building)
 then raise exception 'FORBIDDEN: Outside scope' using errcode='42501';end if;
 if p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at
  or p_ends_at>p_starts_at+interval '30 days'
  or trim(coalesce(p_reason,''))=''
 then raise exception 'INVALID_BLOCK' using errcode='22023';end if;
 insert into public.room_blocks(room_id,starts_at,ends_at,reason,created_by)
 values(p_room_id,p_starts_at,p_ends_at,left(trim(p_reason),500),auth.uid()) returning id into v_id;
 return v_id;
exception when exclusion_violation then
 raise exception 'ROOM_CONFLICT: Cannot block occupied room' using errcode='23P01';
end $$;

-- Semester pattern is a draft until reviewed and explicitly published.
create or replace function public.create_academic_series(
 p_title text,p_room_id text,p_weekday integer,p_from_date date,p_to_date date,
 p_local_start time,p_local_end time,
 p_cohort_id uuid default null,p_faculty_id uuid default null,p_course_id uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text;v_verified boolean;v_building text;v_id uuid;
begin
 select role,verified into v_role,v_verified from public.profiles where id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('coordinator','admin')
 then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select building into v_building from public.rooms where id=p_room_id and active;
 if v_building is null then raise exception 'NOT_FOUND: Room missing' using errcode='22023';end if;
 if v_role='coordinator' and not exists(select 1 from public.coordinator_scopes where user_id=auth.uid() and building_code=v_building)
 then raise exception 'FORBIDDEN: Outside scope' using errcode='42501';end if;
 if p_weekday not between 1 and 7 or p_to_date<p_from_date or p_to_date>p_from_date+180
 or p_local_start>=p_local_end or length(trim(p_title)) not between 3 and 180
 then raise exception 'INVALID_SERIES: Check recurrence dates/times' using errcode='22023';end if;
 insert into public.academic_series(title,room_id,weekday,from_date,to_date,local_start,local_end,
 cohort_id,faculty_id,course_id,created_by)
 values(trim(p_title),p_room_id,p_weekday,p_from_date,p_to_date,p_local_start,p_local_end,
 p_cohort_id,p_faculty_id,p_course_id,auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.publish_academic_series(p_series_id uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_series public.academic_series%rowtype;v_role text;v_verified boolean;v_building text;
 v_day date;v_start timestamptz;v_end timestamptz;v_count int:=0;
begin
 select role,verified into v_role,v_verified from public.profiles where id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('coordinator','admin')
 then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into v_series from public.academic_series where id=p_series_id for update;
 if not found or v_series.status!='draft' then raise exception 'INVALID_STATE: Draft not found' using errcode='22023';end if;
 select building into v_building from public.rooms where id=v_series.room_id;
 if v_role='coordinator' and not exists(select 1 from public.coordinator_scopes where user_id=auth.uid() and building_code=v_building)
 then raise exception 'FORBIDDEN: Outside scope' using errcode='42501';end if;
 v_day:=v_series.from_date;
 while v_day<=v_series.to_date loop
  if extract(isodow from v_day)::int=v_series.weekday then
   v_start:=(v_day+v_series.local_start) at time zone 'Asia/Kolkata';
   v_end:=(v_day+v_series.local_end) at time zone 'Asia/Kolkata';
   insert into public.academic_sessions(series_id,title,room_id,cohort_id,faculty_id,course_id,
     starts_at,ends_at,created_by)
   values(v_series.id,v_series.title,v_series.room_id,v_series.cohort_id,v_series.faculty_id,
     v_series.course_id,v_start,v_end,auth.uid());
   v_count:=v_count+1;
  end if;
  v_day:=v_day+1;
 end loop;
 update public.academic_series set status='published' where id=v_series.id;
 return v_count;
exception when exclusion_violation then
 raise exception 'SCHEDULE_CONFLICT: Publication rolled back because a room, faculty or cohort is occupied' using errcode='23P01';
end $$;

create or replace function public.publish_targeted_notice(
 p_title text,p_body text,p_priority text default 'normal',p_cohort_id uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text;v_verified boolean;v_id uuid;
begin
 select role,verified into v_role,v_verified from public.profiles where id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('coordinator','admin')
 then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if char_length(trim(coalesce(p_title,''))) not between 3 and 180
 or char_length(coalesce(p_body,''))>5000
 or p_priority not in ('normal','high')
 then raise exception 'INVALID_NOTICE' using errcode='22023';end if;
 if p_cohort_id is not null and not exists(select 1 from public.academic_cohorts where id=p_cohort_id and active)
 then raise exception 'INVALID_COHORT' using errcode='22023';end if;
 insert into public.announcements(title,body,priority,cohort_id,created_by)
 values(trim(p_title),coalesce(p_body,''),p_priority,p_cohort_id,auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.publish_campus_notice(p_title text,p_body text,p_priority text default 'normal')
returns uuid language sql security invoker set search_path=public,pg_temp as $$
 select public.publish_targeted_notice(p_title,p_body,p_priority,null);
$$;

revoke all on function public.iet_admin_ok() from public,anon;
revoke all on function public.provision_campus_user(uuid,text,boolean) from public,anon;
revoke all on function public.assign_coordinator_building(uuid,text) from public,anon;
revoke all on function public.upsert_academic_cohort(text,text,integer,text,integer,integer) from public,anon;
revoke all on function public.enroll_verified_student(uuid,uuid) from public,anon;
revoke all on function public.create_academic_session(text,text,timestamptz,timestamptz,uuid,uuid,uuid) from public,anon;
revoke all on function public.cancel_academic_session(uuid) from public,anon;
revoke all on function public.create_room_block(text,timestamptz,timestamptz,text) from public,anon;
revoke all on function public.create_academic_series(text,text,integer,date,date,time,time,uuid,uuid,uuid) from public,anon;
revoke all on function public.publish_academic_series(uuid) from public,anon;
revoke all on function public.publish_targeted_notice(text,text,text,uuid) from public,anon;
revoke all on function public.publish_campus_notice(text,text,text) from public,anon;
grant execute on function public.provision_campus_user(uuid,text,boolean),
 public.assign_coordinator_building(uuid,text),
 public.upsert_academic_cohort(text,text,integer,text,integer,integer),
 public.enroll_verified_student(uuid,uuid),
 public.create_academic_session(text,text,timestamptz,timestamptz,uuid,uuid,uuid),
 public.cancel_academic_session(uuid),
 public.create_room_block(text,timestamptz,timestamptz,text),
 public.create_academic_series(text,text,integer,date,date,time,time,uuid,uuid,uuid),
 public.publish_academic_series(uuid),
 public.publish_targeted_notice(text,text,text,uuid),
 public.publish_campus_notice(text,text,text) to authenticated;
-- Blank permissions for unauthenticated requests, even if metadata reveals RPC names.
