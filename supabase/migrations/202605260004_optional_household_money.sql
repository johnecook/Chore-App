-- Decouple chore completion from optional household money/payout features.

alter table public.households
add column money_features_enabled boolean not null default true;

create or replace function public.household_money_features_enabled(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(household.money_features_enabled, false)
  from public.households household
  where household.id = target_household_id
$$;

drop function if exists public.create_parent_household(text, text, int, public.pay_cycle_type, date);

create or replace function public.create_parent_household(
  household_name text,
  household_timezone text default 'America/Chicago',
  money_features_enabled boolean default true,
  pay_weekday int default null,
  pay_cycle public.pay_cycle_type default null,
  biweekly_anchor_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  household_id uuid;
  normalized_pay_cycle public.pay_cycle_type;
  normalized_pay_weekday int;
begin
  select *
  into current_profile
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Current user profile not found';
  end if;

  if current_profile.app_role <> 'parent' then
    raise exception 'Only parent accounts can create households';
  end if;

  if household_name is null or length(trim(household_name)) = 0 then
    raise exception 'Household name is required';
  end if;

  if household_timezone is null or length(trim(household_timezone)) = 0 then
    raise exception 'Household timezone is required';
  end if;

  if money_features_enabled then
    normalized_pay_cycle := coalesce(pay_cycle, 'weekly'::public.pay_cycle_type);
    normalized_pay_weekday := coalesce(pay_weekday, 5);

    if normalized_pay_weekday < 0 or normalized_pay_weekday > 6 then
      raise exception 'Pay weekday must be between 0 and 6';
    end if;

    if normalized_pay_cycle not in ('weekly', 'biweekly') then
      raise exception 'Onboarding supports weekly or biweekly payout schedules';
    end if;

    if normalized_pay_cycle = 'biweekly' and biweekly_anchor_date is null then
      raise exception 'Biweekly payout schedules require an anchor date';
    end if;
  end if;

  insert into public.households (
    name,
    timezone,
    money_features_enabled,
    created_by
  )
  values (
    trim(household_name),
    trim(household_timezone),
    money_features_enabled,
    current_profile.id
  )
  returning id into household_id;

  insert into public.household_memberships (
    household_id,
    user_id,
    role,
    is_primary_payout_parent
  )
  values (
    household_id,
    current_profile.id,
    'admin',
    money_features_enabled
  );

  if money_features_enabled then
    if normalized_pay_cycle = 'weekly' then
      insert into public.pay_cycle_settings (
        household_id,
        cycle_type,
        weekly_weekday,
        created_by
      )
      values (
        household_id,
        'weekly',
        normalized_pay_weekday,
        current_profile.id
      );
    else
      insert into public.pay_cycle_settings (
        household_id,
        cycle_type,
        biweekly_weekday,
        biweekly_anchor_date,
        created_by
      )
      values (
        household_id,
        'biweekly',
        normalized_pay_weekday,
        biweekly_anchor_date,
        current_profile.id
      );
    end if;
  end if;

  return household_id;
end;
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

create or replace function public.create_chore_credit(
  target_instance_id uuid,
  target_approval_event_id uuid,
  target_created_by uuid,
  target_pay_period_id uuid,
  target_effective_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_instance public.chore_instances%rowtype;
  target_child public.child_profiles%rowtype;
  payout_parent uuid;
  ledger_id uuid;
begin
  select *
  into target_instance
  from public.chore_instances
  where id = target_instance_id;

  if not found then
    raise exception 'Chore instance not found';
  end if;

  if target_instance.value_model_snapshot <> 'fixed' then
    return null;
  end if;

  if not public.household_money_features_enabled(target_instance.earning_household_id) then
    return null;
  end if;

  select *
  into target_child
  from public.child_profiles
  where id = target_instance.assigned_child_profile_id;

  if not found then
    raise exception 'Assigned child profile not found';
  end if;

  payout_parent := public.current_payout_parent_id(target_child.primary_household_id);

  if payout_parent is null then
    raise exception 'Primary payout parent is not configured for payout household';
  end if;

  if target_pay_period_id is null then
    target_pay_period_id := public.current_pay_period_for_household(
      target_child.primary_household_id,
      target_effective_date
    );
  end if;

  if not exists (
    select 1
    from public.pay_periods period
    where period.id = target_pay_period_id
      and period.household_id = target_child.primary_household_id
      and target_effective_date between period.start_date and period.end_date
  ) then
    raise exception 'Approved credit pay period must belong to payout household and contain effective date';
  end if;

  insert into public.ledger_transactions (
    child_profile_id,
    earning_household_id,
    payout_household_id,
    payout_parent_id,
    pay_period_id,
    chore_instance_id,
    approval_event_id,
    transaction_type,
    amount_cents,
    description,
    effective_date,
    created_by
  )
  values (
    target_child.id,
    target_instance.earning_household_id,
    target_child.primary_household_id,
    payout_parent,
    target_pay_period_id,
    target_instance.id,
    target_approval_event_id,
    'approved_credit',
    target_instance.amount_cents_snapshot,
    'Approved chore credit',
    target_effective_date,
    target_created_by
  )
  returning id into ledger_id;

  return ledger_id;
end;
$$;

create or replace function public.approve_chore_submission(
  target_submission_id uuid,
  target_pay_period_id uuid default null,
  approved_on date default current_date,
  approval_feedback text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_submission public.chore_submissions%rowtype;
  target_instance public.chore_instances%rowtype;
  approval_id uuid;
begin
  select *
  into target_submission
  from public.chore_submissions
  where id = target_submission_id;

  if not found then
    raise exception 'Chore submission not found';
  end if;

  select *
  into target_instance
  from public.chore_instances
  where id = target_submission.instance_id
  for update;

  if not found then
    raise exception 'Chore instance not found';
  end if;

  if target_instance.status <> 'submitted' then
    raise exception 'Chore instance is not waiting for approval';
  end if;

  if not public.is_household_parent(target_instance.earning_household_id) then
    raise exception 'Current user cannot approve chores in this household';
  end if;

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
    target_submission.id,
    auth.uid(),
    'approved',
    approval_feedback
  )
  returning id into approval_id;

  perform public.create_chore_credit(
    target_instance.id,
    approval_id,
    auth.uid(),
    target_pay_period_id,
    approved_on
  );

  return approval_id;
end;
$$;

create or replace function public.approve_chore_submission_for_current_period(
  target_submission_id uuid,
  approved_on date default current_date,
  approval_feedback text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_submission public.chore_submissions%rowtype;
  target_instance public.chore_instances%rowtype;
  target_child public.child_profiles%rowtype;
  target_pay_period_id uuid;
begin
  select *
  into target_submission
  from public.chore_submissions
  where id = target_submission_id;

  if not found then
    raise exception 'Chore submission not found';
  end if;

  select *
  into target_instance
  from public.chore_instances
  where id = target_submission.instance_id;

  if not found then
    raise exception 'Chore instance not found';
  end if;

  if not public.is_household_parent(target_instance.earning_household_id) then
    raise exception 'Current user cannot approve chores in this household';
  end if;

  if target_instance.value_model_snapshot = 'fixed'
    and public.household_money_features_enabled(target_instance.earning_household_id) then
    select *
    into target_child
    from public.child_profiles
    where id = target_instance.assigned_child_profile_id;

    if not found then
      raise exception 'Assigned child profile not found';
    end if;

    target_pay_period_id := public.current_pay_period_for_household(
      target_child.primary_household_id,
      approved_on
    );
  end if;

  return public.approve_chore_submission(
    target_submission_id,
    target_pay_period_id,
    approved_on,
    approval_feedback
  );
end;
$$;
