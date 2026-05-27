-- Local smoke test for scheduled chore expiration behavior.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000031';
  child_id uuid := '00000000-0000-4000-8000-000000000032';
  household_id uuid;
  child_profile_id uuid;
  target_template_id uuid;
  expired_count int;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'parent-expiration@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Parent'),
      false,
      false
    ),
    (
      child_id,
      'child-expiration@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Child'),
      false,
      false
    );

  insert into public.households (name, timezone, created_by)
  values ('Expiration Household', 'America/Chicago', parent_id)
  returning id into household_id;

  insert into public.household_memberships (household_id, user_id, role)
  values
    (household_id, parent_id, 'admin'),
    (household_id, child_id, 'child');

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (child_id, household_id, parent_id)
  returning id into child_profile_id;

  insert into public.chore_templates (
    household_id,
    created_by,
    title,
    schedule_type,
    start_date,
    one_off_date,
    assignment_mode,
    value_model,
    amount_cents,
    photo_required,
    approval_required
  )
  values (
    household_id,
    parent_id,
    'Expiration test chore',
    'one_off',
    '2026-05-01',
    '2026-05-01',
    'selected_children',
    'unpaid',
    0,
    false,
    true
  )
  returning id into target_template_id;

  insert into public.chore_instances (
    template_id,
    earning_household_id,
    assigned_child_profile_id,
    occurrence_date,
    due_window_end,
    value_model_snapshot,
    amount_cents_snapshot,
    photo_required_snapshot,
    approval_required_snapshot,
    status,
    up_for_grabs_slot
  )
  values
    (
      target_template_id,
      household_id,
      child_profile_id,
      '2026-05-01',
      '2026-05-01 18:00:00-05',
      'unpaid',
      0,
      false,
      true,
      'assigned',
      false
    ),
    (
      target_template_id,
      household_id,
      null,
      '2026-05-01',
      '2026-05-01 18:00:00-05',
      'unpaid',
      0,
      false,
      true,
      'available',
      true
    ),
    (
      target_template_id,
      household_id,
      child_profile_id,
      '2026-04-30',
      null,
      'unpaid',
      0,
      false,
      true,
      'rejected',
      false
    ),
    (
      target_template_id,
      household_id,
      child_profile_id,
      '2026-05-02',
      '2026-05-03 18:00:00-05',
      'unpaid',
      0,
      false,
      true,
      'assigned',
      false
    ),
    (
      target_template_id,
      household_id,
      child_profile_id,
      '2026-04-29',
      '2026-04-29 18:00:00-05',
      'unpaid',
      0,
      false,
      true,
      'submitted',
      false
    );

  expired_count := public.expire_overdue_chore_instances('2026-05-03 06:00:00-05');

  if expired_count <> 3 then
    raise exception 'Expected 3 expired chores, got %', expired_count;
  end if;

  if (
    select count(*)
    from public.chore_instances
    where chore_instances.template_id = target_template_id
      and status = 'expired'
  ) <> 3 then
    raise exception 'Expected exactly 3 expired instances';
  end if;

  if not exists (
    select 1
    from public.chore_instances
    where chore_instances.template_id = target_template_id
      and occurrence_date = '2026-05-02'
      and status = 'assigned'
  ) then
    raise exception 'Expected future assigned chore to stay assigned';
  end if;

  if not exists (
    select 1
    from public.chore_instances
    where chore_instances.template_id = target_template_id
      and status = 'submitted'
  ) then
    raise exception 'Expected submitted chore to stay submitted';
  end if;
end $$;
