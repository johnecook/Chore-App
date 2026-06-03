-- Local smoke test for child base allowance ledger credits and payout closeout.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000b01';
  child_id uuid := '00000000-0000-4000-8000-000000000b02';
  target_household_id uuid;
  target_child_profile_id uuid;
  target_pay_period_id uuid;
  payout_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'allowance-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Allowance Parent'),
      false,
      false
    ),
    (
      child_id,
      'allowance-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Allowance Child'),
      false,
      false
    );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  target_household_id := public.create_parent_household(
    household_name => 'Allowance Household',
    household_timezone => 'America/Chicago',
    money_features_enabled => true,
    pay_weekday => 5,
    pay_cycle => 'weekly',
    household_money_mode => 'allowance_plus_bonus'
  );

  insert into public.household_memberships (household_id, user_id, role, is_primary_payout_parent)
  values (target_household_id, child_id, 'child', false);

  insert into public.child_profiles (
    user_id,
    primary_household_id,
    allowance_enabled,
    base_allowance_cents,
    created_by
  )
  values (
    child_id,
    target_household_id,
    true,
    1000,
    parent_id
  )
  returning id into target_child_profile_id;

  perform public.ensure_current_allowance_credits(target_household_id, '2026-06-03');
  perform public.ensure_current_allowance_credits(target_household_id, '2026-06-03');

  select id
  into target_pay_period_id
  from public.pay_periods
  where household_id = target_household_id
    and start_date = '2026-05-30'
    and end_date = '2026-06-05';

  if target_pay_period_id is null then
    raise exception 'Expected weekly pay period';
  end if;

  if (
    select count(*)
    from public.ledger_transactions ledger
    where ledger.child_profile_id = target_child_profile_id
      and ledger.pay_period_id = target_pay_period_id
      and ledger.transaction_type = 'allowance_credit'
      and ledger.amount_cents = 1000
  ) <> 1 then
    raise exception 'Expected exactly one allowance credit';
  end if;

  payout_id := public.close_out_payout(
    target_pay_period_id,
    target_child_profile_id,
    'Allowance paid'
  );

  if not exists (
    select 1
    from public.payout_events payout
    where payout.id = payout_id
      and payout.child_profile_id = target_child_profile_id
      and payout.pay_period_id = target_pay_period_id
      and payout.total_cents = 1000
  ) then
    raise exception 'Expected allowance payout total';
  end if;

  if not exists (
    select 1
    from public.ledger_transactions ledger
    where ledger.payout_event_id = payout_id
      and ledger.transaction_type = 'payout'
      and ledger.amount_cents = -1000
  ) then
    raise exception 'Expected allowance payout ledger row';
  end if;
end $$;
