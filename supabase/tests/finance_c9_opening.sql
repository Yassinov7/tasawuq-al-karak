-- OWNER-RUN ONLY on a pinned disposable database with ZERO prior treasury cash lines.
-- Existing synthetic admin/approver/owner/driver profiles are required; no users are created.
-- Rollback restores records, NOT sequence numbers. Real concurrent COMMITs are in the harness.
begin;
do $$
declare f jsonb:=current_setting('c9.completion_fixture')::jsonb;a uuid:=(f->>'admin')::uuid;b uuid:=(f->>'approver')::uuid;owner_id uuid:=(f->>'owner')::uuid;
 r jsonb;r2 jsonb;request_id uuid;second_id uuid;key_value uuid:=gen_random_uuid();posted_result jsonb;denied boolean;
begin
 if current_database()!~'_c2_test$' or not exists(select 1 from c2_test_guard.environment where singleton) then raise exception 'disposable marker required';end if;
 if exists(select 1 from finance_private.c9_cash_lines) or exists(select 1 from public.treasury_finance_postings) then raise exception 'fresh treasury required, NOT a skipped test';end if;
 if (select opening_enabled from finance_private.c9_control where singleton) then raise exception 'opening must default OFF';end if;
 if (select account_type from public.financial_account_definitions where code='opening_balance_equity')<>'equity' then raise exception 'opening misclassified';end if;
 insert into finance_private.c9_permissions(user_id,opening,opening_approve,ledger) values(a,true,true,true),(b,false,true,true),(owner_id,false,true,true)
 on conflict(user_id) do update set opening=excluded.opening,opening_approve=excluded.opening_approve,ledger=true;
 insert into finance_private.c9_system_owners(user_id,reason) values(a,'self-approval adversarial owner fixture'),(owner_id,'actual approving owner fixture') on conflict do nothing;
 update finance_private.c9_control set enabled=true where singleton;
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.request_treasury_finance(a,gen_random_uuid(),jsonb_build_object('kind','opening','amount','500.50','reason','documented physical cash fixture','source','synthetic opening cash','cash_date',(clock_timestamp() at time zone 'UTC')::date));request_id:=(r->>'request_id')::uuid;
 r2:=public.request_treasury_finance(a,gen_random_uuid(),jsonb_build_object('kind','opening','amount','1.00','reason','competing request fixture','source','synthetic cash','cash_date',(clock_timestamp() at time zone 'UTC')::date));second_id:=(r2->>'request_id')::uuid;
 if r->>'stage'<>'requested' or r2->>'stage'<>'requested' or finance_private.c6_treasury_balance()<>0 then raise exception 'request created cash';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 r:=public.act_on_treasury_finance(owner_id,gen_random_uuid(),request_id,'approve','closed opening gate',true);if r->>'code'<>'opening_disabled_or_unconfirmed' then raise exception 'opening gate bypass';end if;
 update finance_private.c9_control set opening_enabled=true where singleton;
 r:=public.act_on_treasury_finance(owner_id,gen_random_uuid(),request_id,'approve','missing explicit confirmation',false);if r->>'code'<>'opening_disabled_or_unconfirmed' then raise exception 'missing owner confirmation accepted';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.act_on_treasury_finance(a,gen_random_uuid(),request_id,'approve','owner cannot approve own request',true);if r->>'code'<>'self_approval' then raise exception 'self approval allowed';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 denied:=false;begin perform public.act_on_treasury_finance(b,gen_random_uuid(),request_id,'approve','not mapped system owner',true);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'ordinary admin impersonated owner';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 posted_result:=public.act_on_treasury_finance(owner_id,key_value,request_id,'approve','owner explicitly approves physical opening',true);
 set constraints all immediate;
 if posted_result->>'stage'<>'posted' or left(posted_result->>'reference',4)<>'ADJ-' or finance_private.c6_treasury_balance()<>500.50 then raise exception 'opening posting failed';end if;
 if (select count(*) from public.treasury_finance_postings where kind='opening')<>1 then raise exception 'opening uniqueness failed';end if;
 if not exists(select 1 from public.treasury_finance_postings p join public.financial_document_references f on f.treasury_posting_id=p.id
 join public.financial_events e on e.source_reference_id=f.id join public.journal_entries j on j.event_id=e.id and j.status='posted'
 join public.journal_lines l on l.journal_entry_id=j.id and l.side='credit' and l.amount=500.50
 join public.financial_accounts ac on ac.id=l.account_id and ac.definition_code='opening_balance_equity' where p.request_id=request_id) then raise exception 'opening equity line missing';end if;
 if public.recover_treasury_action(owner_id,key_value) is distinct from posted_result then raise exception 'lost response recovery failed';end if;
 if public.act_on_treasury_finance(owner_id,key_value,request_id,'approve','owner explicitly approves physical opening',true) is distinct from posted_result then raise exception 'same key replay differs';end if;
 r:=public.act_on_treasury_finance(owner_id,gen_random_uuid(),request_id,'approve','different key cannot duplicate opening',true);
 if r->>'posting_id' is distinct from posted_result->>'posting_id' or (select count(*) from public.treasury_finance_postings)<>1 then raise exception 'different key duplicated opening';end if;
 r:=public.act_on_treasury_finance(owner_id,gen_random_uuid(),second_id,'approve','no second opening',true);if r->>'code'<>'opening_after_movements' then raise exception 'second opening accepted';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.request_treasury_finance(a,gen_random_uuid(),jsonb_build_object('kind','opening','amount','1.00','reason','late opening rejected','source','synthetic','cash_date',(clock_timestamp() at time zone 'UTC')::date));if r->>'code'<>'opening_after_movements' then raise exception 'opening request after activity accepted';end if;
 begin update public.treasury_finance_postings set amount=1;raise exception 'opening mutated';exception when sqlstate '55000' then null;end;
end $$;
set constraints all immediate;
rollback;
