-- ONLY a disposable local database with the complete preceding schema and C2.
-- Requires synthetic fixtures, not real customer data. Missing fixtures FAIL.
-- psql -v ON_ERROR_STOP=1 -v admin_user=... -v driver_user=...
--   -v order_id=... -v other_order_id=... -v child_id=... -v task_id=...
--   -v other_child_id=... -v other_task_id=... -f this-file
--   -v no_task_order_id=... (must have no DLV row at all)
-- Rolls back all rows. PostgreSQL sequences can retain gaps after rollback.
\set ON_ERROR_STOP on
begin;
select set_config('c2.admin', :'admin_user', true), set_config('c2.driver', :'driver_user', true),
  set_config('c2.order', :'order_id', true), set_config('c2.other_order', :'other_order_id', true),
  set_config('c2.child', :'child_id', true), set_config('c2.task', :'task_id', true),
  set_config('c2.other_child', :'other_child_id', true), set_config('c2.other_task', :'other_task_id', true),
  set_config('c2.no_task_order', :'no_task_order_id', true);

create function pg_temp.c2_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'C2 ASSERT: %', message; end if;
end;
$$;

create function pg_temp.c2_post(source_id uuid, event_name text, lines_value jsonb)
returns uuid language plpgsql as $$
declare operation_row public.financial_operations%rowtype; event_id uuid; entry_id uuid;
begin
  operation_row := finance_private.begin_operation(event_name,gen_random_uuid(),jsonb_build_object('lines',lines_value));
  event_id := finance_private.record_financial_event(source_id,event_name,operation_row.id);
  entry_id := finance_private.post_journal(event_id,lines_value,'C2 isolated accounting example');
  perform finance_private.complete_operation(operation_row.id,jsonb_build_object('entry_id',entry_id));
  return entry_id;
end;
$$;
create function pg_temp.c2_reject(statement text, expected_state text, expected_message text default null)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state and (expected_message is null or position(expected_message in sqlerrm)>0) then return; end if;
    raise exception 'unexpected SQLSTATE %, expected %: %', sqlstate, expected_state, sqlerrm;
  end;
  raise exception 'expected failure: %', statement;
end;
$$;

do $$
declare
  admin_id uuid := current_setting('c2.admin')::uuid;
  order_id_value uuid := current_setting('c2.order')::uuid;
  ref_id uuid; operation_row public.financial_operations%rowtype;
  retry_row public.financial_operations%rowtype;
  event_id uuid; entry_id uuid; reverse_id uuid; bad_event uuid;
  treasury uuid; advance uuid; customer_id uuid; merchant_id_value uuid;
  first_event uuid; second_event uuid; public_ref text; lines jsonb;
