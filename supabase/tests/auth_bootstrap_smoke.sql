-- Local smoke test for auth.users -> public.profiles bootstrap.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000101';
  child_id uuid := '00000000-0000-4000-8000-000000000102';
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Parent User'),
      false,
      false
    ),
    (
      child_id,
      'child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Child User'),
      false,
      false
    );

  if not exists (
    select 1
    from public.profiles
    where id = parent_id
      and app_role = 'parent'
      and display_name = 'Parent User'
  ) then
    raise exception 'Expected parent profile bootstrap';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = child_id
      and app_role = 'child'
      and display_name = 'Child User'
  ) then
    raise exception 'Expected child profile bootstrap';
  end if;
end $$;

set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);

do $$
declare
  visible_profile_count int;
begin
  select count(*)
  into visible_profile_count
  from public.profiles
  where id = '00000000-0000-4000-8000-000000000101';

  if visible_profile_count <> 1 then
    raise exception 'Expected authenticated parent to read own profile';
  end if;
end $$;
