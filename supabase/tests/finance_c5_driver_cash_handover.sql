-- MUTATING: pinned disposable LOCAL PostgreSQL with full schema through C5 ONLY.
-- Run via test-finance-c5-postgres.cjs after isolated C4 fixtures. NEVER Supabase.
\set ON_ERROR_STOP on
begin;
select set_config('c5.token',:'test_token',true),set_config('c5.driver',:'driver_user',true),
 set_config('c5.admin',:'admin_user',true),set_config('c5.other',:'other_driver',true),
 set_config('c5.customer',:'customer_user',true),set_config('c5.merchant',:'merchant_user',true);
do $$ begin
 if current_database() !~ '_c2_test$' or to_regclass('c2_test_guard.environment') is null or not coalesce(host(inet_server_addr()) in ('127.0.0.1','::1'),false) then raise exception 'isolated loopback database required'; end if;
 perform 1 from c2_test_guard.environment where singleton and token=current_setting('c5.token')::uuid;
 if not found then raise exception 'test marker mismatch'; end if;
end $$;
create function pg_temp.c5_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'C5 ASSERT: %',message; end if; end $$;
create function pg_temp.c5_reject(statement text,state_value text,message_value text default null) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then
   if sqlstate=state_value and (message_value is null or sqlerrm like message_value) then return; end if;
   raise exception 'unexpected failure %: %',sqlstate,sqlerrm;
 end;
 raise exception 'expected rejection';
end $$;
create function pg_temp.c5_fault() returns trigger language plpgsql as $$
begin if current_setting('c5.fail_line',true)='yes' then raise exception 'injected C5 journal failure'; end if; return new; end $$;
create trigger c5_test_line before insert on public.journal_lines for each row execute function pg_temp.c5_fault();
create function pg_temp.c5_deferred_fault() returns trigger language plpgsql as $$
begin if new.outcome='confirmed' and current_setting('c5.fail_deferred',true)='yes' then raise exception 'injected C5 deferred failure'; end if; return null; end $$;
create constraint trigger c5_test_deferred after insert on public.driver_cash_handover_attempts deferrable initially deferred
for each row execute function pg_temp.c5_deferred_fault();
do $$
declare driver_value uuid:=current_setting('c5.driver')::uuid; admin_value uuid:=current_setting('c5.admin')::uuid;
 key_a uuid:=gen_random_uuid(); key_b uuid:=gen_random_uuid(); key_confirm uuid:=gen_random_uuid(); mismatch_key uuid:=gen_random_uuid();
 req_a uuid; req_b uuid; r jsonb; pos jsonb; baseline numeric; journals bigint; receipts bigint; old_remittances bigint; reference_value text;
