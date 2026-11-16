-- Owner applies after pg_cron is enabled and dispatch_tick() is installed.
-- Restores the Push worker schedule only.
begin;

do $$
declare
  dispatch_job_id bigint;
begin
  if to_regprocedure('notification_private.dispatch_tick()') is null then
    raise exception 'notification_private.dispatch_tick() is required';
  end if;

  if exists (
    select 1 from cron.job
    where jobname = 'tasawuq-push-dispatch' and username <> current_user
  ) then
    raise exception 'Run this migration as the existing Push Cron job owner';
  end if;

  dispatch_job_id := cron.schedule(
    'tasawuq-push-dispatch',
    '* * * * *',
    'select notification_private.dispatch_tick()'
  );
  perform cron.alter_job(dispatch_job_id, active := true);
end;
$$;

commit;
