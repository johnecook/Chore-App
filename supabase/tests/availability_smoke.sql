-- Local smoke test for parent-managed child availability windows and overrides.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000401';
  child_id uuid := '00000000-0000-4000-8000-000000000402';
  created_household_id uuid;
  invitation_id uuid;
  created_child_profile_id uuid;
  created_window_id uuid;
  created_override_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'availability-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Availability Parent'),
      false,
      false
    ),
    (
      child_id,
      'availability-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Availability Child'),
      false,
      false
    );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

	  created_household_id := public.create_parent_household(
	    household_name => 'Availability Household',
	    household_timezone => 'America/Chicago',
	    money_features_enabled => true,
	    pay_weekday => 5
	  );

  invitation_id := public.create_child_invitation(
    created_household_id,
    'availability-child@example.test',
    'Availability Child'
  );

  perform set_config('request.jwt.claim.sub', child_id::text, true);
  created_child_profile_id := public.accept_child_invitation(invitation_id);

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  created_window_id := public.upsert_child_availability_window(
    created_child_profile_id,
    created_household_id,
    '2026-06-01',
    14,
    array[0, 1, 2, 3, 4, 5, 6],
    '2026-06-01',
    null
  );

  if not exists (
    select 1
    from public.child_household_availability_windows availability_window
    where availability_window.id = created_window_id
      and availability_window.child_profile_id = created_child_profile_id
      and availability_window.child_user_id = child_id
      and availability_window.household_id = created_household_id
      and availability_window.anchor_date = '2026-06-01'
      and availability_window.cycle_length_days = 14
      and availability_window.available_day_offsets = array[0, 1, 2, 3, 4, 5, 6]
  ) then
    raise exception 'Expected availability window';
  end if;

  created_override_id := public.upsert_child_availability_override(
    created_child_profile_id,
    created_household_id,
    '2026-06-10',
    true,
    'Summer schedule'
  );

  if not exists (
    select 1
    from public.child_household_availability_overrides override_row
    where override_row.id = created_override_id
      and override_row.child_profile_id = created_child_profile_id
      and override_row.child_user_id = child_id
      and override_row.household_id = created_household_id
      and override_row.override_date = '2026-06-10'
      and override_row.available
      and override_row.reason = 'Summer schedule'
  ) then
    raise exception 'Expected availability override';
  end if;

  perform public.delete_child_availability_override(created_override_id);

  if exists (
    select 1
    from public.child_household_availability_overrides override_row
    where override_row.id = created_override_id
  ) then
    raise exception 'Expected override deletion';
  end if;
end $$;
