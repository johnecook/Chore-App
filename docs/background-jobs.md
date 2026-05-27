# Background Jobs

## Decision

Use Supabase-native scheduling for MVP background work.

- Use Supabase Cron / `pg_cron` for recurring database jobs.
- Use scheduled Edge Functions, triggered by Supabase Cron, for work that needs external APIs, object storage, or richer retry handling.
- Keep command functions idempotent where possible so scheduled jobs can safely retry.

Supabase Cron is built on the `pg_cron` Postgres extension:
https://supabase.com/docs/guides/cron

Supabase supports scheduled Edge Functions through `pg_cron` and `pg_net`:
https://supabase.com/docs/guides/functions/schedule-functions

## MVP Job Boundaries

Run in Postgres through `pg_cron`:

- Expire overdue chore instances.
- Generate recurring chore instances.
- Reconcile database-only cleanup markers.

Run as scheduled Edge Functions:

- Retry physical object deletion for chore photos.
- Send push notifications and write inbox fallback events.
- Future email delivery cleanup.

## Implemented Jobs

### `expire-overdue-chore-instances`

Schedule: every 15 minutes.

Calls `public.expire_overdue_chore_instances()`.

The function marks open `assigned`, `available`, and `rejected` chore instances as `expired` after their due window closes. If an instance has no explicit `due_window_end`, it expires after the household-local occurrence day ends.

The function returns the number of instances expired for observability in `cron.job_run_details`.
