-- Financial foundation only.
-- Deliberately excludes approval/order/delivery hooks, automatic invoices,
-- automatic commissions, historic debt backfill, and all application changes.

begin;

-- Existing rows stay untouched and become historical subscription periods.
-- The exclusion constraint permits later periods but prevents overlap.
lock table public.merchant_subscriptions in share row exclusive mode;
create extension if not exists btree_gist;
alter table public.merchant_subscriptions
  drop constraint if exists merchant_subscriptions_merchant_id_key;
alter table public.merchant_subscriptions
  add constraint merchant_subscriptions_id_merchant_id_key unique (id, merchant_id),
  add constraint merchant_subscriptions_no_overlapping_periods
    exclude using gist (
      merchant_id with =,
      tstzrange(starts_at, expires_at, '[)') with &&
    );
create index merchant_subscriptions_merchant_period_idx
  on public.merchant_subscriptions (merchant_id, starts_at desc);

create table public.merchant_billing_settings (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  auto_renew boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.merchant_credit_limits (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  currency public.currency_code not null,
  credit_enabled boolean not null default false,
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  updated_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (merchant_id, currency)
);

create table public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  merchant_id uuid not null,
  subscription_id uuid not null,
  kind text not null check (kind in ('initial', 'renewal', 'adjustment')),
  currency public.currency_code not null,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  due_at timestamptz,
  status text not null check (status in ('open', 'partially_paid', 'paid', 'void')),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  foreign key (subscription_id, merchant_id)
    references public.merchant_subscriptions (id, merchant_id) on delete restrict
);
create unique index subscription_invoices_base_period_once_idx
  on public.subscription_invoices (subscription_id)
  where kind in ('initial', 'renewal');
create index subscription_invoices_merchant_currency_status_idx
  on public.subscription_invoices (merchant_id, currency, status, created_at desc);

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  currency public.currency_code not null,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('cash', 'external_transfer')),
  external_reference text,
  idempotency_key uuid not null unique,
  received_at timestamptz not null,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index subscription_payments_merchant_currency_received_idx
  on public.subscription_payments (merchant_id, currency, received_at desc);

-- Invoices are append-only apart from their lifecycle status. A future
-- administrative RPC may transition status, but cannot rewrite identity,
-- ownership, amount, currency, or the idempotency record.
create function public.reject_subscription_invoice_identity_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.id is distinct from old.id
     or new.invoice_number is distinct from old.invoice_number
     or new.merchant_id is distinct from old.merchant_id
     or new.subscription_id is distinct from old.subscription_id
     or new.kind is distinct from old.kind
     or new.currency is distinct from old.currency
     or new.total_amount is distinct from old.total_amount
     or new.due_at is distinct from old.due_at
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at then
    raise exception 'invoice financial identity is immutable';
  end if;
  return new;
end;
$$;

create function public.reject_subscription_invoice_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'invoices are append-only; use status or an audited adjustment';
end;
$$;

create trigger subscription_invoices_identity_before_update
  before update on public.subscription_invoices
  for each row execute function public.reject_subscription_invoice_identity_mutation();
create trigger subscription_invoices_reject_before_delete
  before delete on public.subscription_invoices
  for each row execute function public.reject_subscription_invoice_delete();

-- A recorded payment is a permanent financial fact. Corrections use a later,
-- audited reversal/allocation workflow rather than mutation or deletion.
create function public.reject_subscription_payment_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'payments are append-only; create an audited correction instead';
end;
$$;

create trigger subscription_payments_reject_mutation
  before update or delete on public.subscription_payments
  for each row execute function public.reject_subscription_payment_mutation();

create table public.invoice_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.subscription_invoices(id) on delete restrict,
  payment_id uuid not null references public.subscription_payments(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (invoice_id, payment_id)
);
create index invoice_payment_allocations_payment_idx
  on public.invoice_payment_allocations (payment_id);

