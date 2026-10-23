-- Store-order commissions.
-- Commissions are snapshotted after the trusted item subtotal is written and
-- become financial exposure only when the relevant store order is delivered.

begin;

-- No default is intentionally supplied: a plan without an explicitly
-- configured rate cannot silently create an unpriced commission.
alter table public.subscription_plans
  add column commission_rate numeric(7,4)
  check (commission_rate >= 0 and commission_rate <= 100);

-- A rate belongs to a subscription period once that period is created. It is
-- intentionally nullable for pre-commission periods: no historical term is
-- inferred from a plan that may have changed since the period began.
alter table public.merchant_subscriptions
  add column commission_rate_snapshot numeric(7,4)
  check (commission_rate_snapshot >= 0 and commission_rate_snapshot <= 100);
alter table public.merchant_subscription_plan_changes
  add column commission_rate_snapshot numeric(7,4)
  check (commission_rate_snapshot >= 0 and commission_rate_snapshot <= 100);

-- These fields make the plan terms used for each order independently auditable.
-- Existing commission rows are intentionally not backfilled.
alter table public.store_order_commissions
  add column subscription_id uuid references public.merchant_subscriptions(id) on delete restrict,
  add column plan_id uuid references public.subscription_plans(id) on delete restrict,
  add column plan_name_snapshot text;
create index store_order_commissions_subscription_idx
  on public.store_order_commissions (subscription_id);

-- A partial correction cannot use ledger_reversal because that entry type is
-- deliberately an exact, one-to-one reversal. Commission corrections are
-- independent append-only counterentries with their own audited source.
alter table public.merchant_ledger_entries
  drop constraint merchant_ledger_entries_source_type_check,
  add constraint merchant_ledger_entries_source_type_check check (source_type in (
    'subscription_invoice', 'store_order_commission', 'commission_reversal',
    'payment_allocation', 'manual_adjustment', 'ledger_reversal'
  ));

