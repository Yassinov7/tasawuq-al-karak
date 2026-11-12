-- OWNER ONLY / expected Dashboard project ref: dfpaeiffqkmedftjiqbm.
-- Verify the project in Dashboard BEFORE execution; current_database() cannot prove its ref.
-- SELECT-only transaction; no auth claim simulation, writers, nextval, jobs or repairs.
-- Run sections 01-03 FIRST. If anything required is missing, STOP; do not run later sections.
begin transaction isolation level repeatable read read only;

-- 01 Identity: transaction_read_only must be on. Database name alone is NOT project identity.
select '01_identity' as section,current_database() as database_name,current_user as executing_role,
 version() as server_version,current_setting('transaction_read_only') as transaction_read_only,
 current_setting('transaction_isolation') as isolation_level;

-- GENERATED SOURCE INVENTORY: no schema changes are made by these checks.
-- 02 All eleven C4-C11 versions must exist. Owner-reported; this query rechecks catalog.
with required(version) as (values ('20261107000100'),
 ('20261107000200'),
 ('20261107000300'),
 ('20261108000100'),
 ('20261109000100'),
 ('20261110000100'),
 ('20261111000100'),
 ('20261112000100'),
 ('20261112000200'),
 ('20261113000100'),
 ('20261114000100'))
select '02_migration' as section,r.version,m.version is not null as pass from required r left join supabase_migrations.schema_migrations m using(version) order by r.version;

-- 03 Required public tables: each must exist and have RLS enabled.
with required(name) as (values ('public.financial_document_references'),
 ('public.financial_account_definitions'),
 ('public.financial_accounts'),
 ('public.financial_operations'),
 ('public.financial_events'),
 ('public.journal_entries'),
 ('public.journal_lines'),
 ('public.order_lifecycle_events'),
 ('public.order_pricing_snapshots'),
 ('public.order_pricing_current'),
 ('public.order_pricing_revisions'),
 ('public.customer_order_requests'),
 ('public.order_financial_modes'),
 ('public.delivery_pickup_workflows'),
 ('public.delivery_store_pickups'),
 ('public.delivery_collection_results'),
 ('public.driver_cash_handover_requests'),
 ('public.driver_cash_handover_attempts'),
 ('public.driver_wage_policies'),
 ('public.delivery_wage_snapshots'),
 ('public.driver_wage_entitlements'),
 ('public.driver_cash_receipt_allocations'),
 ('public.driver_wage_payments'),
 ('public.driver_wage_payment_items'),
 ('public.merchant_delivery_positions'),
 ('public.merchant_settlement_documents'),
 ('public.merchant_settlement_document_items'),
 ('public.c7_merchant_settlement_payments'),
 ('public.subscription_plan_versions'),
 ('public.subscription_memberships'),
 ('public.subscription_account_events'),
 ('public.subscription_billing_documents'),
 ('public.subscription_cash_receipts'),
 ('public.treasury_control_documents'),
 ('public.treasury_finance_requests'),
 ('public.treasury_finance_events'),
 ('public.treasury_finance_postings'))
select '03_table' as section,r.name,c.oid is not null as present,c.relrowsecurity as rls_enabled,c.relowner::regrole as owner,
 (select count(*) from pg_policy policy where policy.polrelid=c.oid) as policy_count
from required r left join pg_class c on c.oid=to_regclass(r.name) order by r.name;

