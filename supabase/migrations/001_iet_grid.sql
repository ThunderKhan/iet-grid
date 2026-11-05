
create extension if not exists btree_gist;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text,role text not null default 'student' check(role in ('student','faculty','coordinator','admin')),
 verified boolean not null default false,branch text,academic_year int,section text
);
create or replace function public.iet_grid_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1))) on conflict do nothing;return new;end $$;
create trigger iet_grid_profile_created after insert on auth.users for each row execute function public.iet_grid_profile();
create table public.rooms (
 id text primary key,building text not null check(building in ('IET','DEEK')),
 floor text not null check(floor in ('Ground','First','Second')),
 capacity int not null check(capacity>0),
 type text not null check(type in ('classroom','lab','seminar','library')),
 verified boolean not null default false,active boolean not null default true
);
create table public.bookings(
 id uuid primary key default gen_random_uuid(),room_id text not null references public.rooms(id),
 created_by uuid references auth.users(id),title text not null,kind text not null check(kind in ('lecture','exam','practical','event')),
 starts_at timestamptz not null,ends_at timestamptz not null,required_capacity int not null default 1,
 status text not null default 'confirmed' check(status in ('pending','confirmed','rejected','cancelled')),
 created_at timestamptz not null default now(),reviewed_by uuid references auth.users(id),
 constraint positive_slot check(ends_at>starts_at),
 constraint no_confirmed_overlap exclude using gist (room_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where (status='confirmed')
);
create table public.announcements(id uuid primary key default gen_random_uuid(),title text not null,body text not null default '',priority text not null default 'normal',created_by uuid references auth.users(id),created_at timestamptz not null default now());
create table public.schedule_reports(id uuid primary key default gen_random_uuid(),submitted_by uuid not null default auth.uid() references auth.users(id),booking_id uuid references public.bookings(id),details text not null,status text not null default 'open',created_at timestamptz not null default now());
create table public.booking_history(id bigint generated always as identity primary key,booking_id uuid not null,actor_id uuid,action text not null,created_at timestamptz not null default now());
create or replace function public.iet_grid_audit() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.booking_history(booking_id,actor_id,action) values(new.id,auth.uid(),case when TG_OP='INSERT' then 'created:'||new.status else 'status:'||old.status||'->'||new.status end);return new;end $$;
create trigger iet_grid_booking_audit after insert or update of status on public.bookings for each row execute function public.iet_grid_audit();
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;
alter table public.announcements enable row level security;
alter table public.schedule_reports enable row level security;
alter table public.booking_history enable row level security;
create policy profiles_self on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy rooms_signed_in on public.rooms for select to authenticated using(true);
create policy bookings_signed_in on public.bookings for select to authenticated using(true);
create policy announcements_signed_in on public.announcements for select to authenticated using(true);
create policy reports_own_select on public.schedule_reports for select to authenticated using(submitted_by=(select auth.uid()));
create policy reports_own_insert on public.schedule_reports for insert to authenticated with check(submitted_by=(select auth.uid()));
create policy history_own on public.booking_history for select to authenticated using(actor_id=(select auth.uid()));
revoke insert,update,delete on public.bookings,public.announcements,public.profiles from anon,authenticated;
create or replace function public.create_room_booking(
 p_room_id text,p_title text,p_starts_at timestamptz,p_ends_at timestamptz,
 p_kind text default 'lecture',p_required_capacity integer default 1
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_role text;v_verified bool;v_capacity int;v_id uuid;v_status text;
begin
 if v_uid is null then raise exception 'Authentication required';end if;
 select role,verified into v_role,v_verified from public.profiles where id=v_uid;
 if not coalesce(v_verified,false) or v_role not in ('faculty','coordinator','admin') then raise exception 'Verified faculty required';end if;
 select capacity into v_capacity from public.rooms where id=p_room_id and active;
 if v_capacity is null then raise exception 'Room not found';end if;
 if p_required_capacity<1 or p_required_capacity>v_capacity then raise exception 'Insufficient room capacity';end if;
 if p_starts_at<=now() or p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '8 hours' then raise exception 'Invalid time slot';end if;
 if p_kind not in ('lecture','exam','practical','event') or length(trim(p_title))<3 then raise exception 'Invalid request';end if;
 if exists(select 1 from public.bookings where room_id=p_room_id and status='confirmed' and tstzrange(starts_at,ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) then raise exception 'Room already booked';end if;
 v_status:=case when p_kind in ('exam','event') then 'pending' else 'confirmed' end;
 insert into public.bookings(room_id,created_by,title,kind,starts_at,ends_at,required_capacity,status)
 values(p_room_id,v_uid,trim(p_title),p_kind,p_starts_at,p_ends_at,p_required_capacity,v_status) returning id into v_id;
 return v_id;
exception when exclusion_violation then raise exception 'Concurrent booking conflict';
end $$;
create or replace function public.review_room_booking(p_booking_id uuid,p_approve boolean) returns void
language plpgsql security definer set search_path=public as $$
declare v_role text;v_verified bool;
begin
 select role,verified into v_role,v_verified from public.profiles where id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('coordinator','admin') then raise exception 'Not authorized';end if;
 update public.bookings set status=case when p_approve then 'confirmed' else 'rejected' end,reviewed_by=auth.uid() where id=p_booking_id and status='pending';
 if not found then raise exception 'Pending booking not found';end if;
exception when exclusion_violation then raise exception 'Room occupied; cannot approve';
end $$;
create or replace function public.publish_campus_notice(p_title text,p_body text,p_priority text default 'normal') returns uuid
language plpgsql security definer set search_path=public as $$
declare v_role text;v_verified bool;v_id uuid;
begin
 select role,verified into v_role,v_verified from public.profiles where id=auth.uid();
 if not coalesce(v_verified,false) or v_role not in ('coordinator','admin') then raise exception 'Not authorized';end if;
 insert into public.announcements(title,body,priority,created_by) values(p_title,p_body,p_priority,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_room_booking(text,text,timestamptz,timestamptz,text,integer) from public,anon;
revoke all on function public.review_room_booking(uuid,boolean) from public,anon;
revoke all on function public.publish_campus_notice(text,text,text) from public,anon;
grant execute on function public.create_room_booking(text,text,timestamptz,timestamptz,text,integer) to authenticated;
grant execute on function public.review_room_booking(uuid,boolean) to authenticated;
grant execute on function public.publish_campus_notice(text,text,text) to authenticated;
insert into public.rooms(id,building,floor,capacity,type,verified) values
('LIBRARY','IET','Ground',165,'library',true),
('IET22','IET','First',75,'lab',false),('IET16','IET','First',75,'lab',false),('IET14','IET','First',75,'lab',false),('IET15','IET','First',75,'lab',false),
('IET20','IET','First',75,'classroom',true),('IET19','IET','First',75,'classroom',true),('IET18','IET','First',75,'classroom',true),('IET17','IET','First',75,'classroom',true),
('IET32','IET','Second',200,'seminar',true),('IET24','IET','Second',75,'classroom',false),('IET25','IET','Second',75,'classroom',false),('IET30','IET','Second',75,'classroom',false),('IET29','IET','Second',75,'classroom',false),('IET28','IET','Second',75,'classroom',false),('IET23','IET','Second',75,'classroom',false),
('LH01','DEEK','Ground',75,'classroom',false),('LH02','DEEK','Ground',75,'classroom',false),('LH03','DEEK','Ground',75,'classroom',false),('LH04','DEEK','Ground',75,'classroom',false),('LH05','DEEK','Ground',75,'classroom',false),('LH06','DEEK','Ground',75,'classroom',false),('LH07','DEEK','Ground',75,'classroom',false),
('LH08','DEEK','First',75,'classroom',false),('LH09','DEEK','First',75,'classroom',false),('LH10','DEEK','First',75,'classroom',false),('LH11','DEEK','First',75,'classroom',false),('LH12','DEEK','First',75,'classroom',false),('LH13','DEEK','First',75,'classroom',false),('LH14','DEEK','First',75,'classroom',false);
