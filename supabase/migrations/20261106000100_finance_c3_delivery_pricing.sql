-- C3 operational pricing/dispatch only. C2 financial posting remains dormant.
begin;

-- Preserve the existing zone identity and address FKs. Fractional legacy fees
-- require an explicit owner decision; never silently round existing settings.
do $$ begin
  if exists(select 1 from public.delivery_zones where fixed_fee<>trunc(fixed_fee)) then
    raise exception 'C3 preflight: fractional delivery_zones.fixed_fee; review rows before applying';
  end if;
end $$;
alter table public.delivery_zones
  add column additional_store_fee numeric not null default 0
    check (additional_store_fee>=0 and additional_store_fee=trunc(additional_store_fee) and additional_store_fee<=999999999999),
  add column pricing_version bigint not null default 1 check (pricing_version>0),
  add constraint delivery_zone_whole_base check (fixed_fee=trunc(fixed_fee) and fixed_fee<=999999999999);

create function finance_private.c3_zone_version()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'administrator required' using errcode='42501'; end if;
  if tg_op='UPDATE' then new.pricing_version:=old.pricing_version+1;
  else new.pricing_version:=1; end if;
  return new;
end $$;
create trigger c3_zone_version before insert or update on public.delivery_zones
for each row execute function finance_private.c3_zone_version();

create table public.order_pricing_snapshots (
  customer_order_id uuid primary key references public.customer_orders(id) on delete restrict,
  zone_id uuid not null references public.delivery_zones(id) on delete restrict,
  zone_name text not null,
  base_fee numeric not null check (base_fee>=0 and base_fee=trunc(base_fee)),
  additional_store_fee numeric not null check (additional_store_fee>=0 and additional_store_fee=trunc(additional_store_fee)),
  original_store_count integer not null check (original_store_count>0),
  original_items_amount numeric not null check (original_items_amount>=0 and original_items_amount=round(original_items_amount,2)),
  original_delivery_fee numeric not null check (original_delivery_fee>=0 and original_delivery_fee=trunc(original_delivery_fee)),
  approved_total numeric not null check (approved_total=original_items_amount+original_delivery_fee and approved_total<=999999999999.99),
  zone_version bigint not null,
  policy_version text not null default 'c3-fixed-uplift-v1' check (policy_version='c3-fixed-uplift-v1'),
  decided_at timestamptz not null default clock_timestamp()
);
create trigger c3_snapshot_immutable before update or delete on public.order_pricing_snapshots
for each row execute function finance_private.reject_mutation();

create table public.order_pricing_current (
  customer_order_id uuid primary key references public.order_pricing_snapshots(customer_order_id) on delete restrict,
  version bigint not null check (version>0),
  active_store_count integer not null check (active_store_count>=0),
  items_amount numeric not null check (items_amount>=0 and items_amount=round(items_amount,2)),
  delivery_fee numeric not null check (delivery_fee>=0 and delivery_fee=trunc(delivery_fee)),
  total numeric not null check (total=items_amount+delivery_fee and total<=999999999999.99),
  review_required boolean not null default false,
  updated_at timestamptz not null default clock_timestamp()
);
create table public.order_pricing_revisions (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.order_pricing_snapshots(customer_order_id) on delete restrict,
  version bigint not null,
  source_store_order_id uuid references public.store_orders(id) on delete restrict,
  before_amounts jsonb not null,
  proposed_amounts jsonb not null,
  applied boolean not null,
  reason text not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default clock_timestamp(),
  unique(customer_order_id,version)
);
create trigger c3_revision_immutable before update or delete on public.order_pricing_revisions
for each row execute function finance_private.reject_mutation();

create function finance_private.c3_fee(base_value numeric, uplift_value numeric, stores_count integer)
returns numeric language plpgsql immutable set search_path='' as $$
declare result_value numeric;
begin
  if base_value is null or uplift_value is null or stores_count is null or stores_count<0
    or base_value<0 or uplift_value<0 or base_value<>trunc(base_value) or uplift_value<>trunc(uplift_value)
    or base_value::text in ('NaN','Infinity','-Infinity') or uplift_value::text in ('NaN','Infinity','-Infinity') then
    raise exception 'invalid C3 delivery pricing';
  end if;
  result_value:=case when stores_count=0 then 0 else base_value+greatest(stores_count-1,0)*uplift_value end;
  if result_value>999999999999 then raise exception 'delivery fee exceeds supported order amount'; end if;
  return result_value;
end $$;

