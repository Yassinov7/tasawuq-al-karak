-- MUTATING: disposable LOCAL schema+C2+C3+all THREE C4 migrations only. NEVER primary Dashboard.
-- Requires c2_test_guard marker, genuinely birth-selected C4 task with exactly TWO ready
-- children and assigned driver; separate approved other_driver; foreign_child.
-- Vars: test_token, admin_user, driver_user, other_driver, task_id, child_a, child_b, foreign_child.
-- Rows roll back; reference sequences can retain gaps. No external hooks allowed.
\set ON_ERROR_STOP on
begin;
select set_config('c4.token',:'test_token',true),set_config('c4.admin',:'admin_user',true),
  set_config('c4.driver',:'driver_user',true),set_config('c4.other',:'other_driver',true),
  set_config('c4.task',:'task_id',true),set_config('c4.a',:'child_a',true),
  set_config('c4.b',:'child_b',true),set_config('c4.foreign',:'foreign_child',true);
do $$ begin
  if current_database() !~ '_c2_test$' or to_regclass('c2_test_guard.environment') is null then
    raise exception 'disposable LOCAL test database required'; end if;
  if not coalesce(host(inet_server_addr()) in ('127.0.0.1','::1'),false) then raise exception 'loopback required'; end if;
  perform 1 from c2_test_guard.environment where singleton and token=current_setting('c4.token')::uuid;
  if not found then raise exception 'test marker mismatch'; end if;
end $$;
create function pg_temp.c4_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'C4 ASSERT: %',message; end if; end $$;
create function pg_temp.c4_reject(statement text,expected text,expected_message text default null) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate=expected and (expected_message is null or sqlerrm like expected_message) then return; end if;
    raise exception 'unexpected SQLSTATE %: %',sqlstate,sqlerrm;
  end;
  raise exception 'expected statement to fail';
end $$;
create function pg_temp.c4_post(reference_id uuid,treasury uuid,advance uuid,debit_amount text,credit_amount text,original_value uuid default null)
returns uuid language plpgsql as $$
declare op public.financial_operations%rowtype; event_value uuid; entry_value uuid;
begin
  op:=finance_private.begin_operation('c4_decimal_test',gen_random_uuid(),jsonb_build_object('debit',debit_amount,'credit',credit_amount));
  event_value:=finance_private.record_financial_event(reference_id,'c4_decimal_test:'||op.id::text,op.id);
  entry_value:=finance_private.post_journal(event_value,jsonb_build_array(
    jsonb_build_object('account_id',treasury,'side','debit','amount',debit_amount),
    jsonb_build_object('account_id',advance,'side','credit','amount',credit_amount)),'isolated C4 decimal check',original_value);
  perform finance_private.complete_operation(op.id,jsonb_build_object('entry',entry_value));
  return entry_value;
