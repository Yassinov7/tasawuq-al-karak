-- Catalog, pricing, quantity rules, customer addresses, and carts.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text not null default '',
  availability public.product_availability not null default 'available',
  image_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, store_id)
);
create index products_store_idx on public.products(store_id);
create index products_category_idx on public.products(category_id);
create index products_available_idx on public.products(store_id) where availability = 'available';
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  price numeric(14,2) not null check (price >= 0),
  currency public.currency_code not null,
  selling_unit public.selling_unit not null default 'piece',
  minimum_quantity numeric(12,3) not null default 1 check (minimum_quantity > 0),
  quantity_step numeric(12,3) not null default 1 check (quantity_step > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, store_id),
  foreign key (product_id, store_id) references public.products(id, store_id) on delete cascade
);
create index store_products_store_idx on public.store_products(store_id);
create trigger store_products_updated_at before update on public.store_products for each row execute function public.set_updated_at();
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default '',
  recipient_name text not null,
  phone text not null,
  address text not null,
  zone_id uuid not null references public.delivery_zones(id) on delete restrict,
  latitude double precision,
  longitude double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);
create index addresses_customer_idx on public.customer_addresses(customer_id);
create trigger addresses_updated_at before update on public.customer_addresses for each row execute function public.set_updated_at();

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id)
);
create trigger carts_updated_at before update on public.carts for each row execute function public.set_updated_at();
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  store_product_id uuid not null references public.store_products(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, store_product_id)
);
create index cart_items_cart_idx on public.cart_items(cart_id);
create trigger cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();

