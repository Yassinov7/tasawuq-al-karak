-- Account onboarding, single-role access, one-store merchant applications,
-- administrator review, and participant wallets. No order/delivery schema here.

create type public.account_role as enum ('customer', 'merchant', 'driver', 'admin');


create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role public.account_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  selected_role public.account_role := 'customer';
  selected_name text;
begin
  if new.raw_user_meta_data ->> 'signup_role' in ('customer', 'merchant', 'driver') then
    selected_role := (new.raw_user_meta_data ->> 'signup_role')::public.account_role;
  end if;
  selected_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  insert into public.profiles(id, email, full_name, role)
  values (new.id, coalesce(new.email, ''), coalesce(selected_name, 'مستخدم'), selected_role);
  return new;
end;
$$;

create or replace function public.protect_profile_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.email is distinct from old.email)
     and current_user not in ('postgres', 'supabase_admin', 'service_role')
     and not public.is_admin() then
    raise exception 'account role and email can only be changed by an administrator';
  end if;
  return new;
end;
$$;
create trigger protect_profile_identity_before_update
  before update on public.profiles for each row execute function public.protect_profile_identity();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  duration_months integer not null check (duration_months between 1 and 60),
  price numeric(14,2) not null check (price > 0),
  currency public.currency_code not null default 'SYP',
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscription_plans_updated_at before update on public.subscription_plans
  for each row execute function public.set_updated_at();

create table public.merchant_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  plan_name_snapshot text not null,
  plan_duration_months_snapshot integer not null check (plan_duration_months_snapshot between 1 and 60),
  plan_price_snapshot numeric(14,2) not null check (plan_price_snapshot > 0),
  plan_currency_snapshot public.currency_code not null,
  business_name text not null check (char_length(trim(business_name)) between 2 and 120),
  contact_phone text not null check (char_length(trim(contact_phone)) between 5 and 32),
  store_name text not null check (char_length(trim(store_name)) between 2 and 120),
  store_description text not null default '',
  store_address text not null check (char_length(trim(store_address)) between 3 and 300),
  status public.application_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index merchant_applications_review_idx on public.merchant_applications(status, submitted_at);
create trigger merchant_applications_updated_at before update on public.merchant_applications
  for each row execute function public.set_updated_at();

create table public.driver_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  contact_phone text not null check (char_length(trim(contact_phone)) between 5 and 32),
  vehicle_type text not null check (char_length(trim(vehicle_type)) between 2 and 80),
  contract_duration_months integer not null check (contract_duration_months between 1 and 60),
  available_hours jsonb not null check (jsonb_typeof(available_hours) = 'object'),
  status public.application_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index driver_applications_review_idx on public.driver_applications(status, submitted_at);
create trigger driver_applications_updated_at before update on public.driver_applications
  for each row execute function public.set_updated_at();

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.profiles(id) on delete restrict,
  business_name text not null,
  contact_phone text not null,
  status public.application_status not null default 'accepted',
  created_at timestamptz not null default now()
);

-- One account owns exactly one merchant profile and one store in this release.
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null unique references public.merchants(id) on delete restrict,
  name text not null,
  description text not null default '',
  phone text not null,
  address text not null,
  status public.application_status not null default 'accepted',
  created_at timestamptz not null default now()
);

create table public.merchant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null unique references public.merchants(id) on delete restrict,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  plan_name_snapshot text not null,
  duration_months integer not null check (duration_months between 1 and 60),
  price_snapshot numeric(14,2) not null check (price_snapshot > 0),
  currency_snapshot public.currency_code not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table public.wallets (
  user_id uuid not null references public.profiles(id) on delete restrict,
  currency public.currency_code not null,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, currency)
);
create trigger wallets_updated_at before update on public.wallets
  for each row execute function public.set_updated_at();

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  currency public.currency_code not null,
  transaction_type public.wallet_transaction_type not null,
  direction public.wallet_direction not null,
  amount numeric(14,2) not null check (amount > 0),
  balance_after numeric(14,2) not null check (balance_after >= 0),
  note text not null default '' check (char_length(note) <= 2000),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (user_id, currency) references public.wallets(user_id, currency) on delete restrict
);
create index wallet_transactions_user_idx on public.wallet_transactions(user_id, currency, created_at desc);

create or replace function public.apply_wallet_transaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  current_balance numeric(14,2);
  next_balance numeric(14,2);
