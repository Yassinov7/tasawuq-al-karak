-- Persist customer delivery addresses and explicitly selected offer bundles.
-- Order lines keep offer snapshots so historical order displays never depend
-- on an offer that may later be edited or deactivated.

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 80),
  recipient_name text not null check (char_length(trim(recipient_name)) between 2 and 120),
  contact_phone text not null check (char_length(trim(contact_phone)) between 5 and 32),
  delivery_address text not null check (char_length(trim(delivery_address)) between 4 and 1000),
  delivery_zone_id uuid not null references public.delivery_zones(id) on delete restrict,
  maps_url text not null default '' check (char_length(maps_url) <= 1000),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customer_addresses_one_default_idx
  on public.customer_addresses(customer_id) where is_default;
create index customer_addresses_customer_idx
  on public.customer_addresses(customer_id, created_at);
create trigger customer_addresses_updated_at before update on public.customer_addresses
  for each row execute function public.set_updated_at();

alter table public.customer_addresses enable row level security;
create policy customer_addresses_owner_read on public.customer_addresses
  for select to authenticated using (customer_id = auth.uid());
grant select on public.customer_addresses to authenticated;
revoke insert, update, delete on public.customer_addresses from anon, authenticated;

create or replace function public.save_customer_address(
  target_address uuid,
  input_title text,
  input_recipient_name text,
  input_contact_phone text,
  input_delivery_address text,
  input_delivery_zone uuid,
  input_maps_url text,
  input_is_default boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer uuid := auth.uid();
  saved_id uuid;
  make_default boolean;
begin
  if current_customer is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = current_customer and p.role = 'customer'
  ) then raise exception 'customer account required'; end if;
  if nullif(trim(input_title), '') is null
     or nullif(trim(input_recipient_name), '') is null
     or nullif(trim(input_contact_phone), '') is null
     or nullif(trim(input_delivery_address), '') is null then
    raise exception 'address details are required';
  end if;
  if char_length(trim(input_title)) > 80
     or char_length(trim(input_recipient_name)) > 120
     or char_length(trim(input_contact_phone)) > 32
     or char_length(trim(input_delivery_address)) > 1000
     or char_length(coalesce(input_maps_url, '')) > 1000 then
    raise exception 'address details exceed the allowed length';
  end if;
  if nullif(trim(coalesce(input_maps_url, '')), '') is not null
     and trim(input_maps_url) !~* '^https?://' then
    raise exception 'map link must be an http or https URL';
  end if;
  if not exists (
    select 1 from public.delivery_zones z
    where z.id = input_delivery_zone and z.is_active
  ) then raise exception 'delivery zone is unavailable'; end if;

  if target_address is not null and not exists (
    select 1 from public.customer_addresses a
    where a.id = target_address and a.customer_id = current_customer
  ) then raise exception 'customer address not found'; end if;

  make_default := coalesce(input_is_default, false)
    or not exists (
      select 1 from public.customer_addresses a
      where a.customer_id = current_customer and a.is_default
        and a.id is distinct from target_address
    );
  if make_default then
    update public.customer_addresses
    set is_default = false
    where customer_id = current_customer and is_default;
  end if;

  if target_address is null then
    insert into public.customer_addresses(
      customer_id, title, recipient_name, contact_phone, delivery_address,
      delivery_zone_id, maps_url, is_default
    )
    values (
      current_customer, trim(input_title), trim(input_recipient_name),
      trim(input_contact_phone), trim(input_delivery_address), input_delivery_zone,
      coalesce(trim(input_maps_url), ''), make_default
    )
    returning id into saved_id;
  else
    update public.customer_addresses
    set title = trim(input_title),
        recipient_name = trim(input_recipient_name),
        contact_phone = trim(input_contact_phone),
        delivery_address = trim(input_delivery_address),
        delivery_zone_id = input_delivery_zone,
        maps_url = coalesce(trim(input_maps_url), ''),
        is_default = make_default
    where id = target_address and customer_id = current_customer
    returning id into saved_id;
  end if;

  return saved_id;
end;
$$;

