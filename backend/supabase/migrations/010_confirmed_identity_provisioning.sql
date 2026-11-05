-- IET Grid hackathon P0: verified test-role provisioning safety.
-- Only the verified university administrator may provision existing email-confirmed accounts.
-- Never elevate the role of an unconfirmed email or silently demote an administrator.
create or replace function public.provision_campus_user(
  p_user_id uuid, p_role text, p_verified boolean
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_current_role text;
  v_confirmed_at timestamptz;
begin
  if not public.iet_admin_ok() then
    raise exception 'FORBIDDEN: University administrator required' using errcode='42501';
  end if;
  if p_user_id is null or p_role not in ('student','faculty','coordinator','admin')
    or p_verified is null then
    raise exception 'INVALID_ROLE: Supply an existing account, role and verification state'
      using errcode='22023';
  end if;
  select p.role, u.email_confirmed_at
    into v_current_role, v_confirmed_at
    from public.profiles p join auth.users u on u.id=p.id
    where p.id=p_user_id
    for update of p;
  if not found then
    raise exception 'NOT_FOUND: Account has not registered' using errcode='22023';
  end if;
  if v_confirmed_at is null then
    raise exception 'UNCONFIRMED_EMAIL: Verify email ownership before granting access'
      using errcode='42501';
  end if;
  if v_current_role='admin' and p_role!='admin' then
    raise exception 'FORBIDDEN: Cannot demote an administrator through test-user provisioning'
      using errcode='42501';
  end if;
  update public.profiles
     set role=p_role, verified=p_verified
    where id=p_user_id;
end
$$;
revoke all on function public.provision_campus_user(uuid,text,boolean) from public,anon;
grant execute on function public.provision_campus_user(uuid,text,boolean) to authenticated;
