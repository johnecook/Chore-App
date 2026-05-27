-- Local smoke test for atomic chore command RPCs.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000001';
  child_id uuid := '00000000-0000-4000-8000-000000000002';
  household_id uuid;
  child_profile_id uuid;
  pay_period_id uuid;
  template_id uuid;
  instance_id uuid;
  submission_id uuid;
  approval_id uuid;
  payout_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'parent-command@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Parent'),
      false,
      false
    ),
    (
      child_id,
      'child-command@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Child'),
      false,
      false
    );

  insert into public.households (name, created_by)
  values ('Cook Household', parent_id)
  returning id into household_id;

  insert into public.household_memberships (household_id, user_id, role, is_primary_payout_parent)
  values
    (household_id, parent_id, 'admin', true),
    (household_id, child_id, 'child', false);

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (child_id, household_id, parent_id)
  returning id into child_profile_id;

  insert into public.pay_periods (household_id, cycle_type, start_date, end_date)
  values (household_id, 'weekly', '2026-05-30', '2026-06-05')
  returning id into pay_period_id;

  insert into public.chore_templates (
    household_id,
    created_by,
    title,
    schedule_type,
    start_date,
    one_off_date,
    assignment_mode,
    value_model,
    amount_cents,
    photo_required,
    approval_required
  )
  values (
    household_id,
    parent_id,
    'Take out trash',
    'one_off',
    '2026-06-01',
    '2026-06-01',
    'selected_children',
    'fixed',
    500,
    true,
    true
  )
  returning id into template_id;

  insert into public.chore_instances (
    template_id,
    earning_household_id,
    assigned_child_profile_id,
    occurrence_date,
    value_model_snapshot,
    amount_cents_snapshot,
    photo_required_snapshot,
    approval_required_snapshot,
    status
  )
  values (
    template_id,
    household_id,
    child_profile_id,
    '2026-06-01',
    'fixed',
    500,
    true,
    true,
    'assigned'
  )
  returning id into instance_id;

  perform set_config('request.jwt.claim.sub', child_id::text, true);

  submission_id := public.submit_chore_instance(
    instance_id,
    'Done',
    'submissions/test-photo.jpg'
  );

  if not exists (
    select 1
    from public.chore_instances
    where id = instance_id and status = 'submitted'
  ) then
    raise exception 'Expected submitted instance after child submission';
  end if;

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  approval_id := public.approve_chore_submission(
    submission_id,
    pay_period_id,
    '2026-06-05',
    'Looks good'
  );

  if approval_id is null then
    raise exception 'Expected approval event id';
  end if;

  if not exists (
    select 1
    from public.ledger_transactions
    where chore_instance_id = instance_id
      and approval_event_id = approval_id
      and transaction_type = 'approved_credit'
      and amount_cents = 500
      and payout_household_id = household_id
      and payout_parent_id = parent_id
  ) then
    raise exception 'Expected approved credit ledger row';
  end if;

  payout_id := public.close_out_payout(pay_period_id, child_profile_id, 'Paid');

  if payout_id is null then
    raise exception 'Expected payout event id';
  end if;

  if not exists (
    select 1
    from public.ledger_transactions
    where payout_event_id = payout_id
      and transaction_type = 'payout'
      and amount_cents = -500
  ) then
    raise exception 'Expected payout ledger row';
  end if;

  if not exists (
    select 1
    from public.chore_submissions
    where id = submission_id
      and photo_storage_path = 'submissions/test-photo.jpg'
      and photo_deleted_at is not null
      and photo_deleted_by = parent_id
  ) then
    raise exception 'Expected payout closeout to mark submission photo deleted';
  end if;
end $$;
