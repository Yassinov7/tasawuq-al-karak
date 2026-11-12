-- OWNER READ-ONLY ONLY. No activation or application/test RPC calls.
begin read only;
select current_database(),current_user,current_setting('transaction_read_only');
select path,admit,finance_private.c11_readiness(path) as structural_readiness from finance_private.c11_gates order by path;
select kind,count(*) as records from finance_private.c11_legacy_review group by kind order by kind;
select kind,entity_id,amount::text,note from finance_private.c11_legacy_review order by kind,entity_id limit 100;
select m.mode,count(*) from public.order_financial_modes m group by m.mode;
select count(*) as pre_contract_legacy_orders from public.customer_orders o where not exists(select 1 from public.order_financial_modes m where m.customer_order_id=o.id);
select count(*) as frozen_new_cohorts from finance_private.c11_order_contracts;
select count(*) as audited_subscription_transitions from finance_private.c11_subscription_transitions;
select scope,code,severity,count(*) from finance_private.c10_reconciliation_issues group by scope,code,severity order by scope,code;
select t.tgname,t.tgenabled,c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid where t.tgname like 'c11_%' order by t.tgname;
select n.nspname,p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'execute') anon_execute,has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,has_function_privilege('service_role',p.oid,'execute') service_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='finance_private' and p.proname like 'c11_%' or n.nspname='public' and p.proname in ('set_finance_transition_gate','transition_legacy_subscription','get_legacy_delivery_collection','read_finance_transition') order by n.nspname,p.proname;
rollback;
