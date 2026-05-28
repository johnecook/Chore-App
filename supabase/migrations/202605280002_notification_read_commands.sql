-- Commands for recipient-owned notification inbox state.

create or replace function public.mark_notification_events_read(
  target_notification_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  marked_count int;
begin
  update public.notification_events event
  set read_at = coalesce(event.read_at, now())
  where event.recipient_profile_id = auth.uid()
    and event.read_at is null
    and (
      target_notification_id is null
      or event.id = target_notification_id
    );

  get diagnostics marked_count = row_count;
  return marked_count;
end;
$$;

revoke execute on function public.mark_notification_events_read(uuid) from public, anon;
grant execute on function public.mark_notification_events_read(uuid) to authenticated;