begin
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform pg_temp.c2_assert(public.is_admin(), 'admin fixture required');
  select co.customer_id into customer_id from public.customer_orders co where co.id = order_id_value;
  select s.merchant_id into merchant_id_value from public.store_orders so join public.stores s on s.id = so.store_id
    where so.id = current_setting('c2.child')::uuid and so.customer_order_id = order_id_value;
  perform pg_temp.c2_assert(customer_id is not null and merchant_id_value is not null, 'owned synthetic order/child fixtures required');
  perform pg_temp.c2_assert(exists(select 1 from public.profiles where id = current_setting('c2.driver')::uuid and role = 'driver'), 'driver fixture required');
  perform pg_temp.c2_assert(exists(select 1 from public.delivery_tasks where id = current_setting('c2.task')::uuid and customer_order_id = order_id_value), 'task fixture required');
  perform pg_temp.c2_assert(exists(select 1 from public.store_orders where id = current_setting('c2.other_child')::uuid and customer_order_id = current_setting('c2.other_order')::uuid), 'foreign child fixture required');
  perform pg_temp.c2_assert(exists(select 1 from public.delivery_tasks where id = current_setting('c2.other_task')::uuid and customer_order_id = current_setting('c2.other_order')::uuid), 'foreign task fixture required');
  perform pg_temp.c2_assert(order_id_value <> current_setting('c2.other_order')::uuid, 'distinct parents required');
  perform pg_temp.c2_assert(not exists(select 1 from public.order_lifecycle_events where customer_order_id=order_id_value), 'unused synthetic timeline required');
  perform pg_temp.c2_assert(exists(select 1 from public.customer_orders where id=current_setting('c2.no_task_order')::uuid)
    and not exists(select 1 from public.delivery_tasks where customer_order_id=current_setting('c2.no_task_order')::uuid), 'real no-DLV fixture required');

  ref_id := finance_private.register_document('ORD', order_id_value);
  perform pg_temp.c2_assert(finance_private.register_document('ORD', order_id_value) = ref_id, 'reference retry must recover');
  perform pg_temp.c2_reject(format('update public.financial_document_references set public_reference=''ORD-999999'' where id=%L', ref_id), '55000');
  perform pg_temp.c2_reject('select finance_private.register_document(''INV'', gen_random_uuid())', 'P0001');
  insert into public.financial_document_references(kind,document_id,store_order_id,reference_number,public_reference)
  values ('SUB',current_setting('c2.child')::uuid,current_setting('c2.child')::uuid,0,'SUB-000000')
  returning public_reference into public_ref;
  perform pg_temp.c2_assert(public_ref<>'SUB-000000','caller cannot choose reference');
  -- setval is nontransactional; do not use it in a rollback-only test.
  perform pg_temp.c2_assert(lpad('1000000', greatest(6,length('1000000')), '0') = '1000000', 'reference width');

  insert into public.financial_accounts(definition_code) values ('treasury_cash') returning id into treasury;
  insert into public.financial_accounts(definition_code, owner_user_id) values ('customer_advance',customer_id) returning id into advance;
  perform pg_temp.c2_reject('insert into public.financial_accounts(definition_code) values (''driver_cash'')', 'P0001');
  perform pg_temp.c2_reject(format('insert into public.financial_accounts(definition_code,owner_user_id) values (''driver_cash'',%L)',customer_id), 'P0001');

  operation_row := finance_private.begin_operation('c2_test', gen_random_uuid(), '{"amount":"110000"}');
  perform set_config('c2.operation_key',operation_row.attempt_key::text,true);
  retry_row := finance_private.begin_operation('c2_test', operation_row.attempt_key, '{"amount":"110000"}');
  perform pg_temp.c2_assert(retry_row.id = operation_row.id, 'attempt replay');
  perform pg_temp.c2_reject(format('select finance_private.begin_operation(''c2_test'',%L,''{"amount":"1"}'')',operation_row.attempt_key), 'P0001');
  event_id := finance_private.record_financial_event(ref_id,'c2_test_receipt',operation_row.id);
  lines := jsonb_build_array(jsonb_build_object('account_id',treasury,'side','debit','amount','110000'),
    jsonb_build_object('account_id',advance,'side','credit','amount','110000'));
  entry_id := finance_private.post_journal(event_id,lines,'C2 synthetic receipt');
  perform finance_private.complete_operation(operation_row.id,jsonb_build_object('entry_id',entry_id));
  perform pg_temp.c2_assert((select count(*)=1 from public.get_c2_financial_operation(operation_row.attempt_key)), 'lost response recovery');
  perform pg_temp.c2_assert((select r.kind='TXN' and r.document_id=entry_id from public.journal_entries j
    join public.financial_document_references r on r.id=j.reference_id where j.id=entry_id), 'TXN binding');
  perform pg_temp.c2_reject(format('update public.journal_entries set status=''building'',posted_at=null where id=%L',entry_id), 'P0001');
  perform pg_temp.c2_reject(format('update public.journal_entries set reason=''changed'' where id=%L',entry_id), 'P0001');
  perform pg_temp.c2_reject(format('delete from public.journal_lines where journal_entry_id=%L',entry_id), 'P0001');
  perform pg_temp.c2_reject(format('select finance_private.post_journal(%L,%L::jsonb,''duplicate'')',event_id,lines), '23505');

  retry_row := finance_private.begin_operation('c2_test',gen_random_uuid(),'{}');
  perform pg_temp.c2_assert(finance_private.record_financial_event(ref_id,'c2_test_receipt',retry_row.id)=event_id,'new attempt cannot duplicate economic event');
  perform finance_private.complete_operation(retry_row.id,jsonb_build_object('entry_id',entry_id));

  operation_row := finance_private.begin_operation('c2_reverse',gen_random_uuid(),'{}');
  event_id := finance_private.record_financial_event(ref_id,'c2_test_reverse',operation_row.id);
  reverse_id := finance_private.post_journal(event_id,jsonb_build_array(
    jsonb_build_object('account_id',treasury,'side','credit','amount','110000'),
    jsonb_build_object('account_id',advance,'side','debit','amount','110000')), 'C2 exact reversal',entry_id);
  perform finance_private.complete_operation(operation_row.id,jsonb_build_object('entry_id',reverse_id));
  perform pg_temp.c2_assert((select reversal_of=entry_id from public.journal_entries where id=reverse_id),'reversal link');

  operation_row := finance_private.begin_operation('c2_bad',gen_random_uuid(),'{}');
  -- The attempt survives; the economic event and any lines live in a savepoint.
  begin
  bad_event := finance_private.record_financial_event(ref_id,'c2_test_invalid',operation_row.id);
  perform pg_temp.c2_reject(format('select finance_private.post_journal(%L,''[]'',''empty'')',bad_event),'P0001');
  perform pg_temp.c2_reject(format('select finance_private.post_journal(%L,%L::jsonb,''fraction'')',bad_event,
    jsonb_build_array(jsonb_build_object('account_id',treasury,'side','debit','amount','1.5'),jsonb_build_object('account_id',advance,'side','credit','amount','1.5'))),'23514');
  perform pg_temp.c2_reject(format('select finance_private.post_journal(%L,%L::jsonb,''negative'')',bad_event,
    jsonb_build_array(jsonb_build_object('account_id',treasury,'side','debit','amount','-1'),jsonb_build_object('account_id',advance,'side','credit','amount','-1'))),'23514');
  perform pg_temp.c2_reject(format('select finance_private.post_journal(%L,%L::jsonb,''unbalanced'')',bad_event,
    jsonb_build_array(jsonb_build_object('account_id',treasury,'side','debit','amount','2'),jsonb_build_object('account_id',advance,'side','credit','amount','1'))),'P0001');
  perform pg_temp.c2_reject(format('select finance_private.complete_operation(%L,''{"rejected":true}'')',operation_row.id),
    'P0001','financial event requires a posted journal');
  perform pg_temp.c2_reject('set constraints public.financial_event_complete immediate',
    'P0001','financial event cannot commit without');
  -- Bypass the helper as the DB owner: deferred triggers must still reject it.
  perform pg_temp.c2_reject(format('insert into public.journal_entries(event_id,reason) values (%L,''unfinished''); set constraints public.journal_entry_complete immediate',bad_event),
    'P0001','journal must be posted and balanced');
  perform pg_temp.c2_reject(format('insert into public.journal_entries(event_id,reason) values (%L,''empty posted''); update public.journal_entries set status=''posted'' where event_id=%L; set constraints public.journal_entry_complete immediate',bad_event,bad_event),
    'P0001','journal must be posted and balanced');
  perform pg_temp.c2_reject(format($q$
    insert into public.journal_entries(event_id,reason) values (%L,'direct nonempty unbalanced');
    insert into public.journal_lines(journal_entry_id,line_number,account_id,side,amount)
      select id,1,%L,'debit',2 from public.journal_entries where event_id=%L;
    insert into public.journal_lines(journal_entry_id,line_number,account_id,side,amount)
      select id,2,%L,'credit',1 from public.journal_entries where event_id=%L;
    update public.journal_entries set status='posted' where event_id=%L;
    set constraints public.journal_entry_complete immediate;
  $q$,bad_event,treasury,bad_event,advance,bad_event,bad_event),'P0001','journal must be posted and balanced');
  raise exception using errcode='ZC201',message='rollback failed economic event only';
  exception when sqlstate 'ZC201' then null;
  end;
  perform pg_temp.c2_assert(not exists(select 1 from public.financial_events where source_reference_id=ref_id and event_type='c2_test_invalid'),'failed event rolled back');
  perform finance_private.complete_operation(operation_row.id,'{"rejected":true}',true);
  retry_row := finance_private.begin_operation('c2_bad',operation_row.attempt_key,'{}');
  perform pg_temp.c2_assert(retry_row.state='rejected','rejected result replay');
  retry_row := finance_private.begin_operation('c2_bad',gen_random_uuid(),'{}');
  bad_event := finance_private.record_financial_event(ref_id,'c2_test_invalid',retry_row.id);
  reverse_id := finance_private.post_journal(bad_event,lines,'successful retry after rejection');
  perform finance_private.complete_operation(retry_row.id,jsonb_build_object('entry_id',reverse_id));
  retry_row := finance_private.begin_operation('c2_bad',retry_row.attempt_key,'{}');
  perform pg_temp.c2_assert(retry_row.state='completed' and retry_row.result->>'entry_id'=reverse_id::text,'success/lost-response replay');

  -- A balanced reversal using the wrong accounts must fail, independently of totals.
  retry_row := finance_private.begin_operation('c2_wrong_reverse',gen_random_uuid(),'{}');
  begin
    bad_event := finance_private.record_financial_event(ref_id,'c2_wrong_reverse',retry_row.id);
    perform pg_temp.c2_reject(format('select finance_private.post_journal(%L,%L::jsonb,''wrong reversal'',%L)',bad_event,lines,reverse_id),
      'P0001','reversal must exactly invert');
    raise exception using errcode='ZC201',message='rollback invalid reversal event';
  exception when sqlstate 'ZC201' then null;
  end;
  perform finance_private.complete_operation(retry_row.id,'{"rejected":true}',true);
  retry_row := finance_private.begin_operation('c2_retry_reverse',gen_random_uuid(),'{}');
  bad_event := finance_private.record_financial_event(ref_id,'c2_retry_reverse',retry_row.id);
  reverse_id := finance_private.post_journal(bad_event,jsonb_build_array(
    jsonb_build_object('account_id',treasury,'side','credit','amount','110000'),
    jsonb_build_object('account_id',advance,'side','debit','amount','110000')),'close synthetic retry',reverse_id);
  perform finance_private.complete_operation(retry_row.id,jsonb_build_object('entry_id',reverse_id));

  first_event := finance_private.append_lifecycle_event(order_id_value,current_setting('c2.child')::uuid,current_setting('c2.task')::uuid,
    'c2_test','awaiting_review','preparing','c2_sql_test','c2:first');
  perform pg_temp.c2_assert(first_event=finance_private.append_lifecycle_event(order_id_value,current_setting('c2.child')::uuid,current_setting('c2.task')::uuid,
    'c2_test','awaiting_review','preparing','c2_sql_test','c2:first'),'timeline replay');
  second_event := finance_private.append_lifecycle_event(order_id_value,null,null,'c2_correction',null,null,'c2_sql_test','c2:correction','corrected metadata',first_event);
  perform pg_temp.c2_assert((select correction_of=first_event and order_sequence=2 and actor_id=admin_id and occurred_at<=clock_timestamp()
    from public.order_lifecycle_events where id=second_event),'server time/actor/order/correction');
  perform pg_temp.c2_reject(format('update public.order_lifecycle_events set occurred_at=now() where id=%L',first_event),'55000');
  perform pg_temp.c2_reject(format('select finance_private.append_lifecycle_event(%L,%L,null,''bad'',null,null,''test'',''bad-child'')',
    order_id_value,current_setting('c2.other_child')),'P0001');
  perform pg_temp.c2_reject(format('select finance_private.append_lifecycle_event(%L,null,%L,''bad'',null,null,''test'',''bad-task'')',
    order_id_value,current_setting('c2.other_task')),'P0001');
  insert into public.order_lifecycle_events(customer_order_id,event_type,operation_source,natural_key,
    order_sequence,occurred_at,actor_id,actor_role)
  values (order_id_value,'c2_stamp_test','c2_sql_test','c2:stamp',999,'1970-01-01T00:00:00Z',customer_id,'customer')
  returning id into second_event;
  perform pg_temp.c2_assert((select order_sequence=3 and actor_id=admin_id and actor_role='admin'
    and occurred_at>'2026-01-01T00:00:00Z'::timestamptz from public.order_lifecycle_events where id=second_event),'server replaces forged time/actor/sequence');
  first_event := finance_private.append_lifecycle_event(current_setting('c2.no_task_order')::uuid,null,null,
    'c2_without_task',null,null,'c2_sql_test','c2:no-task');
  perform pg_temp.c2_assert((select delivery_task_id is null from public.order_lifecycle_events where id=first_event),'timeline before DLV exists');
