-- Merchant sales settlements. These records settle delivered-order
-- entitlements only; they never alter subscription exposure or its ledger.
begin;

create table public.merchant_settlement_batches (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  currency public.currency_code not null,
  status text not null default 'open' check (status in ('open', 'completed')),
  period_starts_at timestamptz,
  period_ends_at timestamptz,
  idempotency_key uuid not null unique,
  note text not null default '' check (char_length(note) <= 1500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete restrict,
  check (period_ends_at is null or period_starts_at is null or period_ends_at >= period_starts_at)
);
create index merchant_settlement_batches_merchant_idx on public.merchant_settlement_batches (merchant_id, currency, status, created_at desc);

create table public.merchant_settlement_batch_entitlements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.merchant_settlement_batches(id) on delete restrict,
  merchant_order_entitlement_id uuid not null references public.merchant_order_entitlements(id) on delete restrict,
  amount_snapshot numeric(14,2) not null check (amount_snapshot >= 0),
  created_at timestamptz not null default now(),
  unique (batch_id, merchant_order_entitlement_id)
);
create index merchant_settlement_batch_entitlements_batch_idx on public.merchant_settlement_batch_entitlements (batch_id);

create table public.merchant_settlement_payments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.merchant_settlement_batches(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  currency public.currency_code not null,
  amount numeric(14,2) not null check (amount > 0),
  idempotency_key uuid not null unique,
  external_reference text check (external_reference is null or char_length(trim(external_reference)) between 1 and 250),
  note text not null default '' check (char_length(note) <= 1500),
  paid_by uuid not null references public.profiles(id) on delete restrict,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index merchant_settlement_payments_batch_idx on public.merchant_settlement_payments (batch_id, paid_at desc);

create table public.merchant_settlement_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.merchant_settlement_payments(id) on delete restrict,
  batch_entitlement_id uuid not null references public.merchant_settlement_batch_entitlements(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, batch_entitlement_id)
);
create index merchant_settlement_payment_allocations_entitlement_idx on public.merchant_settlement_payment_allocations (batch_entitlement_id);

create view public.merchant_settlement_batch_positions
with (security_barrier = true, security_invoker = true)
as
select
  b.id as batch_id, b.merchant_id, b.currency, b.status, b.created_at,
  be.id as batch_entitlement_id, be.merchant_order_entitlement_id,
  p.store_order_id, p.delivered_at,
  be.amount_snapshot as current_entitlement_amount,
  coalesce(sum(a.amount), 0)::numeric(14,2) as paid_amount,
  greatest(be.amount_snapshot - coalesce(sum(a.amount), 0), 0)::numeric(14,2) as remaining_amount
from public.merchant_settlement_batches b
join public.merchant_settlement_batch_entitlements be on be.batch_id = b.id
join public.merchant_order_entitlement_positions p on p.merchant_order_entitlement_id = be.merchant_order_entitlement_id
left join public.merchant_settlement_payment_allocations a on a.batch_entitlement_id = be.id
group by b.id, be.id, p.merchant_order_entitlement_id, p.store_order_id, p.delivered_at, be.amount_snapshot;

