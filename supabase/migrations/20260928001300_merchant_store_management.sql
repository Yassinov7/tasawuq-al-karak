-- Merchant offer pricing, safe branch deletion, and tenant-write hardening.
-- Offers are discounts attached to a store-specific product price.

alter table public.store_products
  add column offer_price numeric(14,2),
  add column offer_starts_at timestamptz,
  add column offer_ends_at timestamptz,
  add constraint store_products_offer_price_check
    check (offer_price is null or (offer_price >= 0 and offer_price < price)),
  add constraint store_products_offer_window_check
    check (offer_ends_at is null or offer_starts_at is null or offer_ends_at > offer_starts_at);

create index store_products_active_offers_idx
  on public.store_products(offer_starts_at, offer_ends_at)
  where offer_price is not null;

create or replace function public.guard_store_product_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare store_currency public.currency_code;
begin
  select currency into store_currency
  from public.store_settings
  where store_id = new.store_id;
  if store_currency is null then raise exception 'store currency settings not found'; end if;
  if new.currency is distinct from store_currency then
    raise exception 'product price currency must match store currency';
  end if;
  return new;
end;
$$;

create trigger store_product_currency_guard
  before insert or update of store_id, currency on public.store_products
  for each row execute function public.guard_store_product_currency();

-- A store's merchant cannot be changed by a merchant-side update. Approval
-- metadata continues to be protected by the existing guard trigger.
create or replace function public.guard_store_merchant_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and new.merchant_id is distinct from old.merchant_id then
    raise exception 'store merchant cannot be changed';
  end if;
  return new;
end;
$$;

create trigger store_merchant_owner_guard
  before update on public.stores
  for each row execute function public.guard_store_merchant_owner();

