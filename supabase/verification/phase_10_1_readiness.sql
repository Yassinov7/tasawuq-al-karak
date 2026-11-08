-- Phase 10.1: catalog inspection only. Run manually as the project SQL operator.
-- Never calls application RPCs; never creates objects or changes business rows.
-- Result sets show missing objects AND actual definitions/ACLs. Presence is not proof of application.
begin read only;
set local search_path = pg_catalog;
select current_database() as database_name, current_user as inspector,
 current_setting('server_version') as postgres_version,
 current_setting('server_version_num')::integer >= 150000 as supports_security_invoker_views,
 to_regclass('supabase_migrations.schema_migrations') as migration_history;

-- Optional history: NOTICE output, safe when the table or privileges are absent.
do $inspection$
declare item record; found_count integer := 0;
begin
 if to_regclass('supabase_migrations.schema_migrations') is null then
  raise notice 'Migration history unavailable; manual SQL application may not be registered.';
  return;
 end if;
 for item in execute
  'select version::text as version, to_jsonb(m) - ''statements'' as metadata
   from supabase_migrations.schema_migrations m
   where version::text = any($1) order by version::text'
  using array['20261018000800','20261018000900','20261018001000','20261018001100','20261018001200','20261018001300','20261018001400']::text[]
 loop
  found_count := found_count + 1;
  raise notice 'Registered migration: %', item.metadata;
 end loop;
 raise notice 'Matching history rows: % of 7; absence is not proof that SQL was never applied.', found_count;
exception when insufficient_privilege or undefined_column then
 raise notice 'Migration history cannot be inspected by this role/schema: %', sqlerrm;
end;
$inspection$;

with expected(phase, relation_name, expected_kind) as (values
  ('08', 'customer_order_cash_obligations', 'r'),
  ('08', 'driver_delivery_fee_entitlements', 'r'),
  ('08', 'merchant_order_entitlements', 'r'),
  ('08', 'merchant_order_entitlement_adjustments', 'r'),
  ('08', 'merchant_order_entitlement_positions', 'v'),
  ('09', 'driver_cash_remittances', 'r'),
  ('09', 'driver_cash_credit_payouts', 'r'),
  ('14', 'driver_cash_custody_positions', 'v'),
  ('10', 'merchant_settlement_batches', 'r'),
  ('10', 'merchant_settlement_batch_entitlements', 'r'),
  ('10', 'merchant_settlement_payments', 'r'),
  ('10', 'merchant_settlement_payment_allocations', 'r'),
  ('10', 'merchant_settlement_batch_positions', 'v'),
  ('11', 'admin_cash_movement_events', 'v'),
  ('11', 'admin_delivery_fee_report_rows', 'v'),
  ('11', 'admin_merchant_payout_report_rows', 'v'),
  ('11', 'admin_merchant_settlement_report_batches', 'v'),
  ('11', 'admin_merchant_financial_report_events', 'v'),
  ('11', 'admin_platform_revenue_report_events', 'v'),
  ('12', 'merchant_account_sale_rows', 'v'),
  ('12', 'merchant_account_settlement_rows', 'v'),
  ('base', 'merchant_billing_settings', 'r'),
  ('base', 'profiles', 'r'),
  ('base', 'merchants', 'r'),
  ('base', 'stores', 'r'),
  ('base', 'products', 'r'),
  ('base', 'product_media', 'r'),
  ('base', 'store_offers', 'r'),
  ('base', 'store_offer_products', 'r'),
  ('base', 'customer_carts', 'r'),
  ('base', 'customer_cart_items', 'r'),
  ('base', 'customer_cart_offer_selections', 'r'),
  ('base', 'customer_orders', 'r'),
  ('base', 'customer_order_totals', 'r'),
  ('base', 'store_orders', 'r'),
  ('base', 'store_order_items', 'r'),
  ('base', 'store_order_totals', 'r'),
  ('base', 'delivery_tasks', 'r'),
  ('base', 'delivery_zones', 'r'),
  ('base', 'driver_applications', 'r'),
  ('base', 'product_reviews', 'r'),
  ('base', 'store_order_commissions', 'r'),
  ('base', 'store_order_commission_reversals', 'r'),
  ('base', 'subscription_invoices', 'r'),
  ('base', 'subscription_payments', 'r'),
  ('base', 'invoice_payment_allocations', 'r'),
  ('base', 'merchant_subscriptions', 'r'),
  ('base', 'merchant_financial_positions', 'v'),
  ('base', 'notifications', 'r')
)
select e.*, case when c.oid is null then 'MISSING'
 when c.relkind::text <> e.expected_kind then 'WRONG_KIND' else 'PRESENT_REVIEW_DEFINITION' end as state,
 c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls,
 pg_get_userbyid(c.relowner) as owner, c.reloptions, c.relacl,
 case when c.relkind = 'v' then pg_get_viewdef(c.oid, true) end as view_definition,
 (select jsonb_agg(jsonb_build_object('role',r.rolname,'select',has_table_privilege(r.oid,c.oid,'SELECT'),
 'insert',has_table_privilege(r.oid,c.oid,'INSERT'),'update',has_table_privilege(r.oid,c.oid,'UPDATE'),
 'delete',has_table_privilege(r.oid,c.oid,'DELETE'),'truncate',has_table_privilege(r.oid,c.oid,'TRUNCATE')))
 from pg_roles r where r.rolname in ('anon','authenticated','service_role')) as effective_role_grants,
 (select jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'roles',p.polroles,
 'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),
 'check',pg_get_expr(p.polwithcheck,p.polrelid))) from pg_policy p where p.polrelid=c.oid) as policies,
 (select jsonb_agg(jsonb_build_object('name',k.conname,'validated',k.convalidated,
 'definition',pg_get_constraintdef(k.oid))) from pg_constraint k where k.conrelid=c.oid) as constraints,
 (select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,
 'definition',pg_get_triggerdef(t.oid,true))) from pg_trigger t
 where t.tgrelid=c.oid and not t.tgisinternal) as all_triggers,
 (select jsonb_agg(jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),
 'valid',i.indisvalid,'ready',i.indisready)) from pg_index i where i.indrelid=c.oid) as indexes
