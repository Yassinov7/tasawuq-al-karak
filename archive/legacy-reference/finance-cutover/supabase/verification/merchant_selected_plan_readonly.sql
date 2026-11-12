-- Owner-run read-only verification after MIG-003; contains no personal data.
begin transaction read only;
select public.get_signup_capabilities() as expected_3;
select has_function_privilege('authenticated','public.assign_application_plan(uuid,uuid)','execute') as expected_false;
select count(*) as legacy_pending_without_plan from public.merchant_applications where status='pending' and plan_id is null;
select count(*) as active_complete_plans from public.subscription_plans where is_active and commission_rate is not null and product_limit is not null and jsonb_typeof(features)='array';
commit;
