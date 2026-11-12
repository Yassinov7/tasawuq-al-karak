-- Owner-run, read-only checks for MIG-002. No personal data or mutation.
begin transaction read only;
select public.get_signup_capabilities()=2 as onboarding_ready;
select p.prosecdef as security_definer,
 position('plan_row.currency' in pg_get_functiondef(p.oid))=0 as removed_currency_column_not_used,
 position('plan_currency_snapshot=''SYP''' in pg_get_functiondef(p.oid))>0 as syp_snapshot_explicit,
 has_function_privilege('anon',p.oid,'execute') as anon_must_be_false,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_entrypoint
from pg_proc p where p.oid='public.assign_application_plan(uuid,uuid)'::regprocedure;
select count(*) filter(where is_active and commission_rate is not null and product_limit is not null and jsonb_typeof(features)='array') as available_complete_plans
from public.subscription_plans;
rollback;
