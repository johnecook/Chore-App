-- Local smoke test for parent chore template creation and permission behavior.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000501';
  child_id uuid := '00000000-0000-4000-8000-000000000502';
  other_child_id uuid := '00000000-0000-4000-8000-000000000503';
  target_household_id uuid;
  other_household_id uuid;
  target_child_profile_id uuid;
  other_child_profile_id uuid;
  created_template_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'template-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Template Parent'),
      false,
      false
    ),
    (
      child_id,
      'template-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Template Child'),
      false,
      false
    ),
    (
      other_child_id,
      'template-other-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Other Child'),
      false,
      false
    );

  insert into public.households (name, created_by)
  values ('Template Household', parent_id)
  returning id into target_household_id;

  insert into public.households (name, created_by)
  values ('Other Household', parent_id)
  returning id into other_household_id;

  insert into public.household_memberships (household_id, user_id, role, is_primary_payout_parent)
  values
    (target_household_id, parent_id, 'admin', true),
    (target_household_id, child_id, 'child', false),
    (other_household_id, other_child_id, 'child', false);

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (child_id, target_household_id, parent_id)
  returning id into target_child_profile_id;

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (other_child_id, other_household_id, parent_id)
  returning id into other_child_profile_id;

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  created_template_id := public.create_chore_template(
    target_household_id,
    'Wipe counters',
    'Kitchen counters after dinner',
    'one_off',
    '2026-06-01',
    null,
    null,
    '2026-06-01',
    '17:00',
    '20:00',
    'selected_children',
    'fixed',
    300,
    true,
    true,
    array[target_child_profile_id]
  );

  if not exists (
    select 1
    from public.chore_templates template
    where template.id = created_template_id
      and template.household_id = target_household_id
      and template.created_by = parent_id
      and template.title = 'Wipe counters'
      and template.assignment_mode = 'selected_children'
      and template.value_model = 'fixed'
      and template.amount_cents = 300
      and template.photo_required
      and template.approval_required
  ) then
    raise exception 'Expected created chore template';
  end if;

  if not exists (
    select 1
    from public.chore_template_assignees assignee
    where assignee.template_id = created_template_id
      and assignee.child_profile_id = target_child_profile_id
  ) then
    raise exception 'Expected selected child assignee';
  end if;

  if not exists (
    select 1
    from public.chore_instances instance
    where instance.template_id = created_template_id
      and instance.earning_household_id = target_household_id
      and instance.assigned_child_profile_id = target_child_profile_id
      and instance.occurrence_date = '2026-06-01'
      and instance.status = 'assigned'
      and instance.amount_cents_snapshot = 300
      and instance.photo_required_snapshot
      and instance.approval_required_snapshot
  ) then
    raise exception 'Expected one-off selected-child instance';
  end if;

  begin
    perform public.create_chore_template(
      target_household_id,
      'Invalid child',
      null,
      'one_off',
      '2026-06-01',
      null,
      null,
      '2026-06-01',
      null,
      null,
      'selected_children',
      'unpaid',
      0,
      true,
      true,
      array[other_child_profile_id]
    );

    raise exception 'Expected other-household child selection to fail';
  exception
    when others then
      if sqlerrm = 'Expected other-household child selection to fail' then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', child_id::text, true);

  begin
    perform public.create_chore_template(
      target_household_id,
      'Child-created chore',
      null,
      'one_off',
      '2026-06-01',
      null,
      null,
      '2026-06-01',
      null,
      null,
      'selected_children',
      'unpaid',
      0,
      true,
      true,
      array[target_child_profile_id]
    );

    raise exception 'Expected child template creation to fail';
  exception
    when others then
      if sqlerrm = 'Expected child template creation to fail' then
        raise;
      end if;
  end;
end $$;