create table public.store_order_commission_reversals (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.store_order_commissions(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  currency public.currency_code not null,
  amount numeric(14,2) not null check (amount > 0),
  idempotency_key uuid not null unique,
  reason text not null check (char_length(trim(reason)) between 2 and 1500),
  reversed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index store_order_commission_reversals_commission_idx
  on public.store_order_commission_reversals (commission_id, created_at desc);
create index store_order_commission_reversals_merchant_idx
  on public.store_order_commission_reversals (merchant_id, currency, created_at desc);

alter table public.store_order_commission_reversals enable row level security;
revoke all on table public.store_order_commission_reversals from anon, authenticated;
grant select on table public.store_order_commission_reversals to authenticated;
create policy store_order_commission_reversals_read
  on public.store_order_commission_reversals
  for select to authenticated
  using (
    public.is_admin() or exists (
      select 1
      from public.merchants m
      where m.id = merchant_id and m.owner_user_id = auth.uid()
    )
  );

-- Preserve commission terms when a future plan change is selected. This hook
-- covers the existing scheduling RPC without changing its public signature.
create function public.snapshot_plan_change_commission_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rate_value numeric(7,4);
begin
  if new.commission_rate_snapshot is not null then
    return new;
  end if;

  select p.commission_rate into rate_value
  from public.subscription_plans p
  where p.id = new.plan_id
  for share;
  if rate_value is null then
    raise exception 'selected subscription plan has no commission rate configured';
  end if;

  new.commission_rate_snapshot := rate_value;
  return new;
end;
$$;

create trigger merchant_subscription_plan_changes_snapshot_commission_before_insert
  before insert on public.merchant_subscription_plan_changes
  for each row execute function public.snapshot_plan_change_commission_rate();

-- Both first approval and renewal already insert merchant_subscriptions. This
-- trigger keeps their existing RPC signatures intact while recording a rate
-- that cannot be altered later by edits to subscription_plans.
create function public.snapshot_subscription_commission_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rate_value numeric(7,4);
  has_pending_change boolean := false;
  has_previous_subscription boolean := false;
begin
  if new.commission_rate_snapshot is not null then
    return new;
  end if;

  select c.commission_rate_snapshot into rate_value
  from public.merchant_subscription_plan_changes c
  where c.merchant_id = new.merchant_id
    and c.plan_id = new.plan_id
    and c.superseded_at is null
    and c.consumed_by_subscription is null
  order by c.selected_at desc, c.id desc
  limit 1
  for share;

  has_pending_change := found;
  if has_pending_change and rate_value is null then
    raise exception 'scheduled subscription plan change lacks a commission rate snapshot';
  end if;

  if not has_pending_change then
    select ms.commission_rate_snapshot into rate_value
    from public.merchant_subscriptions ms
    where ms.merchant_id = new.merchant_id
    order by ms.expires_at desc, ms.id desc
    limit 1
    for share;
    has_previous_subscription := found;
    if has_previous_subscription and rate_value is null then
      raise exception 'previous subscription lacks a commission rate snapshot; manual reconciliation is required';
    end if;
  end if;

  if not has_pending_change and not has_previous_subscription then
    select p.commission_rate into rate_value
    from public.subscription_plans p
    where p.id = new.plan_id
    for share;
  end if;

  if rate_value is null then
    raise exception 'subscription commission rate must be configured before activation or renewal';
  end if;

  new.commission_rate_snapshot := rate_value;
  return new;
end;
$$;

create trigger merchant_subscriptions_snapshot_commission_before_insert
  before insert on public.merchant_subscriptions
  for each row execute function public.snapshot_subscription_commission_rate();

-- The common accrual operation is called both by the delivery status trigger
-- and by the deferred snapshot trigger when a transaction creates and delivers
-- a store order before its deferred triggers run.
create function public.accrue_store_order_commission(
  target_store_order uuid,
  delivered_at_value timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  commission_row public.store_order_commissions%rowtype;
  effective_due_at timestamptz := coalesce(delivered_at_value, now());
begin
  select * into commission_row
  from public.store_order_commissions c
  where c.store_order_id = target_store_order
  for update;

  if not found or commission_row.status <> 'pending_delivery' then
    return;
  end if;

  update public.store_order_commissions
  set status = 'due', due_at = effective_due_at
  where id = commission_row.id and status = 'pending_delivery';

  if commission_row.commission_amount > 0 then
    insert into public.merchant_ledger_entries(
      merchant_id, currency, effect, source_type, source_id, amount
    ) values (
      commission_row.merchant_id, commission_row.currency, 'increase_exposure',
      'store_order_commission', commission_row.id, commission_row.commission_amount
    ) on conflict (source_type, source_id) do nothing;
  end if;

  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    commission_row.merchant_id, auth.uid(), 'store_order_commission_due',
    'store order delivered',
    jsonb_build_object('status', 'pending_delivery'),
    jsonb_build_object(
      'commission_id', commission_row.id,
      'store_order_id', commission_row.store_order_id,
      'currency', commission_row.currency,
      'amount', commission_row.commission_amount,
      'due_at', effective_due_at
    )
  );
end;
$$;

-- The deferred constraint trigger runs after create_order_from_cart has written
-- the final store_order_totals row. A store order must have exactly one order
-- currency; a second currency would otherwise make one commission ambiguous.
create function public.snapshot_store_order_commission_after_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row record;
  total_count integer;
  total_currency public.currency_code;
  total_base_amount numeric(14,2);
  subscription_row record;
  rate_value numeric(7,4);
  commission_value numeric(14,2);
begin
  select so.id, so.created_at, so.status, so.delivered_at, s.merchant_id
    into order_row
  from public.store_orders so
  join public.stores s on s.id = so.store_id
  where so.id = new.store_order_id
  for key share of so;

  if not found then
    raise exception 'store order was not found while snapshotting commission';
  end if;

  -- Deferred triggers observe the final row state. A transaction that creates
  -- and then rejects/cancels an order must not leave a pending commission.
  if order_row.status in ('rejected', 'cancelled') then
    return new;
  end if;

  select count(*) into total_count
  from public.store_order_totals t
  where t.store_order_id = new.store_order_id;

  if total_count <> 1 then
    raise exception 'a store order must have exactly one currency total before commission snapshotting';
  end if;

  select t.currency, t.items_subtotal
    into total_currency, total_base_amount
  from public.store_order_totals t
  where t.store_order_id = new.store_order_id;

  select ms.id as subscription_id, ms.plan_id, ms.plan_name_snapshot,
         ms.commission_rate_snapshot
    into subscription_row
  from public.merchant_subscriptions ms
  where ms.merchant_id = order_row.merchant_id
    and ms.starts_at <= order_row.created_at
    and ms.expires_at + interval '7 days' > order_row.created_at
  order by ms.starts_at desc, ms.expires_at desc, ms.id desc
  limit 1
  for share of ms;

  if not found then
    raise exception 'no active subscription period covers this store order';
  end if;

  rate_value := subscription_row.commission_rate_snapshot;
  if rate_value is null then
    raise exception 'the active subscription period has no commission rate snapshot';
  end if;

  commission_value := round(total_base_amount * rate_value / 100, 2);

  insert into public.store_order_commissions(
    store_order_id, merchant_id, subscription_id, plan_id, plan_name_snapshot,
    currency, commission_rate, base_amount, commission_amount, status
  ) values (
    new.store_order_id, order_row.merchant_id, subscription_row.subscription_id,
    subscription_row.plan_id, subscription_row.plan_name_snapshot, total_currency,
    rate_value, total_base_amount, commission_value, 'pending_delivery'
  ) on conflict (store_order_id) do nothing;

  if order_row.status = 'delivered' then
    perform public.accrue_store_order_commission(
      new.store_order_id,
      order_row.delivered_at
    );
  end if;

  return new;
end;
$$;

create constraint trigger store_order_totals_snapshot_commission_after_insert
  after insert on public.store_order_totals
  deferrable initially deferred
  for each row execute function public.snapshot_store_order_commission_after_totals();

-- Delivery is the sole event that books a commission. The UNIQUE source key on
-- merchant_ledger_entries plus the commission-row lock make duplicate status
-- events and retried delivery RPCs idempotent.
create function public.apply_store_order_commission_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  commission_row public.store_order_commissions%rowtype;
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  select * into commission_row
  from public.store_order_commissions c
  where c.store_order_id = new.id
  for update;

  -- Orders created before this migration have no snapshot and must keep their
  -- existing delivery behavior; this migration never creates historic debts.
  if not found then
    return new;
  end if;

  if new.status in ('rejected', 'cancelled') then
    update public.store_order_commissions
    set status = 'void'
    where id = commission_row.id and status = 'pending_delivery';
    return new;
  end if;

  if new.status = 'delivered' then
    perform public.accrue_store_order_commission(new.id, new.delivered_at);
  end if;

  return new;
end;
$$;

create trigger store_orders_apply_commission_after_status_change
  after update of status on public.store_orders
  for each row execute function public.apply_store_order_commission_status_change();

-- Pre-commission subscription periods intentionally remain without an inferred
-- rate. An administrator must reconcile each such period explicitly before it
-- can price a new order; this never creates a commission or ledger entry.
create function public.reconcile_subscription_commission_rate(
  target_subscription uuid,
  reconciled_commission_rate numeric,
  reconciliation_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription_row public.merchant_subscriptions%rowtype;
  normalized_reason text := nullif(trim(reconciliation_reason), '');
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  if reconciled_commission_rate is null
     or reconciled_commission_rate::text in ('NaN', 'Infinity', '-Infinity')
     or reconciled_commission_rate < 0
     or reconciled_commission_rate > 100
     or reconciled_commission_rate <> trunc(reconciled_commission_rate, 4) then
    raise exception 'commission rate must be a finite number between 0 and 100 with at most four decimal places';
  end if;
  if normalized_reason is null
     or char_length(normalized_reason) < 2
     or char_length(normalized_reason) > 1500 then
    raise exception 'reconciliation reason must contain between 2 and 1500 characters';
  end if;

  select * into subscription_row
  from public.merchant_subscriptions ms
  where ms.id = target_subscription
  for update;
  if not found then
    raise exception 'merchant subscription not found';
  end if;
  if subscription_row.commission_rate_snapshot is not null then
    raise exception 'subscription commission rate snapshot is already set';
  end if;

  update public.merchant_subscriptions
  set commission_rate_snapshot = reconciled_commission_rate
  where id = subscription_row.id
    and commission_rate_snapshot is null;
  if not found then
    raise exception 'subscription commission rate snapshot is already set';
  end if;

  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    subscription_row.merchant_id, auth.uid(), 'subscription_commission_rate_reconciled',
    normalized_reason,
    jsonb_build_object(
      'subscription_id', subscription_row.id,
      'commission_rate_snapshot', null
    ),
    jsonb_build_object(
      'subscription_id', subscription_row.id,
      'commission_rate_snapshot', reconciled_commission_rate
    )
  );
end;
$$;

create function public.reverse_store_order_commission(
  target_commission uuid,
  reversal_amount numeric,
  reversal_idempotency_key uuid,
  reversal_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  commission_row public.store_order_commissions%rowtype;
  existing_reversal public.store_order_commission_reversals%rowtype;
  reversed_total numeric(14,2);
  reversal_id_value uuid;
  normalized_reason text := nullif(trim(reversal_reason), '');
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  if reversal_amount is null
     or reversal_amount::text in ('NaN', 'Infinity', '-Infinity')
     or reversal_amount <= 0
     or reversal_amount <> round(reversal_amount, 2) then
    raise exception 'commission reversal amount must be positive with at most two decimal places';
  end if;
  if reversal_idempotency_key is null then
    raise exception 'commission reversal idempotency key is required';
  end if;
  if normalized_reason is null
     or char_length(normalized_reason) < 2
     or char_length(normalized_reason) > 1500 then
    raise exception 'commission reversal reason must contain between 2 and 1500 characters';
  end if;

  select * into existing_reversal
  from public.store_order_commission_reversals r
  where r.idempotency_key = reversal_idempotency_key
  for update;
  if found then
    if existing_reversal.commission_id <> target_commission
       or existing_reversal.amount <> reversal_amount
       or existing_reversal.reason <> normalized_reason then
      raise exception 'commission reversal idempotency key was reused with different details';
    end if;
    return existing_reversal.id;
  end if;

  select * into commission_row
  from public.store_order_commissions c
  where c.id = target_commission
  for update;
  if not found then
    raise exception 'store-order commission not found';
  end if;
  if commission_row.status <> 'due' then
    raise exception 'only a due commission can be reversed';
  end if;

  select coalesce(sum(r.amount), 0) into reversed_total
  from public.store_order_commission_reversals r
  where r.commission_id = commission_row.id;
  if reversed_total + reversal_amount > commission_row.commission_amount then
    raise exception 'commission reversal exceeds the remaining commission amount';
  end if;

  insert into public.store_order_commission_reversals(
    commission_id, merchant_id, currency, amount, idempotency_key, reason, reversed_by
  ) values (
    commission_row.id, commission_row.merchant_id, commission_row.currency,
    reversal_amount, reversal_idempotency_key, normalized_reason, auth.uid()
  ) returning id into reversal_id_value;

  insert into public.merchant_ledger_entries(
    merchant_id, currency, effect, source_type, source_id, amount
  ) values (
    commission_row.merchant_id, commission_row.currency, 'decrease_exposure',
    'commission_reversal', reversal_id_value, reversal_amount
  );

  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    commission_row.merchant_id, auth.uid(), 'store_order_commission_reversed',
    normalized_reason,
    jsonb_build_object(
      'commission_id', commission_row.id,
      'reversed_total_before', reversed_total
    ),
    jsonb_build_object(
      'commission_id', commission_row.id,
      'reversal_id', reversal_id_value,
      'reversal_amount', reversal_amount,
      'reversed_total_after', reversed_total + reversal_amount
    )
  );

  return reversal_id_value;
end;
$$;

-- Keep the financial position's commission figure net of append-only
-- corrections. Exposure remains ledger-derived and therefore is not counted
-- twice with the due-commission figure.
create or replace view public.merchant_financial_positions
with (security_barrier = true, security_invoker = true)
as
with currency_keys as (
  select merchant_id, currency from public.subscription_invoices
  union
  select merchant_id, currency from public.subscription_payments
  union
  select merchant_id, currency from public.merchant_ledger_entries
  union
  select merchant_id, currency from public.store_order_commissions
  union
  select merchant_id, currency from public.merchant_credit_limits
), invoice_totals as (
  select i.merchant_id, i.currency,
    coalesce(sum(i.total_amount) filter (where i.status <> 'void'), 0) as invoice_total,
    coalesce(sum(allocated.amount) filter (where i.status <> 'void'), 0) as invoice_allocated
  from public.subscription_invoices i
  left join lateral (
    select coalesce(sum(a.amount), 0) as amount
    from public.invoice_payment_allocations a
    where a.invoice_id = i.id
  ) allocated on true
  group by i.merchant_id, i.currency
), payment_totals as (
  select p.merchant_id, p.currency, coalesce(sum(p.amount), 0) as payments_recorded
  from public.subscription_payments p
  group by p.merchant_id, p.currency
), ledger_totals as (
  select e.merchant_id, e.currency,
    coalesce(sum(case when e.effect = 'increase_exposure' then e.amount else -e.amount end), 0)
      as booked_exposure
  from public.merchant_ledger_entries e
  group by e.merchant_id, e.currency
), reversal_totals as (
  select r.commission_id, coalesce(sum(r.amount), 0) as reversed_amount
  from public.store_order_commission_reversals r
  group by r.commission_id
), commission_totals as (
  select c.merchant_id, c.currency,
    coalesce(sum(c.commission_amount - coalesce(r.reversed_amount, 0)) filter (
      where c.status = 'due'
    ), 0) as commissions_due,
    coalesce(sum(c.commission_amount - coalesce(r.reversed_amount, 0)) filter (
      where c.status = 'due'
        and not exists (
          select 1 from public.merchant_ledger_entries e
          where e.source_type = 'store_order_commission' and e.source_id = c.id
        )
    ), 0) as unbooked_commissions_due
  from public.store_order_commissions c
  left join reversal_totals r on r.commission_id = c.id
  group by c.merchant_id, c.currency
)
select k.merchant_id, k.currency,
  coalesce(i.invoice_total, 0)::numeric(14,2) as invoices_total,
  coalesce(i.invoice_allocated, 0)::numeric(14,2) as payments_allocated,
  greatest(coalesce(i.invoice_total, 0) - coalesce(i.invoice_allocated, 0), 0)::numeric(14,2)
    as invoice_outstanding,
  coalesce(p.payments_recorded, 0)::numeric(14,2) as payments_recorded,
  greatest(coalesce(p.payments_recorded, 0) - coalesce(i.invoice_allocated, 0), 0)::numeric(14,2)
    as unapplied_payment_balance,
  coalesce(c.commissions_due, 0)::numeric(14,2) as commissions_due,
  coalesce(l.booked_exposure, 0)::numeric(14,2) as booked_exposure,
  (coalesce(l.booked_exposure, 0) + coalesce(c.unbooked_commissions_due, 0))::numeric(14,2)
    as effective_exposure,
  coalesce(cl.credit_enabled, false) as credit_enabled,
  coalesce(cl.credit_limit, 0)::numeric(14,2) as credit_limit,
  case when coalesce(cl.credit_enabled, false)
    then greatest(coalesce(l.booked_exposure, 0) + coalesce(c.unbooked_commissions_due, 0), 0)::numeric(14,2)
    else 0::numeric(14,2)
  end as credit_used,
  case when coalesce(cl.credit_enabled, false)
    then greatest(
      coalesce(cl.credit_limit, 0) - greatest(
        coalesce(l.booked_exposure, 0) + coalesce(c.unbooked_commissions_due, 0), 0
      ),
      0
    )::numeric(14,2)
    else 0::numeric(14,2)
  end as credit_available
from currency_keys k
left join invoice_totals i on i.merchant_id = k.merchant_id and i.currency = k.currency
left join payment_totals p on p.merchant_id = k.merchant_id and p.currency = k.currency
left join ledger_totals l on l.merchant_id = k.merchant_id and l.currency = k.currency
left join commission_totals c on c.merchant_id = k.merchant_id and c.currency = k.currency
left join public.merchant_credit_limits cl
  on cl.merchant_id = k.merchant_id and cl.currency = k.currency;

revoke all on function public.snapshot_store_order_commission_after_totals() from public, anon, authenticated;
revoke all on function public.apply_store_order_commission_status_change() from public, anon, authenticated;
revoke all on function public.accrue_store_order_commission(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.snapshot_plan_change_commission_rate() from public, anon, authenticated;
revoke all on function public.snapshot_subscription_commission_rate() from public, anon, authenticated;
revoke all on function public.reconcile_subscription_commission_rate(uuid, numeric, text) from public, anon;
revoke all on function public.reverse_store_order_commission(uuid, numeric, uuid, text) from public, anon;
grant execute on function public.reconcile_subscription_commission_rate(uuid, numeric, text) to authenticated;
grant execute on function public.reverse_store_order_commission(uuid, numeric, uuid, text) to authenticated;

commit;
