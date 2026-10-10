alter table public.driver_applications
  add column is_available boolean not null default false;

create or replace function public.is_available_driver()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.driver_applications a on a.user_id = p.id
    where p.id = auth.uid()
      and p.role = 'driver'
      and a.status = 'accepted'
      and a.is_available
  )
$$;

create or replace function public.set_driver_availability(input_available boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  updated_availability boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  update public.driver_applications
  set is_available = input_available
  where user_id = auth.uid()
    and status = 'accepted'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'driver'
    )
  returning is_available into updated_availability;

  if not found then raise exception 'approved driver account required'; end if;
  return updated_availability;
end;
$$;

create or replace function public.list_available_delivery_tasks()
returns table (
  task_id uuid,
  customer_order_id uuid,
  order_number bigint,
  delivery_zone_name_snapshot text,
  delivery_address text,
  created_at timestamptz,
  store_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.is_available_driver() then raise exception 'available approved driver required'; end if;

  return query
  select dt.id, co.id, co.order_number, co.delivery_zone_name_snapshot,
    co.delivery_address, dt.created_at, count(so.id) filter (
      where so.status in ('ready_for_pickup', 'handed_to_driver', 'delivered')
    )
  from public.delivery_tasks dt
  join public.customer_orders co on co.id = dt.customer_order_id
  left join public.store_orders so on so.customer_order_id = co.id
  where dt.status = 'available' and dt.driver_id is null
  group by dt.id, co.id, co.order_number, co.delivery_zone_name_snapshot,
    co.delivery_address, dt.created_at
  order by dt.created_at
  limit 30;
end;
$$;

create or replace function public.can_view_delivery_task(target_task uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.delivery_tasks dt
    join public.customer_orders co on co.id = dt.customer_order_id
    where dt.id = target_task and (
      public.is_admin() or dt.driver_id = auth.uid() or co.customer_id = auth.uid()
      or (dt.status = 'available' and public.is_available_driver())
      or exists (
        select 1
        from public.store_orders so
        where so.customer_order_id = co.id and public.is_store_owner(so.store_id)
      )
    )
  )
$$;

create or replace function public.accept_delivery_task(target_customer_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  task_row public.delivery_tasks%rowtype;
  customer_id_value uuid;
  order_number_value bigint;
begin
  if not public.is_available_driver() then
    raise exception 'available approved driver account required';
  end if;

  select * into task_row
  from public.delivery_tasks dt
  where dt.customer_order_id = target_customer_order
  for update;

  if not found or task_row.status <> 'available' then
    raise exception 'delivery task is no longer available';
  end if;

  update public.delivery_tasks
  set status = 'accepted', driver_id = auth.uid(), accepted_at = now()
  where id = task_row.id;

  select co.customer_id, co.order_number
  into customer_id_value, order_number_value
  from public.customer_orders co
  where co.id = target_customer_order;

  insert into public.notifications(user_id, type, title, body, data)
  values (
    customer_id_value, 'order', 'تم إسناد سائق لطلبك',
    'قبل السائق طلب التوصيل رقم ' || order_number_value::text || '.',
    jsonb_build_object('orderId', target_customer_order, 'url', '/order-details?id=' || target_customer_order::text)
  );

  insert into public.notifications(user_id, type, title, body, data)
  select distinct m.owner_user_id, 'order', 'تم قبول توصيل الطلب',
    'قبل سائق توصيل الطلب رقم ' || order_number_value::text || '.',
    jsonb_build_object('orderId', target_customer_order, 'storeId', s.id, 'url', '/merchant/orders')
  from public.store_orders so
  join public.stores s on s.id = so.store_id
  join public.merchants m on m.id = s.merchant_id
  where so.customer_order_id = target_customer_order;
end;
$$;

create or replace function public.make_order_delivery_available()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  stores_ready boolean;
  has_deliverable_stores boolean;
  customer_id_value uuid;
  order_number_value bigint;
  driver_user uuid;
begin
  if new.status not in ('ready_for_pickup', 'rejected', 'cancelled')
     or (tg_op = 'UPDATE' and old.status = new.status) then
    return new;
  end if;

  select co.customer_id, co.order_number
  into customer_id_value, order_number_value
  from public.customer_orders co
  where co.id = new.customer_order_id;

  select
    bool_and(so.status in (
      'ready_for_pickup', 'handed_to_driver', 'delivered', 'rejected', 'cancelled'
    )),
    bool_or(so.status in ('ready_for_pickup', 'handed_to_driver', 'delivered'))
  into stores_ready, has_deliverable_stores
  from public.store_orders so
  where so.customer_order_id = new.customer_order_id;

  if not coalesce(stores_ready, false) then return new; end if;

  if not coalesce(has_deliverable_stores, false) then
    update public.delivery_tasks
    set status = 'cancelled'
    where customer_order_id = new.customer_order_id and status = 'pending_stores';
    return new;
  end if;

  update public.delivery_tasks
  set status = 'available'
  where customer_order_id = new.customer_order_id and status = 'pending_stores';

  if not found then return new; end if;

  for driver_user in
    select p.id
    from public.profiles p
    join public.driver_applications da on da.user_id = p.id
    where p.role = 'driver' and da.status = 'accepted' and da.is_available
  loop
    insert into public.notifications(user_id, type, title, body, data)
    values (
      driver_user, 'order', 'طلب توصيل متاح',
      'الطلب رقم ' || order_number_value::text || ' جاهز للاستلام.',
      jsonb_build_object('orderId', new.customer_order_id, 'url', '/driver')
    );
  end loop;

  insert into public.notifications(user_id, type, title, body, data)
  values (
    customer_id_value, 'order', 'طلبك جاهز للتوصيل',
    'اكتملت مراجعة طلبات المتاجر وأصبح طلبك جاهزًا للتوصيل.',
    jsonb_build_object('orderId', new.customer_order_id, 'url', '/order-details?id=' || new.customer_order_id::text)
  );

  return new;
end;
$$;

revoke all on function public.is_available_driver() from public, anon;
grant execute on function public.is_available_driver() to authenticated;
revoke all on function public.set_driver_availability(boolean) from public, anon;
grant execute on function public.set_driver_availability(boolean) to authenticated;
revoke all on function public.list_available_delivery_tasks() from public, anon;
grant execute on function public.list_available_delivery_tasks() to authenticated;
revoke all on function public.can_view_delivery_task(uuid) from public, anon;
grant execute on function public.can_view_delivery_task(uuid) to authenticated;
revoke all on function public.accept_delivery_task(uuid) from public, anon;
grant execute on function public.accept_delivery_task(uuid) to authenticated;
revoke all on function public.make_order_delivery_available() from public, anon, authenticated;
