-- Atomic command functions for chore execution, approval, reopen, and payout closeout.

create or replace function public.current_payout_parent_id(target_household_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select membership.user_id
  from public.household_memberships membership
  where membership.household_id = target_household_id
    and membership.role in ('admin', 'parent')
    and membership.is_primary_payout_parent
  limit 1
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

  if target_pay_period_id is null then
    raise exception 'Fixed-value approved chores require a pay period';
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

create or replace function public.claim_chore_instance(target_instance_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_instance public.chore_instances%rowtype;
  target_child_profile_id uuid;
  claim_id uuid;
begin
  select *
  into target_instance
  from public.chore_instances
  where id = target_instance_id
  for update;

  if not found then
    raise exception 'Chore instance not found';
  end if;

  if not target_instance.up_for_grabs_slot or target_instance.status <> 'available' then
    raise exception 'Chore instance is not available to claim';
  end if;

  if not public.is_household_member(target_instance.earning_household_id) then
    raise exception 'Current user cannot claim chores in this household';
  end if;

  select child.id
  into target_child_profile_id
  from public.child_profiles child
  where child.user_id = auth.uid();

  if target_child_profile_id is null then
    raise exception 'Current user does not have a child profile';
  end if;

  insert into public.chore_claims (
    instance_id,
    child_profile_id,
    claimed_by
  )
  values (
    target_instance.id,
    target_child_profile_id,
    auth.uid()
  )
  returning id into claim_id;

  update public.chore_instances
  set assigned_child_profile_id = target_child_profile_id,
      status = 'assigned'
  where id = target_instance.id;

  return claim_id;
end;
$$;

create or replace function public.submit_chore_instance(
  target_instance_id uuid,
  submission_note text default null,
  submission_photo_storage_path text default null,
  auto_approve_pay_period_id uuid default null,
  submitted_on date default current_date
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

create or replace function public.approve_chore_submission(
  target_submission_id uuid,
  target_pay_period_id uuid,
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

create or replace function public.reject_chore_submission(
  target_submission_id uuid,
  rejection_feedback text
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
  if rejection_feedback is null or length(trim(rejection_feedback)) = 0 then
    raise exception 'Rejection feedback is required';
  end if;

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
    raise exception 'Current user cannot reject chores in this household';
  end if;

  update public.chore_instances
  set status = 'rejected'
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
    'rejected',
    rejection_feedback
  )
  returning id into approval_id;

  return approval_id;
end;
$$;

create or replace function public.reopen_chore_instance(
  target_instance_id uuid,
  reopen_feedback text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_instance public.chore_instances%rowtype;
  latest_submission_id uuid;
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

  if target_instance.status not in ('rejected', 'expired') then
    raise exception 'Only rejected or expired chores can be reopened';
  end if;

  if not public.is_household_parent(target_instance.earning_household_id) then
    raise exception 'Current user cannot reopen chores in this household';
  end if;

  select submission.id
  into latest_submission_id
  from public.chore_submissions submission
  where submission.instance_id = target_instance.id
  order by submission.attempt_number desc
  limit 1;

  update public.chore_instances
  set status = 'assigned'
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
    latest_submission_id,
    auth.uid(),
    'reopened',
    reopen_feedback
  )
  returning id into approval_id;

  return approval_id;
end;
$$;

create or replace function public.delete_submission_photo(
  target_submission_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_submission public.chore_submissions%rowtype;
begin
  select *
  into target_submission
  from public.chore_submissions
  where id = target_submission_id;

  if not found then
    raise exception 'Chore submission not found';
  end if;

  if target_submission.photo_storage_path is null then
    return;
  end if;

  if target_submission.photo_deleted_at is not null then
    return;
  end if;

  if not public.is_household_parent(public.instance_household_id(target_submission.instance_id)) then
    raise exception 'Current user cannot delete this photo';
  end if;

  update public.chore_submissions
  set photo_deleted_at = now(),
      photo_deleted_by = auth.uid()
  where id = target_submission.id;
end;
$$;

create or replace function public.close_out_payout(
  target_pay_period_id uuid,
  target_child_profile_id uuid,
  payout_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_period public.pay_periods%rowtype;
  target_child public.child_profiles%rowtype;
  payout_parent uuid;
  total_approved_cents int;
  payout_id uuid;
begin
  select *
  into target_period
  from public.pay_periods
  where id = target_pay_period_id
  for update;

  if not found then
    raise exception 'Pay period not found';
  end if;

  select *
  into target_child
  from public.child_profiles
  where id = target_child_profile_id;

  if not found then
    raise exception 'Child profile not found';
  end if;

  if target_child.primary_household_id <> target_period.household_id then
    raise exception 'Pay period does not belong to child payout household';
  end if;

  if not public.is_household_parent(target_period.household_id) then
    raise exception 'Current user cannot close out this payout household';
  end if;

  payout_parent := public.current_payout_parent_id(target_period.household_id);

  if payout_parent is null then
    raise exception 'Primary payout parent is not configured for payout household';
  end if;

  select coalesce(sum(amount_cents), 0)
  into total_approved_cents
  from public.ledger_transactions ledger
  where ledger.pay_period_id = target_period.id
    and ledger.child_profile_id = target_child.id
    and ledger.payout_household_id = target_period.household_id
    and ledger.transaction_type in ('approved_credit', 'manual_adjustment');

  if total_approved_cents <= 0 then
    raise exception 'Payout total must be positive';
  end if;

  insert into public.payout_events (
    pay_period_id,
    child_profile_id,
    payout_household_id,
    payout_parent_id,
    total_cents,
    paid_by,
    note
  )
  values (
    target_period.id,
    target_child.id,
    target_period.household_id,
    payout_parent,
    total_approved_cents,
    auth.uid(),
    payout_note
  )
  returning id into payout_id;

  insert into public.ledger_transactions (
    child_profile_id,
    payout_household_id,
    payout_parent_id,
    pay_period_id,
    payout_event_id,
    transaction_type,
    amount_cents,
    description,
    effective_date,
    created_by
  )
  values (
    target_child.id,
    target_period.household_id,
    payout_parent,
    target_period.id,
    payout_id,
    'payout',
    -total_approved_cents,
    'Payout closeout',
    target_period.end_date,
    auth.uid()
  );

  update public.chore_submissions submission
  set photo_deleted_at = coalesce(submission.photo_deleted_at, now()),
      photo_deleted_by = coalesce(submission.photo_deleted_by, auth.uid())
  from public.ledger_transactions ledger
  where ledger.pay_period_id = target_period.id
    and ledger.child_profile_id = target_child.id
    and ledger.transaction_type = 'approved_credit'
    and ledger.chore_instance_id = submission.instance_id
    and submission.photo_storage_path is not null
    and submission.photo_deleted_at is null;

  return payout_id;
end;
$$;
