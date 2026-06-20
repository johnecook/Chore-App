-- Let parents choose which child a rotation starts with.

alter table public.chore_templates
add column rotation_start_child_profile_id uuid references public.child_profiles(id) on delete set null;

create or replace function public.resolve_rotating_chore_assignee(
  target_template_id uuid,
  target_occurrence_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_template public.chore_templates%rowtype;
  member_count int;
  period_index int;
  selected_child_profile_id uuid;
begin
  select *
  into target_template
  from public.chore_templates
  where id = target_template_id
    and assignment_mode = 'rotation';

  if not found then
    return null;
  end if;

  with rotation_members as (
    select
      child.id as child_profile_id,
      row_number() over (
        order by
          case when child.id = target_template.rotation_start_child_profile_id then 0 else 1 end,
          membership.joined_at,
          child.id
      )::int as position
    from public.household_memberships membership
    join public.child_profiles child
      on child.user_id = membership.user_id
    where target_template.rotation_child_scope = 'all_children'
      and membership.household_id = target_template.household_id
      and membership.role = 'child'

    union all

    select assignee.child_profile_id, assignee.position
    from public.chore_template_assignees assignee
    where target_template.rotation_child_scope = 'selected_children'
      and assignee.template_id = target_template.id
  )
  select count(*)
  into member_count
  from rotation_members;

  if member_count = 0 then
    return null;
  end if;

  period_index := public.chore_rotation_period_index(
    target_template.rotation_cadence,
    target_template.rotation_anchor_date,
    target_occurrence_date
  );

  with rotation_members as (
    select
      child.id as child_profile_id,
      row_number() over (
        order by
          case when child.id = target_template.rotation_start_child_profile_id then 0 else 1 end,
          membership.joined_at,
          child.id
      )::int as position
    from public.household_memberships membership
    join public.child_profiles child
      on child.user_id = membership.user_id
    where target_template.rotation_child_scope = 'all_children'
      and membership.household_id = target_template.household_id
      and membership.role = 'child'

    union all

    select assignee.child_profile_id, assignee.position
    from public.chore_template_assignees assignee
    where target_template.rotation_child_scope = 'selected_children'
      and assignee.template_id = target_template.id
  ),
  ordered_members as (
    select
      child_profile_id,
      position,
      mod(mod(period_index, member_count) + member_count, member_count) + 1 as starting_position
    from rotation_members
  )
  select child_profile_id
  into selected_child_profile_id
  from ordered_members
  where public.is_child_available_for_household_on(
    child_profile_id,
    target_template.household_id,
    target_occurrence_date
  )
  order by mod(position - starting_position + member_count, member_count)
  limit 1;

  return selected_child_profile_id;
end;
$$;

drop function if exists public.create_chore_template(
  uuid,
  text,
  text,
  public.chore_schedule_type,
  date,
  int[],
  int,
  date,
  time,
  time,
  public.chore_assignment_mode,
  public.chore_value_model,
  int,
  boolean,
  boolean,
  uuid[],
  text[],
  public.chore_rotation_cadence,
  public.chore_rotation_child_scope
);

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
  selected_child_profile_ids uuid[] default '{}'::uuid[],
  chore_checklist_items text[] default '{}'::text[],
  chore_rotation_cadence public.chore_rotation_cadence default null,
  chore_rotation_child_scope public.chore_rotation_child_scope default null,
  chore_rotation_start_child_profile_id uuid default null
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
  rotating_child_profile_id uuid;
begin
  if not public.is_household_parent(target_household_id) then
    raise exception 'Current user cannot create chores for this household';
  end if;

  if chore_value_model = 'fixed' and not public.household_money_features_enabled(target_household_id) then
    raise exception 'Enable money features before creating paid chores';
  end if;

  if chore_assignment_mode = 'selected_children'
    and coalesce(cardinality(selected_child_profile_ids), 0) = 0 then
    raise exception 'Choose at least one child for a selected-child chore';
  end if;

  if chore_assignment_mode = 'rotation'
    and (chore_rotation_cadence is null or chore_rotation_child_scope is null) then
    raise exception 'Choose rotation cadence and children';
  end if;

  if chore_assignment_mode = 'rotation'
    and chore_rotation_child_scope = 'selected_children'
    and coalesce(cardinality(selected_child_profile_ids), 0) = 0 then
    raise exception 'Choose at least one child for this rotation';
  end if;

  if chore_assignment_mode not in ('selected_children', 'rotation')
    and coalesce(cardinality(selected_child_profile_ids), 0) > 0 then
    raise exception 'Selected children are only valid for selected-child and rotating chores';
  end if;

  if chore_assignment_mode = 'rotation'
    and chore_rotation_child_scope = 'all_children'
    and coalesce(cardinality(selected_child_profile_ids), 0) > 0 then
    raise exception 'Selected children are only valid when rotating selected children';
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

  if chore_rotation_start_child_profile_id is not null then
    if not exists (
      select 1
      from public.child_profiles child
      join public.household_memberships membership
        on membership.user_id = child.user_id
       and membership.household_id = target_household_id
       and membership.role = 'child'
      where child.id = chore_rotation_start_child_profile_id
    ) then
      raise exception 'Rotation starting child must belong to this household';
    end if;

    if chore_assignment_mode = 'rotation'
      and chore_rotation_child_scope = 'selected_children'
      and not (chore_rotation_start_child_profile_id = any(selected_child_profile_ids)) then
      raise exception 'Rotation starting child must be included in the selected rotation';
    end if;
  end if;

  if chore_assignment_mode in ('all_eligible_children', 'up_for_grabs', 'rotation') then
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
    rotation_cadence,
    rotation_child_scope,
    rotation_anchor_date,
    rotation_start_child_profile_id,
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
    case when chore_assignment_mode = 'rotation' then chore_rotation_cadence else null end,
    case when chore_assignment_mode = 'rotation' then chore_rotation_child_scope else null end,
    case when chore_assignment_mode = 'rotation' then chore_start_date else null end,
    case when chore_assignment_mode = 'rotation' then chore_rotation_start_child_profile_id else null end,
    chore_value_model,
    chore_amount_cents,
    chore_photo_required,
    chore_approval_required
  )
  returning id into template_id;

  insert into public.chore_template_checklist_items (template_id, label, position)
  select
    template_id,
    trimmed.label,
    trimmed.position
  from (
    select
      trim(item.label) as label,
      item.position::int
    from unnest(coalesce(chore_checklist_items, '{}'::text[])) with ordinality as item(label, position)
  ) trimmed
  where length(trimmed.label) > 0;

  if chore_assignment_mode = 'selected_children'
    or (chore_assignment_mode = 'rotation' and chore_rotation_child_scope = 'selected_children') then
    insert into public.chore_template_assignees (template_id, child_profile_id, position)
    select template_id, selected.child_profile_id, selected.position::int
    from unnest(selected_child_profile_ids) with ordinality as selected(child_profile_id, position);
  end if;

  if chore_schedule_type = 'one_off' then
    occurrence_date := chore_one_off_date;

    if chore_due_time_start is not null then
      due_window_start := public.combine_chore_due_window(target_household_id, occurrence_date, chore_due_time_start);
    end if;

    if chore_due_time_end is not null then
      due_window_end := public.combine_chore_due_window(target_household_id, occurrence_date, chore_due_time_end);
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
    elsif chore_assignment_mode = 'rotation' then
      rotating_child_profile_id := public.resolve_rotating_chore_assignee(template_id, occurrence_date);

      if rotating_child_profile_id is not null then
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
        values (
          template_id,
          target_household_id,
          rotating_child_profile_id,
          occurrence_date,
          due_window_start,
          due_window_end,
          chore_value_model,
          chore_amount_cents,
          chore_photo_required,
          chore_approval_required,
          'assigned'::public.chore_instance_status
        );
      end if;
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
        'available'::public.chore_instance_status,
        true
      );
    end if;
  end if;

  return template_id;
end;
$$;
