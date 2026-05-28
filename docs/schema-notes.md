# Schema Notes

This document tracks the database model as it evolves.

Product direction note: the app is now planned as a family responsibility and independence app. Money is optional by household and by chore/routine value model. Existing migrations may still reflect the earlier chore-and-allowance-first implementation slice; future migrations should make responsibilities/routines-only households possible without payout setup or ledger activity.

Current migrations:
- `supabase/migrations/202605240001_foundation.sql`
- `supabase/migrations/202605240002_chores.sql`
- `supabase/migrations/202605240003_money.sql`
- `supabase/migrations/202605240004_chore_commands.sql`
- `supabase/migrations/202605240005_auth_bootstrap.sql`
- `supabase/migrations/202605240006_onboarding_commands.sql`
- `supabase/migrations/202605240007_child_invites.sql`
- `supabase/migrations/202605250001_availability_commands.sql`
- `supabase/migrations/202605250002_parent_household_pay_cycle_choice.sql`
- `supabase/migrations/202605250003_household_profile_read.sql`
- `supabase/migrations/202605260001_chore_template_commands.sql`
- `supabase/migrations/202605260002_chore_template_presets.sql`
- `supabase/migrations/202605260003_parent_approval_commands.sql`
- `supabase/migrations/202605260004_optional_household_money.sql`
- `supabase/migrations/202605260005_parent_invites.sql`
- `supabase/migrations/202605270001_chore_submission_photo_storage.sql`
- `supabase/migrations/202605270002_expire_overdue_chores.sql`
- `supabase/migrations/202605270003_generate_recurring_chore_instances.sql`
- `supabase/migrations/202605280001_notification_events.sql`

## Foundation scope

The first schema slice covers:
- authenticated app profiles
- households
- household memberships
- child profiles
- primary household assignment
- primary payout parent assignment for money-enabled households
- base custody availability patterns
- date-specific custody overrides

Audit logs come next.

## Auth model

- Supabase `auth.users` is the authentication identity source.
- `public.profiles` stores app-owned user metadata and role.
- Child accounts use email/password in MVP.
- The domain model should not depend directly on email identity. Future parent-managed username + PIN can map to the same internal profile/child profile model.

## Tables

### `profiles`
- One row per authenticated user.
- `id` matches `auth.users.id`.
- `app_role` is `parent` or `child`.
- `display_name` is required.
- Created automatically from Supabase Auth sign-up metadata by `handle_new_auth_user`.

### `households`
- Parent/admin-created household.
- Stores `timezone` as an IANA timezone string.
- `created_by` records the creating parent/admin.
- Needs household-level money feature settings before the broader MVP is complete. Households should be able to run in responsibilities/routines-only mode without pay cycles, ledger, or payout closeout.

### `household_memberships`
- Links users to households.
- `role` is `admin`, `parent`, or `child`.
- `is_primary_payout_parent` marks the one parent/admin responsible for payout closeout for children whose primary household is that household when money features are enabled.
- Partial unique index enforces at most one primary payout parent per household.
- Partial unique index enforces at most one parent/admin household membership per parent account. Child memberships can still span households.
- A check constraint prevents child-role memberships from being primary payout parent.

### `child_profiles`
- One row per child user.
- `primary_household_id` defines the child's primary household and payout responsibility when money features are enabled.
- Composite foreign key to `household_memberships(user_id, household_id)` ensures the primary household is one of the child's household memberships.
- Changing primary household affects future credits only; historical ledger rows will snapshot payout ownership.

### `child_household_availability_windows`
- Base repeating custody pattern for a child in a household.
- Uses `anchor_date`, `cycle_length_days`, and `available_day_offsets`.
- Example: week-on/week-off is `cycle_length_days = 14` with offsets `0..6`.
- Includes `child_user_id` so the database can enforce that the availability household is one of the child's memberships, not just the child's primary household.