with required(name) as (values ('public.financial_document_references'),
 ('public.financial_account_definitions'),
 ('public.financial_accounts'),
 ('public.financial_operations'),
 ('public.financial_events'),
 ('public.journal_entries'),
 ('public.journal_lines'),
 ('public.order_lifecycle_events'),
 ('public.order_pricing_snapshots'),
 ('public.order_pricing_current'),
 ('public.order_pricing_revisions'),
 ('public.customer_order_requests'),
 ('public.order_financial_modes'),
 ('public.delivery_pickup_workflows'),
 ('public.delivery_store_pickups'),
 ('public.delivery_collection_results'),
 ('public.driver_cash_handover_requests'),
 ('public.driver_cash_handover_attempts'),
 ('public.driver_wage_policies'),
 ('public.delivery_wage_snapshots'),
 ('public.driver_wage_entitlements'),
 ('public.driver_cash_receipt_allocations'),
 ('public.driver_wage_payments'),
 ('public.driver_wage_payment_items'),
 ('public.merchant_delivery_positions'),
 ('public.merchant_settlement_documents'),
 ('public.merchant_settlement_document_items'),
 ('public.c7_merchant_settlement_payments'),
 ('public.subscription_plan_versions'),
 ('public.subscription_memberships'),
 ('public.subscription_account_events'),
 ('public.subscription_billing_documents'),
 ('public.subscription_cash_receipts'),
 ('public.treasury_control_documents'),
 ('public.treasury_finance_requests'),
 ('public.treasury_finance_events'),
 ('public.treasury_finance_postings'))
select '03_table_acl' as section,r.name,roles.role_name,has_table_privilege(roles.role_name,c.oid,'SELECT') as can_select,has_table_privilege(roles.role_name,c.oid,'INSERT,UPDATE,DELETE') as can_write
from required r left join pg_class c on c.oid=to_regclass(r.name) cross join (values('anon'),
 ('authenticated'),
 ('service_role'))roles(role_name) order by r.name,roles.role_name;

-- Public operational RPCs: present + DEFINER + empty search_path; auth execute is NOT authorization proof.
with required(signature) as (values ('public.get_c2_financial_operation(uuid)'),
 ('public.find_c2_document_reference(text)'),
 ('public.save_c3_delivery_zone(uuid,text,numeric,numeric,boolean,bigint)'),
 ('public.get_c3_pricing_exceptions(integer)'),
 ('public.quote_c3_cart(uuid,uuid)'),
 ('public.create_c3_order_from_cart(text,text,text,uuid,text,uuid,numeric,uuid,text)'),
 ('public.recover_c3_order_request(uuid,uuid)'),
 ('public.get_c3_order_context(uuid[])'),
 ('public.update_store_order_status(uuid,public.store_order_status,text)'),
 ('public.cancel_customer_order(uuid)'),
 ('public.reverse_store_order_commission(uuid,numeric,uuid,text)'),
 ('public.accept_delivery_task(uuid)'),
 ('public.update_delivery_task_status(uuid,public.delivery_task_status)'),
 ('public.get_c4_pickup_context(uuid[],uuid)'),
 ('public.confirm_c4_store_pickup(uuid,uuid,uuid)'),
 ('public.complete_delivery_and_collect_cash(uuid,uuid,uuid,bigint)'),
 ('public.recover_delivery_collection(uuid,uuid)'),
 ('public.recover_c5_cash_handover(uuid,uuid)'),
 ('public.recover_c6_operation(uuid,uuid)'),
 ('public.recover_c7_operation(uuid,uuid)'),
 ('public.recover_subscription_operation(uuid,uuid)'),
 ('public.request_c5_cash_handover(uuid,uuid,numeric)'),
 ('public.confirm_c5_cash_handover(uuid,uuid,uuid,uuid,numeric)'),
 ('public.get_c5_driver_custody(uuid,uuid,integer)'),
 ('public.get_c6_driver_wages(uuid,uuid,integer)'),
 ('public.list_c5_cash_requests(uuid,text,integer)'),
 ('public.get_c6_wage_policy(uuid,integer)'),
 ('public.list_c6_driver_wages(uuid,integer)'),
 ('public.list_c7_merchant_settlements(uuid,integer)'),
 ('public.list_subscription_accounts(uuid,integer)'),
 ('public.save_c6_wage_policy(uuid,uuid,uuid,numeric,text)'),
 ('public.pay_c6_driver_wages(uuid,uuid,uuid,uuid[],numeric)'),
 ('public.get_c7_merchant_settlements(uuid,uuid,integer)'),
 ('public.read_subscription_account(uuid,uuid,integer)'),
 ('public.prepare_c7_settlement(uuid,uuid,uuid,uuid[],numeric)'),
 ('public.pay_c7_settlement(uuid,uuid,uuid,uuid,numeric)'),
 ('public.save_subscription_plan_version(uuid,uuid,uuid,text,text,numeric,integer,boolean,timestamptz,text)'),
 ('public.enroll_subscription_account(uuid,uuid,uuid,uuid,text)'),
 ('public.change_subscription_account(uuid,uuid,uuid,text,text,text)'),
 ('public.issue_subscription_invoice(uuid,uuid,uuid,text)'),
 ('public.collect_subscription_invoice(uuid,uuid,uuid,uuid,numeric,text)'),
 ('public.record_treasury_action(uuid,uuid,jsonb)'),
 ('public.read_treasury_control(uuid,text,integer,timestamptz,timestamptz,text,uuid)'),
 ('public.request_treasury_finance(uuid,uuid,jsonb)'),
 ('public.read_treasury_finance(uuid,text,integer)'),
 ('public.act_on_treasury_finance(uuid,uuid,uuid,text,text,boolean)'),
 ('public.recover_treasury_action(uuid,uuid)'),
 ('public.read_financial_reconciliation(uuid,integer,text)'),
 ('public.set_finance_transition_gate(uuid,text,boolean,text)'),
 ('public.transition_legacy_subscription(uuid,uuid,uuid,uuid,text)'),
 ('public.get_legacy_delivery_collection(uuid,uuid)'),
 ('public.read_finance_transition(uuid,integer)'))
