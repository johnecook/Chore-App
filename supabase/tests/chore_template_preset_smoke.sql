-- Local smoke test for built-in chore presets and copying preset defaults.
-- Run after `supabase db reset --local --no-seed`.

do $$
declare
  parent_id uuid := '00000000-0000-4000-8000-000000000601';
  child_id uuid := '00000000-0000-4000-8000-000000000602';
  target_household_id uuid;
  target_child_profile_id uuid;
  preset public.chore_template_presets%rowtype;
  created_template_id uuid;
begin
  select *
  into preset
  from public.chore_template_presets
  where slug = 'unload-dishwasher'
    and category = 'kitchen'
    and active;

  if not found then
    raise exception 'Expected unload dishwasher preset';
  end if;

  if not exists (
    select 1
    from public.chore_template_presets
    where category in ('kitchen', 'bedroom', 'bathroom', 'laundry', 'pets', 'outdoor', 'family')
    group by active
    having count(*) >= 7
  ) then
    raise exception 'Expected categorized starter presets';
  end if;

  insert into auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  values
    (
      parent_id,
      'preset-parent@example.test',
      jsonb_build_object('app_role', 'parent', 'display_name', 'Preset Parent'),
      false,
      false
    ),
    (
      child_id,
      'preset-child@example.test',
      jsonb_build_object('app_role', 'child', 'display_name', 'Preset Child'),
      false,
      false
    );

  insert into public.households (name, created_by)
  values ('Preset Household', parent_id)
  returning id into target_household_id;

  insert into public.household_memberships (household_id, user_id, role, is_primary_payout_parent)
  values
    (target_household_id, parent_id, 'admin', true),
    (target_household_id, child_id, 'child', false);

  insert into public.child_profiles (user_id, primary_household_id, created_by)
  values (child_id, target_household_id, parent_id)
  returning id into target_child_profile_id;

  perform set_config('request.jwt.claim.sub', parent_id::text, true);

  created_template_id := public.create_chore_template(
    target_household_id,
    preset.title,
    preset.description,
    'one_off',
    '2026-06-01',
    null,
    null,
    '2026-06-01',
    preset.suggested_due_time_start,
    preset.suggested_due_time_end,
    preset.suggested_assignment_mode,
    preset.suggested_value_model,
    preset.suggested_amount_cents,
    preset.suggested_photo_required,
    preset.suggested_approval_required,
    array[target_child_profile_id]
  );

  if not exists (
    select 1
    from public.chore_templates template
    where template.id = created_template_id
      and template.household_id = target_household_id
      and template.created_by = parent_id
      and template.title = preset.title
      and template.description = preset.description
      and template.amount_cents = preset.suggested_amount_cents
      and template.photo_required = preset.suggested_photo_required
      and template.approval_required = preset.suggested_approval_required
  ) then
    raise exception 'Expected copied preset to become household template';
  end if;

  if not exists (
    select 1
    from public.chore_instances instance
    where instance.template_id = created_template_id
      and instance.assigned_child_profile_id = target_child_profile_id
      and instance.status = 'assigned'
  ) then
    raise exception 'Expected copied one-off preset to generate an instance';
  end if;
end $$;
