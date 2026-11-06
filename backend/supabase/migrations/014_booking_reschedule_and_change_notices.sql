-- IET Grid: source-of-truth rescheduling and automatic academic change notices.
-- Migration is additive. No data is modified by applying this migration.
-- The booking exclusion constraints and allocation triggers remain authoritative.

create or replace function public.reschedule_room_booking(
  p_booking_id uuid,
  p_new_starts_at timestamptz,
  p_new_ends_at timestamptz,
  p_reason text
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_verified boolean;
  v_booking public.bookings%rowtype;
  v_building text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: Sign in first' using errcode='28000';
  end if;
  select role,verified into v_role,v_verified
    from public.profiles where id=v_uid;
  if not coalesce(v_verified,false) or v_role not in ('faculty','coordinator','admin') then
    raise exception 'FORBIDDEN: Verified staff account required' using errcode='42501';
  end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND: Reservation not found' using errcode='22023';
  end if;
  select building into v_building from public.rooms
    where id=v_booking.room_id and active;
  if v_building is null then
    raise exception 'ROOM_UNAVAILABLE: The room is inactive' using errcode='22023';
  end if;
  if v_booking.created_by is distinct from v_uid and v_role<>'admin'
     and not (v_role='coordinator' and exists(
       select 1 from public.coordinator_scopes
       where user_id=v_uid and building_code=v_building
     )) then
    raise exception 'FORBIDDEN: Cannot reschedule this booking' using errcode='42501';
  end if;
  if v_booking.status<>'confirmed' then
    raise exception 'INVALID_STATE: Only confirmed reservations can be rescheduled' using errcode='22023';
  end if;
  if v_booking.kind not in ('lecture','practical') then
    raise exception 'APPROVAL_REQUIRED: Cancel and request a new exam/event slot for review' using errcode='22023';
  end if;
  if p_new_starts_at is null or p_new_ends_at is null
     or p_new_starts_at<=now() or p_new_ends_at<=p_new_starts_at
     or p_new_ends_at>p_new_starts_at+interval '8 hours'
     or p_new_starts_at>now()+interval '180 days' then
    raise exception 'INVALID_TIME: Choose a future slot of 8 hours or less' using errcode='22023';
  end if;
  if p_new_starts_at=v_booking.starts_at and p_new_ends_at=v_booking.ends_at then
    raise exception 'UNCHANGED: Select a different time slot' using errcode='22023';
  end if;
  if char_length(trim(coalesce(p_reason,''))) not between 3 and 500 then
    raise exception 'INVALID_REASON: Give a reason of 3 to 500 characters' using errcode='22023';
  end if;

  -- Any overlapping room, faculty or cohort allocation causes the entire
  -- transaction (including notices and history) to roll back.
  update public.bookings
     set starts_at=p_new_starts_at,ends_at=p_new_ends_at
   where id=p_booking_id;

  -- A durable, scoped history event supplements existing status-change auditing.
  insert into public.booking_history(booking_id,actor_id,action)
    values(p_booking_id,v_uid,'rescheduled: '||left(trim(p_reason),160));
exception when exclusion_violation then
  raise exception 'BOOKING_CONFLICT: Room, faculty or cohort already occupied at new time'
    using errcode='23P01';
end
$$;

revoke all on function public.reschedule_room_booking(uuid,timestamptz,timestamptz,text)
  from public,anon;
grant execute on function public.reschedule_room_booking(uuid,timestamptz,timestamptz,text)
  to authenticated;

-- Publish a cohort-targeted notice if the group is known. Without cohort data,
-- only exam/event cancellations are campus-wide; routine unassigned lectures must
-- not broadcast speculative notifications to every student.
create or replace function public.notify_iet_booking_schedule_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_cancellation boolean;
  v_rescheduled boolean;
  v_title text;
  v_body text;
begin
  v_cancellation:=old.status='confirmed' and new.status='cancelled';
  v_rescheduled:=old.status='confirmed' and new.status='confirmed'
    and (old.starts_at is distinct from new.starts_at
       or old.ends_at is distinct from new.ends_at);
  if not v_cancellation and not v_rescheduled then return new; end if;
  if new.cohort_id is null and new.kind not in ('exam','event') then return new; end if;

  if v_cancellation then
    v_title:='Cancelled: '||left(new.title,150);
    v_body:='The '||new.kind||' in room '||new.room_id||' scheduled for '
      ||to_char(old.starts_at at time zone 'Asia/Kolkata','DD Mon YYYY HH24:MI')
      ||' IST has been cancelled. Reason: '||coalesce(nullif(new.cancellation_reason,''),'Not specified')
      ||'. Consult the official timetable for updates.';
  else
    v_title:='Room schedule revised: '||left(new.title,145);
    v_body:='Room '||new.room_id||' has moved from '
      ||to_char(old.starts_at at time zone 'Asia/Kolkata','DD Mon YYYY HH24:MI')
      ||'–'||to_char(old.ends_at at time zone 'Asia/Kolkata','HH24:MI')
      ||' to '||to_char(new.starts_at at time zone 'Asia/Kolkata','DD Mon YYYY HH24:MI')
      ||'–'||to_char(new.ends_at at time zone 'Asia/Kolkata','HH24:MI')
      ||' IST. This is the confirmed booking time.';
  end if;
  insert into public.announcements(title,body,priority,created_by,cohort_id)
    values(v_title,v_body,
      case when new.kind='exam' then 'high' else 'normal' end,
      auth.uid(),new.cohort_id);
  return new;
end
$$;
revoke all on function public.notify_iet_booking_schedule_change()
  from public,anon,authenticated;
drop trigger if exists iet_grid_booking_schedule_change on public.bookings;
create trigger iet_grid_booking_schedule_change
after update of starts_at,ends_at,status on public.bookings
for each row execute function public.notify_iet_booking_schedule_change();
