-- Base allowance ledger credits are materialized once per child per pay period.

alter table public.ledger_transactions
drop constraint ledger_amount_shape;

alter table public.ledger_transactions
add constraint ledger_amount_shape
check (
  (transaction_type in ('pending_credit', 'approved_credit', 'allowance_credit') and amount_cents > 0)
  or (transaction_type = 'manual_adjustment' and amount_cents <> 0)
  or (transaction_type = 'payout' and amount_cents < 0)
);

create unique index ledger_one_allowance_credit_per_child_period
on public.ledger_transactions (child_profile_id, pay_period_id)
where transaction_type = 'allowance_credit';

create or replace function public.household_money_features_enabled(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(household.money_mode <> 'none', household.money_features_enabled, false)
  from public.households household
  where household.id = target_household_id
$$;

drop function if exists public.create_parent_household(
  text,
  text,
  boolean,
  int,
  public.pay_cycle_type,
  date
);

create or replace function public.create_parent_household(
  household_name text,
  household_timezone text default 'America/Chicago',
  money_features_enabled boolean default true,
  pay_weekday int default null,
  pay_cycle public.pay_cycle_type default null,
  biweekly_anchor_date date default null,
  household_money_mode public.household_money_mode default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  household_id uuid;
  normalized_money_mode public.household_money_mode;
  normalized_pay_cycle public.pay_cycle_type;
  normalized_pay_weekday int;
begin
  select *
  into current_profile
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Current user profile not found';
  end if;

  if current_profile.app_role <> 'parent' then
    raise exception 'Only parent accounts can create households';
  end if;

  if household_name is null or length(trim(household_name)) = 0 then
    raise exception 'Household name is required';
  end if;

  if household_timezone is null or length(trim(household_timezone)) = 0 then
    raise exception 'Household timezone is required';
  end if;

  normalized_money_mode := coalesce(
    household_money_mode,
    case
      when money_features_enabled then 'per_chore'::public.household_money_mode
      else 'none'::public.household_money_mode
    end
  );
  money_features_enabled := normalized_money_mode <> 'none';

  if money_features_enabled then
    normalized_pay_cycle := coalesce(pay_cycle, 'weekly'::public.pay_cycle_type);
    normalized_pay_weekday := coalesce(pay_weekday, 5);

    if normalized_pay_weekday < 0 or normalized_pay_weekday > 6 then
      raise exception 'Pay weekday must be between 0 and 6';
    end if;

    if normalized_pay_cycle not in ('weekly', 'biweekly') then
      raise exception 'Onboarding supports weekly or biweekly payout schedules';
    end if;

    if normalized_pay_cycle = 'biweekly' and biweekly_anchor_date is null then
      raise exception 'Biweekly payout schedules require an anchor date';
    end if;
  end if;

  insert into public.households (
    name,
    timezone,
    money_features_enabled,
    money_mode,
    created_by
  )
  values (
    trim(household_name),
    trim(household_timezone),
    money_features_enabled,
    normalized_money_mode,
    current_profile.id
  )
  returning id into household_id;

  insert into public.household_memberships (
    household_id,
    user_id,
    role,
    is_primary_payout_parent
  )
  values (
    household_id,
    current_profile.id,
    'admin',
    money_features_enabled
  );

  if money_features_enabled then
    if normalized_pay_cycle = 'weekly' then
      insert into public.pay_cycle_settings (
        household_id,
        cycle_type,
        weekly_weekday,
        created_by
      )
      values (
        household_id,
        'weekly',
        normalized_pay_weekday,
        current_profile.id
      );
    else
      insert into public.pay_cycle_settings (
        household_id,
        cycle_type,
        biweekly_weekday,
        biweekly_anchor_date,
        created_by
      )
      values (
        household_id,
        'biweekly',
        normalized_pay_weekday,
        biweekly_anchor_date,
        current_profile.id
      );
    end if;
  end if;

  return household_id;
end;
$$;

create or replace function public.ensure_allowance_credit(
  target_pay_period_id uuid,
  target_child_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_period public.pay_periods%rowtype;
  target_child public.child_profiles%rowtype;
  payout_parent uuid;
  allowance_ledger_id uuid;
begin
  select *
  into target_period
  from public.pay_periods
  where id = target_pay_period_id;

  if not found then
    raise exception 'Pay period not found';
  end if;

  select *
  into target_child
  from public.child_profiles
  where id = target_child_profile_id;

  if not found then
    raise exception 'Child profile not found';
  end if;

  if target_child.primary_household_id <> target_period.household_id then
    raise exception 'Pay period does not belong to child payout household';
  end if;

  if not public.is_household_parent(target_period.household_id) then
    raise exception 'Current user cannot manage allowance for this household';
  end if;

  if not target_child.allowance_enabled or target_child.base_allowance_cents <= 0 then
    return null;
  end if;

  if not public.household_money_features_enabled(target_period.household_id) then
    return null;
  end if;

  payout_parent := public.current_payout_parent_id(target_period.household_id);

  if payout_parent is null then
    raise exception 'Primary payout parent is not configured for payout household';
  end if;

  insert into public.ledger_transactions (
    child_profile_id,
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
    target_period.household_id,
    payout_parent,
    target_period.id,
    'allowance_credit',
    target_child.base_allowance_cents,
    'Base allowance',
    target_period.end_date,
    auth.uid()
  )
  on conflict (child_profile_id, pay_period_id)
  where transaction_type = 'allowance_credit'
  do nothing
  returning id into allowance_ledger_id;

  if allowance_ledger_id is null then
    select id
    into allowance_ledger_id
    from public.ledger_transactions
    where child_profile_id = target_child.id
      and pay_period_id = target_period.id
      and transaction_type = 'allowance_credit';
  end if;

  return allowance_ledger_id;
end;
$$;

create or replace function public.ensure_current_allowance_credits(
  target_household_id uuid,
  target_date date default current_date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pay_period_id uuid;
  target_child record;
  ensured_count int := 0;
  allowance_ledger_id uuid;
begin
  if not public.is_household_parent(target_household_id) then
    raise exception 'Current user cannot manage allowance for this household';
  end if;

  if not public.household_money_features_enabled(target_household_id) then
    return 0;
  end if;

  target_pay_period_id := public.current_pay_period_for_household(target_household_id, target_date);

  for target_child in
    select id
    from public.child_profiles
    where primary_household_id = target_household_id
      and allowance_enabled
      and base_allowance_cents > 0
  loop
    allowance_ledger_id := public.ensure_allowance_credit(target_pay_period_id, target_child.id);

    if allowance_ledger_id is not null then
      ensured_count := ensured_count + 1;
    end if;
  end loop;

  return ensured_count;
end;
$$;

create or replace function public.close_out_payout(
  target_pay_period_id uuid,
  target_child_profile_id uuid,
  payout_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_period public.pay_periods%rowtype;
  target_child public.child_profiles%rowtype;
  payout_parent uuid;
  total_approved_cents int;
  payout_id uuid;
begin
  select *
  into target_period
  from public.pay_periods
  where id = target_pay_period_id
  for update;

  if not found then
    raise exception 'Pay period not found';
  end if;

  select *
  into target_child
  from public.child_profiles
  where id = target_child_profile_id;

  if not found then
    raise exception 'Child profile not found';
  end if;

  if target_child.primary_household_id <> target_period.household_id then
    raise exception 'Pay period does not belong to child payout household';
  end if;

  if not public.is_household_parent(target_period.household_id) then
    raise exception 'Current user cannot close out this payout household';
  end if;

  payout_parent := public.current_payout_parent_id(target_period.household_id);

  if payout_parent is null then
    raise exception 'Primary payout parent is not configured for payout household';
  end if;

  perform public.ensure_allowance_credit(target_period.id, target_child.id);

  select coalesce(sum(amount_cents), 0)
  into total_approved_cents
  from public.ledger_transactions ledger
  where ledger.pay_period_id = target_period.id
    and ledger.child_profile_id = target_child.id
    and ledger.payout_household_id = target_period.household_id
    and ledger.transaction_type in ('approved_credit', 'allowance_credit', 'manual_adjustment');

  if total_approved_cents <= 0 then
    raise exception 'Payout total must be positive';
  end if;

  insert into public.payout_events (
    pay_period_id,
    child_profile_id,
    payout_household_id,
    payout_parent_id,
    total_cents,
    paid_by,
    note
  )
  values (
    target_period.id,
    target_child.id,
    target_period.household_id,
    payout_parent,
    total_approved_cents,
    auth.uid(),
    payout_note
  )
  returning id into payout_id;

  insert into public.ledger_transactions (
    child_profile_id,
    payout_household_id,
    payout_parent_id,
    pay_period_id,
    payout_event_id,
    transaction_type,
    amount_cents,
    description,
    effective_date,
    created_by
  )
  values (
    target_child.id,
    target_period.household_id,
    payout_parent,
    target_period.id,
    payout_id,
    'payout',
    -total_approved_cents,
    'Payout closeout',
    target_period.end_date,
    auth.uid()
  );

  update public.chore_submissions submission
  set photo_deleted_at = coalesce(submission.photo_deleted_at, now()),
      photo_deleted_by = coalesce(submission.photo_deleted_by, auth.uid())
  from public.ledger_transactions ledger
  where ledger.pay_period_id = target_period.id
    and ledger.child_profile_id = target_child.id
    and ledger.transaction_type = 'approved_credit'
    and ledger.chore_instance_id = submission.instance_id
    and submission.photo_storage_path is not null
    and submission.photo_deleted_at is null;

  return payout_id;
end;
$$;

grant execute on function public.ensure_allowance_credit(uuid, uuid) to authenticated;
grant execute on function public.ensure_current_allowance_credits(uuid, date) to authenticated;
