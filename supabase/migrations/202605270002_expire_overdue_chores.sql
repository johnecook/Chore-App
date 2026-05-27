-- Scheduled expiration for missed chore instances.

create extension if not exists pg_cron with schema extensions;

create or replace function public.expire_overdue_chore_instances(
  reference_time timestamptz default now()
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count int;
begin
  update public.chore_instances instance
  set status = 'expired'
  from public.households household
  where household.id = instance.earning_household_id
    and instance.status in ('assigned', 'available', 'rejected')
    and (
      (
        instance.due_window_end is not null
        and instance.due_window_end <= reference_time
      )
      or (
        instance.due_window_end is null
        and ((instance.occurrence_date + 1)::timestamp at time zone household.timezone) <= reference_time
      )
    );

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

do $$
begin
  perform cron.unschedule('expire-overdue-chore-instances');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'expire-overdue-chore-instances',
  '*/15 * * * *',
  $$select public.expire_overdue_chore_instances();$$
);