create function public.c3_pricing_readable(target_order uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_admin() or exists(select 1 from public.customer_orders where id=target_order and customer_id=auth.uid())
    or exists(select 1 from public.delivery_tasks where customer_order_id=target_order and driver_id=auth.uid())
$$;
do $$ declare relation_name text;
begin
  foreach relation_name in array array['order_pricing_snapshots','order_pricing_current','order_pricing_revisions'] loop
    execute format('alter table public.%I enable row level security',relation_name);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',relation_name);
    execute format('grant select on public.%I to authenticated',relation_name);
    execute format('create policy c3_pricing_read on public.%I for select to authenticated using (public.c3_pricing_readable(customer_order_id))',relation_name);
  end loop;
end $$;
revoke all on function public.c3_pricing_readable(uuid) from public,anon,service_role;
grant execute on function public.c3_pricing_readable(uuid) to authenticated;

create function finance_private.c3_recalculate(target_order uuid, source_child uuid, change_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare snap public.order_pricing_snapshots%rowtype; previous public.order_pricing_current%rowtype;
  count_value integer; goods numeric; fee_value numeric; proposed_total numeric; blocked boolean;
  customer_value uuid; next_version bigint;
begin
  select customer_id into strict customer_value from public.customer_orders where id=target_order for update;
  select * into snap from public.order_pricing_snapshots where customer_order_id=target_order;
  if not found then return; end if;
  select * into strict previous from public.order_pricing_current where customer_order_id=target_order for update;
  if exists(select 1 from public.store_orders s left join public.store_order_totals t on t.store_order_id=s.id
    where s.customer_order_id=target_order and s.status not in ('rejected','cancelled') and t.store_order_id is null) then
    raise exception 'missing authoritative store total';
  end if;
  select count(*)::integer,coalesce(sum(t.items_subtotal),0) into count_value,goods
  from public.store_orders s join public.store_order_totals t on t.store_order_id=s.id
  where s.customer_order_id=target_order and s.status not in ('rejected','cancelled');
  if goods<>round(goods,2) or goods<0 or goods::text in ('NaN','Infinity','-Infinity') then raise exception 'invalid C3 store total'; end if;
  fee_value:=finance_private.c3_fee(snap.base_fee,snap.additional_store_fee,count_value);
  proposed_total:=goods+fee_value;
  blocked:=count_value>0 and (previous.review_required or proposed_total>least(previous.total,snap.approved_total) or proposed_total>999999999999.99);
  next_version:=previous.version+1;
  insert into public.order_pricing_revisions(customer_order_id,version,source_store_order_id,before_amounts,proposed_amounts,applied,reason,actor_id)
  values(target_order,next_version,source_child,to_jsonb(previous),jsonb_build_object('active_store_count',count_value,
    'items_amount',goods,'delivery_fee',fee_value,'total',proposed_total),not blocked,change_reason,auth.uid());
  update public.order_pricing_current set version=next_version,review_required=blocked,
    active_store_count=case when blocked then active_store_count else count_value end,
    items_amount=case when blocked then items_amount else goods end,
    delivery_fee=case when blocked then delivery_fee else fee_value end,
    total=case when blocked then total else proposed_total end,updated_at=clock_timestamp()
  where customer_order_id=target_order;
  if count_value=0 then
    update public.order_pricing_current set active_store_count=0,items_amount=0,delivery_fee=0,total=0,review_required=false where customer_order_id=target_order;
    update public.customer_orders set status='cancelled',delivery_fee=0 where id=target_order;
    perform finance_private.append_lifecycle_event(target_order,null,null,'order_cancelled',null,'cancelled','c3_recalculate','c3:cancelled',change_reason);
  elsif not blocked then
    -- Legacy cash foundations read this effective fee at delivery. Original fee
    -- and approved totals remain in the immutable C3 snapshot and old totals.
    update public.customer_orders set delivery_fee=fee_value where id=target_order;
  end if;
  perform finance_private.append_lifecycle_event(target_order,source_child,null,
    case when blocked then 'pricing_exception' else 'pricing_recalculated' end,null,null,
    'c3_recalculate','c3:pricing:'||next_version::text,change_reason);
  insert into public.notifications(user_id,type,title,body,data) values(customer_value,'order',
    case when count_value=0 then 'أُلغي الطلب' when blocked then 'طلبك قيد المراجعة' else 'تحديث مبلغ الطلب' end,
    case when count_value=0 then 'لم تتبق متاجر لتنفيذ الطلب.' when blocked then 'توقف الإرسال لحين مراجعة اختلاف المبلغ؛ لم تُطبق زيادة.'
      else 'أصبح إجمالي الدفع عند الاستلام '||proposed_total::text||' ل.س بعد تحديث أجزاء الطلب.' end,
    jsonb_build_object('orderId',target_order,'url','/order-details?id='||target_order::text));
end $$;

create function finance_private.c3_dispatch(target_order uuid)
returns void language plpgsql security definer set search_path='' as $$
declare current_price public.order_pricing_current%rowtype; task_value uuid; customer_value uuid;
  active_count integer; ready_count integer; driver_value uuid;
begin
  select customer_id into customer_value from public.customer_orders
  where id=target_order and status not in ('cancelled','delivered','partially_cancelled') for update;
  if not found then return; end if;
  select * into current_price from public.order_pricing_current where customer_order_id=target_order;
  if not found or current_price.review_required then return; end if;
  select count(*)::integer,count(*) filter(where status='ready_for_pickup')::integer into active_count,ready_count
  from public.store_orders where customer_order_id=target_order and status not in ('rejected','cancelled');
  if active_count=0 or active_count<>ready_count or active_count<>current_price.active_store_count then return; end if;
  if exists(select 1 from public.delivery_tasks where customer_order_id=target_order) then return; end if;
  insert into public.delivery_tasks(customer_order_id,status) values(target_order,'available') returning id into task_value;
  perform finance_private.register_document('DLV',task_value);
  perform finance_private.append_lifecycle_event(target_order,null,task_value,'all_deliverable_stores_ready',null,null,'c3_dispatch','c3:all-ready');
  perform finance_private.append_lifecycle_event(target_order,null,task_value,'delivery_task_created',null,'available','c3_dispatch','c3:task:'||task_value::text);
  update public.customer_orders set status='ready_for_delivery' where id=target_order;
  insert into public.notifications(user_id,type,title,body,data) values(customer_value,'order','طلبك جاهز للتوصيل',
    'أصبحت جميع أجزاء الطلب المتبقية جاهزة للاستلام.',jsonb_build_object('orderId',target_order,'url','/order-details?id='||target_order::text));
  for driver_value in select p.id from public.profiles p join public.driver_applications a on a.user_id=p.id
    where p.role='driver' and a.status='accepted' and a.is_available loop
    insert into public.notifications(user_id,type,title,body,data) values(driver_value,'order','طلب توصيل متاح',
      'أصبح طلب جديد جاهزًا للاستلام.',jsonb_build_object('orderId',target_order,'url','/driver'));
  end loop;
end $$;

-- Existing merchandise precision retained: PostgreSQL numeric, two decimal places.
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
  cumulative_original_total numeric(14,2);
  item_original_total numeric(14,2);
  item_final_total numeric(14,2);
  item_quantity numeric(12,3);
  item_unit_price numeric(14,2);
  offer_item_count integer;
  offer_item_index integer;
  item_offer_role public.offer_product_role;
  item_offer_snapshot jsonb;
  store_count_value integer;
  fee_value numeric;
  items_value numeric;
  child_value record;
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

  select count(*)::integer into store_count_value from (
    select p.store_id from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_row.id
    union select o.store_id from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id where cs.cart_id=cart_row.id
  ) stores_in_cart;
  fee_value:=finance_private.c3_fee(zone_row.fixed_fee,zone_row.additional_store_fee,store_count_value);

  insert into public.customer_orders(
    customer_id, recipient_name, contact_phone, delivery_address,
    delivery_zone_id, delivery_zone_name_snapshot, delivery_fee, customer_note
  )
  values (
    current_customer, trim(input_recipient_name), trim(input_contact_phone),
    trim(input_delivery_address), zone_row.id, zone_row.name, fee_value,
    coalesce(trim(input_customer_note), '')
  )
  returning id into new_order;

  -- DLV is created by the C3 gate only after all active stores are ready.

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
      'SYP'::public.currency_code, round(ci.quantity * p.price, 2)
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
      cumulative_original_total := 0;
      offer_item_index := 0;
      if offer_row.offer_type='bundle' and offer_original_total<=0 then
        raise exception 'bundle has no allocation basis';
      end if;

      for offer_item in
        select op.product_id, op.item_role, op.quantity, p.title,
          p.selling_unit, p.price, 'SYP'::public.currency_code as currency
        from public.store_offer_products op
          join public.products p on p.id = op.product_id and p.store_id = op.store_id
        where op.offer_id = offer_row.id and p.is_available
        order by op.item_role, op.id
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
          -- Round cumulative shares, not independent components. Successive
          -- boundaries are monotone and the last boundary is the exact bundle
          -- price, so residual cents cannot produce a negative last component.
          cumulative_original_total := cumulative_original_total + item_original_total;
          if offer_item_index = offer_item_count then
            item_final_total := offer_bundle_total - allocated_total;
          else
            item_final_total := round(
              offer_bundle_total * cumulative_original_total / offer_original_total, 2
            ) - allocated_total;
          end if;
          allocated_total := allocated_total + item_final_total;
          if item_final_total<0 or allocated_total>offer_bundle_total then
            raise exception 'invalid bundle allocation';
          end if;
        elsif offer_row.offer_type = 'buy_x_get_y' then
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
          'currency', 'SYP'::public.currency_code,
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
          'SYP'::public.currency_code, item_final_total, item_offer_snapshot
        );
      end loop;
      if offer_row.offer_type='bundle' and
        (allocated_total<>offer_bundle_total or cumulative_original_total<>offer_original_total) then
        raise exception 'incomplete bundle allocation';
      end if;
    end loop;

    insert into public.store_order_totals(store_order_id, currency, items_subtotal)
    select soi.store_order_id, 'SYP'::public.currency_code, sum(soi.line_total)
    from public.store_order_items soi
    where soi.store_order_id = created_store_order
    group by soi.store_order_id;
  end loop;

  insert into public.customer_order_totals(customer_order_id, currency, items_subtotal, delivery_fee, total)
  select new_order, 'SYP', coalesce(sum(soi.line_total),0), fee_value,
    coalesce(sum(soi.line_total),0) + fee_value
  from public.store_order_items soi join public.store_orders so on so.id=soi.store_order_id
  where so.customer_order_id=new_order;

  select items_subtotal into strict items_value from public.customer_order_totals where customer_order_id=new_order;
  insert into public.order_pricing_snapshots(customer_order_id,zone_id,zone_name,base_fee,additional_store_fee,
    original_store_count,original_items_amount,original_delivery_fee,approved_total,zone_version)
  values(new_order,zone_row.id,zone_row.name,zone_row.fixed_fee,zone_row.additional_store_fee,
    store_count_value,items_value,fee_value,items_value+fee_value,zone_row.pricing_version);
  insert into public.order_pricing_current(customer_order_id,version,active_store_count,items_amount,delivery_fee,total)
  values(new_order,1,store_count_value,items_value,fee_value,items_value+fee_value);
  perform finance_private.register_document('ORD',new_order);
  perform finance_private.append_lifecycle_event(new_order,null,null,'order_created',null,'submitted','create_order_from_cart','c3:created');
  for child_value in select id from public.store_orders where customer_order_id=new_order order by id loop
    perform finance_private.register_document('SUB',child_value.id);
    perform finance_private.append_lifecycle_event(new_order,child_value.id,null,'store_order_created',null,'awaiting_review',
      'create_order_from_cart','c3:child:'||child_value.id::text);
  end loop;

  delete from public.customer_cart_items where cart_id = cart_row.id;
  delete from public.customer_cart_store_notes where cart_id = cart_row.id;
  delete from public.customer_cart_offer_selections where cart_id = cart_row.id;
  return new_order;
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
  if exists(select 1 from public.order_pricing_snapshots where customer_order_id=new.customer_order_id) then
    if tg_op='UPDATE' and new.status is distinct from old.status and new.status in ('preparing','ready_for_pickup','rejected','cancelled') then
      perform 1 from public.customer_orders where id=new.customer_order_id for update;
      perform finance_private.append_lifecycle_event(new.customer_order_id,new.id,null,
        case new.status when 'preparing' then 'store_order_accepted' when 'ready_for_pickup' then 'store_order_ready'
          when 'rejected' then 'store_order_rejected' else 'store_order_cancelled' end,
        old.status::text,new.status::text,'update_store_order_status','c3:status:'||new.id::text||':'||new.status::text,new.rejection_reason);
      if new.status in ('rejected','cancelled') then
        perform finance_private.c3_recalculate(new.customer_order_id,new.id,coalesce(new.rejection_reason,'customer cancellation'));
      end if;
      perform finance_private.c3_dispatch(new.customer_order_id);
    end if;
    return new;
  end if;
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
  if exists(select 1 from public.order_pricing_snapshots where customer_order_id=target_order) then
    perform 1 from public.customer_orders where id=target_order for update;
    if exists(select 1 from public.customer_orders where id=target_order and status='cancelled') then return; end if;
    select count(*),count(*) filter(where status='delivered') into child_count,finished_count
    from public.store_orders where customer_order_id=target_order and status not in ('rejected','cancelled');
    select status into delivery_status from public.delivery_tasks where customer_order_id=target_order;
    if child_count=0 then next_status:='cancelled';
    elsif finished_count=child_count then
      next_status:=case when exists(select 1 from public.store_orders where customer_order_id=target_order and status in ('rejected','cancelled'))
        then 'partially_cancelled'::public.customer_order_status else 'delivered'::public.customer_order_status end;
    elsif delivery_status='picked_up' then next_status:='out_for_delivery';
    elsif delivery_status in ('available','accepted') then next_status:='ready_for_delivery';
    elsif exists(select 1 from public.store_orders where customer_order_id=target_order and status in ('preparing','ready_for_pickup')) then next_status:='in_progress';
    else next_status:='submitted'; end if;
    update public.customer_orders set status=next_status where id=target_order;
    return;
  end if;
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

create or replace function public.cancel_customer_order(
  target_customer_order uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.customer_orders%rowtype;
begin
  select *
  into order_row
  from public.customer_orders co
  where co.id = target_customer_order
    and co.customer_id = auth.uid()
  for update;

  if not found then
    raise exception 'customer order not found';
  end if;

  /*
   * Customer cancellation is allowed as long as no store has
   * started preparation.
   *
   * These states do NOT mean preparation started:
   * - awaiting_review
   * - rejected
   * - cancelled
   *
   * Any other store-order state means the store has moved beyond
   * the review stage, so customer cancellation is blocked.
   */
  if exists (
    select 1
    from public.store_orders so
    where so.customer_order_id = target_customer_order
      and so.status not in (
        'awaiting_review',
        'rejected',
        'cancelled'
      )
  ) then
    raise exception
      'order cannot be cancelled after store preparation has started';
  end if;

  update public.store_orders
  set status = 'cancelled'
  where customer_order_id = target_customer_order
    and status = 'awaiting_review';

  update public.delivery_tasks
  set status = 'cancelled'
  where customer_order_id = target_customer_order
    and status = 'pending_stores';

  update public.customer_orders
  set status = 'cancelled'
  where id = target_customer_order;
end;
$$;

-- All legal public mutations take the parent lock before any child/task lock.
alter function public.update_store_order_status(uuid,public.store_order_status,text) set schema finance_private;
alter function finance_private.update_store_order_status(uuid,public.store_order_status,text) rename to c3_legacy_update_store_order_status;
revoke all on function finance_private.c3_legacy_update_store_order_status(uuid,public.store_order_status,text) from public,anon,authenticated,service_role;
create function public.update_store_order_status(target_store_order uuid,next_status public.store_order_status,reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare parent_value uuid; current_status public.store_order_status; store_value uuid;
begin
  select customer_order_id into parent_value from public.store_orders where id=target_store_order;
  if not found then raise exception 'store order not found'; end if;
  perform 1 from public.customer_orders where id=parent_value for update;
  select status,store_id into strict current_status,store_value from public.store_orders where id=target_store_order for update;
  if not public.is_admin() and not public.is_store_owner(store_value) then raise exception 'store owner required' using errcode='42501'; end if;
  if current_status=next_status then
    if next_status='rejected' and nullif(trim(reason),'') is distinct from (select rejection_reason from public.store_orders where id=target_store_order) then
      raise exception 'retry reason mismatch';
    end if;
    return;
  end if;
  if exists(select 1 from public.order_pricing_snapshots where customer_order_id=parent_value)
    and exists(select 1 from public.delivery_tasks where customer_order_id=parent_value) then
    raise exception 'store transitions closed after dispatch';
  end if;
  perform finance_private.c3_legacy_update_store_order_status(target_store_order,next_status,reason);
end $$;
revoke all on function public.update_store_order_status(uuid,public.store_order_status,text) from public,anon,service_role;
grant execute on function public.update_store_order_status(uuid,public.store_order_status,text) to authenticated;

alter function public.cancel_customer_order(uuid) set schema finance_private;
alter function finance_private.cancel_customer_order(uuid) rename to c3_legacy_cancel_customer_order;
revoke all on function finance_private.c3_legacy_cancel_customer_order(uuid) from public,anon,authenticated,service_role;
create function public.cancel_customer_order(target_customer_order uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.customer_orders where id=target_customer_order and customer_id=auth.uid() for update;
  if not found then raise exception 'customer order not found' using errcode='42501'; end if;
  if exists(select 1 from public.customer_orders where id=target_customer_order and status='cancelled') then return; end if;
  perform finance_private.c3_legacy_cancel_customer_order(target_customer_order);
end $$;
revoke all on function public.cancel_customer_order(uuid) from public,anon,service_role;
grant execute on function public.cancel_customer_order(uuid) to authenticated;

alter function public.accept_delivery_task(uuid) set schema finance_private;
alter function finance_private.accept_delivery_task(uuid) rename to c3_legacy_accept_delivery_task;
revoke all on function finance_private.c3_legacy_accept_delivery_task(uuid) from public,anon,authenticated,service_role;
create function public.accept_delivery_task(target_customer_order uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.customer_orders where id=target_customer_order for update;
  if exists(select 1 from public.order_pricing_current where customer_order_id=target_customer_order and review_required) then
    raise exception 'order pricing is under review';
  end if;
  perform finance_private.c3_legacy_accept_delivery_task(target_customer_order);
end $$;
revoke all on function public.accept_delivery_task(uuid) from public,anon,service_role;
grant execute on function public.accept_delivery_task(uuid) to authenticated;

alter function public.update_delivery_task_status(uuid,public.delivery_task_status) set schema finance_private;
alter function finance_private.update_delivery_task_status(uuid,public.delivery_task_status) rename to c3_legacy_update_delivery_task_status;
revoke all on function finance_private.c3_legacy_update_delivery_task_status(uuid,public.delivery_task_status) from public,anon,authenticated,service_role;
create function public.update_delivery_task_status(target_customer_order uuid,next_status public.delivery_task_status)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.customer_orders where id=target_customer_order for update;
  if exists(select 1 from public.order_pricing_current where customer_order_id=target_customer_order and review_required) then
    raise exception 'order pricing is under review';
  end if;
  perform finance_private.c3_legacy_update_delivery_task_status(target_customer_order,next_status);
end $$;
revoke all on function public.update_delivery_task_status(uuid,public.delivery_task_status) from public,anon,service_role;
grant execute on function public.update_delivery_task_status(uuid,public.delivery_task_status) to authenticated;

-- Cart rows are locked before validating this server-generated canonical intent.
-- No hash extension or client-computed total is trusted.
create function finance_private.c3_cart_signature(cart_value uuid)
returns text language sql stable set search_path='' as $$
  select jsonb_build_object('cart',cart_value,
    'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.product_id) from (
      select ci.product_id,ci.quantity,p.price,p.title,p.selling_unit,p.minimum_quantity,p.quantity_step,p.is_available
      from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_value
    ) x),'[]'::jsonb),
    'offers',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select o.id,extract(epoch from o.updated_at) as offer_version,o.is_active,
        extract(epoch from o.starts_at) as starts_at_epoch,extract(epoch from o.ends_at) as ends_at_epoch,
        (select jsonb_agg(jsonb_build_array(op.id,op.product_id,op.item_role,op.quantity,p.price,p.is_available)
          order by op.id) from public.store_offer_products op join public.products p on p.id=op.product_id where op.offer_id=o.id) as components
      from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id where cs.cart_id=cart_value
    ) x),'[]'::jsonb),
    'notes',coalesce((select jsonb_agg(jsonb_build_array(store_id,note) order by store_id)
      from public.customer_cart_store_notes where cart_id=cart_value),'[]'::jsonb))::text
