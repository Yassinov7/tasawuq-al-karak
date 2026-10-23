-- psql only; run manually on STAGING, once for each non-admin role.
-- Required: -v actor_user=<auth-user-uuid>
-- Optional targeted merchant checks: -v foreign_batch=<uuid> -v foreign_sale=<store-order-uuid>
-- Run the catalog script first. This script changes only transaction-local
-- role/JWT settings; READ ONLY prevents any accidental financial mutation.
begin read only;
select set_config('request.jwt.claim.sub', :'actor_user', true);
select set_config('request.jwt.claims', jsonb_build_object('sub', :'actor_user', 'role', 'authenticated')::text, true);
\if :{?foreign_batch}
select set_config('test.foreign_batch', :'foreign_batch', true);
\endif
\if :{?foreign_sale}
select set_config('test.foreign_sale', :'foreign_sale', true);
\endif
set local role authenticated;

do $$
begin
  if auth.uid() is null or public.is_admin() then raise exception 'use a real NON-admin fixture user'; end if;
  if not exists(select 1 from public.profiles p where p.id = auth.uid()) then raise exception 'fixture profile missing'; end if;

  if exists(select 1 from public.customer_order_cash_obligations where driver_id <> auth.uid())
    or exists(select 1 from public.driver_delivery_fee_entitlements where driver_id <> auth.uid())
    or exists(select 1 from public.driver_cash_remittances where driver_id <> auth.uid())
    or exists(select 1 from public.driver_cash_credit_payouts where driver_id <> auth.uid())
    or exists(select 1 from public.driver_cash_custody_positions where driver_id <> auth.uid()) then
    raise exception 'driver data crossed ownership boundary';
  end if;

  if exists(select 1 from public.merchant_order_entitlements e where not exists(
    select 1 from public.merchants m where m.id = e.merchant_id and m.owner_user_id = auth.uid()))
    or exists(select 1 from public.merchant_order_entitlement_adjustments e where not exists(
      select 1 from public.merchants m where m.id = e.merchant_id and m.owner_user_id = auth.uid()))
    or exists(select 1 from public.merchant_settlement_batches e where not exists(
      select 1 from public.merchants m where m.id = e.merchant_id and m.owner_user_id = auth.uid()))
    or exists(select 1 from public.merchant_settlement_payments e where not exists(
      select 1 from public.merchants m where m.id = e.merchant_id and m.owner_user_id = auth.uid()))
    or exists(select 1 from public.subscription_invoices e where not exists(
      select 1 from public.merchants m where m.id = e.merchant_id and m.owner_user_id = auth.uid()))
    or exists(select 1 from public.subscription_payments e where not exists(
      select 1 from public.merchants m where m.id = e.merchant_id and m.owner_user_id = auth.uid()))
    or exists(select 1 from public.store_order_commissions e where not exists(
      select 1 from public.merchants m where m.id = e.merchant_id and m.owner_user_id = auth.uid()))
    or exists(select 1 from public.store_order_commission_reversals e where not exists(
      select 1 from public.merchants m where m.id = e.merchant_id and m.owner_user_id = auth.uid()))
    or exists(select 1 from public.merchant_financial_positions e where not exists(
      select 1 from public.merchants m where m.id = e.merchant_id and m.owner_user_id = auth.uid())) then
    raise exception 'merchant financial data crossed ownership boundary';
  end if;

  if exists(select 1 from public.admin_cash_movement_events)
    or exists(select 1 from public.admin_delivery_fee_report_rows)
    or exists(select 1 from public.admin_merchant_payout_report_rows)
    or exists(select 1 from public.admin_merchant_settlement_report_batches)
    or exists(select 1 from public.admin_merchant_financial_report_events)
    or exists(select 1 from public.admin_platform_revenue_report_events) then
    raise exception 'admin reporting view exposed data';
  end if;

  -- 014 regression: participation as merchant in a parent order alone must
  -- not expose that parent's cross-store financial total.
  if exists(select 1 from public.customer_order_totals t where
    not exists(select 1 from public.customer_orders co where co.id = t.customer_order_id and co.customer_id = auth.uid())
    and not exists(select 1 from public.delivery_tasks dt where dt.customer_order_id = t.customer_order_id and dt.driver_id = auth.uid())) then
    raise exception 'parent-order totals exposed to a non-customer/non-assigned-driver';
  end if;
end;
$$;

-- These fixed statements use deliberately invalid keys. A missing role guard
-- must fail the assertion, not fall through to a valid payment. READ ONLY is
-- an additional backstop. No user input is interpolated into dynamic SQL.
do $$
declare probe text; rejected boolean;
begin
  foreach probe in array array[
    'select public.record_driver_cash_remittance(null, ''SYP'', 1, null)',
    'select public.pay_driver_cash_credit(null, ''SYP'', 1, null)',
    'select public.create_merchant_settlement_batch(null, ''SYP'', null, null)',
    'select public.record_merchant_settlement_payment(null, 1, ''[]''::jsonb, null)',
    'select public.allocate_subscription_payment(null, ''[]''::jsonb, null)',
    'select public.record_subscription_payment(null, ''SYP'', 1, ''cash'', null, ''[]''::jsonb)',
    'select public.set_merchant_credit_limit(null, ''SYP'', false, 0)',
    'select public.renew_merchant_subscription(null, null)',
    'select public.schedule_merchant_subscription_plan_change(null, null, null)',
    'select public.set_merchant_auto_renew(null, false)',
    'select public.reconcile_subscription_commission_rate(null, 0, null)',
    'select public.reverse_store_order_commission(null, 1, null, ''test'')',
    'select public.admin_financial_report(''cash'')',
    'select public.admin_sales_revenue_report(''merchant'')'
  ] loop
    rejected := false;
    begin
      execute probe;
    exception when others then
      if sqlerrm <> 'administrator access required' then raise exception 'unexpected denial for %: %', probe, sqlerrm; end if;
      rejected := true;
    end;
    if not rejected then raise exception 'non-admin RPC access: %', probe; end if;
  end loop;
end;
$$;

-- For meaningful targeted tests, the operator must verify these IDs exist
-- under another merchant BEFORE running as the actor. An arbitrary UUID is
-- only a not-found test, not evidence of cross-tenant isolation.
do $$
declare foreign_id uuid; rejected boolean; result_value jsonb;
begin
  if exists(select 1 from public.merchants m where m.owner_user_id = auth.uid()) then
    result_value := public.merchant_financial_account('overview');
    if result_value is null then raise exception 'own overview unavailable'; end if;
    foreign_id := nullif(current_setting('test.foreign_batch', true), '')::uuid;
    if foreign_id is not null then
      rejected := false;
      begin
        perform public.merchant_financial_account(section_name => 'settlement', record_id => foreign_id);
      exception when no_data_found then rejected := true;
      end;
      if not rejected then raise exception 'foreign settlement RPC access'; end if;
    end if;
    foreign_id := nullif(current_setting('test.foreign_sale', true), '')::uuid;
    if foreign_id is not null then
      rejected := false;
      begin
        perform public.merchant_financial_account(section_name => 'sale', record_id => foreign_id);
      exception when no_data_found then rejected := true;
      end;
      if not rejected then raise exception 'foreign sale RPC access'; end if;
    end if;
  end if;
end;
$$;
rollback;
