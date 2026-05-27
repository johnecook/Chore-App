-- Local smoke test for parent approval/rejection from submitted kid chores.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000801';
  child_id uuid := '00000000-0000-4000-8000-000000000802';
  target_household_id uuid;
  target_child_profile_id uuid;
  fixed_template_id uuid;
  unpaid_template_id uuid;
  fixed_instance_id uuid;
  unpaid_instance_id uuid;
  fixed_submission_id uuid;
  unpaid_submission_id uuid;
  approval_id uuid;
  rejection_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'approval-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Approval Parent'),
      false,
      false
    ),
    (
      child_id,
      'approval-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Approval Child'),
      false,
      false
    );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

	  target_household_id := public.create_parent_household(
	    household_name => 'Approval Household',
	    household_timezone => 'America/Chicago',
	    money_features_enabled => true,
	    pay_weekday => 5,
	    pay_cycle => 'weekly',
	    biweekly_anchor_date => null
	  );

  insert into public.household_memberships (household_id, user_id, role, is_primary_payout_parent)
  values (target_household_id, child_id, 'child', false);

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (child_id, target_household_id, parent_id)
  returning id into target_child_profile_id;

  fixed_template_id := public.create_chore_template(
    target_household_id,
    'Approve fixed chore',
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
    450,
    false,
    true,
    array[target_child_profile_id]
  );

  unpaid_template_id := public.create_chore_template(
    target_household_id,
    'Reject unpaid chore',
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

  select id into fixed_instance_id
  from public.chore_instances
  where template_id = fixed_template_id;

  select id into unpaid_instance_id
  from public.chore_instances
  where template_id = unpaid_template_id;

  perform set_config('request.jwt.claim.sub', child_id::text, true);

  fixed_submission_id := public.submit_chore_instance(
    fixed_instance_id,
    'Fixed chore done',
    null
  );

  unpaid_submission_id := public.submit_chore_instance(
    unpaid_instance_id,
    'Needs review',
    null
  );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  approval_id := public.approve_chore_submission_for_current_period(
    fixed_submission_id,
    '2026-06-03',
    'Looks good'
  );

  if approval_id is null then
    raise exception 'Expected approval id';
  end if;

  if not exists (
    select 1
    from public.pay_periods period
    join public.ledger_transactions ledger
      on ledger.pay_period_id = period.id
    where period.household_id = target_household_id
      and period.start_date = '2026-05-30'
      and period.end_date = '2026-06-05'
      and ledger.approval_event_id = approval_id
      and ledger.chore_instance_id = fixed_instance_id
      and ledger.amount_cents = 450
      and ledger.transaction_type = 'approved_credit'
  ) then
    raise exception 'Expected approved credit in computed pay period';
  end if;

  rejection_id := public.reject_chore_submission(
    unpaid_submission_id,
    'Please redo the last step'
  );

  if rejection_id is null then
    raise exception 'Expected rejection id';
  end if;

  if not exists (
    select 1
    from public.chore_instances instance
    join public.approval_events event
      on event.instance_id = instance.id
    where instance.id = unpaid_instance_id
      and instance.status = 'rejected'
      and event.id = rejection_id
      and event.event_type = 'rejected'
      and event.feedback = 'Please redo the last step'
  ) then
    raise exception 'Expected rejected chore with feedback';
  end if;
end $$;
