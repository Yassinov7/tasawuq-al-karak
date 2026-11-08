-- MUTATING / DISPOSABLE ONLY. REAL production RPCs, no rewritten pricing snapshots or balances.
-- c10.fixture is supplied by the pinned loopback harness. Rollback does NOT restore sequences.
begin;
do $$ begin
 if current_database()!~'_c2_test$' or to_regclass('c2_test_guard.environment') is null or not coalesce(host(inet_server_addr()) in ('127.0.0.1','::1'),false) then raise exception 'isolated loopback required';end if;
 if not exists(select 1 from c2_test_guard.environment where singleton and token=(current_setting('c10.fixture')::jsonb->>'token')::uuid) then raise exception 'marker mismatch';end if;
end $$;
create function pg_temp.c10_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'C10 ASSERT: %',message;end if;end $$;
create function pg_temp.c10_order(free_other boolean default false,fee numeric default 100) returns uuid language plpgsql as $$
declare f jsonb:=current_setting('c10.fixture')::jsonb;p public.products%rowtype;b public.products%rowtype;zone uuid;cart_value uuid;offer_id uuid;owner_id uuid;q jsonb;r jsonb;
begin
 select * into strict p from public.products where id=(f->>'product')::uuid;select * into strict b from public.products where id=(f->>'otherProduct')::uuid;
 perform pg_temp.c10_assert(p.store_id<>b.store_id,'two distinct actual stores');
 if free_other then
  select m.owner_user_id into strict owner_id from public.stores s join public.merchants m on m.id=s.merchant_id where s.id=b.store_id;perform set_config('request.jwt.claim.sub',owner_id::text,true);
  offer_id:=public.save_store_offer(null,'C10 isolated free offer','synthetic','discount','percentage',100,null,null,true,jsonb_build_array(jsonb_build_object('product_id',b.id,'item_role','discounted','quantity',b.minimum_quantity)));
 end if;
 perform set_config('request.jwt.claim.sub',f->>'admin',true);zone:=public.save_c3_delivery_zone(null,'C10 synthetic zone',fee,0,true,null);
 perform set_config('request.jwt.claim.sub',f->>'customer',true);
 insert into public.customer_carts(customer_id) values(auth.uid()) on conflict(customer_id) do nothing;select id into strict cart_value from public.customer_carts where customer_id=auth.uid();
 delete from public.customer_cart_items where cart_id=cart_value;delete from public.customer_cart_offer_selections where cart_id=cart_value;delete from public.customer_cart_store_notes where cart_id=cart_value;
 insert into public.customer_cart_items(cart_id,product_id,quantity) values(cart_value,p.id,p.minimum_quantity);
 if free_other then perform public.add_customer_cart_offer(offer_id);else insert into public.customer_cart_items(cart_id,product_id,quantity) values(cart_value,b.id,b.minimum_quantity);end if;
 q:=public.quote_c3_cart(zone,auth.uid());r:=public.create_c3_order_from_cart('C10 recipient','00000','synthetic address',zone,'',gen_random_uuid(),(q->>'total')::numeric,auth.uid(),q->>'cart_signature');
 perform pg_temp.c10_assert(r->>'state'='completed','actual C3 checkout');set constraints all immediate;return (r->>'order_id')::uuid;
end $$;
create function pg_temp.c10_pick(order_value uuid,reject_store uuid default null) returns uuid language plpgsql as $$
declare f jsonb:=current_setting('c10.fixture')::jsonb;s record;owner_id uuid;task_value uuid;remaining integer;
begin
 select count(*) into remaining from public.store_orders where customer_order_id=order_value;
 for s in select * from public.store_orders where customer_order_id=order_value order by id loop
  select m.owner_user_id into strict owner_id from public.stores st join public.merchants m on m.id=st.merchant_id where st.id=s.store_id;perform set_config('request.jwt.claim.sub',owner_id::text,true);
  if s.store_id=reject_store then perform public.update_store_order_status(s.id,'rejected','isolated rejected store');
  else perform public.update_store_order_status(s.id,'preparing');perform public.update_store_order_status(s.id,'ready_for_pickup');end if;
  remaining:=remaining-1;
  if remaining>0 then perform pg_temp.c10_assert(not exists(select 1 from public.delivery_tasks where customer_order_id=order_value),'no premature DLV');end if;
 end loop;
 select id into strict task_value from public.delivery_tasks where customer_order_id=order_value;perform pg_temp.c10_assert((select count(*)=1 from public.delivery_tasks where customer_order_id=order_value),'single DLV');
 perform set_config('request.jwt.claim.sub',f->>'driver',true);perform public.accept_delivery_task(order_value);
 for s in select id from public.store_orders where customer_order_id=order_value and status='ready_for_pickup' order by id loop perform public.confirm_c4_store_pickup(task_value,s.id,auth.uid());end loop;return task_value;
