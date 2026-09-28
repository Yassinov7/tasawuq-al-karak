-- RLS, access policies, transactional order functions, and development seeds.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
$$;
create or replace function public.owns_store(target_store uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.stores s join public.merchant_members mm on mm.merchant_id = s.merchant_id
    where s.id = target_store and mm.user_id = auth.uid()
  )
$$;
create or replace function public.can_cancel_order(target_order uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.sub_orders so where so.order_id = target_order and so.preparation_started_at is not null)
$$;

-- RLS baseline: public can discover approved stores and available items; writes are scoped to owner/admin.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.merchants enable row level security;
alter table public.merchant_members enable row level security;
alter table public.stores enable row level security;
alter table public.store_settings enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.store_products enable row level security;
alter table public.product_images enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.sub_orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.drivers enable row level security;
alter table public.payments enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.merchant_subscriptions enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy roles_select_self on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy roles_admin_all on public.user_roles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy merchants_select_member on public.merchants for select to authenticated using (public.is_admin() or exists(select 1 from public.merchant_members mm where mm.merchant_id=id and mm.user_id=auth.uid()));
create policy merchants_insert_owner on public.merchants for insert to authenticated with check (owner_user_id=auth.uid());
create policy merchants_update_admin on public.merchants for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy members_select_self_admin on public.merchant_members for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy members_admin_manage on public.merchant_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy stores_public_approved on public.stores for select to anon, authenticated using (status='approved' or public.is_admin() or public.owns_store(id));
create policy stores_member_insert on public.stores for insert to authenticated with check (public.is_admin() or exists(select 1 from public.merchant_members mm where mm.merchant_id=public.stores.merchant_id and mm.user_id=auth.uid()));
create policy stores_member_update on public.stores for update to authenticated using (public.is_admin() or public.owns_store(id)) with check (public.is_admin() or public.owns_store(id));
create policy store_settings_public_read on public.store_settings for select to anon, authenticated using (exists(select 1 from public.stores s where s.id=store_id and s.status='approved') or public.is_admin() or public.owns_store(store_id));
create policy store_settings_owner_write on public.store_settings for all to authenticated using (public.is_admin() or public.owns_store(store_id)) with check (public.is_admin() or public.owns_store(store_id));
create policy zones_active_read on public.delivery_zones for select to anon, authenticated using (is_active or public.is_admin());
create policy zones_admin_write on public.delivery_zones for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy categories_public_read on public.categories for select to anon, authenticated using (is_active or public.is_admin());
create policy categories_admin_write on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_public_available on public.products for select to anon, authenticated using ((availability='available' and exists(select 1 from public.stores s where s.id=store_id and s.status='approved')) or public.is_admin() or public.owns_store(store_id));
create policy products_owner_write on public.products for all to authenticated using (public.is_admin() or public.owns_store(store_id)) with check (public.is_admin() or public.owns_store(store_id));
create policy store_products_public_read on public.store_products for select to anon, authenticated using (is_active and exists(select 1 from public.stores s where s.id=store_id and s.status='approved') or public.is_admin() or public.owns_store(store_id));
create policy store_products_owner_write on public.store_products for all to authenticated using (public.is_admin() or public.owns_store(store_id)) with check (public.is_admin() or public.owns_store(store_id));
create policy product_images_public_read on public.product_images for select to anon, authenticated using (exists(select 1 from public.products p join public.stores s on s.id=p.store_id where p.id=product_id and p.availability='available' and s.status='approved') or public.is_admin() or exists(select 1 from public.products p where p.id=product_id and public.owns_store(p.store_id)));
create policy product_images_owner_write on public.product_images for all to authenticated using (public.is_admin() or exists(select 1 from public.products p where p.id=product_id and public.owns_store(p.store_id))) with check (public.is_admin() or exists(select 1 from public.products p where p.id=product_id and public.owns_store(p.store_id)));
create policy addresses_owner_all on public.customer_addresses for all to authenticated using (customer_id=auth.uid() or public.is_admin()) with check (customer_id=auth.uid() or public.is_admin());
create policy carts_owner_all on public.carts for all to authenticated using (customer_id=auth.uid() or public.is_admin()) with check (customer_id=auth.uid() or public.is_admin());
create policy cart_items_owner_all on public.cart_items for all to authenticated using (exists(select 1 from public.carts c where c.id=cart_id and (c.customer_id=auth.uid() or public.is_admin()))) with check (exists(select 1 from public.carts c where c.id=cart_id and (c.customer_id=auth.uid() or public.is_admin())));
create policy orders_customer_read on public.orders for select to authenticated using (customer_id=auth.uid() or public.is_admin());
create policy orders_admin_insert on public.orders for insert to authenticated with check (public.is_admin());
create policy orders_admin_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sub_orders_customer_or_store_read on public.sub_orders for select to authenticated using (public.is_admin() or public.owns_store(store_id) or exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()));
create policy sub_orders_admin_update on public.sub_orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sub_orders_admin_insert on public.sub_orders for insert to authenticated with check (public.is_admin());
create policy order_items_participant_read on public.order_items for select to authenticated using (public.is_admin() or exists(select 1 from public.sub_orders so where so.id=sub_order_id and (public.owns_store(so.store_id) or exists(select 1 from public.orders o where o.id=so.order_id and o.customer_id=auth.uid()))));
create policy order_items_admin_insert on public.order_items for insert to authenticated with check (public.is_admin());
create policy history_participant_read on public.order_status_history for select to authenticated using (public.is_admin() or (order_id is not null and exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid())) or (sub_order_id is not null and exists(select 1 from public.sub_orders so where so.id=sub_order_id and (public.owns_store(so.store_id) or exists(select 1 from public.orders o where o.id=so.order_id and o.customer_id=auth.uid())))));
create policy history_admin_insert on public.order_status_history for insert to authenticated with check (public.is_admin());
create policy drivers_read_self_admin on public.drivers for select to authenticated using (public.is_admin() or user_id=auth.uid());
create policy drivers_admin_write on public.drivers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy payments_participant_read on public.payments for select to authenticated using (public.is_admin() or exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()));
create policy payments_admin_write on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy plans_public_active_read on public.subscription_plans for select to anon, authenticated using (is_active or public.is_admin());
create policy plans_admin_write on public.subscription_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy subscriptions_member_read on public.merchant_subscriptions for select to authenticated using (public.is_admin() or exists(select 1 from public.merchant_members mm where mm.merchant_id=public.merchant_subscriptions.merchant_id and mm.user_id=auth.uid()));
create policy subscriptions_member_create on public.merchant_subscriptions for insert to authenticated with check (public.is_admin() or exists(select 1 from public.merchant_members mm where mm.merchant_id=public.merchant_subscriptions.merchant_id and mm.user_id=auth.uid()));
create policy subscriptions_admin_update on public.merchant_subscriptions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_admin());


