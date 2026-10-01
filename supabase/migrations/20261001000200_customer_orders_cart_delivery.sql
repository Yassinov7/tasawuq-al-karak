-- Persistent customer carts, multi-store parent orders, per-store child orders,
-- delivery claims, status history, and durable in-app notifications.

create type public.customer_order_status as enum (
  'submitted', 'in_progress', 'ready_for_delivery', 'out_for_delivery',
  'delivered', 'partially_cancelled', 'cancelled'
);

create type public.store_order_status as enum (
  'awaiting_review', 'preparing', 'ready_for_pickup', 'handed_to_driver',
  'delivered', 'rejected', 'cancelled'
);

create type public.delivery_task_status as enum (
  'pending_stores', 'available', 'accepted', 'picked_up', 'delivered', 'cancelled'
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 2 and 100),
  fixed_fee numeric(14,2) not null check (fixed_fee >= 0),
  currency public.currency_code not null default 'SYP' check (currency = 'SYP'),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();
insert into public.delivery_zones(name, fixed_fee, sort_order)
values ('الكرك الشرقي', 15000, 10)
on conflict (name) do nothing;

create table public.customer_carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customer_carts_updated_at before update on public.customer_carts
  for each row execute function public.set_updated_at();

create table public.customer_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.customer_carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(12,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);
create index customer_cart_items_cart_idx on public.customer_cart_items(cart_id, created_at);
create trigger customer_cart_items_updated_at before update on public.customer_cart_items
  for each row execute function public.set_updated_at();

-- Notes are attached to a store within the cart so each child order receives
-- only the note intended for that merchant.
create table public.customer_cart_store_notes (
  cart_id uuid not null references public.customer_carts(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 1500),
  updated_at timestamptz not null default now(),
  primary key (cart_id, store_id)
);

create table public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  status public.customer_order_status not null default 'submitted',
  recipient_name text not null check (char_length(trim(recipient_name)) between 2 and 120),
  contact_phone text not null check (char_length(trim(contact_phone)) between 5 and 32),
  delivery_address text not null check (char_length(trim(delivery_address)) between 4 and 1000),
  delivery_zone_id uuid references public.delivery_zones(id) on delete restrict,
  delivery_zone_name_snapshot text not null,
  delivery_fee numeric(14,2) not null check (delivery_fee >= 0),
  delivery_currency public.currency_code not null default 'SYP' check (delivery_currency = 'SYP'),
  payment_method text not null default 'cash_on_delivery' check (payment_method = 'cash_on_delivery'),
  customer_note text not null default '' check (char_length(customer_note) <= 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_orders_customer_idx on public.customer_orders(customer_id, created_at desc);
create index customer_orders_status_idx on public.customer_orders(status, created_at desc);
create trigger customer_orders_updated_at before update on public.customer_orders
  for each row execute function public.set_updated_at();

create table public.store_orders (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  status public.store_order_status not null default 'awaiting_review',
  customer_note text not null default '' check (char_length(customer_note) <= 1500),
  rejection_reason text check (rejection_reason is null or char_length(trim(rejection_reason)) between 2 and 500),
  reviewed_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_order_id, store_id),
  unique (id, customer_order_id)
);
create index store_orders_store_status_idx on public.store_orders(store_id, status, created_at desc);
create index store_orders_parent_idx on public.store_orders(customer_order_id, created_at);
create trigger store_orders_updated_at before update on public.store_orders
  for each row execute function public.set_updated_at();

create table public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  store_order_id uuid not null references public.store_orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  product_title_snapshot text not null,
  selling_unit_snapshot text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price_snapshot numeric(14,2) not null check (unit_price_snapshot >= 0),
  currency public.currency_code not null,
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index store_order_items_order_idx on public.store_order_items(store_order_id, created_at);

-- Keep totals separated by currency; the application must never add SYP and USD.
create table public.store_order_totals (
  store_order_id uuid not null references public.store_orders(id) on delete restrict,
  currency public.currency_code not null,
  items_subtotal numeric(14,2) not null check (items_subtotal >= 0),
  primary key (store_order_id, currency)
);

create table public.customer_order_totals (
  customer_order_id uuid not null references public.customer_orders(id) on delete restrict,
  currency public.currency_code not null,
  items_subtotal numeric(14,2) not null check (items_subtotal >= 0),
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  total numeric(14,2) not null check (total >= 0),
  primary key (customer_order_id, currency),
  check (total = items_subtotal + delivery_fee)
);

