-- OWNER-RUN MUTATING ROLLBACK SUITE, disposable loopback database only, full schema through C8.
-- Requires a new accepted merchant/store/product and a distinct expired fully-paid legacy merchant.
-- Sequences can advance despite ROLLBACK. No remote execution.
\set ON_ERROR_STOP on
begin;
select set_config('c8.token',:'test_token',true),set_config('c8.admin',:'admin_user',true),set_config('c8.customer',:'customer_user',true),set_config('c8.driver',:'driver_user',true),set_config('c8.merchant',:'c8_merchant',true),set_config('c8.owner',:'c8_owner',true),set_config('c8.store',:'c8_store',true),set_config('c8.plan',:'c8_plan',true),set_config('c8.product',:'c8_product',true),set_config('c8.expired',:'expired_merchant',true),set_config('c8.expired_owner',:'expired_owner',true);
do $$ begin
 if current_database() !~ '_c2_test$' or not coalesce(host(inet_server_addr()) in ('127.0.0.1','::1'),false) or to_regclass('c2_test_guard.environment') is null then raise exception 'isolated local C8 database required';end if;
 perform 1 from c2_test_guard.environment where singleton and token=current_setting('c8.token')::uuid;if not found then raise exception 'test identity mismatch';end if;
end $$;
create function pg_temp.c8_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'C8 ASSERT: %',message;end if;end $$;
create function pg_temp.c8_fault() returns trigger language plpgsql as $$ begin if current_setting('c8.fail',true)='yes' and new.side='credit' and exists(select 1 from public.financial_accounts where id=new.account_id and definition_code='subscription_receivable') then raise exception 'injected C8 line failure';end if;return new;end $$;
create trigger c8_test_line before insert on public.journal_lines for each row execute function pg_temp.c8_fault();
create function pg_temp.c8_deferred_fault() returns trigger language plpgsql as $$ begin if current_setting('c8.fail_deferred',true)='yes' then raise exception 'injected C8 deferred failure';end if;return null;end $$;
create constraint trigger c8_test_deferred after insert on public.subscription_cash_receipts deferrable initially deferred for each row execute function pg_temp.c8_deferred_fault();
do $$
declare a uuid:=current_setting('c8.admin')::uuid;m uuid:=current_setting('c8.merchant')::uuid;u uuid:=current_setting('c8.owner')::uuid;plan_value uuid:=current_setting('c8.plan')::uuid;
 inv uuid;inv2 uuid;period_value uuid;period_end timestamptz;receipt_key uuid:=gen_random_uuid();invoice_key uuid:=gen_random_uuid();r jsonb;paid jsonb;state_value jsonb;treasury_before numeric;journals_before bigint;legacy_before bigint;rejected boolean;
 cart_value uuid;zone_value uuid;q jsonb;order_value uuid;sub_value uuid;checkout_key uuid;
 expired_value uuid:=current_setting('c8.expired')::uuid;expired_invoice uuid;clock_before timestamptz;
