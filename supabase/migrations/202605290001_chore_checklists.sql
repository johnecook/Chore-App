-- Optional checklist steps for larger chores.

create table public.chore_template_checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.chore_templates(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  position int not null check (position > 0),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (template_id, position)
);

create table public.chore_instance_checklist_items (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.chore_instances(id) on delete cascade,
  template_item_id uuid references public.chore_template_checklist_items(id) on delete set null,
  label text not null check (length(trim(label)) > 0),
  position int not null check (position > 0),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (instance_id, position)
);

create table public.chore_submission_checklist_items (
  submission_id uuid not null references public.chore_submissions(id) on delete cascade,
  instance_checklist_item_id uuid not null references public.chore_instance_checklist_items(id) on delete cascade,
  checked boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (submission_id, instance_checklist_item_id)
);

create or replace function public.template_checklist_household_id(target_template_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select template.household_id
  from public.chore_template_checklist_items item
  join public.chore_templates template
    on template.id = item.template_id
  where item.id = target_template_item_id
$$;

create or replace function public.instance_checklist_household_id(target_instance_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select instance.earning_household_id
  from public.chore_instance_checklist_items item
  join public.chore_instances instance
    on instance.id = item.instance_id
  where item.id = target_instance_item_id
$$;

create or replace function public.snapshot_chore_instance_checklist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chore_instance_checklist_items (
    instance_id,
    template_item_id,
    label,
    position,
    required
  )
  select
    new.id,
    item.id,
    item.label,
    item.position,
    item.required
  from public.chore_template_checklist_items item
  where item.template_id = new.template_id
  order by item.position;

  return new;
end;
$$;

create trigger snapshot_chore_instance_checklist
after insert on public.chore_instances
for each row execute function public.snapshot_chore_instance_checklist();

alter table public.chore_template_checklist_items enable row level security;
alter table public.chore_instance_checklist_items enable row level security;
alter table public.chore_submission_checklist_items enable row level security;

create policy "Household members can read template checklist items"
on public.chore_template_checklist_items for select
using (public.is_household_member(public.template_checklist_household_id(id)));

create policy "Household parents can manage template checklist items"
on public.chore_template_checklist_items for all
using (public.is_household_parent(public.template_checklist_household_id(id)))
with check (public.is_household_parent(public.template_household_id(template_id)));

create policy "Household members can read instance checklist items"
on public.chore_instance_checklist_items for select
using (public.is_household_member(public.instance_checklist_household_id(id)));

create policy "Household parents can manage instance checklist items"
on public.chore_instance_checklist_items for all
using (public.is_household_parent(public.instance_checklist_household_id(id)))
with check (public.is_household_parent(public.instance_household_id(instance_id)));

create policy "Household members can read submission checklist items"
on public.chore_submission_checklist_items for select
using (
  exists (
    select 1
    from public.chore_instance_checklist_items item
    where item.id = instance_checklist_item_id
      and public.is_household_member(public.instance_checklist_household_id(item.id))
  )
);

create policy "Children can insert own submission checklist items"
on public.chore_submission_checklist_items for insert
with check (
  exists (
    select 1
    from public.chore_submissions submission
    join public.chore_instance_checklist_items item
      on item.id = instance_checklist_item_id
    where submission.id = submission_id
      and item.instance_id = submission.instance_id
      and public.is_child_profile_owner(submission.child_profile_id)
  )
);

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
  uuid[]
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
  chore_checklist_items text[] default '{}'::text[]
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

  if chore_value_model = 'fixed' and not public.household_money_features_enabled(target_household_id) then
    raise exception 'Enable money features before creating paid chores';
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

drop function if exists public.submit_chore_instance(uuid, text, text, uuid, date);

create or replace function public.submit_chore_instance(
  target_instance_id uuid,
  submission_note text default null,
  submission_photo_storage_path text default null,
  auto_approve_pay_period_id uuid default null,
  submitted_on date default current_date,
  checked_checklist_item_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_instance public.chore_instances%rowtype;
  next_attempt_number int;
  submission_id uuid;
  approval_id uuid;
begin
  select *
  into target_instance
  from public.chore_instances
  where id = target_instance_id
  for update;

  if not found then
    raise exception 'Chore instance not found';
  end if;

  if target_instance.status not in ('assigned', 'rejected') then
    raise exception 'Chore instance is not open for submission';
  end if;

  if not public.is_child_profile_owner(target_instance.assigned_child_profile_id) then
    raise exception 'Current user cannot submit this chore';
  end if;

  if target_instance.photo_required_snapshot and submission_photo_storage_path is null then
    raise exception 'Photo proof is required for this chore';
  end if;

  if exists (
    select 1
    from public.chore_instance_checklist_items item
    where item.instance_id = target_instance.id
      and item.required
      and not (item.id = any(coalesce(checked_checklist_item_ids, '{}'::uuid[])))
  ) then
    raise exception 'Complete the checklist before submitting this chore';
  end if;

  if exists (
    select 1
    from unnest(coalesce(checked_checklist_item_ids, '{}'::uuid[])) as checked(item_id)
    where not exists (
      select 1
      from public.chore_instance_checklist_items item
      where item.id = checked.item_id
        and item.instance_id = target_instance.id
    )
  ) then
    raise exception 'Checklist item does not belong to this chore';
  end if;

  select coalesce(max(attempt_number), 0) + 1
  into next_attempt_number
  from public.chore_submissions
  where instance_id = target_instance.id;

  insert into public.chore_submissions (
    instance_id,
    child_profile_id,
    submitted_by,
    attempt_number,
    note,
    photo_storage_path
  )
  values (
    target_instance.id,
    target_instance.assigned_child_profile_id,
    auth.uid(),
    next_attempt_number,
    submission_note,
    submission_photo_storage_path
  )
  returning id into submission_id;

  insert into public.chore_submission_checklist_items (
    submission_id,
    instance_checklist_item_id,
    checked
  )
  select
    submission_id,
    item.id,
    item.id = any(coalesce(checked_checklist_item_ids, '{}'::uuid[]))
  from public.chore_instance_checklist_items item
  where item.instance_id = target_instance.id;

  if target_instance.approval_required_snapshot then
    update public.chore_instances
    set status = 'submitted'
    where id = target_instance.id;
  else
    update public.chore_instances
    set status = 'approved'
    where id = target_instance.id;

    insert into public.approval_events (
      instance_id,
      submission_id,
      actor_profile_id,
      event_type,
      feedback
    )
    values (
      target_instance.id,
      submission_id,
      auth.uid(),
      'approved',
      'Auto-approved on submission'
    )
    returning id into approval_id;

    perform public.create_chore_credit(
      target_instance.id,
      approval_id,
      auth.uid(),
      auto_approve_pay_period_id,
      submitted_on
    );
  end if;

  return submission_id;
end;
$$;
