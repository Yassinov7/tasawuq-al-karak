-- Driver cash custody and office confirmations.
-- Customer cash remains separate from merchant exposure and subscription money.

begin;

create table public.driver_cash_remittances (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete restrict,
  currency public.currency_code not null,
  amount numeric(14,2) not null check (amount > 0),
  idempotency_key uuid not null unique,
  external_reference text check (external_reference is null or char_length(trim(external_reference)) between 1 and 250),
  note text not null default '' check (char_length(note) <= 1500),
  received_by uuid not null references public.profiles(id) on delete restrict,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index driver_cash_remittances_driver_idx
  on public.driver_cash_remittances (driver_id, currency, received_at desc);

-- If a driver remits more than the custody due, the surplus is a payable
-- credit to the driver. A later office disbursement consumes that credit;
-- neither record is edited or removed after confirmation.
create table public.driver_cash_credit_payouts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete restrict,
  currency public.currency_code not null,
  amount numeric(14,2) not null check (amount > 0),
  idempotency_key uuid not null unique,
  external_reference text check (external_reference is null or char_length(trim(external_reference)) between 1 and 250),
  note text not null default '' check (char_length(note) <= 1500),
  paid_by uuid not null references public.profiles(id) on delete restrict,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index driver_cash_credit_payouts_driver_idx
  on public.driver_cash_credit_payouts (driver_id, currency, paid_at desc);

-- All values stay per currency. Delivery fees reduce custody only in the
-- currency in which the entitlement was recorded; they never become platform
-- revenue. The view exposes accounting positions, not a bank balance.
create view public.driver_cash_custody_positions
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
  from public.customer_order_cash_obligations
  group by driver_id, currency
), delivery_fees as (
  select driver_id, currency, coalesce(sum(delivery_fee_amount), 0)::numeric(14,2) as amount
  from public.driver_delivery_fee_entitlements
  group by driver_id, currency
), remitted as (
  select driver_id, currency, coalesce(sum(amount), 0)::numeric(14,2) as amount
  from public.driver_cash_remittances
  group by driver_id, currency
), paid_credits as (
  select driver_id, currency, coalesce(sum(amount), 0)::numeric(14,2) as amount
  from public.driver_cash_credit_payouts
  group by driver_id, currency
)
select
  k.driver_id,
  k.currency,
  coalesce(cc.amount, 0)::numeric(14,2) as cash_collected_amount,
  coalesce(df.amount, 0)::numeric(14,2) as delivery_fee_entitled_amount,
  greatest(coalesce(cc.amount, 0) - coalesce(df.amount, 0), 0)::numeric(14,2) as net_custody_due_amount,
  coalesce(r.amount, 0)::numeric(14,2) as office_received_amount,
  greatest(greatest(coalesce(cc.amount, 0) - coalesce(df.amount, 0), 0) - coalesce(r.amount, 0), 0)::numeric(14,2)
    as custody_remaining_amount,
  greatest(coalesce(r.amount, 0) - greatest(coalesce(cc.amount, 0) - coalesce(df.amount, 0), 0) - coalesce(pc.amount, 0), 0)::numeric(14,2)
    as driver_credit_amount,
  coalesce(pc.amount, 0)::numeric(14,2) as driver_credit_paid_amount
from keys k
left join cash_collected cc on cc.driver_id = k.driver_id and cc.currency = k.currency
left join delivery_fees df on df.driver_id = k.driver_id and df.currency = k.currency
left join remitted r on r.driver_id = k.driver_id and r.currency = k.currency
left join paid_credits pc on pc.driver_id = k.driver_id and pc.currency = k.currency;

