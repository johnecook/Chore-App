-- In-app notification events for chore lifecycle changes.
-- Push delivery can consume these rows later; the inbox fallback is durable now.

create type public.notification_event_type as enum (
  'chore_available',
  'chore_submitted',
  'chore_approved',
  'chore_rejected',
  'chore_reopened'
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  chore_instance_id uuid references public.chore_instances(id) on delete cascade,
  chore_submission_id uuid references public.chore_submissions(id) on delete set null,
  event_type public.notification_event_type not null,
  title text not null check (length(trim(title)) > 0),
  body text not null check (length(trim(body)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notification_events_recipient_created_at_idx
  on public.notification_events (recipient_profile_id, created_at desc);

create index notification_events_household_created_at_idx
  on public.notification_events (household_id, created_at desc);

create index notification_events_chore_instance_idx
  on public.notification_events (chore_instance_id)
  where chore_instance_id is not null;

alter table public.notification_events enable row level security;

create policy "Users can read own notification events"
on public.notification_events for select
using (recipient_profile_id = auth.uid());

create or replace function public.enqueue_notification_event(
  target_recipient_profile_id uuid,
  target_household_id uuid,
  target_actor_profile_id uuid,
  target_chore_instance_id uuid,
  target_chore_submission_id uuid,
  target_event_type public.notification_event_type,
  target_title text,
  target_body text,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_id uuid;
begin
  if target_recipient_profile_id is null then
    return null;
  end if;

  insert into public.notification_events (
    recipient_profile_id,
    household_id,
    actor_profile_id,
    chore_instance_id,
    chore_submission_id,
    event_type,
    title,
    body,
    metadata
  )
  values (
    target_recipient_profile_id,
    target_household_id,
    target_actor_profile_id,
    target_chore_instance_id,
    target_chore_submission_id,
    target_event_type,
    target_title,
    target_body,
    coalesce(target_metadata, '{}'::jsonb)
  )
  returning id into notification_id;

  return notification_id;
end;
$$;

revoke execute on function public.enqueue_notification_event(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  public.notification_event_type,
  text,
  text,
  jsonb
) from public, anon, authenticated;

create or replace function public.notify_chore_instance_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chore_title text;
  child_user_id uuid;
  latest_submission_id uuid;
  parent_user_id uuid;
begin
  select template.title
  into chore_title
  from public.chore_templates template
  where template.id = new.template_id;

  chore_title := coalesce(chore_title, 'Chore');

  if TG_OP = 'INSERT' and new.status = 'available' and new.up_for_grabs_slot then
    for child_user_id in
      select membership.user_id
      from public.household_memberships membership
      where membership.household_id = new.earning_household_id
        and membership.role = 'child'
    loop
      perform public.enqueue_notification_event(
        child_user_id,
        new.earning_household_id,
        auth.uid(),
        new.id,
        null,
        'chore_available',
        'Chore available',
        chore_title,
        jsonb_build_object('occurrence_date', new.occurrence_date)
      );
    end loop;

    return new;
  end if;

  if TG_OP = 'INSERT' then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  select submission.id
  into latest_submission_id
  from public.chore_submissions submission
  where submission.instance_id = new.id
  order by submission.attempt_number desc
  limit 1;

  select child.user_id
  into child_user_id
  from public.child_profiles child
  where child.id = new.assigned_child_profile_id;

  if new.status = 'submitted' then
    for parent_user_id in
      select membership.user_id
      from public.household_memberships membership
      where membership.household_id = new.earning_household_id
        and membership.role in ('admin', 'parent')
    loop
      perform public.enqueue_notification_event(
        parent_user_id,
        new.earning_household_id,
        child_user_id,
        new.id,
        latest_submission_id,
        'chore_submitted',
        'Chore submitted',
        chore_title,
        jsonb_build_object('occurrence_date', new.occurrence_date)
      );
    end loop;
  elsif new.status = 'approved' then
    perform public.enqueue_notification_event(
      child_user_id,
      new.earning_household_id,
      auth.uid(),
      new.id,
      latest_submission_id,
      'chore_approved',
      'Chore approved',
      chore_title,
      jsonb_build_object('occurrence_date', new.occurrence_date)
    );
  elsif new.status = 'rejected' then
    perform public.enqueue_notification_event(
      child_user_id,
      new.earning_household_id,
      auth.uid(),
      new.id,
      latest_submission_id,
      'chore_rejected',
      'Chore sent back',
      chore_title,
      jsonb_build_object('occurrence_date', new.occurrence_date)
    );
  elsif new.status = 'assigned' and old.status in ('rejected', 'expired') then
    perform public.enqueue_notification_event(
      child_user_id,
      new.earning_household_id,
      auth.uid(),
      new.id,
      latest_submission_id,
      'chore_reopened',
      'Chore reopened',
      chore_title,
      jsonb_build_object('occurrence_date', new.occurrence_date)
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.notify_chore_instance_lifecycle()
from public, anon, authenticated;

create trigger notify_chore_instance_insert
after insert on public.chore_instances
for each row execute function public.notify_chore_instance_lifecycle();

create trigger notify_chore_instance_status_update
after update of status on public.chore_instances
for each row execute function public.notify_chore_instance_lifecycle();