select '03_rpc' as section,r.signature,p.oid is not null as present,p.prosecdef,coalesce(p.proconfig @> array['search_path=""'],false) as empty_search_path,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from required r left join pg_proc p on p.oid=to_regprocedure(r.signature) order by r.signature;

-- These three builders must NOT be executable by runtime roles.
with required(signature) as (values('public.create_order_from_cart(text,text,text,uuid,text)'),
 ('public.accrue_store_order_commission(uuid,timestamp with time zone)'),
 ('public.create_delivered_order_cash_foundations(uuid)'))
select '03_internal_acl' as section,r.signature,p.oid is not null as present,roles.role_name,has_function_privilege(roles.role_name,p.oid,'EXECUTE') as can_execute
from required r left join pg_proc p on p.oid=to_regprocedure(r.signature) cross join (values('anon'),
 ('authenticated'),
 ('service_role'))roles(role_name) order by r.signature,roles.role_name;

-- Trigger definitions are evidence for review, not proof that transitions work.
select '03_triggers' as section,n.nspname,c.relname,t.tgname,t.tgenabled,t.tgdeferrable,t.tginitdeferred,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname='public' and (c.relname in ('financial_document_references','financial_account_definitions','financial_accounts','financial_operations','financial_events','journal_entries','journal_lines','order_lifecycle_events','order_pricing_snapshots','order_pricing_current','order_pricing_revisions','customer_order_requests','order_financial_modes','delivery_pickup_workflows','delivery_store_pickups','delivery_collection_results','driver_cash_handover_requests','driver_cash_handover_attempts','driver_wage_policies','delivery_wage_snapshots','driver_wage_entitlements','driver_cash_receipt_allocations','driver_wage_payments','driver_wage_payment_items','merchant_delivery_positions','merchant_settlement_documents','merchant_settlement_document_items','c7_merchant_settlement_payments','subscription_plan_versions','subscription_memberships','subscription_account_events','subscription_billing_documents','subscription_cash_receipts','treasury_control_documents','treasury_finance_requests','treasury_finance_events','treasury_finance_postings') or c.relname in ('store_orders','delivery_tasks','store_order_totals','store_order_commissions')) order by c.relname,t.tgname;

