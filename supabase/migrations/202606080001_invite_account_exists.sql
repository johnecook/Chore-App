-- Let invite links choose the right first screen: sign in for existing
-- accounts, sign up for invited emails that do not have an auth user yet.

drop function if exists public.get_invite_signup_context(uuid);

create function public.get_invite_signup_context(target_invitation_id uuid)
returns table (
  id uuid,
  email text,
  role public.household_role,
  child_display_name text,
  account_exists boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    invitation.id,
    invitation.email,
    invitation.role,
    invitation.child_display_name,
    exists (
      select 1
      from auth.users auth_user
      where lower(auth_user.email) = lower(invitation.email)
    ) as account_exists
  from public.household_invitations invitation
  where invitation.id = target_invitation_id
    and invitation.role in ('parent', 'child')
    and invitation.accepted_at is null
    and invitation.revoked_at is null
    and invitation.expires_at > now()
  limit 1;
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.get_invite_signup_context(uuid) to anon, authenticated;
