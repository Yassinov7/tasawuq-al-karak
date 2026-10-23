-- Cash-order financial foundations.
-- This migration records what a delivered cash-on-delivery order made
-- collectible and what it made payable. It deliberately does not record an
-- office remittance, driver custody, merchant payout, or payroll settlement.

begin;

-- A parent order can contain store-order totals in more than one currency.
-- Every row is an immutable delivery-time snapshot for one currency, and the
-- delivery fee appears only in the parent order's saved delivery currency.
create table public.customer_order_cash_obligations (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders(id) on delete restrict,
  delivery_task_id uuid not null references public.delivery_tasks(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  currency public.currency_code not null,
  delivered_store_items_amount numeric(14,2) not null check (delivered_store_items_amount >= 0),
  delivery_fee_amount numeric(14,2) not null check (delivery_fee_amount >= 0),
  collectible_amount numeric(14,2) not null check (collectible_amount >= 0),
  delivery_zone_id uuid references public.delivery_zones(id) on delete restrict,
  delivery_zone_name_snapshot text not null,
  delivered_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (customer_order_id, currency),
  check (collectible_amount = delivered_store_items_amount + delivery_fee_amount)
);
create index customer_order_cash_obligations_driver_idx
  on public.customer_order_cash_obligations (driver_id, delivered_at desc);
create index customer_order_cash_obligations_order_idx
  on public.customer_order_cash_obligations (customer_order_id, created_at);

-- Delivery pay is the driver's entitlement, not platform revenue. It is
-- purposely one row per completed parent order because the delivery fee is
-- charged once per parent order, regardless of its number of stores.
create table public.driver_delivery_fee_entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null unique references public.customer_orders(id) on delete restrict,
  delivery_task_id uuid not null unique references public.delivery_tasks(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  currency public.currency_code not null,
  delivery_fee_amount numeric(14,2) not null check (delivery_fee_amount >= 0),
  delivery_zone_id uuid references public.delivery_zones(id) on delete restrict,
  delivery_zone_name_snapshot text not null,
  status text not null default 'pending_settlement'
    check (status = 'pending_settlement'),
  delivered_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index driver_delivery_fee_entitlements_driver_idx
  on public.driver_delivery_fee_entitlements (driver_id, status, delivered_at desc);

-- This is an entitlement only. It is intentionally separate from the
-- merchant platform-exposure ledger and is never treated as a completed
-- merchant payout. The initial net amount is preserved, while later known
-- corrections are appended below rather than rewriting the original row.
create table public.merchant_order_entitlements (
  id uuid primary key default gen_random_uuid(),
  store_order_id uuid not null unique references public.store_orders(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  commission_id uuid not null unique references public.store_order_commissions(id) on delete restrict,
  currency public.currency_code not null,
  gross_items_amount numeric(14,2) not null check (gross_items_amount >= 0),
  commission_amount_at_delivery numeric(14,2) not null check (commission_amount_at_delivery >= 0),
  initial_net_entitlement_amount numeric(14,2) not null check (initial_net_entitlement_amount >= 0),
  status text not null default 'pending_settlement'
    check (status = 'pending_settlement'),
  delivered_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (initial_net_entitlement_amount = gross_items_amount - commission_amount_at_delivery)
);
create index merchant_order_entitlements_merchant_idx
  on public.merchant_order_entitlements (merchant_id, currency, status, delivered_at desc);

-- The current system has one post-delivery commission correction: an
-- append-only commission reversal. Its effect on merchant entitlement is
-- recorded independently so an old entitlement is never silently changed.
create table public.merchant_order_entitlement_adjustments (
  id uuid primary key default gen_random_uuid(),
  merchant_order_entitlement_id uuid not null
    references public.merchant_order_entitlements(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  currency public.currency_code not null,
  amount numeric(14,2) not null check (amount > 0),
  effect text not null check (effect = 'increase_entitlement'),
  source_type text not null check (source_type = 'commission_reversal'),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id)
);
create index merchant_order_entitlement_adjustments_entitlement_idx
  on public.merchant_order_entitlement_adjustments (merchant_order_entitlement_id, created_at desc);

-- Settlement work must read this derived position rather than changing the
-- original entitlement. New correction sources can be added as explicit,
-- append-only adjustment types in a later migration.
create view public.merchant_order_entitlement_positions
with (security_barrier = true, security_invoker = true)
as
select
  e.id as merchant_order_entitlement_id,
  e.store_order_id,
  e.merchant_id,
  e.commission_id,
  e.currency,
  e.gross_items_amount,
  e.commission_amount_at_delivery,
  e.initial_net_entitlement_amount,
  coalesce(sum(a.amount), 0)::numeric(14,2) as adjustment_amount,
  (e.initial_net_entitlement_amount + coalesce(sum(a.amount), 0))::numeric(14,2)
    as current_entitlement_amount,
  e.status,
  e.delivered_at,
  e.created_at
from public.merchant_order_entitlements e
left join public.merchant_order_entitlement_adjustments a
  on a.merchant_order_entitlement_id = e.id
group by e.id;

-- A delivery is eligible only after the task is actually delivered and all
-- child orders are terminal. Therefore rejected/cancelled children contribute
-- neither product cash nor merchant entitlement, and a wholly rejected order
-- cannot create any delivery cash or driver-fee row.
create function public.create_delivered_order_cash_foundations(target_customer_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.customer_orders%rowtype;
  task_row public.delivery_tasks%rowtype;
  delivered_store_row record;
  has_delivered_store boolean;
  has_nonterminal_store boolean;
begin
  select * into order_row
  from public.customer_orders co
  where co.id = target_customer_order
  for key share;
  if not found then
    raise exception 'customer order not found while creating delivered cash foundations';
  end if;

  select * into task_row
  from public.delivery_tasks dt
  where dt.customer_order_id = target_customer_order
  for key share;
  if not found or task_row.status <> 'delivered'
     or task_row.driver_id is null or task_row.delivered_at is null then
    return;
  end if;

  select
    bool_or(so.status = 'delivered'),
    bool_or(so.status not in ('delivered', 'rejected', 'cancelled'))
  into has_delivered_store, has_nonterminal_store
  from public.store_orders so
  where so.customer_order_id = target_customer_order;

  if not coalesce(has_delivered_store, false) or coalesce(has_nonterminal_store, true) then
    return;
  end if;

  -- The current status trigger is named before this migration's store-order
  -- trigger and therefore normally accrues first. Calling the same idempotent
  -- server helper here makes the dependency explicit and also protects a
  -- future server delivery path from creating a merchant entitlement before
  -- its commission is due.
  for delivered_store_row in
    select so.id, coalesce(so.delivered_at, task_row.delivered_at) as delivered_at
    from public.store_orders so
    where so.customer_order_id = target_customer_order
      and so.status = 'delivered'
  loop
    perform public.accrue_store_order_commission(
      delivered_store_row.id,
      delivered_store_row.delivered_at
    );
  end loop;

  -- Do not read customer_order_totals here: those historical totals are kept
  -- intact and can include a child order later rejected before delivery.
  with delivered_totals as (
    select sot.currency, sum(sot.items_subtotal)::numeric(14,2) as items_amount
    from public.store_orders so
    join public.store_order_totals sot on sot.store_order_id = so.id
    where so.customer_order_id = target_customer_order
      and so.status = 'delivered'
    group by sot.currency
  ), collectible_currencies as (
    select dt.currency, dt.items_amount,
      case when dt.currency = order_row.delivery_currency then order_row.delivery_fee else 0::numeric end
        as fee_amount
    from delivered_totals dt
    union all
    select order_row.delivery_currency, 0::numeric, order_row.delivery_fee
    where not exists (
      select 1 from delivered_totals dt where dt.currency = order_row.delivery_currency
    )
  )
  insert into public.customer_order_cash_obligations(
    customer_order_id, delivery_task_id, driver_id, currency,
    delivered_store_items_amount, delivery_fee_amount, collectible_amount,
    delivery_zone_id, delivery_zone_name_snapshot, delivered_at
  )
  select
    order_row.id, task_row.id, task_row.driver_id, cc.currency,
    cc.items_amount, cc.fee_amount, cc.items_amount + cc.fee_amount,
    order_row.delivery_zone_id, order_row.delivery_zone_name_snapshot, task_row.delivered_at
  from collectible_currencies cc
  on conflict (customer_order_id, currency) do nothing;

  insert into public.driver_delivery_fee_entitlements(
    customer_order_id, delivery_task_id, driver_id, currency,
    delivery_fee_amount, delivery_zone_id, delivery_zone_name_snapshot, delivered_at
  ) values (
    order_row.id, task_row.id, task_row.driver_id, order_row.delivery_currency,
    order_row.delivery_fee, order_row.delivery_zone_id,
    order_row.delivery_zone_name_snapshot, task_row.delivered_at
  ) on conflict (customer_order_id) do nothing;

  -- Existing, pre-migration commissions are not backfilled because they never
  -- pass through this delivery transition.
  insert into public.merchant_order_entitlements(
    store_order_id, merchant_id, commission_id, currency,
    gross_items_amount, commission_amount_at_delivery,
    initial_net_entitlement_amount, delivered_at
  )
  select
    so.id, s.merchant_id, c.id, sot.currency,
    sot.items_subtotal, c.commission_amount,
    sot.items_subtotal - c.commission_amount, task_row.delivered_at
  from public.store_orders so
  join public.stores s on s.id = so.store_id
  join public.store_order_totals sot on sot.store_order_id = so.id
  join public.store_order_commissions c
    on c.store_order_id = so.id
   and c.currency = sot.currency
   and c.status = 'due'
  where so.customer_order_id = target_customer_order
    and so.status = 'delivered'
  on conflict (store_order_id) do nothing;
end;
$$;

create function public.create_delivered_order_cash_foundations_after_store_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'delivered'
     and new.status is distinct from old.status then
    perform public.create_delivered_order_cash_foundations(new.customer_order_id);
  end if;
  return new;
end;
$$;

-- PostgreSQL runs same-event row triggers by name. The existing "apply"
-- trigger runs before "cash"; the helper above independently enforces the
-- same idempotent accrual before it reads due commissions.
create trigger store_orders_cash_financial_foundations_after_status_change
  after update of status on public.store_orders
  for each row execute function public.create_delivered_order_cash_foundations_after_store_delivery();

-- update_delivery_task_status changes the task first and then changes all
-- handed-to-driver child orders. This deferred trigger observes the final
-- transaction state, providing a server-side backstop if another trusted path
-- reaches delivery with a different statement ordering.
create function public.create_delivered_order_cash_foundations_after_task_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'delivered'
     and new.status is distinct from old.status then
    perform public.create_delivered_order_cash_foundations(new.customer_order_id);
  end if;
  return new;
end;
$$;

create constraint trigger delivery_tasks_cash_financial_foundations_after_status_change
  after update of status on public.delivery_tasks
  deferrable initially deferred
  for each row execute function public.create_delivered_order_cash_foundations_after_task_delivery();

create function public.append_commission_reversal_entitlement_adjustment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.merchant_order_entitlement_adjustments(
    merchant_order_entitlement_id, merchant_id, currency, amount,
    effect, source_type, source_id
  )
  select
    e.id, e.merchant_id, e.currency, new.amount,
    'increase_entitlement', 'commission_reversal', new.id
  from public.merchant_order_entitlements e
  where e.commission_id = new.commission_id
    and e.merchant_id = new.merchant_id
    and e.currency = new.currency
  on conflict (source_type, source_id) do nothing;
  return new;
end;
$$;

create trigger store_order_commission_reversal_append_merchant_entitlement_adjustment
  after insert on public.store_order_commission_reversals
  for each row execute function public.append_commission_reversal_entitlement_adjustment();

alter table public.customer_order_cash_obligations enable row level security;
alter table public.driver_delivery_fee_entitlements enable row level security;
alter table public.merchant_order_entitlements enable row level security;
alter table public.merchant_order_entitlement_adjustments enable row level security;

revoke all on table public.customer_order_cash_obligations,
  public.driver_delivery_fee_entitlements,
  public.merchant_order_entitlements,
  public.merchant_order_entitlement_adjustments,
  public.merchant_order_entitlement_positions
  from anon, authenticated;
grant select on table public.customer_order_cash_obligations,
  public.driver_delivery_fee_entitlements,
  public.merchant_order_entitlements,
  public.merchant_order_entitlement_adjustments,
  public.merchant_order_entitlement_positions
  to authenticated;

create policy customer_order_cash_obligations_read
  on public.customer_order_cash_obligations
  for select to authenticated
  using (public.is_admin() or driver_id = auth.uid());

create policy driver_delivery_fee_entitlements_read
  on public.driver_delivery_fee_entitlements
  for select to authenticated
  using (public.is_admin() or driver_id = auth.uid());

create policy merchant_order_entitlements_read
  on public.merchant_order_entitlements
  for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.merchants m
    where m.id = merchant_id and m.owner_user_id = auth.uid()
  ));

create policy merchant_order_entitlement_adjustments_read
  on public.merchant_order_entitlement_adjustments
  for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.merchants m
    where m.id = merchant_id and m.owner_user_id = auth.uid()
  ));

-- Trigger helpers are server-only. Financial writes remain unavailable to
-- client roles; later cash-office settlement must use dedicated RPCs.
revoke all on function public.create_delivered_order_cash_foundations(uuid)
  from public, anon, authenticated;
revoke all on function public.create_delivered_order_cash_foundations_after_store_delivery()
  from public, anon, authenticated;
revoke all on function public.create_delivered_order_cash_foundations_after_task_delivery()
  from public, anon, authenticated;
revoke all on function public.append_commission_reversal_entitlement_adjustment()
  from public, anon, authenticated;

commit;
