-- C7 MUTATING rollback suite. Pinned LOCAL full schema through C7 only.
-- Synthetic approved fixtures, no existing C6 entitlements, C5 custody settled.
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
  zone_value:=public.save_c3_delivery_zone(null,'C6 wage fee fixture',current_setting('c6.fee')::numeric,0,true,null);
  update finance_private.c4_rollout set accept_new_orders=true where singleton;
  perform set_config('request.jwt.claim.sub',current_setting('c4z.customer'),true);
  insert into public.customer_carts(customer_id) values(auth.uid()) on conflict(customer_id) do nothing;
  select id into strict cart_value from public.customer_carts where customer_id=auth.uid();
  delete from public.customer_cart_items where cart_id=cart_value;
  delete from public.customer_cart_offer_selections where cart_id=cart_value;
  delete from public.customer_cart_store_notes where cart_id=cart_value;
  insert into public.customer_cart_items(cart_id,product_id,quantity) values(cart_value,paid_product.id,paid_product.minimum_quantity);
  if current_setting('c7.single',true) is distinct from 'yes' then
   if current_setting('c7.regular_other',true)='yes' then insert into public.customer_cart_items(cart_id,product_id,quantity) values(cart_value,free_product.id,free_product.minimum_quantity);
   else perform public.add_customer_cart_offer(offer_value);end if;
  end if;
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
end $$;-- Contract boundaries, real production creation/rejection/dispatch/pickup RPCs above.
create function pg_temp.c6_finish(task_value uuid,key_value uuid default gen_random_uuid()) returns jsonb language plpgsql as $$
declare v bigint;
begin
 perform set_config('request.jwt.claim.sub',current_setting('c4z.driver'),true);
 select p.version into strict v from public.delivery_tasks d join public.order_pricing_current p on p.customer_order_id=d.customer_order_id where d.id=task_value;
 return public.complete_delivery_and_collect_cash(task_value,auth.uid(),key_value,v);
end $$;
create function pg_temp.c6_handover(amount_value numeric) returns jsonb language plpgsql as $$
declare r jsonb;
begin
 perform set_config('request.jwt.claim.sub',current_setting('c4z.driver'),true);
 r:=public.request_c5_cash_handover(auth.uid(),gen_random_uuid(),amount_value);
 perform pg_temp.c4z_assert(r->>'kind'='request','C5 reservation succeeded');
 perform set_config('request.jwt.claim.sub',current_setting('c4z.admin'),true);
 return public.confirm_c5_cash_handover((r->>'request_id')::uuid,current_setting('c4z.driver')::uuid,auth.uid(),gen_random_uuid(),amount_value);
end $$;
create function pg_temp.c7_fault() returns trigger language plpgsql as $$ begin
 if current_setting('c7.fail_line',true)='yes' and new.side='credit' and exists(select 1 from public.financial_accounts where id=new.account_id and definition_code='treasury_cash') then raise exception 'injected C7 journal failure';end if;return new;
end $$;
create trigger c7_test_line before insert on public.journal_lines for each row execute function pg_temp.c7_fault();
create function pg_temp.c7_deferred_fault() returns trigger language plpgsql as $$ begin if current_setting('c7.fail_deferred',true)='yes' then raise exception 'injected C7 deferred failure';end if;return null;end $$;
create constraint trigger c7_test_deferred after insert on public.c7_merchant_settlement_payments deferrable initially deferred for each row execute function pg_temp.c7_deferred_fault();

do $$
declare admin_value uuid:=current_setting('c4z.admin')::uuid;driver_value uuid:=current_setting('c4z.driver')::uuid;
 t1 uuid;t2 uuid;tm uuid;tr uuid;tz uuid;s1 uuid;s2 uuid;store_value uuid;other_store uuid;net_value numeric;net2 numeric;r jsonb;set_result jsonb;payment_result jsonb;key_value uuid:=gen_random_uuid();settlement_value uuid;
 before_journals bigint;before_events bigint;before_payments bigint;cash_before numeric;treasury_before numeric;rejected boolean;
