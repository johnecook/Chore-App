-- Local smoke test for chore lifecycle notification event creation.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000001201';
  second_parent_id uuid := '00000000-0000-4000-8000-000000001202';
  child_id uuid := '00000000-0000-4000-8000-000000001203';
  target_household_id uuid;
  target_child_profile_id uuid;
  selected_template_id uuid;
  approved_template_id uuid;
  up_for_grabs_template_id uuid;
  selected_instance_id uuid;
  approved_instance_id uuid;
  selected_submission_id uuid;
  approved_submission_id uuid;
  rejection_id uuid;
  reopen_id uuid;
  approval_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'notification-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Notification Parent'),
      false,
      false
    ),
    (
      second_parent_id,
      'notification-second-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Notification Second Parent'),
      false,
      false
    ),
    (
      child_id,
      'notification-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Notification Child'),
      false,
      false
    );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  target_household_id := public.create_parent_household(
    household_name => 'Notification Household',
    household_timezone => 'America/Chicago',
    money_features_enabled => true,
    pay_weekday => 5,
    pay_cycle => 'weekly',
    biweekly_anchor_date => null
  );

  insert into public.household_memberships (household_id, user_id, role, is_primary_payout_parent)
  values
    (target_household_id, second_parent_id, 'parent', false),
    (target_household_id, child_id, 'child', false);

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (child_id, target_household_id, parent_id)
  returning id into target_child_profile_id;

  up_for_grabs_template_id := public.create_chore_template(
    target_household_id,
    'Available notification chore',
    null,
    'one_off',
    '2026-06-01',
    null,
    null,
    '2026-06-01',
    null,
    null,
    'up_for_grabs',
    'unpaid',
    0,
    false,
    true,
    '{}'::uuid[]
  );

  if not exists (
    select 1
    from public.notification_events event
    join public.chore_instances instance
      on instance.id = event.chore_instance_id
    where instance.template_id = up_for_grabs_template_id
      and event.recipient_profile_id = child_id
      and event.event_type = 'chore_available'
      and event.title = 'Chore available'
  ) then
    raise exception 'Expected child notification for available chore';
  end if;

  selected_template_id := public.create_chore_template(
    target_household_id,
    'Submitted notification chore',
    null,
    'one_off',
    '2026-06-01',
    null,
    null,
    '2026-06-01',
    null,
    null,
    'selected_children',
    'unpaid',
    0,
    false,
    true,
    array[target_child_profile_id]
  );

  approved_template_id := public.create_chore_template(
    target_household_id,
    'Approved notification chore',
    null,
    'one_off',
    '2026-06-01',
    null,
    null,
    '2026-06-01',
    null,
    null,
    'selected_children',
    'fixed',
    250,
    false,
    true,
    array[target_child_profile_id]
  );

  select id
  into selected_instance_id
  from public.chore_instances
  where template_id = selected_template_id;

  select id
  into approved_instance_id
  from public.chore_instances
  where template_id = approved_template_id;

  perform set_config('request.jwt.claim.sub', child_id::text, true);

  selected_submission_id := public.submit_chore_instance(
    selected_instance_id,
    'Ready for review',
    null
  );

  approved_submission_id := public.submit_chore_instance(
    approved_instance_id,
    'Ready for approval',
    null
  );

  if (
    select count(*)
    from public.notification_events event
    where event.chore_submission_id in (selected_submission_id, approved_submission_id)
      and event.event_type = 'chore_submitted'
      and event.recipient_profile_id in (parent_id, second_parent_id)
  ) <> 4 then
    raise exception 'Expected both parents to receive submitted chore notifications';
  end if;

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  rejection_id := public.reject_chore_submission(
    selected_submission_id,
    'Try again'
  );

  if rejection_id is null then
    raise exception 'Expected rejection id';
  end if;

  if not exists (
    select 1
    from public.notification_events event
    where event.chore_instance_id = selected_instance_id
      and event.recipient_profile_id = child_id
      and event.event_type = 'chore_rejected'
      and event.title = 'Chore sent back'
  ) then
    raise exception 'Expected child rejection notification';
  end if;

  reopen_id := public.reopen_chore_instance(
    selected_instance_id,
    'You can redo it'
  );

  if reopen_id is null then
    raise exception 'Expected reopen id';
  end if;

  if not exists (
    select 1
    from public.notification_events event
    where event.chore_instance_id = selected_instance_id
      and event.recipient_profile_id = child_id
      and event.event_type = 'chore_reopened'
      and event.title = 'Chore reopened'
  ) then
    raise exception 'Expected child reopen notification';
  end if;

  approval_id := public.approve_chore_submission_for_current_period(
    approved_submission_id,
    '2026-06-03',
    'Looks good'
  );

  if approval_id is null then
    raise exception 'Expected approval id';
  end if;

  if not exists (
    select 1
    from public.notification_events event
    where event.chore_instance_id = approved_instance_id
      and event.recipient_profile_id = child_id
      and event.event_type = 'chore_approved'
      and event.title = 'Chore approved'
  ) then
    raise exception 'Expected child approval notification';
  end if;
end $$;