begin
 perform set_config('request.jwt.claim.sub',driver_value::text,true);
 perform pg_temp.c5_assert(public.is_approved_driver(),'approved driver fixture');
 pos:=finance_private.c5_position(driver_value); baseline:=(pos->>'remaining')::numeric;
 perform pg_temp.c5_assert(baseline>30 and not (pos->>'ledger_requires_review')::boolean and (pos->>'reserved')::numeric=0 and (pos->>'confirmed')::numeric=0,'real C4 positive custody fixture');
 perform pg_temp.c5_assert((pos->>'collected')::numeric=(select coalesce(sum(amount),0) from public.delivery_collection_results where driver_id=driver_value and kind='cash_delivery'),'C4 full custody includes no wage deduction');
 select count(*) into journals from public.journal_entries;
 select count(*) into receipts from public.financial_document_references where kind='RCT';
 select count(*) into old_remittances from public.driver_cash_remittances;
 update finance_private.c5_rollout set accept_requests=false where singleton;
 r:=public.request_c5_cash_handover(driver_value,gen_random_uuid(),1);
 perform pg_temp.c5_assert(r->>'code'='intake_disabled','default-off admission');
 update finance_private.c5_rollout set accept_requests=true where singleton;
 perform pg_temp.c5_reject(format('select public.request_c5_cash_handover(%L,%L,1)',current_setting('c5.other'),gen_random_uuid()),'42501');
 perform pg_temp.c5_reject(format('select public.request_c5_cash_handover(%L,%L,0.001)',driver_value,gen_random_uuid()),'P0001');
 r:=public.request_c5_cash_handover(driver_value,key_a,10.50); req_a:=(r->>'request_id')::uuid;
 perform pg_temp.c5_assert(r->>'kind'='request','partial handover request');
 perform pg_temp.c5_assert(public.request_c5_cash_handover(driver_value,key_a,10.50)=r,'same key same input request');
 perform pg_temp.c5_reject(format('select public.request_c5_cash_handover(%L,%L,11)',driver_value,key_a),'P0001');
 r:=public.request_c5_cash_handover(driver_value,key_b,7.25); req_b:=(r->>'request_id')::uuid;
 pos:=finance_private.c5_position(driver_value);
 perform pg_temp.c5_assert((pos->>'remaining')::numeric=baseline and (pos->>'reserved')::numeric=17.75 and (pos->>'available')::numeric=baseline-17.75,'multiple reservations, no money moves');
 perform pg_temp.c5_assert((select count(*)=journals from public.journal_entries),'request creates NO treasury journal');
 r:=public.request_c5_cash_handover(driver_value,gen_random_uuid(),baseline-17.75+0.01);
 perform pg_temp.c5_assert(r->>'code'='insufficient_available','cannot overbook pending requests');
 perform pg_temp.c5_reject(format('select public.confirm_c5_cash_handover(%L,%L,%L,%L,10.50)',req_a,driver_value,driver_value,key_confirm),'42501');
 perform set_config('request.jwt.claim.sub',admin_value::text,true);
 perform pg_temp.c5_assert(public.is_admin(),'admin fixture');
 insert into finance_private.c5_cash_receivers(user_id,enabled) values(admin_value,false) on conflict(user_id) do update set enabled=false;
 perform pg_temp.c5_reject(format('select public.confirm_c5_cash_handover(%L,%L,%L,%L,10.50)',req_a,driver_value,admin_value,key_confirm),'42501');
 update finance_private.c5_cash_receivers set enabled=true where user_id=admin_value;
 perform pg_temp.c5_reject(format('select public.confirm_c5_cash_handover(%L,%L,%L,%L,10.50)',req_a,current_setting('c5.other'),admin_value,key_confirm),'42501');
 r:=public.confirm_c5_cash_handover(req_a,driver_value,admin_value,mismatch_key,10.00);
 perform pg_temp.c5_assert(r->>'kind'='discrepancy','count mismatch recorded, not silently settled');
 perform pg_temp.c5_assert(public.confirm_c5_cash_handover(req_a,driver_value,admin_value,mismatch_key,10.00)=r,'mismatch replay');
 perform pg_temp.c5_assert(jsonb_array_length(public.list_c5_cash_requests(admin_value,'review')->'rows')=1,'admin review queue');
 perform pg_temp.c5_assert((finance_private.c5_position(driver_value)->>'reserved')::numeric=17.75,'mismatch retains reservation');
 perform pg_temp.c5_assert((select count(*)=journals from public.journal_entries) and (select count(*)=receipts from public.financial_document_references where kind='RCT'),'no journal or RCT for mismatch');
 perform set_config('c5.fail_line','yes',true);
 perform pg_temp.c5_reject(format('select public.confirm_c5_cash_handover(%L,%L,%L,%L,10.50)',req_a,driver_value,admin_value,key_confirm),'P0001','injected C5 journal failure');
 perform set_config('c5.fail_line','no',true);
 set constraints c5_test_deferred deferred;
 perform set_config('c5.fail_deferred','yes',true);
 perform pg_temp.c5_reject(format('select public.confirm_c5_cash_handover(%L,%L,%L,%L,10.50)',req_a,driver_value,admin_value,key_confirm),'P0001','injected C5 deferred failure');
 perform set_config('c5.fail_deferred','no',true);
 perform pg_temp.c5_assert(not exists(select 1 from public.financial_operations where actor_id=admin_value and attempt_key=key_confirm),'failed confirmation has no committed result');
 perform pg_temp.c5_assert(not exists(select 1 from public.driver_cash_handover_attempts where request_id=req_a and outcome='confirmed'),'failed confirmation leaves no receipt decision');
 perform pg_temp.c5_assert((select count(*)=receipts from public.financial_document_references where kind='RCT') and (select count(*)=journals from public.journal_entries),'failure rolls back RCT, journal and event');
 update finance_private.c5_rollout set accept_requests=false where singleton;
 r:=public.confirm_c5_cash_handover(req_a,driver_value,admin_value,key_confirm,10.50);
 set constraints all immediate;
 reference_value:=r->>'reference';
 perform pg_temp.c5_assert(r->>'kind'='confirmed' and reference_value ~ '^RCT-[0-9]{6,}$','existing request completes while intake closed, with RCT');
 perform pg_temp.c5_assert((select count(*)=2 and sum(case l.side when 'debit' then l.amount else -l.amount end)=0 from public.journal_lines l where journal_entry_id=(r->>'journal_id')::uuid),'balanced two-line transfer');
 perform pg_temp.c5_assert((select sum(l.amount)=10.50 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=(r->>'journal_id')::uuid and l.side='debit' and a.definition_code='treasury_cash'),'treasury increases only at confirmation');
 perform pg_temp.c5_assert((select sum(l.amount)=10.50 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=(r->>'journal_id')::uuid and l.side='credit' and a.definition_code='driver_cash' and a.owner_user_id=driver_value),'driver custody decreases by exact full handover');
 pos:=finance_private.c5_position(driver_value);
 perform pg_temp.c5_assert((pos->>'remaining')::numeric=baseline-10.50 and (pos->>'confirmed')::numeric=10.50 and (pos->>'reserved')::numeric=7.25,'position computed from posted ledger and pending requests');
 perform pg_temp.c5_assert(public.recover_c5_cash_handover(admin_value,key_confirm)->>'reference'=reference_value,'lost response recovery');
 perform pg_temp.c5_assert(public.confirm_c5_cash_handover(req_a,driver_value,admin_value,key_confirm,10.50)->>'reference'=reference_value,'same key confirmation replay');
 perform pg_temp.c5_assert(public.confirm_c5_cash_handover(req_a,driver_value,admin_value,gen_random_uuid(),10.50)->>'reference'=reference_value,'different key cannot repost');
 perform pg_temp.c5_assert(public.confirm_c5_cash_handover(req_a,driver_value,admin_value,gen_random_uuid(),10.00)->>'code'='already_confirmed_different_count','different counted amount cannot rewrite receipt');
 perform pg_temp.c5_assert((select count(*)=journals+1 from public.journal_entries),'one and only one confirmation journal');
 perform pg_temp.c5_assert((select count(*)=old_remittances from public.driver_cash_remittances),'legacy remittances untouched');
 perform set_config('c5.request',req_a::text,true);