$$;
create function finance_private.c3_lock_cart(owner_value uuid)
returns uuid language plpgsql set search_path='' as $$
declare cart_value uuid;
begin
  select id into cart_value from public.customer_carts where customer_id=owner_value for update;
  if not found then raise exception 'cart is empty'; end if;
  perform 1 from public.customer_cart_items where cart_id=cart_value order by product_id for update;
  perform 1 from public.customer_cart_offer_selections where cart_id=cart_value order by offer_id for update;
  perform 1 from public.customer_cart_store_notes where cart_id=cart_value order by store_id for update;
  perform 1 from public.store_offers o where exists(select 1 from public.customer_cart_offer_selections cs
    where cs.cart_id=cart_value and cs.offer_id=o.id) order by o.id for share;
  perform 1 from public.store_offer_products op where exists(select 1 from public.customer_cart_offer_selections cs
    where cs.cart_id=cart_value and cs.offer_id=op.offer_id) order by op.id for share;
  perform 1 from public.products p where exists(select 1 from public.customer_cart_items ci where ci.cart_id=cart_value and ci.product_id=p.id)
    or exists(select 1 from public.customer_cart_offer_selections cs join public.store_offer_products op on op.offer_id=cs.offer_id
      where cs.cart_id=cart_value and op.product_id=p.id) order by p.id for share;
  return cart_value;
