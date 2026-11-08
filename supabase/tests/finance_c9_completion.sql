-- MUTATING isolated fixtures only. Requires a posted, nonnegative, sufficiently funded C2 treasury.
-- Does not treat rollback as safe for production: C2 reference sequences may advance.
begin;
do $$
declare f jsonb:=current_setting('c9.completion_fixture')::jsonb;a uuid:=(f->>'admin')::uuid;b uuid:=(f->>'approver')::uuid;owner_id uuid:=(f->>'owner')::uuid;
 balance_value numeric;baseline numeric;r jsonb;rid uuid;cid uuid;adjust_id uuid;k uuid:=gen_random_uuid();prior jsonb;denied boolean;n bigint;
begin
 if current_database()!~'_c2_test$' or not exists(select 1 from c2_test_guard.environment where singleton) then raise exception 'isolated marker required';end if;
 baseline:=finance_private.c6_treasury_balance();if baseline<10.50 then raise exception 'genuine funded synthetic treasury required, do not skip';end if;
 insert into finance_private.c9_permissions(user_id,dashboard,ledger,expense,pay,count_cash,review,adjust,expense_approve,adjust_request,opening,opening_approve)
 values(a,true,true,true,true,true,true,true,true,true,true,false),(b,true,true,true,true,true,true,true,true,true,false,false),(owner_id,true,true,false,true,false,true,true,true,false,false,true)
 on conflict(user_id) do update set dashboard=excluded.dashboard,ledger=excluded.ledger,expense=excluded.expense,pay=excluded.pay,count_cash=excluded.count_cash,review=excluded.review,adjust=excluded.adjust,expense_approve=excluded.expense_approve,adjust_request=excluded.adjust_request,opening=excluded.opening,opening_approve=excluded.opening_approve;
 update finance_private.c9_control set enabled=true where singleton;
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.request_treasury_finance(a,gen_random_uuid(),jsonb_build_object('kind','expense','amount','10.50','expense_type','test operating expense','reason','receipt fixture'));rid:=(r->>'request_id')::uuid;
 if r->>'stage'<>'requested' or finance_private.c6_treasury_balance()<>baseline then raise exception 'request moved cash';end if;
 r:=public.act_on_treasury_finance(a,gen_random_uuid(),rid,'approve','self approval test');if r->>'code'<>'self_approval' then raise exception 'self approval allowed';end if;
 r:=public.act_on_treasury_finance(a,gen_random_uuid(),rid,'pay','cannot pay requested');if r->>'code'<>'invalid_stage' then raise exception 'paid before approval';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 update finance_private.c9_permissions set expense_approve=false where user_id=b;
 denied:=false;begin perform public.act_on_treasury_finance(b,gen_random_uuid(),rid,'approve','admin alone insufficient');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'admin bypassed approval permission';end if;
 update finance_private.c9_permissions set expense_approve=true where user_id=b;
 r:=public.act_on_treasury_finance(b,gen_random_uuid(),rid,'approve','independent approval');if r->>'stage'<>'approved' or finance_private.c6_treasury_balance()<>baseline then raise exception 'approval moved cash';end if;
 prior:=public.act_on_treasury_finance(b,k,rid,'pay','actual cash counted out');set constraints all immediate;
 if prior->>'stage'<>'posted' or left(prior->>'reference',4)<>'PAY-' or finance_private.c6_treasury_balance()<>baseline-10.50 then raise exception 'expense posting wrong';end if;
 if public.recover_treasury_action(b,k) is distinct from prior or public.act_on_treasury_finance(b,k,rid,'pay','actual cash counted out') is distinct from prior then raise exception 'recovery/retry failed';end if;
 r:=public.act_on_treasury_finance(b,gen_random_uuid(),rid,'pay','new key repeat');if r->>'posting_id' is distinct from prior->>'posting_id' then raise exception 'repeated expense';end if;
 r:=public.act_on_treasury_finance(b,gen_random_uuid(),rid,'reject','late rejection cannot undo cash');if r->>'code'<>'invalid_stage' or finance_private.c9_request_state(rid)<>'posted' then raise exception 'posted cash falsely rejected';end if;
 select count(*) into n from public.treasury_finance_postings where request_id=rid;if n<>1 then raise exception 'economic uniqueness missing';end if;
 -- Actual account lines, not only aggregate equality.
 if not exists(select 1 from public.treasury_finance_postings p join public.financial_document_references rf on rf.treasury_posting_id=p.id join public.financial_events e on e.source_reference_id=rf.id
 join public.journal_entries j on j.event_id=e.id and j.status='posted' join public.journal_lines l on l.journal_entry_id=j.id and l.side='debit' and l.amount=10.50
 join public.financial_accounts ac on ac.id=l.account_id and ac.definition_code='office_operating_expense' where p.request_id=rid) then raise exception 'expense debit missing';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.request_treasury_finance(a,gen_random_uuid(),jsonb_build_object('kind','expense','amount',trim_scale((baseline+100))::text,'expense_type','overspend fixture','reason','must remain approved unpaid'));rid:=(r->>'request_id')::uuid;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.act_on_treasury_finance(b,gen_random_uuid(),rid,'approve','approved request not cash');
 balance_value:=finance_private.c6_treasury_balance();r:=public.act_on_treasury_finance(b,gen_random_uuid(),rid,'pay','overspend attempt');
 if r->>'code'<>'insufficient_treasury' or finance_private.c6_treasury_balance()<>balance_value or finance_private.c9_request_state(rid)<>'approved' then raise exception 'overspend changed state/cash';end if;
 -- Surplus -> request -> independent approval and ADJ. Counter and requester must BOTH be excluded.
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','start','reason','surplus fixture'));cid:=(r->>'id')::uuid;
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','count','session_id',cid,'amount',trim_scale((balance_value+1.25))::text,'reason','physical surplus fixture'));cid:=(r->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',b::text,true);
 r:=public.request_treasury_finance(b,gen_random_uuid(),jsonb_build_object('kind','adjustment','count_id',cid,'reason','surplus correction request'));adjust_id:=(r->>'request_id')::uuid;
 r:=public.act_on_treasury_finance(b,gen_random_uuid(),adjust_id,'approve','requester forbidden');if r->>'code'<>'self_approval' then raise exception 'requester approved adjustment';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.act_on_treasury_finance(a,gen_random_uuid(),adjust_id,'approve','counter forbidden');if r->>'code'<>'counter_approval' then raise exception 'counter approved adjustment';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 r:=public.act_on_treasury_finance(owner_id,gen_random_uuid(),adjust_id,'approve','independent correction approval');
 if r->>'stage'<>'posted' or finance_private.c6_treasury_balance()<>balance_value+1.25 or left(r->>'reference',4)<>'ADJ-' then raise exception 'surplus correction wrong';end if;
 if not exists(select 1 from public.treasury_finance_postings p join public.financial_document_references rf on rf.treasury_posting_id=p.id join public.financial_events e on e.source_reference_id=rf.id join public.journal_entries j on j.event_id=e.id
 join public.journal_lines l on l.journal_entry_id=j.id and l.side='credit' and l.amount=1.25 join public.financial_accounts ac on ac.id=l.account_id and ac.definition_code='treasury_cash_overage_income' and ac.owner_user_id is null where p.request_id=adjust_id) then raise exception 'surplus income line missing';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 r:=public.request_treasury_finance(b,gen_random_uuid(),jsonb_build_object('kind','adjustment','count_id',cid,'reason','duplicate correction'));if r->>'code'<>'correction_exists' then raise exception 'duplicate correction allowed';end if;
 -- Shortage is an expense, NEVER an employee receivable.
 balance_value:=finance_private.c6_treasury_balance();perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','start','reason','shortage fixture'));cid:=(r->>'id')::uuid;
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','count','session_id',cid,'amount',trim_scale((balance_value-0.50))::text,'reason','physical shortage fixture'));cid:=(r->>'id')::uuid;
 r:=public.request_treasury_finance(a,gen_random_uuid(),jsonb_build_object('kind','adjustment','count_id',cid,'reason','shortage correction'));adjust_id:=(r->>'request_id')::uuid;
 perform set_config('request.jwt.claim.sub',b::text,true);r:=public.act_on_treasury_finance(b,gen_random_uuid(),adjust_id,'approve','independent shortage approval');
 if r->>'stage'<>'posted' or finance_private.c6_treasury_balance()<>balance_value-0.50 then raise exception 'shortage correction wrong';end if;
 if not exists(select 1 from public.treasury_finance_postings p join public.financial_document_references rf on rf.treasury_posting_id=p.id join public.financial_events e on e.source_reference_id=rf.id join public.journal_entries j on j.event_id=e.id
 join public.journal_lines l on l.journal_entry_id=j.id and l.side='debit' and l.amount=0.50 join public.financial_accounts ac on ac.id=l.account_id and ac.definition_code='treasury_cash_shortage_expense' and ac.owner_user_id is null where p.request_id=adjust_id) then raise exception 'shortage expense line missing';end if;
 -- Even an in/out pair with net zero would invalidate the cut; actual expense here proves staleness.
 balance_value:=finance_private.c6_treasury_balance();perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','start','reason','stale correction fixture'));cid:=(r->>'id')::uuid;
 r:=public.record_treasury_action(a,gen_random_uuid(),jsonb_build_object('kind','count','session_id',cid,'amount',trim_scale((balance_value+0.50))::text,'reason','stale surplus fixture'));cid:=(r->>'id')::uuid;
 r:=public.request_treasury_finance(a,gen_random_uuid(),jsonb_build_object('kind','adjustment','count_id',cid,'reason','freeze original cut'));adjust_id:=(r->>'request_id')::uuid;
 r:=public.request_treasury_finance(a,gen_random_uuid(),jsonb_build_object('kind','expense','amount','0.50','expense_type','moving cash fixture','reason','invalidate correction cut'));rid:=(r->>'request_id')::uuid;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.act_on_treasury_finance(b,gen_random_uuid(),rid,'approve','independent approval');perform public.act_on_treasury_finance(b,gen_random_uuid(),rid,'pay','actual cash movement');
 r:=public.act_on_treasury_finance(b,gen_random_uuid(),adjust_id,'approve','stale count must fail');if r->>'code'<>'stale_count' then raise exception 'stale correction posted';end if;
 -- Reject is a recorded terminal workflow stage, not an unconfirmed cash operation.
 r:=public.act_on_treasury_finance(b,gen_random_uuid(),adjust_id,'reject','repeat physical count required');if r->>'stage'<>'rejected' then raise exception 'rejection not recorded';end if;
 if exists(select 1 from public.treasury_finance_postings p join public.financial_document_references f on f.treasury_posting_id=p.id join public.financial_events e on e.source_reference_id=f.id
 join public.journal_entries j on j.event_id=e.id join public.journal_lines l on l.journal_entry_id=j.id group by j.id having sum(case l.side when 'debit' then l.amount else -l.amount end)<>0) then raise exception 'unbalanced C9 posting';end if;
