-- Built-in chore preset catalog. Presets are global suggestions; saving one
-- copies its editable defaults into a household-owned chore template.

create type public.chore_template_preset_category as enum (
  'kitchen',
  'bedroom',
  'bathroom',
  'laundry',
  'pets',
  'outdoor',
  'family'
);

create table public.chore_template_presets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) > 0),
  category public.chore_template_preset_category not null,
  display_order int not null default 0,
  title text not null check (length(trim(title)) > 0),
  description text,
  suggested_schedule_type public.chore_schedule_type not null,
  suggested_weekly_weekdays int[],
  suggested_interval_days int,
  suggested_due_time_start time,
  suggested_due_time_end time,
  suggested_assignment_mode public.chore_assignment_mode not null default 'selected_children',
  suggested_value_model public.chore_value_model not null default 'fixed',
  suggested_amount_cents int not null default 0 check (suggested_amount_cents >= 0),
  suggested_photo_required boolean not null default true,
  suggested_approval_required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chore_template_presets_due_time_order
    check (
      suggested_due_time_start is null
      or suggested_due_time_end is null
      or suggested_due_time_start < suggested_due_time_end
    ),
  constraint chore_template_presets_weekly_shape
    check (
      (suggested_schedule_type = 'weekly' and public.valid_weekdays(suggested_weekly_weekdays))
      or (suggested_schedule_type <> 'weekly' and suggested_weekly_weekdays is null)
    ),
  constraint chore_template_presets_interval_shape
    check (
      (
        suggested_schedule_type = 'interval'
        and suggested_interval_days is not null
        and suggested_interval_days > 0
      )
      or (suggested_schedule_type <> 'interval' and suggested_interval_days is null)
    ),
  constraint chore_template_presets_fixed_amount
    check (
      (suggested_value_model = 'fixed' and suggested_amount_cents > 0)
      or (suggested_value_model <> 'fixed' and suggested_amount_cents = 0)
    )
);

alter table public.chore_template_presets enable row level security;

create policy "Authenticated users can read active chore presets"
on public.chore_template_presets for select
using (active and auth.uid() is not null);

insert into public.chore_template_presets (
  slug,
  category,
  display_order,
  title,
  description,
  suggested_schedule_type,
  suggested_weekly_weekdays,
  suggested_interval_days,
  suggested_due_time_start,
  suggested_due_time_end,
  suggested_assignment_mode,
  suggested_value_model,
  suggested_amount_cents,
  suggested_photo_required,
  suggested_approval_required
)
values
  (
    'unload-dishwasher',
    'kitchen',
    10,
    'Unload dishwasher',
    'Put clean dishes, cups, and silverware away.',
    'daily',
    null,
    null,
    '07:00',
    '20:00',
    'selected_children',
    'fixed',
    150,
    true,
    true
  ),
  (
    'wipe-counters',
    'kitchen',
    20,
    'Wipe counters',
    'Clear crumbs and wipe kitchen counters after meals.',
    'daily',
    null,
    null,
    '17:00',
    '20:00',
    'selected_children',
    'fixed',
    100,
    true,
    true
  ),
  (
    'take-out-trash',
    'kitchen',
    30,
    'Take out trash',
    'Tie the bag, take it outside, and replace the liner.',
    'weekly',
    array[0, 3],
    null,
    '16:00',
    '20:00',
    'selected_children',
    'fixed',
    200,
    true,
    true
  ),
  (
    'make-bed',
    'bedroom',
    10,
    'Make bed',
    'Pull up sheets and blankets and arrange pillows.',
    'daily',
    null,
    null,
    '06:00',
    '10:00',
    'selected_children',
    'allowance_included',
    0,
    false,
    false
  ),
  (
    'tidy-bedroom',
    'bedroom',
    20,
    'Tidy bedroom',
    'Put clothes, toys, books, and floor items where they belong.',
    'weekly',
    array[6],
    null,
    '09:00',
    '17:00',
    'selected_children',
    'fixed',
    300,
    true,
    true
  ),
  (
    'clean-bathroom-sink',
    'bathroom',
    10,
    'Clean bathroom sink',
    'Wipe the sink, faucet, counter, and mirror area.',
    'weekly',
    array[6],
    null,
    '09:00',
    '17:00',
    'selected_children',
    'fixed',
    250,
    true,
    true
  ),
  (
    'fold-laundry',
    'laundry',
    10,
    'Fold laundry',
    'Fold clean laundry and place it in the right rooms.',
    'interval',
    null,
    3,
    '16:00',
    '20:00',
    'selected_children',
    'fixed',
    300,
    true,
    true
  ),
  (
    'feed-pet',
    'pets',
    10,
    'Feed pet',
    'Give the pet the right food and refill water.',
    'daily',
    null,
    null,
    '06:00',
    '20:00',
    'selected_children',
    'allowance_included',
    0,
    false,
    false
  ),
  (
    'sweep-porch',
    'outdoor',
    10,
    'Sweep porch',
    'Sweep dirt and leaves from the porch or entryway.',
    'weekly',
    array[6],
    null,
    '09:00',
    '18:00',
    'selected_children',
    'fixed',
    250,
    true,
    true
  ),
  (
    'set-table',
    'family',
    10,
    'Set table',
    'Put out plates, napkins, silverware, and cups before dinner.',
    'daily',
    null,
    null,
    '16:00',
    '18:30',
    'selected_children',
    'allowance_included',
    0,
    false,
    false
  );
