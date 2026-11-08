-- MUTATING TEST: disposable LOCAL database only, complete previous schema + C2 + C3.
-- Run through scripts/test-finance-c3-postgres.cjs, never Dashboard/production.
-- Synthetic accepted stores must have active subscription commission snapshots.
-- All rows rollback; sequence allocations do NOT rollback. Missing fixtures FAIL.
\set ON_ERROR_STOP on
begin;
select set_config('c3.admin', :'admin_user', true), set_config('c3.customer', :'customer_user', true),
  set_config('c3.merchant', :'merchant_user', true), set_config('c3.driver', :'driver_user', true),
  set_config('c3.a', :'product_a', true), set_config('c3.b', :'product_b', true), set_config('c3.c', :'product_c', true), set_config('c3.legacy', :'legacy_order', true), set_config('c3.legacy_task', :'legacy_task', true);
create function pg_temp.c3_assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'C3 ASSERT: %',message; end if; end $$;
create function pg_temp.c3_reject(statement text, expected_state text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate=expected_state then return; end if;
    raise exception 'unexpected SQLSTATE %: %',sqlstate,sqlerrm;
  end;
  raise exception 'statement unexpectedly succeeded: %',statement;
end $$;
create function pg_temp.c3_order(store_count integer, zone_value uuid) returns uuid language plpgsql as $$
declare cart_value uuid; product_value uuid; quote_value jsonb; key_value uuid:=gen_random_uuid(); bad_key uuid:=gen_random_uuid(); result_id uuid; result_value jsonb;
begin
  perform set_config('request.jwt.claim.sub',current_setting('c3.customer'),true);
  insert into public.customer_carts(customer_id) values(current_setting('c3.customer')::uuid)
    on conflict(customer_id) do update set customer_id=excluded.customer_id returning id into cart_value;
  delete from public.customer_cart_items where cart_id=cart_value;
  delete from public.customer_cart_offer_selections where cart_id=cart_value;
  foreach product_value in array (array[current_setting('c3.a')::uuid,current_setting('c3.b')::uuid,current_setting('c3.c')::uuid])[1:store_count] loop
    insert into public.customer_cart_items(cart_id,product_id,quantity)
    select cart_value,id,minimum_quantity from public.products where id=product_value;
  end loop;
  quote_value:=public.quote_c3_cart(zone_value,current_setting('c3.customer')::uuid);
  result_value:=public.create_c3_order_from_cart('C3 synthetic recipient','0000000000','Synthetic test address',zone_value,'C3 isolated test',bad_key,0,current_setting('c3.customer')::uuid,quote_value->>'cart_signature');
  perform pg_temp.c3_assert(result_value->>'state'='rejected' and result_value->>'code'='C3_PRICE_CHANGED','wrong total persisted as terminal rejection');
  perform pg_temp.c3_assert((select state='rejected' and customer_order_id is null from public.customer_order_requests where request_key=bad_key),'bad attempt cannot later create');
  perform pg_temp.c3_assert(public.create_c3_order_from_cart('C3 synthetic recipient','0000000000','Synthetic test address',zone_value,'C3 isolated test',bad_key,0,current_setting('c3.customer')::uuid,quote_value->>'cart_signature')->>'state'='rejected','rejected key cannot create on replay');
  result_value:=public.create_c3_order_from_cart('C3 synthetic recipient','0000000000','Synthetic test address',zone_value,'C3 isolated test',key_value,(quote_value->>'total')::numeric,current_setting('c3.customer')::uuid,quote_value->>'cart_signature');
  perform pg_temp.c3_assert(result_value->>'state'='completed','valid creation completed');
  result_id:=(result_value->>'order_id')::uuid;
  set constraints all immediate;
  perform pg_temp.c3_assert((select count(*)=store_count from public.store_order_commissions c join public.store_orders s on s.id=c.store_order_id where s.customer_order_id=result_id),'commission snapshots exist at creation boundary');
  result_value:=public.create_c3_order_from_cart('C3 synthetic recipient','0000000000','Synthetic test address',zone_value,'C3 isolated test',key_value,(quote_value->>'total')::numeric,current_setting('c3.customer')::uuid,quote_value->>'cart_signature');
  perform pg_temp.c3_assert((result_value->>'order_id')::uuid=result_id and (result_value->>'replayed')::boolean,'same-key replay returns original order without a cart');
  perform pg_temp.c3_assert((public.recover_c3_order_request(key_value,current_setting('c3.customer')::uuid)->>'order_id')::uuid=result_id,'recovery works after server cart cleared');
  perform pg_temp.c3_reject(format('select public.create_c3_order_from_cart(''different recipient'',''0000000000'',''Synthetic test address'',%L,''C3 isolated test'',%L,%s,%L,%L)',zone_value,key_value,quote_value->>'total',current_setting('c3.customer'),quote_value->>'cart_signature'),'P0001');
  perform set_config('c3.last_key',key_value::text,true);
  return result_id;
end $$;

do $$
declare zone_value uuid; order_value uuid; single_order uuid; zero_order uuid; blocked_order uuid; child_value uuid;
  total_before numeric; original_snapshot jsonb; task_count integer; context_value jsonb; journal_count bigint;
begin
  perform set_config('request.jwt.claim.sub',current_setting('c3.admin'),true);
  perform pg_temp.c3_assert(public.is_admin(),'synthetic admin required');
  perform pg_temp.c3_assert((select count(distinct store_id)=3 from public.products where id in
    (current_setting('c3.a')::uuid,current_setting('c3.b')::uuid,current_setting('c3.c')::uuid) and is_available),'three available products from distinct synthetic stores required');
  zone_value:=public.save_c3_delivery_zone(null,'C3 test '||gen_random_uuid()::text,10000,3000,true,null);
  perform set_config('c3.zone',zone_value::text,true);
  perform pg_temp.c3_assert(finance_private.c3_fee(10000,3000,1)=10000,'one store base');
  perform pg_temp.c3_assert(finance_private.c3_fee(10000,3000,2)=13000,'two stores uplift');
  perform pg_temp.c3_assert(finance_private.c3_fee(10000,3000,3)=16000,'three stores uplift');
  perform pg_temp.c3_assert(finance_private.c3_fee(10000,3000,0)=0,'zero stores no fee');
  perform pg_temp.c3_reject('select finance_private.c3_fee(10000.50,0,1)','P0001');
  perform pg_temp.c3_reject('select finance_private.c3_fee(-1,0,1)','P0001');
  select count(*) into journal_count from public.journal_entries;
  single_order:=pg_temp.c3_order(1,zone_value);
  perform pg_temp.c3_assert((select delivery_fee=10000 from public.order_pricing_current where customer_order_id=single_order),'single-store creation base only');
  order_value:=pg_temp.c3_order(3,zone_value);
  perform set_config('c3.order',order_value::text,true);
  perform set_config('request.jwt.claim.sub',current_setting('c3.merchant'),true);
  select id into child_value from public.store_orders where customer_order_id=order_value and not public.is_store_owner(store_id) order by id limit 1;
  perform pg_temp.c3_assert(child_value is not null,'foreign-store child fixture required');
  perform set_config('c3.foreign_child',child_value::text,true);
  select to_jsonb(s) into original_snapshot from public.order_pricing_snapshots s where customer_order_id=order_value;
  perform pg_temp.c3_assert((original_snapshot->>'original_delivery_fee')::numeric=16000,'created three-store snapshot');
  perform pg_temp.c3_assert(not exists(select 1 from public.delivery_tasks where customer_order_id=order_value),'no early task');
  perform pg_temp.c3_assert((select count(*)=4 from public.financial_document_references where customer_order_id=order_value or store_order_id in(select id from public.store_orders where customer_order_id=order_value)),'ORD and three SUB only');
  perform set_config('request.jwt.claim.sub',current_setting('c3.admin'),true);
  perform public.save_c3_delivery_zone(zone_value,'C3 changed '||zone_value::text,90000,8000,true,1);
  select id into child_value from public.store_orders where customer_order_id=order_value order by id limit 1;
  perform public.update_store_order_status(child_value,'preparing');
  perform public.update_store_order_status(child_value,'ready_for_pickup');
  perform pg_temp.c3_assert(not exists(select 1 from public.delivery_tasks where customer_order_id=order_value),'one ready is insufficient');
  select id into child_value from public.store_orders where customer_order_id=order_value and status='awaiting_review' order by id limit 1;
  perform public.update_store_order_status(child_value,'rejected','C3 synthetic rejection');
  perform public.update_store_order_status(child_value,'rejected','C3 synthetic rejection');
  perform pg_temp.c3_assert((select delivery_fee=13000 and total<(original_snapshot->>'approved_total')::numeric from public.order_pricing_current where customer_order_id=order_value),'decrease uses original snapshot, not current zone');
  perform pg_temp.c3_assert((select count(*)=1 from public.order_pricing_revisions where customer_order_id=order_value),'rejection retry does not duplicate audit');
  for child_value in select id from public.store_orders where customer_order_id=order_value and status='awaiting_review' loop
    perform public.update_store_order_status(child_value,'preparing');
    perform public.update_store_order_status(child_value,'ready_for_pickup');
  end loop;
  perform finance_private.c3_dispatch(order_value);
  perform pg_temp.c3_assert((select count(*)=1 from public.delivery_tasks where customer_order_id=order_value),'one real DLV after all remaining stores ready');
  perform pg_temp.c3_assert((select count(*)=1 from public.financial_document_references r join public.delivery_tasks d on d.id=r.delivery_task_id where d.customer_order_id=order_value and r.kind='DLV'),'one DLV reference');
  perform pg_temp.c3_assert((select to_jsonb(s)=original_snapshot from public.order_pricing_snapshots s where customer_order_id=order_value),'initial snapshot immutable');
  perform pg_temp.c3_reject(format('update public.order_pricing_snapshots set approved_total=0 where customer_order_id=%L',order_value),'55000');
  -- Actual legacy delivery path: C3 must not add a second money writer.
  perform set_config('request.jwt.claim.sub',current_setting('c3.driver'),true);
  perform pg_temp.c3_assert(public.is_available_driver(),'available accepted synthetic driver required');
  perform public.accept_delivery_task(order_value);
  perform public.update_delivery_task_status(order_value,'picked_up');
  perform public.update_delivery_task_status(order_value,'delivered');
  perform public.create_delivered_order_cash_foundations(order_value);
  perform public.create_delivered_order_cash_foundations(order_value);
  set constraints all immediate;
  perform pg_temp.c3_assert((select count(*)=2 from public.merchant_order_entitlements e join public.store_orders s on s.id=e.store_order_id where s.customer_order_id=order_value),'one merchant entitlement per delivered store');
  perform pg_temp.c3_assert((select count(*)=2 from public.store_order_commissions c join public.store_orders s on s.id=c.store_order_id where s.customer_order_id=order_value and c.status='due'),'commissions due exactly once');
  perform pg_temp.c3_assert(not exists(select 1 from public.store_order_commissions c join public.store_orders so on so.id=c.store_order_id where so.customer_order_id=order_value and c.status='due' and c.commission_amount>0 and not exists(select 1 from public.merchant_ledger_entries l where l.source_type='store_order_commission' and l.source_id=c.id and l.amount=c.commission_amount)),'legacy commission ledger exists with exact snapshot amount');
  perform pg_temp.c3_assert(not exists(select 1 from public.merchant_order_entitlements e join public.store_orders s on s.id=e.store_order_id where s.customer_order_id=order_value and s.status in ('rejected','cancelled')),'excluded children have no entitlement');
  perform pg_temp.c3_assert((select count(*)=1 from public.customer_order_cash_obligations where customer_order_id=order_value),'one legacy cash obligation');
  perform pg_temp.c3_assert((select o.collectible_amount=c.total and o.delivery_fee_amount=c.delivery_fee from public.customer_order_cash_obligations o join public.order_pricing_current c using(customer_order_id) where o.customer_order_id=order_value),'legacy cash uses decreased effective amount and delivery fee once');
  perform pg_temp.c3_assert((select count(*)=1 from public.driver_delivery_fee_entitlements where customer_order_id=order_value),'one legacy driver fee entitlement');
  -- All rejected: cancel, no phantom DLV.
  zero_order:=pg_temp.c3_order(2,zone_value);
  perform set_config('request.jwt.claim.sub',current_setting('c3.admin'),true);
  for child_value in select id from public.store_orders where customer_order_id=zero_order order by id loop
    perform public.update_store_order_status(child_value,'rejected','C3 all rejected');
  end loop;
  perform pg_temp.c3_assert((select status='cancelled' from public.customer_orders where id=zero_order),'all rejected parent cancelled');
  perform pg_temp.c3_assert((select total=0 from public.order_pricing_current where customer_order_id=zero_order),'all rejected no payable amount');
  perform pg_temp.c3_assert(not exists(select 1 from public.delivery_tasks where customer_order_id=zero_order),'no task for cancelled parent');
  -- Fault injection ONLY in this disposable transaction: manufacture unexpected
  -- increase relative to current payable total. Never mutate production prices.
  blocked_order:=pg_temp.c3_order(2,zone_value);
  perform set_config('request.jwt.claim.sub',current_setting('c3.admin'),true);
  update public.order_pricing_current set items_amount=1,delivery_fee=0,total=1 where customer_order_id=blocked_order;
  select id into child_value from public.store_orders where customer_order_id=blocked_order order by id limit 1;
  perform public.update_store_order_status(child_value,'rejected','C3 injected increase guard');
  perform pg_temp.c3_assert((select review_required and total=1 from public.order_pricing_current where customer_order_id=blocked_order),'increase not applied');
  perform pg_temp.c3_assert((select not applied and (proposed_amounts->>'total')::numeric>1 from public.order_pricing_revisions where customer_order_id=blocked_order),'proposed increase preserved in audit');
  for child_value in select id from public.store_orders where customer_order_id=blocked_order and status='awaiting_review' loop
    perform public.update_store_order_status(child_value,'preparing');
    perform public.update_store_order_status(child_value,'ready_for_pickup');
  end loop;
  perform pg_temp.c3_assert(not exists(select 1 from public.delivery_tasks where customer_order_id=blocked_order),'blocked pricing prevents dispatch even when ready');
  perform pg_temp.c3_assert((select status<>'cancelled' from public.customer_orders where id=blocked_order),'guard does not auto-cancel remaining stores');
  set constraints all immediate;
  perform pg_temp.c3_assert((select count(*)=journal_count from public.journal_entries),'C3 does not post journal entries');
  perform pg_temp.c3_assert((select count(*)=count(distinct order_sequence) and count(*)=count(distinct natural_key) from public.order_lifecycle_events where customer_order_id=order_value),'ordered and deduplicated events');
end $$;
-- Fractional cases use real products/offers/RPC; every fixture write rolls back.
do $$
declare product_a uuid:=current_setting('c3.a')::uuid; product_b uuid; store_value uuid; cart_value uuid;
  zone_value uuid:=current_setting('c3.zone')::uuid; offer_value uuid; order_value uuid; q jsonb; result_value jsonb;
  owner_value uuid; qty numeric; bundle_value numeric; case_row record; key_value uuid; journal_count bigint;
begin
  select count(*) into journal_count from public.journal_entries;
  select p.store_id,m.owner_user_id into strict store_value,owner_value from public.products p join public.stores s on s.id=p.store_id join public.merchants m on m.id=s.merchant_id where p.id=product_a;
  perform set_config('request.jwt.claim.sub',owner_value::text,true);
  update public.products set price=0.40,minimum_quantity=1,quantity_step=1 where id=product_a;
  insert into public.products(store_id,category_id,title,description,price,selling_unit,minimum_quantity,quantity_step,is_available)
    select store_id,category_id,'C3 fractional companion','synthetic',0.40,selling_unit,1,1,true from public.products where id=product_a returning id into product_b;
  perform set_config('request.jwt.claim.sub',owner_value::text,true);
  offer_value:=public.save_store_offer(null,'C3 fractional bundle','synthetic','bundle',null,null,0.50,null,true,
    jsonb_build_array(jsonb_build_object('product_id',product_a,'item_role','bundle','quantity',1),jsonb_build_object('product_id',product_b,'item_role','bundle','quantity',1)));
  for case_row in select * from (values (1::numeric,0.50::numeric),(2,1.00),(3,1.50),(1,0.01)) cases(qty,price) loop
    qty:=case_row.qty; bundle_value:=case_row.price;
    perform set_config('request.jwt.claim.sub',owner_value::text,true);
    perform public.save_store_offer(offer_value,'C3 fractional bundle','synthetic','bundle',null,null,bundle_value,null,true,
      jsonb_build_array(jsonb_build_object('product_id',product_a,'item_role','bundle','quantity',qty),jsonb_build_object('product_id',product_b,'item_role','bundle','quantity',qty)));
    perform set_config('request.jwt.claim.sub',current_setting('c3.customer'),true);
    select id into strict cart_value from public.customer_carts where customer_id=auth.uid();
    delete from public.customer_cart_items where cart_id=cart_value;
    delete from public.customer_cart_offer_selections where cart_id=cart_value;
    perform public.add_customer_cart_offer(offer_value);
    q:=public.quote_c3_cart(zone_value,auth.uid());
    perform pg_temp.c3_assert((q->>'items_amount')::numeric=bundle_value,'fractional quote matches bundle price');
    key_value:=gen_random_uuid();
    result_value:=public.create_c3_order_from_cart('fractional','00000','synthetic',zone_value,'',key_value,(q->>'total')::numeric,auth.uid(),q->>'cart_signature');
    perform pg_temp.c3_assert(result_value->>'state'='completed','fractional bundle succeeds');
    order_value:=(result_value->>'order_id')::uuid;
    set constraints all immediate;
    perform pg_temp.c3_assert((select original_items_amount=bundle_value and approved_total=(q->>'total')::numeric from public.order_pricing_snapshots where customer_order_id=order_value),'quote equals approval');
    perform pg_temp.c3_assert((select sum(i.line_total)=bundle_value from public.store_order_items i join public.store_orders s on s.id=i.store_order_id where s.customer_order_id=order_value),'allocations sum exactly');
    perform pg_temp.c3_assert((select array_agg(i.line_total order by op.id)=
      case when bundle_value=0.01 then array[0.01,0.00]::numeric[] else array[bundle_value/2,bundle_value/2] end
      from public.store_order_items i join public.store_orders s on s.id=i.store_order_id
      join public.store_offer_products op on op.offer_id=offer_value and op.product_id=i.product_id
      where s.customer_order_id=order_value),'each fractional bundle component matches its ordered share');
    perform pg_temp.c3_assert((select base_amount=bundle_value from public.store_order_commissions c join public.store_orders s on s.id=c.store_order_id where s.customer_order_id=order_value),'commission basis retains decimals');
  end loop;
  update public.products set price=100.50 where id=product_a;
  insert into public.customer_cart_items(cart_id,product_id,quantity) values(cart_value,product_a,1);
  q:=public.quote_c3_cart(zone_value,auth.uid());
  perform pg_temp.c3_assert((q->>'items_amount')::numeric=100.50,'100.50 is not 101');
  result_value:=public.create_c3_order_from_cart('fractional','00000','synthetic',zone_value,'',gen_random_uuid(),(q->>'total')::numeric,auth.uid(),q->>'cart_signature');
  perform pg_temp.c3_assert(result_value->>'state'='completed','100.50 order succeeds');
  set constraints all immediate;
  insert into public.customer_cart_items(cart_id,product_id,quantity) values(cart_value,product_a,1);
  perform pg_temp.c3_assert(public.recover_c3_order_request(key_value,auth.uid())->>'state'='completed','recovery independent of new cart');
  perform pg_temp.c3_assert((select count(*)=1 from public.customer_cart_items where cart_id=cart_value),'recovery preserves new cart');
  q:=public.quote_c3_cart(zone_value,auth.uid());
  update public.customer_cart_items set quantity=2 where cart_id=cart_value;
  result_value:=public.create_c3_order_from_cart('fractional','00000','synthetic',zone_value,'',gen_random_uuid(),(q->>'total')::numeric,auth.uid(),q->>'cart_signature');
  perform pg_temp.c3_assert(result_value->>'state'='rejected' and result_value->>'code'='C3_CART_CHANGED','changed cart terminally rejected');
  perform set_config('request.jwt.claim.sub',current_setting('c3.merchant'),true);
  perform pg_temp.c3_reject(format('select public.recover_c3_order_request(%L,%L)',key_value,current_setting('c3.customer')),'42501');
  perform pg_temp.c3_reject(format('select public.create_c3_order_from_cart(''x'',''0'',''x'',%L,'''',%L,0,%L,''x'')',zone_value,gen_random_uuid(),current_setting('c3.customer')),'42501');
  set constraints all immediate;
  perform pg_temp.c3_assert((select count(*)=journal_count from public.journal_entries),'no C2 journal after deferred triggers');
end $$;
-- Exact per-component production quote/create regressions. NOT executed by source tests.
do $$
declare product_a uuid:=current_setting('c3.a')::uuid; product_value uuid; products uuid[];
  owner_value uuid; cart_value uuid; offer_value uuid; order_value uuid; q jsonb; result_value jsonb;
  case_row record; input_components jsonb; actual_components numeric[]; journal_count bigint;
begin
  select count(*) into journal_count from public.journal_entries;
  select m.owner_user_id into strict owner_value from public.products p
    join public.stores s on s.id=p.store_id join public.merchants m on m.id=s.merchant_id where p.id=product_a;
  perform set_config('request.jwt.claim.sub',owner_value::text,true);
  products:=array[product_a];
  for counter in 1..3 loop
    insert into public.products(store_id,category_id,title,description,price,selling_unit,minimum_quantity,quantity_step,is_available)
      select store_id,category_id,'C3 final pricing companion '||counter,'synthetic',1,selling_unit,1,1,true
      from public.products where id=product_a returning id into product_value;
    products:=array_append(products,product_value);
  end loop;
  for case_row in select * from (values
    ('percentage',1,100.50::numeric,1::numeric,10::numeric,null::numeric,array[90.45]::numeric[]),
    ('percentage',1,100.50,2,10,null,array[180.90]::numeric[]),
    ('percentage',1,0.05,1,50,null,array[0.03]::numeric[]),
    ('fixed_amount',1,100.50,1,0.25,null,array[100.25]::numeric[]),
    ('fixed_amount',1,100.50,2,0.25,null,array[200.50]::numeric[]),
    ('bundle',2,0.40,1,null,0.50,array[0.25,0.25]::numeric[]),
    ('bundle',4,1.00,1,null,2.00,array[0.50,0.50,0.50,0.50]::numeric[]),
    ('bundle',2,0.40,2,null,1.00,array[0.50,0.50]::numeric[]),
    ('bundle',2,0.40,3,null,1.50,array[0.75,0.75]::numeric[]),
    ('bundle',3,1.00,1,null,0.10,array[0.03,0.04,0.03]::numeric[]),
    ('bundle',4,1.00,1,null,0.02,array[0.01,0.00,0.01,0.00]::numeric[])
  ) cases(method,component_count,price,quantity,discount,bundle,expected) loop
    perform set_config('request.jwt.claim.sub',owner_value::text,true);
    update public.products set price=case_row.price,minimum_quantity=1,quantity_step=1 where id=any(products);
    select jsonb_agg(jsonb_build_object('product_id',id,'item_role',
      case when case_row.method='bundle' then 'bundle' else 'discounted' end,'quantity',case_row.quantity) order by position)
    into input_components from unnest(products[1:case_row.component_count]) with ordinality as component(id,position);
    offer_value:=public.save_store_offer(null,'C3 exact pricing','synthetic',
      case when case_row.method='bundle' then 'bundle'::public.store_offer_type else 'discount'::public.store_offer_type end,
      case when case_row.method='bundle' then null else case_row.method::public.offer_discount_method end,
      case_row.discount,case_row.bundle,null,true,input_components);
    perform set_config('request.jwt.claim.sub',current_setting('c3.customer'),true);
    select id into strict cart_value from public.customer_carts where customer_id=auth.uid();
    delete from public.customer_cart_items where cart_id=cart_value;
    delete from public.customer_cart_offer_selections where cart_id=cart_value;
    perform public.add_customer_cart_offer(offer_value);
    q:=public.quote_c3_cart(current_setting('c3.zone')::uuid,auth.uid());
    perform pg_temp.c3_assert((q->>'items_amount')::numeric=(select sum(v) from unnest(case_row.expected) v),'exact quote price');
    perform pg_temp.c3_assert((q->>'delivery_fee')::numeric=trunc((q->>'delivery_fee')::numeric),'delivery alone remains integral');
    result_value:=public.create_c3_order_from_cart('pricing','00000','synthetic',current_setting('c3.zone')::uuid,'',
      gen_random_uuid(),(q->>'total')::numeric,auth.uid(),q->>'cart_signature');
    perform pg_temp.c3_assert(result_value->>'state'='completed','exact quote creates order');
    order_value:=(result_value->>'order_id')::uuid;
    set constraints all immediate;
    select array_agg(i.line_total order by op.id) into actual_components from public.store_order_items i
      join public.store_orders s on s.id=i.store_order_id
      join public.store_offer_products op on op.offer_id=offer_value and op.product_id=i.product_id
      where s.customer_order_id=order_value;
    perform pg_temp.c3_assert(actual_components=case_row.expected,'exact ordered amounts of EVERY component');
    perform pg_temp.c3_assert(not exists(select 1 from unnest(actual_components) v where v<0),'no negative components');
    perform pg_temp.c3_assert(not exists(select 1 from public.store_order_items i
      join public.store_orders s on s.id=i.store_order_id where s.customer_order_id=order_value
      and (i.quantity<>case_row.quantity or (i.offer_snapshot->>'final_line_total')::numeric<>i.line_total
        or i.unit_price_snapshot<>round(i.line_total/i.quantity,2))),'quantity and price snapshots retain exact line allocation');
    perform pg_temp.c3_assert((select base_amount=(q->>'items_amount')::numeric from public.store_order_commissions c
      join public.store_orders s on s.id=c.store_order_id where s.customer_order_id=order_value),'exact commission basis after deferred triggers');
    perform pg_temp.c3_assert((select approved_total=(q->>'total')::numeric from public.order_pricing_snapshots
      where customer_order_id=order_value),'approved total equals quote');
  end loop;
  -- Existing constraints, not a local coercion, must reject invalid stored money.
  perform pg_temp.c3_reject(format('update public.products set price=-1 where id=%L',product_a),'23514');
  perform pg_temp.c3_reject(format('update public.products set price=''Infinity''::numeric where id=%L',product_a),'22003');
  perform pg_temp.c3_reject(format('select finance_private.c3_fee(1.25,0,1)'),'P0001');
  set constraints all immediate;
  perform pg_temp.c3_assert((select count(*)=journal_count from public.journal_entries),'no C2 writer activated by pricing fixes');
end $$;
do $$
declare order_value uuid:=current_setting('c3.legacy')::uuid; child record;
begin
  perform set_config('request.jwt.claim.sub',current_setting('c3.admin'),true);
  perform pg_temp.c3_assert(not exists(select 1 from public.order_pricing_snapshots where customer_order_id=order_value),'pre-C3 legacy fixture required');
  perform pg_temp.c3_assert(exists(select 1 from public.delivery_tasks where id=current_setting('c3.legacy_task')::uuid and customer_order_id=order_value and status='pending_stores'),'legacy pending task required');
  perform pg_temp.c3_assert(exists(select 1 from public.store_orders where customer_order_id=order_value),'legacy children required');
  for child in select id,status from public.store_orders where customer_order_id=order_value order by id loop
    perform pg_temp.c3_assert(child.status in ('awaiting_review','preparing'),'legacy fixture before readiness required');
    if child.status='awaiting_review' then perform public.update_store_order_status(child.id,'preparing'); end if;
    perform public.update_store_order_status(child.id,'ready_for_pickup');
  end loop;
  perform pg_temp.c3_assert((select count(*)=1 from public.delivery_tasks where customer_order_id=order_value),'legacy task not duplicated');
  perform pg_temp.c3_assert(exists(select 1 from public.delivery_tasks where id=current_setting('c3.legacy_task')::uuid and status='available'),'same legacy task released');
  perform pg_temp.c3_assert(not exists(select 1 from public.order_pricing_snapshots where customer_order_id=order_value),'no legacy backfill');
end $$;
do $$ begin execute format('grant usage on schema %I to authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end $$;
-- Actual PostgreSQL role/claim simulation; NOT a real signed JWT/network test.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('c3.customer'),true);
select pg_temp.c3_assert((select count(*)=1 from public.order_pricing_current where customer_order_id=current_setting('c3.order')::uuid),'customer own pricing visible');
select pg_temp.c3_reject('select public.save_c3_delivery_zone(null,''forged'',1,0,true,null)','42501');
select pg_temp.c3_reject('select finance_private.c3_dispatch(gen_random_uuid())','42501');
select pg_temp.c3_reject(format('update public.order_pricing_current set total=0 where customer_order_id=%L',current_setting('c3.order')),'42501');
select pg_temp.c3_reject(format('select public.create_order_from_cart(''forged'',''00000'',''address'',%L,'''')',current_setting('c3.zone')),'42501');
select set_config('request.jwt.claim.sub',current_setting('c3.merchant'),true);
select pg_temp.c3_assert((select count(*)=0 from public.order_pricing_current),'merchant cannot read parent totals');
select pg_temp.c3_reject(format('select public.update_store_order_status(%L,''preparing'')',current_setting('c3.foreign_child')),'42501');
select pg_temp.c3_assert((select count(*)=0 from public.store_order_totals where store_order_id=current_setting('c3.foreign_child')::uuid),'merchant cannot read foreign child totals');
select pg_temp.c3_assert(not exists(select 1 from jsonb_each(public.get_c3_order_context(array[current_setting('c3.order')::uuid])) x where x.value->'pricing'<>'null'::jsonb),'merchant RPC cannot expose parent pricing');
select set_config('request.jwt.claim.sub',current_setting('c3.admin'),true);
select pg_temp.c3_assert((select count(*)>=3 from public.order_pricing_current),'admin pricing read');
reset role;
set constraints all immediate;
rollback;
\echo 'PASS C3 transaction tests (rows rolled back; sequence gaps remain)'
