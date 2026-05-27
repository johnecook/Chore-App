-- Local smoke test for scheduled recurring chore instance generation.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000041';
  child_one_id uuid := '00000000-0000-4000-8000-000000000042';
  child_two_id uuid := '00000000-0000-4000-8000-000000000043';
  household_id uuid;
  child_one_profile_id uuid;
  child_two_profile_id uuid;
  weekly_template_id uuid;
  grabs_template_id uuid;
  inserted_count int;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'parent-recurring@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Parent'),
      false,
      false
    ),
    (
      child_one_id,
      'child-one-recurring@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Child One'),
      false,
      false
    ),
    (
      child_two_id,
      'child-two-recurring@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Child Two'),
      false,
      false
    );

  insert into public.households (name, timezone, created_by)
  values ('Recurring Household', 'America/Chicago', parent_id)
  returning id into household_id;

  insert into public.household_memberships (household_id, user_id, role)
  values
    (household_id, parent_id, 'admin'),
    (household_id, child_one_id, 'child'),
    (household_id, child_two_id, 'child');

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (child_one_id, household_id, parent_id)
  returning id into child_one_profile_id;

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (child_two_id, household_id, parent_id)
  returning id into child_two_profile_id;

  insert into public.child_household_availability_windows (
    child_profile_id,
    child_user_id,
    household_id,
    anchor_date,
    cycle_length_days,
    available_day_offsets,
    created_by
  )
  values
    (
      child_one_profile_id,
      child_one_id,
      household_id,
      '2026-06-01',
      7,
      array[0, 2],
      parent_id
    ),
    (
      child_two_profile_id,
      child_two_id,
      household_id,
      '2026-06-01',
      7,
      array[0, 2],
      parent_id
    );

  insert into public.child_household_availability_overrides (
    child_profile_id,
    child_user_id,
    household_id,
    override_date,
    available,
    reason,
    created_by
  )
  values (
    child_two_profile_id,
    child_two_id,
    household_id,
    '2026-06-03',
    false,
    'Travel',
    parent_id
  );

  insert into public.chore_templates (
    household_id,
    created_by,
    title,
    schedule_type,
    start_date,
    weekly_weekdays,
    due_time_start,
    due_time_end,
    assignment_mode,
    value_model,
    amount_cents,
    photo_required,
    approval_required
  )
  values (
    household_id,
    parent_id,
    'Weekly counters',
    'weekly',
    '2026-06-01',
    array[1, 3],
    '17:00',
    '20:00',
    'selected_children',
    'unpaid',
    0,
    false,
    true
  )
  returning id into weekly_template_id;

  insert into public.chore_template_assignees (template_id, child_profile_id)
  values
    (weekly_template_id, child_one_profile_id),
    (weekly_template_id, child_two_profile_id);

  insert into public.chore_templates (
    household_id,
    created_by,
    title,
    schedule_type,
    start_date,
    weekly_weekdays,
    assignment_mode,
    value_model,
    amount_cents,
    photo_required,
    approval_required
  )
  values (
    household_id,
    parent_id,
    'Grab the mail',
    'weekly',
    '2026-06-01',
    array[1, 3],
    'up_for_grabs',
    'unpaid',
    0,
    false,
    true
  )
  returning id into grabs_template_id;

  inserted_count := public.generate_chore_instances_for_range('2026-06-01', '2026-06-07');

  if inserted_count <> 5 then
    raise exception 'Expected 5 generated instances, got %', inserted_count;
  end if;

  if public.generate_chore_instances_for_range('2026-06-01', '2026-06-07') <> 0 then
    raise exception 'Expected second generation pass to be idempotent';
  end if;

  if (
    select count(*)
    from public.chore_instances instance
    where instance.template_id = weekly_template_id
      and instance.status = 'assigned'
  ) <> 3 then
    raise exception 'Expected 3 selected-child weekly instances';
  end if;

  if exists (
    select 1
    from public.chore_instances instance
    where instance.template_id = weekly_template_id
      and instance.assigned_child_profile_id = child_two_profile_id
      and instance.occurrence_date = '2026-06-03'
  ) then
    raise exception 'Expected child availability override to skip June 3';
  end if;

  if (
    select count(*)
    from public.chore_instances instance
    where instance.template_id = grabs_template_id
      and instance.status = 'available'
      and instance.up_for_grabs_slot
  ) <> 2 then
    raise exception 'Expected one up-for-grabs slot per occurrence';
  end if;

  if not exists (
    select 1
    from public.chore_instances instance
    where instance.template_id = weekly_template_id
      and instance.assigned_child_profile_id = child_one_profile_id
      and instance.occurrence_date = '2026-06-03'
      and instance.due_window_start = '2026-06-03 17:00:00 America/Chicago'::timestamptz
      and instance.due_window_end = '2026-06-03 20:00:00 America/Chicago'::timestamptz
  ) then
    raise exception 'Expected household-local due window snapshots';
  end if;
end $$;
