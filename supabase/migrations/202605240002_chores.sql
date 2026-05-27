-- Chore schema for template definitions, generated instances, claims,
-- child submissions, parent approvals, and photo retention hooks.

create type public.chore_schedule_type as enum ('daily', 'weekly', 'interval', 'one_off');
create type public.chore_assignment_mode as enum ('selected_children', 'all_eligible_children', 'up_for_grabs');
create type public.chore_value_model as enum ('fixed', 'allowance_included', 'unpaid');
create type public.chore_instance_status as enum ('available', 'assigned', 'submitted', 'approved', 'rejected', 'expired');
create type public.approval_event_type as enum ('approved', 'rejected', 'reopened');

create or replace function public.valid_weekdays(weekdays int[])
returns boolean
language sql
immutable
as $$
  select
    weekdays is not null
    and cardinality(weekdays) > 0
    and not exists (
      select 1
      from unnest(weekdays) as weekday_value
      where weekday_value < 0 or weekday_value > 6
    )
    and (
      select count(distinct weekday_value)
      from unnest(weekdays) as weekday_value
    ) = cardinality(weekdays)
$$;

create table public.chore_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  description text,
  schedule_type public.chore_schedule_type not null,
  start_date date not null,
  end_date date,
  weekly_weekdays int[],
  interval_days int,
  one_off_date date,
  due_time_start time,
  due_time_end time,
  assignment_mode public.chore_assignment_mode not null,
  value_model public.chore_value_model not null,
  amount_cents int not null default 0 check (amount_cents >= 0),
  photo_required boolean not null default false,
  approval_required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chore_templates_date_order
    check (end_date is null or start_date <= end_date),
  constraint chore_templates_due_time_order
    check (due_time_start is null or due_time_end is null or due_time_start < due_time_end),
  constraint chore_templates_weekly_shape
    check (
      (schedule_type = 'weekly' and public.valid_weekdays(weekly_weekdays))
      or (schedule_type <> 'weekly' and weekly_weekdays is null)
    ),
  constraint chore_templates_interval_shape
    check (
      (schedule_type = 'interval' and interval_days is not null and interval_days > 0)
      or (schedule_type <> 'interval' and interval_days is null)
    ),
  constraint chore_templates_one_off_shape
    check (
      (schedule_type = 'one_off' and one_off_date is not null and one_off_date >= start_date)
      or (schedule_type <> 'one_off' and one_off_date is null)
    ),
  constraint chore_templates_daily_shape
    check (
      schedule_type <> 'daily'
      or (weekly_weekdays is null and interval_days is null and one_off_date is null)
    ),
  constraint chore_templates_fixed_amount
    check (
      (value_model = 'fixed' and amount_cents > 0)
      or (value_model <> 'fixed' and amount_cents = 0)
    )
);

create table public.chore_template_assignees (
  template_id uuid not null references public.chore_templates(id) on delete cascade,
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (template_id, child_profile_id)
);

create table public.chore_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.chore_templates(id) on delete restrict,
  earning_household_id uuid not null references public.households(id) on delete restrict,
  assigned_child_profile_id uuid references public.child_profiles(id) on delete restrict,
  occurrence_date date not null,
  due_window_start timestamptz,
  due_window_end timestamptz,
  value_model_snapshot public.chore_value_model not null,
  amount_cents_snapshot int not null default 0 check (amount_cents_snapshot >= 0),
  photo_required_snapshot boolean not null,
  approval_required_snapshot boolean not null,
  status public.chore_instance_status not null,
  up_for_grabs_slot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chore_instances_due_window_order
    check (due_window_start is null or due_window_end is null or due_window_start < due_window_end),
  constraint chore_instances_assignment_shape
    check (
      (up_for_grabs_slot and (assigned_child_profile_id is null or status <> 'available'))
      or (not up_for_grabs_slot and assigned_child_profile_id is not null and status <> 'available')
    ),
  constraint chore_instances_fixed_amount
    check (
      (value_model_snapshot = 'fixed' and amount_cents_snapshot > 0)
      or (value_model_snapshot <> 'fixed' and amount_cents_snapshot = 0)
    )
);

create unique index chore_instances_unique_assigned_occurrence
  on public.chore_instances (
    template_id,
    assigned_child_profile_id,
    occurrence_date,
    coalesce(due_window_start, '-infinity'::timestamptz),
    coalesce(due_window_end, 'infinity'::timestamptz)
  )
  where not up_for_grabs_slot;

create unique index chore_instances_unique_up_for_grabs_occurrence
  on public.chore_instances (
    template_id,
    occurrence_date,
    coalesce(due_window_start, '-infinity'::timestamptz),
    coalesce(due_window_end, 'infinity'::timestamptz)
  )
  where up_for_grabs_slot;

