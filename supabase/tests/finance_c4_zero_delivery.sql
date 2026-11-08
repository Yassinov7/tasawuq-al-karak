-- MUTATING, rollback-only. Run ONLY through the pinned local C4 harness.
-- Full schema + C2/C3/three C4 drafts and synthetic approved fixtures required.
-- No remote execution. Sequences can advance despite rollback.
\set ON_ERROR_STOP on
begin;
select set_config('c4z.token',:'test_token',true),set_config('c4z.admin',:'admin_user',true),
  set_config('c4z.driver',:'driver_user',true),set_config('c4z.customer',:'customer_user',true),
  set_config('c4z.paid',:'product_a',true),set_config('c4z.free',:'product_b',true);
do $$ begin
  if current_database() !~ '_c2_test$' or to_regclass('c2_test_guard.environment') is null
    or not coalesce(host(inet_server_addr()) in ('127.0.0.1','::1'),false) then
    raise exception 'isolated loopback test database required'; end if;
  perform 1 from c2_test_guard.environment where singleton and token=current_setting('c4z.token')::uuid;
  if not found then raise exception 'test marker mismatch'; end if;
end $$;
create function pg_temp.c4z_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'C4 ZERO ASSERT: %',message; end if; end $$;
-- Use REAL C3 creation and rejection, never rewrite original snapshots or commission bases.
create function pg_temp.c4z_order(reject_paid boolean) returns uuid language plpgsql as $$
declare free_product public.products%rowtype; paid_product public.products%rowtype;
  owner_value uuid; offer_value uuid; zone_value uuid; cart_value uuid; q jsonb; result_value jsonb;
  order_value uuid; child record; task_value uuid;
begin
  select * into strict free_product from public.products where id=current_setting('c4z.free')::uuid;
  select * into strict paid_product from public.products where id=current_setting('c4z.paid')::uuid;
  perform pg_temp.c4z_assert(free_product.store_id<>paid_product.store_id,'distinct real fixture stores');
  select m.owner_user_id into strict owner_value from public.stores s join public.merchants m on m.id=s.merchant_id where s.id=free_product.store_id;
  perform set_config('request.jwt.claim.sub',owner_value::text,true);
  offer_value:=public.save_store_offer(null,'C4 zero fixture','synthetic','discount','percentage',100,null,null,true,
    jsonb_build_array(jsonb_build_object('product_id',free_product.id,'item_role','discounted','quantity',free_product.minimum_quantity)));
  perform set_config('request.jwt.claim.sub',current_setting('c4z.admin'),true);
  zone_value:=public.save_c3_delivery_zone(null,'C4 zero fee fixture',0,0,true,null);
  update finance_private.c4_rollout set accept_new_orders=true where singleton;
  perform set_config('request.jwt.claim.sub',current_setting('c4z.customer'),true);
  insert into public.customer_carts(customer_id) values(auth.uid()) on conflict(customer_id) do nothing;
  select id into strict cart_value from public.customer_carts where customer_id=auth.uid();
  delete from public.customer_cart_items where cart_id=cart_value;
  delete from public.customer_cart_offer_selections where cart_id=cart_value;
  delete from public.customer_cart_store_notes where cart_id=cart_value;
  insert into public.customer_cart_items(cart_id,product_id,quantity) values(cart_value,paid_product.id,paid_product.minimum_quantity);
  perform public.add_customer_cart_offer(offer_value);
  q:=public.quote_c3_cart(zone_value,auth.uid());
  perform pg_temp.c4z_assert((q->>'total')::numeric>0,'initially positive approved order');
  result_value:=public.create_c3_order_from_cart('C4 zero recipient','00000','synthetic',zone_value,'',gen_random_uuid(),
    (q->>'total')::numeric,auth.uid(),q->>'cart_signature');
  perform pg_temp.c4z_assert(result_value->>'state'='completed','real creation');
  order_value:=(result_value->>'order_id')::uuid;
  set constraints all immediate;
  perform pg_temp.c4z_assert(finance_private.c4_is_order(order_value),'birth-selected C4, no manual conversion');
  perform set_config('request.jwt.claim.sub',current_setting('c4z.admin'),true);
  for child in select * from public.store_orders where customer_order_id=order_value order by id loop
    if reject_paid and child.store_id=paid_product.store_id then
      perform public.update_store_order_status(child.id,'rejected','synthetic paid store rejected');
    else
      perform public.update_store_order_status(child.id,'preparing');
      perform public.update_store_order_status(child.id,'ready_for_pickup');
    end if;
  end loop;
  select id into strict task_value from public.delivery_tasks where customer_order_id=order_value;
  perform set_config('request.jwt.claim.sub',current_setting('c4z.driver'),true);
  perform public.accept_delivery_task(order_value);
  for child in select id from public.store_orders where customer_order_id=order_value and status='ready_for_pickup' order by id loop
    perform public.confirm_c4_store_pickup(task_value,child.id,auth.uid());
  end loop;
  return task_value;
end $$;
do $$
declare task_value uuid; parent_value uuid; version_value bigint; key_value uuid:=gen_random_uuid(); r jsonb;
  events_before bigint; journals_before bigint; accounts_before bigint; snapshots_before jsonb; c5_before jsonb;
