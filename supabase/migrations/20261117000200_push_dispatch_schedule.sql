-- Owner applies after 20261117000100 and enabling pg_cron, pg_net and Vault.
-- Safe to apply before credentials: tick does nothing until both Vault secrets exist.
begin;
create function notification_private.dispatch_tick() returns void
language plpgsql security definer set search_path='' as $$
declare endpoint text; secret_value text;
begin
 if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then return;end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1' into endpoint using 'tasawuq_push_dispatch_url';
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1' into secret_value using 'tasawuq_push_dispatch_secret';
 if endpoint is null or secret_value is null then return;end if;
 -- Only the project's HTTPS Edge Function endpoint is accepted; no arbitrary outbound URL.
 if endpoint !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/push-dispatch$' then raise exception 'Invalid push endpoint';end if;
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=15000)'
 using endpoint,jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret_value),'{}'::jsonb;
end $$;
revoke all on function notification_private.dispatch_tick() from public,anon,authenticated,service_role;
do $$begin
 if to_regclass('cron.job') is not null then
 execute $sql$select cron.schedule('tasawuq-push-dispatch','* * * * *','select notification_private.dispatch_tick()')$sql$;
 else raise notice 'pg_cron unavailable: owner must enable extensions BEFORE applying this migration to create the schedule';
 end if;
end $$;
commit;
