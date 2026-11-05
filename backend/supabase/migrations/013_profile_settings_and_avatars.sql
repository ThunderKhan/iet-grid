-- IET Grid: secure self-service profile fields and private avatar storage.
-- Student/faculty role, verification and institutional class membership remain
-- administrator-managed and are NOT granted to client-side updates.
alter table public.profiles
  add column if not exists avatar_path text;

-- An avatar reference may only point inside the account owner's own folder.
alter table public.profiles
  add constraint profiles_avatar_path_owner_check
  check (avatar_path is null or avatar_path like id::text || '/%');

-- Row-level scope plus column privileges prevent user role/verification edits.
create policy profiles_update_self_safe on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant update (full_name, avatar_path) on public.profiles to authenticated;

-- Private by design: profile images are not published to the open web.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('iet-profile-avatars','iet-profile-avatars',false,2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy iet_avatar_upload_own on storage.objects
  for insert to authenticated with check (
    bucket_id='iet-profile-avatars'
    and (storage.foldername(name))[1]=(select auth.uid())::text
  );

create policy iet_avatar_read_own on storage.objects
  for select to authenticated using (
    bucket_id='iet-profile-avatars'
    and (storage.foldername(name))[1]=(select auth.uid())::text
  );

create policy iet_avatar_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id='iet-profile-avatars'
    and (storage.foldername(name))[1]=(select auth.uid())::text
  );

-- No storage update policy: every upload uses a unique immutable object key.
-- No broad SELECT on profiles, and no updates to role/verified/cohort fields.