create table public.chore_claims (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null unique references public.chore_instances(id) on delete cascade,
  child_profile_id uuid not null references public.child_profiles(id) on delete restrict,
  claimed_by uuid not null references public.profiles(id) on delete restrict,
  claimed_at timestamptz not null default now(),
  unique (instance_id, child_profile_id)
);

create table public.chore_submissions (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.chore_instances(id) on delete cascade,
  child_profile_id uuid not null references public.child_profiles(id) on delete restrict,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  attempt_number int not null check (attempt_number > 0),
  note text,
  photo_storage_path text,
  photo_deleted_at timestamptz,
  photo_deleted_by uuid references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  unique (instance_id, attempt_number),
  constraint chore_submissions_photo_delete_shape
    check (
      (photo_deleted_at is null and photo_deleted_by is null)
      or (photo_deleted_at is not null and photo_deleted_by is not null and photo_storage_path is not null)
    )
);

create table public.approval_events (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.chore_instances(id) on delete cascade,
  submission_id uuid references public.chore_submissions(id) on delete set null,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  event_type public.approval_event_type not null,
  feedback text,
  created_at timestamptz not null default now()
);

create trigger set_chore_templates_updated_at
before update on public.chore_templates
for each row execute function public.set_updated_at();

create trigger set_chore_instances_updated_at
before update on public.chore_instances
for each row execute function public.set_updated_at();

create or replace function public.template_household_id(target_template_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select template.household_id
  from public.chore_templates template
  where template.id = target_template_id
$$;

create or replace function public.instance_household_id(target_instance_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select instance.earning_household_id
  from public.chore_instances instance
  where instance.id = target_instance_id
$$;

create or replace function public.child_profile_user_id(target_child_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select child.user_id
  from public.child_profiles child
  where child.id = target_child_profile_id
$$;

create or replace function public.is_child_profile_owner(target_child_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.child_profile_user_id(target_child_profile_id) = auth.uid()
$$;

alter table public.chore_templates enable row level security;
alter table public.chore_template_assignees enable row level security;
alter table public.chore_instances enable row level security;
alter table public.chore_claims enable row level security;
alter table public.chore_submissions enable row level security;
alter table public.approval_events enable row level security;

create policy "Household members can read chore templates"
on public.chore_templates for select
using (public.is_household_member(household_id));

create policy "Household parents can manage chore templates"
on public.chore_templates for all
using (public.is_household_parent(household_id))
with check (public.is_household_parent(household_id));

create policy "Household members can read chore template assignees"
on public.chore_template_assignees for select
using (public.is_household_member(public.template_household_id(template_id)));

create policy "Household parents can manage chore template assignees"
on public.chore_template_assignees for all
using (public.is_household_parent(public.template_household_id(template_id)))
with check (public.is_household_parent(public.template_household_id(template_id)));

create policy "Household members can read chore instances"
on public.chore_instances for select
using (public.is_household_member(earning_household_id));

create policy "Household parents can manage chore instances"
on public.chore_instances for all
using (public.is_household_parent(earning_household_id))
with check (public.is_household_parent(earning_household_id));

create policy "Household members can read chore claims"
on public.chore_claims for select
using (public.is_household_member(public.instance_household_id(instance_id)));

create policy "Children can claim available chores"
on public.chore_claims for insert
with check (
  public.is_child_profile_owner(child_profile_id)
  and claimed_by = auth.uid()
  and exists (
    select 1
    from public.chore_instances instance
    where instance.id = instance_id
      and instance.up_for_grabs_slot
      and instance.status = 'available'
      and public.is_household_member(instance.earning_household_id)
  )
);

create policy "Household members can read chore submissions"
on public.chore_submissions for select
using (public.is_household_member(public.instance_household_id(instance_id)));

create policy "Children can submit assigned chores"
on public.chore_submissions for insert
with check (
  public.is_child_profile_owner(child_profile_id)
  and submitted_by = auth.uid()
  and exists (
    select 1
    from public.chore_instances instance
    where instance.id = instance_id
      and instance.assigned_child_profile_id = child_profile_id
      and instance.status in ('assigned', 'rejected')
      and public.is_household_member(instance.earning_household_id)
  )
);

create policy "Household parents can update chore submissions"
on public.chore_submissions for update
using (public.is_household_parent(public.instance_household_id(instance_id)))
with check (public.is_household_parent(public.instance_household_id(instance_id)));

create policy "Household members can read approval events"
on public.approval_events for select
using (public.is_household_member(public.instance_household_id(instance_id)));

create policy "Household parents can insert approval events"
on public.approval_events for insert
with check (public.is_household_parent(public.instance_household_id(instance_id)));