create or replace function public.set_default_customer_address(target_address uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_customer uuid := auth.uid();
begin
  if current_customer is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = current_customer and p.role = 'customer'
  ) then raise exception 'customer account required'; end if;
  if not exists (
    select 1 from public.customer_addresses a
    where a.id = target_address and a.customer_id = current_customer
  ) then raise exception 'customer address not found'; end if;
  update public.customer_addresses
  set is_default = false
  where customer_id = current_customer and is_default;
  update public.customer_addresses
  set is_default = true
  where id = target_address and customer_id = current_customer;
end;
$$;

create or replace function public.delete_customer_address(target_address uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_customer uuid := auth.uid(); was_default boolean;
begin
  if current_customer is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = current_customer and p.role = 'customer'
  ) then raise exception 'customer account required'; end if;
  delete from public.customer_addresses
  where id = target_address and customer_id = current_customer
  returning is_default into was_default;
  if was_default is null then raise exception 'customer address not found'; end if;
  if was_default then
    update public.customer_addresses
    set is_default = true
    where id = (
      select a.id from public.customer_addresses a
      where a.customer_id = current_customer
      order by a.created_at asc
      limit 1
    );
  end if;
end;
$$;

revoke all on function public.save_customer_address(uuid,text,text,text,text,uuid,text,boolean)
  from public, anon;
revoke all on function public.set_default_customer_address(uuid) from public, anon;
revoke all on function public.delete_customer_address(uuid) from public, anon;
grant execute on function public.save_customer_address(uuid,text,text,text,text,uuid,text,boolean)
  to authenticated;
grant execute on function public.set_default_customer_address(uuid) to authenticated;
grant execute on function public.delete_customer_address(uuid) to authenticated;

create table public.customer_cart_offer_selections (
  cart_id uuid not null references public.customer_carts(id) on delete cascade,
  offer_id uuid not null references public.store_offers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cart_id, offer_id)
);
alter table public.customer_cart_offer_selections enable row level security;
create policy customer_cart_offer_selections_read on public.customer_cart_offer_selections
  for select to authenticated using (
    exists (
      select 1 from public.customer_carts c
      where c.id = cart_id and c.customer_id = auth.uid()
    )
  );
grant select on public.customer_cart_offer_selections to authenticated;
revoke insert, update, delete on public.customer_cart_offer_selections from anon, authenticated;

create or replace function public.add_customer_cart_offer(target_offer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer uuid := auth.uid();
  target_cart uuid;
begin
  if current_customer is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = current_customer and p.role = 'customer'
  ) then raise exception 'customer account required'; end if;
  if not exists (
    select 1 from public.store_offers o
      join public.stores s on s.id = o.store_id
      join public.merchants m on m.id = s.merchant_id
    where o.id = target_offer and o.is_active
      and o.starts_at <= now() and (o.ends_at is null or o.ends_at > now())
      and s.status = 'accepted' and m.status = 'accepted'
  ) then raise exception 'offer is unavailable'; end if;

  if not exists (
    select 1
    from public.store_offer_products op
      join public.products p on p.id = op.product_id and p.store_id = op.store_id
      join public.store_offers o on o.id = op.offer_id
    where op.offer_id = target_offer
  ) or exists (
    select 1
    from public.store_offer_products op
      join public.products p on p.id = op.product_id and p.store_id = op.store_id
      join public.store_offers o on o.id = op.offer_id
    where op.offer_id = target_offer
      and (not p.is_available or p.currency <> o.currency)
  ) then raise exception 'offer products are unavailable or use a different currency'; end if;

  insert into public.customer_carts(customer_id)
  values (current_customer)
  on conflict (customer_id) do update set updated_at = now()
  returning id into target_cart;

  insert into public.customer_cart_offer_selections(cart_id, offer_id)
  values (target_cart, target_offer)
  on conflict (cart_id, offer_id) do nothing;
end;
$$;

create or replace function public.remove_customer_cart_offer(target_offer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_customer uuid := auth.uid();
begin
  if current_customer is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = current_customer and p.role = 'customer'
  ) then raise exception 'customer account required'; end if;
  delete from public.customer_cart_offer_selections selection
  using public.customer_carts cart
  where selection.cart_id = cart.id
    and cart.customer_id = current_customer
    and selection.offer_id = target_offer;
end;
$$;