create table public.store_order_status_history (
  id bigint generated always as identity primary key,
  store_order_id uuid not null references public.store_orders(id) on delete restrict,
  from_status public.store_order_status,
  to_status public.store_order_status not null,
  actor_id uuid references public.profiles(id) on delete set null,
  note text not null default '' check (char_length(note) <= 1500),
  created_at timestamptz not null default now()
);
create index store_order_history_order_idx on public.store_order_status_history(store_order_id, created_at);

create table public.delivery_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null unique references public.customer_orders(id) on delete restrict,
  status public.delivery_task_status not null default 'pending_stores',
  driver_id uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('accepted', 'picked_up', 'delivered')) = (driver_id is not null))
);
create index delivery_tasks_available_idx on public.delivery_tasks(status, created_at)
  where status = 'available';
create index delivery_tasks_driver_idx on public.delivery_tasks(driver_id, status, created_at desc);
create trigger delivery_tasks_updated_at before update on public.delivery_tasks
  for each row execute function public.set_updated_at();

create or replace function public.is_store_owner(target_store uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
    where s.id = target_store and m.owner_user_id = auth.uid()
  )
$$;

create or replace function public.is_approved_driver()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.driver_applications a on a.user_id = p.id
    where p.id = auth.uid() and p.role = 'driver' and a.status = 'accepted'
  )
$$;

-- SECURITY DEFINER visibility helpers prevent recursive RLS policy evaluation
-- between the parent, child, and delivery tables.
create or replace function public.can_view_customer_order(target_order uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.customer_orders co
    where co.id = target_order and (
      co.customer_id = auth.uid() or public.is_admin()
      or exists (select 1 from public.store_orders so where so.customer_order_id = co.id and public.is_store_owner(so.store_id))
      or exists (select 1 from public.delivery_tasks dt where dt.customer_order_id = co.id and dt.driver_id = auth.uid())
    )
  )
$$;

create or replace function public.can_view_store_order(target_store_order uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.store_orders so join public.customer_orders co on co.id = so.customer_order_id
    where so.id = target_store_order and (
      public.is_admin() or public.is_store_owner(so.store_id) or co.customer_id = auth.uid()
      or exists (select 1 from public.delivery_tasks dt where dt.customer_order_id = co.id and dt.driver_id = auth.uid())
    )
  )
$$;

create or replace function public.can_view_delivery_task(target_task uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.delivery_tasks dt join public.customer_orders co on co.id = dt.customer_order_id
    where dt.id = target_task and (
      public.is_admin() or dt.driver_id = auth.uid() or co.customer_id = auth.uid()
      or (dt.status = 'available' and public.is_approved_driver())
      or exists (select 1 from public.store_orders so where so.customer_order_id = co.id and public.is_store_owner(so.store_id))
    )
  )
$$;

create or replace function public.write_store_order_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.store_order_status_history(store_order_id, from_status, to_status, actor_id)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.store_order_status_history(store_order_id, from_status, to_status, actor_id, note)
    values (new.id, old.status, new.status, auth.uid(), coalesce(new.rejection_reason, ''));
  end if;
  return new;
end;
$$;
create trigger store_order_status_history_trigger
  after insert or update of status on public.store_orders
  for each row execute function public.write_store_order_history();

