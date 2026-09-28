-- Merchant accounts, approval, delivery zones, and branch settings.
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  legal_name text,
  contact_phone text not null,
  approval public.approval_status not null default 'pending',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index merchants_owner_idx on public.merchants(owner_user_id);
create trigger merchants_updated_at before update on public.merchants for each row execute function public.set_updated_at();
create table public.merchant_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'owner' check (member_role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  unique (merchant_id, user_id)
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_name text not null,
  fixed_fee numeric(14,2) not null check (fixed_fee >= 0),
  currency public.currency_code not null default 'SYP',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_name, name)
);
create trigger delivery_zones_updated_at before update on public.delivery_zones for each row execute function public.set_updated_at();
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  name text not null,
  description text not null default '',
  phone text,
  address text not null,
  latitude double precision,
  longitude double precision,
  status public.store_status not null default 'pending',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);
create index stores_merchant_idx on public.stores(merchant_id);
create index stores_status_idx on public.stores(status);
create trigger stores_updated_at before update on public.stores for each row execute function public.set_updated_at();
create table public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  currency public.currency_code not null default 'SYP',
  delivery_mode text not null default 'platform' check (delivery_mode in ('store', 'platform')),
  store_delivery_fee numeric(14,2) not null default 0 check (store_delivery_fee >= 0),
  accepts_orders boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger store_settings_updated_at before update on public.store_settings for each row execute function public.set_updated_at();

create or replace function public.bootstrap_store_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.store_settings(store_id) values (new.id);
  return new;
end;
$$;
create trigger store_settings_bootstrap after insert on public.stores for each row execute function public.bootstrap_store_settings();

