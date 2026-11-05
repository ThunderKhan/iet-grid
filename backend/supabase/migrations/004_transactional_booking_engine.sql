-- IET Grid Phase 1b: end-to-end transactional booking engine.
-- Keep the original RPC signature usable by the existing frontend.
create table public.faculty_allocations(
 id uuid primary key default gen_random_uuid(),
 faculty_id uuid not null references public.profiles(id),
 source_type text not null check(source_type in ('booking','academic')),
 source_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,
 unique(source_type,source_id),
 check(ends_at>starts_at),
 constraint faculty_overlap_exclusion exclude using gist
 (faculty_id with =,tstzrange(starts_at,ends_at,'[)') with &&)
);
create table public.cohort_allocations(
 id uuid primary key default gen_random_uuid(),
 cohort_id uuid not null references public.academic_cohorts(id),
 source_type text not null check(source_type in ('booking','academic')),
 source_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,
 unique(source_type,source_id),
 check(ends_at>starts_at),
 constraint cohort_overlap_exclusion exclude using gist
 (cohort_id with =,tstzrange(starts_at,ends_at,'[)') with &&)
);
alter table public.faculty_allocations enable row level security;
alter table public.cohort_allocations enable row level security;
-- Availability must not disclose personally identifying student records.
create policy faculty_availability_read on public.faculty_allocations for select to authenticated using(true);
create policy cohort_availability_read on public.cohort_allocations for select to authenticated using(true);
grant select on public.faculty_allocations,public.cohort_allocations to authenticated;
revoke insert,update,delete on public.faculty_allocations,public.cohort_allocations from anon,authenticated;

create or replace function public.sync_iet_grid_people() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_type text;v_active boolean;v_faculty uuid;v_cohort uuid;
begin
 v_type:=case TG_TABLE_NAME when 'bookings' then 'booking' else 'academic' end;
 if TG_OP='DELETE' then
  delete from public.faculty_allocations where source_type=v_type and source_id=old.id;
  delete from public.cohort_allocations where source_type=v_type and source_id=old.id;
  return old;
 end if;
 v_active:=case when v_type='booking' then new.status='confirmed' else new.status='scheduled' end;
 v_faculty:=case when v_type='booking' then new.created_by else new.faculty_id end;
 v_cohort:=new.cohort_id;
 if v_active and v_faculty is not null then
   insert into public.faculty_allocations(faculty_id,source_type,source_id,starts_at,ends_at)
   values(v_faculty,v_type,new.id,new.starts_at,new.ends_at)
   on conflict(source_type,source_id) do update set faculty_id=excluded.faculty_id,
    starts_at=excluded.starts_at,ends_at=excluded.ends_at;
 else
   delete from public.faculty_allocations where source_type=v_type and source_id=new.id;
 end if;
 if v_active and v_cohort is not null then
   insert into public.cohort_allocations(cohort_id,source_type,source_id,starts_at,ends_at)
   values(v_cohort,v_type,new.id,new.starts_at,new.ends_at)
   on conflict(source_type,source_id) do update set cohort_id=excluded.cohort_id,
    starts_at=excluded.starts_at,ends_at=excluded.ends_at;
 else
   delete from public.cohort_allocations where source_type=v_type and source_id=new.id;
 end if;
 return new;
end $$;
revoke all on function public.sync_iet_grid_people() from public,anon,authenticated;
create trigger iet_grid_booking_people after insert or update or delete on public.bookings
 for each row execute function public.sync_iet_grid_people();
create trigger iet_grid_academic_people after insert or update or delete on public.academic_sessions
 for each row execute function public.sync_iet_grid_people();

insert into public.faculty_allocations(faculty_id,source_type,source_id,starts_at,ends_at)
select created_by,'booking',id,starts_at,ends_at from public.bookings where status='confirmed' and created_by is not null
on conflict(source_type,source_id) do nothing;
insert into public.cohort_allocations(cohort_id,source_type,source_id,starts_at,ends_at)
select cohort_id,'booking',id,starts_at,ends_at from public.bookings where status='confirmed' and cohort_id is not null
on conflict(source_type,source_id) do nothing;