-- ZERO ROWS expected: invalid/unvalidated financial constraints or indexes.
select '03_unvalidated_constraint' as check_name,c.conrelid::regclass as relation,c.conname from pg_constraint c where not c.convalidated and c.conrelid in ('public.financial_document_references'::regclass,'public.financial_account_definitions'::regclass,'public.financial_accounts'::regclass,'public.financial_operations'::regclass,'public.financial_events'::regclass,'public.journal_entries'::regclass,'public.journal_lines'::regclass,'public.order_lifecycle_events'::regclass,'public.order_pricing_snapshots'::regclass,'public.order_pricing_current'::regclass,'public.order_pricing_revisions'::regclass,'public.customer_order_requests'::regclass,'public.order_financial_modes'::regclass,'public.delivery_pickup_workflows'::regclass,'public.delivery_store_pickups'::regclass,'public.delivery_collection_results'::regclass,'public.driver_cash_handover_requests'::regclass,'public.driver_cash_handover_attempts'::regclass,'public.driver_wage_policies'::regclass,'public.delivery_wage_snapshots'::regclass,'public.driver_wage_entitlements'::regclass,'public.driver_cash_receipt_allocations'::regclass,'public.driver_wage_payments'::regclass,'public.driver_wage_payment_items'::regclass,'public.merchant_delivery_positions'::regclass,'public.merchant_settlement_documents'::regclass,'public.merchant_settlement_document_items'::regclass,'public.c7_merchant_settlement_payments'::regclass,'public.subscription_plan_versions'::regclass,'public.subscription_memberships'::regclass,'public.subscription_account_events'::regclass,'public.subscription_billing_documents'::regclass,'public.subscription_cash_receipts'::regclass,'public.treasury_control_documents'::regclass,'public.treasury_finance_requests'::regclass,'public.treasury_finance_events'::regclass,'public.treasury_finance_postings'::regclass);
select '03_invalid_index' as check_name,i.indrelid::regclass as relation,i.indexrelid::regclass as index_name from pg_index i where (not i.indisvalid or not i.indisready) and i.indrelid in ('public.financial_document_references'::regclass,'public.financial_account_definitions'::regclass,'public.financial_accounts'::regclass,'public.financial_operations'::regclass,'public.financial_events'::regclass,'public.journal_entries'::regclass,'public.journal_lines'::regclass,'public.order_lifecycle_events'::regclass,'public.order_pricing_snapshots'::regclass,'public.order_pricing_current'::regclass,'public.order_pricing_revisions'::regclass,'public.customer_order_requests'::regclass,'public.order_financial_modes'::regclass,'public.delivery_pickup_workflows'::regclass,'public.delivery_store_pickups'::regclass,'public.delivery_collection_results'::regclass,'public.driver_cash_handover_requests'::regclass,'public.driver_cash_handover_attempts'::regclass,'public.driver_wage_policies'::regclass,'public.delivery_wage_snapshots'::regclass,'public.driver_wage_entitlements'::regclass,'public.driver_cash_receipt_allocations'::regclass,'public.driver_wage_payments'::regclass,'public.driver_wage_payment_items'::regclass,'public.merchant_delivery_positions'::regclass,'public.merchant_settlement_documents'::regclass,'public.merchant_settlement_document_items'::regclass,'public.c7_merchant_settlement_payments'::regclass,'public.subscription_plan_versions'::regclass,'public.subscription_memberships'::regclass,'public.subscription_account_events'::regclass,'public.subscription_billing_documents'::regclass,'public.subscription_cash_receipts'::regclass,'public.treasury_control_documents'::regclass,'public.treasury_finance_requests'::regclass,'public.treasury_finance_events'::regclass,'public.treasury_finance_postings'::regclass);


