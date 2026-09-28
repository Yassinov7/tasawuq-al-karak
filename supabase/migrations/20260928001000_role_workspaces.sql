-- Role scoped workflows for merchant and driver workspaces.
create or replace function public.is_assigned_driver_order(target_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sub_orders so
    join public.drivers d on d.id = so.assigned_driver_id
    where so.order_id = target_order and d.user_id = auth.uid()
      and d.approval = 'approved' and d.is_active
  )
$$;
revoke all on function public.is_assigned_driver_order(uuid) from public, anon;
grant execute on function public.is_assigned_driver_order(uuid) to authenticated;

create policy sub_orders_driver_read on public.sub_orders
  for select to authenticated
  using (exists (
    select 1 from public.drivers d
    where d.id = assigned_driver_id and d.user_id = auth.uid()
      and d.approval = 'approved' and d.is_active
  ));

create policy stores_assigned_driver_read on public.stores
  for select to authenticated
  using (exists (
    select 1 from public.sub_orders so
    join public.drivers d on d.id = so.assigned_driver_id
    where so.store_id = stores.id and d.user_id = auth.uid()
      and d.approval = 'approved' and d.is_active
  ));

create policy orders_assigned_driver_read on public.orders
  for select to authenticated
  using (public.is_assigned_driver_order(orders.id));

create policy addresses_assigned_driver_read on public.customer_addresses
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.address_id = customer_addresses.id and public.is_assigned_driver_order(o.id)
  ));

create policy order_items_driver_read on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.sub_orders so
    join public.drivers d on d.id = so.assigned_driver_id
    where so.id = sub_order_id and d.user_id = auth.uid()
      and d.approval = 'approved' and d.is_active
  ));

create policy history_driver_read on public.order_status_history
  for select to authenticated
  using (sub_order_id is not null and exists (
    select 1 from public.sub_orders so
    join public.drivers d on d.id = so.assigned_driver_id
    where so.id = sub_order_id and d.user_id = auth.uid()
      and d.approval = 'approved' and d.is_active
  ));

create or replace function public.driver_set_sub_order_status(
  target_sub_order uuid,
  next_status public.order_status,
  status_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub_order_row public.sub_orders%rowtype;
  driver_id_value uuid;
begin
  select id into driver_id_value from public.drivers
    where user_id = auth.uid() and approval = 'approved' and is_active;
  if driver_id_value is null then raise exception 'active driver profile required'; end if;

  select * into sub_order_row from public.sub_orders
    where id = target_sub_order and assigned_driver_id = driver_id_value for update;
  if not found then raise exception 'assigned delivery not found'; end if;
  if not ((sub_order_row.status = 'ready' and next_status = 'out_for_delivery') or
          (sub_order_row.status = 'out_for_delivery' and next_status = 'delivered')) then
    raise exception 'invalid driver status transition';
  end if;
  update public.sub_orders set status = next_status where id = target_sub_order;
  insert into public.order_status_history(sub_order_id, status, changed_by, note)
    values (target_sub_order, next_status, auth.uid(), nullif(trim(status_note), ''));
  perform public.sync_parent_order_status(sub_order_row.order_id);
end;
$$;
revoke all on function public.driver_set_sub_order_status(uuid,public.order_status,text) from public, anon;
grant execute on function public.driver_set_sub_order_status(uuid,public.order_status,text) to authenticated;

-- Merchant cancellations must have an operational reason. Stock-related
-- cancellations require at least one ordered product to be unavailable.
create or replace function public.cancel_store_sub_order(
  target_sub_order uuid,
  reason public.cancellation_reason,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_sub public.sub_orders%rowtype;
begin
  if reason not in ('out_of_stock', 'store_unavailable', 'operational_issue') then
    raise exception 'unsupported merchant cancellation reason';
  end if;
  select * into current_sub from public.sub_orders where id = target_sub_order for update;
  if not found or not public.owns_store(current_sub.store_id) then
    raise exception 'sub-order not found';
  end if;
  if current_sub.status in ('preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')
     or current_sub.preparation_started_at is not null then
    raise exception 'sub-order can no longer be cancelled';
  end if;
  if reason = 'out_of_stock' and not exists (
    select 1 from public.order_items oi
    left join public.store_products sp on sp.id = oi.store_product_id
    left join public.products p on p.id = sp.product_id
    where oi.sub_order_id = target_sub_order
      and (sp.id is null or not sp.is_active or p.availability = 'unavailable')
  ) then
    raise exception 'ordered products are still available';
  end if;
  update public.sub_orders set status = 'cancelled', cancelled_at = now(),
    cancellation_reason = reason, cancellation_note = note, merchant_cancelled_by = auth.uid()
    where id = target_sub_order;
  insert into public.order_status_history(sub_order_id, status, changed_by, note)
    values (target_sub_order, 'cancelled', auth.uid(), note);
  perform public.sync_parent_order_status(current_sub.order_id);
end;
$$;
revoke all on function public.cancel_store_sub_order(uuid,public.cancellation_reason,text) from public, anon;
grant execute on function public.cancel_store_sub_order(uuid,public.cancellation_reason,text) to authenticated;
