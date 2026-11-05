-- P1 safety integration: verify real schema/RLS/RPC, then ROLLBACK all test data.
-- Run only against the dedicated IET Grid Supabase project.
begin;
-- No university inventory is permanently modified: changes revert below.
update public.rooms set equipment=array['projector']::text[] where id='IET18';
update public.rooms set restricted=true where id='IET20';
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at)
values
('6b59d17a-2861-4e1b-9ef6-0c3cf86f1e8d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p1-admin@invalid.example',now(),now(),now()),
('385b8f2e-67ee-4d28-a8c9-eaa29308aa33','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p1-coord@invalid.example',now(),now(),now()),
('d4eb78d8-f41d-4cbd-9dae-554f96272702','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p1-student@invalid.example',now(),now(),now());
update public.profiles set role='admin',verified=true where id='6b59d17a-2861-4e1b-9ef6-0c3cf86f1e8d';
update public.profiles set role='coordinator',verified=true where id='385b8f2e-67ee-4d28-a8c9-eaa29308aa33';
insert into public.coordinator_scopes(user_id,building_code)
values('385b8f2e-67ee-4d28-a8c9-eaa29308aa33','IET');

do $privileges$
begin
 if has_function_privilege('anon','public.list_booking_audit_history(integer,integer,text,text)','EXECUTE') then
   raise exception 'FAIL: anonymous user can execute audit RPC';
 end if;
 if has_function_privilege('anon','public.request_room_booking_with_equipment(text,text,timestamptz,timestamptz,text,integer,uuid,uuid,text[])','EXECUTE') then
   raise exception 'FAIL: anonymous user can execute equipment booking RPC';
 end if;
end $privileges$;

set local role authenticated;
select set_config('request.jwt.claim.sub','6b59d17a-2861-4e1b-9ef6-0c3cf86f1e8d',true);
do $admin$
declare
 s timestamptz:=date_trunc('hour',now())+interval '4 days';
 booked uuid; retry_id uuid; pending uuid; across uuid; n integer;
begin
 booked:=public.request_room_booking_with_equipment(
  'IET18','P1 temporary projector class',s,s+interval '1 hour',
  'lecture',75,'56865764-1f94-4bb7-8f17-e679b7cf391b',null,array['PROJECTOR']);
 retry_id:=public.request_room_booking_with_equipment(
  'IET18','P1 temporary projector class',s,s+interval '1 hour',
  'lecture',75,'56865764-1f94-4bb7-8f17-e679b7cf391b',null,array['projector']);
 if booked is null or booked <> retry_id then
   raise exception 'FAIL: repeat equipment criteria not idempotent';
 end if;
 if (select required_equipment from public.bookings where id=booked)<>array['projector']::text[] then
   raise exception 'FAIL: requested equipment not persisted';
 end if;
 begin
  perform public.request_room_booking_with_equipment(
  'IET18','P1 temporary projector class',s,s+interval '1 hour',
  'lecture',75,'56865764-1f94-4bb7-8f17-e679b7cf391b',null,array[]::text[]);
  raise exception 'FAIL: conflicting retry equipment accepted';
 exception when unique_violation then null; end;
 begin
  perform public.request_room_booking_with_equipment(
  'IET19','Missing equipment test',s+interval '2 hours',s+interval '3 hours',
  'lecture',75,gen_random_uuid(),null,array['projector']);
  raise exception 'FAIL: missing equipment accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.request_room_booking_with_equipment(
  'LH01','Unverified equipment test',s+interval '2 hours',s+interval '3 hours',
  'lecture',75,gen_random_uuid(),null,array['projector']);
  raise exception 'FAIL: provisional equipment accepted';
 exception when invalid_parameter_value then null; end;
 pending:=public.request_room_booking_with_equipment(
 'IET20','Restricted lecture',s+interval '2 hours',s+interval '3 hours',
 'lecture',75,gen_random_uuid(),null,array[]::text[]);
 if (select status from public.bookings where id=pending)<>'pending' then
   raise exception 'FAIL: restricted room was immediately confirmed';
 end if;
 across:=public.request_room_booking_with_equipment(
 'LH01','Deeksha lecture',s+interval '4 hours',s+interval '5 hours',
 'lecture',75,gen_random_uuid(),null,array[]::text[]);
 select count(*) into n from public.list_booking_audit_history(50,0,'IET18','created');
 if n<>1 then raise exception 'FAIL: admin filtered audit not found'; end if;
 select count(*) into n from public.list_booking_audit_history(50,0,'LH01','created');
 if n<>1 then raise exception 'FAIL: admin cannot inspect Deeksha building'; end if;
 raise notice 'PASS: requested equipment, retry integrity, recorded metadata, restricted room pending, administrator audit';
end $admin$;

select set_config('request.jwt.claim.sub','385b8f2e-67ee-4d28-a8c9-eaa29308aa33',true);
do $coordinator$
declare n int;
begin
 select count(*) into n from public.list_booking_audit_history(50,0,'LH01',null);
 if n<>0 then raise exception 'FAIL: coordinator saw other building history';end if;
 select count(*) into n from public.list_booking_audit_history(50,0,'IET18','created');
 if n<>1 then raise exception 'FAIL: coordinator cannot read delegated history';end if;
 raise notice 'PASS: coordinator sees only building-scoped events';
end $coordinator$;

select set_config('request.jwt.claim.sub','d4eb78d8-f41d-4cbd-9dae-554f96272702',true);
do $student$
begin
 begin
   perform public.list_booking_audit_history(20,0,null,null);
   raise exception 'FAIL: unverified student saw audit history';
 exception when insufficient_privilege then null;end;
 raise notice 'PASS: student denied audit records';
end $student$;
rollback;
