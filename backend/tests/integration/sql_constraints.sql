-- Safe, transactional PostgreSQL smoke test for Supabase SQL Editor.
-- The entire operation is rolled back. Do NOT run against unrelated projects.
begin;
do $$
declare s timestamptz:=date_trunc('hour',now())+interval '3 days';
 c uuid;b uuid;
begin
 insert into public.academic_cohorts(code,branch,academic_year,section,batch_start)
 values('TEST-ROLLBACK-COHORT','CSE',2,'A',2025) returning id into c;
 insert into public.academic_sessions(room_id,cohort_id,title,starts_at,ends_at)
 values('IET18',c,'Temporary normal lecture',s,s+interval '1 hour');
 begin
  insert into public.bookings(room_id,title,kind,starts_at,ends_at,status)
  values('IET18','Conflicting booking','lecture',s+interval '15 minutes',s+interval '45 minutes','confirmed');
  raise exception 'FAIL: room overlap was not rejected';
 exception when exclusion_violation then null; end;
 begin
  insert into public.academic_sessions(room_id,cohort_id,title,starts_at,ends_at)
  values('IET19',c,'Cohort conflict',s,s+interval '1 hour');
  raise exception 'FAIL: cohort overlap was not rejected';
 exception when exclusion_violation then null; end;
 insert into public.bookings(room_id,title,kind,starts_at,ends_at,status)
 values('IET18','Adjacent booking allowed','lecture',s+interval '1 hour',s+interval '2 hours','confirmed');
 insert into public.bookings(room_id,title,kind,starts_at,ends_at,status)
 values('IET18','Pending exam','exam',s,s+interval '1 hour','pending') returning id into b;
 begin
  update public.bookings set status='confirmed' where id=b;
  raise exception 'FAIL: conflicting approval was allowed';
 exception when exclusion_violation then null; end;
 raise notice 'PASS room/cohort conflict, pending approval race, adjacent slots';
end $$;
rollback;
