-- C5 LOCAL DRAFT. Requires C2 + C3 + all three C4 drafts. Never auto-enables intake.
begin;
do $$ begin
  if to_regprocedure('finance_private.c4_account(text,uuid,uuid)') is null
    or to_regprocedure('finance_private.c4_reject_operation(uuid,text)') is null
    or (select count(*) from pg_attribute where attrelid=to_regclass('public.delivery_collection_results')
      and attname in ('kind','cash_event_id','completed_at') and not attisdropped)<>3
    or not exists(select 1 from pg_constraint where conrelid=to_regclass('public.journal_lines') and conname='journal_lines_syp_major_amount_check') then
    raise exception 'C5 requires all three C4 migrations including decimal and zero-cash contracts'; end if;
end $$;
create table finance_private.c5_rollout(singleton boolean primary key default true check(singleton),accept_requests boolean not null default false);
insert into finance_private.c5_rollout default values;
create table finance_private.c5_cash_receivers(user_id uuid primary key references public.profiles(id) on delete restrict,enabled boolean not null default false);
revoke all on finance_private.c5_rollout,finance_private.c5_cash_receivers from public,anon,authenticated,service_role;
create function finance_private.c5_receiver() returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(public.is_admin(),false) and exists(select 1 from finance_private.c5_cash_receivers where user_id=auth.uid() and enabled)
$$;
create table public.driver_cash_handover_requests(
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric not null check(amount>0 and amount<100000000000000000000 and amount=round(amount,2)),
  operation_id uuid not null unique references public.financial_operations(id) on delete restrict,
  requested_at timestamptz not null default clock_timestamp()
);
create index c5_requests_driver on public.driver_cash_handover_requests(driver_id,requested_at,id);
create table public.driver_cash_handover_attempts(
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.driver_cash_handover_requests(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  counted_amount numeric not null check(counted_amount>=0 and counted_amount<100000000000000000000 and counted_amount=round(counted_amount,2)),
  received_by uuid not null references public.profiles(id) on delete restrict,
  outcome text not null check(outcome in ('confirmed','discrepancy')),
  operation_id uuid not null unique references public.financial_operations(id) on delete restrict,
  attempted_at timestamptz not null default clock_timestamp()
);
create unique index c5_one_confirmation on public.driver_cash_handover_attempts(request_id) where outcome='confirmed';
create index c5_attempts_request on public.driver_cash_handover_attempts(request_id,attempted_at,id);
create index c5_attempts_driver on public.driver_cash_handover_attempts(driver_id,attempted_at,id);
create trigger c5_request_immutable before update or delete on public.driver_cash_handover_requests for each row execute function finance_private.reject_mutation();
create trigger c5_attempt_immutable before update or delete on public.driver_cash_handover_attempts for each row execute function finance_private.reject_mutation();
alter table public.driver_cash_handover_requests enable row level security;
alter table public.driver_cash_handover_attempts enable row level security;
revoke all on public.driver_cash_handover_requests,public.driver_cash_handover_attempts from public,anon,authenticated,service_role;
grant select on public.driver_cash_handover_requests,public.driver_cash_handover_attempts to authenticated;
create policy c5_request_read on public.driver_cash_handover_requests for select to authenticated using(public.is_admin() or driver_id=auth.uid());
create policy c5_attempt_read on public.driver_cash_handover_attempts for select to authenticated using(public.is_admin() or driver_id=auth.uid());
-- Extend ONLY the two structural C2 reference checks, preserving every old branch.
alter table public.financial_document_references add column cash_handover_id uuid references public.driver_cash_handover_attempts(id) on delete restrict;
create unique index c5_receipt_decision_once on public.financial_document_references(cash_handover_id) where cash_handover_id is not null;
do $$ declare r record; found_count integer:=0; begin
  for r in select conname,pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid='public.financial_document_references'::regclass and contype='c' loop
    if position('num_nonnulls(' in r.definition)>0 or (position('CASE' in r.definition)>0 and position('kind' in r.definition)>0) then
      execute format('alter table public.financial_document_references drop constraint %I',r.conname); found_count:=found_count+1;
    end if;
  end loop;
  if found_count<>2 then raise exception 'C5 expected exactly two C2 document-link checks'; end if;
end $$;
alter table public.financial_document_references add constraint c5_reference_one_document check(
  num_nonnulls(customer_order_id,store_order_id,delivery_task_id,subscription_id,subscription_invoice_id,journal_entry_id,cash_handover_id)=1);
alter table public.financial_document_references add constraint c5_reference_kind_document check(case kind
  when 'ORD' then customer_order_id=document_id and customer_order_id is not null
  when 'SUB' then store_order_id=document_id and store_order_id is not null
  when 'DLV' then delivery_task_id=document_id and delivery_task_id is not null
  when 'MSB' then subscription_id=document_id and subscription_id is not null
  when 'SIN' then subscription_invoice_id=document_id and subscription_invoice_id is not null
  when 'TXN' then journal_entry_id=document_id and journal_entry_id is not null
  when 'RCT' then cash_handover_id=document_id and cash_handover_id is not null
  else false end);
create function finance_private.c5_validate_request() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.driver_id is distinct from auth.uid() or not public.is_approved_driver() or not exists(select 1 from public.financial_operations o
    where o.id=new.operation_id and o.actor_id=auth.uid() and o.state='pending' and o.operation_type='c5_request'
      and o.canonical_input=jsonb_build_object('driver',new.driver_id,'amount',new.amount)) then raise exception 'owned pending request operation required' using errcode='42501'; end if;
  new.requested_at:=clock_timestamp(); return new;
end $$;
create trigger c5_request_validate before insert on public.driver_cash_handover_requests for each row execute function finance_private.c5_validate_request();
create function finance_private.c5_request_complete() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.financial_operations where id=new.operation_id and state='completed' and result->>'request_id'=new.id::text and result->>'kind'='request' and (result->>'amount')::numeric=new.amount) then
    raise exception 'cash request must complete atomically'; end if;
  return null;
