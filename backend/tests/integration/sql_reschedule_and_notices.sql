-- Rollback-only evidence for IET Grid P0/P1 booking rescheduling.
-- Run ONLY against dedicated IET Grid Supabase project after migration 014.
-- These temporary identities and bookings are never committed.
begin;
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
('dd68d27f-cc55-4ccf-a124-a45625cb1f27','00000000-0000-0000-0000-000000000000','authenticated','authenticated','iet-grid-p1-faculty@invalid.example',now(),now()),
('ead10d52-1377-455e-81cd-6ef8d3f41211','00000000-0000-0000-0000-000000000000','authenticated','authenticated','iet-grid-p1-admin@invalid.example',now(),now());
update public.profiles set role='faculty',verified=true
 where id='dd68d27f-cc55-4ccf-a124-a45625cb1f27';
update public.profiles set role='admin',verified=true
 where id='ead10d52-1377-455e-81cd-6ef8d3f41211';
set local role authenticated;
select set_config('request.jwt.claim.sub','dd68d27f-cc55-4ccf-a124-a45625cb1f27',true);

do $test$
declare
  v_start timestamptz:=date_trunc('hour',now())+interval '22 days';
  v_lecture uuid;
  v_exam uuid;
begin
  v_lecture:=public.request_room_booking('IET18','SQL test lecture',v_start,
    v_start+interval '1 hour','lecture',75,gen_random_uuid(),null);
  perform public.reschedule_room_booking(v_lecture,v_start+interval '2 hours',
    v_start+interval '3 hours','Faculty timetable moved');
  if (select starts_at from public.bookings where id=v_lecture)<>v_start+interval '2 hours' then
    raise exception 'FAIL: rescheduled slot did not persist in transaction';
  end if;
  if not exists(select 1 from public.room_allocations
      where source_type='booking' and source_id=v_lecture
      and starts_at=v_start+interval '2 hours') then
    raise exception 'FAIL: room allocation not updated atomically';
  end if;
  if not exists(select 1 from public.booking_history where booking_id=v_lecture
      and action like 'rescheduled:%') then
    raise exception 'FAIL: rescheduling was not audited';
  end if;

  -- A second confirmed reservation occupies the later slot.
  perform public.request_room_booking('IET19','SQL test other booking',
    v_start+interval '5 hours',v_start+interval '6 hours',
    'lecture',75,gen_random_uuid(),null);
  begin
    perform public.reschedule_room_booking(v_lecture,
      v_start+interval '5 hours',v_start+interval '6 hours','Deliberate faculty clash');
    raise exception 'FAIL: overlapping faculty allocation accepted';
  exception when exclusion_violation then null;
  end;
  if (select starts_at from public.bookings where id=v_lecture)<>v_start+interval '2 hours' then
    raise exception 'FAIL: failed reschedule modified the confirmed booking';
  end if;

  v_exam:=public.request_room_booking('IET19','SQL test exam',
    v_start+interval '8 hours',v_start+interval '9 hours',
    'exam',75,gen_random_uuid(),null);
  perform set_config('request.jwt.claim.sub','ead10d52-1377-455e-81cd-6ef8d3f41211',true);
  perform public.review_room_booking(v_exam,true);
  perform set_config('request.jwt.claim.sub','dd68d27f-cc55-4ccf-a124-a45625cb1f27',true);
  perform public.cancel_room_booking(v_exam,'Test exam moved to another date');
  if not exists(select 1 from public.announcements
    where title like 'Cancelled: SQL test exam%' and priority='high') then
    raise exception 'FAIL: cancelled exam did not publish high-priority notice';
  end if;
  if exists(select 1 from public.room_allocations where source_id=v_exam) then
    raise exception 'FAIL: cancelled exam retained allocation';
  end if;
  raise notice 'PASS: rescheduling, conflict rollback, history and exam cancellation notices';
end $test$;
rollback;