### `child_household_availability_overrides`
- Date-specific overrides for summer, holidays, travel, and non-standard weeks.
- Overrides replace the base pattern for a specific child/household/date.
- Includes the same child membership enforcement as availability windows.

### `chore_templates`
- Parent-authored chore definitions for a household.
- Product copy may call these parent-assigned responsibilities or routines; keep `chore_templates` as the implementation model for MVP parent-assigned work.
- Supports daily, weekly, interval, and one-off schedules.
- Stores assignment mode as selected children, all eligible children, or up for grabs.
- Stores value model as fixed, allowance included, or unpaid.
- Enforces schedule-specific shape in the database:
  - weekly chores require unique weekdays from `0..6`
  - interval chores require positive `interval_days`
  - one-off chores require `one_off_date`
  - daily chores do not carry weekly, interval, or one-off fields
- Fixed-value chores require a positive amount; allowance-included and unpaid chores must have `amount_cents = 0`.
- Fixed-value chores should only create ledger activity when household money features are enabled. Unpaid and allowance-included chores never create ledger activity.

### `chore_template_assignees`
- Join table for templates assigned to specific children.
- Used when `chore_templates.assignment_mode = selected_children`.
- All-eligible and up-for-grabs templates derive eligibility through household membership, custody availability, and service-layer generation rules.

### `chore_instances`
- Generated occurrences of a chore template for a specific date and household.
- Stores snapshots of value model, amount, and requirements so later template edits do not rewrite historical obligations.
- `up_for_grabs_slot = true` allows an instance to start without `assigned_child_profile_id`.
- Non-up-for-grabs instances must have an assigned child and cannot use the `available` status.
- Unique indexes enforce idempotent generation for assigned and up-for-grabs instances.
- Instances can be non-ledger-producing because the household has money disabled or because the value model is unpaid/allowance-included.

### `chore_claims`
- Records a child's claim on an up-for-grabs chore instance.
- One claim is allowed per instance.
- The child profile and claiming profile are both retained for auditability.

### `chore_submissions`
- Records child submission attempts for an instance.
- Allows multiple attempts through positive `attempt_number`.
- `photo_storage_path` points to object storage when photo proof is present.
- Parent photo deletion is represented by `photo_deleted_at` and `photo_deleted_by`.
- Retention cleanup after pay-period close should delete object storage files and mark the submission row.

### `approval_events`
- Append-style record of parent approval decisions.
- Event types are approved, rejected, and reopened.
- Reopen is represented as an approval event so the child can resubmit without erasing previous history.

### `pay_cycle_settings`
- One active pay cycle configuration per household.
- Supports weekly, biweekly, monthly date, and monthly weekday presets.
- Enforces shape by cycle type so unrelated fields stay null.
- Pay period calculation happens in the service/domain layer using the payout household's timezone.
- Should be optional for responsibilities/routines-only households.

### `pay_periods`
- Generated periods for a payout household.
- Unique by household, start date, and end date.
- Approved credits and payout closeout rows attach to these periods.
- Only required when household money features are enabled and ledger-producing work exists.

### `payout_events`
- Records closeout for one child in one pay period.
- Snapshots payout household, payout parent, total amount, payer, and timestamp.
- Unique by child and pay period so a child cannot be closed out twice for the same period.

### `ledger_transactions`
- Append-only money ledger.
- Transaction types are pending credit, approved credit, manual adjustment, and payout.
- Pending credits are informational and do not attach to a pay period.
- Approved credits, manual adjustments, and payouts attach to a pay period.
- Approved credits snapshot the child profile, earning household, payout household, and payout parent.
- Payout transactions are negative amounts and point to a payout event.
- Updates and deletes are blocked by database triggers; corrections must use compensating manual adjustment rows.
- Ledger transactions are not required for unpaid responsibilities, allowance-included responsibilities, or households with money disabled.