begin
  select w.balance into current_balance from public.wallets w
    where w.user_id = new.user_id and w.currency = new.currency for update;
  if not found then raise exception 'wallet not found'; end if;
  next_balance := case when new.direction = 'credit'
    then current_balance + new.amount else current_balance - new.amount end;
  if next_balance < 0 then raise exception 'transaction exceeds available wallet balance'; end if;
  new.balance_after := next_balance;
  update public.wallets set balance = next_balance
    where user_id = new.user_id and currency = new.currency;
  return new;
end;
$$;
create trigger wallet_transaction_apply_before_insert before insert on public.wallet_transactions
  for each row execute function public.apply_wallet_transaction();

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb;
  new_row jsonb;
  row_id text;
begin
  if tg_op = 'INSERT' then
    new_row := to_jsonb(new);
    row_id := coalesce(new_row ->> 'id', new_row ->> 'user_id', 'unknown');
  elsif tg_op = 'UPDATE' then
    old_row := to_jsonb(old);
    new_row := to_jsonb(new);
    row_id := coalesce(new_row ->> 'id', new_row ->> 'user_id', 'unknown');
  else
    old_row := to_jsonb(old);
    row_id := coalesce(old_row ->> 'id', old_row ->> 'user_id', 'unknown');
  end if;
  insert into public.audit_logs(actor_id, table_name, record_id, action, old_values, new_values)
  values (auth.uid(), tg_table_schema || '.' || tg_table_name, row_id, tg_op, old_row, new_row);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.submit_merchant_application(
  selected_plan uuid,
  input_business_name text,
  input_contact_phone text,
  input_store_name text,
  input_store_description text,
  input_store_address text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  plan_row public.subscription_plans%rowtype;
  application_id uuid;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = current_user_id and p.role = 'merchant') then
    raise exception 'merchant account required';
  end if;
  if exists (select 1 from public.merchants m where m.owner_user_id = current_user_id) then
    raise exception 'merchant account is already approved';
  end if;
  if nullif(trim(input_business_name), '') is null or nullif(trim(input_contact_phone), '') is null
     or nullif(trim(input_store_name), '') is null or nullif(trim(input_store_address), '') is null then
    raise exception 'required merchant and store details are missing';
  end if;
  select * into plan_row from public.subscription_plans p
    where p.id = selected_plan and p.is_active for share;
  if not found then raise exception 'selected subscription plan is unavailable'; end if;

  insert into public.merchant_applications(
    user_id, plan_id, plan_name_snapshot, plan_duration_months_snapshot,
    plan_price_snapshot, plan_currency_snapshot, business_name, contact_phone,
    store_name, store_description, store_address
  ) values (
    current_user_id, plan_row.id, plan_row.name, plan_row.duration_months,
    plan_row.price, plan_row.currency, trim(input_business_name), trim(input_contact_phone),
    trim(input_store_name), coalesce(trim(input_store_description), ''), trim(input_store_address)
  )
  on conflict (user_id) do update set
    plan_id = excluded.plan_id, plan_name_snapshot = excluded.plan_name_snapshot,
    plan_duration_months_snapshot = excluded.plan_duration_months_snapshot,
    plan_price_snapshot = excluded.plan_price_snapshot, plan_currency_snapshot = excluded.plan_currency_snapshot,
    business_name = excluded.business_name, contact_phone = excluded.contact_phone,
    store_name = excluded.store_name, store_description = excluded.store_description,
    store_address = excluded.store_address, status = 'pending', review_note = null,
    reviewed_by = null, reviewed_at = null, submitted_at = now()
  where public.merchant_applications.status in ('rejected', 'changes_requested')
  returning id into application_id;
  if application_id is null then raise exception 'merchant application is already awaiting review'; end if;
  return application_id;
end;
$$;