create function public.create_merchant_settlement_batch(
  target_merchant uuid, target_currency public.currency_code, entitlement_ids uuid[],
  batch_idempotency_key uuid, period_start_value timestamptz default null,
  period_end_value timestamptz default null, batch_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare batch_id_value uuid; normalized_note text := coalesce(nullif(trim(batch_note), ''), ''); existing_row public.merchant_settlement_batches%rowtype; expected_count integer;
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if batch_idempotency_key is null or cardinality(entitlement_ids) is null or cardinality(entitlement_ids) = 0 then raise exception 'a batch key and at least one entitlement are required'; end if;
  if cardinality(entitlement_ids) <> cardinality(array(select distinct unnest(entitlement_ids))) then raise exception 'duplicate entitlement selected'; end if;
  if char_length(normalized_note) > 1500 then raise exception 'settlement note is too long'; end if;
  select * into existing_row from public.merchant_settlement_batches where idempotency_key = batch_idempotency_key for update;
  if found then
    if existing_row.merchant_id <> target_merchant or existing_row.currency <> target_currency then raise exception 'settlement idempotency key was reused with different details'; end if;
    return existing_row.id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_merchant::text || ':' || target_currency::text, 0));
  select count(*) into expected_count from public.merchant_order_entitlement_positions p
  where p.merchant_id = target_merchant and p.currency = target_currency and p.status = 'pending_settlement'
    and p.merchant_order_entitlement_id = any(entitlement_ids)
    and p.current_entitlement_amount > coalesce((
      select sum(a.amount) from public.merchant_settlement_payment_allocations a
      join public.merchant_settlement_batch_entitlements be on be.id = a.batch_entitlement_id
      where be.merchant_order_entitlement_id = p.merchant_order_entitlement_id
    ), 0) + coalesce((
      select sum(be.amount_snapshot) from public.merchant_settlement_batch_entitlements be
      join public.merchant_settlement_batches b on b.id = be.batch_id
      where be.merchant_order_entitlement_id = p.merchant_order_entitlement_id and b.status = 'open'
    ), 0);
  if expected_count <> cardinality(entitlement_ids) then raise exception 'one or more entitlements are unavailable for settlement'; end if;
  insert into public.merchant_settlement_batches(merchant_id,currency,idempotency_key,period_starts_at,period_ends_at,note,created_by)
  values(target_merchant,target_currency,batch_idempotency_key,period_start_value,period_end_value,normalized_note,auth.uid()) returning id into batch_id_value;
  insert into public.merchant_settlement_batch_entitlements(batch_id,merchant_order_entitlement_id,amount_snapshot)
  select batch_id_value,p.merchant_order_entitlement_id,
    p.current_entitlement_amount - coalesce((select sum(a.amount) from public.merchant_settlement_payment_allocations a join public.merchant_settlement_batch_entitlements be on be.id = a.batch_entitlement_id where be.merchant_order_entitlement_id = p.merchant_order_entitlement_id), 0)
      - coalesce((select sum(be.amount_snapshot) from public.merchant_settlement_batch_entitlements be join public.merchant_settlement_batches b on b.id = be.batch_id where be.merchant_order_entitlement_id = p.merchant_order_entitlement_id and b.status = 'open'), 0)
  from public.merchant_order_entitlement_positions p where p.merchant_order_entitlement_id = any(entitlement_ids);
  return batch_id_value;
end;
$$;