### `notification_events`
- Durable in-app notification events for chore lifecycle changes.
- Event types currently cover available up-for-grabs chores, submitted chores, approved chores, rejected chores, and reopened chores.
- Rows are recipient-scoped through `recipient_profile_id`; RLS lets users read only their own notification events.
- `metadata` stores small event context such as occurrence date.
- Web push delivery can consume these rows later while the in-app inbox fallback remains available.

## Phase 2 domain placeholders

These models are not MVP implementation requirements, but the architecture should leave room for them and keep them separate from parent-assigned `chore_*` models:

### `child_personal_tasks`
- Child-owned todos and reminders.
- Suggested fields: child profile, title, description, due date/reminder, status, created/updated timestamps.
- Independence-building; not a parent-assigned obligation.

### `child_goals`
- Child-owned goals.
- Suggested fields: child profile, title, description, optional goal type, status, target date, created/updated timestamps.
- Parent visibility and controls should be configurable later.

### `child_budgets`
- Child-owned or family-assisted budget plans when money features are enabled.
- Suggested fields: child profile, category, planned amount, period, status.

### `child_spending_entries`
- Manual spending records.
- Suggested fields: child profile, amount, category, spent date, note, optional link to earnings/budget period.

### `child_savings_goals`
- Savings targets tied to healthy money habits.
- Suggested fields: child profile, title, target amount, current/manual saved amount, target date, status.

### `household_invitations`
- Parent-created invitation records for adding household members.
- Current MVP flow supports child and parent invitations.
- Open invitations are unique by household, lowercased email, and role.
- Acceptance records `accepted_at` and `accepted_by`; revocation records `revoked_at`.
- The child acceptance command verifies the signed-in child's Auth email matches the invited email.

## Command functions

The first service-layer commands live as database RPC functions so multi-row state changes are atomic:

- `claim_chore_instance(instance_id)` locks and claims an available up-for-grabs instance for the current child.
- `submit_chore_instance(instance_id, note, photo_storage_path, auto_approve_pay_period_id, submitted_on)` creates the next submission attempt, enforces photo requirements, and either moves the instance to submitted or auto-approves no-approval chores.
- `approve_chore_submission(submission_id, pay_period_id, approved_on, feedback)` approves a submitted chore and creates the approved-credit ledger row only for fixed-value chores in money-enabled households.
- `reject_chore_submission(submission_id, feedback)` rejects a submitted chore and preserves parent feedback.
- `reopen_chore_instance(instance_id, feedback)` moves rejected or expired chores back to assigned and records the reopen event.
- `delete_submission_photo(submission_id)` lets a household parent mark a submitted photo deleted without deleting submission history; the parent server action also attempts to remove the stored object.
- `close_out_payout(pay_period_id, child_profile_id, note)` creates one payout event, appends the payout ledger row, and marks related submission photos deleted after closeout; the parent server action also attempts to remove the stored objects.

`create_chore_credit` and `current_payout_parent_id` are internal helper functions used by command RPCs.

`create_parent_household` creates the first parent household atomically:
- household row
- admin household membership for the current parent
- primary payout parent assignment when money is enabled
- chosen weekly or biweekly pay cycle setting when money is enabled

`create_child_invitation` creates an open child invite for a household parent.

`create_parent_invitation` creates an open parent invite for a household admin.

`accept_child_invitation` lets the signed-in invited child accept the invite and atomically creates:
- child household membership
- child profile, if the child does not already have one
- accepted invitation metadata

`accept_parent_invitation` lets the signed-in invited parent accept the invite and atomically creates:
- parent household membership
- accepted invitation metadata
- removal of any previous parent/admin household membership for that parent account

`revoke_household_invitation` lets a household parent revoke an unaccepted invite.

`upsert_child_availability_window` lets a household parent create or replace the child's base availability pattern for that household.

`upsert_child_availability_override` lets a household parent add or replace one date-specific availability override.

`delete_child_availability_override` lets a household parent remove an override without touching the base pattern.

## Auth bootstrap

