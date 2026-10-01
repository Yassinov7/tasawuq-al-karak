-- Categorize stores and add a durable in-app notification inbox.
create table public.store_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.store_categories(name, slug, sort_order) values
  ('مواد غذائية', 'groceries', 10), ('خضار وفواكه', 'produce', 20),
  ('ألبان وأجبان', 'dairy', 30), ('لحوم ودواجن', 'meat-poultry', 40),
  ('مخبوزات', 'bakery', 50), ('مشروبات', 'drinks', 60),
  ('منزل ومطبخ', 'home-kitchen', 70), ('عناية شخصية', 'personal-care', 80),
  ('أخرى', 'other', 90)
on conflict (slug) do nothing;

alter table public.merchant_applications add column category_id uuid references public.store_categories(id) on delete restrict;
alter table public.stores add column category_id uuid references public.store_categories(id) on delete restrict;
update public.merchant_applications set category_id = (select id from public.store_categories where slug = 'other') where category_id is null;
update public.stores set category_id = (select id from public.store_categories where slug = 'other') where category_id is null;
alter table public.merchant_applications alter column category_id set not null;
alter table public.stores alter column category_id set not null;
create index merchant_applications_category_idx on public.merchant_applications(category_id);
create index stores_category_idx on public.stores(category_id);

alter table public.merchant_applications drop column business_name;
alter table public.merchants drop column business_name;

alter table public.store_categories enable row level security;
create policy store_categories_read_active on public.store_categories for select to anon, authenticated
  using (is_active or public.is_admin());
create policy store_categories_admin_manage on public.store_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.store_categories to anon, authenticated;
grant insert, update, delete on public.store_categories to authenticated;

drop function public.submit_merchant_application(uuid, text, text, text, text, text);
create function public.submit_merchant_application(
  selected_plan uuid,
  input_contact_phone text,
  input_store_name text,
  input_store_description text,
  input_store_address text,
  selected_store_category uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  plan_row public.subscription_plans%rowtype;
  application_id uuid;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = current_user_id and p.role = 'merchant') then raise exception 'merchant account required'; end if;
  if exists (select 1 from public.merchants m where m.owner_user_id = current_user_id) then raise exception 'merchant account is already approved'; end if;
  if nullif(trim(input_contact_phone), '') is null or nullif(trim(input_store_name), '') is null or nullif(trim(input_store_address), '') is null then raise exception 'required store details are missing'; end if;
  if not exists (select 1 from public.store_categories c where c.id = selected_store_category and c.is_active) then raise exception 'selected store category is unavailable'; end if;
  select * into plan_row from public.subscription_plans p where p.id = selected_plan and p.is_active for share;
  if not found then raise exception 'selected subscription plan is unavailable'; end if;
  insert into public.merchant_applications(user_id, plan_id, plan_name_snapshot, plan_duration_months_snapshot,
    plan_price_snapshot, plan_currency_snapshot, contact_phone, store_name,
    store_description, store_address, category_id)
  values (current_user_id, plan_row.id, plan_row.name, plan_row.duration_months, plan_row.price,
    plan_row.currency, trim(input_contact_phone), trim(input_store_name),
    coalesce(trim(input_store_description), ''), trim(input_store_address), selected_store_category)
  on conflict (user_id) do update set plan_id = excluded.plan_id,
    plan_name_snapshot = excluded.plan_name_snapshot, plan_duration_months_snapshot = excluded.plan_duration_months_snapshot,
    plan_price_snapshot = excluded.plan_price_snapshot, plan_currency_snapshot = excluded.plan_currency_snapshot,
    contact_phone = excluded.contact_phone,
    store_name = excluded.store_name, store_description = excluded.store_description,
    store_address = excluded.store_address, category_id = excluded.category_id,
    status = 'pending', review_note = null, reviewed_by = null, reviewed_at = null, submitted_at = now()
  where public.merchant_applications.status in ('rejected', 'changes_requested')
  returning id into application_id;
  if application_id is null then raise exception 'merchant application is already awaiting review'; end if;
  return application_id;
