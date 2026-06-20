-- First-class rotating chore assignments.

alter table public.chore_templates
add column rotation_cadence public.chore_rotation_cadence,
add column rotation_child_scope public.chore_rotation_child_scope,
add column rotation_anchor_date date;

alter table public.chore_templates
add constraint chore_templates_rotation_shape
check (
  (
    assignment_mode = 'rotation'
    and rotation_cadence is not null
    and rotation_child_scope is not null
    and rotation_anchor_date is not null
  )
  or (
    assignment_mode <> 'rotation'
    and rotation_cadence is null
    and rotation_child_scope is null
    and rotation_anchor_date is null
  )
);

alter table public.chore_template_assignees
add column position int;

with ranked as (
  select
    template_id,
    child_profile_id,
    row_number() over (partition by template_id order by created_at, child_profile_id)::int as next_position
  from public.chore_template_assignees
)
update public.chore_template_assignees assignee
set position = ranked.next_position
from ranked
where ranked.template_id = assignee.template_id
  and ranked.child_profile_id = assignee.child_profile_id;

alter table public.chore_template_assignees
alter column position set not null,
add constraint chore_template_assignees_position_positive check (position > 0);

create unique index chore_template_assignees_template_position
on public.chore_template_assignees (template_id, position);

create or replace function public.chore_rotation_period_index(
  cadence public.chore_rotation_cadence,
  anchor_date date,
  occurrence_date date
)
returns int
language sql
immutable
as $$
  select case cadence
    when 'daily' then occurrence_date - anchor_date
    when 'weekly' then floor((occurrence_date - anchor_date)::numeric / 7)::int
    when 'monthly' then (
      (extract(year from occurrence_date)::int - extract(year from anchor_date)::int) * 12
      + extract(month from occurrence_date)::int
      - extract(month from anchor_date)::int
    )
  end
$$;

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
      row_number() over (order by membership.joined_at, child.id)::int as position
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
      row_number() over (order by membership.joined_at, child.id)::int as position
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
    rotation_instances.template_id,
    rotation_instances.household_id,
    rotation_instances.child_profile_id,
    rotation_instances.occurrence_date,
    case
      when rotation_instances.due_time_start is null then null
      else public.combine_chore_due_window(
        rotation_instances.household_id,
        rotation_instances.occurrence_date,
        rotation_instances.due_time_start
      )
    end,
    case
      when rotation_instances.due_time_end is null then null
      else public.combine_chore_due_window(
        rotation_instances.household_id,
        rotation_instances.occurrence_date,
        rotation_instances.due_time_end
      )
    end,
    rotation_instances.value_model,
    rotation_instances.amount_cents,
    rotation_instances.photo_required,
    rotation_instances.approval_required,
    'assigned'::public.chore_instance_status
  from (
    select
      template.id as template_id,
      template.household_id,
      occurrence.occurrence_date::date as occurrence_date,
      template.due_time_start,
      template.due_time_end,
      template.value_model,
      template.amount_cents,
      template.photo_required,
      template.approval_required,
      public.resolve_rotating_chore_assignee(template.id, occurrence.occurrence_date::date) as child_profile_id
    from public.chore_templates template
    join generate_series(range_start, range_end, interval '1 day') occurrence(occurrence_date)
      on true
    where template.active
      and template.assignment_mode = 'rotation'
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
  ) rotation_instances
  where rotation_instances.child_profile_id is not null
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
  text[]
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
  chore_rotation_child_scope public.chore_rotation_child_scope default null
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