`handle_new_auth_user` runs after inserts into `auth.users` and creates the matching `public.profiles` row.

Expected sign-up metadata:
- `app_role`: `parent` or `child`
- `display_name`: user-facing display name

Invalid or missing roles default to `parent`. Missing display names fall back to the email prefix.

## Initial constraints

- A child has one primary household through `child_profiles.primary_household_id`.
- A child primary household must be an existing membership for that child.
- A household has at most one primary payout parent via partial unique index.
- Primary payout parent must have admin or parent membership role.
- Availability windows and overrides must point to valid child household memberships.
- Availability windows and overrides must match the child profile's underlying user.
- Availability offsets must be unique, non-negative, and lower than cycle length.
- Chore template schedule fields must match their schedule type.
- Fixed-value chore templates and instances must carry a positive amount; non-fixed values must carry zero.
- Chore templates and instances can be unpaid and not ledger-producing.
- Generated chore instances are unique by template, occurrence date, assignee/up-for-grabs slot, and due window.
- Up-for-grabs chore instances can start unassigned; directly assigned instances cannot.
- Pay cycle setting fields must match their cycle type.
- Pay periods are unique per household/date range.
- Payout events are unique per child/pay period.
- Ledger rows must use valid amount signs for their transaction type.
- Ledger rows snapshot the child's current primary household and that household's current primary payout parent on insert.
- Approved-credit command writes require the supplied pay period to belong to the payout household and contain the approval/effective date.
- Ledger rows are append-only.
- Command functions lock mutable chore/pay-period rows before state transitions.
- Parent approval and payout closeout are separate commands with separate permission checks.
- Household money settings should determine whether pay cycle, pay period, ledger, and payout commands are available or required.

## Initial RLS intent

Policies are intentionally conservative and should be reviewed before production:

- Users can read/update their own profile.
- Household members can read their households.
- Household admins can update their households.
- Household members can read memberships in their households.
- Household admins can manage memberships in their households.
- Child users can read their own child profile.
- Household members can read co-member display profiles.
- Household parents/admins can read child profiles for children in their households.
- Household admins can manage child availability for their households.
- Household members can read chore templates, assignees, instances, claims, submissions, and approval events in their household.
- Household parents can manage chore templates, assignees, instances, submissions, and approval events.
- Children can insert claims for available up-for-grabs chores they own through their child profile.
- Children can insert submissions for assigned chores they own through their child profile.
- Household members can read pay cycle settings and pay periods.
- Household parents can manage pay cycle settings and pay periods for their household when money features are enabled.
- Children can read their own ledger and payout events.
- Payout-household parents can read and insert ledger and payout closeout rows.

## Known follow-up decisions

- Add configurable custody payout policy post-MVP so parents can choose between primary-household payout responsibility and earning-household payout responsibility.
- Add household money feature settings and revise onboarding so payout parent/pay cycle setup is optional.
- Update command functions so unpaid, allowance-included, and money-disabled completions never require or create ledger rows.
- Decide whether fixed-value chores are disallowed while household money features are disabled or merely hidden in the UI.
- Add Phase 2 schema for child-owned todos, goals, budgets, spending entries, and savings goals.
- Decide default parent visibility for child-owned todos/goals and manual spending entries.
- Add audit log table before permission-sensitive admin flows are exposed.
- Add stronger RLS tests once Supabase local tooling is wired.
- Decide whether enforcing "at least one primary payout parent per household" belongs in database triggers or service-layer onboarding rules.
- Add service-layer generation tests that prove all-eligible and up-for-grabs instances respect custody availability and overrides.
- Add generated TypeScript wrappers for RPC command calls once Supabase client code is introduced.
- Add pay-period creation/upsert command so approval flows do not require callers to pre-create periods manually.
- Add a retryable object-storage cleanup job for photo object removals that fail during parent deletion or pay-period closeout.
- Expand onboarding for secondary parent invitations.
- Add hosted email delivery for invitation links once Supabase email settings are configured.
