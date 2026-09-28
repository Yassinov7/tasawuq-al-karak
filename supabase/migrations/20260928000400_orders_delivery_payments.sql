-- Parent orders, store sub-orders, drivers, and payment records.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  address_id uuid references public.customer_addresses(id) on delete set null,
  zone_id uuid references public.delivery_zones(id) on delete set null,
  status public.order_status not null default 'pending',
  currency public.currency_code not null,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  payment_method public.payment_method not null default 'cash',
  payment_status public.payment_status not null default 'pending',
  customer_note text not null default '',
  cancelled_at timestamptz,
  cancellation_reason public.cancellation_reason,
  cancellation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_recent_idx on public.orders(customer_id, created_at desc);
create index orders_status_idx on public.orders(status);
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create table public.sub_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  status public.order_status not null default 'pending',
  currency public.currency_code not null,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  store_delivery_enabled boolean not null default false,
  assigned_driver_id uuid,
  merchant_cancelled_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason public.cancellation_reason,
  cancellation_note text,
  preparation_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, store_id)
);
create index sub_orders_store_status_idx on public.sub_orders(store_id, status);
create trigger sub_orders_updated_at before update on public.sub_orders for each row execute function public.set_updated_at();
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  sub_order_id uuid not null references public.sub_orders(id) on delete cascade,
  store_product_id uuid references public.store_products(id) on delete set null,
  product_name text not null,
  selling_unit public.selling_unit not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  currency public.currency_code not null,
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index order_items_sub_order_idx on public.order_items(sub_order_id);
create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid references public.orders(id) on delete cascade,
  sub_order_id uuid references public.sub_orders(id) on delete cascade,
  status public.order_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  check ((order_id is not null)::int + (sub_order_id is not null)::int = 1)
);
create index order_history_order_idx on public.order_status_history(order_id, created_at);
create index order_history_sub_idx on public.order_status_history(sub_order_id, created_at);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  phone text not null,
  approval public.approval_status not null default 'approved',
  is_platform_driver boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger drivers_updated_at before update on public.drivers for each row execute function public.set_updated_at();
alter table public.sub_orders add constraint sub_orders_driver_fk foreign key (assigned_driver_id) references public.drivers(id) on delete set null;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount numeric(14,2) not null check (amount >= 0),
  currency public.currency_code not null,
  provider text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments(order_id);
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