-- Allocation records are append-only. Corrections are a later, audited reversal
-- workflow rather than an update or delete of an approved financial allocation.
create or replace function public.validate_invoice_payment_allocation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  invoice_row public.subscription_invoices%rowtype;
  payment_row public.subscription_payments%rowtype;
  invoice_allocated numeric(14,2);
  payment_allocated numeric(14,2);
begin
  select * into payment_row from public.subscription_payments p
    where p.id = new.payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  select * into invoice_row from public.subscription_invoices i
    where i.id = new.invoice_id for update;
  if not found then raise exception 'invoice not found'; end if;
  if invoice_row.merchant_id <> payment_row.merchant_id
     or invoice_row.currency <> payment_row.currency then
    raise exception 'invoice and payment must belong to the same merchant and currency';
  end if;
  if invoice_row.status = 'void' then
    raise exception 'a void invoice cannot receive an allocation';
  end if;
  select coalesce(sum(a.amount), 0) into invoice_allocated
    from public.invoice_payment_allocations a where a.invoice_id = new.invoice_id;
  select coalesce(sum(a.amount), 0) into payment_allocated
    from public.invoice_payment_allocations a where a.payment_id = new.payment_id;
  if invoice_allocated + new.amount > invoice_row.total_amount
     or payment_allocated + new.amount > payment_row.amount then
    raise exception 'allocation exceeds the remaining invoice or payment amount';
  end if;
  return new;
end;
$$;

create function public.reject_invoice_payment_allocation_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'financial allocations are append-only; create an audited reversal instead';
end;
$$;

create trigger invoice_payment_allocations_validate_before_insert
  before insert on public.invoice_payment_allocations
  for each row execute function public.validate_invoice_payment_allocation();
create trigger invoice_payment_allocations_reject_mutation
  before update or delete on public.invoice_payment_allocations
  for each row execute function public.reject_invoice_payment_allocation_mutation();

-- Exposure is calculated only from this append-only ledger, not from invoices
-- plus allocations. A reversal points to one original entry and is unique.
create table public.merchant_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  currency public.currency_code not null,
  effect text not null check (effect in ('increase_exposure', 'decrease_exposure')),
  source_type text not null check (source_type in (
    'subscription_invoice', 'store_order_commission',
    'payment_allocation', 'manual_adjustment', 'ledger_reversal'
  )),
  source_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  reversal_of uuid references public.merchant_ledger_entries(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (source_type, source_id),
  unique (reversal_of),
  check (reversal_of is null or reversal_of <> id)
);
create index merchant_ledger_entries_exposure_idx
  on public.merchant_ledger_entries (merchant_id, currency, created_at desc);

create or replace function public.validate_merchant_ledger_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare original_row public.merchant_ledger_entries%rowtype;
begin
  if new.reversal_of is null then
    if new.source_type = 'ledger_reversal' then
      raise exception 'ledger reversal source requires reversal_of';
    end if;
    return new;
  end if;
  select * into original_row from public.merchant_ledger_entries e
    where e.id = new.reversal_of for update;
  if not found then raise exception 'original ledger entry not found'; end if;
  if original_row.source_type = 'ledger_reversal' then
    raise exception 'a ledger reversal cannot itself be reversed';
  end if;
  if new.source_type <> 'ledger_reversal'
     or new.source_id <> original_row.id
     or new.merchant_id <> original_row.merchant_id
     or new.currency <> original_row.currency
     or new.amount <> original_row.amount
     or new.effect = original_row.effect then
    raise exception 'ledger reversal must exactly negate its original entry';
  end if;
  return new;
end;
$$;

create function public.reject_merchant_ledger_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'ledger entries are append-only; create an audited reversal instead';
end;
$$;

create trigger merchant_ledger_entries_validate_before_insert
  before insert on public.merchant_ledger_entries
  for each row execute function public.validate_merchant_ledger_entry();
create trigger merchant_ledger_entries_reject_mutation
  before update or delete on public.merchant_ledger_entries
  for each row execute function public.reject_merchant_ledger_mutation();