create or replace function public.submit_driver_application(
  input_full_name text,
  input_contact_phone text,
  input_vehicle_type text,
  input_contract_duration_months integer,
  input_available_hours jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  application_id uuid;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = current_user_id and p.role = 'driver') then
    raise exception 'driver account required';
  end if;
  if nullif(trim(input_full_name), '') is null or nullif(trim(input_contact_phone), '') is null
     or nullif(trim(input_vehicle_type), '') is null or input_contract_duration_months not between 1 and 60
     or jsonb_typeof(input_available_hours) <> 'object' then
    raise exception 'required driver details are missing or invalid';
  end if;
  insert into public.driver_applications(
    user_id, full_name, contact_phone, vehicle_type, contract_duration_months, available_hours
  ) values (
    current_user_id, trim(input_full_name), trim(input_contact_phone), trim(input_vehicle_type),
    input_contract_duration_months, input_available_hours
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name, contact_phone = excluded.contact_phone,
    vehicle_type = excluded.vehicle_type, contract_duration_months = excluded.contract_duration_months,
    available_hours = excluded.available_hours, status = 'pending', review_note = null,
    reviewed_by = null, reviewed_at = null, submitted_at = now()
  where public.driver_applications.status in ('rejected', 'changes_requested')
  returning id into application_id;
  if application_id is null then raise exception 'driver application is already awaiting review'; end if;
  return application_id;
end;
$$;

create or replace function public.review_merchant_application(
  target_application uuid,
  decision public.application_status,
  decision_note text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  application_row public.merchant_applications%rowtype;
  merchant_id_value uuid;
  store_id_value uuid;
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if decision not in ('accepted', 'rejected', 'changes_requested') then raise exception 'invalid review decision'; end if;
  select * into application_row from public.merchant_applications
    where id = target_application for update;
  if not found or application_row.status not in ('pending', 'changes_requested', 'rejected') then
    raise exception 'merchant application is not available for review';
  end if;
  if decision = 'accepted' then
    if not exists (select 1 from public.subscription_plans p where p.id = application_row.plan_id) then
      raise exception 'subscription plan no longer exists';
    end if;
    if exists (select 1 from public.merchants m where m.owner_user_id = application_row.user_id) then
      raise exception 'merchant is already provisioned';
    end if;
    insert into public.merchants(owner_user_id, business_name, contact_phone, status)
    values (application_row.user_id, application_row.business_name, application_row.contact_phone, 'accepted')
    returning id into merchant_id_value;
    insert into public.stores(merchant_id, name, description, phone, address, status)
    values (merchant_id_value, application_row.store_name, application_row.store_description,
      application_row.contact_phone, application_row.store_address, 'accepted')
    returning id into store_id_value;
    insert into public.merchant_subscriptions(
      merchant_id, plan_id, plan_name_snapshot, duration_months,
      price_snapshot, currency_snapshot, starts_at, expires_at
    ) values (
      merchant_id_value, application_row.plan_id, application_row.plan_name_snapshot,
      application_row.plan_duration_months_snapshot, application_row.plan_price_snapshot,
      application_row.plan_currency_snapshot, now(),
      now() + make_interval(months => application_row.plan_duration_months_snapshot)
    );
    insert into public.wallets(user_id, currency, balance)
      values (application_row.user_id, application_row.plan_currency_snapshot, 0);
    insert into public.wallet_transactions(
      user_id, currency, transaction_type, direction, amount, balance_after, note, recorded_by
    ) values (
      application_row.user_id, application_row.plan_currency_snapshot, 'subscription_initialization',
      'credit', application_row.plan_price_snapshot, 0,
      'رصيد افتتاحي مرتبط بخطة ' || application_row.plan_name_snapshot, auth.uid()
    );
    update public.merchant_applications set status = 'accepted', review_note = null,
      reviewed_by = auth.uid(), reviewed_at = now() where id = target_application;
  else
    update public.merchant_applications set status = decision,
      review_note = nullif(trim(decision_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
      where id = target_application;
  end if;
end;
$$;

create or replace function public.review_driver_application(
  target_application uuid,
  decision public.application_status,
  decision_note text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  application_row public.driver_applications%rowtype;
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if decision not in ('accepted', 'rejected', 'changes_requested') then raise exception 'invalid review decision'; end if;
  select * into application_row from public.driver_applications
    where id = target_application for update;
  if not found or application_row.status not in ('pending', 'changes_requested', 'rejected') then
    raise exception 'driver application is not available for review';
  end if;
  update public.driver_applications set status = decision,
    review_note = case when decision = 'accepted' then null else nullif(trim(decision_note), '') end,
    reviewed_by = auth.uid(), reviewed_at = now() where id = target_application;
  if decision = 'accepted' then
    insert into public.wallets(user_id, currency, balance)
      values (application_row.user_id, 'SYP', 0) on conflict (user_id, currency) do nothing;
  end if;
end;
$$;

create or replace function public.record_wallet_transaction(
  target_user uuid,
  target_currency public.currency_code,
  operation public.wallet_transaction_type,
  operation_direction public.wallet_direction,
  operation_amount numeric,
  operation_note text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  transaction_id uuid;
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if operation not in ('funding', 'settlement', 'adjustment') then raise exception 'invalid wallet operation'; end if;
  if operation = 'funding' and operation_direction <> 'credit' then
    raise exception 'funding operations must credit the wallet';
  end if;
  if operation = 'settlement' and operation_direction <> 'debit' then
    raise exception 'settlement operations must debit the wallet';
  end if;
  if operation_amount <= 0 or operation_amount <> round(operation_amount, 2) then
    raise exception 'amount must be positive with at most two decimal places';
  end if;
  if char_length(coalesce(operation_note, '')) > 2000 then raise exception 'note is too long'; end if;
  insert into public.wallet_transactions(
    user_id, currency, transaction_type, direction, amount, balance_after, note, recorded_by
  ) values (
    target_user, target_currency, operation, operation_direction, operation_amount, 0,
    coalesce(nullif(trim(operation_note), ''), ''), auth.uid()
  ) returning id into transaction_id;
  return transaction_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.merchant_applications enable row level security;
alter table public.driver_applications enable row level security;
alter table public.merchants enable row level security;
alter table public.stores enable row level security;
alter table public.merchant_subscriptions enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read_self_admin on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_self_admin on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
grant select on public.profiles to authenticated;
grant update(full_name) on public.profiles to authenticated;

create policy plans_read_active on public.subscription_plans for select to anon, authenticated
  using (is_active or public.is_admin());
create policy plans_admin_manage on public.subscription_plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.subscription_plans to anon, authenticated;
grant insert, update, delete on public.subscription_plans to authenticated;

create policy merchant_applications_read_owner_admin on public.merchant_applications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy driver_applications_read_owner_admin on public.driver_applications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
grant select on public.merchant_applications, public.driver_applications to authenticated;

create policy merchants_read_owner_admin on public.merchants for select to authenticated
  using (owner_user_id = auth.uid() or public.is_admin());
create policy stores_read_owner_admin on public.stores for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()
  ));
grant select on public.merchants, public.stores to authenticated;

create policy merchant_subscriptions_read_owner_admin on public.merchant_subscriptions for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()
  ));
grant select on public.merchant_subscriptions to authenticated;

create policy wallets_read_owner_admin on public.wallets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy wallet_transactions_read_owner_admin on public.wallet_transactions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
grant select on public.wallets, public.wallet_transactions to authenticated;

create policy audit_logs_read_admin on public.audit_logs for select to authenticated
  using (public.is_admin());
grant select on public.audit_logs to authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to anon;
revoke all on function public.submit_merchant_application(uuid,text,text,text,text,text) from public, anon;
grant execute on function public.submit_merchant_application(uuid,text,text,text,text,text) to authenticated;
revoke all on function public.submit_driver_application(text,text,text,integer,jsonb) from public, anon;
grant execute on function public.submit_driver_application(text,text,text,integer,jsonb) to authenticated;
revoke all on function public.review_merchant_application(uuid,public.application_status,text) from public, anon;
grant execute on function public.review_merchant_application(uuid,public.application_status,text) to authenticated;
revoke all on function public.review_driver_application(uuid,public.application_status,text) from public, anon;
grant execute on function public.review_driver_application(uuid,public.application_status,text) to authenticated;
revoke all on function public.record_wallet_transaction(uuid,public.currency_code,public.wallet_transaction_type,public.wallet_direction,numeric,text) from public, anon;
grant execute on function public.record_wallet_transaction(uuid,public.currency_code,public.wallet_transaction_type,public.wallet_direction,numeric,text) to authenticated;

create trigger audit_merchant_applications after insert or update or delete on public.merchant_applications
  for each row execute function public.write_audit_log();
create trigger audit_driver_applications after insert or update or delete on public.driver_applications
  for each row execute function public.write_audit_log();
create trigger audit_merchants after insert or update or delete on public.merchants
  for each row execute function public.write_audit_log();
create trigger audit_stores after insert or update or delete on public.stores
  for each row execute function public.write_audit_log();
create trigger audit_merchant_subscriptions after insert or update or delete on public.merchant_subscriptions
  for each row execute function public.write_audit_log();
create trigger audit_wallets after insert or update or delete on public.wallets
  for each row execute function public.write_audit_log();
create trigger audit_wallet_transactions after insert or update or delete on public.wallet_transactions
  for each row execute function public.write_audit_log();
create trigger audit_subscription_plans after insert or update or delete on public.subscription_plans
  for each row execute function public.write_audit_log();

-- First-admin bootstrap (run once after creating the intended auth user):
-- update public.profiles set role = 'admin' where email = 'ADMIN_EMAIL';