-- Expected named static financial guards plus C4 dynamic legacy fences.
with required(relation_name,trigger_name) as (values
 ('public.financial_document_references','financial_document_reference_assign'),
 ('public.financial_document_references','financial_document_reference_immutable'),
 ('public.financial_accounts','financial_account_validate'),
 ('public.financial_accounts','financial_account_immutable'),
 ('public.financial_account_definitions','financial_account_definition_immutable'),
 ('public.financial_events','financial_event_immutable'),
 ('public.journal_entries','journal_entry_guard'),
 ('public.journal_lines','journal_line_guard'),
 ('public.journal_entries','journal_entry_complete'),
 ('public.journal_lines','journal_line_balanced'),
 ('public.financial_operations','financial_operation_guard'),
 ('public.financial_operations','financial_operation_complete'),
 ('public.financial_events','financial_event_complete'),
 ('public.order_lifecycle_events','lifecycle_event_immutable'),
 ('public.order_lifecycle_events','lifecycle_event_validate'),
 ('public.delivery_zones','c3_zone_version'),
 ('public.order_pricing_snapshots','c3_snapshot_immutable'),
 ('public.order_pricing_revisions','c3_revision_immutable'),
 ('public.order_financial_modes','c4_mode_immutable'),
 ('public.customer_orders','c4_order_birth'),
 ('public.order_pricing_snapshots','c4_select_order_mode'),
 ('public.delivery_pickup_workflows','c4_workflow_immutable'),
 ('public.delivery_store_pickups','c4_pickup_immutable'),
 ('public.delivery_store_pickups','c4_pickup_validate'),
 ('public.delivery_tasks','c4_no_reassignment'),
 ('public.store_order_commissions','c4_commission_due_guard'),
 ('public.delivery_collection_results','c4_collection_immutable'),
 ('public.delivery_tasks','c4_task_progress'),
 ('public.delivery_tasks','c4_task_atomic_result'),
 ('public.store_orders','c4_child_atomic_result'),
 ('public.driver_cash_handover_requests','c5_request_immutable'),
 ('public.driver_cash_handover_attempts','c5_attempt_immutable'),
 ('public.driver_cash_handover_requests','c5_request_validate'),
 ('public.driver_cash_handover_requests','c5_request_completed'),
 ('public.driver_cash_handover_attempts','c5_attempt_validate'),
 ('public.driver_cash_handover_attempts','c5_confirmed_receipt'),
 ('public.delivery_tasks','c6_capture_on_new_dlv'),
 ('public.delivery_wage_snapshots','c6_validate_snapshot'),
 ('public.delivery_collection_results','c6_accrual_required'),
 ('public.driver_cash_receipt_allocations','c6_allocation_validate'),
 ('public.driver_cash_handover_attempts','c6_allocate_rct'),
 ('public.driver_wage_payment_items','c6_payment_item_validate'),
 ('public.driver_wage_payments','c6_payment_complete'),
 ('public.delivery_collection_results','c7_delivery_detail'),
 ('public.merchant_settlement_document_items','c7_item_validate'),
 ('public.merchant_settlement_documents','c7_set_complete'),
 ('public.c7_merchant_settlement_payments','c7_pay_complete'),
 ('public.merchant_subscriptions','c8_native_period_guard'),
 ('public.subscription_invoices','c8_old_invoice_guard'),
 ('public.merchant_billing_settings','c8_old_billing_guard'),
 ('public.merchant_subscription_plan_changes','c8_old_change_guard'),
 ('public.subscription_payments','c8_old_payment_guard'),
 ('public.subscription_billing_documents','c8_invoice_complete'),
 ('public.subscription_cash_receipts','c8_receipt_complete'),
 ('public.driver_cash_handover_attempts','c9_serialize_c5_receipt'),
 ('public.treasury_control_documents','c9_document_immutable'),
 ('public.treasury_control_documents','c9_document_complete'),
 ('public.financial_events','c11_audit_immutable'),
 ('public.treasury_finance_requests','c11_new_treasury_request'),
 ('public.customer_order_cash_obligations','c4_legacy_write_guard'),
 ('public.driver_delivery_fee_entitlements','c4_legacy_write_guard'),
 ('public.merchant_order_entitlements','c4_legacy_write_guard'),
 ('public.store_order_commission_reversals','c4_legacy_write_guard'),
 ('public.merchant_order_entitlement_adjustments','c4_legacy_write_guard'),
 ('public.merchant_ledger_entries','c4_legacy_write_guard'))
select '03_required_trigger' as section,r.relation_name,r.trigger_name,t.oid is not null as present,t.tgenabled,
 t.oid is not null and t.tgenabled in ('O','A') as pass
from required r left join pg_trigger t on t.tgrelid=to_regclass(r.relation_name) and t.tgname=r.trigger_name order by r.relation_name,r.trigger_name;

