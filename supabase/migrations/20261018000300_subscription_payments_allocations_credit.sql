-- Admin-only subscription payment recording, allocation, and credit limits.
-- Requires the financial foundation and merchant-approval migrations.
-- This migration neither backfills financial history nor changes order flows.

begin;

-- A batch makes a later allocation of an unapplied payment idempotent without
-- mutating the original payment or any historical allocation.
create table public.subscription_payment_allocation_batches (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.subscription_payments(id) on delete restrict,
  idempotency_key uuid not null unique,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index subscription_payment_allocation_batches_payment_idx
  on public.subscription_payment_allocation_batches (payment_id, created_at desc);

alter table public.invoice_payment_allocations
  add column allocation_batch_id uuid
    references public.subscription_payment_allocation_batches(id) on delete restrict;
create index invoice_payment_allocations_batch_idx
  on public.invoice_payment_allocations (allocation_batch_id);

alter table public.subscription_payment_allocation_batches enable row level security;
revoke all on table public.subscription_payment_allocation_batches from anon, authenticated;
grant select on table public.subscription_payment_allocation_batches to authenticated;

create policy subscription_payment_allocation_batches_read
  on public.subscription_payment_allocation_batches
  for select to authenticated
  using (public.is_admin() or exists (
    select 1
    from public.subscription_payments p
    join public.merchants m on m.id = p.merchant_id
    where p.id = payment_id and m.owner_user_id = auth.uid()
  ));

-- Applies one batch to one or more invoices. It locks the payment first and
-- invoices in UUID order, so concurrent admin operations serialize cleanly.
create function public.allocate_subscription_payment(
  target_payment uuid,
  allocation_input jsonb,
  allocation_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.subscription_payments%rowtype;
  invoice_row public.subscription_invoices%rowtype;
  allocation_row record;
  batch_id_value uuid;
  existing_batch_count integer;
  requested_count integer;
  distinct_invoice_count integer;
  requested_total numeric(14,2);
  allocated_total numeric(14,2);
  invoice_allocated numeric(14,2);
  allocation_id_value uuid;
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  if allocation_idempotency_key is null then
    raise exception 'allocation idempotency key is required';
  end if;
  if allocation_input is null or jsonb_typeof(allocation_input) <> 'array' then
    raise exception 'allocations must be a JSON array';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(allocation_input) entry
    where jsonb_typeof(entry) <> 'object'
       or not (entry ? 'invoice_id' and entry ? 'amount')
       or exists (
         select 1 from jsonb_object_keys(entry) key
         where key not in ('invoice_id', 'amount')
       )
  ) then
    raise exception 'each allocation must contain only invoice_id and amount';
  end if;

  select count(*), count(distinct entry.invoice_id), coalesce(sum(entry.amount), 0)
    into requested_count, distinct_invoice_count, requested_total
  from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric);

  if requested_count <> distinct_invoice_count then
    raise exception 'an invoice may appear only once in an allocation batch';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric)
    where entry.invoice_id is null
       or entry.amount is null
       or entry.amount <= 0
       or entry.amount::text in ('NaN', 'Infinity', '-Infinity')
       or entry.amount <> trunc(entry.amount, 2)
  ) then
    raise exception 'allocation amounts must be positive finite numbers with at most two decimal places';
  end if;

  select * into payment_row
  from public.subscription_payments p
  where p.id = target_payment
  for update;
  if not found then
    raise exception 'subscription payment not found';
  end if;

  -- A retry may only replay the same payment and allocation set.
  select b.id into batch_id_value
  from public.subscription_payment_allocation_batches b
  where b.idempotency_key = allocation_idempotency_key
  for update;
  if found then
    if (select payment_id from public.subscription_payment_allocation_batches where id = batch_id_value)
       <> target_payment then
      raise exception 'allocation idempotency key belongs to another payment';
    end if;
    if (select recorded_by from public.subscription_payment_allocation_batches where id = batch_id_value)
       <> auth.uid() then
      raise exception 'allocation idempotency key belongs to another administrator';
    end if;
    select count(*) into existing_batch_count
    from public.invoice_payment_allocations a
    where a.allocation_batch_id = batch_id_value;
    if existing_batch_count <> requested_count
       or exists (
         select 1 from (
           (select entry.invoice_id, entry.amount
            from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric)
            except
            select a.invoice_id, a.amount
            from public.invoice_payment_allocations a
            where a.allocation_batch_id = batch_id_value)
           union all
           (select a.invoice_id, a.amount
            from public.invoice_payment_allocations a
            where a.allocation_batch_id = batch_id_value
            except
            select entry.invoice_id, entry.amount
            from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric))
         ) mismatched_allocation
       ) then
      raise exception 'allocation idempotency key was reused with different allocations';
    end if;
    return batch_id_value;
  end if;

  -- This aggregate is protected by the payment row lock above. The existing
  -- allocation trigger also locks the same row as defense in depth.
  select coalesce(sum(a.amount), 0) into allocated_total
  from public.invoice_payment_allocations a
  where a.payment_id = target_payment;
  if allocated_total + requested_total > payment_row.amount then
    raise exception 'allocation exceeds the remaining payment amount';
  end if;

  -- Lock and validate targets before inserting. Ordering prevents two batches
  -- from taking their invoice locks in opposite directions.
  for allocation_row in
    select entry.invoice_id, entry.amount
    from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric)
    order by entry.invoice_id
  loop
    select * into invoice_row
    from public.subscription_invoices i
    where i.id = allocation_row.invoice_id
    for update;
    if not found then
      raise exception 'subscription invoice not found';
    end if;
    if invoice_row.merchant_id <> payment_row.merchant_id
       or invoice_row.currency <> payment_row.currency then
      raise exception 'invoice and payment must belong to the same merchant and currency';
    end if;
    if invoice_row.status = 'void' then
      raise exception 'a void invoice cannot receive an allocation';
    end if;
    select coalesce(sum(a.amount), 0) into invoice_allocated
    from public.invoice_payment_allocations a
    where a.invoice_id = invoice_row.id;
    if invoice_allocated + allocation_row.amount > invoice_row.total_amount then
      raise exception 'allocation exceeds the remaining invoice amount';
    end if;
  end loop;

  insert into public.subscription_payment_allocation_batches(
    payment_id, idempotency_key, recorded_by
  ) values (
    target_payment, allocation_idempotency_key, auth.uid()
  ) returning id into batch_id_value;

  for allocation_row in
    select entry.invoice_id, entry.amount
    from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric)
    order by entry.invoice_id
  loop
    insert into public.invoice_payment_allocations(
      invoice_id, payment_id, amount, allocation_batch_id
    ) values (
      allocation_row.invoice_id, target_payment, allocation_row.amount, batch_id_value
    ) returning id into allocation_id_value;

    -- Exposure falls only when money is applied to a real invoice.
    insert into public.merchant_ledger_entries(
      merchant_id, currency, effect, source_type, source_id, amount
    ) values (
      payment_row.merchant_id, payment_row.currency, 'decrease_exposure',
      'payment_allocation', allocation_id_value, allocation_row.amount
    );
  end loop;

  update public.subscription_invoices i
  set status = case
    when totals.allocated_amount = 0 then 'open'
    when totals.allocated_amount >= i.total_amount then 'paid'
    else 'partially_paid'
  end
  from (
    select a.invoice_id, coalesce(sum(a.amount), 0) as allocated_amount
    from public.invoice_payment_allocations a
    where a.invoice_id in (
      select entry.invoice_id
      from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric)
    )
    group by a.invoice_id
  ) totals
  where i.id = totals.invoice_id;

  if requested_count > 0 then
    insert into public.merchant_financial_audit_events(
      merchant_id, actor_id, event_type, reason, after_data
    ) values (
      payment_row.merchant_id, auth.uid(), 'subscription_payment_allocated',
      'payment allocation batch',
      jsonb_build_object(
        'payment_id', target_payment,
        'allocation_batch_id', batch_id_value,
        'allocated_amount', requested_total,
        'currency', payment_row.currency
      )
    );
  end if;

  return batch_id_value;
