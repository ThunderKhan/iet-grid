-- IET Grid P0 production-schema integration checks (ROLLBACK-ONLY).
-- Simulated authenticated JWT claim context; no real login/token creation.
-- Must execute in the dedicated IET Grid Supabase project only.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at)
VALUES
('b2a46f74-ec04-4286-862c-bfb8cd94c7e1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-p0-test@invalid.example',now(),now(),now()),
('f3de820c-1968-4c81-bd98-a45f21b1a83e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','faculty-p0-test@invalid.example',now(),now(),now()),
('9efb03d9-2ca2-485b-9264-9a28090aca01','00000000-0000-0000-0000-000000000000','authenticated','authenticated','student-p0-test@invalid.example',now(),now(),now()),
('324661e2-2fc6-4aa1-9528-41c22cefe78b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','unconfirmed-p0-test@invalid.example',null,now(),now());
UPDATE public.profiles SET role='admin',verified=true WHERE id='b2a46f74-ec04-4286-862c-bfb8cd94c7e1';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b2a46f74-ec04-4286-862c-bfb8cd94c7e1',true);
DO $bootstrap$
BEGIN
 PERFORM public.provision_campus_user('f3de820c-1968-4c81-bd98-a45f21b1a83e','faculty',true);
 PERFORM public.provision_campus_user('9efb03d9-2ca2-485b-9264-9a28090aca01','student',true);
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='f3de820c-1968-4c81-bd98-a45f21b1a83e' AND role='faculty' AND verified)
 THEN RAISE EXCEPTION 'FAIL faculty provision'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='9efb03d9-2ca2-485b-9264-9a28090aca01' AND role='student' AND verified)
 THEN RAISE EXCEPTION 'FAIL student provision'; END IF;
 BEGIN
   PERFORM public.provision_campus_user('324661e2-2fc6-4aa1-9528-41c22cefe78b','faculty',true);
   RAISE EXCEPTION 'FAIL unconfirmed account promoted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS: admin provisions confirmed separate identities; unconfirmed denied';
END $bootstrap$;

SELECT set_config('request.jwt.claim.sub','f3de820c-1968-4c81-bd98-a45f21b1a83e',true);
DO $faculty$
DECLARE
  d timestamptz:=date_trunc('hour',now())+interval '3 days';
  v_id uuid;
BEGIN
 v_id:=public.request_room_booking('IET19','P0 minor examination',d,d+interval '1 hour',
  'exam',75,gen_random_uuid(),null);
 IF (SELECT status FROM public.bookings WHERE id=v_id)<>'pending' THEN
  RAISE EXCEPTION 'FAIL exam should be pending'; END IF;
 IF EXISTS(SELECT 1 FROM public.room_allocations WHERE source_id=v_id) THEN
  RAISE EXCEPTION 'FAIL pending exam should not reserve room'; END IF;
 BEGIN
   PERFORM public.review_room_booking(v_id,true);
   RAISE EXCEPTION 'FAIL faculty approved own exam';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.publish_targeted_notice('Unapproved notice','Not authorized','high',null);
   RAISE EXCEPTION 'FAIL faculty published campus notice';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS: faculty exam pending, cannot approve or publish official notice';
END $faculty$;

SELECT set_config('request.jwt.claim.sub','9efb03d9-2ca2-485b-9264-9a28090aca01',true);
DO $student$
BEGIN
 BEGIN
   PERFORM public.request_room_booking('IET18','Illegal student booking',
     date_trunc('hour',now())+interval '3 days',date_trunc('hour',now())+interval '3 days 1 hour',
     'lecture',75,gen_random_uuid(),null);
   RAISE EXCEPTION 'FAIL student booked room';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE title='P0 minor examination') THEN
   RAISE EXCEPTION 'FAIL student saw private pending faculty request'; END IF;
 RAISE NOTICE 'PASS: separate student cannot book or read private pending request';
END $student$;

SELECT set_config('request.jwt.claim.sub','b2a46f74-ec04-4286-862c-bfb8cd94c7e1',true);
DO $approval$
DECLARE v_id uuid;v_notice uuid;d timestamptz;
BEGIN
 SELECT id,starts_at INTO v_id,d FROM public.bookings WHERE title='P0 minor examination';
 PERFORM public.review_room_booking(v_id,true);
 IF (SELECT status FROM public.bookings WHERE id=v_id)<>'confirmed' THEN
   RAISE EXCEPTION 'FAIL exam approval status';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.room_allocations WHERE source_type='booking' AND source_id=v_id) THEN
   RAISE EXCEPTION 'FAIL approved exam lacked room allocation';END IF;
 SELECT id INTO v_notice FROM public.announcements WHERE title LIKE 'Exam room confirmed: P0 minor examination%';
 IF v_notice IS NULL THEN RAISE EXCEPTION 'FAIL missing automatic notice'; END IF;
 IF (SELECT priority FROM public.announcements WHERE id=v_notice)<>'high' THEN
  RAISE EXCEPTION 'FAIL expected high priority exam notice';END IF;
 RAISE NOTICE 'PASS: admin approval atomically confirmed exam and published high-priority notice';
END $approval$;

SELECT set_config('request.jwt.claim.sub','9efb03d9-2ca2-485b-9264-9a28090aca01',true);
DO $receipt$
DECLARE v_notice uuid;
BEGIN
 SELECT id INTO v_notice FROM public.announcements WHERE title LIKE 'Exam room confirmed: P0 minor examination%';
 IF NOT EXISTS(SELECT 1 FROM public.announcements WHERE id=v_notice) THEN
  RAISE EXCEPTION 'FAIL student cannot read campus-wide notice';END IF;
 PERFORM public.mark_announcement_read(v_notice);
 IF NOT EXISTS(SELECT 1 FROM public.announcement_reads WHERE user_id=auth.uid() AND announcement_id=v_notice) THEN
  RAISE EXCEPTION 'FAIL student read receipt not saved';END IF;
 RAISE NOTICE 'PASS: student sees official exam notice and acknowledges it';
END $receipt$;
ROLLBACK;