create or replace function public.refresh_customer_order_status(target_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  child_count integer;
  finished_count integer;
  all_delivered boolean;
  any_preparing boolean;
  any_ready boolean;
  delivery_status public.delivery_task_status;
  next_status public.customer_order_status;
begin
  select count(*), count(*) filter (where so.status in ('delivered', 'rejected', 'cancelled')),
    coalesce(bool_and(so.status = 'delivered'), false),
    coalesce(bool_or(so.status in ('preparing', 'ready_for_pickup', 'handed_to_driver', 'delivered')), false),
    coalesce(bool_or(so.status in ('ready_for_pickup', 'handed_to_driver', 'delivered')), false)
  into child_count, finished_count, all_delivered, any_preparing, any_ready
  from public.store_orders so where so.customer_order_id = target_order;

  if child_count = 0 then return; end if;
  select dt.status into delivery_status from public.delivery_tasks dt
    where dt.customer_order_id = target_order;
  if finished_count = child_count then
    next_status := case when all_delivered then 'delivered'::public.customer_order_status
      else 'partially_cancelled'::public.customer_order_status end;
  elsif delivery_status = 'picked_up' then next_status := 'out_for_delivery';
  elsif delivery_status = 'delivered' then next_status := 'delivered';
  elsif any_ready then next_status := 'ready_for_delivery';
  elsif any_preparing then next_status := 'in_progress';
  else next_status := 'submitted';
  end if;
  update public.customer_orders set status = next_status where id = target_order;
end;
$$;

create or replace function public.on_store_order_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  parent_customer uuid;
  store_name_value text;
  order_number_value bigint;
  target_driver uuid;
begin
  select co.customer_id, co.order_number into parent_customer, order_number_value
  from public.customer_orders co where co.id = new.customer_order_id;
  select s.name into store_name_value from public.stores s where s.id = new.store_id;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'preparing' then
      update public.store_orders set reviewed_at = coalesce(reviewed_at, now()) where id = new.id;
    elsif new.status = 'ready_for_pickup' then
      update public.store_orders set ready_at = coalesce(ready_at, now()) where id = new.id;
    elsif new.status = 'delivered' then
      update public.store_orders set delivered_at = coalesce(delivered_at, now()) where id = new.id;
    end if;

    if new.status in ('preparing', 'ready_for_pickup', 'rejected', 'cancelled') then
      insert into public.notifications(user_id, type, title, body, data)
      values (parent_customer, 'order', 'تحديث على طلبك',
        case new.status
          when 'preparing' then 'بدأ ' || coalesce(store_name_value, 'المتجر') || ' تجهيز طلبك.'
          when 'ready_for_pickup' then 'أصبح طلبك من ' || coalesce(store_name_value, 'المتجر') || ' جاهزًا للاستلام.'
          when 'rejected' then 'اعتذر ' || coalesce(store_name_value, 'المتجر') || ' عن تنفيذ هذا الجزء من طلبك.'
          else 'تم إلغاء الجزء الخاص بـ' || coalesce(store_name_value, 'المتجر') || '.'
        end,
        jsonb_build_object('orderId', new.customer_order_id, 'storeOrderId', new.id,
          'storeId', new.store_id, 'url', '/order-details?id=' || new.customer_order_id::text));
    end if;

    select dt.driver_id into target_driver from public.delivery_tasks dt
      where dt.customer_order_id = new.customer_order_id;
    if target_driver is not null and new.status in ('ready_for_pickup', 'rejected', 'cancelled') then
      insert into public.notifications(user_id, type, title, body, data)
      values (target_driver, 'order', 'تحديث على طلب التوصيل',
        'تغيرت حالة طلب رقم ' || order_number_value::text || ' من ' || coalesce(store_name_value, 'المتجر'),
        jsonb_build_object('orderId', new.customer_order_id, 'storeOrderId', new.id,
          'storeId', new.store_id, 'url', '/driver/orders'));
    end if;
  end if;
  perform public.refresh_customer_order_status(new.customer_order_id);
  return new;
end;
$$;
create trigger store_order_status_notify_trigger
  after insert or update of status on public.store_orders
  for each row execute function public.on_store_order_status_change();

create or replace function public.notify_customer_new_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id, type, title, body, data)
  values (new.customer_id, 'order', 'تم استلام طلبك',
    'تم إنشاء الطلب رقم ' || new.order_number::text || ' وإرساله إلى المتاجر للمراجعة.',
    jsonb_build_object('orderId', new.id, 'url', '/order-details?id=' || new.id::text));
  return new;
end;
$$;
create trigger customer_order_created_notification
  after insert on public.customer_orders
  for each row execute function public.notify_customer_new_order();

-- Reuse the inbox trigger function added by migration 20260930000400.
create trigger store_order_merchant_notification
  after insert on public.store_orders
  for each row execute function public.notify_merchant_of_new_order();

create or replace function public.make_order_delivery_available()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  stores_ready boolean;
  customer_id_value uuid;
  order_number_value bigint;
  driver_user uuid;
