-- Fix PostgreSQL RECORD field dispatch: CASE evaluates field references before choosing type.
-- Use branch-local field accesses so booking rows never dereference academic faculty_id.
create or replace function public.sync_iet_grid_people() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_type text;v_active boolean;v_faculty uuid;v_cohort uuid;
begin
 if TG_TABLE_NAME='bookings' then v_type:='booking';else v_type:='academic';end if;
 if TG_OP='DELETE' then
   delete from public.faculty_allocations where source_type=v_type and source_id=old.id;
   delete from public.cohort_allocations where source_type=v_type and source_id=old.id;
   return old;
 end if;
 if v_type='booking' then
   v_active:=(new.status='confirmed');
   v_faculty:=new.created_by;
 else
   v_active:=(new.status='scheduled');
   v_faculty:=new.faculty_id;
 end if;
 v_cohort:=new.cohort_id;
 if v_active and v_faculty is not null then
   insert into public.faculty_allocations(faculty_id,source_type,source_id,starts_at,ends_at)
   values(v_faculty,v_type,new.id,new.starts_at,new.ends_at)
   on conflict(source_type,source_id) do update
   set faculty_id=excluded.faculty_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at;
 else
   delete from public.faculty_allocations where source_type=v_type and source_id=new.id;
 end if;
 if v_active and v_cohort is not null then
   insert into public.cohort_allocations(cohort_id,source_type,source_id,starts_at,ends_at)
   values(v_cohort,v_type,new.id,new.starts_at,new.ends_at)
   on conflict(source_type,source_id) do update
   set cohort_id=excluded.cohort_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at;
 else
   delete from public.cohort_allocations where source_type=v_type and source_id=new.id;
 end if;
 return new;
end $$;
revoke all on function public.sync_iet_grid_people() from public,anon,authenticated;
