-- Phase 9.7: two source-confirmed fixes, with no historical record rewrites.
begin;

-- A merchant may read the parent for delivery/contact context, but must not
-- learn other stores' money through the parent-order totals. Child-order
-- amounts remain governed by can_view_store_order and are unchanged.
alter policy customer_order_totals_read_participants on public.customer_order_totals
using (
  public.is_admin()
  or exists (
    select 1 from public.customer_orders co
    where co.id = customer_order_totals.customer_order_id and co.customer_id = auth.uid()
  )
  or exists (
    select 1 from public.delivery_tasks dt
    where dt.customer_order_id = customer_order_totals.customer_order_id and dt.driver_id = auth.uid()
  )
);

-- Preserve the same view interface, invoker security, and gross receipt field.
-- A refunded driver credit is no longer money held by the office. Count it
-- back into remaining custody when later deliveries create new obligations.
create or replace view public.driver_cash_custody_positions
with (security_barrier = true, security_invoker = true)
as
with keys as (
  select driver_id, currency from public.customer_order_cash_obligations
  union
  select driver_id, currency from public.driver_delivery_fee_entitlements
  union
  select driver_id, currency from public.driver_cash_remittances
  union
  select driver_id, currency from public.driver_cash_credit_payouts
), cash_collected as (
  select driver_id, currency, coalesce(sum(collectible_amount), 0)::numeric(14,2) as amount
  from public.customer_order_cash_obligations group by driver_id, currency
), delivery_fees as (
  select driver_id, currency, coalesce(sum(delivery_fee_amount), 0)::numeric(14,2) as amount
  from public.driver_delivery_fee_entitlements group by driver_id, currency
), remitted as (
  select driver_id, currency, coalesce(sum(amount), 0)::numeric(14,2) as amount
  from public.driver_cash_remittances group by driver_id, currency
), paid_credits as (
  select driver_id, currency, coalesce(sum(amount), 0)::numeric(14,2) as amount
  from public.driver_cash_credit_payouts group by driver_id, currency
)
select k.driver_id, k.currency,
  coalesce(cc.amount, 0)::numeric(14,2) as cash_collected_amount,
  coalesce(df.amount, 0)::numeric(14,2) as delivery_fee_entitled_amount,
  greatest(coalesce(cc.amount, 0) - coalesce(df.amount, 0), 0)::numeric(14,2) as net_custody_due_amount,
  coalesce(r.amount, 0)::numeric(14,2) as office_received_amount,
  greatest(greatest(coalesce(cc.amount, 0) - coalesce(df.amount, 0), 0)
    - coalesce(r.amount, 0) + coalesce(pc.amount, 0), 0)::numeric(14,2) as custody_remaining_amount,
  greatest(coalesce(r.amount, 0) - greatest(coalesce(cc.amount, 0) - coalesce(df.amount, 0), 0)
    - coalesce(pc.amount, 0), 0)::numeric(14,2) as driver_credit_amount,
  coalesce(pc.amount, 0)::numeric(14,2) as driver_credit_paid_amount
from keys k
left join cash_collected cc on cc.driver_id = k.driver_id and cc.currency = k.currency
left join delivery_fees df on df.driver_id = k.driver_id and df.currency = k.currency
left join remitted r on r.driver_id = k.driver_id and r.currency = k.currency
left join paid_credits pc on pc.driver_id = k.driver_id and pc.currency = k.currency;

commit;