-- 04 Existing policies: expected per-role predicates must be reviewed, not just policy count.
select '04_policies' as section,p.schemaname,p.tablename,p.policyname,p.roles,p.cmd,p.qual,p.with_check
from pg_policies p where p.schemaname='public' and p.tablename in
 ('financial_document_references','financial_account_definitions','financial_accounts','financial_operations','financial_events','journal_entries','journal_lines','order_lifecycle_events','order_pricing_snapshots','order_pricing_current','order_pricing_revisions','customer_order_requests','order_financial_modes','delivery_pickup_workflows','delivery_store_pickups','delivery_collection_results','driver_cash_handover_requests','driver_cash_handover_attempts','driver_wage_policies','delivery_wage_snapshots','driver_wage_entitlements','driver_cash_receipt_allocations','driver_wage_payments','driver_wage_payment_items','merchant_delivery_positions','merchant_settlement_documents','merchant_settlement_document_items','c7_merchant_settlement_payments','subscription_plan_versions','subscription_memberships','subscription_account_events','subscription_billing_documents','subscription_cash_receipts','treasury_control_documents','treasury_finance_requests','treasury_finance_events','treasury_finance_postings')
order by p.tablename,p.policyname;
-- ZERO ROWS expected. Neither private schema access nor private EXECUTE is allowed to runtime roles.
select '04_private_schema_exposure' as check_name,r.role_name from (values('anon'),
 ('authenticated'),
 ('service_role'))r(role_name)
where has_schema_privilege(r.role_name,'finance_private','USAGE');
select '04_private_execute_exposure' as check_name,r.role_name,p.proname,pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join (values('anon'),
 ('authenticated'),
 ('service_role'))r(role_name)
where n.nspname='finance_private' and has_function_privilege(r.role_name,p.oid,'EXECUTE');
select '04_private_object_exposure' as check_name,r.role_name,c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values('anon'),
 ('authenticated'),
 ('service_role'))r(role_name)
where n.nspname='finance_private' and c.relkind in ('r','v','m') and has_table_privilege(r.role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE');
select '04_private_sequence_exposure' as check_name,r.role_name,c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values('anon'),
 ('authenticated'),
 ('service_role'))r(role_name)
where n.nspname='finance_private' and c.relkind='S' and has_sequence_privilege(r.role_name,c.oid,'USAGE,SELECT,UPDATE');
-- ZERO ROWS expected. Empty search_path required for private SECURITY DEFINER functions.
select '04_unsafe_definer' as check_name,p.proname,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='finance_private' and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'],false);

-- 05 C4 decimal contract. Must be unscaled numeric and named decimal CHECK, never trunc(amount).
with expected(code,account_type,owner_kind) as (values
 ('driver_cash','asset','driver'),
 ('treasury_cash','asset','system'),
 ('customer_advance','liability','customer'),
 ('merchant_sales_payable','liability','merchant'),
 ('driver_earnings_payable','liability','driver'),
 ('delivery_revenue','income','system'),
 ('commission_revenue','income','system'),
 ('driver_earnings_expense','expense','system'),
 ('subscription_receivable','asset','merchant'),
 ('subscription_revenue','income','system'),
 ('subscription_unallocated','liability','merchant'),
 ('authorized_suspense_asset','asset','system'),
 ('authorized_suspense_liability','liability','system'),
 ('office_operating_expense','expense','system'),
 ('treasury_cash_shortage_expense','expense','system'),
 ('treasury_cash_overage_income','income','system'),
 ('opening_balance_equity','equity','system'))
select '05_accounts' as section,e.code,a.account_type,a.owner_kind,
 a.code is not null and a.account_type=e.account_type and a.owner_kind=e.owner_kind as pass
from expected e left join public.financial_account_definitions a using(code) order by e.code;
select '05_amount_type' as section,format_type(a.atttypid,a.atttypmod) as amount_type,a.atttypmod,
 a.atttypid='numeric'::regtype and a.atttypmod=-1 as unscaled_numeric
from pg_attribute a where a.attrelid='public.journal_lines'::regclass and a.attname='amount' and not a.attisdropped;
select '05_amount_checks' as section,c.conname,c.convalidated,pg_get_constraintdef(c.oid) as definition
from pg_constraint c where c.conrelid='public.journal_lines'::regclass and c.contype='c' order by c.conname;
select '05_decimal_constraint_present' as check_name,exists(select 1 from pg_constraint c where c.conrelid='public.journal_lines'::regclass and c.conname='journal_lines_syp_major_amount_check' and c.convalidated) as pass;
-- ZERO ROWS expected.
select '05_old_whole_amount_constraint' as check_name,c.conname from pg_constraint c
where c.conrelid='public.journal_lines'::regclass and pg_get_constraintdef(c.oid) ~* 'trunc\s*\(\s*amount\s*\)';