end;
$$;

-- ALTER SEQUENCE RESTART is transactional. The inner rollback restores it.
-- This file is for guarded disposable LOCAL testing only, never the main project.
do $$
declare generated_ref text;
begin
  begin
    alter sequence finance_private.inv_reference_seq restart with 1000000;
    select public_reference into generated_ref from finance_private.next_reference('INV');
    perform pg_temp.c2_assert(generated_ref='INV-1000000','real generator beyond six digits');
    raise exception using errcode='ZC202',message='restore test sequence restart';
  exception when sqlstate 'ZC202' then null;
  end;
end;
$$;

-- The exact C1 examples, in real journal rows, without invoking business RPCs.
do $$
declare
  source_id uuid; treasury uuid; advance uuid; driver_cash uuid; driver_payable uuid;
  first_payable uuid; second_payable uuid; delivery_income uuid; commission_income uuid;
  wage_expense uuid; subscription_debt uuid; subscription_income uuid;
  customer_id_value uuid; first_merchant uuid; second_merchant uuid; account_row record;
begin
  select id into source_id from public.financial_document_references where kind='ORD' and document_id=current_setting('c2.order')::uuid;
  select id into treasury from public.financial_accounts where definition_code='treasury_cash';
  select co.customer_id into customer_id_value from public.customer_orders co where co.id=current_setting('c2.order')::uuid;
  select id into advance from public.financial_accounts where definition_code='customer_advance' and owner_user_id=customer_id_value;
  select s.merchant_id into first_merchant from public.store_orders so join public.stores s on s.id=so.store_id where so.id=current_setting('c2.child')::uuid;
  select s.merchant_id into second_merchant from public.store_orders so join public.stores s on s.id=so.store_id where so.id=current_setting('c2.other_child')::uuid;
  perform pg_temp.c2_assert(first_merchant<>second_merchant,'two distinct merchant fixtures required');
  insert into public.financial_accounts(definition_code,owner_user_id) values ('driver_cash',current_setting('c2.driver')::uuid) returning id into driver_cash;
  insert into public.financial_accounts(definition_code,owner_user_id) values ('driver_earnings_payable',current_setting('c2.driver')::uuid) returning id into driver_payable;
  insert into public.financial_accounts(definition_code,merchant_id) values ('merchant_sales_payable',first_merchant) returning id into first_payable;
  insert into public.financial_accounts(definition_code,merchant_id) values ('merchant_sales_payable',second_merchant) returning id into second_payable;
  insert into public.financial_accounts(definition_code) values ('delivery_revenue') returning id into delivery_income;
  insert into public.financial_accounts(definition_code) values ('commission_revenue') returning id into commission_income;
  insert into public.financial_accounts(definition_code) values ('driver_earnings_expense') returning id into wage_expense;
  insert into public.financial_accounts(definition_code,merchant_id) values ('subscription_receivable',first_merchant) returning id into subscription_debt;
  insert into public.financial_accounts(definition_code) values ('subscription_revenue') returning id into subscription_income;

  perform pg_temp.c2_post(source_id,'c2_example_collection',jsonb_build_array(
    jsonb_build_object('account_id',driver_cash,'side','debit','amount','110000'),
    jsonb_build_object('account_id',advance,'side','credit','amount','110000')));
  perform pg_temp.c2_post(source_id,'c2_example_delivery',jsonb_build_array(
    jsonb_build_object('account_id',advance,'side','debit','amount','110000'),
    jsonb_build_object('account_id',first_payable,'side','credit','amount','60000'),
    jsonb_build_object('account_id',second_payable,'side','credit','amount','40000'),
    jsonb_build_object('account_id',delivery_income,'side','credit','amount','10000')));
  perform pg_temp.c2_post(source_id,'c2_example_commission',jsonb_build_array(
    jsonb_build_object('account_id',first_payable,'side','debit','amount','6000'),
    jsonb_build_object('account_id',second_payable,'side','debit','amount','4000'),
    jsonb_build_object('account_id',commission_income,'side','credit','amount','10000')));
  perform pg_temp.c2_post(source_id,'c2_example_wage',jsonb_build_array(
    jsonb_build_object('account_id',wage_expense,'side','debit','amount','7000'),
    jsonb_build_object('account_id',driver_payable,'side','credit','amount','7000')));
  perform pg_temp.c2_post(source_id,'c2_example_remit_partial',jsonb_build_array(
    jsonb_build_object('account_id',treasury,'side','debit','amount','60000'),
    jsonb_build_object('account_id',driver_cash,'side','credit','amount','60000')));
  perform pg_temp.c2_assert((select sum(case side when 'debit' then amount else -amount end)=50000 from public.journal_lines where account_id=driver_cash),'full cash custody minus partial remittance, no wage deduction');
  perform pg_temp.c2_post(source_id,'c2_example_remit_final',jsonb_build_array(
    jsonb_build_object('account_id',treasury,'side','debit','amount','50000'),
    jsonb_build_object('account_id',driver_cash,'side','credit','amount','50000')));
  perform pg_temp.c2_post(source_id,'c2_example_payout',jsonb_build_array(
    jsonb_build_object('account_id',first_payable,'side','debit','amount','54000'),
    jsonb_build_object('account_id',second_payable,'side','debit','amount','36000'),
    jsonb_build_object('account_id',driver_payable,'side','debit','amount','7000'),
    jsonb_build_object('account_id',treasury,'side','credit','amount','97000')));
  perform pg_temp.c2_assert((select sum(case side when 'debit' then amount else -amount end)=13000 from public.journal_lines where account_id=treasury),'treasury 13000');
  perform pg_temp.c2_post(source_id,'c2_example_subscription_invoice',jsonb_build_array(
    jsonb_build_object('account_id',subscription_debt,'side','debit','amount','30000'),
    jsonb_build_object('account_id',subscription_income,'side','credit','amount','30000')));
  perform pg_temp.c2_post(source_id,'c2_example_subscription_receipt',jsonb_build_array(
    jsonb_build_object('account_id',treasury,'side','debit','amount','30000'),
    jsonb_build_object('account_id',subscription_debt,'side','credit','amount','30000')));
  perform pg_temp.c2_assert((select sum(case side when 'credit' then amount else -amount end)=30000 from public.journal_lines where account_id=subscription_income),'subscription revenue exactly once');
  for account_row in select id from public.financial_accounts where id in (driver_cash,driver_payable,first_payable,second_payable,advance,subscription_debt) loop
    perform pg_temp.c2_assert((select sum(case side when 'debit' then amount else -amount end)=0 from public.journal_lines where account_id=account_row.id),'example account closed');
  end loop;
