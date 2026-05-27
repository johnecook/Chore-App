-- Parent approval helper that creates the needed weekly/biweekly pay period
-- from household payout settings before delegating to the approval command.

create or replace function public.current_pay_period_for_household(
  target_household_id uuid,
  target_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  setting public.pay_cycle_settings%rowtype;
  period_end_date date;
  period_start_date date;
  current_weekday int;
  delta_days int;
  anchor_end_date date;
  days_from_anchor int;
  periods_from_anchor int;
  period_id uuid;
begin
  select *
  into setting
  from public.pay_cycle_settings
  where household_id = target_household_id;

  if not found then
    raise exception 'Pay cycle settings are not configured for this household';
  end if;

  current_weekday := extract(dow from target_date)::int;

  if setting.cycle_type = 'weekly' then
    delta_days := (setting.weekly_weekday - current_weekday + 7) % 7;
    period_end_date := target_date + delta_days;
    period_start_date := period_end_date - 6;
  elsif setting.cycle_type = 'biweekly' then
    delta_days := (setting.biweekly_weekday - extract(dow from setting.biweekly_anchor_date)::int + 7) % 7;
    anchor_end_date := setting.biweekly_anchor_date + delta_days;
    days_from_anchor := target_date - anchor_end_date;
    periods_from_anchor := floor(days_from_anchor::numeric / 14)::int;
    period_end_date := anchor_end_date + (periods_from_anchor * 14);

    if target_date > period_end_date then
      period_end_date := period_end_date + 14;
    end if;

    period_start_date := period_end_date - 13;
  else
    raise exception 'Current approval supports weekly or biweekly pay cycles';
  end if;

  insert into public.pay_periods (
    household_id,
    cycle_type,
    start_date,
    end_date
  )
  values (
    target_household_id,
    setting.cycle_type,
    period_start_date,
    period_end_date
  )
  on conflict (household_id, start_date, end_date) do update
    set cycle_type = excluded.cycle_type
  returning id into period_id;

  return period_id;
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

  if target_instance.value_model_snapshot = 'fixed' then
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