-- 06 C11: exactly 8 rows, all OFF. Missing/extra rows must not count as success.
with required(path) as (values('new_orders'),
 ('delivery'),
 ('custody'),
 ('wages'),
 ('settlements'),
 ('subscriptions'),
 ('treasury'),
 ('reconciliation'))
select '06_c11_gates' as section,coalesce(r.path,g.path) as path,g.admit,
 r.path is not null and g.path is not null and g.admit=false as pass
from required r full join finance_private.c11_gates g using(path) order by path;
select '06_c11_all_off' as check_name,count(*)=8 and bool_and(not admit) as pass,count(*) as gate_count from finance_private.c11_gates;
-- Baseline flags ALSO must be OFF; c11.admit=false alone deliberately preserves drain controls.
select '06_underlying_flags' as section,'c4' as phase,to_jsonb(x) as flags from finance_private.c4_rollout x
union all select '06_underlying_flags','c5',to_jsonb(x) from finance_private.c5_rollout x
union all select '06_underlying_flags','c6',to_jsonb(x) from finance_private.c6_control x
union all select '06_underlying_flags','c7',to_jsonb(x) from finance_private.c7_control x
union all select '06_underlying_flags','c8',to_jsonb(x) from finance_private.c8_control x
union all select '06_underlying_flags','c9',to_jsonb(x) from finance_private.c9_control x;
select '06_baseline_all_off' as check_name,
 (select count(*)=1 and bool_and(not accept_new_orders) from finance_private.c4_rollout)
 and (select count(*)=1 and bool_and(not accept_requests) from finance_private.c5_rollout)
 and (select count(*)=1 and bool_and(not accept_tasks and not payout_enabled) from finance_private.c6_control)
 and (select count(*)=1 and bool_and(not accept_settlements and not payout_enabled) from finance_private.c7_control)
 and (select count(*)=1 and bool_and(not accept_operations and not enforce_gate and not scheduler_enabled) from finance_private.c8_control)
 and (select count(*)=1 and bool_and(not enabled and not opening_enabled) from finance_private.c9_control) as pass;
-- Independent permissions; counts only. Nonzero means review, NOT automatic revocation.
select '06_sensitive_grants' as section,
 (select count(*) from finance_private.c11_permissions where may_control or may_review) as c11_grants,
 (select count(*) from finance_private.c10_permissions where may_reconcile) as c10_reconcilers,
 (select count(*) from finance_private.c9_system_owners) as mapped_owners;

-- 07 Existing ledger only. ZERO ROWS expected; an empty ledger is NOT behavioral evidence.
select '07_volume' as section,(select count(*) from public.journal_entries) as journals,
 (select count(*) from public.financial_events) as events,(select count(*) from public.delivery_collection_results) as c4_results;
select '07_bad_posted_journal' as check_name,j.id,count(l.id) as line_count,
 coalesce(sum(case l.side when 'debit' then l.amount else -l.amount end),0)::text as signed_difference
from public.journal_entries j left join public.journal_lines l on l.journal_entry_id=j.id where j.status='posted'
group by j.id having count(l.id)<2 or coalesce(sum(case l.side when 'debit' then l.amount else -l.amount end),0)<>0
 or bool_or(l.amount<=0 or l.amount<>round(l.amount,2));
