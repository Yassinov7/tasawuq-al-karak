-- Run manually on STAGING after applying through 014. Never run by the agent.
-- Read-only catalog assertions; no fixtures, financial writes, or DDL.
begin read only;

do $$
declare relation_name text; relation_oid regclass; role_name text; operation_name text;
begin
  foreach relation_name in array array[
    'profiles','merchants','stores','merchant_subscriptions',
    'customer_carts','customer_cart_items','customer_cart_offer_selections',
    'customer_orders','store_orders','store_order_items','store_order_totals',
    'customer_order_totals','store_order_status_history','delivery_tasks',
    'customer_order_cash_obligations','driver_delivery_fee_entitlements',
    'driver_cash_remittances','driver_cash_credit_payouts',
    'merchant_order_entitlements','merchant_order_entitlement_adjustments',
    'merchant_settlement_batches','merchant_settlement_batch_entitlements',
    'merchant_settlement_payments','merchant_settlement_payment_allocations',
    'store_order_commissions','store_order_commission_reversals',
    'merchant_billing_settings','merchant_credit_limits','merchant_subscription_plan_changes',
    'subscription_invoices','subscription_payments','invoice_payment_allocations',
    'subscription_payment_allocation_batches','merchant_ledger_entries','merchant_financial_audit_events',
    'products','product_media','store_offers','store_offer_products','product_reviews','notifications'
  ] loop
    relation_oid := to_regclass('public.' || relation_name);
    if relation_oid is null then raise exception 'missing relation: % (check deployment history)', relation_name; end if;
    if not (select relrowsecurity from pg_class where oid = relation_oid) then raise exception 'RLS disabled: %', relation_name; end if;
    if exists(select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)) then
      raise exception 'application role bypasses RLS';
    end if;
    if exists(select 1 from pg_class c join pg_roles r on r.oid = c.relowner
      where c.oid = relation_oid and r.rolname in ('anon','authenticated')) then
      raise exception 'application role owns sensitive table: %', relation_name;
    end if;
  end loop;

  foreach relation_name in array array[
    'customer_orders','store_orders','store_order_items','store_order_totals','customer_order_totals',
    'store_order_status_history','delivery_tasks','merchant_subscriptions',
    'customer_order_cash_obligations','driver_delivery_fee_entitlements','driver_cash_remittances',
    'driver_cash_credit_payouts','merchant_order_entitlements','merchant_order_entitlement_adjustments',
    'merchant_settlement_batches','merchant_settlement_batch_entitlements','merchant_settlement_payments',
    'merchant_settlement_payment_allocations','store_order_commissions','store_order_commission_reversals',
    'subscription_invoices','subscription_payments','invoice_payment_allocations',
    'subscription_payment_allocation_batches','merchant_billing_settings','merchant_credit_limits',
    'merchant_subscription_plan_changes','merchant_ledger_entries','merchant_financial_audit_events'
  ] loop
    relation_oid := to_regclass('public.' || relation_name);
    foreach role_name in array array['anon','authenticated'] loop
      foreach operation_name in array array['INSERT','UPDATE'] loop
        if has_table_privilege(role_name, relation_oid, operation_name)
          or has_any_column_privilege(role_name, relation_oid, operation_name) then
          raise exception 'direct % grant for % on %', operation_name, role_name, relation_name;
        end if;
      end loop;
      if has_table_privilege(role_name, relation_oid, 'DELETE,TRUNCATE,TRIGGER') then
        raise exception 'direct destructive/trigger grant for % on %', role_name, relation_name;
      end if;
      if role_name = 'anon' and (has_table_privilege(role_name, relation_oid, 'SELECT')
        or has_any_column_privilege(role_name, relation_oid, 'SELECT')) then
        raise exception 'anonymous financial/order read grant on %', relation_name;
      end if;
    end loop;
  end loop;
  if has_table_privilege('authenticated', 'public.products', 'DELETE')
    or has_table_privilege('anon', 'public.products', 'DELETE') then raise exception 'product delete is exposed'; end if;
end;
$$;