end $$;
do $$
declare parent_value uuid; customer_value uuid; treasury uuid; advance uuid; ref_value uuid; entry_value uuid; reverse_value uuid; amount_value text;
begin
  perform set_config('request.jwt.claim.sub',current_setting('c4.admin'),true);
  perform pg_temp.c4_assert(public.is_admin(),'admin fixture');
  select d.customer_order_id,o.customer_id into strict parent_value,customer_value from public.delivery_tasks d
    join public.customer_orders o on o.id=d.customer_order_id where d.id=current_setting('c4.task')::uuid;
  insert into public.financial_accounts(definition_code) values('treasury_cash') on conflict do nothing;
  select id into strict treasury from public.financial_accounts where definition_code='treasury_cash';
  insert into public.financial_accounts(definition_code,owner_user_id) values('customer_advance',customer_value) on conflict do nothing;
  select id into strict advance from public.financial_accounts where definition_code='customer_advance' and owner_user_id=customer_value;
  ref_value:=finance_private.register_document('ORD',parent_value);
  foreach amount_value in array array['100','100.50','0.01'] loop
    entry_value:=pg_temp.c4_post(ref_value,treasury,advance,amount_value,amount_value);
    set constraints all immediate;
    perform pg_temp.c4_assert((select count(*)=2 and min(amount)=amount_value::numeric and max(amount)=amount_value::numeric
      from public.journal_lines where journal_entry_id=entry_value),'major SYP amount unchanged after deferred checks');
  end loop;
  perform pg_temp.c4_reject(format('select pg_temp.c4_post(%L,%L,%L,''0.02'',''0.02'',%L)',ref_value,advance,treasury,entry_value),'P0001');
  reverse_value:=pg_temp.c4_post(ref_value,advance,treasury,'0.01','0.01',entry_value);
  set constraints all immediate;
  perform pg_temp.c4_assert((select reversal_of=entry_value and status='posted' from public.journal_entries where id=reverse_value),'decimal reversal exactly inverts original');
  perform pg_temp.c4_reject(format('select pg_temp.c4_post(%L,%L,%L,''0.01'',''0.01'',%L)',ref_value,advance,treasury,entry_value),'23505');
  perform pg_temp.c4_reject(format('select pg_temp.c4_post(%L,%L,%L,''0.001'',''0.001'')',ref_value,treasury,advance),'23514');
  perform pg_temp.c4_reject(format('select pg_temp.c4_post(%L,%L,%L,''0'',''0'')',ref_value,treasury,advance),'23514');
  perform pg_temp.c4_reject(format('select pg_temp.c4_post(%L,%L,%L,''-1'',''-1'')',ref_value,treasury,advance),'23514');
  perform pg_temp.c4_reject(format('select pg_temp.c4_post(%L,%L,%L,''0.01'',''0.02'')',ref_value,treasury,advance),'P0001');
end $$;
-- Deferred failure injection is local to this rollback-only suite.
create function pg_temp.c4_deferred_failure() returns trigger language plpgsql as $$
begin if current_setting('c4.inject_fault',true)='yes' then raise exception 'injected deferred failure'; end if; return null; end $$;
create constraint trigger c4_test_failure after insert on public.delivery_collection_results
  deferrable initially deferred for each row execute function pg_temp.c4_deferred_failure();
create function pg_temp.c4_line_failure() returns trigger language plpgsql as $$
begin if current_setting('c4.inject_line',true)='yes' then raise exception 'injected journal line failure'; end if; return new; end $$;
create trigger c4_test_line_failure before insert on public.journal_lines for each row execute function pg_temp.c4_line_failure();
create function pg_temp.c4_bypass_delivery(task_value uuid) returns void language plpgsql as $$
begin
  set constraints c4_task_atomic_result deferred;
  update public.delivery_tasks set status='delivered' where id=task_value;
  set constraints all immediate;
end $$;
do $$
declare parent_value uuid; task_value uuid:=current_setting('c4.task')::uuid;
  driver_value uuid:=current_setting('c4.driver')::uuid; child_a uuid:=current_setting('c4.a')::uuid;
  child_b uuid:=current_setting('c4.b')::uuid; journal_count bigint; approved numeric; version_value bigint;
  key_value uuid:=gen_random_uuid(); second_key uuid:=gen_random_uuid(); result_value jsonb; old_count bigint;
