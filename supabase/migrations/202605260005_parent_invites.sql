-- Parent invitation commands for adding co-parents to an existing household.
-- Parent accounts are one-household-at-a-time; accepting a parent invite
-- disconnects the parent from any previous parent/admin household membership.

create unique index household_memberships_one_parent_household_per_user
  on public.household_memberships (user_id)
  where role in ('admin', 'parent');

create or replace function public.create_parent_invitation(
  target_household_id uuid,
  parent_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid;
begin
  if not public.is_household_admin(target_household_id) then
    raise exception 'Only household admins can invite parents to this household';
  end if;

  if parent_email is null or length(trim(parent_email)) = 0 then
    raise exception 'Parent email is required';
  end if;

  insert into public.household_invitations (
    household_id,
    email,
    role,
    invited_by
  )
  values (
    target_household_id,
    lower(trim(parent_email)),
    'parent',
    auth.uid()
  )
  returning id into invitation_id;

  return invitation_id;
end;
$$;

create or replace function public.accept_parent_invitation(target_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invitation public.household_invitations%rowtype;
  current_profile public.profiles%rowtype;
  current_email text;
  membership_id uuid;
begin
  select *
  into target_invitation
  from public.household_invitations
  where id = target_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if target_invitation.role <> 'parent' then
    raise exception 'Invitation is not for a parent account';
  end if;

  if target_invitation.accepted_at is not null then
    raise exception 'Invitation has already been accepted';
  end if;

  if target_invitation.revoked_at is not null then
    raise exception 'Invitation has been revoked';
  end if;

  if target_invitation.expires_at <= now() then
    raise exception 'Invitation has expired';
  end if;

  select *
  into current_profile
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Current user profile not found';
  end if;

  if current_profile.app_role <> 'parent' then
    raise exception 'Only parent accounts can accept parent invitations';
  end if;

  select lower(auth_user.email)
  into current_email
  from auth.users auth_user
  where auth_user.id = auth.uid();

  if current_email is null or current_email <> lower(target_invitation.email) then
    raise exception 'Signed-in parent email does not match this invitation';
  end if;

  delete from public.household_memberships membership
  where membership.user_id = current_profile.id
    and membership.role in ('admin', 'parent')
    and membership.household_id <> target_invitation.household_id;

  insert into public.household_memberships (
    household_id,
    user_id,
    role,
    is_primary_payout_parent
  )
  values (
    target_invitation.household_id,
    current_profile.id,
    'parent',
    false
  )
  on conflict (household_id, user_id) do update
  set role = case
      when public.household_memberships.role = 'admin' then 'admin'::public.household_role
      else 'parent'::public.household_role
    end,
    is_primary_payout_parent = public.household_memberships.is_primary_payout_parent
  returning id into membership_id;

  update public.household_invitations
  set accepted_at = now(),
      accepted_by = current_profile.id
  where id = target_invitation.id;

  return membership_id;
end;
$$;
