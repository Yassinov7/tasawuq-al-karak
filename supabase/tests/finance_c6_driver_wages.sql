-- C6 MUTATING rollback suite. Pinned LOCAL full schema through C6 only.
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
create function pg_temp.c6_fail() returns trigger language plpgsql as $$
begin
 if current_setting('c6.fail',true)='yes' and new.side='credit' and exists(select 1 from public.financial_accounts where id=new.account_id and definition_code='driver_earnings_payable') then raise exception 'injected wage failure';end if;
 if current_setting('c6.fail_pay',true)='yes' and new.side='credit' and exists(select 1 from public.financial_accounts where id=new.account_id and definition_code='treasury_cash') then raise exception 'injected payout failure';end if;
 return new;
end $$;
create trigger c6_test_failure before insert on public.journal_lines for each row execute function pg_temp.c6_fail();
create function pg_temp.c6_deferred_fail() returns trigger language plpgsql as $$
begin if current_setting('c6.fail_deferred',true)='yes' then raise exception 'injected deferred wage failure';end if;return null;end $$;
create constraint trigger c6_test_deferred after insert on public.driver_wage_entitlements deferrable initially deferred for each row execute function pg_temp.c6_deferred_fail();
create constraint trigger c6_test_payment_deferred after insert on public.driver_wage_payments deferrable initially deferred for each row execute function pg_temp.c6_deferred_fail();

do $$
declare driver_value uuid:=current_setting('c4z.driver')::uuid;admin_value uuid:=current_setting('c4z.admin')::uuid;
 old_task uuid;a uuid;b uuid;c uuid;z uuid;failed_task uuid;key_value uuid:=gen_random_uuid();policy_value uuid;r jsonb;pos jsonb;
 cash_before numeric;treasury_before numeric;journals_before bigint;receipt_value uuid;rejected boolean;
 test_op public.financial_operations%rowtype;test_event uuid;source_ref uuid;test_account uuid;treasury_account uuid;
