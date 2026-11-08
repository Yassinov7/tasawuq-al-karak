-- MUTATING, OWNER-RUN, DISPOSABLE LOOPBACK ONLY. Never run on the project database.
-- All values are synthetic fixture IDs supplied by the pinned harness. No automatic migration.
-- Rollback does not restore C2 reference sequences. Real COMMIT overlap lives in the harness.
begin;
do $$
declare f jsonb:=current_setting('c9.test_fixture')::jsonb;a uuid:=(f->>'admin')::uuid;driver uuid:=(f->>'driver')::uuid;
 before_balance numeric;after_balance numeric;r jsonb;s uuid;key_value uuid:=gen_random_uuid();doc_count integer;denied boolean;
 op public.financial_operations%rowtype;ref_value uuid;event_value uuid;cash uuid;counterpart uuid;
begin
 if current_database() !~ '_c2_test$' or not exists(select 1 from c2_test_guard.environment where singleton) then raise exception 'isolated marked database required';end if;
 if not exists(select 1 from public.profiles where id=a and role='admin') or not exists(select 1 from public.profiles where id=driver and role='driver') then raise exception 'real synthetic roles required';end if;
 if (select enabled from finance_private.c9_control where singleton) then raise exception 'C9 default-off fixture required';end if;
 before_balance:=finance_private.c6_treasury_balance();
 insert into finance_private.c9_permissions(user_id,dashboard,ledger,expense,pay,count_cash,review,adjust,opening) values(a,true,true,true,true,true,true,true,true)
 on conflict(user_id) do update set dashboard=true,ledger=true,expense=true,pay=true,count_cash=true,review=true,adjust=true,opening=true;
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.record_treasury_action(a,key_value,jsonb_build_object('kind','start','reason','disabled gate fixture'));
 if r->>'code'<>'c9_disabled' then raise exception 'default off failed';end if;
 update finance_private.c9_control set enabled=true where singleton;
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','start','reason','count fixture'));s:=(r->>'id')::uuid;
 if r->>'state'<>'completed' then raise exception 'count start failed';end if;
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','count','session_id',s,'amount',trim_scale(before_balance)::text,'reason','matching physical count fixture'));
 if r->>'state'<>'completed' or (select difference from public.treasury_control_documents where id=(r->>'id')::uuid)<>0 then raise exception 'matching count failed';end if;
 -- A different attempt must not create another result for this session.
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','count','session_id',s,'amount',trim_scale(before_balance)::text,'reason','duplicate count fixture'));
 if r->>'code'<>'already_completed' then raise exception 'duplicate count allowed';end if;
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','start','reason','difference fixture'));s:=(r->>'id')::uuid;
 key_value:=gen_random_uuid();
 r:=public.record_treasury_action(a,key_value,jsonb_build_object('kind','count','session_id',s,'amount',trim_scale((before_balance+1.25))::text,'reason','surplus physical count fixture'));
 if (select difference from public.treasury_control_documents where id=(r->>'id')::uuid)<>1.25 then raise exception 'surplus difference wrong';end if;
 if public.recover_treasury_action(a,key_value) is distinct from r then raise exception 'recovery differs';end if;
 s:=(r->>'id')::uuid;
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','review','session_id',s,'reason','review not adjustment fixture'));
 if r->>'state'<>'completed' then raise exception 'review failed';end if;
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','review','session_id',s,'reason','duplicate review fixture'));
 if r->>'code'<>'already_completed' then raise exception 'duplicate review allowed';end if;
 -- Retired audit-only paths cannot masquerade as the completed financial workflow.
 begin perform public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','expense_request','amount','1000','expense_type','fixture','reason','retired workflow'));raise exception 'retired expense endpoint accepted';exception when feature_not_supported then null;end;
 begin perform public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','opening_request','amount','100','source','fixture','reason','retired workflow'));raise exception 'retired opening endpoint accepted';exception when feature_not_supported then null;end;
 if finance_private.c6_treasury_balance()<>before_balance then raise exception 'audit changed treasury';end if;
 if exists(select 1 from public.financial_events e join public.financial_operations o on o.id=e.operation_id where o.operation_type like 'c9_%') then raise exception 'audit created financial event';end if;
 -- Permission isolation: admin alone and a driver cannot submit; no role spoof by expected_user.
 update finance_private.c9_permissions set expense=false where user_id=a;
 denied:=false;begin perform public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','expense_request','amount','1','expense_type','test','reason','permission fixture'));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'admin bypassed separate expense permission';end if;
 perform set_config('request.jwt.claim.sub',driver::text,true);
 denied:=false;begin perform public.read_treasury_control(driver);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'driver read treasury';end if;
 denied:=false;begin perform public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','start','reason','wrong expected user'));exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'wrong account accepted';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 -- Isolated TEST FUNDING ONLY: proves signed projection and moving-cut rejection.
 -- This is NOT a C9 opening API, nor proof of C5/C8 integration. It is rolled back below.
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','start','reason','moving cut fixture'));s:=(r->>'id')::uuid;
 op:=finance_private.begin_operation('c9_test_funding',gen_random_uuid(),jsonb_build_object('fixture',true));
 ref_value:=finance_private.register_document('ORD',(f->>'order')::uuid);
 event_value:=finance_private.record_financial_event(ref_value,'c9_test_funding_only',op.id);
 cash:=finance_private.c4_account('treasury_cash');counterpart:=finance_private.c4_account('authorized_suspense_liability');
 perform finance_private.post_journal(event_value,jsonb_build_array(jsonb_build_object('account_id',cash,'side','debit','amount',100.50),jsonb_build_object('account_id',counterpart,'side','credit','amount',100.50)),'isolated fixture not production opening');
 perform finance_private.complete_operation(op.id,jsonb_build_object('state','completed','fixture',true));set constraints all immediate;
 after_balance:=finance_private.c6_treasury_balance();if after_balance<>before_balance+100.50 then raise exception 'signed cash projection failed';end if;
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','count','session_id',s,'amount',trim_scale(after_balance)::text,'reason','reject changed cut'));
 if r->>'code'<>'cash_moved_restart_count' then raise exception 'moving cut accepted';end if;
 perform public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','cancel_count','session_id',s,'reason','restart after movement'));
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','start','reason','shortage fixture'));s:=(r->>'id')::uuid;
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','count','session_id',s,'amount',trim_scale((after_balance-0.50))::text,'reason','short physical count fixture'));
 if (select difference from public.treasury_control_documents where id=(r->>'id')::uuid)<>-0.50 or finance_private.c6_treasury_balance()<>after_balance then raise exception 'shortage was incorrectly posted or calculated';end if;
 r:=public.read_treasury_control(a,'dashboard');if (r->'metrics'->>'treasury')::numeric<>after_balance then raise exception 'dashboard differs from C2';end if;
 r:=public.read_treasury_control(a,'ledger');if jsonb_array_length(r->'rows')=0 or r->'rows'->0->>'state'<>'completed' then raise exception 'posted cash missing';end if;
 select count(*) into doc_count from public.treasury_control_documents;
 begin update public.treasury_control_documents set reason='changed';raise exception 'immutable guard missing';exception when sqlstate '55000' then null;end;
 if (select count(*) from public.treasury_control_documents)<>doc_count then raise exception 'audit changed';end if;