begin
 perform pg_temp.c8_assert((select not accept_operations and not scheduler_enabled and not enforce_gate from finance_private.c8_control),'default closed');
 perform pg_temp.c8_assert(not exists(select 1 from public.merchant_subscriptions where merchant_id=m),'fresh merchant fixture has no native periods');
 perform pg_temp.c8_assert(not exists(select 1 from public.subscription_memberships where merchant_id in (m,expired_value)),'fresh C8 memberships');
 perform set_config('request.jwt.claim.sub',a::text,true);perform pg_temp.c8_assert(public.is_admin(),'admin fixture');
 update finance_private.c8_control set accept_operations=true,enforce_gate=true where singleton;
 insert into finance_private.c8_permissions(user_id,plans,issue,collect,suspend,resume,cancel) values(a,true,true,false,true,true,true);
 perform public.save_subscription_plan_version(a,gen_random_uuid(),plan_value,'C8 test plan','synthetic only',100.50,1,true,null,'initial fixture version');
 perform public.enroll_subscription_account(m,plan_value,a,gen_random_uuid(),'explicit fresh enrollment');
 treasury_before:=finance_private.c6_treasury_balance();select count(*) into legacy_before from public.merchant_ledger_entries;
 r:=public.issue_subscription_invoice(m,a,invoice_key,'initial C8 invoice');inv:=(r->>'id')::uuid;set constraints all immediate;
 perform pg_temp.c8_assert(r->>'reference' ~ '^SIN-[0-9]{6,}$','SIN canonical reference');
 perform pg_temp.c8_assert(finance_private.c8_receivable(m)=100.50,'invoice creates exact receivable');
 perform pg_temp.c8_assert(finance_private.c6_treasury_balance()=treasury_before,'invoice creates NO treasury cash');
 perform pg_temp.c8_assert(not exists(select 1 from public.merchant_subscriptions where merchant_id=m),'invoice does not grant paid period');
 perform pg_temp.c8_assert(public.recover_subscription_operation(a,invoice_key)=r,'invoice lost response recovery');
 perform pg_temp.c8_assert(public.issue_subscription_invoice(m,a,invoice_key,'initial C8 invoice')=r,'same key invoice replay');
 perform pg_temp.c8_assert((public.issue_subscription_invoice(m,a,gen_random_uuid(),'reuse outstanding invoice')->>'id')::uuid=inv,'different key reuses unpaid invoice');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.change_subscription_account(m,u,gen_random_uuid(),'renewal','automatic','merchant automatic selection');
 perform public.change_subscription_account(m,u,gen_random_uuid(),'renewal','disabled','merchant stop renewal');
 perform pg_temp.c8_assert((select amount=100.50 from public.subscription_billing_documents where id=inv),'mode cannot erase debt');
 rejected:=false;begin perform public.collect_subscription_invoice(inv,m,u,gen_random_uuid(),100.50,'forbidden merchant cash');exception when insufficient_privilege then rejected:=true;end;
 perform pg_temp.c8_assert(rejected,'merchant cannot confirm office cash');
 perform public.change_subscription_account(m,u,gen_random_uuid(),'renewal','manual','owner manual test');
 perform set_config('request.jwt.claim.sub',a::text,true);
 update finance_private.c8_permissions set issue=false where user_id=a;
 rejected:=false;begin perform public.issue_subscription_invoice(m,a,gen_random_uuid(),'unprivileged admin cannot impersonate owner');exception when insufficient_privilege then rejected:=true;end;
 perform pg_temp.c8_assert(rejected,'admin reader cannot bypass issue permission through manual mode');
 rejected:=false;begin perform public.change_subscription_account(m,a,gen_random_uuid(),'renewal','automatic','unprivileged admin mode test');exception when insufficient_privilege then rejected:=true;end;
 perform pg_temp.c8_assert(rejected,'admin reader cannot schedule another merchant debt');
 update finance_private.c8_permissions set issue=true where user_id=a;
 rejected:=false;begin perform public.collect_subscription_invoice(inv,m,a,receipt_key,100.50,'admin no cash permission');exception when insufficient_privilege then rejected:=true;end;
 perform pg_temp.c8_assert(rejected,'admin role alone cannot collect');update finance_private.c8_permissions set collect=true where user_id=a;
 r:=public.collect_subscription_invoice(inv,m,a,gen_random_uuid(),100,'wrong counted amount');perform pg_temp.c8_assert(r->>'code'='amount_mismatch','count mismatch explicitly rejected, not settled');
 perform set_config('c8.fail','yes',true);rejected:=false;
 begin perform public.collect_subscription_invoice(inv,m,a,receipt_key,100.50,'actual full receipt');exception when others then if sqlerrm<>'injected C8 line failure' then raise;end if;rejected:=true;end;
 perform set_config('c8.fail','no',true);perform pg_temp.c8_assert(rejected and not exists(select 1 from public.subscription_cash_receipts where invoice_id=inv),'line failure rolls back cash/period/result');
 set constraints c8_test_deferred deferred;perform set_config('c8.fail_deferred','yes',true);rejected:=false;
 begin perform public.collect_subscription_invoice(inv,m,a,receipt_key,100.50,'actual full receipt');exception when others then if sqlerrm<>'injected C8 deferred failure' then raise;end if;rejected:=true;end;
 perform set_config('c8.fail_deferred','no',true);perform pg_temp.c8_assert(rejected and not exists(select 1 from public.merchant_subscriptions where merchant_id=m),'deferred failure rolls back paid period too');
 paid:=public.collect_subscription_invoice(inv,m,a,receipt_key,100.50,'actual full receipt');set constraints all immediate;
 perform pg_temp.c8_assert(paid->>'reference' ~ '^RCT-[0-9]{6,}$' and finance_private.c8_receivable(m)=0,'receipt closes receivable');
 perform pg_temp.c8_assert(finance_private.c6_treasury_balance()=treasury_before+100.50,'receipt adds exact treasury cash');
 perform pg_temp.c8_assert(public.collect_subscription_invoice(inv,m,a,receipt_key,100.50,'actual full receipt')=paid,'same key collection replay');
 perform pg_temp.c8_assert(public.collect_subscription_invoice(inv,m,a,gen_random_uuid(),100.50,'verified paid invoice replay')=paid,'different key never recollects');
 select period_id into strict period_value from public.subscription_cash_receipts where invoice_id=inv;
 perform pg_temp.c8_assert((select count(*)=1 from public.subscription_cash_receipts where invoice_id=inv),'one receipt/period');
 perform public.save_subscription_plan_version(a,gen_random_uuid(),plan_value,'New C8 price','synthetic changed version',120.75,2,true,null,'future invoice price changed');
 perform pg_temp.c8_assert((select amount=100.50 from public.subscription_billing_documents where id=inv) and (select price_snapshot=100.50 and duration_months=1 from public.merchant_subscriptions where id=period_value),'old invoice/paid terms immutable');
 -- Early renewal: future period starts at previous end, not now; no overlapping free extension.
 r:=public.issue_subscription_invoice(m,a,gen_random_uuid(),'early renewal requested');inv2:=(r->>'id')::uuid;
 perform pg_temp.c8_assert((r->>'amount')::numeric=120.75,'renewal takes current issued price');
 perform public.collect_subscription_invoice(inv2,m,a,gen_random_uuid(),120.75,'early full renewal cash');set constraints all immediate;
 perform pg_temp.c8_assert((select p2.starts_at=p1.expires_at from public.subscription_cash_receipts r1 join public.merchant_subscriptions p1 on p1.id=r1.period_id cross join public.subscription_cash_receipts r2 join public.merchant_subscriptions p2 on p2.id=r2.period_id where r1.invoice_id=inv and r2.invoice_id=inv2),'early renewal no overlap');
 r:=public.issue_subscription_invoice(m,a,gen_random_uuid(),'no future pile up');perform pg_temp.c8_assert(r->>'code'='renewal_not_due','future paid period prevents invoice pile-up');
 select p.expires_at into strict period_end from public.subscription_cash_receipts rr join public.merchant_subscriptions p on p.id=rr.period_id where rr.invoice_id=inv2;
 perform pg_temp.c8_assert(finance_private.c8_state(m,period_end-interval '1 microsecond')->>'state'='active','before paid end');
 perform pg_temp.c8_assert(finance_private.c8_state(m,period_end)->>'state'='grace_period','exact grace start');
 perform pg_temp.c8_assert(finance_private.c8_state(m,period_end+interval '168 hours'-interval '1 microsecond')->>'state'='grace_period','before 168 hours');
 perform pg_temp.c8_assert(finance_private.c8_state(m,period_end+interval '168 hours')->>'state'='expired','exact 168 hours is expired');
 perform pg_temp.c8_assert(finance_private.c8_state(m,period_end+interval '168 hours 1 second')->>'state'='expired','after grace');
 perform pg_temp.c8_assert(finance_private.subscription_activation_start(period_end,period_end-interval '1 day')=period_end,'early payment starts at old end');
 perform pg_temp.c8_assert(finance_private.subscription_activation_start(period_end,period_end+interval '167 hours')=period_end,'within grace anchored');
 perform pg_temp.c8_assert(finance_private.subscription_activation_start(period_end,period_end+interval '168 hours')=period_end+interval '168 hours','late payment starts at payment');
 perform set_config('TimeZone','America/New_York',true);
 perform pg_temp.c8_assert(finance_private.c8_state(m,period_end+interval '168 hours')->>'state'='expired','timezone independent grace');perform set_config('TimeZone','UTC',true);
 -- Real C3 creation, then expire eligibility via administrative event, not by editing snapshots.
 zone_value:=public.save_c3_delivery_zone(null,'C8 test zone',100,0,true,null);
 perform set_config('request.jwt.claim.sub',current_setting('c8.customer'),true);
 insert into public.customer_carts(customer_id) values(auth.uid()) on conflict(customer_id) do nothing;select id into strict cart_value from public.customer_carts where customer_id=auth.uid();
 delete from public.customer_cart_items where cart_id=cart_value;delete from public.customer_cart_offer_selections where cart_id=cart_value;delete from public.customer_cart_store_notes where cart_id=cart_value;
 insert into public.customer_cart_items(cart_id,product_id,quantity) select cart_value,id,minimum_quantity from public.products where id=current_setting('c8.product')::uuid;
 q:=public.quote_c3_cart(zone_value,auth.uid());r:=public.create_c3_order_from_cart('C8 recipient','00000','synthetic address',zone_value,'',gen_random_uuid(),(q->>'total')::numeric,auth.uid(),q->>'cart_signature');perform pg_temp.c8_assert(r->>'state'='completed','paid C8 keeps C3 creation');order_value:=(r->>'order_id')::uuid;
 insert into public.customer_cart_items(cart_id,product_id,quantity) select cart_value,id,minimum_quantity from public.products where id=current_setting('c8.product')::uuid;
 q:=public.quote_c3_cart(zone_value,auth.uid());
 perform set_config('request.jwt.claim.sub',a::text,true);perform public.change_subscription_account(m,a,gen_random_uuid(),'suspend','suspended','administrative suspension fixture');perform pg_temp.c8_assert(not public.store_accepts_new_orders(current_setting('c8.store')::uuid),'suspension blocks NEW orders');
 select id into strict sub_value from public.store_orders where customer_order_id=order_value;perform public.update_store_order_status(sub_value,'preparing');perform pg_temp.c8_assert((select status='preparing' from public.store_orders where id=sub_value),'suspension does not block EXISTING fulfillment');
 perform set_config('request.jwt.claim.sub',current_setting('c8.customer'),true);checkout_key:=gen_random_uuid();r:=public.create_c3_order_from_cart('C8 recipient','00000','synthetic address',zone_value,'',checkout_key,(q->>'total')::numeric,auth.uid(),q->>'cart_signature');
 perform pg_temp.c8_assert(r->>'code'='C8_STORE_UNAVAILABLE','final C3 creation rechecks eligibility');perform pg_temp.c8_assert((select customer_order_id is null from public.customer_order_requests where customer_id=auth.uid() and request_key=checkout_key),'no partial order on rejection');
 perform set_config('request.jwt.claim.sub',a::text,true);perform public.change_subscription_account(m,a,gen_random_uuid(),'resume','active','approved resume fixture');perform pg_temp.c8_assert(public.store_accepts_new_orders(current_setting('c8.store')::uuid),'resume paid store');
 -- Real delayed scheduler fixture: ended PAID legacy period, explicitly enrolled only after grace/debt closure.
 perform public.enroll_subscription_account(expired_value,plan_value,a,gen_random_uuid(),'explicit expired paid legacy enrollment');
 perform public.change_subscription_account(expired_value,a,gen_random_uuid(),'renewal','automatic','automatic fixture choice');
 perform public.save_subscription_plan_version(a,gen_random_uuid(),plan_value,'Unavailable scheduler fixture','synthetic',120.75,2,false,null,'temporarily unavailable plan');
 update finance_private.c8_control set scheduler_enabled=true where singleton;perform set_config('request.jwt.claim.sub','',true);
 perform finance_private.run_due_subscription_invoices(100);
 perform pg_temp.c8_assert(not exists(select 1 from public.subscription_billing_documents where merchant_id=expired_value),'invalid plan creates no invoice');
 perform pg_temp.c8_assert(exists(select 1 from finance_private.subscription_job_failures where merchant_id=expired_value),'scheduler failure audited');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.save_subscription_plan_version(a,gen_random_uuid(),plan_value,'Restored scheduler fixture','synthetic',120.75,2,true,null,'corrected plan enables retry');
 perform set_config('request.jwt.claim.sub','',true);
 perform finance_private.run_due_subscription_invoices(100);perform finance_private.run_due_subscription_invoices(100);set constraints all immediate;
 perform pg_temp.c8_assert((select count(*)=1 from public.subscription_billing_documents where merchant_id=expired_value),'repeated late scheduler one invoice');
 perform pg_temp.c8_assert(exists(select 1 from public.financial_operations where actor_id is null and actor_role is null and system_source='subscription_scheduler' and state='completed'),'system provenance without forged JWT');
 select id into strict expired_invoice from public.subscription_billing_documents where merchant_id=expired_value;
 perform set_config('request.jwt.claim.sub',a::text,true);clock_before:=clock_timestamp();perform public.collect_subscription_invoice(expired_invoice,expired_value,a,gen_random_uuid(),120.75,'late cash after grace');set constraints all immediate;
 perform pg_temp.c8_assert((select p.starts_at>=clock_before from public.subscription_cash_receipts rr join public.merchant_subscriptions p on p.id=rr.period_id where rr.invoice_id=expired_invoice),'late payment excludes inactive days');
 perform pg_temp.c8_assert((select count(*)=legacy_before from public.merchant_ledger_entries),'no second legacy subscription writer');
 perform public.change_subscription_account(m,a,gen_random_uuid(),'cancel','cancelled','exceptional cancellation no refund');perform pg_temp.c8_assert((select count(*)=2 from public.subscription_cash_receipts where merchant_id=m),'cancel does not refund/delete paid invoices');
