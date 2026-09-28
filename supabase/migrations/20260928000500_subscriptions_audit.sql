-- Merchant subscription plans, subscriptions, and audit trail.
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_months integer not null check (duration_months > 0),
  price numeric(14,2) not null check (price >= 0),
  currency public.currency_code not null default 'SYP',
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, duration_months)
);
create trigger subscription_plans_updated_at before update on public.subscription_plans for each row execute function public.set_updated_at();
create table public.merchant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  status public.subscription_status not null default 'pending',
  starts_at timestamptz,
  expires_at timestamptz,
  price_snapshot numeric(14,2) not null check (price_snapshot >= 0),
  currency_snapshot public.currency_code not null,
  duration_months_snapshot integer not null check (duration_months_snapshot > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);
create index merchant_subscriptions_active_idx on public.merchant_subscriptions(merchant_id, status, expires_at desc);
create trigger merchant_subscriptions_updated_at before update on public.merchant_subscriptions for each row execute function public.set_updated_at();

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_record_idx on public.audit_logs(table_name, record_id, created_at desc);
create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(actor_user_id, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_schema || '.' || tg_table_name,
    coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id'),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;
create trigger audit_merchants after insert or update or delete on public.merchants for each row execute function public.write_audit_log();
create trigger audit_stores after insert or update or delete on public.stores for each row execute function public.write_audit_log();
create trigger audit_products after insert or update or delete on public.products for each row execute function public.write_audit_log();
create trigger audit_store_products after insert or update or delete on public.store_products for each row execute function public.write_audit_log();
create trigger audit_orders after insert or update or delete on public.orders for each row execute function public.write_audit_log();
create trigger audit_sub_orders after insert or update or delete on public.sub_orders for each row execute function public.write_audit_log();
create trigger audit_subscriptions after insert or update or delete on public.merchant_subscriptions for each row execute function public.write_audit_log();
create trigger audit_delivery_zones after insert or update or delete on public.delivery_zones for each row execute function public.write_audit_log();
create trigger audit_store_settings after insert or update or delete on public.store_settings for each row execute function public.write_audit_log();
create trigger audit_categories after insert or update or delete on public.categories for each row execute function public.write_audit_log();
create trigger audit_subscription_plans after insert or update or delete on public.subscription_plans for each row execute function public.write_audit_log();
create trigger audit_drivers after insert or update or delete on public.drivers for each row execute function public.write_audit_log();
create trigger audit_payments after insert or update or delete on public.payments for each row execute function public.write_audit_log();

