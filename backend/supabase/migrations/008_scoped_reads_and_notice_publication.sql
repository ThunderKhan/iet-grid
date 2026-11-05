-- Tighten private booking detail reads and announcement publication scope.
alter table public.academic_cohorts add column if not exists home_building text
 references public.buildings(code) default 'IET';
drop policy if exists bookings_read_scoped on public.bookings;
create policy bookings_read_scoped on public.bookings for select to authenticated using(
 created_by=(select auth.uid())
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.verified and p.role='admin')
 or exists(select 1 from public.profiles p
   join public.coordinator_scopes s on s.user_id=p.id
   join public.rooms r on r.building=s.building_code
   where p.id=(select auth.uid()) and p.verified and p.role='coordinator' and r.id=bookings.room_id)
 or (cohort_id is not null and exists(
   select 1 from public.student_memberships m
   where m.user_id=(select auth.uid()) and m.cohort_id=bookings.cohort_id and m.verified and m.active))
 or (cohort_id is not null and exists(
   select 1 from public.teaching_assignments t
   join public.profiles p on p.id=t.faculty_id
   where t.faculty_id=(select auth.uid()) and p.verified and p.role='faculty'
   and t.cohort_id=bookings.cohort_id))
);
drop policy if exists announcements_read_scoped on public.announcements;
create policy announcements_read_scoped on public.announcements for select to authenticated using(
 cohort_id is null
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.verified and p.role='admin')
 or exists(select 1 from public.profiles p join public.coordinator_scopes s on s.user_id=p.id
   join public.academic_cohorts c on c.home_building=s.building_code
   where p.id=(select auth.uid()) and p.verified and p.role='coordinator'
   and c.id=announcements.cohort_id)
 or exists(select 1 from public.teaching_assignments t
   join public.profiles p on p.id=t.faculty_id
   where t.faculty_id=(select auth.uid()) and p.verified and p.role='faculty'
   and t.cohort_id=announcements.cohort_id)
 or exists(select 1 from public.student_memberships m
   where m.user_id=(select auth.uid()) and m.cohort_id=announcements.cohort_id and m.verified and m.active)
);
-- All read acknowledgements must use the guarded RPC, not a direct insert.
revoke insert on public.announcement_reads from anon,authenticated;
drop policy if exists reads_insert_self on public.announcement_reads;
create or replace function public.publish_targeted_notice(
 p_title text,p_body text,p_priority text default 'normal',p_cohort_id uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text;v_verified boolean;v_id uuid;v_home text;
begin
 select role,verified into v_role,v_verified from public.profiles where id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('coordinator','admin')
 then raise exception 'FORBIDDEN: Staff cannot publish academic notices' using errcode='42501';end if;
 if char_length(trim(coalesce(p_title,''))) not between 3 and 180
 or char_length(coalesce(p_body,''))>5000 or p_priority not in ('normal','high')
 then raise exception 'INVALID_NOTICE' using errcode='22023';end if;
 if p_cohort_id is not null then
  select home_building into v_home from public.academic_cohorts
  where id=p_cohort_id and active;
  if v_home is null then raise exception 'INVALID_COHORT' using errcode='22023';end if;
 end if;
 if v_role='coordinator' and (
   p_cohort_id is null or not exists(select 1 from public.coordinator_scopes
    where user_id=auth.uid() and building_code=v_home))
 then raise exception 'FORBIDDEN: Coordinator must target a cohort in their delegated building' using errcode='42501';end if;
 insert into public.announcements(title,body,priority,cohort_id,created_by)
 values(trim(p_title),coalesce(p_body,''),p_priority,p_cohort_id,auth.uid())
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.publish_targeted_notice(text,text,text,uuid) from public,anon;
grant execute on function public.publish_targeted_notice(text,text,text,uuid) to authenticated;