end $$;

create table public.customer_order_requests (
  customer_id uuid not null references public.profiles(id) on delete restrict,
  request_key uuid not null,
  canonical_input jsonb not null,
  state text not null default 'pending' check(state in ('pending','completed','rejected')),
  failure_code text,
  customer_order_id uuid unique references public.customer_orders(id) on delete restrict,
  primary key(customer_id,request_key),
  check ((state='pending' and customer_order_id is null and failure_code is null)
    or (state='completed' and customer_order_id is not null and failure_code is null)
    or (state='rejected' and customer_order_id is null and failure_code is not null and failure_code in ('C3_CART_CHANGED','C3_PRICE_CHANGED','C3_ORDER_REJECTED')))
);
alter table public.customer_order_requests enable row level security;
revoke all on public.customer_order_requests from public,anon,authenticated,service_role;
create function public.create_c3_order_from_cart(input_recipient_name text,input_contact_phone text,input_delivery_address text,
  input_delivery_zone uuid,input_customer_note text,request_key_value uuid,expected_total numeric,
  expected_user uuid,expected_cart_signature text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request_row public.customer_order_requests%rowtype; payload jsonb; order_value uuid; total_value numeric;
  cart_value uuid; failure_value text;
begin
  -- Before INSERT, locks, or replay: a new bearer must never execute an old account's intent.
  if expected_user is null or expected_user is distinct from auth.uid() then
    raise exception 'C3_ACCOUNT_CHANGED' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=expected_user and role='customer') then
    raise exception 'customer required' using errcode='42501'; end if;
  if request_key_value is null or expected_total is null or expected_total<0 or expected_total<>round(expected_total,2)
    or expected_total>999999999999.99 or expected_total::text in ('NaN','Infinity','-Infinity')
    or expected_cart_signature is null or char_length(expected_cart_signature) not between 1 and 1000000 then
    raise exception 'invalid confirmed checkout input'; end if;
  payload:=jsonb_build_array(expected_user,input_recipient_name,input_contact_phone,input_delivery_address,input_delivery_zone,
    input_customer_note,expected_total,expected_cart_signature);
  insert into public.customer_order_requests(customer_id,request_key,canonical_input)
    values(expected_user,request_key_value,payload) on conflict do nothing;
  select * into strict request_row from public.customer_order_requests
    where customer_id=expected_user and request_key=request_key_value for update;
  if request_row.canonical_input is distinct from payload then raise exception 'C3_ATTEMPT_INPUT_MISMATCH'; end if;
  if request_row.state='completed' then
    if not exists(select 1 from public.customer_orders where id=request_row.customer_order_id and customer_id=expected_user) then raise exception 'C3_ORDER_OWNERSHIP_MISMATCH' using errcode='42501'; end if;
    return jsonb_build_object('state','completed','order_id',request_row.customer_order_id,'replayed',true); end if;
  if request_row.state='rejected' then return jsonb_build_object('state','rejected','code',request_row.failure_code); end if;
  begin
    perform 1 from public.delivery_zones where id=input_delivery_zone and is_active for share;
    if not found then raise exception 'delivery zone is unavailable'; end if;
    cart_value:=finance_private.c3_lock_cart(expected_user);
    if finance_private.c3_cart_signature(cart_value) is distinct from expected_cart_signature then raise exception 'C3_CART_CHANGED'; end if;
    order_value:=public.create_order_from_cart(input_recipient_name,input_contact_phone,input_delivery_address,input_delivery_zone,input_customer_note);
    select approved_total into strict total_value from public.order_pricing_snapshots where customer_order_id=order_value;
    if total_value<>expected_total then raise exception 'C3_PRICE_CHANGED'; end if;
  exception when raise_exception or numeric_value_out_of_range or check_violation or foreign_key_violation then
    -- The subtransaction rolls back order/items/references/notifications. Persist a
    -- terminal rejection so a delayed same-key request cannot later create an order.
    failure_value:=case when sqlerrm='C3_CART_CHANGED' then 'C3_CART_CHANGED'
      when sqlerrm='C3_PRICE_CHANGED' then 'C3_PRICE_CHANGED' else 'C3_ORDER_REJECTED' end;
    update public.customer_order_requests set state='rejected',failure_code=failure_value
      where customer_id=expected_user and request_key=request_key_value;
    return jsonb_build_object('state','rejected','code',failure_value);
  end;
  update public.customer_order_requests set state='completed',customer_order_id=order_value
    where customer_id=expected_user and request_key=request_key_value;
  return jsonb_build_object('state','completed','order_id',order_value,'replayed',false);
