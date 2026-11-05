-- IET Grid P1b: preserve equipment criteria in saved bookings / retries.
alter table public.bookings
  add column if not exists required_equipment text[] not null default '{}'::text[];

create or replace function public.request_room_booking_with_equipment(
 p_room_id text,p_title text,p_starts_at timestamptz,p_ends_at timestamptz,
 p_kind text,p_required_capacity integer,
 p_idempotency_key uuid,p_cohort_id uuid,p_required_equipment text[]
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
 v_room public.rooms%rowtype;
 v_old public.bookings%rowtype;
 v_need text[];
 v_item text;
 v_id uuid;
 v_role text;
 v_verified boolean;
begin
 select p.role,p.verified into v_role,v_verified
 from public.profiles p where p.id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('faculty','coordinator','admin') then
   raise exception 'FORBIDDEN: Verified faculty/staff privileges required' using errcode='42501';
 end if;
 if p_required_equipment is null or cardinality(p_required_equipment)>8 then
   raise exception 'INVALID_EQUIPMENT: Specify zero to eight equipment features'
     using errcode='22023';
 end if;
 for v_item in select unnest(p_required_equipment) loop
   if v_item is null or length(trim(v_item)) not between 1 and 60 then
     raise exception 'INVALID_EQUIPMENT: Feature cannot be empty or over 60 characters'
       using errcode='22023';
   end if;
 end loop;
 select coalesce(array_agg(feature order by feature),'{}'::text[])
 into v_need
 from (select distinct lower(trim(x)) feature from unnest(p_required_equipment) e(x)) norm;

 -- Serialize retries by user/idempotency key before checking the stored criteria.
 -- This also makes competing, differently equipped requests deterministic.
 if p_idempotency_key is not null then
   perform pg_catalog.pg_advisory_xact_lock(
     pg_catalog.hashtextextended(auth.uid()::text || ':' || p_idempotency_key::text,0));
   select * into v_old from public.bookings
    where created_by=auth.uid() and idempotency_key=p_idempotency_key
    for update;
   if found and v_old.required_equipment <> v_need then
     raise exception 'IDEMPOTENCY_CONFLICT: Equipment criteria differ from earlier request'
       using errcode='23505';
   end if;
 end if;

 select * into v_room from public.rooms where id=p_room_id and active for share;
 if not found then
   raise exception 'NOT_FOUND: Room unavailable' using errcode='22023';
 end if;
 if v_room.type='lab' and p_kind<>'practical' then
   raise exception 'ROOM_TYPE: Labs require practical sessions' using errcode='22023';
 end if;
 if cardinality(v_need)>0 and not v_room.verified then
   raise exception 'UNVERIFIED_EQUIPMENT: Room equipment cannot be confirmed'
     using errcode='22023';
 end if;
 for v_item in select unnest(v_need) loop
   if not exists(
     select 1 from unnest(v_room.equipment) e(feature)
     where lower(trim(e.feature))=v_item
   ) then
     raise exception 'EQUIPMENT_MISSING: Requested feature is not recorded in this room'
       using errcode='22023';
   end if;
 end loop;

 v_id:=public.request_room_booking(
  p_room_id,p_title,p_starts_at,p_ends_at,p_kind,p_required_capacity,
  p_idempotency_key,p_cohort_id);

 if v_old.id is null and cardinality(v_need)>0 then
   update public.bookings
   set required_equipment=v_need where id=v_id and created_by=auth.uid();
 end if;
 return v_id;
end $$;

revoke all on function public.request_room_booking_with_equipment(
 text,text,timestamptz,timestamptz,text,integer,uuid,uuid,text[]
) from public,anon,authenticated;
grant execute on function public.request_room_booking_with_equipment(
 text,text,timestamptz,timestamptz,text,integer,uuid,uuid,text[]
) to authenticated;
