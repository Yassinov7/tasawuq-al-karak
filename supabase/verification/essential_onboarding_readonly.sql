-- Owner-run verification only. No personal values, writes or sequence advances.
begin transaction read only;
select public.get_signup_capabilities() as expected_version_3;
select table_name,column_name,is_nullable from information_schema.columns
where table_schema='public' and (
 (table_name='profiles' and column_name='birth_date') or
 (table_name='merchant_applications' and column_name in ('public_reference','plan_id')) or
 (table_name='driver_applications' and column_name in ('public_reference','contract_duration_months'))
) order by table_name,column_name;
select p.oid::regprocedure::text as function_signature,
 has_function_privilege('anon',p.oid,'execute') as anon_may_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_may_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('get_signup_capabilities','submit_professional_onboarding','assign_application_plan')
order by function_signature;
select count(*) as private_helpers_callable_by_public_roles
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='onboarding_private'
and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'));
select 'merchant' as role,count(*) filter(where public_reference !~ '^MAP-[0-9]{7,}$') as invalid_references,
 count(*)-count(distinct public_reference) as duplicate_references from public.merchant_applications
union all
select 'driver',count(*) filter(where public_reference !~ '^DAP-[0-9]{7,}$'),
 count(*)-count(distinct public_reference) from public.driver_applications;
rollback;
