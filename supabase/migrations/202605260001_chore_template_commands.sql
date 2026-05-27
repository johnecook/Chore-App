-- Atomic parent command for chore template creation.
-- One-off templates generate their first usable instance immediately.

create or replace function public.combine_chore_due_window(
  target_household_id uuid,
  target_occurrence_date date,
  target_due_time time
)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select (target_occurrence_date + target_due_time) at time zone household.timezone
  from public.households household
  where household.id = target_household_id
$$;

create or replace function public.create_chore_template(
  target_household_id uuid,
  chore_title text,
  chore_description text default null,
  chore_schedule_type public.chore_schedule_type default 'one_off',
  chore_start_date date default current_date,
  chore_weekly_weekdays int[] default null,
  chore_interval_days int default null,
  chore_one_off_date date default null,
  chore_due_time_start time default null,
  chore_due_time_end time default null,
  chore_assignment_mode public.chore_assignment_mode default 'selected_children',
  chore_value_model public.chore_value_model default 'unpaid',
  chore_amount_cents int default 0,
  chore_photo_required boolean default true,
  chore_approval_required boolean default true,
  selected_child_profile_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  template_id uuid;
  child_count int;
  due_window_start timestamptz;
  due_window_end timestamptz;
  occurrence_date date;
begin
  if not public.is_household_parent(target_household_id) then
    raise exception 'Current user cannot create chores for this household';
  end if;

  if chore_assignment_mode = 'selected_children'
    and coalesce(cardinality(selected_child_profile_ids), 0) = 0 then
    raise exception 'Choose at least one child for a selected-child chore';
  end if;

  if chore_assignment_mode <> 'selected_children'
    and coalesce(cardinality(selected_child_profile_ids), 0) > 0 then
    raise exception 'Selected children are only valid for selected-child chores';
  end if;

  if selected_child_profile_ids is not null then
    select count(*)
    into child_count
    from unnest(selected_child_profile_ids) as selected(child_profile_id)
    where not exists (
      select 1
      from public.child_profiles child
      join public.household_memberships membership
        on membership.user_id = child.user_id
       and membership.household_id = target_household_id
       and membership.role = 'child'
      where child.id = selected.child_profile_id
    );

    if child_count > 0 then
      raise exception 'Selected children must belong to this household';
    end if;
  end if;

  if chore_assignment_mode in ('all_eligible_children', 'up_for_grabs') then
    select count(*)
    into child_count
    from public.household_memberships membership
    where membership.household_id = target_household_id
      and membership.role = 'child';

    if child_count = 0 then
      raise exception 'Add a child before creating this chore';
    end if;
  end if;

  insert into public.chore_templates (
    household_id,
    created_by,
    title,
    description,
    schedule_type,
    start_date,
    weekly_weekdays,
    interval_days,
    one_off_date,
    due_time_start,
    due_time_end,
    assignment_mode,
    value_model,
    amount_cents,
    photo_required,
    approval_required
  )
  values (
    target_household_id,
    auth.uid(),
    chore_title,
    nullif(trim(chore_description), ''),
    chore_schedule_type,
    chore_start_date,
    chore_weekly_weekdays,
    chore_interval_days,
    chore_one_off_date,
    chore_due_time_start,
    chore_due_time_end,
    chore_assignment_mode,
    chore_value_model,
    chore_amount_cents,
    chore_photo_required,
    chore_approval_required
  )
  returning id into template_id;

  if chore_assignment_mode = 'selected_children' then
    insert into public.chore_template_assignees (template_id, child_profile_id)
    select template_id, selected.child_profile_id
    from unnest(selected_child_profile_ids) as selected(child_profile_id);
  end if;

  if chore_schedule_type = 'one_off' then
    occurrence_date := chore_one_off_date;

    if chore_due_time_start is not null then
      due_window_start := public.combine_chore_due_window(
        target_household_id,
        occurrence_date,
        chore_due_time_start
      );
    end if;

    if chore_due_time_end is not null then
      due_window_end := public.combine_chore_due_window(
        target_household_id,
        occurrence_date,
        chore_due_time_end
      );
    end if;

    if chore_assignment_mode = 'selected_children' then
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
        template_id,
        target_household_id,
        selected.child_profile_id,
        occurrence_date,
        due_window_start,
        due_window_end,
        chore_value_model,
        chore_amount_cents,
        chore_photo_required,
        chore_approval_required,
        'assigned'::public.chore_instance_status
      from unnest(selected_child_profile_ids) as selected(child_profile_id);
    elsif chore_assignment_mode = 'all_eligible_children' then
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
        template_id,
        target_household_id,
        child.id,
        occurrence_date,
        due_window_start,
        due_window_end,
        chore_value_model,
        chore_amount_cents,
        chore_photo_required,
        chore_approval_required,
        'assigned'::public.chore_instance_status
      from public.child_profiles child
      join public.household_memberships membership
        on membership.user_id = child.user_id
       and membership.household_id = target_household_id
       and membership.role = 'child';
    else
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
      values (
        template_id,
        target_household_id,
        occurrence_date,
        due_window_start,
        due_window_end,
        chore_value_model,
        chore_amount_cents,
        chore_photo_required,
        chore_approval_required,
        'available',
        true
      );
    end if;
  end if;

  return template_id;
end;
$$;