do $$
declare view_name text; view_oid regclass;
begin
  foreach view_name in array array[
    'merchant_financial_positions','merchant_order_entitlement_positions','driver_cash_custody_positions',
    'merchant_settlement_batch_positions','admin_cash_movement_events','admin_delivery_fee_report_rows',
    'admin_merchant_payout_report_rows','admin_merchant_settlement_report_batches',
    'admin_merchant_financial_report_events','admin_platform_revenue_report_events',
    'merchant_account_sale_rows','merchant_account_settlement_rows'
  ] loop
    view_oid := to_regclass('public.' || view_name);
    if view_oid is null then raise exception 'missing view: %', view_name; end if;
    if not coalesce((select reloptions @> array['security_invoker=true','security_barrier=true']
      from pg_class where oid = view_oid), false) then raise exception 'unsafe view options: %', view_name; end if;
    if has_table_privilege('anon', view_oid, 'SELECT') then raise exception 'anonymous financial view access: %', view_name; end if;
    if view_name in ('merchant_account_sale_rows','merchant_account_settlement_rows')
      and has_table_privilege('authenticated', view_oid, 'SELECT') then raise exception 'private view exposed: %', view_name; end if;
  end loop;
end;
$$;

do $$
declare function_name text; function_row record; found_count integer;
begin
  foreach function_name in array array[
    'create_delivered_order_cash_foundations','create_delivered_order_cash_foundations_after_store_delivery',
    'create_delivered_order_cash_foundations_after_task_delivery','append_commission_reversal_entitlement_adjustment',
    'notify_merchant_settlement_payment','protect_referenced_product_delete','require_available_product_for_purchase',
    'lock_available_cart_products_for_order','require_available_offer_products_for_cart',
    'subscription_renewal_internal','process_due_merchant_subscription_renewals',
    'record_driver_cash_remittance','pay_driver_cash_credit','create_merchant_settlement_batch',
    'record_merchant_settlement_payment','allocate_subscription_payment','record_subscription_payment',
    'set_merchant_credit_limit','renew_merchant_subscription','schedule_merchant_subscription_plan_change',
    'set_merchant_auto_renew','reconcile_subscription_commission_rate','reverse_store_order_commission',
    'admin_financial_report','admin_sales_revenue_report','merchant_financial_account'
  ] loop
    found_count := 0;
    for function_row in select p.* from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = function_name
    loop
      found_count := found_count + 1;
      if not function_row.prosecdef or not exists(select 1 from unnest(function_row.proconfig) setting
        where setting in ('search_path=', 'search_path=""')) then raise exception 'unsafe function settings: %', function_name; end if;
      if has_function_privilege('anon', function_row.oid, 'EXECUTE') then raise exception 'anonymous function access: %', function_name; end if;
      if exists(select 1 from aclexplode(coalesce(function_row.proacl, acldefault('f', function_row.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE') then raise exception 'PUBLIC function access: %', function_name; end if;
      if function_row.prorettype = 'trigger'::regtype or function_name in
        ('create_delivered_order_cash_foundations','subscription_renewal_internal','process_due_merchant_subscription_renewals') then
        if has_function_privilege('authenticated', function_row.oid, 'EXECUTE') then raise exception 'internal helper exposed: %', function_name; end if;
      elsif not has_function_privilege('authenticated', function_row.oid, 'EXECUTE') then
        raise exception 'intended RPC grant missing: %', function_name;
      end if;
    end loop;
    if found_count <> 1 then raise exception 'missing/unreviewed overloads: % (% definitions)', function_name, found_count; end if;
  end loop;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['driver_cash_remittances','driver_cash_credit_payouts',
    'merchant_settlement_batches','merchant_settlement_payments','store_order_commission_reversals',
    'subscription_payments','subscription_payment_allocation_batches','subscription_invoices'] loop
    if not exists(select 1 from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid
      and a.attname = 'idempotency_key' where c.conrelid = to_regclass('public.' || table_name)
      and c.contype = 'u' and c.conkey = array[a.attnum]) then raise exception 'missing unique idempotency key: %', table_name; end if;
  end loop;
  if (select count(*) from pg_trigger where tgrelid = 'public.merchant_settlement_payments'::regclass
    and tgname = 'merchant_settlement_payment_notification' and not tgisinternal
    and tgenabled = 'O' and tgdeferrable and tginitdeferred) <> 1 then
    raise exception 'payment notification trigger missing/disabled/not deferred';
  end if;
  if exists(select 1 from public.driver_cash_custody_positions p where
    p.custody_remaining_amount <> greatest(p.net_custody_due_amount - p.office_received_amount + p.driver_credit_paid_amount, 0)
    or p.driver_credit_amount <> greatest(p.office_received_amount - p.driver_credit_paid_amount - p.net_custody_due_amount, 0)) then
    raise exception 'driver custody does not reconcile net office receipts';
  end if;
end;
$$;

-- Review every actual policy, including extra permissive policies not present
-- in the repository. A passing ACL test alone is NOT a row-isolation proof.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, policyname;
rollback;