from expected e left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=e.relation_name
order by e.phase,e.relation_name;

-- Every column declared by 008-010; actual type/default/nullability are returned for comparison.
with expected(phase, relation_name, column_name) as (values
  ('08', 'customer_order_cash_obligations', 'id'),
  ('08', 'customer_order_cash_obligations', 'customer_order_id'),
  ('08', 'customer_order_cash_obligations', 'delivery_task_id'),
  ('08', 'customer_order_cash_obligations', 'driver_id'),
  ('08', 'customer_order_cash_obligations', 'currency'),
  ('08', 'customer_order_cash_obligations', 'delivery_zone_id'),
  ('08', 'customer_order_cash_obligations', 'delivery_zone_name_snapshot'),
  ('08', 'customer_order_cash_obligations', 'delivered_at'),
  ('08', 'customer_order_cash_obligations', 'created_at'),
  ('08', 'driver_delivery_fee_entitlements', 'id'),
  ('08', 'driver_delivery_fee_entitlements', 'customer_order_id'),
  ('08', 'driver_delivery_fee_entitlements', 'delivery_task_id'),
  ('08', 'driver_delivery_fee_entitlements', 'driver_id'),
  ('08', 'driver_delivery_fee_entitlements', 'currency'),
  ('08', 'driver_delivery_fee_entitlements', 'delivery_zone_id'),
  ('08', 'driver_delivery_fee_entitlements', 'delivery_zone_name_snapshot'),
  ('08', 'driver_delivery_fee_entitlements', 'status'),
  ('08', 'driver_delivery_fee_entitlements', 'delivered_at'),
  ('08', 'driver_delivery_fee_entitlements', 'created_at'),
  ('08', 'merchant_order_entitlements', 'id'),
  ('08', 'merchant_order_entitlements', 'store_order_id'),
  ('08', 'merchant_order_entitlements', 'merchant_id'),
  ('08', 'merchant_order_entitlements', 'commission_id'),
  ('08', 'merchant_order_entitlements', 'currency'),
  ('08', 'merchant_order_entitlements', 'status'),
  ('08', 'merchant_order_entitlements', 'delivered_at'),
  ('08', 'merchant_order_entitlements', 'created_at'),
  ('08', 'merchant_order_entitlement_adjustments', 'id'),
  ('08', 'merchant_order_entitlement_adjustments', 'merchant_order_entitlement_id'),
  ('08', 'merchant_order_entitlement_adjustments', 'merchant_id'),
  ('08', 'merchant_order_entitlement_adjustments', 'currency'),
  ('08', 'merchant_order_entitlement_adjustments', 'effect'),
  ('08', 'merchant_order_entitlement_adjustments', 'source_type'),
  ('08', 'merchant_order_entitlement_adjustments', 'source_id'),
  ('08', 'merchant_order_entitlement_adjustments', 'created_at'),
  ('09', 'driver_cash_remittances', 'id'),
  ('09', 'driver_cash_remittances', 'driver_id'),
  ('09', 'driver_cash_remittances', 'currency'),
  ('09', 'driver_cash_remittances', 'idempotency_key'),
  ('09', 'driver_cash_remittances', 'external_reference'),
  ('09', 'driver_cash_remittances', 'note'),
  ('09', 'driver_cash_remittances', 'received_by'),
  ('09', 'driver_cash_remittances', 'received_at'),
  ('09', 'driver_cash_remittances', 'created_at'),
  ('09', 'driver_cash_credit_payouts', 'id'),
  ('09', 'driver_cash_credit_payouts', 'driver_id'),
  ('09', 'driver_cash_credit_payouts', 'currency'),
  ('09', 'driver_cash_credit_payouts', 'idempotency_key'),
  ('09', 'driver_cash_credit_payouts', 'external_reference'),
  ('09', 'driver_cash_credit_payouts', 'note'),
  ('09', 'driver_cash_credit_payouts', 'paid_by'),
  ('09', 'driver_cash_credit_payouts', 'paid_at'),
  ('09', 'driver_cash_credit_payouts', 'created_at'),
  ('10', 'merchant_settlement_batches', 'id'),
  ('10', 'merchant_settlement_batches', 'merchant_id'),
  ('10', 'merchant_settlement_batches', 'currency'),
  ('10', 'merchant_settlement_batches', 'status'),
  ('10', 'merchant_settlement_batches', 'period_starts_at'),
  ('10', 'merchant_settlement_batches', 'period_ends_at'),
  ('10', 'merchant_settlement_batches', 'idempotency_key'),
  ('10', 'merchant_settlement_batches', 'note'),
  ('10', 'merchant_settlement_batches', 'created_by'),
  ('10', 'merchant_settlement_batches', 'created_at'),
  ('10', 'merchant_settlement_batches', 'completed_at'),
  ('10', 'merchant_settlement_batches', 'completed_by'),
  ('10', 'merchant_settlement_batch_entitlements', 'id'),
  ('10', 'merchant_settlement_batch_entitlements', 'batch_id'),
  ('10', 'merchant_settlement_batch_entitlements', 'merchant_order_entitlement_id'),
  ('10', 'merchant_settlement_batch_entitlements', 'created_at'),
  ('10', 'merchant_settlement_payments', 'id'),
  ('10', 'merchant_settlement_payments', 'batch_id'),
  ('10', 'merchant_settlement_payments', 'merchant_id'),
  ('10', 'merchant_settlement_payments', 'currency'),
  ('10', 'merchant_settlement_payments', 'idempotency_key'),
  ('10', 'merchant_settlement_payments', 'external_reference'),
  ('10', 'merchant_settlement_payments', 'note'),
  ('10', 'merchant_settlement_payments', 'paid_by'),
  ('10', 'merchant_settlement_payments', 'paid_at'),
  ('10', 'merchant_settlement_payments', 'created_at'),
  ('10', 'merchant_settlement_payment_allocations', 'id'),
  ('10', 'merchant_settlement_payment_allocations', 'payment_id'),
  ('10', 'merchant_settlement_payment_allocations', 'batch_entitlement_id'),
  ('10', 'merchant_settlement_payment_allocations', 'created_at'),
  ('08', 'customer_order_cash_obligations', 'delivered_store_items_amount'),
  ('08', 'customer_order_cash_obligations', 'delivery_fee_amount'),
  ('08', 'customer_order_cash_obligations', 'collectible_amount'),
  ('08', 'driver_delivery_fee_entitlements', 'delivery_fee_amount'),
  ('08', 'merchant_order_entitlements', 'gross_items_amount'),
  ('08', 'merchant_order_entitlements', 'commission_amount_at_delivery'),
  ('08', 'merchant_order_entitlements', 'initial_net_entitlement_amount'),
  ('08', 'merchant_order_entitlement_adjustments', 'amount'),
  ('09', 'driver_cash_remittances', 'amount'),
  ('09', 'driver_cash_credit_payouts', 'amount'),
  ('10', 'merchant_settlement_batch_entitlements', 'amount_snapshot'),
  ('10', 'merchant_settlement_payments', 'amount'),
  ('10', 'merchant_settlement_payment_allocations', 'amount')
)
select e.*, case when a.attnum is null then 'MISSING' else 'PRESENT_REVIEW_TYPE' end as state,
 format_type(a.atttypid,a.atttypmod) as actual_type,a.attnotnull,
 pg_get_expr(d.adbin,d.adrelid) as default_expression
