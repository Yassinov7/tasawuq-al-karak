-- Read-only admin reporting projections for the Phase 9 cash foundations.
-- These views expose confirmed movements separately from delivery obligations.
begin;

create view public.admin_cash_movement_events
with (security_barrier = true, security_invoker = true) as
  select r.id, r.received_at as occurred_at, r.currency, r.amount,
    'driver_remittance'::text as event_type, 'inflow'::text as direction,
    r.driver_id as party_id, r.external_reference as reference, r.note
  from public.driver_cash_remittances r where public.is_admin()
  union all
  select p.id, p.paid_at, p.currency, p.amount,
    'driver_credit_payout'::text, 'outflow'::text,
    p.driver_id, p.external_reference, p.note
  from public.driver_cash_credit_payouts p where public.is_admin()
  union all
  select p.id, p.paid_at, p.currency, p.amount,
    'merchant_settlement_payment'::text, 'outflow'::text,
    p.merchant_id, p.external_reference, p.note
  from public.merchant_settlement_payments p where public.is_admin()
  union all
  select p.id, p.received_at, p.currency, p.amount,
    'subscription_payment'::text, 'inflow'::text,
    p.merchant_id, p.external_reference, ''::text
  from public.subscription_payments p where public.is_admin() and p.method = 'cash';

create view public.admin_delivery_fee_report_rows
with (security_barrier = true, security_invoker = true) as
  select e.customer_order_id, e.delivery_task_id, e.driver_id, e.currency,
    e.delivery_fee_amount, e.delivery_zone_id, e.delivery_zone_name_snapshot,
    e.delivered_at
  from public.driver_delivery_fee_entitlements e where public.is_admin();

create view public.admin_merchant_payout_report_rows
with (security_barrier = true, security_invoker = true) as
  select p.batch_id, p.merchant_id, p.currency, p.status, p.created_at,
    p.batch_entitlement_id, p.merchant_order_entitlement_id, p.store_order_id,
    p.delivered_at, p.current_entitlement_amount, p.paid_amount,
    p.remaining_amount
  from public.merchant_settlement_batch_positions p where public.is_admin();

revoke all on public.admin_cash_movement_events, public.admin_delivery_fee_report_rows,
  public.admin_merchant_payout_report_rows from public, anon, authenticated;
grant select on public.admin_cash_movement_events, public.admin_delivery_fee_report_rows,
  public.admin_merchant_payout_report_rows to authenticated;

