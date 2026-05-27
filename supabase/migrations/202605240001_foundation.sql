-- Foundation schema for household membership, child profiles, payout ownership,
-- and custody availability. Chore and ledger tables come in later migrations.

create extension if not exists pgcrypto;

create type public.app_role as enum ('parent', 'child');
create type public.household_role as enum ('admin', 'parent', 'child');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  app_role public.app_role not null,
  display_name text not null check (length(trim(display_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  timezone text not null default 'America/Chicago' check (length(trim(timezone)) > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null,
  is_primary_payout_parent boolean not null default false,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id),
  unique (user_id, household_id),
  constraint primary_payout_parent_must_be_parent_role
    check (is_primary_payout_parent = false or role in ('admin', 'parent'))
);

create unique index household_memberships_one_primary_payout_parent
  on public.household_memberships (household_id)
  where is_primary_payout_parent;

create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  primary_household_id uuid not null references public.households(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint child_primary_household_membership
    foreign key (user_id, primary_household_id)
    references public.household_memberships(user_id, household_id)
    on delete restrict
);

create or replace function public.valid_day_offsets(offsets int[], cycle_length int)
returns boolean
language sql
immutable
strict
as $$
  select
    cycle_length > 0
    and cardinality(offsets) > 0
    and not exists (
      select 1
      from unnest(offsets) as offset_value
      where offset_value < 0 or offset_value >= cycle_length
    )
    and (
      select count(distinct offset_value)
      from unnest(offsets) as offset_value
    ) = cardinality(offsets)
$$;

create table public.child_household_availability_windows (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  child_user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  anchor_date date not null,
  cycle_length_days int not null check (cycle_length_days > 0),
  available_day_offsets int[] not null,
  starts_on date,
  ends_on date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_window_offsets_valid
    check (public.valid_day_offsets(available_day_offsets, cycle_length_days)),
  constraint availability_window_date_order
    check (starts_on is null or ends_on is null or starts_on <= ends_on),
  unique (child_profile_id, household_id),
  constraint availability_window_child_profile_user
    foreign key (child_profile_id, child_user_id)
    references public.child_profiles(id, user_id)
    on delete cascade,
  constraint availability_window_child_household_membership
    foreign key (child_user_id, household_id)
    references public.household_memberships(user_id, household_id)
    on delete cascade
);

create table public.child_household_availability_overrides (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  child_user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  override_date date not null,
  available boolean not null,
  reason text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_profile_id, household_id, override_date),
  constraint availability_override_child_profile_user
    foreign key (child_profile_id, child_user_id)
    references public.child_profiles(id, user_id)
    on delete cascade,
  constraint availability_override_child_household_membership
    foreign key (child_user_id, household_id)
    references public.household_memberships(user_id, household_id)
    on delete cascade
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_households_updated_at
before update on public.households
for each row execute function public.set_updated_at();

create trigger set_household_memberships_updated_at
before update on public.household_memberships
for each row execute function public.set_updated_at();

create trigger set_child_profiles_updated_at
before update on public.child_profiles
for each row execute function public.set_updated_at();

create trigger set_availability_windows_updated_at
before update on public.child_household_availability_windows
for each row execute function public.set_updated_at();

create trigger set_availability_overrides_updated_at
before update on public.child_household_availability_overrides
for each row execute function public.set_updated_at();

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_memberships membership
    where membership.household_id = target_household_id
      and membership.user_id = auth.uid()
  )
$$;

create or replace function public.is_household_parent(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_memberships membership
    where membership.household_id = target_household_id
      and membership.user_id = auth.uid()
      and membership.role in ('admin', 'parent')
  )
$$;

create or replace function public.is_household_admin(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_memberships membership
    where membership.household_id = target_household_id
      and membership.user_id = auth.uid()
      and membership.role = 'admin'
  )
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_memberships enable row level security;
alter table public.child_profiles enable row level security;
alter table public.child_household_availability_windows enable row level security;
alter table public.child_household_availability_overrides enable row level security;

create policy "Users can read own profile"
on public.profiles for select
using (id = auth.uid());

create policy "Users can update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Household members can read households"
on public.households for select
using (public.is_household_member(id));

create policy "Household admins can update households"
on public.households for update
using (public.is_household_admin(id))
with check (public.is_household_admin(id));

create policy "Household members can read memberships"
on public.household_memberships for select
using (public.is_household_member(household_id));

create policy "Household admins can insert memberships"
on public.household_memberships for insert
with check (public.is_household_admin(household_id));

create policy "Household admins can update memberships"
on public.household_memberships for update
using (public.is_household_admin(household_id))
with check (public.is_household_admin(household_id));

create policy "Users can read own child profile"
on public.child_profiles for select
using (user_id = auth.uid());

create policy "Household parents can read household child profiles"
on public.child_profiles for select
using (public.is_household_parent(primary_household_id));

create policy "Household admins can update household child profiles"
on public.child_profiles for update
using (public.is_household_admin(primary_household_id))
with check (public.is_household_admin(primary_household_id));

create policy "Household members can read availability windows"
on public.child_household_availability_windows for select
using (public.is_household_member(household_id));

create policy "Household admins can manage availability windows"
on public.child_household_availability_windows for all
using (public.is_household_admin(household_id))
with check (public.is_household_admin(household_id));

create policy "Household members can read availability overrides"
on public.child_household_availability_overrides for select
using (public.is_household_member(household_id));

create policy "Household admins can manage availability overrides"
on public.child_household_availability_overrides for all
using (public.is_household_admin(household_id))
with check (public.is_household_admin(household_id));
