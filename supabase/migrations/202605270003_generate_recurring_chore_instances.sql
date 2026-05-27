-- Scheduled recurring chore instance generation.

create or replace function public.is_child_available_for_household_on(
  target_child_profile_id uuid,
  target_household_id uuid,
  target_date date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with override_match as (
    select availability_override.available
    from public.child_household_availability_overrides availability_override
    where availability_override.child_profile_id = target_child_profile_id
      and availability_override.household_id = target_household_id
      and availability_override.override_date = target_date
    limit 1
  ),
  window_match as (
    select
      availability_window.anchor_date,
      availability_window.cycle_length_days,
      availability_window.available_day_offsets,
      availability_window.starts_on,
      availability_window.ends_on
    from public.child_household_availability_windows availability_window
    where availability_window.child_profile_id = target_child_profile_id
      and availability_window.household_id = target_household_id
    limit 1
  )
  select coalesce(
    (select override_match.available from override_match),
    (
      select
        (window_match.starts_on is null or target_date >= window_match.starts_on)
        and (window_match.ends_on is null or target_date <= window_match.ends_on)
        and (
          (
            ((target_date - window_match.anchor_date) % window_match.cycle_length_days)
            + window_match.cycle_length_days
          ) % window_match.cycle_length_days
        ) = any(window_match.available_day_offsets)
      from window_match
    ),
    true
  )
$$;

create or replace function public.generate_chore_instances_for_range(
  range_start date default current_date,
  range_end date default current_date + 14
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count int := 0;
  batch_count int := 0;
begin
  if range_start is null or range_end is null then
    raise exception 'Generation range is required';
  end if;

  if range_start > range_end then
    raise exception 'Generation range start must be on or before range end';
  end if;

  insert into public.chore_instances (
    template_id,
    earning_household_id,
    assigned_child_profile_id,
    occurrence_date,
    due_window_start,
    due_window_end,
    value_model_snapshot,
    amount_cents_snapshot,
    photo_required_snapshot,
    approval_required_snapshot,
    status
  )
  select
    template.id,
    template.household_id,
    assignee.child_profile_id,
    occurrence.occurrence_date::date,
    case
      when template.due_time_start is null then null
      else public.combine_chore_due_window(
        template.household_id,
        occurrence.occurrence_date::date,
        template.due_time_start
      )
    end,
    case
      when template.due_time_end is null then null
      else public.combine_chore_due_window(
        template.household_id,
        occurrence.occurrence_date::date,
        template.due_time_end
      )
    end,
    template.value_model,
    template.amount_cents,
    template.photo_required,
    template.approval_required,
    'assigned'::public.chore_instance_status
  from public.chore_templates template
  join generate_series(range_start, range_end, interval '1 day') occurrence(occurrence_date)
    on true
  join public.chore_template_assignees assignee
    on assignee.template_id = template.id
  where template.active
    and template.assignment_mode = 'selected_children'
    and template.schedule_type in ('daily', 'weekly', 'interval')
    and occurrence.occurrence_date::date >= template.start_date
    and (template.end_date is null or occurrence.occurrence_date::date <= template.end_date)
    and (
      template.schedule_type = 'daily'
      or (
        template.schedule_type = 'weekly'
        and extract(dow from occurrence.occurrence_date::date)::int = any(template.weekly_weekdays)
      )
      or (
        template.schedule_type = 'interval'
        and ((occurrence.occurrence_date::date - template.start_date) % template.interval_days) = 0
      )
    )
    and public.is_child_available_for_household_on(
      assignee.child_profile_id,
      template.household_id,
      occurrence.occurrence_date::date
    )
  on conflict do nothing;

  get diagnostics batch_count = row_count;
  inserted_count := inserted_count + batch_count;

  insert into public.chore_instances (
    template_id,
    earning_household_id,
    assigned_child_profile_id,
    occurrence_date,
    due_window_start,
    due_window_end,
    value_model_snapshot,
    amount_cents_snapshot,
    photo_required_snapshot,
    approval_required_snapshot,
    status
  )
  select
    template.id,
    template.household_id,
    child.id,
    occurrence.occurrence_date::date,
    case
      when template.due_time_start is null then null
      else public.combine_chore_due_window(
        template.household_id,
        occurrence.occurrence_date::date,
        template.due_time_start
      )
    end,
    case
      when template.due_time_end is null then null
      else public.combine_chore_due_window(
        template.household_id,
        occurrence.occurrence_date::date,
        template.due_time_end
      )
    end,
    template.value_model,
    template.amount_cents,
    template.photo_required,
    template.approval_required,
    'assigned'::public.chore_instance_status
  from public.chore_templates template
  join generate_series(range_start, range_end, interval '1 day') occurrence(occurrence_date)
    on true
  join public.household_memberships membership
    on membership.household_id = template.household_id
   and membership.role = 'child'
  join public.child_profiles child
    on child.user_id = membership.user_id
  where template.active
    and template.assignment_mode = 'all_eligible_children'
    and template.schedule_type in ('daily', 'weekly', 'interval')
    and occurrence.occurrence_date::date >= template.start_date
    and (template.end_date is null or occurrence.occurrence_date::date <= template.end_date)
    and (
      template.schedule_type = 'daily'
      or (
        template.schedule_type = 'weekly'
        and extract(dow from occurrence.occurrence_date::date)::int = any(template.weekly_weekdays)
      )
      or (
        template.schedule_type = 'interval'
        and ((occurrence.occurrence_date::date - template.start_date) % template.interval_days) = 0
      )
    )
    and public.is_child_available_for_household_on(
      child.id,
      template.household_id,
      occurrence.occurrence_date::date
    )
  on conflict do nothing;

  get diagnostics batch_count = row_count;
  inserted_count := inserted_count + batch_count;

  insert into public.chore_instances (
    template_id,
    earning_household_id,
    occurrence_date,
    due_window_start,
    due_window_end,
    value_model_snapshot,
    amount_cents_snapshot,
    photo_required_snapshot,
    approval_required_snapshot,
    status,
    up_for_grabs_slot
  )
  select
    template.id,
    template.household_id,
    occurrence.occurrence_date::date,
    case
      when template.due_time_start is null then null
      else public.combine_chore_due_window(
        template.household_id,
        occurrence.occurrence_date::date,
        template.due_time_start
      )
    end,
    case
      when template.due_time_end is null then null
      else public.combine_chore_due_window(
        template.household_id,
        occurrence.occurrence_date::date,
        template.due_time_end
      )
    end,
    template.value_model,
    template.amount_cents,
    template.photo_required,
    template.approval_required,
    'available'::public.chore_instance_status,
    true
  from public.chore_templates template
  join generate_series(range_start, range_end, interval '1 day') occurrence(occurrence_date)
    on true
  where template.active
    and template.assignment_mode = 'up_for_grabs'
    and template.schedule_type in ('daily', 'weekly', 'interval')
    and occurrence.occurrence_date::date >= template.start_date
    and (template.end_date is null or occurrence.occurrence_date::date <= template.end_date)
    and (
      template.schedule_type = 'daily'
      or (
        template.schedule_type = 'weekly'
        and extract(dow from occurrence.occurrence_date::date)::int = any(template.weekly_weekdays)
      )
      or (
        template.schedule_type = 'interval'
        and ((occurrence.occurrence_date::date - template.start_date) % template.interval_days) = 0
      )
    )
    and exists (
      select 1
      from public.household_memberships membership
      join public.child_profiles child
        on child.user_id = membership.user_id
      where membership.household_id = template.household_id
        and membership.role = 'child'
        and public.is_child_available_for_household_on(
          child.id,
          template.household_id,
          occurrence.occurrence_date::date
        )
    )
  on conflict do nothing;

  get diagnostics batch_count = row_count;
  inserted_count := inserted_count + batch_count;

  return inserted_count;
end;
$$;

do $$
begin
  perform cron.unschedule('generate-recurring-chore-instances');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'generate-recurring-chore-instances',
  '7 * * * *',
  $$select public.generate_chore_instances_for_range(current_date, current_date + 14);$$
);