-- Bootstrap merchant ownership and prevent approval fields from being self-assigned.
create or replace function public.bootstrap_merchant_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.merchant_members(merchant_id, user_id, member_role) values (new.id, new.owner_user_id, 'owner');
  insert into public.user_roles(user_id, role) values (new.owner_user_id, 'merchant') on conflict do nothing;
  return new;
end;
$$;
create trigger merchant_owner_bootstrap after insert on public.merchants for each row execute function public.bootstrap_merchant_owner();

create or replace function public.guard_approval_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.is_admin() then
    if tg_table_name = 'merchants' then
      if tg_op = 'INSERT' then
        new.approval := 'pending'; new.approved_by := null; new.approved_at := null;
      else
        new.approval := old.approval; new.approved_by := old.approved_by; new.approved_at := old.approved_at;
      end if;
    elsif tg_table_name = 'stores' then
      if tg_op = 'INSERT' then
        new.status := 'pending'; new.approved_by := null; new.approved_at := null;
      else
        new.status := old.status; new.approved_by := old.approved_by; new.approved_at := old.approved_at;
      end if;
    elsif tg_table_name = 'merchant_subscriptions' then
      new.status := 'pending';
    end if;
  end if;
  return new;
end;
$$;
create trigger merchant_approval_guard before insert or update on public.merchants for each row execute function public.guard_approval_fields();
create trigger store_approval_guard before insert or update on public.stores for each row execute function public.guard_approval_fields();
create trigger subscription_status_guard before insert or update on public.merchant_subscriptions for each row execute function public.guard_approval_fields();