end $$;
create function pg_temp.c10_delivery_fault() returns trigger language plpgsql as $$ begin if current_setting('c10.fail',true)='yes' then
 if not exists(select 1 from public.merchant_delivery_positions where task_id=new.task_id) then raise exception 'C7 capture did not run before injected failure';end if;
 raise exception 'C10 injected deferred failure';end if;return null;end $$;
create constraint trigger zz_c10_fault after insert on public.delivery_collection_results deferrable initially deferred for each row execute function pg_temp.c10_delivery_fault();
do $$
declare f jsonb:=current_setting('c10.fixture')::jsonb;a uuid:=(f->>'admin')::uuid;b uuid:=(f->>'approver')::uuid;d uuid:=(f->>'driver')::uuid;u uuid:=(f->>'owner')::uuid;m uuid:=(f->>'merchant')::uuid;
 r jsonb;q jsonb;invoice_value uuid;period_end timestamptz;order_value uuid;first_order uuid;task_value uuid;price public.order_pricing_current%rowtype;wage numeric;receipt jsonb;child record;
 baseline numeric;before_journals bigint;key_value uuid:=gen_random_uuid();cash_key uuid:=gen_random_uuid();paid jsonb;set_value jsonb;request_id uuid;count_id uuid;zone_value uuid;cart_value uuid;
 op public.financial_operations%rowtype;ref_id uuid;event_id uuid;initial_legacy bigint;wrong boolean;old_order uuid;