begin
 perform pg_temp.c4z_assert((select not accept_settlements and not payout_enabled from finance_private.c7_control where singleton),'C7 default off');
 perform set_config('c6.fee','100',true);perform set_config('c7.single','yes',true);perform set_config('c7.regular_other','no',true);
 t1:=pg_temp.c4z_order(false);
 perform pg_temp.c4z_assert(not exists(select 1 from public.merchant_delivery_positions where task_id=t1),'no C7 entitlement before delivery');
 select id,store_id into strict s1,store_value from public.store_orders where customer_order_id=(select customer_order_id from public.delivery_tasks where id=t1);
 perform set_config('request.jwt.claim.sub',admin_value::text,true);
 rejected:=false;begin perform public.prepare_c7_settlement(store_value,admin_value,gen_random_uuid(),array[s1],1);exception when insufficient_privilege then rejected:=true;end;
 perform pg_temp.c4z_assert(rejected,'role admin alone no prepare permission');
 insert into finance_private.c7_permissions(user_id,may_prepare,may_pay) values(admin_value,true,false);
 update finance_private.c7_control set accept_settlements=true where singleton;
 r:=public.prepare_c7_settlement(store_value,admin_value,gen_random_uuid(),array[s1],1);
 perform pg_temp.c4z_assert(r->>'code'='sub_not_available','no settlement before delivered C4');
 perform pg_temp.c6_finish(t1);set constraints all immediate;
 select net into strict net_value from public.merchant_delivery_positions where store_order_id=s1;
 perform pg_temp.c4z_assert(net_value>0,'fixture: positive net and rate below 100 required');
 perform pg_temp.c4z_assert((select commission=round(gross*commission_rate/100,2) and net=gross-commission from public.merchant_delivery_positions where store_order_id=s1),'exact decimal source and frozen rate');
 select count(*) into before_journals from public.journal_entries;select count(*) into before_events from public.financial_events;
 perform finance_private.c7_capture(t1);perform finance_private.c7_capture(t1);
 perform pg_temp.c4z_assert((select count(*)=1 from public.merchant_delivery_positions where store_order_id=s1),'capture natural-key idempotency');
 perform pg_temp.c4z_assert((select count(*)=before_journals from public.journal_entries) and (select count(*)=before_events from public.financial_events),'capture posts NO C4 entitlement again');
 rejected:=false;begin update public.merchant_delivery_positions set commission_rate=99 where store_order_id=s1;exception when sqlstate '55000' then rejected:=true;end;
 perform pg_temp.c4z_assert(rejected,'SUB snapshot immutable');
 t2:=pg_temp.c4z_order(false);perform pg_temp.c6_finish(t2);set constraints all immediate;
 select store_order_id,net into strict s2,net2 from public.merchant_delivery_positions where task_id=t2;
 -- Multiple stores with DIFFERENT preconfigured commission snapshots. Missing fixture is a FAILURE, not a skip.
 perform set_config('c7.single','no',true);perform set_config('c7.regular_other','yes',true);
 tm:=pg_temp.c4z_order(false);perform pg_temp.c6_finish(tm);set constraints all immediate;
 perform pg_temp.c4z_assert((select count(*)=2 and count(distinct commission_rate)=2 from public.merchant_delivery_positions where task_id=tm),'fixture: two stores with different real subscription commission rates');
 tr:=pg_temp.c4z_order(true);perform pg_temp.c6_finish(tr);set constraints all immediate;
 perform pg_temp.c4z_assert((select count(*)=1 from public.merchant_delivery_positions where task_id=tr),'rejected store excluded');
 perform pg_temp.c4z_assert(not exists(select 1 from public.merchant_delivery_positions x join public.store_orders so on so.id=x.store_order_id where x.task_id=tr and so.status in ('rejected','cancelled')),'no rejected commission or payable');
 perform set_config('c7.regular_other','no',true);perform set_config('c6.fee','0',true);
 tz:=pg_temp.c4z_order(true);select count(*) into before_journals from public.journal_entries;perform pg_temp.c6_finish(tz);set constraints all immediate;
 perform pg_temp.c4z_assert((select count(*)=before_journals from public.journal_entries),'zero delivery no financial journal');
 perform pg_temp.c4z_assert((select bool_and(gross=0 and commission=0 and net=0) from public.merchant_delivery_positions where task_id=tz),'zero metadata not fake financial entitlement');
 perform set_config('request.jwt.claim.sub',admin_value::text,true);
 select count(*) into before_journals from public.journal_entries;
 key_value:=gen_random_uuid();set_result:=public.prepare_c7_settlement(store_value,admin_value,key_value,array[s1,s2],net_value+net2);set constraints all immediate;
 settlement_value:=(set_result->>'settlement_id')::uuid;
 perform pg_temp.c4z_assert(set_result->>'kind'='settlement' and set_result->>'reference' ~ '^SET-[0-9]{6,}$','SET unique reference');
 perform pg_temp.c4z_assert((select count(*)=2 and sum(amount)=net_value+net2 from public.merchant_settlement_document_items where settlement_id=settlement_value),'two full SUB grouped');
 perform pg_temp.c4z_assert((select count(*)=before_journals from public.journal_entries),'prepare does not move money');
 perform pg_temp.c4z_assert(public.recover_c7_operation(admin_value,key_value)=set_result,'lost preparation response recovery');
 perform pg_temp.c4z_assert(public.prepare_c7_settlement(store_value,admin_value,key_value,array[s2,s1],net_value+net2)=set_result,'canonical order and same key replay');
 r:=public.prepare_c7_settlement(store_value,admin_value,gen_random_uuid(),array[s1],net_value);perform pg_temp.c4z_assert(r->>'code'='sub_not_available','SUB cannot join second SET');
 rejected:=false;begin perform public.pay_c7_settlement(store_value,settlement_value,admin_value,gen_random_uuid(),net_value+net2);exception when insufficient_privilege then rejected:=true;end;
 perform pg_temp.c4z_assert(rejected,'separate PAY authorization');
 update finance_private.c7_permissions set may_pay=true where user_id=admin_value;
 r:=public.pay_c7_settlement(store_value,settlement_value,admin_value,gen_random_uuid(),net_value+net2);perform pg_temp.c4z_assert(r->>'code'='payout_disabled','PAY default off');
 update finance_private.c7_control set payout_enabled=true where singleton;
 -- Transfer all actual C4 cash to treasury via real C5, not a fabricated treasury balance.
 update finance_private.c5_rollout set accept_requests=true where singleton;
 insert into finance_private.c5_cash_receivers(user_id,enabled) values(admin_value,true) on conflict(user_id) do update set enabled=true;
 cash_before:=(finance_private.c5_position(driver_value)->>'available')::numeric;
 perform pg_temp.c4z_assert(cash_before>net_value+net2,'synthetic C4/C5 funding fixture');
 perform pg_temp.c6_handover(cash_before);set constraints all immediate;
 perform set_config('request.jwt.claim.sub',admin_value::text,true);
 treasury_before:=finance_private.c6_treasury_balance();cash_before:=(finance_private.c5_position(driver_value)->>'remaining')::numeric;
 key_value:=gen_random_uuid();perform set_config('c7.fail_line','yes',true);rejected:=false;
 begin perform public.pay_c7_settlement(store_value,settlement_value,admin_value,key_value,net_value+net2);exception when others then if sqlerrm<>'injected C7 journal failure' then raise;end if;rejected:=true;end;
 perform set_config('c7.fail_line','no',true);
 perform pg_temp.c4z_assert(rejected and not exists(select 1 from public.financial_operations where actor_id=admin_value and attempt_key=key_value),'journal failure rolls back operation/result');
 perform pg_temp.c4z_assert(not exists(select 1 from public.c7_merchant_settlement_payments where settlement_id=settlement_value),'failed payout leaves SET pending');
 set constraints c7_test_deferred deferred;perform set_config('c7.fail_deferred','yes',true);rejected:=false;
 begin perform public.pay_c7_settlement(store_value,settlement_value,admin_value,key_value,net_value+net2);exception when others then if sqlerrm<>'injected C7 deferred failure' then raise;end if;rejected:=true;end;
 perform set_config('c7.fail_deferred','no',true);
 perform pg_temp.c4z_assert(rejected and not exists(select 1 from public.financial_operations where actor_id=admin_value and attempt_key=key_value),'deferred failure rolls back all');
 payment_result:=public.pay_c7_settlement(store_value,settlement_value,admin_value,key_value,net_value+net2);set constraints all immediate;
 perform pg_temp.c4z_assert(payment_result->>'kind'='payment' and payment_result->>'reference' ~ '^PAY-[0-9]{6,}$','confirmed unique PAY');
 perform pg_temp.c4z_assert(public.recover_c7_operation(admin_value,key_value)=payment_result,'lost payment response recovery');
 perform pg_temp.c4z_assert(public.pay_c7_settlement(store_value,settlement_value,admin_value,key_value,net_value+net2)=payment_result,'same key no duplicate');
 perform pg_temp.c4z_assert(public.pay_c7_settlement(store_value,settlement_value,admin_value,gen_random_uuid(),net_value+net2)=payment_result,'different key no duplicate');
 perform pg_temp.c4z_assert((select count(*)=1 from public.c7_merchant_settlement_payments where settlement_id=settlement_value),'one economic payment');
 perform pg_temp.c4z_assert(finance_private.c6_treasury_balance()=treasury_before-net_value-net2,'treasury exact debit/credit');
 perform pg_temp.c4z_assert((finance_private.c5_position(driver_value)->>'remaining')::numeric=cash_before,'merchant payment never changes custody');
 perform pg_temp.c4z_assert(not exists(select 1 from public.customer_order_cash_obligations o join public.delivery_tasks d on d.customer_order_id=o.customer_order_id where d.id in (t1,t2,tm,tr,tz)),'no legacy duplicate economic writer');