end $$;
revoke all on function public.create_c3_order_from_cart(text,text,text,uuid,text,uuid,numeric,uuid,text) from public,anon,service_role;
grant execute on function public.create_c3_order_from_cart(text,text,text,uuid,text,uuid,numeric,uuid,text) to authenticated;

create function public.recover_c3_order_request(request_key_value uuid,expected_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare row_value public.customer_order_requests%rowtype;
begin
  if expected_user is null or expected_user is distinct from auth.uid() then
    raise exception 'C3_ACCOUNT_CHANGED' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=expected_user and role='customer') then
    raise exception 'customer required' using errcode='42501'; end if;
  select * into row_value from public.customer_order_requests where customer_id=expected_user and request_key=request_key_value;
  if not found or row_value.state='pending' then return jsonb_build_object('state','unknown'); end if;
  if row_value.state='rejected' then return jsonb_build_object('state','rejected','code',row_value.failure_code); end if;
  if not exists(select 1 from public.customer_orders where id=row_value.customer_order_id and customer_id=expected_user) then raise exception 'C3_ORDER_OWNERSHIP_MISMATCH' using errcode='42501'; end if;
  return jsonb_build_object('state','completed','order_id',row_value.customer_order_id);
end $$;
revoke all on function public.recover_c3_order_request(uuid,uuid) from public,anon,service_role;
grant execute on function public.recover_c3_order_request(uuid,uuid) to authenticated;