end $$;
create constraint trigger c5_request_completed after insert on public.driver_cash_handover_requests deferrable initially deferred
for each row execute function finance_private.c5_request_complete();
create function finance_private.c5_validate_attempt() returns trigger language plpgsql security definer set search_path='' as $$
declare req public.driver_cash_handover_requests%rowtype;
begin
  select * into strict req from public.driver_cash_handover_requests where id=new.request_id;
  if not finance_private.c5_receiver() or new.received_by is distinct from auth.uid() or new.driver_id<>req.driver_id
    or ((new.outcome='confirmed') is distinct from (new.counted_amount=req.amount)) then
    raise exception 'invalid authorized handover decision' using errcode='42501'; end if;
  if not exists(select 1 from public.financial_operations o where o.id=new.operation_id and o.actor_id=auth.uid() and o.state='pending'
    and o.operation_type='c5_confirm' and o.canonical_input=jsonb_build_object('request',new.request_id,'driver',new.driver_id,'counted',new.counted_amount)) then
    raise exception 'owned confirmation operation required'; end if;
  new.attempted_at:=clock_timestamp(); return new;
end $$;
create trigger c5_attempt_validate before insert on public.driver_cash_handover_attempts for each row execute function finance_private.c5_validate_attempt();
create function finance_private.c5_register_receipt(attempt_value uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare ref_value uuid;
begin
  if not exists(select 1 from public.driver_cash_handover_attempts where id=attempt_value and outcome='confirmed') then raise exception 'confirmed receipt required'; end if;
  insert into public.financial_document_references(kind,document_id,cash_handover_id) values('RCT',attempt_value,attempt_value) returning id into ref_value;
  return ref_value;
end $$;
-- Exact ledger read. No stored balance; no wages, merchant commissions or legacy rows.
create function finance_private.c5_position(driver_value uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare collected numeric; received numeric; balance numeric; reserved numeric; pending_count bigint;
begin
  select coalesce(sum(l.amount),0) into collected from public.delivery_collection_results r
    join public.financial_events e on e.id=r.cash_event_id and e.operation_id=r.operation_id and e.event_type='full_cash_collected'
    join public.financial_operations o on o.id=e.operation_id and o.state='completed'
    join public.journal_entries j on j.event_id=e.id and j.status='posted'
    join public.journal_lines l on l.journal_entry_id=j.id and l.side='debit'
    join public.financial_accounts a on a.id=l.account_id and a.definition_code='driver_cash' and a.owner_user_id=driver_value
    where r.driver_id=driver_value and r.kind='cash_delivery';
  select coalesce(sum(l.amount),0) into received from public.driver_cash_handover_attempts h
    join public.financial_operations o on o.id=h.operation_id and o.state='completed'
    join public.financial_document_references f on f.cash_handover_id=h.id and f.kind='RCT'
    join public.financial_events e on e.source_reference_id=f.id and e.operation_id=h.operation_id and e.event_type='office_cash_received'
    join public.journal_entries j on j.event_id=e.id and j.status='posted'
    join public.journal_lines l on l.journal_entry_id=j.id and l.side='credit'
    join public.financial_accounts a on a.id=l.account_id and a.definition_code='driver_cash' and a.owner_user_id=driver_value
    where h.driver_id=driver_value and h.outcome='confirmed';
  select coalesce(sum(case l.side when 'debit' then l.amount else -l.amount end),0) into balance
    from public.financial_accounts a join public.journal_lines l on l.account_id=a.id
    join public.journal_entries j on j.id=l.journal_entry_id and j.status='posted'
    join public.financial_events e on e.id=j.event_id join public.financial_operations o on o.id=e.operation_id and o.state='completed'
    where a.definition_code='driver_cash' and a.owner_user_id=driver_value;
  select coalesce(sum(r.amount),0),count(*) into reserved,pending_count from public.driver_cash_handover_requests r where r.driver_id=driver_value
    and not exists(select 1 from public.driver_cash_handover_attempts h where h.request_id=r.id and h.outcome='confirmed');
  return jsonb_build_object('collected',collected::text,'confirmed',received::text,'remaining',balance::text,
    'reserved',reserved::text,'available',greatest(balance-reserved,0)::text,'pending_count',pending_count,
    'ledger_requires_review',balance<>collected-received or balance<0 or reserved>balance);
end $$;
create function public.request_c5_cash_handover(expected_user uuid,attempt_key uuid,requested_amount numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
declare op public.financial_operations%rowtype; pos jsonb; request_value uuid; r jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'C5 writes require READ COMMITTED isolation'; end if;
  if expected_user is null or expected_user is distinct from auth.uid() or not public.is_approved_driver() then raise exception 'approved driver required' using errcode='42501'; end if;
  if attempt_key is null or requested_amount is null or requested_amount<=0 or requested_amount>=100000000000000000000
    or requested_amount<>round(requested_amount,2) or requested_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'invalid exact SYP amount'; end if;
  -- All requests/confirmations use driver profile first, then request, operation, reference/account.
  perform 1 from public.profiles where id=expected_user for update;
  op:=finance_private.begin_operation('c5_request',attempt_key,jsonb_build_object('driver',expected_user,'amount',requested_amount));
  if op.state in ('completed','rejected') then return op.result; end if;
  if not exists(select 1 from finance_private.c5_rollout where singleton and accept_requests) then
    return finance_private.c4_reject_operation(op.id,'intake_disabled'); end if;
  pos:=finance_private.c5_position(expected_user);
  if (pos->>'ledger_requires_review')::boolean then return finance_private.c4_reject_operation(op.id,'ledger_requires_review'); end if;
  if requested_amount>(pos->>'available')::numeric then return finance_private.c4_reject_operation(op.id,'insufficient_available'); end if;
  set constraints public.c5_request_completed deferred;
  insert into public.driver_cash_handover_requests(driver_id,amount,operation_id) values(expected_user,requested_amount,op.id) returning id into request_value;
  r:=jsonb_build_object('state','completed','kind','request','request_id',request_value,'amount',requested_amount::text);
  perform finance_private.complete_operation(op.id,r); set constraints all immediate; return r;
end $$;
create function public.confirm_c5_cash_handover(target_request uuid,target_driver uuid,expected_user uuid,attempt_key uuid,counted_amount numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
declare req public.driver_cash_handover_requests%rowtype; op public.financial_operations%rowtype; pos jsonb;
  driver_value uuid; decision_value uuid; ref_value uuid; event_value uuid; journal_value uuid; driver_account uuid; treasury uuid; r jsonb; previous public.driver_cash_handover_attempts%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'C5 writes require READ COMMITTED isolation'; end if;
  if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c5_receiver() then raise exception 'authorized cash receiver required' using errcode='42501'; end if;
  if attempt_key is null or counted_amount is null or counted_amount<0 or counted_amount>=100000000000000000000
    or counted_amount<>round(counted_amount,2) or counted_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'invalid counted SYP'; end if;
  select driver_id into driver_value from public.driver_cash_handover_requests where id=target_request;
  if not found or driver_value is distinct from target_driver then raise exception 'request scope unavailable' using errcode='42501'; end if;
  perform 1 from public.profiles where id=driver_value for update;
  select * into strict req from public.driver_cash_handover_requests where id=target_request for update;
  op:=finance_private.begin_operation('c5_confirm',attempt_key,jsonb_build_object('request',target_request,'driver',target_driver,'counted',counted_amount));
  if op.state in ('completed','rejected') then return op.result; end if;
  select * into previous from public.driver_cash_handover_attempts where request_id=target_request and outcome='confirmed';
  if found then
    if counted_amount<>previous.counted_amount then return finance_private.c4_reject_operation(op.id,'already_confirmed_different_count'); end if;
    r:=jsonb_build_object('state','completed','kind','confirmed','request_id',target_request,'amount',previous.counted_amount::text,
      'reference',(select public_reference from public.financial_document_references where cash_handover_id=previous.id),'replayed',true,'received_by',previous.received_by,'received_at',previous.attempted_at);
    perform finance_private.complete_operation(op.id,r); set constraints all immediate; return r;
  end if;
  set constraints public.c5_confirmed_receipt deferred;
  if counted_amount<>req.amount then
    insert into public.driver_cash_handover_attempts(request_id,driver_id,counted_amount,received_by,outcome,operation_id)
      values(req.id,req.driver_id,counted_amount,auth.uid(),'discrepancy',op.id) returning id into decision_value;
    r:=jsonb_build_object('state','completed','kind','discrepancy','request_id',req.id,'attempt_id',decision_value,'requested',req.amount::text,'counted',counted_amount::text);
    perform finance_private.complete_operation(op.id,r); set constraints all immediate; return r;
  end if;
  pos:=finance_private.c5_position(req.driver_id);
  if (pos->>'ledger_requires_review')::boolean then return finance_private.c4_reject_operation(op.id,'ledger_requires_review'); end if;
  -- Own reservation is released by this confirmation; every other reservation remains protected.
  if req.amount>(pos->>'remaining')::numeric-((pos->>'reserved')::numeric-req.amount) then return finance_private.c4_reject_operation(op.id,'insufficient_available'); end if;
  insert into public.driver_cash_handover_attempts(request_id,driver_id,counted_amount,received_by,outcome,operation_id)
    values(req.id,req.driver_id,counted_amount,auth.uid(),'confirmed',op.id) returning id into decision_value;
  ref_value:=finance_private.c5_register_receipt(decision_value);
  event_value:=finance_private.record_financial_event(ref_value,'office_cash_received',op.id);
  driver_account:=finance_private.c4_account('driver_cash',req.driver_id);
  treasury:=finance_private.c4_account('treasury_cash');
  journal_value:=finance_private.post_journal(event_value,jsonb_build_array(
    jsonb_build_object('account_id',treasury,'side','debit','amount',req.amount),
    jsonb_build_object('account_id',driver_account,'side','credit','amount',req.amount)),'office received full requested handover');
  r:=jsonb_build_object('state','completed','kind','confirmed','request_id',req.id,'attempt_id',decision_value,'amount',req.amount::text,
    'reference',(select public_reference from public.financial_document_references where id=ref_value),'journal_id',journal_value,'received_by',auth.uid(),'received_at',(select attempted_at from public.driver_cash_handover_attempts where id=decision_value));
  perform finance_private.complete_operation(op.id,r); set constraints all immediate; return r;
end $$;
-- Commit-time linkage: a confirmed decision is never a cash receipt without its posted balanced journal.
create function finance_private.c5_require_receipt() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.financial_operations where id=new.operation_id and state='completed' and result->>'kind'=new.outcome and result->>'request_id'=new.request_id::text) then
    raise exception 'handover decision must complete atomically'; end if;
  if new.outcome='confirmed' and not exists(select 1 from public.financial_document_references f
    join public.financial_events e on e.source_reference_id=f.id and e.operation_id=new.operation_id and e.event_type='office_cash_received'
    join public.journal_entries j on j.event_id=e.id and j.status='posted'
    join public.financial_operations o on o.id=e.operation_id and o.state='completed'
    where f.cash_handover_id=new.id and f.kind='RCT'
      and (select count(*)=2 from public.journal_lines where journal_entry_id=j.id)
      and exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id
        where l.journal_entry_id=j.id and l.side='debit' and l.amount=new.counted_amount and a.definition_code='treasury_cash')
      and exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id
        where l.journal_entry_id=j.id and l.side='credit' and l.amount=new.counted_amount and a.definition_code='driver_cash' and a.owner_user_id=new.driver_id)) then raise exception 'confirmed handover needs its posted receipt'; end if;
  return null;
end $$;
create constraint trigger c5_confirmed_receipt after insert on public.driver_cash_handover_attempts deferrable initially deferred
for each row execute function finance_private.c5_require_receipt();
create function public.recover_c5_cash_handover(expected_user uuid,attempt_key uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare op public.financial_operations%rowtype;
begin
  if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'attempt owner required' using errcode='42501'; end if;
  select * into op from public.financial_operations o where o.actor_id=expected_user and o.attempt_key=recover_c5_cash_handover.attempt_key and o.operation_type in ('c5_request','c5_confirm');
  if not found or op.state='pending' then return jsonb_build_object('state','unknown'); end if;
  return op.result;
end $$;
create function public.get_c5_driver_custody(target_driver uuid,expected_user uuid,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pos jsonb; requests_value jsonb; history_value jsonb; more_value boolean; legacy_value jsonb;
begin
  if expected_user is null or expected_user is distinct from auth.uid() or (not coalesce(public.is_admin(),false) and target_driver is distinct from auth.uid()) then raise exception 'custody scope denied' using errcode='42501'; end if;
  if page_number is null or page_number<0 or page_number>100000 then raise exception 'invalid page'; end if;
  if not exists(select 1 from public.profiles where id=target_driver and role='driver') then raise exception 'driver unavailable'; end if;
  pos:=finance_private.c5_position(target_driver);
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into requests_value from (
    select r.id,r.amount::text,r.requested_at,exists(select 1 from public.driver_cash_handover_attempts h where h.request_id=r.id and h.outcome='discrepancy') as needs_review,
      (select h.counted_amount::text from public.driver_cash_handover_attempts h where h.request_id=r.id and h.outcome='discrepancy' order by h.attempted_at desc,h.id desc limit 1) as last_counted
    from public.driver_cash_handover_requests r where r.driver_id=target_driver and not exists(select 1 from public.driver_cash_handover_attempts h where h.request_id=r.id and h.outcome='confirmed')
    order by r.requested_at desc,r.id limit 20 offset page_number*20) q;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into history_value from (
    select * from (
      select r.id,r.completed_at as at,r.amount::text,r.kind,f.public_reference as reference from public.delivery_collection_results r
        join public.financial_document_references f on f.kind='DLV' and f.document_id=r.task_id where r.driver_id=target_driver
      union all select h.id,h.attempted_at,h.counted_amount::text,h.outcome,f.public_reference
        from public.driver_cash_handover_attempts h left join public.financial_document_references f on f.cash_handover_id=h.id where h.driver_id=target_driver
    ) rows_value order by at desc,id limit 20 offset page_number*20) q;
  more_value:=(pos->>'pending_count')::bigint>(page_number+1)*20 or (
    (select count(*) from public.delivery_collection_results where driver_id=target_driver)+(select count(*) from public.driver_cash_handover_attempts where driver_id=target_driver)>(page_number+1)*20);
  -- Old financial rules remain old: wages/credit semantics are displayed separately, NEVER added to C2 balance.
  select to_jsonb(p) into legacy_value from public.driver_cash_custody_positions p where p.driver_id=target_driver;
  return jsonb_build_object('position',pos,'requests',requests_value,'history',history_value,'has_more',more_value,
    'legacy',legacy_value,'can_request',(pos->>'available')::numeric>0 and target_driver=auth.uid() and public.is_approved_driver() and not (pos->>'ledger_requires_review')::boolean
      and exists(select 1 from finance_private.c5_rollout where singleton and accept_requests),'can_confirm',finance_private.c5_receiver());
end $$;
create function public.list_c5_cash_requests(expected_user uuid,state_filter text default 'pending',page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows_value jsonb; count_value bigint;
begin
  if expected_user is null or expected_user is distinct from auth.uid() or not coalesce(public.is_admin(),false) then raise exception 'admin required' using errcode='42501'; end if;
  if state_filter not in ('pending','review') or state_filter is null or page_number is null or page_number<0 or page_number>100000 then raise exception 'invalid filter'; end if;
  select count(*) into count_value from public.driver_cash_handover_requests r where not exists(select 1 from public.driver_cash_handover_attempts h where h.request_id=r.id and h.outcome='confirmed')
    and (state_filter='pending' or exists(select 1 from public.driver_cash_handover_attempts h where h.request_id=r.id and h.outcome='discrepancy'));
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into rows_value from (
    select r.id,r.driver_id,p.full_name,r.amount::text,r.requested_at,exists(select 1 from public.driver_cash_handover_attempts h where h.request_id=r.id and h.outcome='discrepancy') as needs_review,
      (select h.counted_amount::text from public.driver_cash_handover_attempts h where h.request_id=r.id and h.outcome='discrepancy' order by h.attempted_at desc,h.id desc limit 1) as last_counted
    from public.driver_cash_handover_requests r join public.profiles p on p.id=r.driver_id
    where not exists(select 1 from public.driver_cash_handover_attempts h where h.request_id=r.id and h.outcome='confirmed')
      and (state_filter='pending' or exists(select 1 from public.driver_cash_handover_attempts h where h.request_id=r.id and h.outcome='discrepancy'))
    order by r.requested_at,r.id limit 20 offset page_number*20) q;
  return jsonb_build_object('rows',rows_value,'has_more',count_value>(page_number+1)*20,'can_confirm',finance_private.c5_receiver());
end $$;
revoke all on function public.request_c5_cash_handover(uuid,uuid,numeric),public.confirm_c5_cash_handover(uuid,uuid,uuid,uuid,numeric),
 public.recover_c5_cash_handover(uuid,uuid),public.get_c5_driver_custody(uuid,uuid,integer),public.list_c5_cash_requests(uuid,text,integer) from public,anon,service_role;
grant execute on function public.request_c5_cash_handover(uuid,uuid,numeric),public.confirm_c5_cash_handover(uuid,uuid,uuid,uuid,numeric),
 public.recover_c5_cash_handover(uuid,uuid),public.get_c5_driver_custody(uuid,uuid,integer),public.list_c5_cash_requests(uuid,text,integer) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;
do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['driver_cash_handover_requests','driver_cash_handover_attempts','delivery_collection_results'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t); end if;
    end loop;
  end if;
end $$;
commit;
