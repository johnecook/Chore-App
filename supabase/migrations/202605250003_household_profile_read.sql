-- Let household members read display profiles for other members in the same household.

create or replace function public.is_household_co_member(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_memberships current_membership
    join public.household_memberships target_membership
      on target_membership.household_id = current_membership.household_id
    where current_membership.user_id = auth.uid()
      and target_membership.user_id = target_user_id
  )
$$;

create policy "Household members can read co-member profiles"
on public.profiles for select
using (public.is_household_co_member(id));