end $$;
-- Real PostgreSQL role/claim simulation; NOT a signed JWT/PostgREST test.
do $$ begin execute format('grant usage on schema %I to authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('c5.other'),true);
select pg_temp.c5_assert(not exists(select 1 from public.driver_cash_handover_requests where driver_id=current_setting('c5.driver')::uuid),'foreign driver request RLS');
select pg_temp.c5_assert(not exists(select 1 from public.driver_cash_handover_attempts where driver_id=current_setting('c5.driver')::uuid),'foreign driver receipt RLS');
select pg_temp.c5_reject(format('select public.get_c5_driver_custody(%L,%L)',current_setting('c5.driver'),current_setting('c5.other')),'42501');
select pg_temp.c5_reject('select * from finance_private.c5_rollout','42501');
select pg_temp.c5_reject('insert into public.driver_cash_handover_requests(driver_id,amount,operation_id) values(gen_random_uuid(),1,gen_random_uuid())','42501');
select pg_temp.c5_reject('select finance_private.c5_position(gen_random_uuid())','42501');
select set_config('request.jwt.claim.sub',current_setting('c5.customer'),true);
select pg_temp.c5_assert(not exists(select 1 from public.driver_cash_handover_requests),'customer RLS');
select pg_temp.c5_reject(format('select public.request_c5_cash_handover(%L,%L,1)',current_setting('c5.customer'),gen_random_uuid()),'42501');
select pg_temp.c5_reject(format('select public.list_c5_cash_requests(%L)',current_setting('c5.customer')),'42501');
select set_config('request.jwt.claim.sub',current_setting('c5.merchant'),true);
select pg_temp.c5_assert(not exists(select 1 from public.driver_cash_handover_attempts),'merchant RLS');
select pg_temp.c5_reject(format('select public.get_c5_driver_custody(%L,%L)',current_setting('c5.driver'),current_setting('c5.merchant')),'42501');
select pg_temp.c5_reject(format('select public.confirm_c5_cash_handover(%L,%L,%L,%L,10.50)',current_setting('c5.request'),current_setting('c5.driver'),current_setting('c5.merchant'),gen_random_uuid()),'42501');
reset role;
set constraints all immediate;
rollback;
\echo 'PASS isolated C5 decimal custody/reservations/receipts/failure/RLS assertions; signed JWT and concurrency are separate'