revoke all on function public.add_customer_cart_offer(uuid) from public, anon;
revoke all on function public.remove_customer_cart_offer(uuid) from public, anon;
grant execute on function public.add_customer_cart_offer(uuid) to authenticated;
grant execute on function public.remove_customer_cart_offer(uuid) to authenticated;

alter table public.store_order_items
  add column offer_snapshot jsonb;

create or replace function public.create_order_from_cart(
  input_recipient_name text,
  input_contact_phone text,
  input_delivery_address text,
  input_delivery_zone uuid,
  input_customer_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer uuid := auth.uid();
  cart_row public.customer_carts%rowtype;
  zone_row public.delivery_zones%rowtype;
  new_order uuid;
  store_row record;
  created_store_order uuid;
  offer_row record;
  offer_item record;
  offer_original_total numeric(14,2);
  offer_bundle_total numeric(14,2);
  allocated_total numeric(14,2);
  item_original_total numeric(14,2);
  item_final_total numeric(14,2);
  item_quantity numeric(12,3);
  item_unit_price numeric(14,2);
  offer_item_count integer;
  offer_item_index integer;
  item_offer_role public.offer_product_role;
  item_offer_snapshot jsonb;
begin
  if current_customer is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = current_customer and p.role = 'customer'
  ) then raise exception 'customer account required'; end if;
  if nullif(trim(input_recipient_name), '') is null
     or nullif(trim(input_contact_phone), '') is null
     or nullif(trim(input_delivery_address), '') is null then
    raise exception 'recipient and delivery details are required';
  end if;
  if char_length(trim(input_recipient_name)) > 120
     or char_length(trim(input_contact_phone)) > 32
     or char_length(trim(input_delivery_address)) > 1000 then
    raise exception 'delivery details exceed the allowed length';
  end if;
  if char_length(coalesce(input_customer_note, '')) > 1500 then
    raise exception 'customer note is too long';
  end if;

  select * into zone_row
  from public.delivery_zones z
  where z.id = input_delivery_zone and z.is_active
  for share;
  if not found then raise exception 'delivery zone is unavailable'; end if;

  select * into cart_row
  from public.customer_carts c
  where c.customer_id = current_customer
  for update;
  if not found then raise exception 'cart is empty'; end if;
  if not exists (
    select 1 from public.customer_cart_items ci where ci.cart_id = cart_row.id
  ) and not exists (
    select 1 from public.customer_cart_offer_selections selection
    where selection.cart_id = cart_row.id
  ) then raise exception 'cart is empty'; end if;

  if exists (
    select 1
    from public.customer_cart_items ci
      join public.products p on p.id = ci.product_id
      join public.stores s on s.id = p.store_id
      join public.merchants m on m.id = s.merchant_id
    where ci.cart_id = cart_row.id and (
      not p.is_available or s.status <> 'accepted' or m.status <> 'accepted'
      or ci.quantity < p.minimum_quantity
      or mod(ci.quantity - p.minimum_quantity, p.quantity_step) <> 0
    )
  ) then raise exception 'one or more cart items are unavailable or have an invalid quantity'; end if;

  if exists (
    select 1
    from public.customer_cart_offer_selections selection
      join public.store_offers o on o.id = selection.offer_id
      join public.stores s on s.id = o.store_id
      join public.merchants m on m.id = s.merchant_id
    where selection.cart_id = cart_row.id and (
      not o.is_active or o.starts_at > now() or (o.ends_at is not null and o.ends_at <= now())
      or s.status <> 'accepted' or m.status <> 'accepted'
      or exists (
        select 1 from public.store_offer_products op
          left join public.products p on p.id = op.product_id and p.store_id = op.store_id
        where op.offer_id = o.id and (p.id is null or not p.is_available)
      )
    )
  ) then raise exception 'one or more selected offers are no longer available'; end if;

  if (
    select count(distinct cart_currency.currency)
    from (
      select p.currency
      from public.customer_cart_items ci
        join public.products p on p.id = ci.product_id
      where ci.cart_id = cart_row.id
      union
      select p.currency
      from public.customer_cart_offer_selections selection
        join public.store_offer_products op on op.offer_id = selection.offer_id
        join public.products p on p.id = op.product_id and p.store_id = op.store_id
      where selection.cart_id = cart_row.id
    ) cart_currency
  ) > 1 then
    raise exception 'cart cannot contain products with different currencies';
  end if;

  if exists (
    select 1
    from public.customer_cart_offer_selections selection
      join public.store_offers o on o.id = selection.offer_id
      join public.store_offer_products op on op.offer_id = o.id
      join public.products p on p.id = op.product_id and p.store_id = op.store_id
    where selection.cart_id = cart_row.id and o.currency <> p.currency
  ) then raise exception 'selected offer currency does not match its products'; end if;

  if exists (
    select 1
    from public.customer_cart_offer_selections selection
      join public.store_offer_products op on op.offer_id = selection.offer_id
      join public.products p on p.id = op.product_id and p.store_id = op.store_id
    where selection.cart_id = cart_row.id and p.is_available and (
      op.quantity < p.minimum_quantity
      or mod(op.quantity - p.minimum_quantity, p.quantity_step) <> 0
    )
  ) then raise exception 'selected offer contains a product quantity that is not valid for sale'; end if;

  insert into public.customer_orders(
    customer_id, recipient_name, contact_phone, delivery_address,
    delivery_zone_id, delivery_zone_name_snapshot, delivery_fee, customer_note
  )
  values (
    current_customer, trim(input_recipient_name), trim(input_contact_phone),
    trim(input_delivery_address), zone_row.id, zone_row.name, zone_row.fixed_fee,
    coalesce(trim(input_customer_note), '')
  )
  returning id into new_order;

  insert into public.delivery_tasks(customer_order_id, status)
  values (new_order, 'pending_stores');

  for store_row in
    select distinct p.store_id
    from public.customer_cart_items ci
      join public.products p on p.id = ci.product_id
    where ci.cart_id = cart_row.id
    union
    select distinct o.store_id
    from public.customer_cart_offer_selections selection
      join public.store_offers o on o.id = selection.offer_id
    where selection.cart_id = cart_row.id
    order by store_id
  loop
    insert into public.store_orders(customer_order_id, store_id, customer_note)
    values (
      new_order, store_row.store_id,
      coalesce((
        select n.note from public.customer_cart_store_notes n
        where n.cart_id = cart_row.id and n.store_id = store_row.store_id
      ), '')
    )
    returning id into created_store_order;

    insert into public.store_order_items(
      store_order_id, product_id, product_title_snapshot, selling_unit_snapshot,
      quantity, unit_price_snapshot, currency, line_total
    )
    select
      created_store_order, p.id, p.title, p.selling_unit, ci.quantity, p.price,
      p.currency, round(ci.quantity * p.price, 2)
    from public.customer_cart_items ci
      join public.products p on p.id = ci.product_id
    where ci.cart_id = cart_row.id and p.store_id = store_row.store_id;

    for offer_row in
      select o.*
      from public.customer_cart_offer_selections selection
        join public.store_offers o on o.id = selection.offer_id
      where selection.cart_id = cart_row.id and o.store_id = store_row.store_id
      order by o.id
    loop
      select count(*)::integer
      into offer_item_count
      from public.store_offer_products op
      where op.offer_id = offer_row.id;

      select round(sum(round(p.price * op.quantity, 2)), 2)
      into offer_original_total
      from public.store_offer_products op
        join public.products p on p.id = op.product_id and p.store_id = op.store_id
      where op.offer_id = offer_row.id;

      if offer_item_count = 0 or offer_original_total is null then
        raise exception 'selected offer has no available products';
      end if;
      offer_bundle_total := round(coalesce(offer_row.bundle_price, 0), 2);
      allocated_total := 0;
      offer_item_index := 0;

      for offer_item in
        select op.product_id, op.item_role, op.quantity, p.title,
          p.selling_unit, p.price, p.currency
        from public.store_offer_products op
          join public.products p on p.id = op.product_id and p.store_id = op.store_id
        where op.offer_id = offer_row.id and p.is_available
        order by op.id
      loop
        offer_item_index := offer_item_index + 1;
        item_quantity := offer_item.quantity;
        item_original_total := round(offer_item.price * item_quantity, 2);
        item_offer_role := offer_item.item_role;
        item_final_total := item_original_total;

        if offer_row.offer_type = 'discount' then
          if item_offer_role <> 'discounted' then
            raise exception 'discount offer contains an invalid product role';
          end if;
          if offer_row.discount_method = 'percentage' then
            item_final_total := round(
              item_original_total * (100 - offer_row.discount_value) / 100, 2
            );
          elsif offer_row.discount_method = 'fixed_amount' then
            item_final_total := round(
              greatest(0, offer_item.price - offer_row.discount_value) * item_quantity, 2
            );
          else
            raise exception 'discount offer is missing its discount rule';
          end if;
        elsif offer_row.offer_type = 'bundle' then
          if item_offer_role <> 'bundle' then
            raise exception 'bundle offer contains an invalid product role';
          end if;
          if offer_row.currency <> offer_item.currency then
            raise exception 'bundle offer currency does not match its products';
          end if;
          if offer_item_index = offer_item_count then
            item_final_total := offer_bundle_total - allocated_total;
          else
            item_final_total := round(
              offer_bundle_total * item_original_total / offer_original_total, 2
            );
            allocated_total := allocated_total + item_final_total;
          end if;
        elsif offer_row.offer_type = 'buy_x_get_y' then
          if offer_row.currency <> offer_item.currency then
            raise exception 'buy X get Y offer currency does not match its products';
          end if;
          if item_offer_role = 'reward' then
            item_final_total := 0;
          elsif item_offer_role <> 'buy' then
            raise exception 'buy X get Y offer contains an invalid product role';
          end if;
        end if;

        item_unit_price := case
          when item_quantity > 0 then round(item_final_total / item_quantity, 2)
          else 0
        end;
        item_offer_snapshot := jsonb_build_object(
          'offer_id', offer_row.id,
          'title', offer_row.title,
          'offer_type', offer_row.offer_type,
          'discount_method', offer_row.discount_method,
          'discount_value', offer_row.discount_value,
          'bundle_price', offer_row.bundle_price,
          'currency', offer_row.currency,
          'item_role', item_offer_role,
          'original_line_total', item_original_total,
          'final_line_total', item_final_total
        );

        insert into public.store_order_items(
          store_order_id, product_id, product_title_snapshot, selling_unit_snapshot,
          quantity, unit_price_snapshot, currency, line_total, offer_snapshot
        )
        values (
          created_store_order, offer_item.product_id, offer_item.title,
          offer_item.selling_unit, item_quantity, item_unit_price,
          offer_item.currency, item_final_total, item_offer_snapshot
        );
      end loop;
    end loop;

    insert into public.store_order_totals(store_order_id, currency, items_subtotal)
    select soi.store_order_id, soi.currency, sum(soi.line_total)
    from public.store_order_items soi
    where soi.store_order_id = created_store_order
    group by soi.store_order_id, soi.currency;
  end loop;

  insert into public.customer_order_totals(
    customer_order_id, currency, items_subtotal, delivery_fee, total
  )
  select new_order, totals.currency, totals.items_subtotal,
    case when totals.currency = 'SYP' then zone_row.fixed_fee else 0 end,
    totals.items_subtotal + case when totals.currency = 'SYP' then zone_row.fixed_fee else 0 end
  from (
    select soi.currency, sum(soi.line_total) as items_subtotal
    from public.store_order_items soi
      join public.store_orders so on so.id = soi.store_order_id
    where so.customer_order_id = new_order
    group by soi.currency
    union all
    select 'SYP'::public.currency_code, 0::numeric
    where not exists (
      select 1 from public.store_order_items soi
        join public.store_orders so on so.id = soi.store_order_id
      where so.customer_order_id = new_order and soi.currency = 'SYP'
    )
  ) totals;

  delete from public.customer_cart_items where cart_id = cart_row.id;
  delete from public.customer_cart_store_notes where cart_id = cart_row.id;
  delete from public.customer_cart_offer_selections where cart_id = cart_row.id;
  return new_order;
end;
$$;

revoke all on function public.create_order_from_cart(text,text,text,uuid,text)
  from public, anon;
grant execute on function public.create_order_from_cart(text,text,text,uuid,text)
  to authenticated;