from expected e left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=e.relation_name
left join pg_attribute a on a.attrelid=c.oid and a.attname=e.column_name and a.attnum>0 and not a.attisdropped
left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
order by e.phase,e.relation_name,e.column_name;

-- Fingerprints compare function bodies ignoring whitespace, not grants/header/overloads.
-- A mismatch requires review; it is never repaired by this script.
with expected(phase,function_name,source_parameters,body_md5) as (values
  ('08', 'create_delivered_order_cash_foundations', 'target_customer_order uuid', 'f67cd22500338016d8d0ae3a69ffaf1f'),
  ('08', 'create_delivered_order_cash_foundations_after_store_delivery', '', 'd7b60872d9df4698e6059227d844b3a5'),
  ('08', 'create_delivered_order_cash_foundations_after_task_delivery', '', 'd7b60872d9df4698e6059227d844b3a5'),
  ('08', 'append_commission_reversal_entitlement_adjustment', '', '84f71840eef19e60c9ca24649b2051e2'),
  ('09', 'record_driver_cash_remittance', 'target_driver uuid, remittance_amount numeric, remittance_idempotency_key uuid, remittance_reference text default null, remittance_note text default null', '68e5bef3a7b25568eb19e2c21ff5809f'),
  ('09', 'pay_driver_cash_credit', 'target_driver uuid, payout_amount numeric, payout_idempotency_key uuid, payout_reference text default null, payout_note text default null', '0205a6c03871eb93f859e67af6a204dc'),
  ('10', 'create_merchant_settlement_batch', 'target_merchant uuid, entitlement_ids uuid[], batch_idempotency_key uuid, period_start_value timestamptz default null, period_end_value timestamptz default null, batch_note text default null', '52d6668da52464cdb2a2036e4a6984e3'),
  ('10', 'record_merchant_settlement_payment', 'target_batch uuid, payment_amount numeric, payment_allocations jsonb, payment_idempotency_key uuid, payment_reference text default null, payment_note text default null', '120103f36d9ab45bbe84e8d8602cecdf'),
  ('11', 'admin_financial_report', 'report_kind text, period_from timestamptz default null, period_until timestamptz default null, movement_type text default null, target_driver uuid default null, zone_snapshot text default null, page_number integer default 0', '0420331df3bb3f1a5ce22c0b6913fffa'),
  ('11', 'admin_sales_revenue_report', 'report_kind text, period_from timestamptz default null, period_until timestamptz default null, target_merchant uuid default null, detail_type text default null, settlement_state text default null, page_number integer default 0', 'f26eedb7a4af98985d2ddc2b8b188d44'),
  ('12', 'merchant_financial_account', 'section_name text default ''overview'', period_from timestamptz default null, period_until timestamptz default null, selected_status text default null, order_search text default null, record_id uuid default null, page_number integer default 0, payments_page integer default 0', 'ca1aeb694a4a32df7c4f8771999e73f1'),
  ('12', 'notify_merchant_settlement_payment', '', '848c0f74ebe254b910c1401373274de3'),
  ('13', 'protect_referenced_product_delete', '', '7d870918815a0dadcacb36958c3d14e5'),
  ('13', 'require_available_product_for_purchase', '', 'f838203a38c119b60db86268572245f2'),
  ('13', 'lock_available_cart_products_for_order', '', '32867c5d3c7ae351a632711e05616f49'),
  ('13', 'require_available_offer_products_for_cart', '', 'e46449ab71a227f29aa42a9b9643f2b4')
)
select e.*,case when p.oid is null then 'MISSING' when
 md5(btrim(regexp_replace(p.prosrc,'[[:space:]]+',' ','g'))) <> e.body_md5 then 'BODY_DIFFERS'
 else 'BODY_MATCH_REVIEW_HEADER_AND_GRANTS' end as state,
 p.oid::regprocedure as actual_signature,pg_get_function_result(p.oid) as result_type,
 p.prosecdef as security_definer,p.proconfig,p.proacl,
 (select jsonb_agg(jsonb_build_object('role',r.rolname,'execute',has_function_privilege(r.oid,p.oid,'EXECUTE')))
 from pg_roles r where r.rolname in ('anon','authenticated','service_role')) as effective_execute,
 pg_get_functiondef(p.oid) as actual_definition
