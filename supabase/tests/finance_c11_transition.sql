-- MUTATING DISPOSABLE ONLY. Loaded inside the C10 guarded transaction by the C11 harness.
-- No stand-alone production execution. pg_temp helpers use existing synthetic identities.
create function pg_temp.c11_enable_fixture(actor uuid) returns void language plpgsql as $$
declare p text;denied boolean:=false;before_count bigint;
begin
 if current_database()!~'_c2_test$' or not coalesce(host(inet_server_addr()) in ('127.0.0.1','::1'),false) or not exists(select 1 from c2_test_guard.environment where singleton and token=(current_setting('c10.fixture')::jsonb->>'token')::uuid) then raise exception 'isolated C11 identity required';end if;
 insert into finance_private.c11_permissions(user_id,may_control,may_review) values(actor,true,true);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select count(*) into before_count from public.journal_entries;
 begin perform public.set_finance_transition_gate(actor,'new_orders',true,'must reject missing dependencies');exception when others then denied:=true;end;
 perform pg_temp.c10_assert(denied,'C11 missing dependencies deny activation');
 foreach p in array array['delivery','custody','wages','settlements','treasury','reconciliation','subscriptions','new_orders'] loop
  perform public.set_finance_transition_gate(actor,p,true,'isolated reviewed synthetic activation');
 end loop;
 perform public.set_finance_transition_gate(actor,'new_orders',false,'rollback admission before any financial event');
 perform pg_temp.c10_assert((select count(*) from public.journal_entries)=before_count,'pre-first-event rollback never posts');
 perform public.set_finance_transition_gate(actor,'new_orders',true,'isolated new order test cohort');
end $$;

create function pg_temp.c11_verify() returns void language plpgsql as $$
declare f jsonb:=current_setting('c10.fixture')::jsonb;a uuid:=(f->>'admin')::uuid;d uuid:=(f->>'driver')::uuid;
 frozen uuid;legacy_value uuid;task_value uuid;version_value bigint;before_count bigint;r jsonb;r2 jsonb;denied boolean;key_value uuid:=gen_random_uuid();invoice_value uuid;paid_end timestamptz;started timestamptz;p text;child record;