-- The API and the existing frontend both call PostgreSQL RPCs. Business authorization
-- is intentionally in this single source of truth, not implemented twice.
create or replace function public.request_room_booking(
 p_room_id text,p_title text,p_starts_at timestamptz,p_ends_at timestamptz,
 p_kind text,p_required_capacity integer,p_idempotency_key uuid default null,
 p_cohort_id uuid default null
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_uid uuid:=auth.uid();v_role text;v_verified boolean;
 v_room public.rooms%rowtype;v_status text;v_id uuid;
 v_old public.bookings%rowtype;v_exists boolean;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED: Sign in first' using errcode='28000';end if;
 select role,verified into v_role,v_verified from public.profiles where id=v_uid;
 if not coalesce(v_verified,false) or v_role not in ('faculty','coordinator','admin')
 then raise exception 'FORBIDDEN: Verified faculty privileges required' using errcode='42501';end if;

 if p_idempotency_key is not null then
  select * into v_old from public.bookings where created_by=v_uid and idempotency_key=p_idempotency_key;
  if found then
   if v_old.room_id=p_room_id and v_old.title=trim(p_title) and
      v_old.starts_at=p_starts_at and v_old.ends_at=p_ends_at and
      v_old.kind=p_kind and v_old.required_capacity=p_required_capacity and
      v_old.cohort_id is not distinct from p_cohort_id
   then return v_old.id;
   end if;
   raise exception 'IDEMPOTENCY_CONFLICT: Key reused for a different request' using errcode='23505';
  end if;
 end if;

 select * into v_room from public.rooms where id=p_room_id and active;
 if not found then raise exception 'NOT_FOUND: Room unavailable' using errcode='22023';end if;
 if v_room.type='library' then raise exception 'ROOM_RESTRICTED: Library is not a reservable classroom' using errcode='22023';end if;
 if v_room.type='lab' and p_kind!='practical' and v_role='faculty'
 then raise exception 'ROOM_TYPE: Labs require a practical session' using errcode='22023';end if;
 if p_required_capacity is null or p_required_capacity<1 or p_required_capacity>v_room.capacity
 then raise exception 'CAPACITY: Requested capacity exceeds room size' using errcode='22023';end if;
 if p_starts_at is null or p_ends_at is null or p_starts_at<=now()
 or p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '8 hours'
 or p_starts_at>now()+interval '180 days'
 then raise exception 'INVALID_TIME: Choose a future slot of 8 hours or less' using errcode='22023';end if;
 if p_kind not in ('lecture','practical','exam','event') or
   p_title is null or char_length(trim(p_title)) not between 3 and 180
 then raise exception 'INVALID_REQUEST: Check title and session type' using errcode='22023';end if;
 if p_cohort_id is not null then
   if not exists(select 1 from public.academic_cohorts where id=p_cohort_id and active)
   then raise exception 'INVALID_COHORT: Cohort not found' using errcode='22023';end if;
   if v_role='faculty' and not exists(select 1 from public.teaching_assignments
     where faculty_id=v_uid and cohort_id=p_cohort_id)
   then raise exception 'FORBIDDEN: Faculty cannot book for an unassigned cohort' using errcode='42501';end if;
 end if;
 if v_role='coordinator' and not exists(select 1 from public.coordinator_scopes
    where user_id=v_uid and building_code=v_room.building)
 then raise exception 'FORBIDDEN: Building outside coordinator scope' using errcode='42501';end if;

 if exists(select 1 from public.room_allocations where room_id=p_room_id
  and starts_at<p_ends_at and ends_at>p_starts_at)
 then raise exception 'ROOM_CONFLICT: Room occupied during requested time' using errcode='23P01';end if;
 if exists(select 1 from public.faculty_allocations where faculty_id=v_uid
  and starts_at<p_ends_at and ends_at>p_starts_at)
 then raise exception 'FACULTY_CONFLICT: Faculty has another commitment' using errcode='23P01';end if;
 if p_cohort_id is not null and exists(select 1 from public.cohort_allocations
   where cohort_id=p_cohort_id and starts_at<p_ends_at and ends_at>p_starts_at)
 then raise exception 'COHORT_CONFLICT: Group already has a scheduled class' using errcode='23P01';end if;

 v_status:=case when p_kind in ('exam','event') or v_room.restricted
 then 'pending' else 'confirmed' end;
 insert into public.bookings(room_id,created_by,title,kind,starts_at,ends_at,
 required_capacity,status,cohort_id,idempotency_key)
 values(p_room_id,v_uid,trim(p_title),p_kind,p_starts_at,p_ends_at,
 p_required_capacity,v_status,p_cohort_id,p_idempotency_key)
 on conflict(created_by,idempotency_key) where idempotency_key is not null do nothing
 returning id into v_id;
 if v_id is null then
   select * into v_old from public.bookings where created_by=v_uid and idempotency_key=p_idempotency_key;
   if found and v_old.room_id=p_room_id and v_old.title=trim(p_title) and
      v_old.starts_at=p_starts_at and v_old.ends_at=p_ends_at and
      v_old.kind=p_kind and v_old.required_capacity=p_required_capacity and
      v_old.cohort_id is not distinct from p_cohort_id
   then return v_old.id; end if;
   raise exception 'IDEMPOTENCY_CONFLICT: Key reused for a different request' using errcode='23505';
 end if;
 return v_id;
exception when exclusion_violation then
 raise exception 'BOOKING_CONFLICT: Room, instructor or cohort already occupied' using errcode='23P01';
end $$;

-- Preserve existing JS client RPC contract while centralizing business rules.
create or replace function public.create_room_booking(
 p_room_id text,p_title text,p_starts_at timestamptz,p_ends_at timestamptz,
 p_kind text default 'lecture',p_required_capacity integer default 1
) returns uuid language sql security invoker set search_path=public,pg_temp as $$
 select public.request_room_booking(p_room_id,p_title,p_starts_at,p_ends_at,
 p_kind,p_required_capacity,null,null);
$$;

create or replace function public.review_room_booking(p_booking_id uuid,p_approve boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text;v_verified bool;v_building text;
begin
 select role,verified into v_role,v_verified from public.profiles where id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('coordinator','admin')
 then raise exception 'FORBIDDEN: Coordinator/admin required' using errcode='42501';end if;
 select r.building into v_building from public.bookings b join public.rooms r on r.id=b.room_id
 where b.id=p_booking_id and b.status='pending' for update of b;
 if v_building is null then raise exception 'NOT_FOUND: Pending booking missing' using errcode='22023';end if;
 if v_role='coordinator' and not exists(select 1 from public.coordinator_scopes
  where user_id=auth.uid() and building_code=v_building)
 then raise exception 'FORBIDDEN: Outside coordinator building scope' using errcode='42501';end if;
 update public.bookings set status=case when p_approve then 'confirmed' else 'rejected' end,
  reviewed_by=auth.uid() where id=p_booking_id and status='pending';
exception when exclusion_violation then
 raise exception 'BOOKING_CONFLICT: The requested room or attendees are no longer available' using errcode='23P01';
end $$;

create or replace function public.cancel_room_booking(p_booking_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid();v_booking public.bookings%rowtype;v_role text;v_verified bool;v_building text;
begin
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'NOT_FOUND: Booking missing' using errcode='22023';end if;
 select role,verified into v_role,v_verified from public.profiles where id=v_uid;
 select building into v_building from public.rooms where id=v_booking.room_id;
 if not coalesce(v_verified,false) or (
  v_booking.created_by is distinct from v_uid and v_role!='admin' and not
   (v_role='coordinator' and exists(select 1 from public.coordinator_scopes where user_id=v_uid and building_code=v_building)))
 then raise exception 'FORBIDDEN: Cannot cancel this booking' using errcode='42501';end if;
 if v_booking.status not in ('confirmed','pending') then raise exception 'INVALID_STATE: Booking already closed' using errcode='22023';end if;
 if trim(coalesce(p_reason,''))='' then raise exception 'INVALID_REQUEST: Cancellation reason is required' using errcode='22023';end if;
 update public.bookings set status='cancelled',cancelled_at=now(),cancellation_reason=left(trim(p_reason),500)
 where id=p_booking_id;
end $$;

revoke all on function public.request_room_booking(text,text,timestamptz,timestamptz,text,integer,uuid,uuid) from public,anon;
revoke all on function public.create_room_booking(text,text,timestamptz,timestamptz,text,integer) from public,anon;
revoke all on function public.review_room_booking(uuid,boolean) from public,anon;
revoke all on function public.cancel_room_booking(uuid,text) from public,anon;
grant execute on function public.request_room_booking(text,text,timestamptz,timestamptz,text,integer,uuid,uuid) to authenticated;
grant execute on function public.create_room_booking(text,text,timestamptz,timestamptz,text,integer) to authenticated;
grant execute on function public.review_room_booking(uuid,boolean) to authenticated;
grant execute on function public.cancel_room_booking(uuid,text) to authenticated;
