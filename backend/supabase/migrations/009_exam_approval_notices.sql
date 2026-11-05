-- IET Grid hackathon P0: atomic exam approval announcements.
-- Replaces existing protected booking review RPC; preserves signature.
-- Approved exams/events publish a cohort-targeted notice when a cohort is known,
-- or a clearly specified campus-wide notice when no cohort is linked.
create or replace function public.review_room_booking(p_booking_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_role text;
  v_verified boolean;
  v_booking public.bookings%rowtype;
  v_building text;
  v_notice_title text;
  v_notice_body text;
begin
  select role, verified into v_role, v_verified
    from public.profiles where id = auth.uid();
  if not coalesce(v_verified,false) or v_role not in ('coordinator','admin') then
    raise exception 'FORBIDDEN: Verified coordinator or admin required' using errcode='42501';
  end if;

  select * into v_booking from public.bookings
   where id = p_booking_id and status = 'pending'
   for update;
  if not found then
    raise exception 'INVALID_STATE: Pending booking missing or already reviewed' using errcode='22023';
  end if;
  select building into v_building
    from public.rooms where id = v_booking.room_id;
  if v_role='coordinator' and not exists (
     select 1 from public.coordinator_scopes
      where user_id=auth.uid() and building_code=v_building
  ) then
    raise exception 'FORBIDDEN: Booking outside coordinator scope' using errcode='42501';
  end if;

  update public.bookings
     set status = case when p_approve then 'confirmed' else 'rejected' end,
         reviewed_by=auth.uid()
   where id=p_booking_id and status='pending';

  -- This INSERT and allocation-trigger update share one SQL transaction.
  -- If a conflict rejects approval, no success announcement can escape.
  if p_approve and v_booking.kind in ('exam','event') then
    v_notice_title := case when v_booking.kind='exam' then 'Exam room confirmed: '
                          else 'Event room confirmed: ' end || left(v_booking.title,130);
    v_notice_body :=
      'Approved ' || case when v_booking.kind='exam' then 'examination' else 'academic event' end
      || ' · Room ' || v_booking.room_id
      || ' · ' || to_char(v_booking.starts_at at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI')
      || '–' || to_char(v_booking.ends_at at time zone 'Asia/Kolkata','HH24:MI')
      || ' IST. Check the official schedule for any subsequent changes.';
    insert into public.announcements(title,body,priority,created_by,cohort_id)
      values(v_notice_title,v_notice_body,
             case when v_booking.kind='exam' then 'high' else 'normal' end,
             auth.uid(), v_booking.cohort_id);
  end if;
exception when exclusion_violation then
  raise exception 'BOOKING_CONFLICT: Room, faculty or cohort became occupied; approval rejected'
    using errcode='23P01';
end
$$;

revoke all on function public.review_room_booking(uuid,boolean) from public,anon;
grant execute on function public.review_room_booking(uuid,boolean) to authenticated;