begin
  task_value:=pg_temp.c4z_order(true);
  select customer_order_id into strict parent_value from public.delivery_tasks where id=task_value;
  select version into strict version_value from public.order_pricing_current where customer_order_id=parent_value and total=0;
  select to_jsonb(s) into strict snapshots_before from public.order_pricing_snapshots s where customer_order_id=parent_value;
  perform pg_temp.c4z_assert((public.get_c4_pickup_context(array[task_value],auth.uid())->(task_value::text)->>'can_complete_delivery')::boolean,'zero server capability enabled');
  select count(*) into events_before from public.financial_events;
  select count(*) into journals_before from public.journal_entries;
  select count(*) into accounts_before from public.financial_accounts;
  if to_regprocedure('finance_private.c5_position(uuid)') is not null then
    execute 'select finance_private.c5_position($1)' into c5_before using auth.uid();
  end if;
  r:=public.complete_delivery_and_collect_cash(task_value,auth.uid(),key_value,version_value);
  set constraints all immediate;
  perform pg_temp.c4z_assert(r->>'state'='completed' and r->>'kind'='zero_cash_delivery' and (r->>'amount')::numeric=0,'explicit zero outcome');
  perform pg_temp.c4z_assert((select status='delivered' from public.delivery_tasks where id=task_value),'delivery completed');
  perform pg_temp.c4z_assert((select kind='zero_cash_delivery' and cash_event_id is null and delivery_event_id is null
    from public.delivery_collection_results where task_id=task_value),'no financial event pointers');
  perform pg_temp.c4z_assert(exists(select 1 from public.order_lifecycle_events where id=(r->>'delivery_lifecycle_event_id')::uuid
    and customer_order_id=parent_value and delivery_task_id=task_value and event_type='delivery_completed'),'independent delivery audit');
  perform pg_temp.c4z_assert(not exists(select 1 from public.order_lifecycle_events where customer_order_id=parent_value and event_type='full_cash_collected'),'no cash lifecycle event');
  perform pg_temp.c4z_assert(public.recover_delivery_collection(key_value,auth.uid())->>'kind'='zero_cash_delivery','lost-response recovery');
  perform pg_temp.c4z_assert(public.complete_delivery_and_collect_cash(task_value,auth.uid(),key_value,version_value)->>'kind'='zero_cash_delivery','same-key replay');
  perform pg_temp.c4z_assert(public.complete_delivery_and_collect_cash(task_value,auth.uid(),gen_random_uuid(),version_value)->>'kind'='zero_cash_delivery','different key cannot repeat delivery');
  perform pg_temp.c4z_assert((select count(*)=1 from public.delivery_collection_results where task_id=task_value),'one immutable result');
  if c5_before is not null then
    perform pg_temp.c4z_assert(finance_private.c5_position(auth.uid())=c5_before,'zero delivery leaves C5 custody unchanged');
  end if;
  perform pg_temp.c4z_assert((select count(*)=events_before from public.financial_events),'no financial event, including zero cash');
  perform pg_temp.c4z_assert((select count(*)=journals_before from public.journal_entries),'no fake/zero journal');
  perform pg_temp.c4z_assert((select count(*)=accounts_before from public.financial_accounts),'no custody account created');
  perform pg_temp.c4z_assert((select to_jsonb(s)=snapshots_before from public.order_pricing_snapshots s where customer_order_id=parent_value),'original pricing unchanged');
  perform pg_temp.c4z_assert(not exists(select 1 from public.customer_order_cash_obligations where customer_order_id=parent_value),'legacy writer remains fenced');
  -- Deliberately contradictory isolated state: positive merchandise hidden behind current zero.
  -- Original snapshots and commission bases are NOT changed; this must be rejected.
  task_value:=pg_temp.c4z_order(false);
  select customer_order_id into strict parent_value from public.delivery_tasks where id=task_value;
  update public.order_pricing_current set items_amount=0,delivery_fee=0,total=0 where customer_order_id=parent_value returning version into version_value;
  key_value:=gen_random_uuid();
  if to_regprocedure('finance_private.c5_position(uuid)') is not null then
    execute 'select finance_private.c5_position($1)' into c5_before using auth.uid();
  end if;
  r:=public.complete_delivery_and_collect_cash(task_value,auth.uid(),key_value,version_value);
  perform pg_temp.c4z_assert(r->>'state'='rejected' and r->>'code'='zero_cash_economic_conflict','positive hidden economics stops only this path');
  perform pg_temp.c4z_assert((select status='picked_up' from public.delivery_tasks where id=task_value),'conflict does not deliver');
  perform pg_temp.c4z_assert(public.recover_delivery_collection(key_value,auth.uid())=r,'conflict is durably recoverable');
  perform pg_temp.c4z_assert((select count(*)=events_before from public.financial_events),'conflict creates no event');
  perform pg_temp.c4z_assert((select count(*)=journals_before from public.journal_entries),'conflict creates no journal');
end $$;
set constraints all immediate;
rollback;
\echo 'PASS isolated zero delivery, genuine C3 rejection, recovery, replay and economic conflict assertions'
