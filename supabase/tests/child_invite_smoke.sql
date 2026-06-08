-- Local smoke test for parent-created child invitation and child acceptance.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000301';
  child_id uuid := '00000000-0000-4000-8000-000000000302';
  created_household_id uuid;
  invitation_id uuid;
  child_profile_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'invite-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Invite Parent'),
      false,
      false
    ),
    (
      child_id,
      'invite-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Invite Child'),
      false,
      false
    );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

	  created_household_id := public.create_parent_household(
	    household_name => 'Invite Household',
	    household_timezone => 'America/Chicago',
	    money_features_enabled => true,
	    pay_weekday => 5
	  );

  invitation_id := public.create_child_invitation(
    created_household_id,
    'invite-child@example.test',
    'Invite Child'
  );

  if not exists (
    select 1
    from public.household_invitations invitation
    where invitation.id = invitation_id
      and invitation.household_id = created_household_id
      and invitation.email = 'invite-child@example.test'
      and invitation.role = 'child'
      and invitation.accepted_at is null
  ) then
    raise exception 'Expected open child invitation';
  end if;

  if not exists (
    select 1
    from public.get_invite_signup_context(invitation_id) context
    where context.id = invitation_id
      and context.email = 'invite-child@example.test'
      and context.role = 'child'
      and context.child_display_name = 'Invite Child'
  ) then
    raise exception 'Expected child invite signup context';
  end if;

  perform set_config('request.jwt.claim.sub', child_id::text, true);

  child_profile_id := public.accept_child_invitation(invitation_id);

  if child_profile_id is null then
    raise exception 'Expected child profile id';
  end if;

  if not exists (
    select 1
    from public.household_memberships membership
    where membership.household_id = created_household_id
      and membership.user_id = child_id
      and membership.role = 'child'
      and not membership.is_primary_payout_parent
  ) then
    raise exception 'Expected child household membership';
  end if;

  if not exists (
    select 1
    from public.child_profiles child
    where child.id = child_profile_id
      and child.user_id = child_id
      and child.primary_household_id = created_household_id
      and child.created_by = parent_id
  ) then
    raise exception 'Expected child profile';
  end if;

  if not exists (
    select 1
    from public.household_invitations invitation
    where invitation.id = invitation_id
      and invitation.accepted_at is not null
      and invitation.accepted_by = child_id
  ) then
    raise exception 'Expected accepted invitation';
  end if;
end $$;
