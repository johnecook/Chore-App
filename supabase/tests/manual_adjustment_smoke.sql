-- Local smoke test for parent-created manual ledger adjustments.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000b01';
  child_id uuid := '00000000-0000-4000-8000-000000000b02';
  target_household_id uuid;
  target_child_profile_id uuid;
  adjustment_id uuid;
  target_pay_period_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'manual-adjustment-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Adjustment Parent'),
      false,
      false
    ),
    (
      child_id,
      'manual-adjustment-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Adjustment Child'),
      false,
      false
    );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  target_household_id := public.create_parent_household(
    household_name => 'Adjustment Household',
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

  adjustment_id := public.create_manual_adjustment(
    target_child_profile_id,
    250,
    'Bonus for helping',
    '2026-06-03'
  );

  if adjustment_id is null then
    raise exception 'Expected manual adjustment id';
  end if;

  select id into target_pay_period_id
  from public.pay_periods
  where household_id = target_household_id
    and start_date = '2026-05-30'
    and end_date = '2026-06-05';

  if target_pay_period_id is null then
    raise exception 'Expected current pay period to be created';
  end if;

  if not exists (
    select 1
    from public.ledger_transactions ledger
    where ledger.id = adjustment_id
      and ledger.child_profile_id = target_child_profile_id
      and ledger.payout_household_id = target_household_id
      and ledger.pay_period_id = target_pay_period_id
      and ledger.transaction_type = 'manual_adjustment'
      and ledger.amount_cents = 250
      and ledger.description = 'Bonus for helping'
      and ledger.effective_date = '2026-06-03'
      and ledger.created_by = parent_id
  ) then
    raise exception 'Expected manual adjustment ledger row';
  end if;

  perform public.create_manual_adjustment(
    target_child_profile_id,
    -100,
    'Correction',
    '2026-06-03',
    target_pay_period_id
  );

  if (
    select coalesce(sum(amount_cents), 0)
    from public.ledger_transactions ledger
    where ledger.child_profile_id = target_child_profile_id
      and ledger.pay_period_id = target_pay_period_id
      and ledger.transaction_type = 'manual_adjustment'
  ) <> 150 then
    raise exception 'Expected net manual adjustment balance';
  end if;
end $$;
