-- Commission terms and store invoices for deferred merchant settlement.
-- Product inventory remains availability-only; this migration adds no stock quantities.

alter table public.subscription_plans
  add column commission_rate numeric(5,2) not null default 0
    check (commission_rate >= 0 and commission_rate <= 100);

alter table public.merchant_subscriptions
  add column commission_rate_override numeric(5,2)
    check (commission_rate_override is null or (commission_rate_override >= 0 and commission_rate_override <= 100)),
  add column commission_rate_snapshot numeric(5,2) not null default 0
    check (commission_rate_snapshot >= 0 and commission_rate_snapshot <= 100);

create type public.merchant_invoice_status as enum (
  'pending', 'payable', 'partially_settled', 'settled', 'void'
);
create type public.cash_collection_source as enum ('platform', 'driver');
create type public.merchant_settlement_method as enum ('cash', 'bank_transfer', 'other');

create table public.merchant_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number bigint generated always as identity unique,
  order_number bigint not null,
  sub_order_id uuid not null unique references public.sub_orders(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  currency public.currency_code not null,
  items_subtotal numeric(14,2) not null check (items_subtotal >= 0),
  merchant_delivery_fee numeric(14,2) not null default 0 check (merchant_delivery_fee >= 0),
  commission_rate numeric(5,2) not null check (commission_rate >= 0 and commission_rate <= 100),
  commission_amount numeric(14,2) not null check (commission_amount >= 0),
  merchant_net_amount numeric(14,2) not null check (merchant_net_amount >= 0),
  settled_amount numeric(14,2) not null default 0 check (settled_amount >= 0),
  status public.merchant_invoice_status not null default 'pending',
  cash_collected boolean not null default false,
  created_at timestamptz not null default now(),
  issued_at timestamptz,
  updated_at timestamptz not null default now(),
  check (commission_amount <= items_subtotal),
  check (settled_amount <= merchant_net_amount),
  check (round(items_subtotal * commission_rate / 100, 2) = commission_amount),
  check (items_subtotal + merchant_delivery_fee - commission_amount = merchant_net_amount)
);

create index merchant_invoices_account_idx
  on public.merchant_invoices(merchant_id, currency, status, created_at desc);
create index merchant_invoices_store_idx
  on public.merchant_invoices(store_id, created_at desc);
create trigger merchant_invoices_updated_at
  before update on public.merchant_invoices
  for each row execute function public.set_updated_at();

alter table public.merchant_invoices enable row level security;
create policy merchant_invoices_participant_read
  on public.merchant_invoices for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.merchant_members mm
      where mm.merchant_id = merchant_invoices.merchant_id
        and mm.user_id = auth.uid()
    )
  );

grant select on public.merchant_invoices to authenticated;
grant usage, select on sequence public.merchant_invoices_invoice_number_seq to authenticated;

create or replace function public.create_merchant_invoice_for_sub_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  merchant_id_value uuid;
  order_number_value bigint;
  commission_rate_value numeric(5,2) := 0;
  commission_amount_value numeric(14,2);
  merchant_delivery_fee_value numeric(14,2) := 0;
begin
  select s.merchant_id, o.order_number into merchant_id_value, order_number_value
  from public.stores s
  join public.orders o on o.id = new.order_id
  where s.id = new.store_id;
  if merchant_id_value is null or order_number_value is null then raise exception 'store merchant or parent order not found'; end if;

  select coalesce(ms.commission_rate_override, ms.commission_rate_snapshot)
  into commission_rate_value
  from public.merchant_subscriptions ms
  where ms.merchant_id = merchant_id_value
    and ms.status = 'active'
    and (ms.starts_at is null or ms.starts_at <= now())
    and (ms.expires_at is null or ms.expires_at > now())
  order by ms.created_at desc
  limit 1;
  commission_rate_value := coalesce(commission_rate_value, 0);
  commission_amount_value := round(new.subtotal * commission_rate_value / 100, 2);
  if new.store_delivery_enabled then
    merchant_delivery_fee_value := new.delivery_fee;
  end if;

  insert into public.merchant_invoices (
    order_number, sub_order_id, merchant_id, store_id, currency, items_subtotal,
    merchant_delivery_fee, commission_rate, commission_amount,
    merchant_net_amount, status
  ) values (
    order_number_value, new.id, merchant_id_value, new.store_id, new.currency, new.subtotal,
    merchant_delivery_fee_value, commission_rate_value, commission_amount_value,
    new.subtotal + merchant_delivery_fee_value - commission_amount_value, 'pending'
  );
  return new;
end;
$$;
revoke all on function public.create_merchant_invoice_for_sub_order() from public, anon, authenticated;

create trigger create_merchant_invoice_after_sub_order
  after insert on public.sub_orders
  for each row execute function public.create_merchant_invoice_for_sub_order();