begin
  select customer_order_id into strict parent_value from public.delivery_tasks where id=task_value and status='accepted' and driver_id=driver_value;
  perform pg_temp.c4_assert(finance_private.c4_is_order(parent_value),'birth-selected C4 fixture, never manually converted');
  perform pg_temp.c4_assert(exists(select 1 from public.store_orders where id=current_setting('c4.foreign')::uuid
    and customer_order_id<>parent_value),'foreign child must ACTUALLY exist under a different parent');
  perform pg_temp.c4_assert(child_a<>child_b and (select count(*)=2 from public.store_orders where customer_order_id=parent_value
    and status not in ('rejected','cancelled')),'exactly two active children');
  perform pg_temp.c4_assert((select count(*)=2 from public.store_orders where id in(child_a,child_b)
    and customer_order_id=parent_value and status='ready_for_pickup'),'two ready fixture children');
  select total,version into strict approved,version_value from public.order_pricing_current where customer_order_id=parent_value and not review_required;
  select count(*) into journal_count from public.journal_entries;
  update finance_private.c4_rollout set accept_new_orders=false where singleton; -- must NOT strand an admitted C4 task
  perform set_config('request.jwt.claim.sub',current_setting('c4.other'),true);
  perform pg_temp.c4_assert(public.is_approved_driver(),'other approved driver fixture');
  perform pg_temp.c4_reject(format('select public.confirm_c4_store_pickup(%L,%L,%L)',task_value,child_a,current_setting('c4.other')),'42501');
  perform pg_temp.c4_reject(format('select public.complete_delivery_and_collect_cash(%L,%L,%L,%s)',task_value,current_setting('c4.other'),key_value,version_value),'42501');
  perform set_config('request.jwt.claim.sub',driver_value::text,true);
  perform pg_temp.c4_reject(format('select public.confirm_c4_store_pickup(%L,%L,%L)',task_value,current_setting('c4.foreign'),driver_value),'P0001');
  perform pg_temp.c4_reject(format('select public.update_delivery_task_status(%L,''picked_up'')',parent_value),'P0001');
  perform public.confirm_c4_store_pickup(task_value,child_a,driver_value);
  perform pg_temp.c4_assert((select status='accepted' from public.delivery_tasks where id=task_value),'one receipt cannot finish pickup');
  perform pg_temp.c4_reject(format('update public.delivery_tasks set driver_id=%L where id=%L',current_setting('c4.other'),task_value),'P0001');
  perform public.confirm_c4_store_pickup(task_value,child_b,driver_value);
  perform pg_temp.c4_assert((select status='picked_up' from public.delivery_tasks where id=task_value),'all pickups advance once');
  perform pg_temp.c4_reject(format('select public.confirm_c4_store_pickup(%L,%L,%L)',task_value,child_a,driver_value),'23505');
  perform pg_temp.c4_reject(format('select public.update_delivery_task_status(%L,''delivered'')',parent_value),'P0001');
  perform pg_temp.c4_reject(format('select pg_temp.c4_bypass_delivery(%L)',task_value),'P0001','C4 delivery requires its committed atomic cash result');
  update public.order_pricing_current set review_required=true where customer_order_id=parent_value;
  result_value:=public.complete_delivery_and_collect_cash(task_value,driver_value,second_key,version_value);
  perform pg_temp.c4_assert(result_value->>'code'='pricing_review','pricing review durably rejects');
  update public.order_pricing_current set review_required=false where customer_order_id=parent_value;
  perform pg_temp.c4_assert(public.complete_delivery_and_collect_cash(task_value,driver_value,second_key,version_value)=result_value,'rejected key remains rejected');
  -- A deferred failure after journaling must remove status, operation, result, events and lines together.
  perform set_config('c4.inject_line','yes',true);
  perform pg_temp.c4_reject(format('select public.complete_delivery_and_collect_cash(%L,%L,%L,%s)',task_value,driver_value,key_value,version_value),'P0001','injected journal line failure');
  perform pg_temp.c4_assert((select status='picked_up' from public.delivery_tasks where id=task_value),'journal failure rolls back status');
  perform pg_temp.c4_assert((select count(*)=journal_count from public.journal_entries),'journal failure leaves no entries');
  perform set_config('c4.inject_line','no',true);
  set constraints c4_test_failure deferred;
  perform set_config('c4.inject_fault','yes',true);
  perform pg_temp.c4_reject(format('select public.complete_delivery_and_collect_cash(%L,%L,%L,%s)',task_value,driver_value,key_value,version_value),'P0001','injected deferred failure');
  perform pg_temp.c4_assert((select status='picked_up' from public.delivery_tasks where id=task_value),'deferred failure rolls delivery back');
  perform pg_temp.c4_assert(not exists(select 1 from public.delivery_collection_results where task_id=task_value),'no false receipt');
  perform pg_temp.c4_assert(not exists(select 1 from public.financial_operations where actor_id=driver_value and attempt_key=key_value),'no committed pending/false completed operation');
  perform pg_temp.c4_assert((select count(*)=journal_count from public.journal_entries),'no financial residue');
  perform set_config('c4.inject_fault','no',true);
  result_value:=public.complete_delivery_and_collect_cash(task_value,driver_value,key_value,version_value);
  set constraints all immediate;
  perform pg_temp.c4_assert(result_value->>'state'='completed' and (result_value->>'amount')::numeric=approved,'current C3 total collected');
  perform pg_temp.c4_assert((select count(*)=journal_count+2 from public.journal_entries),'exactly two economic journals');
  perform pg_temp.c4_assert(not exists(select 1 from public.journal_entries j join public.financial_events e on e.id=j.event_id
    where e.operation_id=(result_value->>'operation_id')::uuid and
      (select sum(case when l.side='debit' then l.amount else -l.amount end) from public.journal_lines l where l.journal_entry_id=j.id)<>0),'each cash/delivery journal balances');
  perform pg_temp.c4_assert((select sum(case when l.side='debit' then l.amount else -l.amount end)=0
    from public.journal_lines l join public.financial_accounts a on a.id=l.account_id join public.journal_entries j on j.id=l.journal_entry_id
    join public.financial_events e on e.id=j.event_id where e.operation_id=(result_value->>'operation_id')::uuid
      and a.definition_code='customer_advance'),'advance clears in the same operation');

  perform pg_temp.c4_assert((select sum(l.amount)=approved from public.journal_lines l join public.financial_accounts a on a.id=l.account_id
    join public.journal_entries j on j.id=l.journal_entry_id where j.event_id=(result_value->>'cash_event_id')::uuid
    and a.definition_code='driver_cash' and l.side='debit'),'FULL custody, no wage deduction');
  perform pg_temp.c4_assert(not exists(select 1 from public.customer_order_cash_obligations where customer_order_id=parent_value),'no legacy customer obligation');
  perform pg_temp.c4_assert(not exists(select 1 from public.driver_delivery_fee_entitlements where customer_order_id=parent_value),'no legacy driver entitlement');
  perform pg_temp.c4_assert(not exists(select 1 from public.merchant_order_entitlements e join public.store_orders s on s.id=e.store_order_id where s.customer_order_id=parent_value),'no legacy merchant entitlement');
  perform pg_temp.c4_assert(not exists(select 1 from public.store_order_commissions c join public.store_orders s on s.id=c.store_order_id where s.customer_order_id=parent_value and c.status='due'),'snapshots retained but not legacy accrued');
  perform pg_temp.c4_assert(public.recover_delivery_collection(key_value,driver_value)->>'state'='completed','lost response recovery');
  perform pg_temp.c4_assert(public.complete_delivery_and_collect_cash(task_value,driver_value,key_value,version_value)->>'state'='completed','same key replay');
  perform pg_temp.c4_assert(public.complete_delivery_and_collect_cash(task_value,driver_value,gen_random_uuid(),version_value)->>'state'='completed','different key cannot repeat collection');
  perform pg_temp.c4_reject(format('select public.complete_delivery_and_collect_cash(%L,%L,%L,%s)',task_value,driver_value,key_value,version_value+1),'P0001');
  perform pg_temp.c4_assert((select count(*)=journal_count+2 from public.journal_entries),'replays do not repost');
end $$;
-- Real PostgreSQL role/claim simulation, NOT a signed-JWT/network acceptance test.
do $$ begin execute format('grant usage on schema %I to authenticated',
  (select nspname from pg_namespace where oid=pg_my_temp_schema())); end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('c4.other'),true);
select pg_temp.c4_assert((select count(*)=0 from public.delivery_collection_results where task_id=current_setting('c4.task')::uuid),'other driver collection RLS');
select pg_temp.c4_assert((select count(*)=0 from public.delivery_store_pickups where task_id=current_setting('c4.task')::uuid),'other driver RLS');
select pg_temp.c4_assert(public.get_c4_pickup_context(array[current_setting('c4.task')::uuid],current_setting('c4.other')::uuid)='{}'::jsonb,'other driver RPC projection');
select pg_temp.c4_reject('insert into public.delivery_pickup_workflows(task_id,customer_order_id,driver_id) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid())','42501');
select pg_temp.c4_reject('select * from finance_private.c4_rollout','42501');
reset role;
set constraints all immediate;
rollback;
\echo 'PASS isolated C4 decimal/pickup/atomic rollback assertions; real COMMIT/concurrency requires guarded harness'
