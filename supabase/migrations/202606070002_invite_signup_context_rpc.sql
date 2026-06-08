-- Public invite links need a tiny amount of invitation context before the
-- invited person has household access. Expose only active invite metadata by id.

create or replace function public.get_invite_signup_context(target_invitation_id uuid)
returns table (
  id uuid,
  email text,
  role public.household_role,
  child_display_name text
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
    invitation.child_display_name
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
