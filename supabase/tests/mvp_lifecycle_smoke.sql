-- End-to-end MVP smoke test for create, claim, submit, approve, adjust, payout, and notify.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-00000000c001';
  child_id uuid := '00000000-0000-4000-8000-00000000c002';
  other_child_id uuid := '00000000-0000-4000-8000-00000000c003';
  target_household_id uuid;
  target_child_profile_id uuid;
  other_child_profile_id uuid;
  created_template_id uuid;
  target_instance_id uuid;
  target_claim_id uuid;
  target_checklist_item_ids uuid[];
  target_submission_id uuid;
  target_approval_id uuid;
  target_pay_period_id uuid;
  target_adjustment_id uuid;
  target_payout_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'mvp-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'MVP Parent'),
      false,
      false
    ),
    (
      child_id,
      'mvp-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'MVP Child'),
      false,
      false
    ),
    (
      other_child_id,
      'mvp-other-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Other MVP Child'),
      false,
      false
    );

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  target_household_id := public.create_parent_household(
    household_name => 'MVP Household',
    household_timezone => 'America/Chicago',
    money_features_enabled => true,
    pay_weekday => 5,
    pay_cycle => 'weekly',
    biweekly_anchor_date => null
  );

  insert into public.household_memberships (household_id, user_id, role, is_primary_payout_parent)
  values
    (target_household_id, child_id, 'child', false),
    (target_household_id, other_child_id, 'child', false);

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (child_id, target_household_id, parent_id)
  returning id into target_child_profile_id;

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (other_child_id, target_household_id, parent_id)
  returning id into other_child_profile_id;

  created_template_id := public.create_chore_template(
    target_household_id,
    'MVP trash run',
    'Claim, complete, approve, and pay',
    'one_off',
    '2026-06-01',
    null,
    null,
    '2026-06-01',
    null,
    '20:00',
    'up_for_grabs',
    'fixed',
    500,
    false,
    true,
    '{}'::uuid[],
    array['Collect kitchen trash', 'Move bag to outside bin']
  );

  select id into target_instance_id
  from public.chore_instances
  where template_id = created_template_id
    and status = 'available'
    and up_for_grabs_slot;

  if target_instance_id is null then
    raise exception 'Expected available up-for-grabs chore instance';
  end if;

  if (
    select count(*)
    from public.notification_events event
    where event.chore_instance_id = target_instance_id
      and event.event_type = 'chore_available'
  ) <> 2 then
    raise exception 'Expected available notifications for both children';
  end if;

  perform set_config('request.jwt.claim.sub', child_id::text, true);

  target_claim_id := public.claim_chore_instance(target_instance_id);

  if target_claim_id is null then
    raise exception 'Expected child claim id';
  end if;

  select array_agg(item.id order by item.position)
  into target_checklist_item_ids
  from public.chore_instance_checklist_items item
  where item.instance_id = target_instance_id;

  if coalesce(cardinality(target_checklist_item_ids), 0) <> 2 then
    raise exception 'Expected checklist snapshot on chore instance';
  end if;

  if exists (
    select 1
    from public.chore_claims claim
    where claim.instance_id = target_instance_id
      and claim.child_profile_id = other_child_profile_id
  ) then
    raise exception 'Unexpected claim for other child';
  end if;

  target_submission_id := public.submit_chore_instance(
    target_instance_id,
    'Done from MVP smoke',
    null,
    null,
    current_date,
    target_checklist_item_ids
  );

  if target_submission_id is null then
    raise exception 'Expected submission id';
  end if;

  if (
    select count(*)
    from public.chore_submission_checklist_items item
    where item.submission_id = target_submission_id
      and item.checked
  ) <> 2 then
    raise exception 'Expected completed checklist submission items';
  end if;

  if (
    select count(*)
    from public.notification_events event
    where event.chore_instance_id = target_instance_id
      and event.event_type = 'chore_submitted'
      and event.recipient_profile_id = parent_id
  ) <> 1 then
    raise exception 'Expected parent submission notification';
  end if;

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  target_approval_id := public.approve_chore_submission_for_current_period(
    target_submission_id,
    '2026-06-03',
    'Looks good'
  );

  select ledger.pay_period_id into target_pay_period_id
  from public.ledger_transactions ledger
  where ledger.approval_event_id = target_approval_id
    and ledger.transaction_type = 'approved_credit';

  if target_pay_period_id is null then
    raise exception 'Expected approved credit pay period';
  end if;

  target_adjustment_id := public.create_manual_adjustment(
    target_child_profile_id,
    125,
    'MVP bonus',
    '2026-06-03',
    target_pay_period_id
  );

  if target_adjustment_id is null then
    raise exception 'Expected manual adjustment id';
  end if;

  if (
    select coalesce(sum(ledger.amount_cents), 0)
    from public.ledger_transactions ledger
    where ledger.child_profile_id = target_child_profile_id
      and ledger.pay_period_id = target_pay_period_id
      and ledger.transaction_type in ('approved_credit', 'manual_adjustment', 'payout')
  ) <> 625 then
    raise exception 'Expected approved balance plus adjustment before payout';
  end if;

  target_payout_id := public.close_out_payout(
    target_pay_period_id,
    target_child_profile_id,
    'MVP payout'
  );

  if target_payout_id is null then
    raise exception 'Expected payout id';
  end if;

  if (
    select coalesce(sum(ledger.amount_cents), 0)
    from public.ledger_transactions ledger
    where ledger.child_profile_id = target_child_profile_id
      and ledger.pay_period_id = target_pay_period_id
      and ledger.transaction_type in ('approved_credit', 'manual_adjustment', 'payout')
  ) <> 0 then
    raise exception 'Expected zero balance after payout';
  end if;

  if (
    select count(*)
    from public.notification_events event
    where event.chore_instance_id = target_instance_id
      and event.event_type = 'chore_approved'
      and event.recipient_profile_id = child_id
  ) <> 1 then
    raise exception 'Expected child approval notification';
  end if;
end $$;
