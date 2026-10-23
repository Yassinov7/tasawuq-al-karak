-- Phase 9.5: owner-scoped read models. No financial writes or ledger changes.
-- Requires 008/010; no dependency on the admin-only reporting views in 011.
begin;

create view public.merchant_account_sale_rows
with (security_barrier = true, security_invoker = true) as
with amounts as (
  select e.*, co.order_number, c.base_amount, c.commission_rate,
    coalesce((select sum(a.amount)
      from public.merchant_settlement_payment_allocations a
      join public.merchant_settlement_batch_entitlements be on be.id = a.batch_entitlement_id
      where be.merchant_order_entitlement_id = e.merchant_order_entitlement_id), 0) as paid_amount,
    coalesce((select sum(be.amount_snapshot)
      from public.merchant_settlement_batch_entitlements be
      join public.merchant_settlement_batches b on b.id = be.batch_id
      where be.merchant_order_entitlement_id = e.merchant_order_entitlement_id and b.status = 'open'), 0) as reserved_amount
  from public.merchant_order_entitlement_positions e
  join public.store_order_commissions c on c.id = e.commission_id
  join public.store_orders so on so.id = e.store_order_id
  join public.customer_orders co on co.id = so.customer_order_id
)
select a.*, a.current_entitlement_amount - a.paid_amount as remaining_amount,
  greatest(a.current_entitlement_amount - a.paid_amount - a.reserved_amount, 0) as unbatched_amount,
  a.commission_amount_at_delivery - a.adjustment_amount as net_commission_amount,
  case when a.current_entitlement_amount <= a.paid_amount then 'completed'
    when a.paid_amount > 0 then 'partially_paid'
    when a.reserved_amount > 0 then 'open' else 'unsettled' end as settlement_status
from amounts a;

create view public.merchant_account_settlement_rows
with (security_barrier = true, security_invoker = true) as
with amounts as (
  select b.*,
    coalesce((select sum(e.amount_snapshot) from public.merchant_settlement_batch_entitlements e where e.batch_id = b.id), 0) as total_amount,
    coalesce((select sum(p.amount) from public.merchant_settlement_payments p where p.batch_id = b.id), 0) as paid_amount
  from public.merchant_settlement_batches b
)
select a.*, a.total_amount - a.paid_amount as remaining_amount,
  case when a.status = 'completed' then 'completed'
    when a.paid_amount > 0 and a.paid_amount < a.total_amount then 'partially_paid'
    else 'open' end as settlement_status
from amounts a;

-- Private implementation views: only the checked RPC is exposed to clients.
revoke all on public.merchant_account_sale_rows, public.merchant_account_settlement_rows from public, anon, authenticated;