from expected e left join pg_namespace n on n.nspname='public'
left join pg_proc p on p.pronamespace=n.oid and p.proname=e.function_name
order by e.phase,e.function_name,p.oid::regprocedure::text;

with expected(phase,relation_name,trigger_name,function_name) as (values
  ('08', 'store_orders', 'store_orders_cash_financial_foundations_after_status_change', 'create_delivered_order_cash_foundations_after_store_delivery'),
  ('08', 'delivery_tasks', 'delivery_tasks_cash_financial_foundations_after_status_change', 'create_delivered_order_cash_foundations_after_task_delivery'),
  ('08', 'store_order_commission_reversals', 'store_order_commission_reversal_append_merchant_entitlement_adjustment', 'append_commission_reversal_entitlement_adjustment'),
  ('12', 'merchant_settlement_payments', 'merchant_settlement_payment_notification', 'notify_merchant_settlement_payment'),
  ('13', 'products', 'products_protect_history_before_delete', 'protect_referenced_product_delete'),
  ('13', 'customer_cart_items', 'cart_items_require_available_product', 'require_available_product_for_purchase'),
  ('13', 'store_order_items', 'order_items_require_available_product', 'require_available_product_for_purchase'),
  ('13', 'customer_orders', 'customer_orders_lock_available_cart_products', 'lock_available_cart_products_for_order'),
  ('13', 'customer_cart_offer_selections', 'cart_offers_require_available_products', 'require_available_offer_products_for_cart')
)
select e.*,case when t.oid is null then 'MISSING' when t.tgenabled='D' then 'DISABLED'
 when f.proname <> e.function_name then 'WRONG_FUNCTION' else 'PRESENT_REVIEW_DEFINITION' end as state,
 t.tgenabled,t.tgdeferrable,t.tginitdeferred,pg_get_triggerdef(t.oid,true) as definition
