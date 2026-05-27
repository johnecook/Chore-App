-- Child invitation flow for parent-created invites and child acceptance.

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null check (length(trim(email)) > 0),
  role public.household_role not null,
  child_display_name text,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete restrict,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint household_invitations_role
    check (role in ('parent', 'child')),
  constraint household_invitations_terminal_state
    check (accepted_at is null or revoked_at is null),
  constraint household_invitations_acceptance_shape
    check (
      (accepted_at is null and accepted_by is null)
      or (accepted_at is not null and accepted_by is not null)
    )
);

create unique index household_invitations_one_open_invite_per_email
  on public.household_invitations (household_id, lower(email), role)
  where accepted_at is null and revoked_at is null;

create or replace function public.create_child_invitation(
  target_household_id uuid,
  child_email text,
  child_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid;
begin
  if not public.is_household_parent(target_household_id) then
    raise exception 'Current user cannot invite children to this household';
  end if;

  if child_email is null or length(trim(child_email)) = 0 then
    raise exception 'Child email is required';
  end if;

  insert into public.household_invitations (
    household_id,
    email,
    role,
    child_display_name,
    invited_by
  )
  values (
    target_household_id,
    lower(trim(child_email)),
    'child',
    nullif(trim(child_display_name), ''),
    auth.uid()
  )
  returning id into invitation_id;

  return invitation_id;
end;
$$;

create or replace function public.accept_child_invitation(target_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invitation public.household_invitations%rowtype;
  current_profile public.profiles%rowtype;
  current_email text;
  child_profile_id uuid;
begin
  select *
  into target_invitation
  from public.household_invitations
  where id = target_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if target_invitation.role <> 'child' then
    raise exception 'Invitation is not for a child account';
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

  if current_profile.app_role <> 'child' then
    raise exception 'Only child accounts can accept child invitations';
  end if;

  select lower(auth_user.email)
  into current_email
  from auth.users auth_user
  where auth_user.id = auth.uid();

  if current_email is null or current_email <> lower(target_invitation.email) then
    raise exception 'Signed-in child email does not match this invitation';
  end if;

  insert into public.household_memberships (
    household_id,
    user_id,
    role,
    is_primary_payout_parent
  )
  values (
    target_invitation.household_id,
    current_profile.id,
    'child',
    false
  )
  on conflict (household_id, user_id) do update
  set role = excluded.role,
      is_primary_payout_parent = false;

  insert into public.child_profiles (
    user_id,
    primary_household_id,
    created_by
  )
  values (
    current_profile.id,
    target_invitation.household_id,
    target_invitation.invited_by
  )
  on conflict (user_id) do nothing;

  select id
  into child_profile_id
  from public.child_profiles
  where user_id = current_profile.id;

  update public.household_invitations
  set accepted_at = now(),
      accepted_by = current_profile.id
  where id = target_invitation.id;

  return child_profile_id;
end;
$$;

create or replace function public.revoke_household_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invitation public.household_invitations%rowtype;
begin
  select *
  into target_invitation
  from public.household_invitations
  where id = target_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if not public.is_household_parent(target_invitation.household_id) then
    raise exception 'Current user cannot revoke this invitation';
  end if;

  if target_invitation.accepted_at is not null then
    raise exception 'Accepted invitations cannot be revoked';
  end if;

  update public.household_invitations
  set revoked_at = now()
  where id = target_invitation.id
    and revoked_at is null;
end;
$$;

alter table public.household_invitations enable row level security;

create policy "Household parents can read invitations"
on public.household_invitations for select
using (public.is_household_parent(household_id));

create policy "Household parents can manage invitations"
on public.household_invitations for all
using (public.is_household_parent(household_id))
with check (public.is_household_parent(household_id));
