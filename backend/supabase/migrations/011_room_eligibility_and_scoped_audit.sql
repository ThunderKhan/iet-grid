-- IET Grid P1: scoped booking audit history and atomic equipment eligibility.
-- No existing room metadata is silently "verified" by this migration.

create index if not exists booking_history_latest_idx
  on public.booking_history(created_at desc,id desc);

create or replace function public.list_booking_audit_history(
 p_limit integer default 25,
 p_offset integer default 0,
 p_room_id text default null,
 p_action text default null
) returns table (
 event_id bigint,
 booking_id uuid,
 room_id text,
 booking_title text,
 booking_kind text,
 booking_status text,
 actor_id uuid,
 action text,
 happened_at timestamptz,
 total_rows bigint
)
language plpgsql security definer set search_path=''
as $$
declare v_role text; v_verified boolean;
begin
 select p.role,p.verified into v_role,v_verified
 from public.profiles p where p.id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('admin','coordinator') then
   raise exception 'FORBIDDEN: Verified administrator or coordinator required'
     using errcode='42501';
 end if;
 if p_limit is null or p_limit not between 1 and 100
    or p_offset is null or p_offset < 0 or p_offset > 10000
    or (p_action is not null and p_action not in ('created','status'))
    or length(coalesce(p_room_id,''))>30 then
   raise exception 'INVALID_FILTER: Check history pagination or filters' using errcode='22023';
 end if;
 return query
 select h.id, b.id, r.id, b.title, b.kind, b.status,
        h.actor_id,h.action,h.created_at,
        count(*) over()::bigint
 from public.booking_history h
 join public.bookings b on b.id=h.booking_id
 join public.rooms r on r.id=b.room_id
 where (p_room_id is null or r.id=p_room_id)
  and (p_action is null or h.action like p_action||':%')
  and (v_role='admin' or exists(
    select 1 from public.coordinator_scopes cs
    where cs.user_id=auth.uid() and cs.building_code=r.building
  ))
 order by h.created_at desc,h.id desc
 limit p_limit offset p_offset;
end $$;

revoke all on function public.list_booking_audit_history(integer,integer,text,text)
 from public,anon,authenticated;
grant execute on function public.list_booking_audit_history(integer,integer,text,text)
 to authenticated;

-- PostgreSQL checks requested equipment within the booking transaction.
-- The existing 8-argument RPC stays intact for backward compatibility,
-- while the REST API uses this 9-argument guarded wrapper.
create or replace function public.request_room_booking_with_equipment(
 p_room_id text,p_title text,p_starts_at timestamptz,p_ends_at timestamptz,
 p_kind text,p_required_capacity integer,
 p_idempotency_key uuid,p_cohort_id uuid,p_required_equipment text[]
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_room public.rooms%rowtype;v_need text[];v_item text;v_user_role text;v_verified boolean;
begin
 select role,verified into v_user_role,v_verified
 from public.profiles where id=auth.uid();
 if not coalesce(v_verified,false) or v_user_role not in ('faculty','coordinator','admin') then
    raise exception 'FORBIDDEN: Verified faculty/staff privileges required' using errcode='42501';
 end if;
 if p_required_equipment is null or cardinality(p_required_equipment)>8 then
    raise exception 'INVALID_EQUIPMENT: Specify at most eight equipment features' using errcode='22023';
 end if;
 select * into v_room from public.rooms
 where id=p_room_id and active
 for share;
 if not found then
    raise exception 'NOT_FOUND: Room unavailable' using errcode='22023';
 end if;
 if v_room.type='lab' and p_kind<>'practical' then
    raise exception 'ROOM_TYPE: Labs can only be booked for practical sessions' using errcode='22023';
 end if;
 for v_item in select unnest(p_required_equipment) loop
   if v_item is null or trim(v_item)='' or length(trim(v_item))>60 then
      raise exception 'INVALID_EQUIPMENT: Equipment value invalid' using errcode='22023';
   end if;
   if not v_room.verified then
     raise exception 'UNVERIFIED_EQUIPMENT: University has not verified room equipment'
       using errcode='22023';
   end if;
   if not exists (
     select 1 from unnest(v_room.equipment) a(feature)
     where lower(trim(a.feature))=lower(trim(v_item))
   ) then
     raise exception 'EQUIPMENT_MISSING: Requested equipment is not recorded in this room'
       using errcode='22023';
   end if;
 end loop;
 return public.request_room_booking(
 p_room_id,p_title,p_starts_at,p_ends_at,p_kind,p_required_capacity,
 p_idempotency_key,p_cohort_id);
end $$;

revoke all on function public.request_room_booking_with_equipment(
 text,text,timestamptz,timestamptz,text,integer,uuid,uuid,text[]
) from public,anon,authenticated;
grant execute on function public.request_room_booking_with_equipment(
 text,text,timestamptz,timestamptz,text,integer,uuid,uuid,text[]
) to authenticated;