select '07_event_incomplete' as check_name,e.id from public.financial_events e join public.financial_operations o on o.id=e.operation_id
where o.state<>'completed' or not exists(select 1 from public.journal_entries j where j.event_id=e.id and j.status='posted');
-- WARNING/review rows, not permission to replay or delete the operation.
select '07_pending_operation_review' as check_name,id,operation_type,created_at from public.financial_operations where state='pending' order by created_at limit 100;
select '07_duplicate_event' as check_name,source_reference_id,event_type,count(*) from public.financial_events group by source_reference_id,event_type having count(*)>1;
select '07_duplicate_reversal' as check_name,reversal_of,count(*) from public.journal_entries where reversal_of is not null group by reversal_of having count(*)>1;
select '07_invalid_reversal_parent' as check_name,r.id from public.journal_entries r left join public.journal_entries original on original.id=r.reversal_of
where r.reversal_of is not null and (original.id is null or original.status<>'posted' or r.id=r.reversal_of);
select '07_reversal_account_mismatch' as check_name,r.id,l.account_id,
 sum(case l.side when 'debit' then l.amount else -l.amount end)::text as net_pair
from public.journal_entries r join public.journal_lines l on l.journal_entry_id in (r.id,r.reversal_of)
where r.status='posted' and r.reversal_of is not null group by r.id,l.account_id
having sum(case l.side when 'debit' then l.amount else -l.amount end)<>0;
select '07_negative_treasury' as check_name,a.id,
 sum(case l.side when 'debit' then l.amount else -l.amount end)::text as balance
from public.financial_accounts a join public.journal_lines l on l.account_id=a.id
join public.journal_entries j on j.id=l.journal_entry_id and j.status='posted'
join public.financial_events e on e.id=j.event_id join public.financial_operations o on o.id=e.operation_id and o.state='completed'
where a.definition_code='treasury_cash' group by a.id having sum(case l.side when 'debit' then l.amount else -l.amount end)<0;

-- 08 Reference invariants. ZERO ROWS expected. Complete kind/FK definitions listed separately.
select '08_duplicate_document_reference' as check_name,kind,document_id,count(*) from public.financial_document_references group by kind,document_id having count(*)>1;
select '08_duplicate_public_reference' as check_name,public_reference,count(*) from public.financial_document_references group by public_reference having count(*)>1;
select '08_reference_format' as check_name,id,kind from public.financial_document_references
where reference_number<1 or public_reference<>kind||'-'||case when length(reference_number::text)<6 then lpad(reference_number::text,6,'0') else reference_number::text end;
select '08_duplicate_task' as check_name,customer_order_id,count(*) from public.delivery_tasks group by customer_order_id having count(*)>1;
select '08_duplicate_lifecycle_sequence' as check_name,customer_order_id,order_sequence,count(*) from public.order_lifecycle_events group by customer_order_id,order_sequence having count(*)>1;
select '08_reference_constraints' as section,conname,convalidated,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.financial_document_references'::regclass order by conname;

-- 09 Reviewed LOCAL C10 view chain uses SELECT-only helpers: subscription_invoice_voided,
-- c6_cash_remaining, c9_request_state, c9_cash_cut -> c9_cash_lines (ledger SELECT).
-- No financial RPC is called. READ ONLY prevents accidental database writes, not external jobs.
select '09_reconciliation' as section,scope,severity,code,count(*) as issue_count from finance_private.c10_reconciliation_issues group by scope,severity,code order by scope,severity,code;
select '09_reconciliation_totals' as section,count(*) filter(where severity='error') as errors,count(*) filter(where severity='warning') as warnings from finance_private.c10_reconciliation_issues;
select '09_account_differences' as section,definition_code,expected::text,actual::text from finance_private.c10_account_comparison where expected<>actual order by definition_code;

-- 10 Schedulers. DO NOT CALL scheduling or invoice functions. Optional cron file is separate.
select '10_scheduler_catalog' as section,to_regclass('cron.job') as pg_cron_jobs,to_regclass('pgagent.pga_job') as pgagent_jobs;
select '10_known_scheduler_functions' as section,n.nspname,p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('run_due_subscription_invoices','process_due_merchant_subscription_renewals') order by n.nspname,p.proname;
-- Automatic mode is not itself a scheduled job. Nonzero requires review alongside scheduler flags.
select '10_automatic_memberships' as section,count(*) as automatic_latest_mode from
 (select distinct on(merchant_id) merchant_id,value from public.subscription_account_events where kind='renewal' order by merchant_id,seq desc)x where value='automatic';
rollback;
