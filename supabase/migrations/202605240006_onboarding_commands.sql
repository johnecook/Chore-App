-- Atomic onboarding commands for first household setup.

create or replace function public.create_parent_household(
  household_name text,
  household_timezone text default 'America/Chicago',
  pay_weekday int default 5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  household_id uuid;
begin
  select *
  into current_profile
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Current user profile not found';
  end if;

  if current_profile.app_role <> 'parent' then
    raise exception 'Only parent accounts can create households';
  end if;

  if household_name is null or length(trim(household_name)) = 0 then
    raise exception 'Household name is required';
  end if;

  if household_timezone is null or length(trim(household_timezone)) = 0 then
    raise exception 'Household timezone is required';
  end if;

  if pay_weekday < 0 or pay_weekday > 6 then
    raise exception 'Pay weekday must be between 0 and 6';
  end if;

  insert into public.households (
    name,
    timezone,
    created_by
  )
  values (
    trim(household_name),
    trim(household_timezone),
    current_profile.id
  )
  returning id into household_id;

  insert into public.household_memberships (
    household_id,
    user_id,
    role,
    is_primary_payout_parent
  )
  values (
    household_id,
    current_profile.id,
    'admin',
    true
  );

  insert into public.pay_cycle_settings (
    household_id,
    cycle_type,
    weekly_weekday,
    created_by
  )
  values (
    household_id,
    'weekly',
    pay_weekday,
    current_profile.id
  );

  return household_id;
end;
$$;