-- One read-only snapshot supplies all matching totals and one detail page.
-- Definer access is deliberately restricted by an explicit, fail-closed admin
-- check. No dynamic SQL, caller-controlled relation names, or persisted totals.
create function public.admin_financial_report(
  report_kind text,
  report_currency public.currency_code default null,
  period_from timestamptz default null,
  period_until timestamptz default null,
  movement_type text default null,
  target_driver uuid default null,
  zone_snapshot text default null,
  page_number integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result_value jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if report_kind is null or report_kind not in ('cash', 'delivery', 'custody') then
    raise exception 'unsupported report';
  end if;
  if page_number is null or page_number < 0 or page_number > 1000000 then
    raise exception 'invalid page';
  end if;
  if period_from is not null and period_until is not null and period_from >= period_until then
    raise exception 'invalid period';
  end if;
  if movement_type is not null and movement_type not in
    ('driver_remittance', 'driver_credit_payout', 'merchant_settlement_payment', 'subscription_payment') then
    raise exception 'invalid movement type';
  end if;

  if report_kind = 'cash' then
    with filtered as materialized (
      select e.*, coalesce(p.full_name, mp.full_name, 'طرف غير محدد') as party_name,
        sp.batch_id
      from public.admin_cash_movement_events e
      left join public.profiles p on p.id = e.party_id
        and e.event_type in ('driver_remittance', 'driver_credit_payout')
      left join public.merchants m on m.id = e.party_id
        and e.event_type in ('merchant_settlement_payment', 'subscription_payment')
      left join public.profiles mp on mp.id = m.owner_user_id
      left join public.merchant_settlement_payments sp on sp.id = e.id
        and e.event_type = 'merchant_settlement_payment'
      where (report_currency is null or e.currency = report_currency)
        and (period_from is null or e.occurred_at >= period_from)
        and (period_until is null or e.occurred_at < period_until)
        and (movement_type is null or e.event_type = movement_type)
    ), totals as (
      select currency, count(*) as movement_count,
        coalesce(sum(amount) filter (where direction = 'inflow'), 0) as inflow,
        coalesce(sum(amount) filter (where direction = 'outflow'), 0) as outflow
      from filtered group by currency
    ), details as (
      select * from filtered order by occurred_at desc, event_type, id
      limit 20 offset (page_number::bigint * 20)
    )
    select jsonb_build_object(
      'summary', coalesce((select jsonb_agg(to_jsonb(t) order by currency) from totals t), '[]'::jsonb),
      'rows', coalesce((select jsonb_agg(to_jsonb(d) order by occurred_at desc, event_type, id) from details d), '[]'::jsonb),
      'count', (select count(*) from filtered), 'groups', '[]'::jsonb, 'options', '[]'::jsonb
    ) into result_value;
  elsif report_kind = 'delivery' then
    with source as materialized (
      select e.*, coalesce(p.full_name, 'سائق غير محدد') as party_name,
        coalesce(nullif(trim(e.delivery_zone_name_snapshot), ''), 'منطقة غير محددة') as zone_name,
        coalesce(e.delivery_zone_id::text, 'unknown') || '|' ||
          coalesce(nullif(trim(e.delivery_zone_name_snapshot), ''), 'منطقة غير محددة') as zone_key
      from public.admin_delivery_fee_report_rows e
      left join public.profiles p on p.id = e.driver_id
    ), filtered as materialized (
      select * from source e
      where (report_currency is null or e.currency = report_currency)
        and (period_from is null or e.delivered_at >= period_from)
        and (period_until is null or e.delivered_at < period_until)
        and (target_driver is null or e.driver_id = target_driver)
        and (zone_snapshot is null or e.zone_key = zone_snapshot)
    ), totals as (
      select currency, sum(delivery_fee_amount) as delivery_fee_amount,
        count(*) as delivered_count, avg(delivery_fee_amount) as average_fee,
        count(distinct driver_id) as driver_count from filtered group by currency
    ), grouped as (
      select currency, 'zone'::text as group_type, zone_name as label, zone_key as group_key,
        sum(delivery_fee_amount) as delivery_fee_amount, count(*) as delivered_count
      from filtered group by currency, zone_name, zone_key
      union all
      select currency, 'driver', party_name, driver_id::text,
        sum(delivery_fee_amount), count(*) from filtered group by currency, driver_id, party_name
    ), details as (
      select * from filtered order by delivered_at desc, customer_order_id
      limit 20 offset (page_number::bigint * 20)
    ), choices as (
      select distinct 'driver'::text as kind, driver_id::text as value, party_name as label from source
      union
      select distinct 'zone', zone_key, zone_name from source
    )
    select jsonb_build_object(
      'summary', coalesce((select jsonb_agg(to_jsonb(t) order by currency) from totals t), '[]'::jsonb),
      'rows', coalesce((select jsonb_agg(to_jsonb(d) order by delivered_at desc, customer_order_id) from details d), '[]'::jsonb),
      'count', (select count(*) from filtered),
      'groups', coalesce((select jsonb_agg(to_jsonb(g) order by currency, group_type, label) from grouped g), '[]'::jsonb),
      'options', coalesce((select jsonb_agg(to_jsonb(c) order by kind, label, value) from choices c), '[]'::jsonb)
    ) into result_value;
  else
    -- Current positions never receive a date filter. Period flows are grouped
    -- independently before joining on currency; they cannot multiply balances.
    with positions as materialized (
      select c.*, coalesce(p.full_name, 'سائق غير محدد') as party_name
      from public.driver_cash_custody_positions c
      left join public.profiles p on p.id = c.driver_id
      where (report_currency is null or c.currency = report_currency)
        and (target_driver is null or c.driver_id = target_driver)
    ), movements as (
      select driver_id, currency, delivered_at as occurred_at, collectible_amount as obligations,
        0::numeric as receipts, 0::numeric as payouts
      from public.customer_order_cash_obligations
      union all
      select driver_id, currency, received_at, 0, amount, 0 from public.driver_cash_remittances
      union all
      select driver_id, currency, paid_at, 0, 0, amount from public.driver_cash_credit_payouts
    ), flows as (
      select currency, sum(obligations) as period_obligations,
        sum(receipts) as period_receipts, sum(payouts) as period_payouts
      from movements e
      where (report_currency is null or e.currency = report_currency)
        and (target_driver is null or e.driver_id = target_driver)
        and (period_from is null or e.occurred_at >= period_from)
        and (period_until is null or e.occurred_at < period_until)
      group by currency
    ), totals as (
      select currency, sum(cash_collected_amount) as cash_collected_amount,
        sum(delivery_fee_entitled_amount) as delivery_fee_entitled_amount,
        sum(net_custody_due_amount) as net_custody_due_amount,
        sum(office_received_amount) as office_received_amount,
        sum(custody_remaining_amount) as custody_remaining_amount,
        sum(driver_credit_amount) as driver_credit_amount,
        sum(driver_credit_paid_amount) as driver_credit_paid_amount
      from positions group by currency
    ), details as (
      select * from positions order by driver_id, currency
      limit 20 offset (page_number::bigint * 20)
    ), choices as (
      select distinct c.driver_id::text as value, coalesce(p.full_name, 'سائق غير محدد') as label,
        'driver'::text as kind
      from public.driver_cash_custody_positions c left join public.profiles p on p.id = c.driver_id
    )
    select jsonb_build_object(
      'summary', coalesce((select jsonb_agg(to_jsonb(t) order by currency) from totals t), '[]'::jsonb),
      'rows', coalesce((select jsonb_agg(to_jsonb(d) order by driver_id, currency) from details d), '[]'::jsonb),
      'count', (select count(*) from positions),
      'groups', coalesce((select jsonb_agg(to_jsonb(f) order by currency) from flows f), '[]'::jsonb),
      'options', coalesce((select jsonb_agg(to_jsonb(c) order by label, value) from choices c), '[]'::jsonb)
    ) into result_value;
  end if;
  return result_value;
end;
$$;
revoke all on function public.admin_financial_report(text, public.currency_code, timestamptz, timestamptz, text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.admin_financial_report(text, public.currency_code, timestamptz, timestamptz, text, uuid, text, integer) to authenticated;

-- A settlement is one batch here, never one row per entitlement/allocation.
create view public.admin_merchant_settlement_report_batches
with (security_barrier = true, security_invoker = true) as
select b.id, b.merchant_id, b.currency, b.status, b.created_at,
  coalesce((select sum(e.amount_snapshot) from public.merchant_settlement_batch_entitlements e
    where e.batch_id = b.id), 0) as entitlement_amount,
  coalesce((select sum(p.amount) from public.merchant_settlement_payments p
    where p.batch_id = b.id), 0) as paid_amount
from public.merchant_settlement_batches b where public.is_admin();

-- Independent event streams avoid invoice/payment/allocation fan-out.
create view public.admin_merchant_financial_report_events
with (security_barrier = true, security_invoker = true) as
select e.id, e.merchant_id, e.currency, e.delivered_at as occurred_at,
  'entitlement'::text as event_type, e.initial_net_entitlement_amount as amount,
  e.store_order_id, null::uuid as batch_id, null::text as status, null::text as reference,
  null::numeric as paid_amount, null::numeric as remaining_amount
from public.merchant_order_entitlements e where public.is_admin()
union all
select a.id, a.merchant_id, a.currency, a.created_at, 'entitlement_adjustment', a.amount,
  e.store_order_id, null::uuid, null::text, a.source_id::text, null::numeric, null::numeric
from public.merchant_order_entitlement_adjustments a
join public.merchant_order_entitlements e on e.id = a.merchant_order_entitlement_id
where public.is_admin()
union all
select p.id, p.merchant_id, p.currency, p.paid_at, 'merchant_payment', p.amount,
  null::uuid, p.batch_id, null::text, p.external_reference, null::numeric, null::numeric
from public.merchant_settlement_payments p where public.is_admin()
union all
select b.id, b.merchant_id, b.currency, b.created_at, 'settlement', b.entitlement_amount,
  null::uuid, b.id,
  case when b.status = 'completed' then 'completed'
    when b.paid_amount > 0 and b.paid_amount < b.entitlement_amount then 'partially_paid'
    else 'open' end, null::text, b.paid_amount, b.entitlement_amount - b.paid_amount
from public.admin_merchant_settlement_report_batches b where public.is_admin();

create view public.admin_platform_revenue_report_events
with (security_barrier = true, security_invoker = true) as
select c.id, c.merchant_id, c.currency, c.due_at as occurred_at,
  'commission'::text as event_type, c.commission_amount as amount,
  c.store_order_id, c.id as commission_id, null::uuid as invoice_id, null::uuid as payment_id,
  null::text as reference
from public.store_order_commissions c where public.is_admin() and c.status = 'due'
union all
select r.id, r.merchant_id, r.currency, r.created_at, 'commission_reversal', r.amount,
  c.store_order_id, c.id, null::uuid, null::uuid, r.reason
from public.store_order_commission_reversals r
join public.store_order_commissions c on c.id = r.commission_id where public.is_admin()
union all
select i.id, i.merchant_id, i.currency, i.created_at, 'invoice', i.total_amount,
  null::uuid, null::uuid, i.id, null::uuid, i.invoice_number
from public.subscription_invoices i where public.is_admin() and i.status <> 'void'
union all
select p.id, p.merchant_id, p.currency, p.received_at, 'subscription_payment', p.amount,
  null::uuid, null::uuid, null::uuid, p.id, p.external_reference
from public.subscription_payments p where public.is_admin()
union all
select a.id, p.merchant_id, p.currency, a.created_at, 'invoice_allocation', a.amount,
  null::uuid, null::uuid, a.invoice_id, a.payment_id, null::text
from public.invoice_payment_allocations a
join public.subscription_payments p on p.id = a.payment_id where public.is_admin();

revoke all on public.admin_merchant_settlement_report_batches,
  public.admin_merchant_financial_report_events, public.admin_platform_revenue_report_events from public, anon, authenticated;
grant select on public.admin_merchant_settlement_report_batches,
  public.admin_merchant_financial_report_events, public.admin_platform_revenue_report_events to authenticated;

create function public.admin_sales_revenue_report(
  report_kind text,
  report_currency public.currency_code default null,
  period_from timestamptz default null,
  period_until timestamptz default null,
  target_merchant uuid default null,
  detail_type text default null,
  settlement_state text default null,
  page_number integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result_value jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if report_kind is null or report_kind not in ('merchant', 'platform') then raise exception 'unsupported report'; end if;
  if page_number is null or page_number < 0 or page_number > 1000000 then raise exception 'invalid page'; end if;
  if period_from is not null and period_until is not null and period_from >= period_until then raise exception 'invalid period'; end if;
  if settlement_state is not null and settlement_state not in ('open', 'completed', 'partially_paid') then raise exception 'invalid settlement state'; end if;
  if detail_type is not null and (
    (report_kind = 'merchant' and detail_type not in ('entitlement', 'entitlement_adjustment', 'merchant_payment', 'settlement')) or
    (report_kind = 'platform' and detail_type not in ('commission', 'commission_reversal', 'invoice', 'subscription_payment', 'invoice_allocation'))
  ) then raise exception 'invalid detail type'; end if;

  with source as materialized (
    select e.id, e.merchant_id, e.currency, e.occurred_at, e.event_type, e.amount,
      to_jsonb(e) as payload
    from public.admin_merchant_financial_report_events e where report_kind = 'merchant'
    union all
    select e.id, e.merchant_id, e.currency, e.occurred_at, e.event_type, e.amount, to_jsonb(e)
    from public.admin_platform_revenue_report_events e where report_kind = 'platform'
  ), scope as materialized (
    select s.*, coalesce(p.full_name, 'تاجر غير محدد') as party_name,
      so.customer_order_id
    from source s
    left join public.merchants m on m.id = s.merchant_id
    left join public.profiles p on p.id = m.owner_user_id
    left join public.store_orders so on so.id = (s.payload->>'store_order_id')::uuid
    where (report_currency is null or s.currency = report_currency)
      and (target_merchant is null or s.merchant_id = target_merchant)
  ), period_events as materialized (
    select * from scope s where (period_from is null or s.occurred_at >= period_from)
      and (period_until is null or s.occurred_at < period_until)
  ), period_totals as (
    select currency,
      coalesce(sum(amount) filter (where event_type = 'entitlement'), 0) as period_sales_entitlements,
      coalesce(sum(amount) filter (where event_type = 'entitlement_adjustment'), 0) as period_entitlement_adjustments,
      coalesce(sum(amount) filter (where event_type = 'merchant_payment'), 0) as period_merchant_payments,
      coalesce(sum(amount) filter (where event_type = 'commission'), 0) as commissions,
      coalesce(sum(amount) filter (where event_type = 'commission_reversal'), 0) as commission_reversals,
      coalesce(sum(case when event_type = 'commission' then amount when event_type = 'commission_reversal' then -amount else 0 end), 0) as net_commissions,
      coalesce(sum(amount) filter (where event_type = 'invoice'), 0) as invoices_issued,
      count(*) filter (where event_type = 'invoice') as invoice_count,
      coalesce(sum(amount) filter (where event_type = 'subscription_payment'), 0) as payments_registered,
      coalesce(sum(amount) filter (where event_type = 'invoice_allocation'), 0) as period_allocations
    from period_events group by currency
  ), invoice_positions as (
    -- Remaining is the current balance of invoices issued in the selected
    -- period, including allocations made later; it is not a historical balance.
    select s.currency, sum(s.amount - coalesce((select sum(a.amount)
      from public.invoice_payment_allocations a where a.invoice_id = s.id), 0)) as invoice_remaining
    from period_events s where event_type = 'invoice' group by s.currency
  ), payment_positions as (
    select s.currency, sum(coalesce((select sum(a.amount)
      from public.invoice_payment_allocations a where a.payment_id = s.id), 0)) as payments_allocated
    from period_events s where event_type = 'subscription_payment' group by s.currency
  ), current_merchant as (
    select currency,
      coalesce(sum(amount) filter (where event_type = 'entitlement'), 0) as sales_entitlements,
      coalesce(sum(amount) filter (where event_type = 'entitlement_adjustment'), 0) as entitlement_adjustments,
      coalesce(sum(amount) filter (where event_type = 'merchant_payment'), 0) as merchant_payments,
      coalesce(sum(case when event_type in ('entitlement', 'entitlement_adjustment') then amount
        when event_type = 'merchant_payment' then -amount else 0 end), 0) as merchant_remaining
    from scope group by currency
  ), unbatched as (
    -- Match Migration 010 availability: subtract actual allocations and open
    -- reservations independently. Later adjustments can become available again.
    select e.currency, sum(greatest(e.current_entitlement_amount
      - coalesce((select sum(a.amount) from public.merchant_settlement_payment_allocations a
        join public.merchant_settlement_batch_entitlements be on be.id = a.batch_entitlement_id
        where be.merchant_order_entitlement_id = e.merchant_order_entitlement_id), 0)
      - coalesce((select sum(be.amount_snapshot) from public.merchant_settlement_batch_entitlements be
        join public.merchant_settlement_batches b on b.id = be.batch_id
        where be.merchant_order_entitlement_id = e.merchant_order_entitlement_id and b.status = 'open'), 0), 0)) as unbatched_entitlements
    from public.merchant_order_entitlement_positions e
    where report_kind = 'merchant' and (report_currency is null or e.currency = report_currency)
      and (target_merchant is null or e.merchant_id = target_merchant) group by e.currency
  ), batches as (
    select currency, count(*) filter (where payload->>'status' in ('open', 'partially_paid')) as open_settlements,
      count(*) filter (where payload->>'status' = 'completed') as completed_settlements,
      count(*) filter (where payload->>'status' = 'partially_paid') as partial_settlements
    from period_events where event_type = 'settlement' group by currency
  ), filtered_details as materialized (
    select * from period_events s where (detail_type is null or s.event_type = detail_type)
      and (report_kind <> 'merchant' or settlement_state is null or
        (s.event_type = 'settlement' and s.payload->>'status' = settlement_state))
  ), details as (
    select * from filtered_details order by occurred_at desc, event_type, id
    limit 20 offset (page_number::bigint * 20)
  ), summaries as (
    select t.currency, case when report_kind = 'merchant' then
      jsonb_build_object('currency', t.currency,
        'period_sales_entitlements', t.period_sales_entitlements,
        'period_entitlement_adjustments', t.period_entitlement_adjustments,
        'period_merchant_payments', t.period_merchant_payments,
        'open_settlements', coalesce(b.open_settlements, 0),
        'completed_settlements', coalesce(b.completed_settlements, 0),
        'partial_settlements', coalesce(b.partial_settlements, 0))
      else jsonb_build_object('currency', t.currency, 'commissions', t.commissions,
        'commission_reversals', t.commission_reversals, 'net_commissions', t.net_commissions,
        'invoices_issued', t.invoices_issued, 'invoice_count', t.invoice_count,
        'payments_registered', t.payments_registered,
        'payments_allocated', coalesce(pp.payments_allocated, 0),
        'payments_unallocated', t.payments_registered - coalesce(pp.payments_allocated, 0),
        'invoice_remaining', coalesce(ip.invoice_remaining, 0), 'period_allocations', t.period_allocations) end as payload
    from period_totals t left join batches b using (currency)
    left join invoice_positions ip using (currency) left join payment_positions pp using (currency)
  ), current_totals as (
    select c.*, coalesce(u.unbatched_entitlements, 0) as unbatched_entitlements
    from current_merchant c left join unbatched u using (currency) where report_kind = 'merchant'
  ), choices as (
    select distinct s.merchant_id::text as value, coalesce(p.full_name, 'تاجر غير محدد') as label,
      'merchant'::text as kind
    from source s join public.merchants m on m.id = s.merchant_id
    left join public.profiles p on p.id = m.owner_user_id
  )
  select jsonb_build_object(
    'summary', coalesce((select jsonb_agg(payload order by currency) from summaries), '[]'::jsonb),
    'groups', coalesce((select jsonb_agg(to_jsonb(c) order by currency) from current_totals c), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(payload || jsonb_build_object('party_name', party_name,
      'customer_order_id', customer_order_id) order by occurred_at desc, event_type, id) from details), '[]'::jsonb),
    'count', (select count(*) from filtered_details),
    'options', coalesce((select jsonb_agg(to_jsonb(c) order by label, value) from choices c), '[]'::jsonb)
  ) into result_value;
  return result_value;
end;
$$;
revoke all on function public.admin_sales_revenue_report(text, public.currency_code, timestamptz, timestamptz, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.admin_sales_revenue_report(text, public.currency_code, timestamptz, timestamptz, uuid, text, text, integer) to authenticated;

commit;
