-- Local smoke test for parent invitation creation and acceptance.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  admin_id uuid := '00000000-0000-4000-8000-000000000b01';
  parent_id uuid := '00000000-0000-4000-8000-000000000b02';
  child_id uuid := '00000000-0000-4000-8000-000000000b03';
  target_household_id uuid;
  previous_household_id uuid;
  invitation_id uuid;
  membership_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      admin_id,
      'parent-invite-admin@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Invite Admin'),
      false,
      false
    ),
    (
      parent_id,
      'parent-invite-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Invited Parent'),
      false,
      false
    ),
    (
      child_id,
      'parent-invite-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Not A Parent'),
      false,
      false
    );

  perform set_config('request.jwt.claim.sub', admin_id::text, true);

  target_household_id := public.create_parent_household(
    household_name => 'Parent Invite Household',
    household_timezone => 'America/Chicago',
    money_features_enabled => true,
    pay_weekday => 5
  );

  insert into public.households (name, timezone, money_features_enabled, created_by)
  values ('Previous Parent Household', 'America/Chicago', false, admin_id)
  returning id into previous_household_id;

  insert into public.household_memberships (household_id, user_id, role, is_primary_payout_parent)
  values (previous_household_id, parent_id, 'parent', false);

  invitation_id := public.create_parent_invitation(
    target_household_id,
    'parent-invite-parent@example.test'
  );

  if not exists (
    select 1
    from public.household_invitations invitation
    where invitation.id = invitation_id
      and invitation.household_id = target_household_id
      and invitation.email = 'parent-invite-parent@example.test'
      and invitation.role = 'parent'
      and invitation.accepted_at is null
  ) then
    raise exception 'Expected open parent invitation';
  end if;

  perform set_config('request.jwt.claim.sub', child_id::text, true);

  begin
    perform public.accept_parent_invitation(invitation_id);
    raise exception 'Expected child account to be rejected from parent invite';
  exception
    when others then
      if sqlerrm <> 'Only parent accounts can accept parent invitations' then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', parent_id::text, true);
  membership_id := public.accept_parent_invitation(invitation_id);

  if membership_id is null then
    raise exception 'Expected membership id';
  end if;

  if not exists (
    select 1
    from public.household_memberships membership
    where membership.id = membership_id
      and membership.household_id = target_household_id
      and membership.user_id = parent_id
      and membership.role = 'parent'
      and membership.is_primary_payout_parent = false
  ) then
    raise exception 'Expected invited parent membership';
  end if;

  if exists (
    select 1
    from public.household_memberships membership
    where membership.household_id = previous_household_id
      and membership.user_id = parent_id
      and membership.role in ('admin', 'parent')
  ) then
    raise exception 'Expected invited parent to be disconnected from previous household';
  end if;

  if not exists (
    select 1
    from public.household_invitations invitation
    where invitation.id = invitation_id
      and invitation.accepted_by = parent_id
      and invitation.accepted_at is not null
  ) then
    raise exception 'Expected accepted parent invitation metadata';
  end if;
end $$;
