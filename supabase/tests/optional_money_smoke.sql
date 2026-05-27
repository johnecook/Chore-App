-- Local smoke test for chores-only households with no payout setup or ledger writes.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000a01';
  child_id uuid := '00000000-0000-4000-8000-000000000a02';
  target_household_id uuid;
  target_child_profile_id uuid;
  unpaid_template_id uuid;
  instance_id uuid;
  submission_id uuid;
  approval_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'optional-money-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Optional Money Parent'),
      false,
      false
    ),
    (
      child_id,
      'optional-money-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Optional Money Child'),
      false,
      false
    );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  target_household_id := public.create_parent_household(
    household_name => 'Chores Only Household',
    household_timezone => 'America/Chicago',
    money_features_enabled => false
  );

  insert into public.household_memberships (household_id, user_id, role, is_primary_payout_parent)
  values (target_household_id, child_id, 'child', false);

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (child_id, target_household_id, parent_id)
  returning id into target_child_profile_id;

  begin
    perform public.create_chore_template(
      target_household_id,
      'Paid chore should fail',
      null,
      'one_off',
      '2026-06-01',
      null,
      null,
      '2026-06-01',
      null,
      null,
      'selected_children',
      'fixed',
      500,
      false,
      true,
      array[target_child_profile_id]
    );

    raise exception 'Expected paid chore creation to fail when money is disabled';
  exception
    when others then
      if sqlerrm <> 'Enable money features before creating paid chores' then
        raise;
      end if;
  end;

  unpaid_template_id := public.create_chore_template(
    target_household_id,
    'Unpaid chore',
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
    false,
    true,
    array[target_child_profile_id]
  );

  select id into instance_id
  from public.chore_instances
  where template_id = unpaid_template_id;

  perform set_config('request.jwt.claim.sub', child_id::text, true);

  submission_id := public.submit_chore_instance(
    instance_id,
    'Done',
    null
  );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  approval_id := public.approve_chore_submission_for_current_period(
    submission_id,
    '2026-06-03',
    'Looks good'
  );

  if approval_id is null then
    raise exception 'Expected approval id';
  end if;

  if exists (
    select 1
    from public.ledger_transactions ledger
    where ledger.chore_instance_id = instance_id
       or ledger.approval_event_id = approval_id
  ) then
    raise exception 'Chores-only approval should not create ledger rows';
  end if;

  if exists (
    select 1
    from public.pay_periods period
    where period.household_id = target_household_id
  ) then
    raise exception 'Chores-only approval should not create pay periods';
  end if;
end $$;