from expected e left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=e.relation_name
left join pg_trigger t on t.tgrelid=c.oid and t.tgname=e.trigger_name and not t.tgisinternal
left join pg_proc f on f.oid=t.tgfoid order by e.phase,e.trigger_name;

with expected(phase,relation_name,policy_name) as (values
  ('08', 'customer_order_cash_obligations', 'customer_order_cash_obligations_read'),
  ('08', 'driver_delivery_fee_entitlements', 'driver_delivery_fee_entitlements_read'),
  ('08', 'merchant_order_entitlements', 'merchant_order_entitlements_read'),
  ('08', 'merchant_order_entitlement_adjustments', 'merchant_order_entitlement_adjustments_read'),
  ('09', 'driver_cash_remittances', 'driver_cash_remittances_read'),
  ('09', 'driver_cash_credit_payouts', 'driver_cash_credit_payouts_read'),
  ('10', 'merchant_settlement_batches', 'merchant_settlement_batches_read'),
  ('10', 'merchant_settlement_batch_entitlements', 'merchant_settlement_batch_entitlements_read'),
  ('10', 'merchant_settlement_payments', 'merchant_settlement_payments_read'),
  ('10', 'merchant_settlement_payment_allocations', 'merchant_settlement_payment_allocations_read'),
  ('14', 'customer_order_totals', 'customer_order_totals_read_participants')
)
select e.*,case when p.oid is null then 'MISSING' else 'PRESENT_REVIEW_EXPRESSION' end as state,
 p.polcmd,p.polroles,pg_get_expr(p.polqual,p.polrelid) as using_expression,
 pg_get_expr(p.polwithcheck,p.polrelid) as check_expression
