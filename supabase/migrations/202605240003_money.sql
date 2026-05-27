-- Pay cycle, pay period, append-only ledger, and payout closeout schema.

create type public.pay_cycle_type as enum ('weekly', 'biweekly', 'monthly_date', 'monthly_weekday');
create type public.monthly_ordinal as enum ('1', '2', '3', '4', 'last');
create type public.ledger_transaction_type as enum ('pending_credit', 'approved_credit', 'manual_adjustment', 'payout');

create table public.pay_cycle_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households(id) on delete cascade,
  cycle_type public.pay_cycle_type not null,
  weekly_weekday int,
  biweekly_weekday int,
  biweekly_anchor_date date,
  monthly_day int,
  monthly_ordinal public.monthly_ordinal,
  monthly_weekday int,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_cycle_weekday_values
    check (
      (weekly_weekday is null or weekly_weekday between 0 and 6)
      and (biweekly_weekday is null or biweekly_weekday between 0 and 6)
      and (monthly_weekday is null or monthly_weekday between 0 and 6)
    ),
  constraint pay_cycle_monthly_day_value
    check (monthly_day is null or monthly_day between 1 and 31),
  constraint pay_cycle_weekly_shape
    check (
      (cycle_type = 'weekly' and weekly_weekday is not null)
      or (cycle_type <> 'weekly' and weekly_weekday is null)
    ),
  constraint pay_cycle_biweekly_shape
    check (
      (cycle_type = 'biweekly' and biweekly_weekday is not null and biweekly_anchor_date is not null)
      or (cycle_type <> 'biweekly' and biweekly_weekday is null and biweekly_anchor_date is null)
    ),
  constraint pay_cycle_monthly_date_shape
    check (
      (cycle_type = 'monthly_date' and monthly_day is not null)
      or (cycle_type <> 'monthly_date' and monthly_day is null)
    ),
  constraint pay_cycle_monthly_weekday_shape
    check (
      (cycle_type = 'monthly_weekday' and monthly_ordinal is not null and monthly_weekday is not null)
      or (cycle_type <> 'monthly_weekday' and monthly_ordinal is null and monthly_weekday is null)
    )
);

create table public.pay_periods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  cycle_type public.pay_cycle_type not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_periods_date_order check (start_date <= end_date),
  unique (household_id, start_date, end_date)
);

create table public.payout_events (
  id uuid primary key default gen_random_uuid(),
  pay_period_id uuid not null references public.pay_periods(id) on delete restrict,
  child_profile_id uuid not null references public.child_profiles(id) on delete restrict,
  payout_household_id uuid not null references public.households(id) on delete restrict,
  payout_parent_id uuid not null references public.profiles(id) on delete restrict,
  total_cents int not null check (total_cents >= 0),
  paid_by uuid not null references public.profiles(id) on delete restrict,
  paid_at timestamptz not null default now(),
  note text,
  unique (pay_period_id, child_profile_id)
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles(id) on delete restrict,
  earning_household_id uuid references public.households(id) on delete restrict,
  payout_household_id uuid not null references public.households(id) on delete restrict,
  payout_parent_id uuid not null references public.profiles(id) on delete restrict,
  pay_period_id uuid references public.pay_periods(id) on delete restrict,
  chore_instance_id uuid references public.chore_instances(id) on delete restrict,
  approval_event_id uuid references public.approval_events(id) on delete restrict,
  payout_event_id uuid references public.payout_events(id) on delete restrict,
  transaction_type public.ledger_transaction_type not null,
  amount_cents int not null,
  description text,
  effective_date date not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint ledger_amount_shape
    check (
      (transaction_type in ('pending_credit', 'approved_credit') and amount_cents > 0)
      or (transaction_type = 'manual_adjustment' and amount_cents <> 0)
      or (transaction_type = 'payout' and amount_cents < 0)
    ),
  constraint ledger_pay_period_shape
    check (
      (transaction_type = 'pending_credit' and pay_period_id is null)
      or (transaction_type <> 'pending_credit' and pay_period_id is not null)
    ),
  constraint ledger_chore_shape
    check (
      (transaction_type in ('pending_credit', 'approved_credit') and chore_instance_id is not null)
      or (transaction_type not in ('pending_credit', 'approved_credit') and chore_instance_id is null)
    ),
  constraint ledger_approval_shape
    check (
      (transaction_type = 'approved_credit' and approval_event_id is not null)
      or (transaction_type <> 'approved_credit' and approval_event_id is null)
    ),
  constraint ledger_payout_shape
    check (
      (transaction_type = 'payout' and payout_event_id is not null)
      or (transaction_type <> 'payout' and payout_event_id is null)
    )
);

