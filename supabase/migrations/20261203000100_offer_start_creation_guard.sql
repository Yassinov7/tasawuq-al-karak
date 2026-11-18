-- Owner review/application only. Requires 20261202000100_central_notifications.sql.
-- save_store_offer_v2 creates via v1 (starts_at defaults to now()), then updates
-- starts_at in the SAME transaction. That initialization is not a past launch.
-- Preserve all existing consumed markers; no replay, backfill or Cron changes.
begin;
create or replace function notification_private.retain_started_offer() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.created_at < transaction_timestamp()
     and old.starts_at is distinct from new.starts_at
     and old.starts_at <= statement_timestamp()
     and old.is_active then
    insert into notification_private.offer_start_events values(old.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function notification_private.retain_started_offer() from public,anon,authenticated;
comment on function notification_private.retain_started_offer() is
  'Retain prior launches on reschedule; exclude initialization of rows created in the current transaction.';
commit;
