
-- PHASE 7.3: FINANCIAL FOUNDATION VERIFICATION
-- READ ONLY - Safe to run after applying the migration.
-- No INSERT, UPDATE, DELETE, or DDL.

-- 1. Verify all eight financial tables exist.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'merchant_billing_settings',
    'merchant_credit_limits',
    'subscription_invoices',
    'subscription_payments',
    'invoice_payment_allocations',
    'merchant_ledger_entries',
    'store_order_commissions',
    'merchant_financial_audit_events'
  )
order by table_name;

-- 2. Verify Row Level Security is enabled.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'merchant_billing_settings',
    'merchant_credit_limits',
    'subscription_invoices',
    'subscription_payments',
    'invoice_payment_allocations',
    'merchant_ledger_entries',
    'store_order_commissions',
    'merchant_financial_audit_events'
  )
order by c.relname;

-- 3. Verify subscription period constraints.
select
  conrelid::regclass as table_name,
  conname,
  contype,
  pg_get_constraintdef(oid, true) as definition
from pg_catalog.pg_constraint
where connamespace = 'public'::regnamespace
  and conname in (
    'merchant_subscriptions_no_overlapping_periods',
    'merchant_subscriptions_id_merchant_id_key'
  )
order by conname;

-- 4. Verify invoice and ledger indexes.
-- FIXED: ORDER BY 1 instead of alias casting.
select
  indexrelid::regclass as index_name,
  pg_get_indexdef(indexrelid) as definition
from pg_catalog.pg_index
where indrelid in (
  'public.subscription_invoices'::regclass,
  'public.merchant_ledger_entries'::regclass
)
order by 1;

-- 5. Verify RLS policies.
select
  tablename,
  policyname,
  roles,
  cmd
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in (
    'merchant_billing_settings',
    'merchant_credit_limits',
    'subscription_invoices',
    'subscription_payments',
    'invoice_payment_allocations',
    'merchant_ledger_entries',
    'store_order_commissions',
    'merchant_financial_audit_events'
  )
order by tablename, policyname;

-- 6. Verify direct table privileges.
-- anon and authenticated must have no direct write permissions.
with roles(role_name) as (
  values
    ('anon'::name),
    ('authenticated'::name),
    ('service_role'::name)
),
tables(table_name) as (
  values
    ('merchant_billing_settings'::text),
    ('merchant_credit_limits'::text),
    ('subscription_invoices'::text),
    ('subscription_payments'::text),
    ('invoice_payment_allocations'::text),
    ('merchant_ledger_entries'::text),
    ('store_order_commissions'::text),
    ('merchant_financial_audit_events'::text)
)
select
  r.role_name,
  t.table_name,
  has_table_privilege(
    r.role_name,
    'public.' || t.table_name,
    'INSERT'
  ) as can_insert,
  has_table_privilege(
    r.role_name,
    'public.' || t.table_name,
    'UPDATE'
  ) as can_update,
  has_table_privilege(
    r.role_name,
    'public.' || t.table_name,
    'DELETE'
  ) as can_delete,
  has_table_privilege(
    r.role_name,
    'public.' || t.table_name,
    'TRUNCATE'
  ) as can_truncate
from roles r
cross join tables t
order by t.table_name, r.role_name;

-- 7. Verify financial trigger helper functions.
select
  routine_name,
  routine_type,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'validate_invoice_payment_allocation',
    'reject_invoice_payment_allocation_mutation',
    'reject_subscription_invoice_identity_mutation',
    'reject_subscription_invoice_delete',
    'reject_subscription_payment_mutation',
    'validate_merchant_ledger_entry',
    'reject_merchant_ledger_mutation'
  )
order by routine_name;

-- 8. Verify EXECUTE permissions.
-- Both columns must be FALSE for all listed functions.
select
  p.proname as function_name,
  has_function_privilege(
    'anon',
    p.oid,
    'EXECUTE'
  ) as anon_can_execute,
  has_function_privilege(
    'authenticated',
    p.oid,
    'EXECUTE'
  ) as authenticated_can_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'validate_invoice_payment_allocation',
    'reject_invoice_payment_allocation_mutation',
    'reject_subscription_invoice_identity_mutation',
    'reject_subscription_invoice_delete',
    'reject_subscription_payment_mutation',
    'validate_merchant_ledger_entry',
    'reject_merchant_ledger_mutation'
  )
order by p.proname;

-- 9. Verify financial triggers exist.
select
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid, true) as definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c
  on c.oid = t.tgrelid
join pg_catalog.pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and c.relname in (
    'subscription_invoices',
    'subscription_payments',
    'invoice_payment_allocations',
    'merchant_ledger_entries'
  )
order by c.relname, t.tgname;