begin
 perform pg_temp.c10_assert(not exists(select 1 from finance_private.c10_reconciliation_issues),'clean initial operational/ledger state');
 perform pg_temp.c10_assert((finance_private.c5_position(d)->>'remaining')::numeric=0 and (finance_private.c5_position(d)->>'reserved')::numeric=0,'clean fixture driver custody');
 select count(*) into initial_legacy from public.customer_order_cash_obligations;
 update finance_private.c4_rollout set accept_new_orders=true;update finance_private.c5_rollout set accept_requests=true;update finance_private.c6_control set accept_tasks=true,payout_enabled=true;update finance_private.c7_control set accept_settlements=true,payout_enabled=true;
 update finance_private.c8_control set accept_operations=true,enforce_gate=true;update finance_private.c9_control set enabled=true;
 insert into finance_private.c5_cash_receivers(user_id,enabled) values(a,true) on conflict(user_id) do update set enabled=true;
 insert into finance_private.c6_permissions(user_id,may_pay_wages) values(a,true) on conflict(user_id) do update set may_pay_wages=true;
 insert into finance_private.c7_permissions(user_id,may_prepare,may_pay) values(a,true,true) on conflict(user_id) do update set may_prepare=true,may_pay=true;
 insert into finance_private.c8_permissions(user_id,plans,issue,collect,suspend,resume) values(a,true,true,true,true,true) on conflict(user_id) do update set plans=true,issue=true,collect=true,suspend=true,resume=true;
 insert into finance_private.c9_permissions(user_id,expense,count_cash,adjust_request,expense_approve,pay,adjust) values(a,true,true,true,false,false,false),(b,false,false,false,true,true,true)
 on conflict(user_id) do update set expense=excluded.expense,count_cash=excluded.count_cash,adjust_request=excluded.adjust_request,expense_approve=excluded.expense_approve,pay=excluded.pay,adjust=excluded.adjust;
 insert into finance_private.c10_permissions(user_id,may_reconcile) values(a,true) on conflict(user_id) do update set may_reconcile=true;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.save_subscription_plan_version(a,gen_random_uuid(),(f->>'plan')::uuid,'C10 paid plan','synthetic',100.50,1,true,null,'isolated approved plan');
 r:=public.enroll_subscription_account(m,(f->>'plan')::uuid,a,gen_random_uuid(),'fresh synthetic cohort, no legacy conversion');perform pg_temp.c10_assert(r->>'kind'='enrollment','fresh enrollment');
 baseline:=finance_private.c6_treasury_balance();r:=public.issue_subscription_invoice(m,a,gen_random_uuid(),'real SIN');invoice_value:=(r->>'id')::uuid;
 perform pg_temp.c10_assert(r->>'kind'='invoice' and finance_private.c6_treasury_balance()=baseline,'SIN not cash');
 r:=public.collect_subscription_invoice(invoice_value,m,a,key_value,100.50,'actual isolated subscription cash');
 perform pg_temp.c10_assert(r->>'kind'='receipt' and finance_private.c6_treasury_balance()=baseline+100.50,'RCT cash + paid period atomic');
 select expires_at into strict period_end from public.merchant_subscriptions where id=(select cr.period_id from public.subscription_cash_receipts cr where cr.invoice_id=invoice_value);
 perform pg_temp.c10_assert(finance_private.c8_state(m,period_end+interval '167 hours')->>'state'='grace_period','168-hour contract grace');
 perform pg_temp.c10_assert(finance_private.c8_state(m,period_end+interval '168 hours')->>'state'='expired','exact grace endpoint');
 perform set_config('request.jwt.claim.sub',u::text,true);perform public.change_subscription_account(m,u,gen_random_uuid(),'renewal','automatic','no automatic debit');
 order_value:=pg_temp.c10_order(false,100);first_order:=order_value;perform pg_temp.c10_assert(finance_private.c4_is_order(order_value),'fixed new writer');
 task_value:=pg_temp.c10_pick(order_value);select * into strict price from public.order_pricing_current where customer_order_id=order_value;
 -- Suspend NEW admission while preserving a previously accepted/picked-up order.
 perform set_config('request.jwt.claim.sub',a::text,true);perform public.change_subscription_account(m,a,gen_random_uuid(),'suspend','suspended','new orders only');
 perform pg_temp.c10_assert(not public.store_accepts_new_orders((f->>'store')::uuid),'suspended admission');
 perform set_config('request.jwt.claim.sub',d::text,true);paid:=public.complete_delivery_and_collect_cash(task_value,d,cash_key,price.version);set constraints all immediate;
 perform pg_temp.c10_assert(paid->>'kind'='cash_delivery' and (paid->>'amount')::numeric=price.total,'previous order continues at current COD');
 perform pg_temp.c10_assert((finance_private.c5_position(d)->>'collected')::numeric=price.total,'FULL COD in custody, no wage deduction');
 perform pg_temp.c10_assert(public.recover_delivery_collection(cash_key,d)->>'task_id'=task_value::text,'lost response recovery');
 select amount into strict wage from public.driver_wage_entitlements where task_id=task_value;perform pg_temp.c10_assert(wage>0,'real nonzero wage fixture');
 perform set_config('request.jwt.claim.sub',a::text,true);r:=public.pay_c6_driver_wages(d,a,gen_random_uuid(),array[task_value],wage);perform pg_temp.c10_assert(r->>'code'='wage_not_available','not payable before custody settled');
 -- Partial RCT followed by the remaining actual COD; allocations use the production FIFO.
 perform set_config('request.jwt.claim.sub',d::text,true);receipt:=public.request_c5_cash_handover(d,gen_random_uuid(),1);
 perform set_config('request.jwt.claim.sub',a::text,true);perform public.confirm_c5_cash_handover((receipt->>'request_id')::uuid,d,a,gen_random_uuid(),1);
 perform pg_temp.c10_assert(finance_private.c6_cash_remaining(task_value)=price.total-1,'partial cash settlement');
 perform set_config('request.jwt.claim.sub',d::text,true);receipt:=public.request_c5_cash_handover(d,gen_random_uuid(),price.total-1);
 perform set_config('request.jwt.claim.sub',a::text,true);perform public.confirm_c5_cash_handover((receipt->>'request_id')::uuid,d,a,gen_random_uuid(),price.total-1);
 perform pg_temp.c10_assert(finance_private.c6_cash_remaining(task_value)=0,'full task custody settled');
 r:=public.pay_c6_driver_wages(d,a,gen_random_uuid(),array[task_value],wage);perform pg_temp.c10_assert(r->>'kind'='payment','C6 PAY');
 for child in select * from public.merchant_delivery_positions where task_id=task_value and net>0 order by store_order_id loop
  set_value:=public.prepare_c7_settlement(child.store_id,a,gen_random_uuid(),array[child.store_order_id],child.net);
  r:=public.pay_c7_settlement(child.store_id,(set_value->>'settlement_id')::uuid,a,gen_random_uuid(),child.net);perform pg_temp.c10_assert(r->>'kind'='payment','C7 PAY from C4 entitlement');
 end loop;
 perform pg_temp.c10_assert((select count(*) from public.customer_order_cash_obligations)=initial_legacy,'no legacy dual writer');
 perform public.change_subscription_account(m,a,gen_random_uuid(),'resume','active','eligibility restored');perform pg_temp.c10_assert(public.store_accepts_new_orders((f->>'store')::uuid),'resume eligibility');
 -- An unpaid next SIN creates receivable/revenue, not treasury cash and not another period.
 baseline:=finance_private.c6_treasury_balance();r:=public.issue_subscription_invoice(m,a,gen_random_uuid(),'one early renewal');q:=public.issue_subscription_invoice(m,a,gen_random_uuid(),'reuse unpaid invoice');
 perform pg_temp.c10_assert(r->>'id'=q->>'id' and finance_private.c6_treasury_balance()=baseline,'no piled debt / no cash for SIN');
 r:=public.request_treasury_finance(a,gen_random_uuid(),'{"kind":"expense","amount":"0.25","expense_type":"operating fixture","reason":"full cycle expense"}');request_id:=(r->>'request_id')::uuid;
 perform set_config('request.jwt.claim.sub',b::text,true);r:=public.act_on_treasury_finance(b,gen_random_uuid(),request_id,'approve','independent approval');perform pg_temp.c10_assert(r->>'stage'='approved' and finance_private.c6_treasury_balance()=baseline,'approved not cash');
 perform public.act_on_treasury_finance(b,gen_random_uuid(),request_id,'pay','actual cash expense');
 perform set_config('request.jwt.claim.sub',a::text,true);r:=public.record_treasury_action(a,gen_random_uuid(),'{"kind":"start","reason":"integrated count"}');count_id:=(r->>'id')::uuid;
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','count','session_id',count_id,'amount',trim_scale(finance_private.c6_treasury_balance()+0.50)::text,'reason','isolated counted surplus'));count_id:=(r->>'id')::uuid;
 r:=public.request_treasury_finance(a,gen_random_uuid(),jsonb_build_object('kind','adjustment','count_id',count_id,'reason','independent surplus correction'));request_id:=(r->>'request_id')::uuid;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.act_on_treasury_finance(b,gen_random_uuid(),request_id,'approve','independent adjustment');
 set constraints all immediate;perform pg_temp.c10_assert(not exists(select 1 from finance_private.c10_reconciliation_issues),'full integrated financial cycle reconciles');
 -- Deliberately balanced but unsourced fixture cash MUST be detected; subtransaction rolls it back.
 perform set_config('request.jwt.claim.sub',a::text,true);
 begin
  op:=finance_private.begin_operation('c10_fixture_drift',gen_random_uuid(),'{"test":true}');select id into strict ref_id from public.financial_document_references where kind='ORD' and document_id=order_value;
  event_id:=finance_private.record_financial_event(ref_id,'c10_fixture_drift',op.id);
  perform finance_private.post_journal(event_id,jsonb_build_array(jsonb_build_object('account_id',finance_private.c4_account('treasury_cash'),'side','debit','amount',0.01),jsonb_build_object('account_id',finance_private.c4_account('authorized_suspense_liability'),'side','credit','amount',0.01)),'isolated detector mutation fixture');
  perform finance_private.complete_operation(op.id,'{"state":"completed"}');set constraints all immediate;
  perform pg_temp.c10_assert(exists(select 1 from finance_private.c10_reconciliation_issues where code='account_mismatch' and details->>'account'='treasury_cash'),'detector catches real drift');
  raise exception 'C10 rollback drift fixture';
 exception when others then if sqlerrm<>'C10 rollback drift fixture' then raise;end if;end;
 perform pg_temp.c10_assert(not exists(select 1 from finance_private.c10_reconciliation_issues),'rollback restores reconciliation');
 -- Zero after one real rejection; immutable original approval remains unchanged.
 old_order:=order_value;order_value:=pg_temp.c10_order(true,0);task_value:=pg_temp.c10_pick(order_value,(f->>'store')::uuid);
 select * into strict price from public.order_pricing_current where customer_order_id=order_value;perform pg_temp.c10_assert(price.total=0,'rejection yields true zero');
 select count(*) into before_journals from public.journal_entries;perform set_config('request.jwt.claim.sub',d::text,true);r:=public.complete_delivery_and_collect_cash(task_value,d,gen_random_uuid(),price.version);
 set constraints all immediate;perform pg_temp.c10_assert(r->>'kind'='zero_cash_delivery' and (select count(*) from public.journal_entries)=before_journals,'zero has no financial journal');
 -- Deferred failure rolls back C4 + C6 + C7 together; retry the same frozen key succeeds.
 order_value:=pg_temp.c10_order(false,100);task_value:=pg_temp.c10_pick(order_value);select * into strict price from public.order_pricing_current where customer_order_id=order_value;key_value:=gen_random_uuid();
 select count(*) into before_journals from public.journal_entries;perform set_config('c10.fail','yes',true);set constraints all deferred;
 begin perform public.complete_delivery_and_collect_cash(task_value,d,key_value,price.version);raise exception 'deferred fault absent';exception when others then if sqlerrm<>'C10 injected deferred failure' then raise;end if;end;
 perform pg_temp.c10_assert((select status='picked_up' from public.delivery_tasks where id=task_value) and not exists(select 1 from public.delivery_collection_results where task_id=task_value) and not exists(select 1 from public.driver_wage_entitlements where task_id=task_value) and not exists(select 1 from public.merchant_delivery_positions where task_id=task_value) and (select count(*) from public.journal_entries)=before_journals,'complete rollback across phases');
 perform set_config('c10.fail','no',true);perform public.complete_delivery_and_collect_cash(task_value,d,key_value,price.version);set constraints all immediate;
 -- All stores rejected: cancellation without a DLV or any new-ledger economic event.
 order_value:=pg_temp.c10_order(false,100);perform set_config('request.jwt.claim.sub',a::text,true);
 for child in select id from public.store_orders where customer_order_id=order_value order by id loop perform public.update_store_order_status(child.id,'rejected','all stores unavailable fixture');end loop;
 perform pg_temp.c10_assert((select status='cancelled' from public.customer_orders where id=order_value) and not exists(select 1 from public.delivery_tasks where customer_order_id=order_value),'all rejected no dispatch');
 -- Turning intake OFF changes new births only. A legacy order completes solely through legacy writers.
 update finance_private.c4_rollout set accept_new_orders=false;old_order:=pg_temp.c10_order(false,100);
 perform pg_temp.c10_assert(not finance_private.c4_is_order(old_order),'legacy writer selected at birth');
 perform set_config('request.jwt.claim.sub',a::text,true);for child in select id from public.store_orders where customer_order_id=old_order order by id loop perform public.update_store_order_status(child.id,'preparing');perform public.update_store_order_status(child.id,'ready_for_pickup');end loop;
 update finance_private.c4_rollout set accept_new_orders=true;
 select count(*) into before_journals from public.journal_entries;perform set_config('request.jwt.claim.sub',d::text,true);perform public.accept_delivery_task(old_order);perform public.update_delivery_task_status(old_order,'picked_up');perform public.update_delivery_task_status(old_order,'delivered');set constraints all immediate;
 perform pg_temp.c10_assert(not exists(select 1 from public.delivery_collection_results where customer_order_id=old_order) and (select count(*) from public.journal_entries)=before_journals and exists(select 1 from public.customer_order_cash_obligations where customer_order_id=old_order),'legacy remains separate after flag ON');
 -- Recovery of the ORIGINAL checkout is independent of a NEW server cart and cannot clear it.
 perform set_config('request.jwt.claim.sub',f->>'customer',true);select id into strict cart_value from public.customer_carts where customer_id=auth.uid();
 insert into public.customer_cart_items(cart_id,product_id,quantity) select cart_value,p.id,p.minimum_quantity from public.products p where p.id=(f->>'product')::uuid;
 select request_key into strict key_value from public.customer_order_requests where customer_order_id=first_order;
 r:=public.recover_c3_order_request(key_value,auth.uid());perform pg_temp.c10_assert(r->>'order_id'=first_order::text and exists(select 1 from public.customer_cart_items where cart_id=cart_value),'old recovery preserves new cart');
 q:=public.get_c3_order_context(array[first_order]);perform pg_temp.c10_assert(q->first_order::text->'pricing'<>'null'::jsonb,'customer sees own pricing');
 perform set_config('request.jwt.claim.sub',u::text,true);q:=public.get_c3_order_context(array[first_order]);perform pg_temp.c10_assert(q->first_order::text->'pricing'='null'::jsonb,'merchant cannot see parent COD totals');
 select store_id,id into strict zone_value,task_value from public.store_orders where customer_order_id=first_order and store_id<>(f->>'store')::uuid;
 perform pg_temp.c10_assert(not ((q->first_order::text->'references') ? ('SUB:'||task_value::text)),'foreign SUB reference hidden');
 wrong:=false;begin perform public.get_c7_merchant_settlements(u,zone_value);exception when insufficient_privilege then wrong:=true;end;perform pg_temp.c10_assert(wrong,'foreign merchant financial scope denied');
 perform set_config('request.jwt.claim.sub',d::text,true);q:=public.get_c3_order_context(array[first_order]);perform pg_temp.c10_assert(q->first_order::text->'pricing'<>'null'::jsonb,'assigned driver sees server COD');
 perform set_config('request.jwt.claim.sub',f->>'foreignDriver',true);q:=public.get_c3_order_context(array[first_order]);perform pg_temp.c10_assert(not(q ? first_order::text),'unassigned driver has no order context');
 wrong:=false;begin perform public.get_c6_driver_wages(d,(f->>'foreignDriver')::uuid);exception when insufficient_privilege then wrong:=true;end;perform pg_temp.c10_assert(wrong,'foreign driver wages denied');
 -- Reconciliation permission is independent and user-bound, not an admin shortcut.
 perform set_config('request.jwt.claim.sub',b::text,true);wrong:=false;begin perform public.read_financial_reconciliation(b);exception when insufficient_privilege then wrong:=true;end;perform pg_temp.c10_assert(wrong,'admin without reconciliation permission denied');
 perform set_config('request.jwt.claim.sub',a::text,true);q:=public.read_financial_reconciliation(a);perform pg_temp.c10_assert((q->'summary'->>'errors')::integer=0 and (q->'summary'->>'warnings')::integer=0,'final reconciliation after deferred recovery');
 -- Keep a durable synthetic report row for the COMMIT variant; rollback variant removes it.
 perform set_config('c10.last_order',first_order::text,true);
end $$;
-- Real PostgreSQL role + claims emulation; NOT an Auth HTTP JWT test.
set local role authenticated;
do $$ declare f jsonb:=current_setting('c10.fixture')::jsonb;begin
 perform set_config('request.jwt.claim.sub',f->>'customer',true);
 if not exists(select 1 from public.customer_orders where id=current_setting('c10.last_order')::uuid) or exists(select 1 from public.journal_lines) then raise exception 'customer RLS scope failed';end if;
 perform set_config('request.jwt.claim.sub',f->>'owner',true);
 if exists(select 1 from public.merchant_delivery_positions where merchant_id<>(f->>'merchant')::uuid) or not exists(select 1 from public.merchant_delivery_positions where merchant_id=(f->>'merchant')::uuid) then raise exception 'merchant RLS scope failed';end if;
 perform set_config('request.jwt.claim.sub',f->>'driver',true);
 if exists(select 1 from public.driver_wage_entitlements where driver_id<>(f->>'driver')::uuid) or not exists(select 1 from public.driver_wage_entitlements where driver_id=(f->>'driver')::uuid) then raise exception 'driver RLS scope failed';end if;
end $$;
reset role;
set constraints all immediate;
rollback;
