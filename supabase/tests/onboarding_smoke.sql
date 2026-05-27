-- Local smoke test for parent household onboarding.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000201';
  created_household_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values (
    parent_id,
    'onboarding-parent@example.test',
    jsonb_build_object('app_role', 'parent', 'display_name', 'Onboarding Parent'),
    false,
    false
  );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

	  created_household_id := public.create_parent_household(
	    household_name => 'Cook Household',
	    household_timezone => 'America/Chicago',
	    money_features_enabled => true,
	    pay_weekday => 5,
	    pay_cycle => 'biweekly',
	    biweekly_anchor_date => '2026-06-05'
	  );

  if created_household_id is null then
    raise exception 'Expected household id';
  end if;

  if not exists (
    select 1
    from public.households household
    where household.id = created_household_id
	      and household.name = 'Cook Household'
	      and household.timezone = 'America/Chicago'
	      and household.money_features_enabled
	      and household.created_by = parent_id
  ) then
    raise exception 'Expected household row';
  end if;

  if not exists (
    select 1
    from public.household_memberships membership
    where membership.household_id = created_household_id
      and membership.user_id = parent_id
      and membership.role = 'admin'
      and membership.is_primary_payout_parent
  ) then
    raise exception 'Expected admin payout membership';
  end if;

  if not exists (
    select 1
    from public.pay_cycle_settings settings
    where settings.household_id = created_household_id
      and settings.cycle_type = 'biweekly'
      and settings.biweekly_weekday = 5
      and settings.biweekly_anchor_date = '2026-06-05'
      and settings.created_by = parent_id
	  ) then
	    raise exception 'Expected biweekly pay cycle setting';
	  end if;

	  created_household_id := public.create_parent_household(
	    household_name => 'Chores Only Household',
	    household_timezone => 'America/Chicago',
	    money_features_enabled => false
	  );

	  if not exists (
	    select 1
	    from public.households household
	    where household.id = created_household_id
	      and household.money_features_enabled = false
	  ) then
	    raise exception 'Expected chores-only household row';
	  end if;

	  if exists (
	    select 1
	    from public.household_memberships membership
	    where membership.household_id = created_household_id
	      and membership.is_primary_payout_parent
	  ) then
	    raise exception 'Chores-only household should not have a primary payout parent';
	  end if;

	  if exists (
	    select 1
	    from public.pay_cycle_settings settings
	    where settings.household_id = created_household_id
	  ) then
	    raise exception 'Chores-only household should not have pay cycle settings';
	  end if;
	end $$;