create unique index ledger_one_pending_credit_per_chore_instance
  on public.ledger_transactions (chore_instance_id)
  where transaction_type = 'pending_credit';

create unique index ledger_one_approved_credit_per_approval_event
  on public.ledger_transactions (approval_event_id)
  where transaction_type = 'approved_credit';

create unique index ledger_one_payout_transaction_per_payout_event
  on public.ledger_transactions (payout_event_id)
  where transaction_type = 'payout';

create trigger set_pay_cycle_settings_updated_at
before update on public.pay_cycle_settings
for each row execute function public.set_updated_at();

create trigger set_pay_periods_updated_at
before update on public.pay_periods
for each row execute function public.set_updated_at();

create or replace function public.validate_payout_snapshot(
  target_child_profile_id uuid,
  target_payout_household_id uuid,
  target_payout_parent_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.child_profiles child
    join public.household_memberships membership
      on membership.household_id = target_payout_household_id
      and membership.user_id = target_payout_parent_id
      and membership.role in ('admin', 'parent')
      and membership.is_primary_payout_parent
    where child.id = target_child_profile_id
      and child.primary_household_id = target_payout_household_id
  )
$$;

create or replace function public.validate_ledger_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.validate_payout_snapshot(new.child_profile_id, new.payout_household_id, new.payout_parent_id) then
    raise exception 'Ledger payout snapshot must match child primary household and current payout parent';
  end if;

  if new.pay_period_id is not null and not exists (
    select 1
    from public.pay_periods period
    where period.id = new.pay_period_id
      and period.household_id = new.payout_household_id
  ) then
    raise exception 'Ledger pay period must belong to payout household';
  end if;

  if new.payout_event_id is not null and not exists (
    select 1
    from public.payout_events payout
    where payout.id = new.payout_event_id
      and payout.pay_period_id = new.pay_period_id
      and payout.child_profile_id = new.child_profile_id
      and payout.payout_household_id = new.payout_household_id
      and payout.payout_parent_id = new.payout_parent_id
  ) then
    raise exception 'Payout ledger transaction must match payout event snapshot';
  end if;

  return new;
end;
$$;

create trigger validate_ledger_insert
before insert on public.ledger_transactions
for each row execute function public.validate_ledger_insert();

create or replace function public.validate_payout_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.validate_payout_snapshot(new.child_profile_id, new.payout_household_id, new.payout_parent_id) then
    raise exception 'Payout event must match child primary household and current payout parent';
  end if;

  if not exists (
    select 1
    from public.pay_periods period
    where period.id = new.pay_period_id
      and period.household_id = new.payout_household_id
  ) then
    raise exception 'Payout event pay period must belong to payout household';
  end if;

  return new;
end;
$$;

create trigger validate_payout_event_insert
before insert on public.payout_events
for each row execute function public.validate_payout_event_insert();

create or replace function public.prevent_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Ledger transactions are append-only';
end;
$$;

create trigger prevent_ledger_updates
before update on public.ledger_transactions
for each row execute function public.prevent_ledger_mutation();

create trigger prevent_ledger_deletes
before delete on public.ledger_transactions
for each row execute function public.prevent_ledger_mutation();

create or replace function public.pay_period_household_id(target_pay_period_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select period.household_id
  from public.pay_periods period
  where period.id = target_pay_period_id
$$;

alter table public.pay_cycle_settings enable row level security;
alter table public.pay_periods enable row level security;
alter table public.payout_events enable row level security;
alter table public.ledger_transactions enable row level security;

create policy "Household members can read pay cycle settings"
on public.pay_cycle_settings for select
using (public.is_household_member(household_id));

create policy "Household parents can manage pay cycle settings"
on public.pay_cycle_settings for all
using (public.is_household_parent(household_id))
with check (public.is_household_parent(household_id));

create policy "Household members can read pay periods"
on public.pay_periods for select
using (public.is_household_member(household_id));

create policy "Household parents can manage pay periods"
on public.pay_periods for all
using (public.is_household_parent(household_id))
with check (public.is_household_parent(household_id));

create policy "Children can read own ledger"
on public.ledger_transactions for select
using (public.is_child_profile_owner(child_profile_id));

create policy "Payout household parents can read ledger"
on public.ledger_transactions for select
using (public.is_household_parent(payout_household_id));

create policy "Payout household parents can insert ledger"
on public.ledger_transactions for insert
with check (public.is_household_parent(payout_household_id));

create policy "Children can read own payouts"
on public.payout_events for select
using (public.is_child_profile_owner(child_profile_id));

create policy "Payout household parents can read payouts"
on public.payout_events for select
using (public.is_household_parent(payout_household_id));

create policy "Payout household parents can insert payouts"
on public.payout_events for insert
with check (public.is_household_parent(payout_household_id));
