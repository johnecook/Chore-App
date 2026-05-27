-- Local smoke test for approved balances and parent payout closeout queue.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000901';
  child_id uuid := '00000000-0000-4000-8000-000000000902';
  target_household_id uuid;
  target_child_profile_id uuid;
  created_template_id uuid;
  target_instance_id uuid;
  target_submission_id uuid;
  target_approval_id uuid;
  target_pay_period_id uuid;
  target_payout_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'payout-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Payout Parent'),
      false,
      false
    ),
    (
      child_id,
      'payout-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Payout Child'),
      false,
      false
    );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

	  target_household_id := public.create_parent_household(
	    household_name => 'Payout Household',
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

  created_template_id := public.create_chore_template(
    target_household_id,
    'Payout queue chore',
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
    625,
    false,
    true,
    array[target_child_profile_id]
  );

  select id into target_instance_id
  from public.chore_instances
  where template_id = created_template_id;

  perform set_config('request.jwt.claim.sub', child_id::text, true);

  target_submission_id := public.submit_chore_instance(
    target_instance_id,
    'Ready for payout',
    null
  );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  target_approval_id := public.approve_chore_submission_for_current_period(
    target_submission_id,
    '2026-06-03',
    null
  );

  select ledger.pay_period_id into target_pay_period_id
  from public.ledger_transactions ledger
  where ledger.approval_event_id = target_approval_id
    and ledger.transaction_type = 'approved_credit';

  if target_pay_period_id is null then
    raise exception 'Expected approved credit pay period';
  end if;

  if (
    select coalesce(sum(amount_cents), 0)
    from public.ledger_transactions ledger
    where ledger.child_profile_id = target_child_profile_id
      and ledger.pay_period_id = target_pay_period_id
      and ledger.transaction_type in ('approved_credit', 'manual_adjustment', 'payout')
  ) <> 625 then
    raise exception 'Expected approved unpaid balance before payout';
  end if;

  target_payout_id := public.close_out_payout(
    target_pay_period_id,
    target_child_profile_id,
    'Paid from parent dashboard'
  );

  if target_payout_id is null then
    raise exception 'Expected payout id';
  end if;

  if (
    select coalesce(sum(amount_cents), 0)
    from public.ledger_transactions ledger
    where ledger.child_profile_id = target_child_profile_id
      and ledger.pay_period_id = target_pay_period_id
      and ledger.transaction_type in ('approved_credit', 'manual_adjustment', 'payout')
  ) <> 0 then
    raise exception 'Expected zero balance after payout';
  end if;

  if not exists (
    select 1
    from public.payout_events payout
    where payout.id = target_payout_id
      and payout.child_profile_id = target_child_profile_id
      and payout.pay_period_id = target_pay_period_id
      and payout.total_cents = 625
      and payout.note = 'Paid from parent dashboard'
  ) then
    raise exception 'Expected payout event snapshot';
  end if;
end $$;
