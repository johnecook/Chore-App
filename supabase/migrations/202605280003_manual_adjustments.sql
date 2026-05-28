-- Parent command for compensating ledger adjustments.

create or replace function public.create_manual_adjustment(
  target_child_profile_id uuid,
  target_amount_cents int,
  adjustment_description text,
  effective_on date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_child public.child_profiles%rowtype;
  target_household public.households%rowtype;
  target_pay_period_id uuid;
  payout_parent uuid;
  adjustment_id uuid;
begin
  if target_amount_cents = 0 then
    raise exception 'Adjustment amount cannot be zero';
  end if;

  if nullif(trim(adjustment_description), '') is null then
    raise exception 'Adjustment note is required';
  end if;

  select *
  into target_child
  from public.child_profiles
  where id = target_child_profile_id;

  if not found then
    raise exception 'Child profile not found';
  end if;

  select *
  into target_household
  from public.households
  where id = target_child.primary_household_id;

  if not found then
    raise exception 'Primary payout household not found';
  end if;

  if not target_household.money_features_enabled then
    raise exception 'Money features are not enabled for this household';
  end if;

  if not public.is_household_parent(target_household.id) then
    raise exception 'Current user cannot adjust this payout household';
  end if;

  payout_parent := public.current_payout_parent_id(target_household.id);

  if payout_parent is null then
    raise exception 'Primary payout parent is not configured for payout household';
  end if;

  target_pay_period_id := public.current_pay_period_for_household(target_household.id, effective_on);

  insert into public.ledger_transactions (
    child_profile_id,
    earning_household_id,
    payout_household_id,
    payout_parent_id,
    pay_period_id,
    transaction_type,
    amount_cents,
    description,
    effective_date,
    created_by
  )
  values (
    target_child.id,
    target_household.id,
    target_household.id,
    payout_parent,
    target_pay_period_id,
    'manual_adjustment',
    target_amount_cents,
    trim(adjustment_description),
    effective_on,
    auth.uid()
  )
  returning id into adjustment_id;

  return adjustment_id;
end;
$$;