create function public.get_c3_delivery_zones()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(z) order by z.sort_order,z.id) from public.delivery_zones z
    where z.is_active or public.is_admin()),'[]'::jsonb);
end $$;
create function public.save_c3_delivery_zone(target_zone uuid,zone_name text,base_fee numeric,uplift_fee numeric,
  active boolean,expected_version bigint default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
  if not public.is_admin() then raise exception 'administrator required' using errcode='42501'; end if;
  if nullif(trim(zone_name),'') is null or active is null then raise exception 'zone fields required'; end if;
  perform finance_private.c3_fee(base_fee,uplift_fee,1);
  if target_zone is null then
    insert into public.delivery_zones(name,fixed_fee,additional_store_fee,is_active)
    values(trim(zone_name),base_fee,uplift_fee,active) returning id into result_id;
  else
    update public.delivery_zones set name=trim(zone_name),fixed_fee=base_fee,additional_store_fee=uplift_fee,is_active=active
    where id=target_zone and pricing_version=expected_version returning id into result_id;
    if result_id is null then raise exception 'zone changed; reload before saving'; end if;
  end if;
  return result_id;
end $$;
revoke all on function public.get_c3_delivery_zones() from public,anon,service_role;
revoke all on function public.save_c3_delivery_zone(uuid,text,numeric,numeric,boolean,bigint) from public,anon,service_role;
grant execute on function public.get_c3_delivery_zones() to authenticated;
grant execute on function public.save_c3_delivery_zone(uuid,text,numeric,numeric,boolean,bigint) to authenticated;

create function public.get_c3_order_context(target_orders uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result_value jsonb:='{}'; order_value uuid; refs jsonb; pricing jsonb; parent_row public.customer_orders%rowtype;
  may_read boolean; has_context boolean;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if target_orders is null or cardinality(target_orders)>100 then raise exception 'too many order IDs'; end if;
  foreach order_value in array target_orders loop
    select * into parent_row from public.customer_orders where id=order_value;
    if not found then continue; end if;
    may_read:=public.can_view_customer_order(order_value) or (public.is_available_driver()
      and exists(select 1 from public.delivery_tasks where customer_order_id=order_value and status='available'));
    if not may_read then continue; end if;
    select jsonb_object_agg(r.kind||':'||r.document_id::text,r.public_reference) into refs
    from public.financial_document_references r where
      (r.kind='ORD' and r.customer_order_id=order_value)
      or (r.kind='DLV' and exists(select 1 from public.delivery_tasks d where d.id=r.delivery_task_id and d.customer_order_id=order_value))
      or (r.kind='SUB' and exists(select 1 from public.store_orders s where s.id=r.store_order_id and s.customer_order_id=order_value
        and (public.is_admin() or parent_row.customer_id=auth.uid() or public.is_store_owner(s.store_id)
          or exists(select 1 from public.delivery_tasks d where d.customer_order_id=order_value and d.driver_id=auth.uid()))));
    pricing:=null;
    if public.c3_pricing_readable(order_value) then
      select jsonb_build_object('original',to_jsonb(s),'current',to_jsonb(c)) into pricing
      from public.order_pricing_snapshots s join public.order_pricing_current c using(customer_order_id)
      where s.customer_order_id=order_value;
    end if;
    has_context:=refs is not null or pricing is not null;
    if has_context then result_value:=result_value||jsonb_build_object(order_value::text,jsonb_build_object('references',coalesce(refs,'{}'), 'pricing',pricing)); end if;
  end loop;
  return result_value;
end $$;
revoke all on function public.get_c3_order_context(uuid[]) from public,anon,service_role;
grant execute on function public.get_c3_order_context(uuid[]) to authenticated;

revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;
-- Preserve the original function OIDs where replaced. No financial journal
-- function is called, no legacy financial trigger is removed, and no backfill runs.

-- Read-only authoritative checkout quote. Creation recalculates and compares,
-- so a stale quote never silently authorizes a larger amount.
create function public.quote_c3_cart(target_zone uuid,expected_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare zone_row public.delivery_zones%rowtype; cart_value uuid; goods numeric; offer_goods numeric;
  count_value integer; fee_value numeric;
begin
  if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'C3_ACCOUNT_CHANGED' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=expected_user and role='customer') then raise exception 'customer required' using errcode='42501'; end if;
  select * into zone_row from public.delivery_zones where id=target_zone and is_active for share;
  if not found then raise exception 'delivery zone is unavailable'; end if;
  cart_value:=finance_private.c3_lock_cart(expected_user);
  select count(*)::integer into count_value from (
    select p.store_id from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_value
    union select o.store_id from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id where cs.cart_id=cart_value
  ) stores_in_cart;
  if count_value=0 then raise exception 'cart is empty'; end if;
  select coalesce(sum(round(ci.quantity*p.price,2)),0) into goods
  from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_value;
  select coalesce(sum(offer_total),0) into offer_goods from (
    select o.id,case when o.offer_type='bundle' then round(o.bundle_price,2) else sum(case
      when o.offer_type='discount' and o.discount_method='percentage' then round(round(p.price*op.quantity,2)*(100-o.discount_value)/100,2)
      when o.offer_type='discount' then round(greatest(0,p.price-o.discount_value)*op.quantity,2)
      when op.item_role='reward' then 0 else round(p.price*op.quantity,2) end) end as offer_total
    from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id
    join public.store_offer_products op on op.offer_id=o.id join public.products p on p.id=op.product_id
    where cs.cart_id=cart_value group by o.id
  ) priced_offers;
  goods:=goods+offer_goods;
  fee_value:=finance_private.c3_fee(zone_row.fixed_fee,zone_row.additional_store_fee,count_value);
  if goods+fee_value>999999999999.99 then raise exception 'order total exceeds supported amount'; end if;
  return jsonb_build_object('items_amount',goods,'delivery_fee',fee_value,'total',goods+fee_value,'store_count',count_value,'cart_signature',finance_private.c3_cart_signature(cart_value));
end $$;
revoke all on function public.quote_c3_cart(uuid,uuid) from public,anon,service_role;
grant execute on function public.quote_c3_cart(uuid,uuid) to authenticated;

create function public.get_c3_pricing_exceptions(page_number integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'administrator required' using errcode='42501'; end if;
  if page_number<0 or page_number>100000 or page_number is null then raise exception 'invalid page'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select c.customer_order_id,c.total::text as current_amount,c.updated_at,r.public_reference,s.approved_total::text as approved_total,
      a.proposed_amounts->>'total' as proposed_total,
      ((a.proposed_amounts->>'total')::numeric-c.total)::text as difference,
      a.recorded_at,s.decided_at,a.proposed_amounts,a.reason
    from public.order_pricing_current c join public.order_pricing_snapshots s using(customer_order_id)
    join public.financial_document_references r
      on r.kind='ORD' and r.customer_order_id=c.customer_order_id
    join public.order_pricing_revisions a on a.customer_order_id=c.customer_order_id and a.version=c.version
    where c.review_required order by c.updated_at,c.customer_order_id limit 20 offset page_number*20
  ) x),'[]'::jsonb);
end $$;
revoke all on function public.get_c3_pricing_exceptions(integer) from public,anon,service_role;
grant execute on function public.get_c3_pricing_exceptions(integer) to authenticated;
-- Trigger-only helper; callers must use the authorized transition RPCs.
revoke all on function public.refresh_customer_order_status(uuid) from public,anon,authenticated,service_role;
revoke all on function public.make_order_delivery_available() from public,anon,authenticated,service_role;
-- Internal builder only: clients must confirm a server quote through the keyed C3 RPC.
revoke all on function public.create_order_from_cart(text,text,text,uuid,text) from public,anon,authenticated,service_role;
commit;
