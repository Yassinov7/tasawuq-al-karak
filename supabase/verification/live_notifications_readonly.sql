-- Owner-only READ-ONLY diagnostics. Never includes tokens, secrets or notification bodies.
select schemaname,tablename from pg_publication_tables
where pubname='supabase_realtime' and tablename in('money_invoices','money_allocations','money_driver_policies','merchant_applications','driver_applications','notifications','customer_orders','store_orders','delivery_tasks') order by tablename;
select event_object_table,trigger_name from information_schema.triggers
where trigger_schema='public' and trigger_name in('money_invoice_notification','merchant_application_notification','driver_application_notification','notification_push_enqueue') order by trigger_name;
select p.proname,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_can_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') service_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in('register_push_device','disable_push_device','claim_push_deliveries','finish_push_delivery','reconcile_push_deliveries','authorize_push_delivery');
select has_table_privilege('authenticated','public.push_devices','SELECT') client_can_read_devices,
 has_table_privilege('authenticated','public.push_deliveries','SELECT') client_can_read_queue;
select state,count(*),min(created_at) oldest from public.push_deliveries group by state order by state;
select last_error,count(*) from public.push_deliveries where last_error is not null group by last_error;
-- Presence only. Run the following only AFTER enabling extensions and applying the schedule migration.
select jobname,schedule,active from cron.job where jobname='tasawuq-push-dispatch';
select name from vault.secrets where name in('tasawuq_push_dispatch_url','tasawuq_push_dispatch_secret');