create function public.record_merchant_settlement_payment(
  target_batch uuid, payment_amount numeric, payment_allocations jsonb, payment_idempotency_key uuid,
  payment_reference text default null, payment_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare batch_row public.merchant_settlement_batches%rowtype; payment_id_value uuid; existing_row public.merchant_settlement_payments%rowtype; normalized_note text := coalesce(nullif(trim(payment_note), ''), ''); normalized_reference text := nullif(trim(payment_reference), ''); allocated_total numeric(14,2); allocation record; remaining_value numeric(14,2); has_remaining boolean;
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if payment_amount is null or payment_amount::text in ('NaN','Infinity','-Infinity') or payment_amount <= 0 or payment_amount <> round(payment_amount,2) then raise exception 'payment amount must be positive with at most two decimal places'; end if;
  if payment_idempotency_key is null or jsonb_typeof(payment_allocations) <> 'array' or jsonb_array_length(payment_allocations) = 0 then raise exception 'a payment key and allocations are required'; end if;
  if char_length(normalized_note) > 1500 or (normalized_reference is not null and char_length(normalized_reference) > 250) then raise exception 'payment note or reference is too long'; end if;
  select * into existing_row from public.merchant_settlement_payments where idempotency_key = payment_idempotency_key for update;
  if found then
    if existing_row.batch_id <> target_batch or existing_row.amount <> payment_amount or existing_row.external_reference is distinct from normalized_reference or existing_row.note <> normalized_note then raise exception 'payment idempotency key was reused with different details'; end if;
    return existing_row.id;
  end if;
  select * into batch_row from public.merchant_settlement_batches where id = target_batch for update;
  if not found or batch_row.status <> 'open' then raise exception 'open settlement batch not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(batch_row.merchant_id::text || ':' || batch_row.currency::text, 0));
  select coalesce(sum((item->>'amount')::numeric),0) into allocated_total from jsonb_array_elements(payment_allocations) item;
  if allocated_total <> payment_amount then raise exception 'payment allocations must equal the payment amount'; end if;
  if (select count(*) from (select distinct item->>'batch_entitlement_id' from jsonb_array_elements(payment_allocations) item) unique_allocations) <> jsonb_array_length(payment_allocations) then raise exception 'duplicate payment allocation selected'; end if;
  for allocation in select (item->>'batch_entitlement_id')::uuid as batch_entitlement_id, (item->>'amount')::numeric as amount from jsonb_array_elements(payment_allocations) item loop
    if allocation.amount <= 0 or allocation.amount <> round(allocation.amount,2) then raise exception 'allocation amount is invalid'; end if;
    select p.remaining_amount into remaining_value from public.merchant_settlement_batch_positions p where p.batch_entitlement_id = allocation.batch_entitlement_id and p.batch_id = batch_row.id;
    if remaining_value is null or allocation.amount > remaining_value then raise exception 'payment allocation exceeds the remaining entitlement'; end if;
  end loop;
  insert into public.merchant_settlement_payments(batch_id,merchant_id,currency,amount,idempotency_key,external_reference,note,paid_by)
  values(batch_row.id,batch_row.merchant_id,batch_row.currency,payment_amount,payment_idempotency_key,normalized_reference,normalized_note,auth.uid()) returning id into payment_id_value;
  insert into public.merchant_settlement_payment_allocations(payment_id,batch_entitlement_id,amount)
  select payment_id_value,(item->>'batch_entitlement_id')::uuid,(item->>'amount')::numeric from jsonb_array_elements(payment_allocations) item;
  select exists(select 1 from public.merchant_settlement_batch_positions p where p.batch_id = batch_row.id and p.remaining_amount > 0) into has_remaining;
  if not has_remaining then update public.merchant_settlement_batches set status = 'completed', completed_at = now(), completed_by = auth.uid() where id = batch_row.id; end if;
  return payment_id_value;
end;
$$;

alter table public.merchant_settlement_batches enable row level security;
alter table public.merchant_settlement_batch_entitlements enable row level security;
alter table public.merchant_settlement_payments enable row level security;
alter table public.merchant_settlement_payment_allocations enable row level security;
revoke all on table public.merchant_settlement_batches, public.merchant_settlement_batch_entitlements, public.merchant_settlement_payments, public.merchant_settlement_payment_allocations, public.merchant_settlement_batch_positions from anon, authenticated;
grant select on table public.merchant_settlement_batches, public.merchant_settlement_batch_entitlements, public.merchant_settlement_payments, public.merchant_settlement_payment_allocations, public.merchant_settlement_batch_positions to authenticated;
create policy merchant_settlement_batches_read on public.merchant_settlement_batches for select to authenticated using (public.is_admin() or exists(select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()));
create policy merchant_settlement_batch_entitlements_read on public.merchant_settlement_batch_entitlements for select to authenticated using (public.is_admin() or exists(select 1 from public.merchant_settlement_batches b join public.merchants m on m.id = b.merchant_id where b.id = batch_id and m.owner_user_id = auth.uid()));
create policy merchant_settlement_payments_read on public.merchant_settlement_payments for select to authenticated using (public.is_admin() or exists(select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()));
create policy merchant_settlement_payment_allocations_read on public.merchant_settlement_payment_allocations for select to authenticated using (public.is_admin() or exists(select 1 from public.merchant_settlement_payments p join public.merchants m on m.id = p.merchant_id where p.id = payment_id and m.owner_user_id = auth.uid()));
revoke all on function public.create_merchant_settlement_batch(uuid,public.currency_code,uuid[],uuid,timestamptz,timestamptz,text) from public, anon;
revoke all on function public.record_merchant_settlement_payment(uuid,numeric,jsonb,uuid,text,text) from public, anon;
grant execute on function public.create_merchant_settlement_batch(uuid,public.currency_code,uuid[],uuid,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.record_merchant_settlement_payment(uuid,numeric,jsonb,uuid,text,text) to authenticated;
commit;
