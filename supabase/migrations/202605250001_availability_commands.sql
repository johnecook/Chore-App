-- Parent commands for child custody availability patterns and date overrides.

create or replace function public.upsert_child_availability_window(
  target_child_profile_id uuid,
  target_household_id uuid,
  target_anchor_date date,
  target_cycle_length_days int,
  target_available_day_offsets int[],
  target_starts_on date default null,
  target_ends_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_child public.child_profiles%rowtype;
  window_id uuid;
begin
  if not public.is_household_parent(target_household_id) then
    raise exception 'Current user cannot manage availability for this household';
  end if;

  select *
  into target_child
  from public.child_profiles
  where id = target_child_profile_id;

  if not found then
    raise exception 'Child profile not found';
  end if;

  if not exists (
    select 1
    from public.household_memberships membership
    where membership.household_id = target_household_id
      and membership.user_id = target_child.user_id
      and membership.role = 'child'
  ) then
    raise exception 'Child is not a member of this household';
  end if;

  insert into public.child_household_availability_windows (
    child_profile_id,
    child_user_id,
    household_id,
    anchor_date,
    cycle_length_days,
    available_day_offsets,
    starts_on,
    ends_on,
    created_by
  )
  values (
    target_child.id,
    target_child.user_id,
    target_household_id,
    target_anchor_date,
    target_cycle_length_days,
    target_available_day_offsets,
    target_starts_on,
    target_ends_on,
    auth.uid()
  )
  on conflict (child_profile_id, household_id) do update
  set anchor_date = excluded.anchor_date,
      cycle_length_days = excluded.cycle_length_days,
      available_day_offsets = excluded.available_day_offsets,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on
  returning id into window_id;

  return window_id;
end;
$$;

create or replace function public.upsert_child_availability_override(
  target_child_profile_id uuid,
  target_household_id uuid,
  target_override_date date,
  target_available boolean,
  target_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_child public.child_profiles%rowtype;
  override_id uuid;
begin
  if not public.is_household_parent(target_household_id) then
    raise exception 'Current user cannot manage availability for this household';
  end if;

  select *
  into target_child
  from public.child_profiles
  where id = target_child_profile_id;

  if not found then
    raise exception 'Child profile not found';
  end if;

  if not exists (
    select 1
    from public.household_memberships membership
    where membership.household_id = target_household_id
      and membership.user_id = target_child.user_id
      and membership.role = 'child'
  ) then
    raise exception 'Child is not a member of this household';
  end if;

  insert into public.child_household_availability_overrides (
    child_profile_id,
    child_user_id,
    household_id,
    override_date,
    available,
    reason,
    created_by
  )
  values (
    target_child.id,
    target_child.user_id,
    target_household_id,
    target_override_date,
    target_available,
    nullif(trim(target_reason), ''),
    auth.uid()
  )
  on conflict (child_profile_id, household_id, override_date) do update
  set available = excluded.available,
      reason = excluded.reason
  returning id into override_id;

  return override_id;
end;
$$;

create or replace function public.delete_child_availability_override(
  target_override_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_override public.child_household_availability_overrides%rowtype;
begin
  select *
  into target_override
  from public.child_household_availability_overrides
  where id = target_override_id;

  if not found then
    return;
  end if;

  if not public.is_household_parent(target_override.household_id) then
    raise exception 'Current user cannot delete this availability override';
  end if;

  delete from public.child_household_availability_overrides
  where id = target_override.id;
end;
$$;