end $$;
-- Explicit deferred failure: flush occurs INSIDE RPC; operation/result/document must all disappear.
create function pg_temp.c9_injected_failure() returns trigger language plpgsql as $$ begin raise exception 'C9 injected deferred fault';end $$;
create constraint trigger c9_injected_fault after insert on public.treasury_control_documents deferrable initially deferred for each row execute function pg_temp.c9_injected_failure();
set constraints all deferred;
do $$ declare a uuid:=(current_setting('c9.test_fixture')::jsonb->>'admin')::uuid;k uuid:=gen_random_uuid();n bigint;begin
 select count(*) into n from public.treasury_control_documents;
 begin perform public.record_treasury_action(a,k,jsonb_build_object('kind','start','reason','fault fixture'));raise exception 'injected fault did not run';
 exception when others then if sqlerrm<>'C9 injected deferred fault' then raise;end if;end;
 if exists(select 1 from public.financial_operations where actor_id=a and attempt_key=k) or (select count(*) from public.treasury_control_documents)<>n then raise exception 'deferred failure did not fully roll back';end if;
end $$;
drop trigger c9_injected_fault on public.treasury_control_documents;
-- SQL role/RLS emulation, not a real Auth HTTP JWT test.
set local role authenticated;
do $$ declare driver uuid:=(current_setting('c9.test_fixture')::jsonb->>'driver')::uuid;begin
 perform set_config('request.jwt.claim.sub',driver::text,true);
 if exists(select 1 from public.treasury_control_documents) then raise exception 'RLS leaked audit documents';end if;
 begin insert into public.treasury_control_documents(kind) values('start');raise exception 'runtime DML allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set constraints all immediate;
rollback;