-- Profile users may edit their public name, but cannot reactivate themselves or alter their auth phone.
create or replace function public.guard_profile_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.is_admin() then
    new.phone := old.phone;
    new.status := old.status;
  end if;
  return new;
end;
$$;
create trigger profile_fields_guard before update on public.profiles for each row execute function public.guard_profile_fields();

-- Customer cancellation is atomic and blocked as soon as any store begins preparation.
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
  if store_count = 1 and store_mode='store' then
    if store_fee < 0 then raise exception 'invalid store delivery fee'; end if;
  end if;
  select coalesce(sum(round(ci.quantity*sp.price,2)),0)::numeric(14,2) into subtotal_value
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
    select coalesce(sum(round(ci.quantity*sp.price,2)),0)::numeric(14,2) into item_subtotal
      from public.cart_items ci join public.store_products sp on sp.id=ci.store_product_id
      where ci.cart_id=cart_id_value and sp.store_id=store_row.store_id;
    fee_value := case when store_count=1 and store_row.delivery_mode='store' then store_row.store_delivery_fee
                      when store_count=1 then zone_row.fixed_fee else 0 end;
    insert into public.sub_orders(order_id,store_id,status,currency,subtotal,delivery_fee,store_delivery_enabled)
      values (order_id_value,store_row.store_id,'pending',order_currency,item_subtotal,fee_value,store_count=1 and store_row.delivery_mode='store');
    for item_row in
      select ci.quantity, sp.id store_product_id, sp.price, sp.currency, sp.selling_unit, p.name
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
create or replace function public.cancel_customer_order(target_order uuid, note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare current_order public.orders%rowtype;
begin
  select * into current_order from public.orders where id=target_order for update;
  if not found or current_order.customer_id <> auth.uid() then raise exception 'order not found'; end if;
  if current_order.status not in ('pending','confirmed') then raise exception 'order can no longer be cancelled'; end if;
  if exists (select 1 from public.sub_orders where order_id=target_order and preparation_started_at is not null) then
    raise exception 'preparation has started for this order';
  end if;
  update public.sub_orders set status='cancelled', cancelled_at=now(), cancellation_reason='customer_request', cancellation_note=note where order_id=target_order;
  update public.orders set status='cancelled', cancelled_at=now(), cancellation_reason='customer_request', cancellation_note=note where id=target_order;
  insert into public.order_status_history(order_id,status,changed_by,note) values (target_order,'cancelled',auth.uid(),note);
  insert into public.order_status_history(sub_order_id,status,changed_by,note) select id,'cancelled',auth.uid(),note from public.sub_orders where order_id=target_order;
end;
$$;
revoke all on function public.cancel_customer_order(uuid,text) from public, anon;
grant execute on function public.cancel_customer_order(uuid,text) to authenticated;

-- Store operators can cancel only their own sub-order and only for supported operational reasons.
create or replace function public.sync_parent_order_status(target_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  prior_status public.order_status;
  derived_status public.order_status;
begin
  select status into prior_status from public.orders where id=target_order for update;
  if not found then return; end if;
  select case
    when bool_and(status='cancelled') then 'cancelled'::public.order_status
    when bool_and(status in ('delivered','cancelled')) then 'delivered'::public.order_status
    when bool_or(status='out_for_delivery') then 'out_for_delivery'::public.order_status
    when bool_or(status='preparing') then 'preparing'::public.order_status
    when bool_or(status='ready') then 'ready'::public.order_status
    when bool_or(status='confirmed') then 'confirmed'::public.order_status
    else 'pending'::public.order_status
  end into derived_status from public.sub_orders where order_id=target_order;
  update public.orders set status=derived_status,
    cancelled_at=case when derived_status='cancelled' then coalesce(cancelled_at,now()) else cancelled_at end
    where id=target_order and status is distinct from derived_status;
  if found then
    insert into public.order_status_history(order_id,status,changed_by) values (target_order,derived_status,auth.uid());
  end if;
end;
$$;
revoke all on function public.sync_parent_order_status(uuid) from public, anon;
create or replace function public.set_store_sub_order_status(target_sub_order uuid, next_status public.order_status, note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare current_sub public.sub_orders%rowtype;
begin
  select * into current_sub from public.sub_orders where id=target_sub_order for update;
  if not found or not public.owns_store(current_sub.store_id) then raise exception 'sub-order not found'; end if;
  if next_status not in ('confirmed','preparing','ready','out_for_delivery','delivered') then raise exception 'unsupported status'; end if;
  if not ((current_sub.status='pending' and next_status in ('confirmed','preparing'))
       or (current_sub.status='confirmed' and next_status='preparing')
       or (current_sub.status='preparing' and next_status='ready')
       or (current_sub.status='ready' and next_status='out_for_delivery')
       or (current_sub.status='out_for_delivery' and next_status='delivered')) then
    raise exception 'invalid status transition';
  end if;
  update public.sub_orders set status=next_status,
    preparation_started_at=case when next_status='preparing' then coalesce(preparation_started_at,now()) else preparation_started_at end
    where id=target_sub_order;
  insert into public.order_status_history(sub_order_id,status,changed_by,note) values (target_sub_order,next_status,auth.uid(),note);
  perform public.sync_parent_order_status(current_sub.order_id);
end;
$$;
revoke all on function public.set_store_sub_order_status(uuid,public.order_status,text) from public, anon;
grant execute on function public.set_store_sub_order_status(uuid,public.order_status,text) to authenticated;
create or replace function public.cancel_store_sub_order(target_sub_order uuid, reason public.cancellation_reason, note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare current_sub public.sub_orders%rowtype;
begin
  if reason not in ('out_of_stock','store_unavailable','operational_issue') then raise exception 'unsupported merchant cancellation reason'; end if;
  select * into current_sub from public.sub_orders where id=target_sub_order for update;
  if not found or not public.owns_store(current_sub.store_id) then raise exception 'sub-order not found'; end if;
  if current_sub.status in ('preparing','ready','out_for_delivery','delivered','cancelled') then raise exception 'sub-order can no longer be cancelled'; end if;
  update public.sub_orders set status='cancelled', cancelled_at=now(), cancellation_reason=reason,
    cancellation_note=note, merchant_cancelled_by=auth.uid() where id=target_sub_order;
  insert into public.order_status_history(sub_order_id,status,changed_by,note) values (target_sub_order,'cancelled',auth.uid(),note);
  perform public.sync_parent_order_status(current_sub.order_id);
end;
$$;
revoke all on function public.cancel_store_sub_order(uuid,public.cancellation_reason,text) from public, anon;
grant execute on function public.cancel_store_sub_order(uuid,public.cancellation_reason,text) to authenticated;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Seed configurable durations at unpublished zero-price drafts; admin sets price and activates each plan.
insert into public.subscription_plans(name, duration_months, price, currency, is_active)
values ('اشتراك متجر', 1, 0, 'SYP', false), ('اشتراك متجر', 3, 0, 'SYP', false),
       ('اشتراك متجر', 6, 0, 'SYP', false), ('اشتراك متجر', 12, 0, 'SYP', false)
on conflict (name, duration_months) do nothing;