end $$;
-- Force a DEFERRED posting fault after all normal work, then verify complete transaction-subblock rollback.
create function pg_temp.c9_posting_fault() returns trigger language plpgsql as $$ begin raise exception 'C9 deferred posting fault';end $$;
create constraint trigger c9_test_posting_fault after insert on public.treasury_finance_postings deferrable initially deferred for each row execute function pg_temp.c9_posting_fault();
set constraints all deferred;
do $$ declare f jsonb:=current_setting('c9.completion_fixture')::jsonb;a uuid:=(f->>'admin')::uuid;b uuid:=(f->>'approver')::uuid;r jsonb;rid uuid;k uuid:=gen_random_uuid();before_value numeric;n bigint;begin
 perform set_config('request.jwt.claim.sub',a::text,true);r:=public.request_treasury_finance(a,gen_random_uuid(),jsonb_build_object('kind','expense','amount','0.25','expense_type','fault fixture','reason','rollback cash'));rid:=(r->>'request_id')::uuid;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.act_on_treasury_finance(b,gen_random_uuid(),rid,'approve','approval fixture');
 before_value:=finance_private.c6_treasury_balance();select count(*) into n from public.journal_entries;
 set constraints all deferred;
 begin perform public.act_on_treasury_finance(b,k,rid,'pay','injected posting failure');raise exception 'fault did not execute';exception when others then if sqlerrm<>'C9 deferred posting fault' then raise;end if;end;
 if finance_private.c6_treasury_balance()<>before_value or exists(select 1 from public.financial_operations where actor_id=b and attempt_key=k) or (select count(*) from public.journal_entries)<>n or finance_private.c9_request_state(rid)<>'approved' then raise exception 'partial financial write survived';end if;
end $$;
drop trigger c9_test_posting_fault on public.treasury_finance_postings;
set local role authenticated;
do $$ declare driver uuid:=(current_setting('c9.completion_fixture')::jsonb->>'driver')::uuid;begin
 perform set_config('request.jwt.claim.sub',driver::text,true);
 if exists(select 1 from public.treasury_finance_requests) or exists(select 1 from public.treasury_finance_events) or exists(select 1 from public.treasury_finance_postings) then raise exception 'driver RLS leak';end if;
 begin perform public.request_treasury_finance(driver,gen_random_uuid(),'{"kind":"expense","amount":"1","expense_type":"forbidden","reason":"driver forbidden"}');raise exception 'driver wrote request';exception when insufficient_privilege then null;end;
 begin insert into public.treasury_finance_requests(kind) values('expense');raise exception 'direct DML accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
set constraints all immediate;
rollback;