create or replace function public.sync_merchant_invoice_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'delivered' and old.status is distinct from new.status then
    update public.merchant_invoices
    set status = case
          when settled_amount >= merchant_net_amount then 'settled'::public.merchant_invoice_status
          else 'payable'::public.merchant_invoice_status
        end,
        issued_at = coalesce(issued_at, now())
    where sub_order_id = new.id and status = 'pending';
  elsif new.status = 'cancelled' and old.status is distinct from new.status then
    update public.merchant_invoices
    set status = 'void'
    where sub_order_id = new.id and status = 'pending' and settled_amount = 0;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_merchant_invoice_status() from public, anon, authenticated;

create trigger sync_merchant_invoice_after_sub_order_status
  after update of status on public.sub_orders
  for each row execute function public.sync_merchant_invoice_status();

create or replace function public.recalculate_order_after_store_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_store_count integer;
  remaining_subtotal numeric(14,2);
  store_delivery_enabled boolean;
  merchant_delivery_fee_total numeric(14,2);
  parent_order public.orders%rowtype;
  next_delivery_fee numeric(14,2);
begin
  if new.status <> 'cancelled' or old.status is not distinct from new.status then return new; end if;

  select * into parent_order from public.orders where id = new.order_id for update;
  if not found then return new; end if;
  select count(*) filter (where so.status <> 'cancelled'),
         coalesce(sum(so.subtotal) filter (where so.status <> 'cancelled'), 0),
         coalesce(bool_or(so.store_delivery_enabled) filter (where so.status <> 'cancelled'), false),
         coalesce(sum(so.delivery_fee) filter (where so.status <> 'cancelled' and so.store_delivery_enabled), 0)
  into active_store_count, remaining_subtotal, store_delivery_enabled, merchant_delivery_fee_total
  from public.sub_orders so where so.order_id = new.order_id;

  if active_store_count = 0 then
    next_delivery_fee := 0;
  elsif store_delivery_enabled then
    next_delivery_fee := merchant_delivery_fee_total;
  else
    -- A multi-store checkout keeps its platform zone fee while any branch remains.
    next_delivery_fee := parent_order.delivery_fee;
  end if;

  update public.orders
  set subtotal = remaining_subtotal,
      delivery_fee = next_delivery_fee,
      total = remaining_subtotal + next_delivery_fee
  where id = new.order_id;
  update public.payments
  set amount = remaining_subtotal + next_delivery_fee
  where order_id = new.order_id and status = 'pending';
  return new;
end;
$$;
revoke all on function public.recalculate_order_after_store_cancellation() from public, anon, authenticated;
create trigger recalculate_order_after_sub_order_cancellation
  after update of status on public.sub_orders
  for each row execute function public.recalculate_order_after_store_cancellation();

create trigger audit_merchant_invoices
  after insert or update or delete on public.merchant_invoices
  for each row execute function public.write_audit_log();

-- Customer cash is recorded as it reaches the platform from a driver or direct collection.
create table public.cash_collections (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency public.currency_code not null,
  source public.cash_collection_source not null,
  driver_id uuid references public.drivers(id) on delete set null,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  note text not null default '',
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((source = 'driver' and driver_id is not null) or (source = 'platform' and driver_id is null))
);
create index cash_collections_order_idx on public.cash_collections(order_id, received_at);
alter table public.cash_collections enable row level security;
create policy cash_collections_admin_read on public.cash_collections
  for select to authenticated using (public.is_admin());
grant select on public.cash_collections to authenticated;
create trigger audit_cash_collections
  after insert or update or delete on public.cash_collections
  for each row execute function public.write_audit_log();