begin
 perform pg_temp.c4z_assert((finance_private.c5_position(driver_value)->>'remaining')::numeric=0,'C5 settled baseline; never mix old custody into new wage tests');
 perform pg_temp.c4z_assert((select count(*)=0 from public.driver_wage_entitlements),'fresh C6 entitlement fixture');
 perform pg_temp.c4z_assert((select percentage=70 from public.driver_wage_policies order by version desc limit 1),'default 70');
 perform pg_temp.c4z_assert((select not accept_tasks and not payout_enabled from finance_private.c6_control),'default off');
 update finance_private.c5_rollout set accept_requests=true where singleton;
 insert into finance_private.c5_cash_receivers(user_id,enabled) values(admin_value,true) on conflict(user_id) do update set enabled=true;
 perform set_config('c6.fee','0',true);
 old_task:=pg_temp.c4z_order(true);perform pg_temp.c6_finish(old_task);
 perform pg_temp.c4z_assert(not exists(select 1 from public.delivery_wage_snapshots where task_id=old_task),'no retroactive snapshot');
 perform pg_temp.c4z_assert(not exists(select 1 from public.driver_wage_entitlements where task_id=old_task),'old task no invented wage');
 update finance_private.c6_control set accept_tasks=true where singleton;
 perform set_config('c6.fee','100',true);a:=pg_temp.c4z_order(true);
 perform pg_temp.c4z_assert(not exists(select 1 from public.driver_wage_entitlements where task_id=a),'no accrual before delivery');
 perform pg_temp.c4z_assert((select percentage=70 from public.delivery_wage_snapshots where task_id=a),'snapshot at DLV birth');
 -- Snapshot must not be editable, even by accidental privileged UPDATE.
 rejected:=false;begin update public.delivery_wage_snapshots set percentage=50 where task_id=a;exception when sqlstate '55000' then rejected:=true;end;
 perform pg_temp.c4z_assert(rejected,'immutable snapshot');
 perform set_config('request.jwt.claim.sub',admin_value::text,true);
 select id into strict policy_value from public.driver_wage_policies order by version desc limit 1;
 rejected:=false;begin perform public.save_c6_wage_policy(admin_value,gen_random_uuid(),policy_value,0.5,'fixture');exception when insufficient_privilege then rejected:=true;end;
 perform pg_temp.c4z_assert(rejected,'admin role alone no policy privilege');
 insert into finance_private.c6_permissions(user_id,may_edit_policy,may_pay_wages) values(admin_value,true,false);
 r:=public.save_c6_wage_policy(admin_value,key_value,policy_value,0.5,'isolated HALF-UP policy');
 perform pg_temp.c4z_assert(r->>'kind'='policy','policy accepted');
 perform pg_temp.c4z_assert(public.recover_c6_operation(admin_value,key_value)=r,'policy recovery');
 perform pg_temp.c4z_assert((select percentage=70 from public.delivery_wage_snapshots where task_id=a),'policy does not rewrite old snapshot');
 perform set_config('c6.fee','1',true);b:=pg_temp.c4z_order(true);
 perform pg_temp.c4z_assert((select percentage=0.5 from public.delivery_wage_snapshots where task_id=b),'future DLV changed rate');
 perform set_config('request.jwt.claim.sub',admin_value::text,true);
 select id into strict policy_value from public.driver_wage_policies order by version desc limit 1;
 perform public.save_c6_wage_policy(admin_value,gen_random_uuid(),policy_value,0,'zero rate future only');
 c:=pg_temp.c4z_order(true);
 perform set_config('c6.fee','0',true);z:=pg_temp.c4z_order(true);
 -- Admission closing cannot strand a captured wage or change its percentage.
 update finance_private.c6_control set accept_tasks=false where singleton;
 select count(*) into journals_before from public.journal_entries;
 r:=pg_temp.c6_finish(z);set constraints all immediate;
 perform pg_temp.c4z_assert(r->>'kind'='zero_cash_delivery','zero C4 still works');
 perform pg_temp.c4z_assert((select amount=0 and event_id is null from public.driver_wage_entitlements where task_id=z),'zero entitlement no financial event');
 perform pg_temp.c4z_assert((select count(*)=journals_before from public.journal_entries),'zero delivery adds no journal');
 -- Fail wage journal after C4 delivery/cash writes: entire RPC rolls back.
 perform set_config('c6.fail','yes',true);rejected:=false;
 begin perform pg_temp.c6_finish(a);exception when others then if sqlerrm<>'injected wage failure' then raise;end if;rejected:=true;end;
 perform set_config('c6.fail','no',true);
 perform pg_temp.c4z_assert(rejected and not exists(select 1 from public.delivery_collection_results where task_id=a),'wage failure rolls back C4 result');
 perform pg_temp.c4z_assert((select status='picked_up' from public.delivery_tasks where id=a),'wage failure rolls back delivered transition');
 set constraints c6_test_deferred deferred;perform set_config('c6.fail_deferred','yes',true);rejected:=false;
 begin perform pg_temp.c6_finish(a);exception when others then if sqlerrm<>'injected deferred wage failure' then raise;end if;rejected:=true;end;
 perform set_config('c6.fail_deferred','no',true);
 perform pg_temp.c4z_assert(rejected and not exists(select 1 from public.driver_wage_entitlements where task_id=a),'deferred failure rolls back whole delivery');
 key_value:=gen_random_uuid();r:=pg_temp.c6_finish(a,key_value);set constraints all immediate;
 perform pg_temp.c4z_assert((select fee_amount=100 and amount=70 from public.driver_wage_entitlements where task_id=a),'fee after store rejection; not merchandise or original multi-store fee');
 perform pg_temp.c4z_assert((select amount=100 from public.delivery_collection_results where task_id=a),'full custody unchanged by wage');
 perform pg_temp.c4z_assert(pg_temp.c6_finish(a,key_value)=r,'C4 lost response replay');
 perform pg_temp.c6_finish(a);perform pg_temp.c4z_assert((select count(*)=1 from public.driver_wage_entitlements where task_id=a),'different key no double wage');
 perform pg_temp.c6_finish(b);perform pg_temp.c6_finish(c);set constraints all immediate;
 perform pg_temp.c4z_assert((select amount=0.01 from public.driver_wage_entitlements where task_id=b),'HALF-UP 1 x .5 percent = .01');
 perform pg_temp.c4z_assert((select amount=0 and event_id is null from public.driver_wage_entitlements where task_id=c),'positive cash zero rate no wage journal');
 pos:=finance_private.c6_position(driver_value);perform pg_temp.c4z_assert((pos->>'earned')::numeric=70.01 and (pos->>'available')::numeric=0,'earned not available before cash settlement');
 perform pg_temp.c6_handover(60);set constraints all immediate;
 perform pg_temp.c4z_assert(finance_private.c6_cash_remaining(a)=40 and finance_private.c6_cash_remaining(b)=1,'partial FIFO oldest first');
 perform pg_temp.c4z_assert((finance_private.c6_position(driver_value)->>'available')::numeric=0,'receipt existence alone cannot unlock wage');
 r:=pg_temp.c6_handover(40);set constraints all immediate;
 perform pg_temp.c4z_assert(finance_private.c6_cash_remaining(a)=0 and finance_private.c6_cash_remaining(b)=1,'only task A settled');
 perform pg_temp.c4z_assert((finance_private.c6_position(driver_value)->>'available')::numeric=70,'task-level availability despite another task custody');
 receipt_value:=(r->>'attempt_id')::uuid;
 -- Each receipt is fully allocated exactly once; private replay does not add rows.
 perform finance_private.c6_allocate_receipt(receipt_value);
 perform pg_temp.c4z_assert((select sum(amount)=40 from public.driver_cash_receipt_allocations where receipt_id=receipt_value),'allocation replay stays exact');
 perform set_config('request.jwt.claim.sub',admin_value::text,true);
 rejected:=false;begin perform public.pay_c6_driver_wages(driver_value,admin_value,gen_random_uuid(),array[a],70);exception when insufficient_privilege then rejected:=true;end;
 perform pg_temp.c4z_assert(rejected,'separate payout permission required');
 update finance_private.c6_permissions set may_pay_wages=true where user_id=admin_value;
 r:=public.pay_c6_driver_wages(driver_value,admin_value,gen_random_uuid(),array[a],70);
 perform pg_temp.c4z_assert(r->>'code'='payout_disabled','payout default off');
 update finance_private.c6_control set payout_enabled=true where singleton;
 r:=public.pay_c6_driver_wages(driver_value,admin_value,gen_random_uuid(),array[b],0.01);
 perform pg_temp.c4z_assert(r->>'code'='wage_not_available','unsettled B cannot be paid');
 -- Isolated synthetic treasury expense is rolled back after proving the balance gate.
 begin
  test_op:=finance_private.begin_operation('c6_test_expense',gen_random_uuid(),jsonb_build_object('isolated',true));
  select id into strict source_ref from public.financial_document_references where kind='DLV' and document_id=b;
  test_event:=finance_private.record_financial_event(source_ref,'isolated_treasury_expense',test_op.id);
  test_account:=finance_private.c4_account('driver_earnings_expense');treasury_account:=finance_private.c4_account('treasury_cash');
  perform finance_private.post_journal(test_event,jsonb_build_array(jsonb_build_object('account_id',test_account,'side','debit','amount',finance_private.c6_treasury_balance()),jsonb_build_object('account_id',treasury_account,'side','credit','amount',finance_private.c6_treasury_balance())),'isolated balance exhaustion');
  perform finance_private.complete_operation(test_op.id,jsonb_build_object('state','completed'));
  set constraints all immediate;
  r:=public.pay_c6_driver_wages(driver_value,admin_value,gen_random_uuid(),array[a],70);
  perform pg_temp.c4z_assert(r->>'code'='insufficient_treasury','C2 treasury gate independently checked');
  raise exception 'rollback treasury fixture' using errcode='P0002';
 exception when no_data_found then if sqlerrm<>'rollback treasury fixture' then raise;end if;end;
 cash_before:=(finance_private.c5_position(driver_value)->>'remaining')::numeric;treasury_before:=finance_private.c6_treasury_balance();
 key_value:=gen_random_uuid();perform set_config('c6.fail_pay','yes',true);rejected:=false;
 begin perform public.pay_c6_driver_wages(driver_value,admin_value,key_value,array[a],70);exception when others then if sqlerrm<>'injected payout failure' then raise;end if;rejected:=true;end;
 perform set_config('c6.fail_pay','no',true);
 perform pg_temp.c4z_assert(rejected and not exists(select 1 from public.financial_operations where actor_id=admin_value and attempt_key=key_value),'payout journal failure rolls back operation/result');
 perform pg_temp.c4z_assert(not exists(select 1 from public.driver_wage_payment_items where task_id=a),'failed payout no item/PAY effect');
 set constraints c6_test_payment_deferred deferred;perform set_config('c6.fail_deferred','yes',true);rejected:=false;
 begin perform public.pay_c6_driver_wages(driver_value,admin_value,key_value,array[a],70);exception when others then if sqlerrm<>'injected deferred wage failure' then raise;end if;rejected:=true;end;
 perform set_config('c6.fail_deferred','no',true);
 perform pg_temp.c4z_assert(rejected and not exists(select 1 from public.financial_operations where actor_id=admin_value and attempt_key=key_value),'deferred payout failure rolls back all');
 r:=public.pay_c6_driver_wages(driver_value,admin_value,key_value,array[a],70);set constraints all immediate;
 perform pg_temp.c4z_assert(r->>'kind'='payment' and r->>'reference' ~ '^PAY-[0-9]{6,}$','full wage posted with PAY');
 perform pg_temp.c4z_assert(public.recover_c6_operation(admin_value,key_value)=r,'lost payout response recovery');
 perform pg_temp.c4z_assert(public.pay_c6_driver_wages(driver_value,admin_value,key_value,array[a],70)=r,'same-key replay');
 r:=public.pay_c6_driver_wages(driver_value,admin_value,gen_random_uuid(),array[a],70);
 perform pg_temp.c4z_assert(r->>'code'='wage_not_available','different key cannot double payout');
 perform pg_temp.c4z_assert((finance_private.c5_position(driver_value)->>'remaining')::numeric=cash_before,'payout never reduces driver custody');
 perform pg_temp.c4z_assert(finance_private.c6_treasury_balance()=treasury_before-70,'treasury credited exact wage');
 perform pg_temp.c6_handover(2);set constraints all immediate;
 perform pg_temp.c4z_assert((finance_private.c6_position(driver_value)->>'available')::numeric=0.01,'later receipt closes B and C');
 perform pg_temp.c4z_assert((select bool_and(allocated=counted_amount) from (select h.counted_amount,(select sum(amount) from public.driver_cash_receipt_allocations a where a.receipt_id=h.id) allocated from public.driver_cash_handover_attempts h where h.outcome='confirmed') t),'every real RCT allocated exactly once');
end $$;
-- Actual role switching exercises SQL grants and auth.uid policies, not signed network JWT.
select set_config('request.jwt.claim.sub',:'other_driver',true);
set local role authenticated;
select pg_temp.c4z_assert((select count(*)=0 from public.driver_wage_entitlements),'other driver RLS no entitlements');
select pg_temp.c4z_assert((select count(*)=0 from public.driver_cash_receipt_allocations),'other driver RLS no allocations');
select pg_temp.c4z_assert(not has_function_privilege('authenticated','finance_private.c6_allocate_receipt(uuid,text)','EXECUTE'),'no private execution');
reset role;
select set_config('request.jwt.claim.sub',:'driver_user',true);
set local role authenticated;
select pg_temp.c4z_assert((select count(*)>=4 from public.driver_wage_entitlements),'own driver rows visible');
reset role;
set constraints all immediate;
rollback;
\echo C6 rollback suite complete; no claim of actual COMMIT/concurrency or signed JWT coverage here.