create function public.record_driver_cash_remittance(
  target_driver uuid,
  remittance_currency public.currency_code,
  remittance_amount numeric,
  remittance_idempotency_key uuid,
  remittance_reference text default null,
  remittance_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_row public.driver_cash_remittances%rowtype;
  remittance_id uuid;
  normalized_reference text := nullif(trim(remittance_reference), '');
  normalized_note text := coalesce(nullif(trim(remittance_note), ''), '');
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if remittance_amount is null or remittance_amount::text in ('NaN', 'Infinity', '-Infinity')
     or remittance_amount <= 0 or remittance_amount <> round(remittance_amount, 2) then
    raise exception 'remittance amount must be positive with at most two decimal places';
  end if;
  if remittance_idempotency_key is null then raise exception 'remittance idempotency key is required'; end if;
  if char_length(normalized_note) > 1500 or (normalized_reference is not null and char_length(normalized_reference) > 250) then
    raise exception 'remittance note or reference is too long';
  end if;

  select * into existing_row from public.driver_cash_remittances
  where idempotency_key = remittance_idempotency_key for update;
  if found then
    if existing_row.driver_id <> target_driver or existing_row.currency <> remittance_currency
       or existing_row.amount <> remittance_amount or existing_row.external_reference is distinct from normalized_reference
       or existing_row.note <> normalized_note then
      raise exception 'remittance idempotency key was reused with different details';
    end if;
    return existing_row.id;
  end if;

  if not exists (select 1 from public.driver_applications da where da.user_id = target_driver and da.status = 'accepted') then
    raise exception 'approved driver account required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_driver::text || ':' || remittance_currency::text, 0));
  insert into public.driver_cash_remittances(
    driver_id, currency, amount, idempotency_key, external_reference, note, received_by
  ) values (
    target_driver, remittance_currency, remittance_amount, remittance_idempotency_key,
    normalized_reference, normalized_note, auth.uid()
  ) returning id into remittance_id;
  return remittance_id;
end;
$$;

create function public.pay_driver_cash_credit(
  target_driver uuid,
  payout_currency public.currency_code,
  payout_amount numeric,
  payout_idempotency_key uuid,
  payout_reference text default null,
  payout_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_row public.driver_cash_credit_payouts%rowtype;
  current_credit numeric(14,2);
  payout_id uuid;
  normalized_reference text := nullif(trim(payout_reference), '');
  normalized_note text := coalesce(nullif(trim(payout_note), ''), '');
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if payout_amount is null or payout_amount::text in ('NaN', 'Infinity', '-Infinity')
     or payout_amount <= 0 or payout_amount <> round(payout_amount, 2) then
    raise exception 'credit payout amount must be positive with at most two decimal places';
  end if;
  if payout_idempotency_key is null then raise exception 'credit payout idempotency key is required'; end if;
  if char_length(normalized_note) > 1500 or (normalized_reference is not null and char_length(normalized_reference) > 250) then
    raise exception 'credit payout note or reference is too long';
  end if;

  select * into existing_row from public.driver_cash_credit_payouts
  where idempotency_key = payout_idempotency_key for update;
  if found then
    if existing_row.driver_id <> target_driver or existing_row.currency <> payout_currency
       or existing_row.amount <> payout_amount or existing_row.external_reference is distinct from normalized_reference
       or existing_row.note <> normalized_note then
      raise exception 'credit payout idempotency key was reused with different details';
    end if;
    return existing_row.id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_driver::text || ':' || payout_currency::text, 0));
  select p.driver_credit_amount into current_credit
  from public.driver_cash_custody_positions p
  where p.driver_id = target_driver and p.currency = payout_currency;
  if coalesce(current_credit, 0) < payout_amount then
    raise exception 'credit payout exceeds the available driver credit';
  end if;

  insert into public.driver_cash_credit_payouts(
    driver_id, currency, amount, idempotency_key, external_reference, note, paid_by
  ) values (
    target_driver, payout_currency, payout_amount, payout_idempotency_key,
    normalized_reference, normalized_note, auth.uid()
  ) returning id into payout_id;
  return payout_id;
end;
$$;

alter table public.driver_cash_remittances enable row level security;
alter table public.driver_cash_credit_payouts enable row level security;
revoke all on table public.driver_cash_remittances, public.driver_cash_credit_payouts,
  public.driver_cash_custody_positions from anon, authenticated;
grant select on table public.driver_cash_remittances, public.driver_cash_credit_payouts,
  public.driver_cash_custody_positions to authenticated;

create policy driver_cash_remittances_read on public.driver_cash_remittances
  for select to authenticated using (public.is_admin() or driver_id = auth.uid());
create policy driver_cash_credit_payouts_read on public.driver_cash_credit_payouts
  for select to authenticated using (public.is_admin() or driver_id = auth.uid());

revoke all on function public.record_driver_cash_remittance(uuid, public.currency_code, numeric, uuid, text, text)
  from public, anon;
revoke all on function public.pay_driver_cash_credit(uuid, public.currency_code, numeric, uuid, text, text)
  from public, anon;
grant execute on function public.record_driver_cash_remittance(uuid, public.currency_code, numeric, uuid, text, text)
  to authenticated;
grant execute on function public.pay_driver_cash_credit(uuid, public.currency_code, numeric, uuid, text, text)
  to authenticated;

commit;
