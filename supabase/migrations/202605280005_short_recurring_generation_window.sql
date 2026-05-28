-- Keep generated chore instances near-term so parent and kid views stay focused.

create or replace function public.generate_chore_instances_for_range(
  range_start date default current_date,
  range_end date default current_date + 1
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
  $$select public.generate_chore_instances_for_range(current_date, current_date + 1);$$
);
