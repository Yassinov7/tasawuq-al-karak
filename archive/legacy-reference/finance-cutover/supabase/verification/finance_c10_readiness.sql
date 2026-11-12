-- OWNER-EXECUTED READ ONLY. No test fixtures, no set_config, no repair or financial writer calls.
begin read only;
select current_database(),current_user,current_setting('transaction_read_only') as read_only;
select scope,severity,code,count(*) as issue_count from finance_private.c10_reconciliation_issues group by scope,severity,code order by scope,severity,code;
select definition_code,owner_user_id,merchant_id,expected::text,actual::text from finance_private.c10_account_comparison where expected<>actual order by definition_code,owner_user_id,merchant_id;
select 'c4' phase,to_jsonb(x) flags from finance_private.c4_rollout x
union all select 'c5',to_jsonb(x) from finance_private.c5_rollout x
union all select 'c6',to_jsonb(x) from finance_private.c6_control x
union all select 'c7',to_jsonb(x) from finance_private.c7_control x
union all select 'c8',to_jsonb(x) from finance_private.c8_control x
union all select 'c9',to_jsonb(x) from finance_private.c9_control x;
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'execute') anon_execute,has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,
 has_function_privilege('service_role',p.oid,'execute') service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='finance_private' or n.nspname='public' and p.proname in (
 'quote_c3_cart','create_c3_order_from_cart','recover_c3_order_request','get_c3_order_context','update_store_order_status','accept_delivery_task',
 'confirm_c4_store_pickup','get_c4_pickup_context','complete_delivery_and_collect_cash','recover_delivery_collection',
 'request_c5_cash_handover','confirm_c5_cash_handover','recover_c5_cash_handover','get_c5_driver_custody','list_c5_cash_requests',
 'pay_c6_driver_wages','save_c6_wage_policy','recover_c6_operation','get_c6_driver_wages','list_c6_driver_wages',
 'prepare_c7_settlement','pay_c7_settlement','recover_c7_operation','get_c7_merchant_settlements','list_c7_merchant_settlements',
 'save_subscription_plan_version','enroll_subscription_account','change_subscription_account','issue_subscription_invoice','collect_subscription_invoice','read_subscription_account','recover_subscription_operation',
 'record_treasury_action','read_treasury_control','request_treasury_finance','act_on_treasury_finance','read_treasury_finance','recover_treasury_action','read_financial_reconciliation',
 'create_order_from_cart','accrue_store_order_commission','create_delivered_order_cash_foundations')
order by n.nspname,p.proname,p.oid;
-- Every private function/schema must deny these runtime roles. Public grants are not JWT proof.
select has_schema_privilege('anon','finance_private','usage') anon_usage,has_schema_privilege('authenticated','finance_private','usage') authenticated_usage,has_schema_privilege('service_role','finance_private','usage') service_usage;
select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') anon_write,
has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') authenticated_write,has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE') service_write
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in (
 'financial_document_references','financial_account_definitions','financial_accounts','financial_operations','financial_events','journal_entries','journal_lines','order_lifecycle_events',
 'order_financial_modes','delivery_store_pickups','delivery_collection_results','driver_cash_handover_requests','driver_cash_handover_attempts','delivery_wage_snapshots','driver_wage_entitlements','driver_cash_receipt_allocations','driver_wage_payments','driver_wage_payment_items',
 'merchant_delivery_positions','merchant_settlement_documents','merchant_settlement_document_items','c7_merchant_settlement_payments','subscription_memberships','subscription_billing_documents','subscription_cash_receipts','treasury_control_documents','treasury_finance_requests','treasury_finance_events','treasury_finance_postings') order by c.relname;
rollback;