-- Trigger helpers are SECURITY DEFINER but must never be client-callable.
revoke all on function public.validate_invoice_payment_allocation() from public, anon, authenticated;
revoke all on function public.reject_invoice_payment_allocation_mutation() from public, anon, authenticated;
revoke all on function public.reject_subscription_invoice_identity_mutation() from public, anon, authenticated;
revoke all on function public.reject_subscription_invoice_delete() from public, anon, authenticated;
revoke all on function public.reject_subscription_payment_mutation() from public, anon, authenticated;
revoke all on function public.validate_merchant_ledger_entry() from public, anon, authenticated;
revoke all on function public.reject_merchant_ledger_mutation() from public, anon, authenticated;

-- No order hook is created here. A later reviewed change uses the confirmed
-- store_order_totals.items_subtotal and update_delivery_task_status lifecycle.
create table public.store_order_commissions (
  id uuid primary key default gen_random_uuid(),
  store_order_id uuid not null unique references public.store_orders(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  currency public.currency_code not null,
  commission_rate numeric(7,4) not null check (commission_rate >= 0 and commission_rate <= 100),
  base_amount numeric(14,2) not null check (base_amount >= 0),
  commission_amount numeric(14,2) not null check (commission_amount >= 0),
  status text not null check (status in ('pending_delivery', 'due', 'void')),
  created_at timestamptz not null default now(),
  due_at timestamptz
);
create index store_order_commissions_merchant_status_idx
  on public.store_order_commissions (merchant_id, currency, status, created_at desc);

create table public.merchant_financial_audit_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index merchant_financial_audit_events_merchant_idx
  on public.merchant_financial_audit_events (merchant_id, created_at desc);

alter table public.merchant_billing_settings enable row level security;
alter table public.merchant_credit_limits enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.invoice_payment_allocations enable row level security;
alter table public.merchant_ledger_entries enable row level security;
alter table public.store_order_commissions enable row level security;
alter table public.merchant_financial_audit_events enable row level security;

revoke all on table public.merchant_billing_settings, public.merchant_credit_limits,
  public.subscription_invoices, public.subscription_payments,
  public.invoice_payment_allocations, public.merchant_ledger_entries,
  public.store_order_commissions, public.merchant_financial_audit_events
  from anon, authenticated;
grant select on table public.merchant_billing_settings, public.merchant_credit_limits,
  public.subscription_invoices, public.subscription_payments,
  public.invoice_payment_allocations, public.merchant_ledger_entries,
  public.store_order_commissions, public.merchant_financial_audit_events to authenticated;

create policy merchant_billing_settings_read on public.merchant_billing_settings
  for select to authenticated using (public.is_admin() or exists (
    select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()
  ));
create policy merchant_credit_limits_read on public.merchant_credit_limits
  for select to authenticated using (public.is_admin() or exists (
    select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()
  ));
create policy subscription_invoices_read on public.subscription_invoices
  for select to authenticated using (public.is_admin() or exists (
    select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()
  ));
create policy subscription_payments_read on public.subscription_payments
  for select to authenticated using (public.is_admin() or exists (
    select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()
  ));
create policy invoice_payment_allocations_read on public.invoice_payment_allocations
  for select to authenticated using (public.is_admin() or exists (
    select 1 from public.subscription_invoices i join public.merchants m on m.id = i.merchant_id
    where i.id = invoice_id and m.owner_user_id = auth.uid()
  ));
create policy merchant_ledger_entries_read on public.merchant_ledger_entries
  for select to authenticated using (public.is_admin() or exists (
    select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()
  ));
create policy store_order_commissions_read on public.store_order_commissions
  for select to authenticated using (public.is_admin() or exists (
    select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()
  ));
create policy merchant_financial_audit_events_read_admin on public.merchant_financial_audit_events
  for select to authenticated using (public.is_admin());

commit;
