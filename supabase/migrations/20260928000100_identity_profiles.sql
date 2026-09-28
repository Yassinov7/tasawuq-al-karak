-- Identity, roles, and Supabase Auth profile bootstrap.
-- Initial marketplace foundation. Apply with `supabase db push` after linking a project.
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('customer', 'merchant', 'admin', 'driver');
create type public.account_status as enum ('active', 'suspended', 'closed');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.store_status as enum ('draft', 'pending', 'approved', 'rejected', 'suspended', 'closed');
create type public.product_availability as enum ('available', 'unavailable');
create type public.selling_unit as enum ('piece', 'kg', 'g', 'l', 'ml');
create type public.currency_code as enum ('SYP', 'USD');
create type public.order_status as enum ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');
create type public.cancellation_reason as enum ('customer_request', 'out_of_stock', 'store_unavailable', 'operational_issue', 'delivery_issue', 'admin_action', 'other');
create type public.payment_method as enum ('cash', 'card', 'wallet', 'online');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.subscription_status as enum ('pending', 'active', 'expired', 'cancelled', 'suspended');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text not null unique,
  display_name text not null default '',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, phone, display_name)
  values (new.id, coalesce(new.phone, new.id::text), coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do update set phone = excluded.phone;
  insert into public.user_roles (user_id, role) values (new.id, 'customer') on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

