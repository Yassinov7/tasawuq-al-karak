-- Let an approved independent driver claim a ready delivery without admin assignment.
-- The task claim is atomic; the existing sub-order audit trigger records the actor.

alter table public.sub_orders
  add column driver_accepted_at timestamptz,
  add column driver_accepted_by uuid references public.profiles(id) on delete set null,
  add constraint sub_orders_driver_acceptance_pair_check
    check ((driver_accepted_at is null) = (driver_accepted_by is null));

create or replace function public.is_active_driver()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.drivers d
    where d.user_id = auth.uid() and d.approval = 'approved' and d.is_active
      and exists (select 1 from public.user_roles ur where ur.user_id = d.user_id and ur.role = 'driver')
  )
$$;
revoke all on function public.is_active_driver() from public, anon;
grant execute on function public.is_active_driver() to authenticated;

create policy sub_orders_driver_offer_read on public.sub_orders
  for select to authenticated
  using (status = 'ready' and assigned_driver_id is null and public.is_active_driver());

create or replace function public.get_driver_delivery_offers()
returns table (
  sub_order_id uuid,
  order_number bigint,
  store_name text,
  zone_label text,
  item_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select so.id, o.order_number, s.name,
         nullif(concat_ws(' · ', z.region_name, z.name), ''),
         count(oi.id)::bigint, so.created_at
  from public.sub_orders so
  join public.orders o on o.id = so.order_id
  join public.stores s on s.id = so.store_id
  left join public.delivery_zones z on z.id = o.zone_id
  left join public.order_items oi on oi.sub_order_id = so.id
  where so.status = 'ready' and so.assigned_driver_id is null
    and public.is_active_driver()
  group by so.id, o.order_number, s.name, z.region_name, z.name
  order by so.created_at asc
$$;
revoke all on function public.get_driver_delivery_offers() from public, anon;
grant execute on function public.get_driver_delivery_offers() to authenticated;

create or replace function public.driver_accept_sub_order(target_sub_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  driver_id_value uuid;
  sub_order_row public.sub_orders%rowtype;
begin
  if not public.is_active_driver() then raise exception 'active driver profile required'; end if;
  select d.id into driver_id_value
  from public.drivers d
  where d.user_id = auth.uid() and d.approval = 'approved' and d.is_active;
  if driver_id_value is null then raise exception 'active driver profile required'; end if;

  select * into sub_order_row
  from public.sub_orders so
  where so.id = target_sub_order
  for update;
  if not found or sub_order_row.status <> 'ready' or sub_order_row.assigned_driver_id is not null then
    raise exception 'delivery offer is no longer available';
  end if;

  update public.sub_orders
  set assigned_driver_id = driver_id_value,
      driver_accepted_at = now(),
      driver_accepted_by = auth.uid()
  where id = target_sub_order;
end;
$$;
revoke all on function public.driver_accept_sub_order(uuid) from public, anon;
grant execute on function public.driver_accept_sub_order(uuid) to authenticated;