end $$;
-- SQL role/claims emulation, not signed HTTP JWT evidence.
select set_config('request.jwt.claim.sub',:'c8_owner',true);set local role authenticated;
select pg_temp.c8_assert((select count(*)=2 from public.subscription_billing_documents where merchant_id=current_setting('c8.merchant')::uuid),'owner sees own invoices');
select pg_temp.c8_assert(not exists(select 1 from public.subscription_billing_documents where merchant_id=current_setting('c8.expired')::uuid),'no foreign invoices');
select pg_temp.c8_assert(not has_schema_privilege('authenticated','finance_private','USAGE'),'no private scheduler access');reset role;
create function pg_temp.c8_deny(statement_value text) returns void language plpgsql as $$ begin
 begin execute statement_value;exception when insufficient_privilege then return;end;raise exception 'expected permission denial';end $$;
select set_config('request.jwt.claim.sub',:'c8_owner',true);set local role authenticated;
select pg_temp.c8_deny(format('select public.read_subscription_account(%L,%L,0)',current_setting('c8.owner'),current_setting('c8.expired')));
select pg_temp.c8_deny($deny$select finance_private.run_due_subscription_invoices(1)$deny$);
select pg_temp.c8_deny($deny$insert into public.financial_operations(actor_id,actor_role,system_source,operation_type,attempt_key,canonical_input) values(null,null,'subscription_scheduler','c8_issue',gen_random_uuid(),'{}')$deny$);
reset role;
set constraints all immediate;
rollback;
\echo C8 rollback suite complete. COMMIT/concurrency and signed JWT require separate execution.