begin
  if new.status <> 'ready_for_pickup' or (tg_op = 'UPDATE' and old.status = new.status) then return new; end if;
  select co.customer_id, co.order_number into customer_id_value, order_number_value
    from public.customer_orders co where co.id = new.customer_order_id;
  select bool_and(so.status in ('ready_for_pickup', 'handed_to_driver', 'delivered'))
    into stores_ready from public.store_orders so where so.customer_order_id = new.customer_order_id;
  if not coalesce(stores_ready, false) then return new; end if;

  update public.delivery_tasks set status = 'available'
    where customer_order_id = new.customer_order_id and status = 'pending_stores';
  if not found then return new; end if;
  for driver_user in
    select p.id from public.profiles p
      join public.driver_applications da on da.user_id = p.id
      where p.role = 'driver' and da.status = 'accepted'
  loop
    insert into public.notifications(user_id, type, title, body, data)
    values (driver_user, 'order', 'طلب توصيل متاح',
      'الطلب رقم ' || order_number_value::text || ' جاهز للاستلام.',
      jsonb_build_object('orderId', new.customer_order_id, 'url', '/driver/orders'));
  end loop;
  insert into public.notifications(user_id, type, title, body, data)
  values (customer_id_value, 'order', 'طلبك جاهز للتوصيل',
    'أصبحت جميع الطلبات الفرعية جاهزة، ونبحث الآن عن سائق.',
    jsonb_build_object('orderId', new.customer_order_id, 'url', '/order-details?id=' || new.customer_order_id::text));
  return new;
end;
$$;
create trigger delivery_dispatch_after_store_ready
  after insert or update of status on public.store_orders
  for each row execute function public.make_order_delivery_available();

create or replace function public.create_order_from_cart(
  input_recipient_name text,
  input_contact_phone text,
  input_delivery_address text,
  input_delivery_zone uuid,
  input_customer_note text default ''
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_customer uuid := auth.uid();
  cart_row public.customer_carts%rowtype;
  zone_row public.delivery_zones%rowtype;
  new_order uuid;
  store_row record;
  created_store_order uuid;
  customer_name text;
begin
  if current_customer is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = current_customer and p.role = 'customer') then
    raise exception 'customer account required';
  end if;
  if nullif(trim(input_recipient_name), '') is null or nullif(trim(input_contact_phone), '') is null
     or nullif(trim(input_delivery_address), '') is null then
    raise exception 'recipient and delivery details are required';
  end if;
  if char_length(coalesce(input_customer_note, '')) > 1500 then raise exception 'customer note is too long'; end if;
  select * into zone_row from public.delivery_zones z
    where z.id = input_delivery_zone and z.is_active for share;
  if not found then raise exception 'delivery zone is unavailable'; end if;

  select * into cart_row from public.customer_carts c where c.customer_id = current_customer for update;
  if not found then raise exception 'cart is empty'; end if;
  if not exists (select 1 from public.customer_cart_items ci where ci.cart_id = cart_row.id) then
    raise exception 'cart is empty';
  end if;
  if exists (
    select 1 from public.customer_cart_items ci
      join public.products p on p.id = ci.product_id
      join public.stores s on s.id = p.store_id
      join public.merchants m on m.id = s.merchant_id
    where ci.cart_id = cart_row.id and (
      not p.is_available or s.status <> 'accepted' or m.status <> 'accepted'
      or ci.quantity < p.minimum_quantity
      or mod(ci.quantity - p.minimum_quantity, p.quantity_step) <> 0
    )
  ) then raise exception 'one or more cart items are unavailable or have an invalid quantity'; end if;

  select p.full_name into customer_name from public.profiles p where p.id = current_customer;
  insert into public.customer_orders(customer_id, recipient_name, contact_phone,
    delivery_address, delivery_zone_id, delivery_zone_name_snapshot, delivery_fee, customer_note)
  values (current_customer, trim(input_recipient_name), trim(input_contact_phone),
    trim(input_delivery_address), zone_row.id, zone_row.name, zone_row.fixed_fee,
    coalesce(trim(input_customer_note), ''))
  returning id into new_order;

  insert into public.delivery_tasks(customer_order_id, status) values (new_order, 'pending_stores');

  for store_row in
    select distinct p.store_id from public.customer_cart_items ci
      join public.products p on p.id = ci.product_id
    where ci.cart_id = cart_row.id order by p.store_id
  loop
    insert into public.store_orders(customer_order_id, store_id, customer_note)
    values (new_order, store_row.store_id,
      coalesce((select n.note from public.customer_cart_store_notes n
        where n.cart_id = cart_row.id and n.store_id = store_row.store_id), ''))
    returning id into created_store_order;

    insert into public.store_order_items(store_order_id, product_id, product_title_snapshot,
      selling_unit_snapshot, quantity, unit_price_snapshot, currency, line_total)
    select created_store_order, p.id, p.title, p.selling_unit, ci.quantity, p.price, p.currency,
      round(ci.quantity * p.price, 2)
    from public.customer_cart_items ci join public.products p on p.id = ci.product_id
    where ci.cart_id = cart_row.id and p.store_id = store_row.store_id;

    insert into public.store_order_totals(store_order_id, currency, items_subtotal)
    select soi.store_order_id, soi.currency, sum(soi.line_total)
    from public.store_order_items soi where soi.store_order_id = created_store_order
    group by soi.store_order_id, soi.currency;
  end loop;

  insert into public.customer_order_totals(customer_order_id, currency, items_subtotal, delivery_fee, total)
  select new_order, totals.currency, totals.items_subtotal,
    case when totals.currency = 'SYP' then zone_row.fixed_fee else 0 end,
    totals.items_subtotal + case when totals.currency = 'SYP' then zone_row.fixed_fee else 0 end
  from (
    select soi.currency, sum(soi.line_total) as items_subtotal
    from public.store_order_items soi join public.store_orders so on so.id = soi.store_order_id
    where so.customer_order_id = new_order group by soi.currency
    union all
    select 'SYP'::public.currency_code, 0::numeric where not exists (
      select 1 from public.store_order_items soi join public.store_orders so on so.id = soi.store_order_id
      where so.customer_order_id = new_order and soi.currency = 'SYP'
    )
  ) totals;

  delete from public.customer_cart_items where cart_id = cart_row.id;
  delete from public.customer_cart_store_notes where cart_id = cart_row.id;
  return new_order;