from expected e left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=e.relation_name
left join pg_policy p on p.polrelid=c.oid and p.polname=e.policy_name
order by e.phase,e.relation_name,e.policy_name;

-- Base-column dependencies: inspect all columns, including snapshot and subscription additions.
with required(relation_name,column_list) as (values
 ('merchants','id,owner_user_id'),
 ('merchant_billing_settings','merchant_id,auto_renew'),
 ('merchant_subscriptions','id,merchant_id,plan_name_snapshot,starts_at,expires_at,commission_rate_snapshot,currency_snapshot,price_snapshot'),
 ('profiles','id,role,full_name'),
 ('products','id,store_id,is_available'),
 ('driver_applications','user_id,status'),
 ('customer_orders','id,customer_id,order_number,delivery_fee,delivery_currency,delivery_zone_id,delivery_zone_name_snapshot'),
 ('customer_order_totals','customer_order_id,currency'),
 ('store_orders','id,customer_order_id,store_id,status,delivered_at'),
 ('store_order_items','store_order_id,product_id'),
 ('store_order_totals','store_order_id,currency,items_subtotal'),
 ('delivery_tasks','id,customer_order_id,driver_id,status,delivered_at'),
 ('customer_carts','id,customer_id'),
 ('customer_cart_items','cart_id,product_id,quantity'),
 ('customer_cart_offer_selections','cart_id,offer_id'),
 ('store_offers','id,is_active,starts_at,ends_at'),
 ('store_offer_products','offer_id,product_id,store_id'),
 ('product_reviews','product_id,purchased_product_id'),
 ('store_order_commissions','id,store_order_id,merchant_id,currency,status,base_amount,commission_amount,commission_rate,due_at'),
 ('store_order_commission_reversals','id,commission_id,merchant_id,currency,amount,reason,created_at'),
 ('subscription_invoices','id,merchant_id,invoice_number,currency,total_amount,status,created_at'),
 ('subscription_payments','id,merchant_id,currency,amount,method,external_reference,received_at'),
 ('invoice_payment_allocations','id,invoice_id,payment_id,amount,created_at'),
 ('notifications','user_id,type,title,body,data')
), expected as (
 select relation_name,unnest(string_to_array(column_list,',')) as column_name from required
)
select e.*,case when a.attnum is null then 'MISSING' else 'PRESENT_REVIEW_TYPE' end as state,
 format_type(a.atttypid,a.atttypmod) as actual_type
from expected e left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=e.relation_name
left join pg_attribute a on a.attrelid=c.oid and a.attname=e.column_name and a.attnum>0 and not a.attisdropped
order by e.relation_name,e.column_name;

select c.relname,a.attname,format_type(a.atttypid,a.atttypmod) as actual_type,a.attnotnull
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
where n.nspname='public' and c.relname = any(array['profiles','merchants','stores','products','product_media','store_offers','store_offer_products','customer_carts','customer_cart_items','customer_cart_offer_selections','customer_orders','customer_order_totals','store_orders','store_order_items','store_order_totals','delivery_tasks','delivery_zones','driver_applications','product_reviews','store_order_commissions','store_order_commission_reversals','subscription_invoices','subscription_payments','invoice_payment_allocations','merchant_subscriptions','merchant_financial_positions','notifications'])
order by c.relname,a.attnum;
select t.typname,e.enumlabel,e.enumsortorder from pg_type t
join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid
where n.nspname='public' and t.typname='currency_code' order by e.enumsortorder;
-- Prerequisite RPC definitions (not called); inspect ownership/admin checks and available overloads.
select p.oid::regprocedure as signature,p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('is_admin','accrue_store_order_commission','create_order_from_cart')
order by p.oid::regprocedure::text;
rollback;