end $$;
-- SQL role emulation is not signed JWT/PostgREST proof.
select set_config('request.jwt.claim.sub',:'customer_user',true);
set local role authenticated;
select pg_temp.c4z_assert((select count(*)=0 from public.merchant_delivery_positions),'customer cannot read merchant positions');
select pg_temp.c4z_assert((select count(*)=0 from public.c7_merchant_settlement_payments),'customer cannot read merchant PAY');
reset role;
select set_config('request.jwt.claim.sub',:'driver_user',true);
set local role authenticated;
select pg_temp.c4z_assert((select count(*)=0 from public.merchant_settlement_documents),'driver cannot read SET');
reset role;
select set_config('c7.own_store',(select store_id::text from public.products where id=:'product_a'),true);
select set_config('c7.foreign_store',(select store_id::text from public.products where id=:'product_b'),true);
select set_config('c7.owner',(select m.owner_user_id::text from public.stores s join public.merchants m on m.id=s.merchant_id where s.id=current_setting('c7.own_store')::uuid),true);
select pg_temp.c4z_assert(current_setting('c7.owner')<>(select m.owner_user_id::text from public.stores s join public.merchants m on m.id=s.merchant_id where s.id=current_setting('c7.foreign_store')::uuid),'distinct fixture owners required for isolation');
select set_config('request.jwt.claim.sub',current_setting('c7.owner'),true);
set local role authenticated;
select pg_temp.c4z_assert((select count(*)>=2 from public.merchant_delivery_positions where store_id=current_setting('c7.own_store')::uuid),'merchant own rows actually readable');
select pg_temp.c4z_assert(not exists(select 1 from public.merchant_delivery_positions where store_id=current_setting('c7.foreign_store')::uuid),'merchant cannot read foreign store');
reset role;
set constraints all immediate;
rollback;
\echo C7 rollback assertions complete; separate COMMIT/concurrency and signed JWT are NOT proven by this file.