create or replace function public.record_cash_collection(
  target_order uuid,
  received_amount numeric,
  collection_source public.cash_collection_source,
  collecting_driver uuid default null,
  note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  collection_id uuid;
  received_total numeric(14,2);
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if received_amount <= 0 or received_amount <> round(received_amount, 2) then
    raise exception 'received amount must be a positive amount with at most two decimals';
  end if;
  if (collection_source = 'driver' and collecting_driver is null)
     or (collection_source = 'platform' and collecting_driver is not null) then
    raise exception 'collection source and driver do not match';
  end if;
  if collection_source = 'driver' and not exists (
    select 1 from public.drivers d where d.id = collecting_driver and d.approval = 'approved' and d.is_active
  ) then raise exception 'active approved driver required'; end if;

  select * into order_row from public.orders where id = target_order for update;
  if not found or order_row.payment_method <> 'cash' or order_row.status <> 'delivered' then
    raise exception 'eligible cash order not found';
  end if;
  if collection_source = 'driver' and not exists (
    select 1 from public.sub_orders so
    where so.order_id = target_order and so.assigned_driver_id = collecting_driver
  ) then raise exception 'driver is not assigned to this order'; end if;
  if order_row.payment_status = 'paid' then raise exception 'order cash is already fully received'; end if;

  select coalesce(sum(cc.amount), 0)::numeric(14,2) into received_total
  from public.cash_collections cc where cc.order_id = target_order;
  if received_total + received_amount > order_row.total then
    raise exception 'received amount exceeds the remaining order balance';
  end if;

  insert into public.cash_collections(order_id, amount, currency, source, driver_id, recorded_by, note)
  values (target_order, received_amount, order_row.currency, collection_source, collecting_driver, auth.uid(), coalesce(note, ''))
  returning id into collection_id;

  received_total := received_total + received_amount;
  if received_total = order_row.total then
    update public.orders set payment_status = 'paid' where id = target_order;
    update public.payments set status = 'paid' where order_id = target_order and status = 'pending';
    update public.merchant_invoices mi
    set cash_collected = true
    from public.sub_orders so
    where so.id = mi.sub_order_id and so.order_id = target_order and mi.status <> 'void';
  end if;
  return collection_id;
end;
$$;
revoke all on function public.record_cash_collection(uuid,numeric,public.cash_collection_source,uuid,text) from public, anon;
grant execute on function public.record_cash_collection(uuid,numeric,public.cash_collection_source,uuid,text) to authenticated;

-- A merchant settlement is an actual recorded payout. Unpaid invoices stay outstanding
-- and can accumulate until the administrator records a later settlement.
create table public.merchant_settlements (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency public.currency_code not null,
  method public.merchant_settlement_method not null,
  reference text,
  note text not null default '',
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index merchant_settlements_account_idx
  on public.merchant_settlements(merchant_id, currency, paid_at desc);

create table public.merchant_settlement_allocations (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.merchant_settlements(id) on delete restrict,
  invoice_id uuid not null references public.merchant_invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (settlement_id, invoice_id)
);
create index settlement_allocations_invoice_idx on public.merchant_settlement_allocations(invoice_id);

alter table public.merchant_settlements enable row level security;
alter table public.merchant_settlement_allocations enable row level security;
create policy merchant_settlements_participant_read on public.merchant_settlements
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.merchant_members mm
      where mm.merchant_id = merchant_settlements.merchant_id and mm.user_id = auth.uid()
    )
  );
create policy settlement_allocations_participant_read on public.merchant_settlement_allocations
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.merchant_invoices mi
      join public.merchant_members mm on mm.merchant_id = mi.merchant_id
      where mi.id = merchant_settlement_allocations.invoice_id and mm.user_id = auth.uid()
    )
  );
grant select on public.merchant_settlements, public.merchant_settlement_allocations to authenticated;
create trigger audit_merchant_settlements
  after insert or update or delete on public.merchant_settlements
  for each row execute function public.write_audit_log();

create or replace function public.record_merchant_settlement(
  target_merchant uuid,
  target_currency public.currency_code,
  settlement_amount numeric,
  settlement_method_value public.merchant_settlement_method,
  settlement_reference text default null,
  settlement_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  settlement_id_value uuid;
  remaining_amount numeric(14,2);
  allocation_amount numeric(14,2);
  invoice_row record;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if settlement_amount <= 0 or settlement_amount <> round(settlement_amount, 2) then
    raise exception 'settlement amount must be positive with at most two decimals';
  end if;

  insert into public.merchant_settlements(merchant_id, amount, currency, method, reference, note, recorded_by)
  values (target_merchant, settlement_amount, target_currency, settlement_method_value,
    nullif(trim(settlement_reference), ''), coalesce(trim(settlement_note), ''), auth.uid())
  returning id into settlement_id_value;

  remaining_amount := settlement_amount;
  for invoice_row in
    select mi.id, mi.merchant_net_amount - mi.settled_amount as outstanding
    from public.merchant_invoices mi
    join public.sub_orders so on so.id = mi.sub_order_id
    where mi.merchant_id = target_merchant
      and mi.currency = target_currency
      and mi.status in ('payable', 'partially_settled')
      and mi.settled_amount < mi.merchant_net_amount
      and mi.cash_collected
      and so.status = 'delivered'
    order by mi.issued_at nulls last, mi.invoice_number
    for update of mi
  loop
    exit when remaining_amount <= 0;
    allocation_amount := least(remaining_amount, invoice_row.outstanding);
    insert into public.merchant_settlement_allocations(settlement_id, invoice_id, amount)
    values (settlement_id_value, invoice_row.id, allocation_amount);
    update public.merchant_invoices
    set settled_amount = settled_amount + allocation_amount,
        status = case
          when settled_amount + allocation_amount >= merchant_net_amount then 'settled'::public.merchant_invoice_status
          else 'partially_settled'::public.merchant_invoice_status
        end
    where id = invoice_row.id;
    remaining_amount := remaining_amount - allocation_amount;
  end loop;

  if remaining_amount > 0 then
    raise exception 'settlement exceeds collected and payable invoice balances';
  end if;
  return settlement_id_value;
end;
$$;
revoke all on function public.record_merchant_settlement(uuid,public.currency_code,numeric,public.merchant_settlement_method,text,text) from public, anon;
grant execute on function public.record_merchant_settlement(uuid,public.currency_code,numeric,public.merchant_settlement_method,text,text) to authenticated;

create trigger audit_merchant_settlement_allocations
  after insert or update or delete on public.merchant_settlement_allocations
  for each row execute function public.write_audit_log();