begin
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform pg_temp.c10_assert((select count(*) from public.journal_entries)>0,'post-first-event test has real C2 journals');
 perform set_config('request.jwt.claim.sub',d::text,true);
 r:=public.get_legacy_delivery_collection(d,(f->>'preC3Task')::uuid);
 perform pg_temp.c10_assert(r->>'state'='ready' and (r->>'amount')::numeric=(f->>'legacyCollectible')::numeric,'pre-C3 active legacy server preview uses exact fixture amount');
 perform set_config('request.jwt.claim.sub',f->>'foreignDriver',true);denied:=false;
 begin perform public.get_legacy_delivery_collection((f->>'foreignDriver')::uuid,(f->>'preC3Task')::uuid);exception when insufficient_privilege then denied:=true;end;
 perform pg_temp.c10_assert(denied,'foreign driver cannot read legacy cash amount');
 perform set_config('request.jwt.claim.sub',a::text,true);
 frozen:=pg_temp.c10_order(false,100);perform set_config('request.jwt.claim.sub',a::text,true);
 perform pg_temp.c10_assert(exists(select 1 from finance_private.c11_order_contracts where customer_order_id=frozen),'new cohort contract exists before DLV');
 perform public.set_finance_transition_gate(a,'new_orders',false,'pause births after financial activity');
 foreach p in array array['delivery','custody','wages','settlements'] loop perform public.set_finance_transition_gate(a,p,false,'pause admission while preserving drain');end loop;
 -- Reproduce the old C6 flag window, not just the new controller's normal drain behavior.
 update finance_private.c6_control set accept_tasks=false;
 legacy_value:=pg_temp.c10_order(false,100);perform pg_temp.c10_assert(not finance_private.c4_is_order(legacy_value),'OFF creates legacy, never converts frozen C4');
 task_value:=pg_temp.c10_pick(frozen);perform pg_temp.c10_assert(exists(select 1 from public.delivery_wage_snapshots where task_id=task_value),'frozen C4 retains wages after flag stop');
 select version into strict version_value from public.order_pricing_current where customer_order_id=frozen;
 perform set_config('request.jwt.claim.sub',d::text,true);r:=public.complete_delivery_and_collect_cash(task_value,d,key_value,version_value);set constraints all immediate;
 r2:=public.recover_delivery_collection(key_value,d);perform pg_temp.c10_assert((r-'replayed')=(r2-'replayed') and r->>'state'='completed','C4 completes and recovers after stopping admission');
 perform pg_temp.c10_assert(not exists(select 1 from public.customer_order_cash_obligations where customer_order_id=frozen),'new cohort never writes legacy');
 denied:=false;begin update public.order_financial_modes set mode='legacy' where customer_order_id=frozen;exception when others then denied:=true;end;perform pg_temp.c10_assert(denied,'writer cannot be switched after completion');
 perform set_config('request.jwt.claim.sub',a::text,true);
 for child in select id from public.store_orders where customer_order_id=legacy_value order by id loop perform public.update_store_order_status(child.id,'preparing');perform public.update_store_order_status(child.id,'ready_for_pickup');end loop;
 perform set_config('request.jwt.claim.sub',d::text,true);perform public.accept_delivery_task(legacy_value);select count(*) into before_count from public.journal_entries;
 perform public.update_delivery_task_status(legacy_value,'picked_up');perform public.update_delivery_task_status(legacy_value,'delivered');set constraints all immediate;
 perform pg_temp.c10_assert((select count(*) from public.journal_entries)=before_count and exists(select 1 from public.customer_order_cash_obligations where customer_order_id=legacy_value),'in-progress legacy completes without C2');

 -- Preserve an actual paid legacy period; a failed transition cannot create SIN/revenue.
 perform set_config('request.jwt.claim.sub',a::text,true);
 select max(expires_at) into paid_end from public.merchant_subscriptions where merchant_id=(f->>'paidMerchant')::uuid;
 select count(*) into before_count from public.journal_entries;
 r:=public.transition_legacy_subscription((f->>'paidMerchant')::uuid,(f->>'plan')::uuid,a,gen_random_uuid(),'paid legacy must be preserved');
 perform pg_temp.c10_assert(r->>'state'='rejected' and not exists(select 1 from public.subscription_memberships where merchant_id=(f->>'paidMerchant')::uuid) and (select max(expires_at) from public.merchant_subscriptions where merchant_id=(f->>'paidMerchant')::uuid)=paid_end and (select count(*) from public.journal_entries)=before_count,'paid legacy period unchanged and no retrospective revenue');
 perform pg_temp.c10_assert(finance_private.subscription_activation_start(paid_end,paid_end+interval '168 hours'-interval '1 microsecond')=paid_end and finance_private.subscription_activation_start(paid_end,paid_end+interval '168 hours')=paid_end+interval '168 hours','exact 168-hour transition grace');
 started:=clock_timestamp();key_value:=gen_random_uuid();
 r:=public.transition_legacy_subscription((f->>'expiredMerchant')::uuid,(f->>'plan')::uuid,a,key_value,'explicit expired legacy transition, no balances imported');
 perform pg_temp.c10_assert(r->>'state'='completed' and exists(select 1 from finance_private.c11_subscription_transitions where merchant_id=(f->>'expiredMerchant')::uuid),'explicit transition audited');
 r:=public.issue_subscription_invoice((f->>'expiredMerchant')::uuid,a,gen_random_uuid(),'first NEW paid period only');invoice_value:=(r->>'id')::uuid;
 r2:=public.issue_subscription_invoice((f->>'expiredMerchant')::uuid,a,gen_random_uuid(),'same pending first invoice');
 perform pg_temp.c10_assert(r2->>'id'=invoice_value::text and (select period_start_snapshot>=started from public.subscription_billing_documents where id=invoice_value),'no catch-up billing or duplicate SIN');
 perform public.set_finance_transition_gate(a,'subscriptions',false,'pause new enrollment but collect existing invoice');
 r:=public.collect_subscription_invoice(invoice_value,(f->>'expiredMerchant')::uuid,a,gen_random_uuid(),(select amount from public.subscription_billing_documents where id=invoice_value),'existing cohort receipt after pause');set constraints all immediate;
 perform pg_temp.c10_assert(r->>'state'='completed','existing C8 invoice remains payable after admission stopped');
 perform public.set_finance_transition_gate(a,'treasury',false,'pause new treasury requests, retain existing drain');
 perform public.set_finance_transition_gate(a,'reconciliation',false,'stop future cohort admission, retain read access');
 perform pg_temp.c10_assert((public.read_finance_transition(a)->>'balances_combined')::boolean=false and not exists(select 1 from finance_private.c10_reconciliation_issues where severity='error'),'separate-cohort reconciliation remains clean');
 perform set_config('request.jwt.claim.sub',f->>'customer',true);denied:=false;begin perform public.set_finance_transition_gate((f->>'customer')::uuid,'new_orders',true,'unauthorized customer activation');exception when insufficient_privilege then denied:=true;end;perform pg_temp.c10_assert(denied,'customer cannot activate finance');
end $$;