end;
$$;
revoke all on function public.submit_merchant_application(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.submit_merchant_application(uuid, text, text, text, text, uuid) to authenticated;

create or replace function public.review_merchant_application(target_application uuid,
  decision public.application_status, decision_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  application_row public.merchant_applications%rowtype;
  merchant_id_value uuid;
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if decision not in ('accepted', 'rejected', 'changes_requested') then raise exception 'invalid review decision'; end if;
  select * into application_row from public.merchant_applications where id = target_application for update;
  if not found or application_row.status not in ('pending', 'changes_requested', 'rejected') then raise exception 'merchant application is not available for review'; end if;
  if decision = 'accepted' then
    if exists (select 1 from public.merchants m where m.owner_user_id = application_row.user_id) then raise exception 'merchant is already provisioned'; end if;
    insert into public.merchants(owner_user_id, contact_phone, status)
      values (application_row.user_id, application_row.contact_phone, 'accepted') returning id into merchant_id_value;
    insert into public.stores(merchant_id, name, description, phone, address, category_id, status)
      values (merchant_id_value, application_row.store_name, application_row.store_description,
        application_row.contact_phone, application_row.store_address, application_row.category_id, 'accepted');
    insert into public.merchant_subscriptions(merchant_id, plan_id, plan_name_snapshot, duration_months,
      price_snapshot, currency_snapshot, starts_at, expires_at)
    values (merchant_id_value, application_row.plan_id, application_row.plan_name_snapshot,
      application_row.plan_duration_months_snapshot, application_row.plan_price_snapshot,
      application_row.plan_currency_snapshot, now(), now() + make_interval(months => application_row.plan_duration_months_snapshot));
    insert into public.wallets(user_id, currency, balance) values (application_row.user_id, application_row.plan_currency_snapshot, 0);
    insert into public.wallet_transactions(user_id, currency, transaction_type, direction, amount,
      balance_after, note, recorded_by)
    values (application_row.user_id, application_row.plan_currency_snapshot, 'subscription_initialization',
      'credit', application_row.plan_price_snapshot, 0, 'رصيد افتتاحي مرتبط بخطة ' || application_row.plan_name_snapshot, auth.uid());
    update public.merchant_applications set status = 'accepted', review_note = null,
      reviewed_by = auth.uid(), reviewed_at = now() where id = target_application;
  else
    update public.merchant_applications set status = decision, review_note = nullif(trim(decision_note), ''),
      reviewed_by = auth.uid(), reviewed_at = now() where id = target_application;
  end if;
end;
$$;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('order', 'offer', 'promotion', 'system')),
  title text not null check (char_length(trim(title)) between 1 and 140),
  body text not null default '' check (char_length(body) <= 1000),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
create policy notifications_read_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = auth.uid());
grant select, delete on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;

create or replace function public.notify_customers_of_new_offer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare store_name_value text;
begin
  if not new.is_active then return new; end if;
  select s.name into store_name_value from public.stores s where s.id = new.store_id;
  insert into public.notifications(user_id, type, title, body, data)
  select p.id, 'offer', 'عرض جديد من ' || coalesce(store_name_value, 'متجر'), new.title,
    jsonb_build_object('storeId', new.store_id, 'offerId', new.id, 'url', '/store-details?id=' || new.store_id::text)
  from public.profiles p where p.role = 'customer';
  return new;
end;
$$;
create trigger notify_customers_after_offer_insert after insert on public.store_offers
  for each row execute function public.notify_customers_of_new_offer();
revoke all on function public.notify_customers_of_new_offer() from public, anon, authenticated;

-- Attach this trigger function to the store-level order table when that table
-- is introduced by the order-flow migration (expected NEW.store_id and NEW.id).
create or replace function public.notify_merchant_of_new_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  merchant_user_id uuid;
  store_name_value text;
begin
  select m.owner_user_id, s.name into merchant_user_id, store_name_value
  from public.stores s join public.merchants m on m.id = s.merchant_id
  where s.id = new.store_id;
  if merchant_user_id is null then raise exception 'order store has no merchant owner'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (merchant_user_id, 'order', 'طلب جديد لمتجرك', 'وصلك طلب جديد إلى ' || store_name_value,
    jsonb_build_object('orderId', new.id, 'storeId', new.store_id, 'url', '/merchant/orders'));
  return new;
end;
$$;
revoke all on function public.notify_merchant_of_new_order() from public, anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