create function public.merchant_financial_account(
  section_name text default 'overview',
  selected_currency public.currency_code default null,
  period_from timestamptz default null,
  period_until timestamptz default null,
  selected_status text default null,
  order_search text default null,
  record_id uuid default null,
  page_number integer default 0,
  payments_page integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  own_merchant uuid;
  header_value jsonb := null;
  result_value jsonb;
  own_entitlement uuid;
  own_commission uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select m.id into own_merchant from public.merchants m where m.owner_user_id = auth.uid();
  if own_merchant is null then raise exception 'merchant access required' using errcode = '42501'; end if;
  if section_name is null or section_name not in ('overview','sales','sale','settlements','settlement','commissions','invoices','payments') then
    raise exception 'invalid section';
  end if;
  if page_number is null or page_number < 0 or page_number > 1000000
    or payments_page is null or payments_page < 0 or payments_page > 1000000 then raise exception 'invalid page'; end if;
  if period_from is not null and period_until is not null and period_from >= period_until then raise exception 'invalid period'; end if;
  if selected_status is not null and selected_status not in ('open','partially_paid','completed','unsettled') then raise exception 'invalid status'; end if;
  if char_length(coalesce(order_search, '')) > 30 or coalesce(order_search, '') !~ '^[0-9]*$' then raise exception 'invalid order number'; end if;

  if section_name = 'overview' then
    with sales as materialized (
      select * from public.merchant_account_sale_rows s where s.merchant_id = own_merchant
    ), batches as materialized (
      select * from public.merchant_account_settlement_rows b where b.merchant_id = own_merchant
    ), keys as (
      select currency from sales union select currency from batches
      union select p.currency from public.merchant_settlement_payments p where p.merchant_id = own_merchant
    ), sale_totals as (
      select currency, sum(gross_items_amount) as gross_items_amount,
        sum(commission_amount_at_delivery) as commission_amount_at_delivery,
        sum(adjustment_amount) as adjustment_amount,
        sum(net_commission_amount) as net_commission_amount,
        sum(current_entitlement_amount) as current_entitlement_amount,
        sum(unbatched_amount) as unbatched_amount, count(*) as delivered_count
      from sales group by currency
    ), payment_totals as (
      select p.currency, sum(p.amount) as paid_amount from public.merchant_settlement_payments p
      where p.merchant_id = own_merchant group by p.currency
    ), batch_totals as (
      select currency, count(*) filter (where status = 'open') as open_count,
        count(*) filter (where settlement_status = 'partially_paid') as partial_count,
        count(*) filter (where status = 'completed') as completed_count
      from batches group by currency
    ), totals as (
      select k.currency, coalesce(s.gross_items_amount, 0) as gross_items_amount,
        coalesce(s.commission_amount_at_delivery, 0) as commission_amount_at_delivery,
        coalesce(s.adjustment_amount, 0) as adjustment_amount,
        coalesce(s.net_commission_amount, 0) as net_commission_amount,
        coalesce(s.current_entitlement_amount, 0) as current_entitlement_amount,
        coalesce(p.paid_amount, 0) as paid_amount,
        coalesce(s.current_entitlement_amount, 0) - coalesce(p.paid_amount, 0) as remaining_amount,
        coalesce(s.unbatched_amount, 0) as unbatched_amount, coalesce(s.delivered_count, 0) as delivered_count,
        coalesce(b.open_count, 0) as open_count, coalesce(b.partial_count, 0) as partial_count,
        coalesce(b.completed_count, 0) as completed_count
      from keys k left join sale_totals s using (currency)
      left join payment_totals p using (currency) left join batch_totals b using (currency)
    ), subscription as (
      -- A future renewal must not replace the latest period that has started.
      select s.plan_name_snapshot, s.starts_at, s.expires_at, s.commission_rate_snapshot,
        s.currency_snapshot, s.price_snapshot,
        coalesce((select bs.auto_renew from public.merchant_billing_settings bs where bs.merchant_id = own_merchant), false) as auto_renew,
        case when now() < s.expires_at then 'active'
          when now() < s.expires_at + interval '7 days' then 'grace' else 'expired' end as subscription_status
      from public.merchant_subscriptions s where s.merchant_id = own_merchant and s.starts_at <= now()
      order by s.starts_at desc, s.id desc limit 1
    )
    select jsonb_build_object(
      'summary', coalesce((select jsonb_agg(to_jsonb(t) order by currency) from totals t), '[]'::jsonb),
      'obligations', coalesce((select jsonb_agg(to_jsonb(p) - 'merchant_id' order by p.currency)
        from public.merchant_financial_positions p where p.merchant_id = own_merchant), '[]'::jsonb),
      'subscription', (select to_jsonb(s) from subscription s),
      'rows', '[]'::jsonb, 'count', 0, 'record', null,
      'payments', '[]'::jsonb, 'payments_count', 0
    ) into result_value;
    return result_value;
  end if;

  if section_name = 'sale' then
    select to_jsonb(s) - 'merchant_id', s.merchant_order_entitlement_id, s.commission_id
    into header_value, own_entitlement, own_commission
    from public.merchant_account_sale_rows s where s.merchant_id = own_merchant and s.store_order_id = record_id;
    if header_value is null then raise exception 'record not found' using errcode = 'P0002'; end if;
  elsif section_name = 'settlement' then
    select to_jsonb(b) - 'merchant_id' - 'created_by' - 'completed_by' - 'idempotency_key'
    into header_value from public.merchant_account_settlement_rows b
    where b.merchant_id = own_merchant and b.id = record_id;
    if header_value is null then raise exception 'record not found' using errcode = 'P0002'; end if;
  end if;

  with source as materialized (
    select s.store_order_id as id, s.delivered_at as occurred_at, s.currency,
      s.settlement_status as status, s.order_number::text as order_number,
      to_jsonb(s) - 'merchant_id' as payload
    from public.merchant_account_sale_rows s where section_name = 'sales' and s.merchant_id = own_merchant
    union all
    select b.id, b.created_at, b.currency, b.settlement_status, null::text,
      to_jsonb(b) - 'merchant_id' - 'created_by' - 'completed_by' - 'idempotency_key'
    from public.merchant_account_settlement_rows b where section_name = 'settlements' and b.merchant_id = own_merchant
    union all
    select c.id, c.due_at, c.currency, c.status, co.order_number::text,
      jsonb_build_object('id', c.id, 'store_order_id', c.store_order_id, 'order_number', co.order_number,
        'currency', c.currency, 'base_amount', c.base_amount, 'commission_rate', c.commission_rate,
        'commission_amount', c.commission_amount, 'reversed_amount', r.amount,
        'net_commission_amount', c.commission_amount - r.amount, 'occurred_at', c.due_at)
    from public.store_order_commissions c
    join public.store_orders so on so.id = c.store_order_id
    join public.customer_orders co on co.id = so.customer_order_id
    cross join lateral (select coalesce(sum(r.amount), 0) as amount from public.store_order_commission_reversals r where r.commission_id = c.id) r
    where section_name = 'commissions' and c.merchant_id = own_merchant and c.status = 'due'
    union all
    select i.id, i.created_at, i.currency, i.status, null::text,
      jsonb_build_object('id', i.id, 'invoice_number', i.invoice_number, 'currency', i.currency,
        'total_amount', i.total_amount, 'paid_amount', a.amount,
        'remaining_amount', case when i.status = 'void' then 0 else i.total_amount - a.amount end,
        'status', i.status, 'occurred_at', i.created_at, 'due_at', i.due_at,
        'starts_at', s.starts_at, 'expires_at', s.expires_at, 'plan_name_snapshot', s.plan_name_snapshot)
    from public.subscription_invoices i join public.merchant_subscriptions s on s.id = i.subscription_id
    cross join lateral (select coalesce(sum(a.amount), 0) as amount from public.invoice_payment_allocations a where a.invoice_id = i.id) a
    where section_name = 'invoices' and i.merchant_id = own_merchant
    union all
    select p.id, p.received_at, p.currency, null::text, null::text,
      jsonb_build_object('id', p.id, 'currency', p.currency, 'amount', p.amount,
        'allocated_amount', a.amount, 'unallocated_amount', p.amount - a.amount,
        'method', p.method, 'external_reference', p.external_reference, 'occurred_at', p.received_at)
    from public.subscription_payments p
    cross join lateral (select coalesce(sum(a.amount), 0) as amount from public.invoice_payment_allocations a where a.payment_id = p.id) a
    where section_name = 'payments' and p.merchant_id = own_merchant
    union all
    select p.batch_entitlement_id, p.delivered_at, p.currency, p.status, co.order_number::text,
      jsonb_build_object('id', p.batch_entitlement_id, 'store_order_id', p.store_order_id,
        'order_number', co.order_number, 'currency', p.currency,
        'current_entitlement_amount', p.current_entitlement_amount,
        'paid_amount', p.paid_amount, 'remaining_amount', p.remaining_amount, 'occurred_at', p.delivered_at)
    from public.merchant_settlement_batch_positions p
    join public.store_orders so on so.id = p.store_order_id
    join public.customer_orders co on co.id = so.customer_order_id
    where section_name = 'settlement' and p.merchant_id = own_merchant and p.batch_id = record_id
    union all
    select a.id, a.created_at, a.currency, null::text, null::text,
      jsonb_build_object('id', a.id, 'event_type', 'entitlement_adjustment', 'currency', a.currency,
        'amount', a.amount, 'occurred_at', a.created_at, 'source_type', a.source_type)
    from public.merchant_order_entitlement_adjustments a
    where section_name = 'sale' and a.merchant_id = own_merchant and a.merchant_order_entitlement_id = own_entitlement
    union all
    select r.id, r.created_at, r.currency, null::text, null::text,
      jsonb_build_object('id', r.id, 'event_type', 'commission_reversal', 'currency', r.currency,
        'amount', r.amount, 'reason', r.reason, 'occurred_at', r.created_at)
    from public.store_order_commission_reversals r
    where section_name = 'sale' and r.merchant_id = own_merchant and r.commission_id = own_commission
    union all
    select be.id, be.created_at, b.currency, b.status, null::text,
      jsonb_build_object('id', be.id, 'event_type', 'settlement_inclusion', 'currency', b.currency,
        'amount', be.amount_snapshot, 'batch_id', b.id, 'occurred_at', be.created_at)
    from public.merchant_settlement_batch_entitlements be
    join public.merchant_settlement_batches b on b.id = be.batch_id
    where section_name = 'sale' and b.merchant_id = own_merchant and be.merchant_order_entitlement_id = own_entitlement
    union all
    select a.id, p.paid_at, p.currency, null::text, null::text,
      jsonb_build_object('id', a.id, 'event_type', 'sale_payment', 'currency', p.currency,
        'amount', a.amount, 'batch_id', p.batch_id, 'external_reference', p.external_reference,
        'note', p.note, 'method', null, 'occurred_at', p.paid_at)
    from public.merchant_settlement_payment_allocations a
    join public.merchant_settlement_batch_entitlements be on be.id = a.batch_entitlement_id
    join public.merchant_settlement_payments p on p.id = a.payment_id
    where section_name = 'sale' and p.merchant_id = own_merchant and be.merchant_order_entitlement_id = own_entitlement
  ), filtered as materialized (
    select * from source s where (selected_currency is null or s.currency = selected_currency)
      and (period_from is null or s.occurred_at >= period_from)
      and (period_until is null or s.occurred_at < period_until)
      and (selected_status is null or s.status = selected_status)
      and (coalesce(order_search, '') = '' or s.order_number = order_search)
  ), details as (
    select * from filtered order by occurred_at desc, id desc limit 20 offset (page_number::bigint * 20)
  ), totals as (
    -- Aggregate the full filtered sales cohort, never the page of details.
    select currency, sum((payload->>'gross_items_amount')::numeric) as gross_items_amount,
      sum((payload->>'commission_amount_at_delivery')::numeric) as commission_amount_at_delivery,
      sum((payload->>'adjustment_amount')::numeric) as adjustment_amount,
      sum((payload->>'current_entitlement_amount')::numeric) as current_entitlement_amount,
      sum((payload->>'paid_amount')::numeric) as paid_amount,
      sum((payload->>'remaining_amount')::numeric) as remaining_amount
    from filtered where section_name = 'sales' group by currency
  ), payment_rows as materialized (
    select p.id, p.currency, p.amount, p.paid_at as occurred_at, null::text as method,
      p.external_reference, p.note
    from public.merchant_settlement_payments p
    where section_name = 'settlement' and p.merchant_id = own_merchant and p.batch_id = record_id
  ), payment_details as (
    select * from payment_rows order by occurred_at desc, id desc limit 20 offset (payments_page::bigint * 20)
  )
  select jsonb_build_object(
    'summary', coalesce((select jsonb_agg(to_jsonb(t) order by currency) from totals t), '[]'::jsonb),
    'obligations', '[]'::jsonb, 'subscription', null, 'record', header_value,
    'rows', coalesce((select jsonb_agg(payload order by occurred_at desc, id desc) from details), '[]'::jsonb),
    'count', (select count(*) from filtered),
    'payments', coalesce((select jsonb_agg(to_jsonb(p) order by occurred_at desc, id desc) from payment_details p), '[]'::jsonb),
    'payments_count', (select count(*) from payment_rows)
  ) into result_value;
  return result_value;
end;
$$;
revoke all on function public.merchant_financial_account(text, public.currency_code, timestamptz, timestamptz, text, text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.merchant_financial_account(text, public.currency_code, timestamptz, timestamptz, text, text, uuid, integer, integer) to authenticated;

-- The sole write side effect is the explicitly requested in-app notification.
-- Deferred until the payment transaction completes its allocations/status work.
-- An idempotent retry returns the original payment and never inserts a new row,
-- hence this trigger cannot emit another notification for that retry.
create function public.notify_merchant_settlement_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id, type, title, body, data)
  select m.owner_user_id, 'system', 'تسجيل دفعة مستحقات',
    'سجّل المكتب دفعة من مستحقات مبيعاتك بقيمة ' || new.amount::text || ' ' || new.currency::text || '. راجع حسابك المالي للتفاصيل.',
    jsonb_build_object('route', '/merchant/finance')
  from public.merchants m where m.id = new.merchant_id;
  return new;
end;
$$;
revoke all on function public.notify_merchant_settlement_payment() from public, anon, authenticated;
create constraint trigger merchant_settlement_payment_notification
  after insert on public.merchant_settlement_payments
  deferrable initially deferred for each row execute function public.notify_merchant_settlement_payment();

commit;