end;
$$;

create or replace function public.update_store_order_status(
  target_store_order uuid,
  next_status public.store_order_status,
  reason text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  order_row public.store_orders%rowtype;
begin
  select * into order_row from public.store_orders so where so.id = target_store_order for update;
  if not found then raise exception 'store order not found'; end if;
  if not public.is_admin() and not public.is_store_owner(order_row.store_id) then
    raise exception 'store owner or administrator access required';
  end if;
  if next_status = 'preparing' and order_row.status = 'awaiting_review' then
    update public.store_orders set status = 'preparing', rejection_reason = null where id = target_store_order;
  elsif next_status = 'ready_for_pickup' and order_row.status = 'preparing' then
    update public.store_orders set status = 'ready_for_pickup', rejection_reason = null where id = target_store_order;
  elsif next_status = 'rejected' and order_row.status = 'awaiting_review' then
    if nullif(trim(reason), '') is null then raise exception 'a rejection reason is required'; end if;
    update public.store_orders set status = 'rejected', rejection_reason = trim(reason) where id = target_store_order;
  else
    raise exception 'invalid store order status transition';
  end if;
end;
$$;

create or replace function public.accept_delivery_task(target_customer_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare task_row public.delivery_tasks%rowtype; customer_id_value uuid; order_number_value bigint;
begin
  if not public.is_approved_driver() then raise exception 'approved driver account required'; end if;
  select * into task_row from public.delivery_tasks dt
    where dt.customer_order_id = target_customer_order for update;
  if not found or task_row.status <> 'available' then raise exception 'delivery task is no longer available'; end if;
  update public.delivery_tasks set status = 'accepted', driver_id = auth.uid(), accepted_at = now()
    where id = task_row.id;
  select co.customer_id, co.order_number into customer_id_value, order_number_value
    from public.customer_orders co where co.id = target_customer_order;
  insert into public.notifications(user_id, type, title, body, data)
  values (customer_id_value, 'order', 'تم إسناد سائق لطلبك',
    'قبل السائق طلب التوصيل رقم ' || order_number_value::text || '.',
    jsonb_build_object('orderId', target_customer_order, 'url', '/order-details?id=' || target_customer_order::text));
  insert into public.notifications(user_id, type, title, body, data)
  select distinct m.owner_user_id, 'order', 'تم قبول توصيل الطلب',
    'قبل سائق توصيل الطلب رقم ' || order_number_value::text || '.',
    jsonb_build_object('orderId', target_customer_order, 'storeId', s.id, 'url', '/merchant/orders')
  from public.store_orders so join public.stores s on s.id = so.store_id
    join public.merchants m on m.id = s.merchant_id
  where so.customer_order_id = target_customer_order;
end;
$$;

create or replace function public.update_delivery_task_status(
  target_customer_order uuid,
  next_status public.delivery_task_status
)
returns void language plpgsql security definer set search_path = '' as $$
declare task_row public.delivery_tasks%rowtype; customer_id_value uuid; order_number_value bigint;
begin
  select * into task_row from public.delivery_tasks dt
    where dt.customer_order_id = target_customer_order for update;
  if not found then raise exception 'delivery task not found'; end if;
  if not public.is_admin() and (task_row.driver_id is distinct from auth.uid() or not public.is_approved_driver()) then
    raise exception 'assigned approved driver required';
  end if;
  if next_status = 'picked_up' and task_row.status = 'accepted' then
    update public.delivery_tasks set status = 'picked_up', picked_up_at = now() where id = task_row.id;
    update public.store_orders set status = 'handed_to_driver'
      where customer_order_id = target_customer_order and status = 'ready_for_pickup';
  elsif next_status = 'delivered' and task_row.status = 'picked_up' then
    update public.delivery_tasks set status = 'delivered', delivered_at = now() where id = task_row.id;
    update public.store_orders set status = 'delivered'
      where customer_order_id = target_customer_order and status = 'handed_to_driver';
  else
    raise exception 'invalid delivery task status transition';
  end if;
  select co.customer_id, co.order_number into customer_id_value, order_number_value
    from public.customer_orders co where co.id = target_customer_order;
  insert into public.notifications(user_id, type, title, body, data)
  values (customer_id_value, 'order',
    case when next_status = 'picked_up' then 'السائق استلم طلبك' else 'تم تسليم طلبك' end,
    'تحديث الطلب رقم ' || order_number_value::text || ': ' || next_status::text,
    jsonb_build_object('orderId', target_customer_order, 'url', '/order-details?id=' || target_customer_order::text));
end;
$$;

create or replace function public.cancel_customer_order(target_customer_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare order_row public.customer_orders%rowtype;
begin
  select * into order_row from public.customer_orders co
    where co.id = target_customer_order and co.customer_id = auth.uid() for update;
  if not found then raise exception 'customer order not found'; end if;
  if exists (select 1 from public.store_orders so where so.customer_order_id = target_customer_order
      and so.status <> 'awaiting_review') then
    raise exception 'order cannot be cancelled after any store begins preparation or review';
  end if;
  update public.store_orders set status = 'cancelled'
    where customer_order_id = target_customer_order and status = 'awaiting_review';
  update public.delivery_tasks set status = 'cancelled'
    where customer_order_id = target_customer_order and status = 'pending_stores';
  update public.customer_orders set status = 'cancelled' where id = target_customer_order;
end;
$$;

create or replace function public.notify_delivery_task_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare customer_id_value uuid; order_number_value bigint; store_user uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  select co.customer_id, co.order_number into customer_id_value, order_number_value
    from public.customer_orders co where co.id = new.customer_order_id;
  if new.status in ('picked_up', 'delivered') then
    for store_user in
      select distinct m.owner_user_id from public.store_orders so
        join public.stores s on s.id = so.store_id join public.merchants m on m.id = s.merchant_id
      where so.customer_order_id = new.customer_order_id
    loop
      insert into public.notifications(user_id, type, title, body, data)
      values (store_user, 'order',
        case when new.status = 'picked_up' then 'استلم السائق الطلب' else 'تم تسليم الطلب' end,
        'تحديث التوصيل للطلب رقم ' || order_number_value::text || '.',
        jsonb_build_object('orderId', new.customer_order_id, 'url', '/merchant/orders'));
    end loop;
  end if;
  return new;
end;
$$;
create trigger delivery_task_notification_trigger
  after update of status on public.delivery_tasks
  for each row execute function public.notify_delivery_task_change();

alter table public.delivery_zones enable row level security;
alter table public.customer_carts enable row level security;
alter table public.customer_cart_items enable row level security;
alter table public.customer_cart_store_notes enable row level security;
alter table public.customer_orders enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.store_order_totals enable row level security;
alter table public.customer_order_totals enable row level security;
alter table public.store_order_status_history enable row level security;
alter table public.delivery_tasks enable row level security;

create policy delivery_zones_read_active on public.delivery_zones for select to authenticated
  using (is_active or public.is_admin());
create policy delivery_zones_admin_manage on public.delivery_zones for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy customer_carts_own on public.customer_carts for all to authenticated
  using (customer_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer'))
  with check (customer_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer'));
create policy customer_cart_items_own on public.customer_cart_items for all to authenticated
  using (exists (select 1 from public.customer_carts c join public.profiles p on p.id = c.customer_id
    where c.id = cart_id and c.customer_id = auth.uid() and p.role = 'customer'))
  with check (exists (select 1 from public.customer_carts c join public.profiles p on p.id = c.customer_id
    where c.id = cart_id and c.customer_id = auth.uid() and p.role = 'customer'));
create policy customer_cart_notes_own on public.customer_cart_store_notes for all to authenticated
  using (exists (select 1 from public.customer_carts c join public.profiles p on p.id = c.customer_id
    where c.id = cart_id and c.customer_id = auth.uid() and p.role = 'customer'))
  with check (exists (select 1 from public.customer_carts c join public.profiles p on p.id = c.customer_id
    where c.id = cart_id and c.customer_id = auth.uid() and p.role = 'customer'));
create policy customer_orders_read_participants on public.customer_orders for select to authenticated
  using (public.can_view_customer_order(id));
create policy store_orders_read_participants on public.store_orders for select to authenticated
  using (public.can_view_store_order(id));
create policy store_order_items_read_participants on public.store_order_items for select to authenticated
  using (public.can_view_store_order(store_order_id));
create policy store_order_totals_read_participants on public.store_order_totals for select to authenticated
  using (public.can_view_store_order(store_order_id));
create policy customer_order_totals_read_participants on public.customer_order_totals for select to authenticated
  using (public.can_view_customer_order(customer_order_id));
create policy store_order_history_read_participants on public.store_order_status_history for select to authenticated
  using (public.can_view_store_order(store_order_id));
create policy delivery_tasks_read_participants on public.delivery_tasks for select to authenticated
  using (public.can_view_delivery_task(id));

grant select, insert, update, delete on public.customer_carts, public.customer_cart_items,
  public.customer_cart_store_notes to authenticated;
grant select on public.delivery_zones, public.customer_orders, public.store_orders,
  public.store_order_items, public.store_order_totals, public.customer_order_totals,
  public.store_order_status_history, public.delivery_tasks to authenticated;
grant insert, update, delete on public.delivery_zones to authenticated;
grant usage, select on sequence public.customer_orders_order_number_seq,
  public.store_order_status_history_id_seq to authenticated;

revoke all on function public.is_store_owner(uuid) from public, anon;
grant execute on function public.is_store_owner(uuid) to authenticated;
revoke all on function public.is_approved_driver() from public, anon;
grant execute on function public.is_approved_driver() to authenticated;
revoke all on function public.can_view_customer_order(uuid) from public, anon;
grant execute on function public.can_view_customer_order(uuid) to authenticated;
revoke all on function public.can_view_store_order(uuid) from public, anon;
grant execute on function public.can_view_store_order(uuid) to authenticated;
revoke all on function public.can_view_delivery_task(uuid) from public, anon;
grant execute on function public.can_view_delivery_task(uuid) to authenticated;
revoke all on function public.refresh_customer_order_status(uuid) from public, anon, authenticated;
revoke all on function public.write_store_order_history() from public, anon, authenticated;
revoke all on function public.on_store_order_status_change() from public, anon, authenticated;
revoke all on function public.notify_customer_new_order() from public, anon, authenticated;
revoke all on function public.make_order_delivery_available() from public, anon, authenticated;
revoke all on function public.notify_delivery_task_change() from public, anon, authenticated;

revoke all on function public.create_order_from_cart(text,text,text,uuid,text) from public, anon;
grant execute on function public.create_order_from_cart(text,text,text,uuid,text) to authenticated;
revoke all on function public.update_store_order_status(uuid,public.store_order_status,text) from public, anon;
grant execute on function public.update_store_order_status(uuid,public.store_order_status,text) to authenticated;
revoke all on function public.accept_delivery_task(uuid) from public, anon;
grant execute on function public.accept_delivery_task(uuid) to authenticated;
revoke all on function public.update_delivery_task_status(uuid,public.delivery_task_status) from public, anon;
grant execute on function public.update_delivery_task_status(uuid,public.delivery_task_status) to authenticated;
revoke all on function public.cancel_customer_order(uuid) from public, anon;
grant execute on function public.cancel_customer_order(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.customer_orders;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.store_orders;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.delivery_tasks;
exception when duplicate_object then null;
end $$;
