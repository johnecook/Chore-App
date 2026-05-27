-- Local smoke test for kid-visible chore claim and submit flow.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000701';
  child_id uuid := '00000000-0000-4000-8000-000000000702';
  target_household_id uuid;
  target_child_profile_id uuid;
  selected_template_id uuid;
  up_for_grabs_template_id uuid;
  selected_instance_id uuid;
  available_instance_id uuid;
  claim_id uuid;
  selected_submission_id uuid;
  claimed_submission_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'kid-flow-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Kid Flow Parent'),
      false,
      false
    ),
    (
      child_id,
      'kid-flow-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Kid Flow Child'),
      false,
      false
    );

  insert into public.households (name, created_by)
  values ('Kid Flow Household', parent_id)
  returning id into target_household_id;

  insert into public.household_memberships (household_id, user_id, role, is_primary_payout_parent)
  values
    (target_household_id, parent_id, 'admin', true),
    (target_household_id, child_id, 'child', false);

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (child_id, target_household_id, parent_id)
  returning id into target_child_profile_id;

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  selected_template_id := public.create_chore_template(
    target_household_id,
    'Selected kid chore',
    'Assigned directly to child',
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
    false,
    true,
    array[target_child_profile_id]
  );

  up_for_grabs_template_id := public.create_chore_template(
    target_household_id,
    'Available kid chore',
    'Any child can claim it',
    'one_off',
    '2026-06-01',
    null,
    null,
    '2026-06-01',
    null,
    null,
    'up_for_grabs',
    'unpaid',
    0,
    false,
    true,
    '{}'::uuid[]
  );

  select id
  into selected_instance_id
  from public.chore_instances
  where template_id = selected_template_id
    and assigned_child_profile_id = target_child_profile_id
    and status = 'assigned';

  select id
  into available_instance_id
  from public.chore_instances
  where template_id = up_for_grabs_template_id
    and assigned_child_profile_id is null
    and status = 'available'
    and up_for_grabs_slot;

  if selected_instance_id is null or available_instance_id is null then
    raise exception 'Expected kid-visible selected and available chore instances';
  end if;

  perform set_config('request.jwt.claim.sub', child_id::text, true);

  claim_id := public.claim_chore_instance(available_instance_id);

  if claim_id is null then
    raise exception 'Expected claim id';
  end if;

  if not exists (
    select 1
    from public.chore_instances instance
    where instance.id = available_instance_id
      and instance.assigned_child_profile_id = target_child_profile_id
      and instance.status = 'assigned'
      and instance.up_for_grabs_slot
  ) then
    raise exception 'Expected up-for-grabs chore to become assigned to child';
  end if;

  selected_submission_id := public.submit_chore_instance(
    selected_instance_id,
    'Done with selected chore',
    null
  );

  claimed_submission_id := public.submit_chore_instance(
    available_instance_id,
    'Done with claimed chore',
    null
  );

  if selected_submission_id is null or claimed_submission_id is null then
    raise exception 'Expected submission ids';
  end if;

  if (
    select count(*)
    from public.chore_instances instance
    where instance.id in (selected_instance_id, available_instance_id)
      and instance.status = 'submitted'
  ) <> 2 then
    raise exception 'Expected both kid submissions to wait for approval';
  end if;
end $$;
