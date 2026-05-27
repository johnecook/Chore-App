-- Bootstrap public profiles from Supabase Auth sign-up metadata.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  requested_display_name text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'app_role', 'parent');
  requested_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1),
    'New user'
  );

  if requested_role not in ('parent', 'child') then
    requested_role := 'parent';
  end if;

  insert into public.profiles (id, app_role, display_name)
  values (new.id, requested_role::public.app_role, requested_display_name)
  on conflict (id) do update
  set app_role = excluded.app_role,
      display_name = excluded.display_name;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
