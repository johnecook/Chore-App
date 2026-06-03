-- Household-level money defaults and child-level base allowance settings.

create type public.household_money_mode as enum ('none', 'per_chore', 'allowance_plus_bonus');

alter table public.households
add column money_mode public.household_money_mode not null default 'per_chore';

update public.households
set money_mode = case
  when money_features_enabled then 'per_chore'::public.household_money_mode
  else 'none'::public.household_money_mode
end;

create or replace function public.sync_household_money_mode()
returns trigger
language plpgsql
as $$
begin
  if new.money_features_enabled = false then
    new.money_mode := 'none';
  elsif new.money_mode = 'none' then
    new.money_mode := 'per_chore';
  end if;

  return new;
end;
$$;

create trigger sync_household_money_mode
before insert or update on public.households
for each row execute function public.sync_household_money_mode();

alter table public.households
add constraint households_money_mode_consistency
check (
  (money_mode = 'none' and money_features_enabled = false)
  or (money_mode <> 'none' and money_features_enabled = true)
);

alter table public.child_profiles
add column allowance_enabled boolean not null default false,
add column base_allowance_cents int not null default 0;

alter table public.child_profiles
add constraint child_profiles_base_allowance_cents_nonnegative
check (base_allowance_cents >= 0);

alter type public.ledger_transaction_type add value if not exists 'allowance_credit';