end;
$$;
-- Force deferred balance, reference-FK and operation completion checks now.
set constraints all immediate;
set constraints all deferred;
-- The entry point explicitly defers only its required construction constraints.
set constraints all immediate;
do $$
declare source_id uuid;
begin
  select id into source_id from public.financial_document_references where kind='ORD' and document_id=current_setting('c2.order')::uuid;
  perform pg_temp.c2_post(source_id,'c2_immediate_mode',jsonb_build_array(
    jsonb_build_object('account_id',(select id from public.financial_accounts where definition_code='treasury_cash'),'side','debit','amount','1'),
    jsonb_build_object('account_id',(select id from public.financial_accounts where definition_code='delivery_revenue'),'side','credit','amount','1')));
end;
$$;
set constraints all immediate;
set constraints all deferred;
do $$
begin
  perform pg_temp.c2_reject(format('select finance_private.begin_operation(''pending_test'',%L,''{}''); set constraints all immediate',gen_random_uuid()),'P0001');
end;
$$;

-- Actual RLS reads, NOT merely table-owner SELECTs. All raw C2 data is admin-only.
do $$
declare actor record; table_name text; row_count bigint; role_count integer := 0;
begin
  for actor in
    select id,role from public.profiles where id in (
      current_setting('c2.admin')::uuid,current_setting('c2.driver')::uuid,
      (select customer_id from public.customer_orders where id=current_setting('c2.order')::uuid),
      (select m.owner_user_id from public.store_orders so join public.stores s on s.id=so.store_id
        join public.merchants m on m.id=s.merchant_id where so.id=current_setting('c2.child')::uuid))
  loop
    role_count := role_count+1;
    perform set_config('request.jwt.claim.sub',actor.id::text,true);
    execute 'set local role authenticated';
    foreach table_name in array array['financial_accounts','financial_operations','financial_events','journal_entries','journal_lines','order_lifecycle_events','financial_document_references'] loop
      execute format('select count(*) from public.%I',table_name) into row_count;
      if actor.role<>'admin' and row_count<>0 then raise exception 'raw financial RLS leak'; end if;
      if actor.role='admin' and row_count=0 then raise exception 'admin fixture read failed'; end if;
      if has_table_privilege('authenticated','public.'||table_name,'INSERT,UPDATE,DELETE') then raise exception 'unexpected direct DML privilege'; end if;
    end loop;
    perform pg_temp.c2_reject('select finance_private.next_reference(''ORD'')','42501');
    perform pg_temp.c2_reject('insert into public.journal_entries default values','42501');
    perform pg_temp.c2_reject('insert into public.journal_lines default values','42501');
    perform pg_temp.c2_reject('insert into public.order_lifecycle_events default values','42501');
    select count(*) into row_count from public.get_c2_financial_operation(current_setting('c2.operation_key')::uuid);
    if (actor.role='admin' and row_count<>1) or (actor.role<>'admin' and row_count<>0) then raise exception 'operation recovery crossed actor boundary'; end if;
    if actor.role<>'admin' then
      perform pg_temp.c2_reject('select * from public.find_c2_document_reference(''ORD-000001'')','42501');
    end if;
    execute 'reset role';
  end loop;
  if role_count<>4 then raise exception 'four distinct role fixtures required'; end if;
  execute 'set local role anon';
  perform pg_temp.c2_reject('select * from public.journal_entries','42501');
  perform pg_temp.c2_reject('insert into public.order_lifecycle_events default values','42501');
  execute 'reset role';
end;
$$;
rollback;