end;
$$;

create function public.record_subscription_payment(
  target_merchant uuid,
  payment_currency public.currency_code,
  payment_amount numeric,
  payment_method text,
  payment_idempotency_key uuid,
  allocation_input jsonb default '[]'::jsonb,
  payment_external_reference text default null,
  payment_received_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.subscription_payments%rowtype;
  payment_id_value uuid;
  allocated_amount numeric(14,2);
  allocation_batch_id_value uuid;
  initial_allocation_idempotency_key uuid;
  initial_allocation_hash text;
  payment_was_created boolean := false;
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  if payment_idempotency_key is null then
    raise exception 'payment idempotency key is required';
  end if;
  if payment_currency::text not in ('SYP', 'USD') then
    raise exception 'subscription payments support SYP and USD only';
  end if;
  if payment_amount is null
     or payment_amount <= 0
     or payment_amount::text in ('NaN', 'Infinity', '-Infinity')
     or payment_amount <> trunc(payment_amount, 2) then
    raise exception 'payment amount must be a positive finite number with at most two decimal places';
  end if;
  if payment_method not in ('cash', 'external_transfer') then
    raise exception 'unsupported subscription payment method';
  end if;
  if allocation_input is null or jsonb_typeof(allocation_input) <> 'array' then
    raise exception 'allocations must be a JSON array';
  end if;
  if not exists (select 1 from public.merchants m where m.id = target_merchant) then
    raise exception 'merchant not found';
  end if;

  -- A payment key and its initial allocation-batch key are deliberately
  -- separate namespaces. The MD5-derived UUID is deterministic for retries,
  -- while later allocations must provide their own independent UUID keys.
  initial_allocation_hash := md5(
    'tasawuq:subscription-payment:initial-allocation:' || payment_idempotency_key::text
  );
  initial_allocation_idempotency_key := (
    substr(initial_allocation_hash, 1, 8)
    || '-' || substr(initial_allocation_hash, 9, 4)
    || '-' || substr(initial_allocation_hash, 13, 4)
    || '-' || substr(initial_allocation_hash, 17, 4)
    || '-' || substr(initial_allocation_hash, 21, 12)
  )::uuid;

  insert into public.subscription_payments(
    merchant_id, currency, amount, method, external_reference,
    idempotency_key, received_at, recorded_by
  ) values (
    target_merchant, payment_currency, payment_amount, payment_method,
    nullif(trim(payment_external_reference), ''), payment_idempotency_key,
    coalesce(payment_received_at, now()), auth.uid()
  )
  on conflict (idempotency_key) do nothing
  returning id into payment_id_value;

  if payment_id_value is null then
    select * into payment_row
    from public.subscription_payments p
    where p.idempotency_key = payment_idempotency_key
    for update;
    if payment_row.merchant_id <> target_merchant
       or payment_row.currency <> payment_currency
       or payment_row.amount <> payment_amount
       or payment_row.method <> payment_method
       or payment_row.external_reference is distinct from nullif(trim(payment_external_reference), '')
       or payment_row.recorded_by <> auth.uid()
       or (payment_received_at is not null and payment_row.received_at <> payment_received_at) then
      raise exception 'payment idempotency key was reused with different payment details';
    end if;
    payment_id_value := payment_row.id;
  else
    payment_was_created := true;
    select * into payment_row from public.subscription_payments where id = payment_id_value;
  end if;

  -- Always create or validate the initial allocation batch. Empty input records
  -- a durable, idempotent decision to leave the payment unapplied for now.
  select public.allocate_subscription_payment(
    payment_id_value, allocation_input, initial_allocation_idempotency_key
  ) into allocation_batch_id_value;

  if payment_was_created then
    select coalesce(sum(a.amount), 0) into allocated_amount
    from public.invoice_payment_allocations a
    where a.allocation_batch_id = allocation_batch_id_value;

    insert into public.merchant_financial_audit_events(
      merchant_id, actor_id, event_type, reason, after_data
    ) values (
      target_merchant, auth.uid(), 'subscription_payment_recorded',
      'administrator recorded subscription payment',
      jsonb_build_object(
        'payment_id', payment_id_value,
        'currency', payment_currency,
        'amount', payment_amount,
        'allocated_amount', allocated_amount,
        'unallocated_amount', payment_amount - allocated_amount,
        'method', payment_method
      )
    );
  end if;

  return payment_id_value;
end;
$$;

create function public.set_merchant_credit_limit(
  target_merchant uuid,
  credit_currency public.currency_code,
  credit_is_enabled boolean,
  credit_amount numeric,
  change_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_value jsonb;
  after_value jsonb;
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  if credit_currency::text not in ('SYP', 'USD') then
    raise exception 'merchant credit supports SYP and USD only';
  end if;
  if credit_amount is null
     or credit_amount < 0
     or credit_amount::text in ('NaN', 'Infinity', '-Infinity')
     or credit_amount <> trunc(credit_amount, 2) then
    raise exception 'credit limit must be a non-negative finite number with at most two decimal places';
  end if;
  if not exists (select 1 from public.merchants m where m.id = target_merchant) then
    raise exception 'merchant not found';
  end if;

  select to_jsonb(l) into before_value
  from public.merchant_credit_limits l
  where l.merchant_id = target_merchant and l.currency = credit_currency
  for update;

  insert into public.merchant_credit_limits(
    merchant_id, currency, credit_enabled, credit_limit, updated_by, updated_at
  ) values (
    target_merchant, credit_currency, credit_is_enabled, credit_amount, auth.uid(), now()
  )
  on conflict (merchant_id, currency) do update
  set credit_enabled = excluded.credit_enabled,
      credit_limit = excluded.credit_limit,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  select to_jsonb(l) into after_value
  from public.merchant_credit_limits l
  where l.merchant_id = target_merchant and l.currency = credit_currency;

  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    target_merchant, auth.uid(), 'merchant_credit_limit_updated',
    nullif(trim(change_reason), ''), before_value, after_value
  );
end;
$$;

-- Invoice balances remain an independent reconciliation figure. The ledger is
-- the booked exposure source of truth, so this view never adds the same invoice
-- debt and ledger increase together. A due commission not yet represented by a
-- ledger entry is added once as unbooked exposure.
create view public.merchant_financial_positions
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
), commission_totals as (
  select c.merchant_id, c.currency,
    coalesce(sum(c.commission_amount) filter (where c.status = 'due'), 0) as commissions_due,
    coalesce(sum(c.commission_amount) filter (
      where c.status = 'due'
        and not exists (
          select 1 from public.merchant_ledger_entries e
          where e.source_type = 'store_order_commission' and e.source_id = c.id
        )
    ), 0) as unbooked_commissions_due
  from public.store_order_commissions c
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

grant select on public.merchant_financial_positions to authenticated;

revoke all on function public.allocate_subscription_payment(uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.record_subscription_payment(
  uuid, public.currency_code, numeric, text, uuid, jsonb, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.set_merchant_credit_limit(
  uuid, public.currency_code, boolean, numeric, text
) from public, anon, authenticated;
grant execute on function public.allocate_subscription_payment(uuid, jsonb, uuid) to authenticated;
grant execute on function public.record_subscription_payment(
  uuid, public.currency_code, numeric, text, uuid, jsonb, text, timestamptz
) to authenticated;
grant execute on function public.set_merchant_credit_limit(
  uuid, public.currency_code, boolean, numeric, text
) to authenticated;

commit;
