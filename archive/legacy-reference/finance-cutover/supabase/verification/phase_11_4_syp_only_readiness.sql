-- READ ONLY. Requires separate authorization before use on a linked project.
-- No Auth/Storage data, balances or writes. Review unexpected result rows.
begin read only;

-- Exactly one label, SYP; no currency_code_previous type.
select t.typname, e.enumlabel, e.enumsortorder
from pg_type t join pg_namespace n on n.oid=t.typnamespace
left join pg_enum e on e.enumtypid=t.oid
where n.nspname='public' and t.typname in ('currency_code','currency_code_previous')
order by t.typname,e.enumsortorder;

-- Financial columns: NOT NULL, SYP default and explicit SYP CHECK expected.
select c.table_name,c.column_name,c.is_nullable,c.column_default,
  (select string_agg(pg_get_constraintdef(k.oid), '; ')
   from pg_constraint k where k.conrelid=format('public.%I',c.table_name)::regclass
     and k.contype='c' and pg_get_constraintdef(k.oid) like '%'||c.column_name||'%SYP%') as syp_checks
from information_schema.columns c
join pg_tables t on t.schemaname=c.table_schema and t.tablename=c.table_name
where c.table_schema='public' and c.udt_name='currency_code'
order by c.table_name,c.column_name;

-- Both queries below must return zero rows.
select table_name,column_name from information_schema.columns
where table_schema='public' and column_name='currency'
and table_name in ('products','store_offers','subscription_plans','delivery_zones','wallets','merchant_credit_limits');
select p.oid::regprocedure as obsolete_rpc,p.proargnames
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proargnames && array[
 'input_currency','target_currency','payment_currency','credit_currency',
 'remittance_currency','payout_currency','report_currency','selected_currency'];

-- Full published signatures, security and effective explicit/default ACLs.
select p.oid::regprocedure as signature,p.prosecdef,p.proconfig,
  coalesce(p.proacl,acldefault('f',p.proowner)) as acl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'save_store_offer','create_order_from_cart','record_wallet_transaction',
 'record_subscription_payment','set_merchant_credit_limit','reverse_store_order_commission',
 'record_driver_cash_remittance','pay_driver_cash_credit','create_merchant_settlement_batch',
 'record_merchant_settlement_payment','admin_financial_report','admin_sales_revenue_report','merchant_financial_account')
order by p.proname,p.oid::regprocedure::text;

-- Verify single-entity keys, foreign keys and indexes against the final migration.
select c.relname,k.conname,k.contype,pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('wallets','wallet_transactions','merchant_credit_limits',
 'store_order_totals','customer_order_totals','customer_order_cash_obligations')
order by c.relname,k.conname;
select tablename,indexname,indexdef from pg_indexes where schemaname='public'
and tablename in ('wallets','merchant_credit_limits','store_order_totals','customer_order_totals','customer_order_cash_obligations')
order by tablename,indexname;

-- View definitions/options/owners/ACLs; inspect grouping and SYP constants.
select c.relname,pg_get_userbyid(c.relowner) as owner,c.reloptions,
  coalesce(c.relacl,acldefault('r',c.relowner)) as acl,pg_get_viewdef(c.oid,true) as definition
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v'
and c.relname not in ('store_rating_summaries','product_rating_summaries','store_public_reviews','product_public_reviews')
order by c.relname;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('customer_order_totals','store_order_totals',
 'merchant_order_entitlements','customer_order_cash_obligations','wallets','merchant_credit_limits')
order by tablename,policyname;
rollback;