-- Physical deletion is allowed only when the branch has no order history and
-- no customer's cart references it. Otherwise it must remain for accounting.
create or replace function public.store_has_no_activity(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (public.is_admin() or public.owns_store(target_store))
    and not exists (
    select 1 from public.sub_orders so where so.store_id = target_store
  ) and not exists (
    select 1
    from public.store_products sp
    join public.cart_items ci on ci.store_product_id = sp.id
    where sp.store_id = target_store
  )
$$;
revoke all on function public.store_has_no_activity(uuid) from public, anon;
grant execute on function public.store_has_no_activity(uuid) to authenticated;

create policy stores_member_delete_inactive
  on public.stores for delete to authenticated
  using (
    public.store_has_no_activity(id)
    and (public.is_admin() or public.owns_store(id))
  );

-- Merchant subscription requests must refer to an active plan and an approved
-- merchant. The trigger snapshots the plan values instead of trusting a client.
drop policy subscriptions_member_create on public.merchant_subscriptions;
create policy subscriptions_member_create
  on public.merchant_subscriptions for insert to authenticated
  with check (
    public.is_admin()
    or (
      exists (
        select 1 from public.merchant_members mm
        join public.merchants m on m.id = mm.merchant_id
        where mm.merchant_id = merchant_subscriptions.merchant_id
          and mm.user_id = auth.uid()
          and mm.member_role = 'owner'
          and m.approval = 'approved'
      )
      and exists (
        select 1 from public.subscription_plans p
        where p.id = merchant_subscriptions.plan_id and p.is_active
      )
    )
  );

create or replace function public.snapshot_merchant_subscription_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare selected_plan public.subscription_plans%rowtype;
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      select * into selected_plan
      from public.subscription_plans
      where id = new.plan_id and is_active;
      if not found then raise exception 'active subscription plan not found'; end if;
      new.status := 'pending';
      new.starts_at := null;
      new.expires_at := null;
      new.price_snapshot := selected_plan.price;
      new.currency_snapshot := selected_plan.currency;
      new.duration_months_snapshot := selected_plan.duration_months;
      new.commission_rate_override := null;
      new.commission_rate_snapshot := selected_plan.commission_rate;
    else
      raise exception 'only administrators can change a merchant subscription';
    end if;
  end if;
  return new;
end;
$$;

drop trigger subscription_status_guard on public.merchant_subscriptions;
create trigger subscription_plan_snapshot_guard
  before insert or update on public.merchant_subscriptions
  for each row execute function public.snapshot_merchant_subscription_plan();

-- Use the current offer price during order creation so the displayed price,
-- charged total, commission, and invoice all match.
create or replace function public.effective_store_product_price(
  base_price numeric,
  discounted_price numeric,
  starts_at timestamptz,
  ends_at timestamptz
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when discounted_price is not null
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    then discounted_price
    else base_price
  end
$$;
revoke all on function public.effective_store_product_price(numeric,numeric,timestamptz,timestamptz) from public, anon, authenticated;

create or replace function public.place_order_from_cart(target_address uuid, requested_method public.payment_method default 'cash', note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  customer_id_value uuid := auth.uid();
  cart_id_value uuid;
  address_row public.customer_addresses%rowtype;
  zone_row public.delivery_zones%rowtype;
  store_row record;
  item_row record;
  order_id_value uuid;
  order_currency public.currency_code;
  currency_count integer;
  item_subtotal numeric(14,2);
  subtotal_value numeric(14,2) := 0;
  delivery_value numeric(14,2) := 0;
  fee_value numeric(14,2);
  store_count integer;
  store_fee numeric(14,2);
  store_mode text;
begin
  if customer_id_value is null then raise exception 'authentication required'; end if;
  if requested_method <> 'cash' then raise exception 'only cash payment is currently enabled'; end if;
  select * into address_row from public.customer_addresses where id=target_address and customer_id=customer_id_value;
  if not found then raise exception 'address not found'; end if;
  select * into zone_row from public.delivery_zones where id=address_row.zone_id and is_active;
  if not found then raise exception 'delivery zone is unavailable'; end if;
  select c.id into cart_id_value from public.carts c where c.customer_id=customer_id_value for update;
  if cart_id_value is null or not exists(select 1 from public.cart_items ci where ci.cart_id=cart_id_value) then raise exception 'cart is empty'; end if;
  select count(distinct sp.currency), min(sp.currency::text)::public.currency_code
    into currency_count, order_currency
    from public.cart_items ci join public.store_products sp on sp.id=ci.store_product_id
    where ci.cart_id=cart_id_value;
  if currency_count <> 1 then raise exception 'all items in one order must use the same currency'; end if;
  if exists (
    select 1 from public.cart_items ci
    join public.store_products sp on sp.id=ci.store_product_id
    join public.products p on p.id=sp.product_id and p.store_id=sp.store_id
    join public.stores s on s.id=sp.store_id
    join public.store_settings ss on ss.store_id=s.id
    where ci.cart_id=cart_id_value and (not sp.is_active or p.availability <> 'available'
      or s.status <> 'approved' or not ss.accepts_orders or ss.currency <> sp.currency
      or ci.quantity < sp.minimum_quantity
      or mod(ci.quantity-sp.minimum_quantity, sp.quantity_step) <> 0)
  ) then raise exception 'cart contains unavailable or invalid items'; end if;
  select count(distinct sp.store_id) into store_count from public.cart_items ci
    join public.store_products sp on sp.id=ci.store_product_id where ci.cart_id=cart_id_value;
  if store_count > 1 then
    delivery_value := zone_row.fixed_fee;
  else
    select ss.delivery_mode, ss.store_delivery_fee into store_mode, store_fee
      from public.cart_items ci join public.store_products sp on sp.id=ci.store_product_id
      join public.store_settings ss on ss.store_id=sp.store_id
      where ci.cart_id=cart_id_value limit 1;
    delivery_value := case when store_mode='store' then store_fee else zone_row.fixed_fee end;
  end if;
  if (store_count > 1 or coalesce(store_mode,'platform') <> 'store') and order_currency <> zone_row.currency then
    raise exception 'delivery fee currency must match item currency';
  end if;
  if store_count = 1 and store_mode='store' and store_fee < 0 then raise exception 'invalid store delivery fee'; end if;
  select coalesce(sum(round(ci.quantity * public.effective_store_product_price(sp.price,sp.offer_price,sp.offer_starts_at,sp.offer_ends_at),2)),0)::numeric(14,2)
    into subtotal_value
    from public.cart_items ci join public.store_products sp on sp.id=ci.store_product_id where ci.cart_id=cart_id_value;
  insert into public.orders(customer_id,address_id,zone_id,status,currency,subtotal,delivery_fee,total,payment_method,payment_status,customer_note)
    values (customer_id_value,address_row.id,zone_row.id,'pending',order_currency,subtotal_value,delivery_value,subtotal_value+delivery_value,'cash','pending',coalesce(note,''))
    returning id into order_id_value;
  for store_row in
    select distinct sp.store_id, ss.delivery_mode, ss.store_delivery_fee
      from public.cart_items ci join public.store_products sp on sp.id=ci.store_product_id
      join public.store_settings ss on ss.store_id=sp.store_id
      where ci.cart_id=cart_id_value order by sp.store_id
  loop
    select coalesce(sum(round(ci.quantity * public.effective_store_product_price(sp.price,sp.offer_price,sp.offer_starts_at,sp.offer_ends_at),2)),0)::numeric(14,2)
      into item_subtotal
      from public.cart_items ci join public.store_products sp on sp.id=ci.store_product_id
      where ci.cart_id=cart_id_value and sp.store_id=store_row.store_id;
    fee_value := case when store_count=1 and store_row.delivery_mode='store' then store_row.store_delivery_fee
                      when store_count=1 then zone_row.fixed_fee else 0 end;
    insert into public.sub_orders(order_id,store_id,status,currency,subtotal,delivery_fee,store_delivery_enabled)
      values (order_id_value,store_row.store_id,'pending',order_currency,item_subtotal,fee_value,store_count=1 and store_row.delivery_mode='store');
    for item_row in
      select ci.quantity, sp.id store_product_id,
        public.effective_store_product_price(sp.price,sp.offer_price,sp.offer_starts_at,sp.offer_ends_at) price,
        sp.currency, sp.selling_unit, p.name
      from public.cart_items ci join public.store_products sp on sp.id=ci.store_product_id
      join public.products p on p.id=sp.product_id and p.store_id=sp.store_id
      where ci.cart_id=cart_id_value and sp.store_id=store_row.store_id
    loop
      insert into public.order_items(sub_order_id,store_product_id,product_name,selling_unit,quantity,unit_price,currency,line_total)
      select so.id,item_row.store_product_id,item_row.name,item_row.selling_unit,item_row.quantity,item_row.price,item_row.currency,
             round(item_row.quantity*item_row.price,2)::numeric(14,2)
      from public.sub_orders so where so.order_id=order_id_value and so.store_id=store_row.store_id;
    end loop;
    insert into public.order_status_history(sub_order_id,status,changed_by) select id,'pending',customer_id_value
      from public.sub_orders where order_id=order_id_value and store_id=store_row.store_id;
  end loop;
  insert into public.order_status_history(order_id,status,changed_by) values (order_id_value,'pending',customer_id_value);
  insert into public.payments(order_id,method,status,amount,currency) values (order_id_value,'cash','pending',subtotal_value+delivery_value,order_currency);
  delete from public.cart_items where cart_id=cart_id_value;
  return order_id_value;
end;
$$;
revoke all on function public.place_order_from_cart(uuid,public.payment_method,text) from public, anon;
grant execute on function public.place_order_from_cart(uuid,public.payment_method,text) to authenticated;
