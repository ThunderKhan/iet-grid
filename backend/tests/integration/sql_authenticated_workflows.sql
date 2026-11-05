-- IET Grid SQL integration tests using transient Auth users and trusted JWT claims.
-- Execute ONLY in the dedicated IET Grid Supabase SQL Editor with privileged access.
-- The transaction ROLLS BACK ALL temporary users, memberships and bookings.
-- This simulates SQL-level authenticated identities, NOT real HTTP-issued JWTs.
-- Verify test UUIDs/emails do not already exist before running on any migrated DB.
begin;
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
('46bc1a32-b9bf-4ceb-b4b2-8c297c7e72b4','00000000-0000-0000-0000-000000000000','authenticated','authenticated','iet-grid-admin-sql@invalid.example',now(),now()),
('8d72b5fc-ad9b-463b-aa63-bfbb08b91d21','00000000-0000-0000-0000-000000000000','authenticated','authenticated','iet-grid-faculty-sql@invalid.example',now(),now()),
('35e46a5e-5b1f-470b-b49c-f1a4b948ff18','00000000-0000-0000-0000-000000000000','authenticated','authenticated','iet-grid-student-sql@invalid.example',now(),now());

-- Signup trigger must provision a default restricted profile.
do $$ begin
 if not exists(select 1 from public.profiles where id='35e46a5e-5b1f-470b-b49c-f1a4b948ff18'
   and role='student' and verified=false)
 then raise exception 'FAIL: default unverified student signup profile missing';end if;
end $$;
update public.profiles set role='admin',verified=true where id='46bc1a32-b9bf-4ceb-b4b2-8c297c7e72b4';
update public.profiles set role='faculty',verified=true where id='8d72b5fc-ad9b-463b-aa63-bfbb08b91d21';

-- This session now carries an authenticated role. The user UUID is stored in
-- request.jwt.claim.sub, just as Supabase PostgREST provides for real requests.
set local role authenticated;
select set_config('request.jwt.claim.sub','8d72b5fc-ad9b-463b-aa63-bfbb08b91d21',true);

do $test_faculty$
declare s timestamptz:=date_trunc('hour',now())+interval '2 days';
 id uuid; retry_id uuid; n integer;
begin
 id:=public.request_room_booking('IET18','Valid faculty lecture',s,s+interval '1 hour','lecture',75,
  '5b9e9b62-66e6-49ec-a06f-0c8eef3b9d18',null);
 retry_id:=public.request_room_booking('IET18','Valid faculty lecture',s,s+interval '1 hour','lecture',75,
  '5b9e9b62-66e6-49ec-a06f-0c8eef3b9d18',null);
 if id<>retry_id then raise exception 'FAIL: idempotency mismatched IDs';end if;
 select count(*) into n from public.room_allocations where source_type='booking' and source_id=id;
 if n<>1 then raise exception 'FAIL: missing canonical room occupancy';end if;
 begin
  perform public.request_room_booking('IET18','Overlapping request',
  s+interval '15 minutes',s+interval '45 minutes','lecture',75,gen_random_uuid(),null);
  raise exception 'FAIL: overlapping booking accepted';
 exception when exclusion_violation then null;end;
 perform set_config('request.jwt.claim.sub','35e46a5e-5b1f-470b-b49c-f1a4b948ff18',true);
 begin
  perform public.request_room_booking('IET19','Unauthorized student booking',
   s,s+interval '1 hour','lecture',75,gen_random_uuid(),null);
  raise exception 'FAIL: student booking accepted';
 exception when insufficient_privilege then null;end;
 if exists(select 1 from public.bookings where public.bookings.id=id)
 then raise exception 'FAIL: student saw faculty-only booking';end if;
 perform set_config('request.jwt.claim.sub','8d72b5fc-ad9b-463b-aa63-bfbb08b91d21',true);
 perform public.cancel_room_booking(id,'Transient SQL integration test');
 if exists(select 1 from public.room_allocations where source_id=id)
 then raise exception 'FAIL: cancellation did not release occupancy';end if;
 raise notice 'PASS: faculty booking, idempotency, conflict, student denial, cancellation';
end $test_faculty$;

select set_config('request.jwt.claim.sub','46bc1a32-b9bf-4ceb-b4b2-8c297c7e72b4',true);
do $test_academics$
declare cohort uuid; series uuid; note uuid; booking uuid;
 occurrences integer;
 d date:=current_date+1;
 s timestamptz:=date_trunc('hour',now())+interval '3 days';
begin
 cohort:=public.upsert_academic_cohort('TEST-CSE-2026-A','CSE',2,'A',2025,75);
 series:=public.create_academic_series('Temporary recurring class','IET20',
  extract(isodow from d)::int,d,d+7,'10:00'::time,'11:00'::time,cohort,null,null);
 occurrences:=public.publish_academic_series(series);
 if occurrences<>2 then raise exception 'FAIL: recurrence expansion: %',occurrences;end if;
 if (select count(*) from public.room_allocations where source_type='academic')<>2
 then raise exception 'FAIL: recurrence allocation count';end if;
 note:=public.publish_targeted_notice('Temporary exam notice','Check exam room','high',cohort);
 if note is null then raise exception 'FAIL: notice publication';end if;

 perform set_config('request.jwt.claim.sub','8d72b5fc-ad9b-463b-aa63-bfbb08b91d21',true);
 booking:=public.request_room_booking('IET19','Temporary examination',s,s+interval '1 hour',
   'exam',75,gen_random_uuid(),null);
 if (select status from public.bookings where id=booking)<>'pending'
 then raise exception 'FAIL: examination must begin pending';end if;
 if exists(select 1 from public.room_allocations where source_id=booking)
 then raise exception 'FAIL: pending request occupied inventory';end if;
 begin
  perform public.publish_targeted_notice('Unauthorized staff notice','Not allowed','high',null);
  raise exception 'FAIL: faculty could publish official notice';
 exception when insufficient_privilege then null;end;

 perform set_config('request.jwt.claim.sub','46bc1a32-b9bf-4ceb-b4b2-8c297c7e72b4',true);
 perform public.review_room_booking(booking,true);
 if (select status from public.bookings where id=booking)<>'confirmed'
 then raise exception 'FAIL: approval not confirmed';end if;
 if not exists(select 1 from public.room_allocations where source_id=booking)
 then raise exception 'FAIL: approval allocation missing';end if;
 raise notice 'PASS: recurrence publication, targeted notice, pending approval and allocation';
end $test_academics$;
rollback;
