-- READ ONLY metadata inspection for Supabase SQL Editor.
-- It returns definitions and privileges only; it does not access customer/order rows.

-- 1) Is store_order_totals a table, view, materialized view, or absent?
select n.nspname as schema_name, c.relname as object_name, c.relkind,
       case when c.relkind in ('v', 'm') then pg_get_viewdef(c.oid, true) end as definition
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'store_order_totals';

-- 2) Columns and constraints that determine a trusted store-order total.
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('store_orders', 'store_order_items', 'customer_orders')
order by table_name, ordinal_position;

select conrelid::regclass as table_name, conname, contype,
       pg_get_constraintdef(oid, true) as definition
from pg_catalog.pg_constraint
where connamespace = 'public'::regnamespace
  and conrelid::regclass::text in (
    'public.store_orders', 'public.store_order_items', 'public.customer_orders'
  )
order by table_name, conname;

-- 3) Actual triggers attached to order/delivery tables and their functions.
select c.relname as table_name, t.tgname as trigger_name,
       pg_get_triggerdef(t.oid, true) as definition,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as function_arguments,
       p.prosecdef as security_definer
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
join pg_catalog.pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public' and not t.tgisinternal
  and c.relname in ('customer_orders', 'store_orders', 'store_order_items', 'delivery_tasks')
order by c.relname, t.tgname;

-- 4) Table grants. An empty result for a role means no explicit grant is present.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('customer_orders', 'store_orders', 'store_order_items', 'delivery_tasks')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- 5) RLS policies, including the public accepted-store policy; review only,
-- do not change it as part of the financial migration.
select tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('stores', 'customer_orders', 'store_orders', 'store_order_items', 'delivery_tasks')
order by tablename, policyname;

-- 6) Functions whose name or definition refers to delivery/status transitions.
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%deliver%'
    or p.proname ilike '%order%'
    or pg_get_functiondef(p.oid) ilike '%delivered%'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);
