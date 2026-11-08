-- LOCAL / UNAPPLIED. C2 ledger is the only cash source. No legacy import.
begin;
do $$ begin
 if to_regprocedure('finance_private.c6_treasury_balance()') is null or to_regclass('public.subscription_cash_receipts') is null then raise exception 'C9 requires C2-C8';end if;
end $$;

create table finance_private.c9_control(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into finance_private.c9_control default values;
create table finance_private.c9_permissions(
 user_id uuid primary key references public.profiles(id),dashboard boolean not null default false,ledger boolean not null default false,
 expense boolean not null default false,pay boolean not null default false,count_cash boolean not null default false,
 review boolean not null default false,adjust boolean not null default false,opening boolean not null default false
);
revoke all on finance_private.c9_control,finance_private.c9_permissions from public,anon,authenticated,service_role;
create function finance_private.c9_can(permission_value text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.is_admin(),false) and exists(select 1 from finance_private.c9_permissions p where p.user_id=auth.uid() and
 case permission_value when 'dashboard' then p.dashboard when 'ledger' then p.ledger when 'expense' then p.expense when 'pay' then p.pay
 when 'count' then p.count_cash when 'review' then p.review when 'adjust' then p.adjust when 'opening' then p.opening else false end)
$$;
-- Narrow lock bridge: C5 already holds the driver lock before inserting a confirmed RCT.
-- C6/C7/C8 acquire this same mutex themselves; no change to amounts or legacy finance.
create function finance_private.c9_lock_c5_receipt() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.outcome='confirmed' then
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'cash receipts require READ COMMITTED';end if;
  perform 1 from finance_private.c6_treasury_mutex where singleton for update;
 end if;return new;
end $$;
create trigger c9_serialize_c5_receipt before insert on public.driver_cash_handover_attempts for each row execute function finance_private.c9_lock_c5_receipt();

-- Internal projection. Includes reversals with their actual signs; never infers cash from an invoice.
create view finance_private.c9_cash_lines with(security_barrier=true) as
 select l.id,line_number,l.journal_entry_id,j.posted_at,l.side,l.amount,
 case l.side when 'debit' then l.amount else -l.amount end as delta,
 e.event_type,o.operation_type,o.id as operation_id,o.actor_id,o.state,
 f.public_reference as source_reference,t.public_reference as journal_reference,j.reversal_of
 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id and a.definition_code='treasury_cash'
 join public.journal_entries j on j.id=l.journal_entry_id and j.status='posted'
 join public.financial_events e on e.id=j.event_id join public.financial_operations o on o.id=e.operation_id and o.state='completed'
 join public.financial_document_references f on f.id=e.source_reference_id
 join public.financial_document_references t on t.id=j.reference_id;
revoke all on finance_private.c9_cash_lines from public,anon,authenticated,service_role;
create function finance_private.c9_cash_cut() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('balance',coalesce(sum(delta),0)::text,'fingerprint',md5(coalesce(string_agg(id::text,',' order by id),'')),
 'line_count',count(*),'snapshot',pg_current_snapshot()::text) from finance_private.c9_cash_lines
$$;
create table public.treasury_control_documents(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('start','count','cancel_count','review','expense_request','opening_request')),
 session_id uuid references public.treasury_control_documents(id),operation_id uuid not null unique references public.financial_operations(id),
 actor_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 reason text not null check(char_length(trim(reason)) between 2 and 1500),
 amount numeric check(amount>=0 and amount<100000000000000000000 and amount=round(amount,2) and amount::text not in ('NaN','Infinity','-Infinity')),
 expense_type text,source text,cut jsonb,difference numeric,
 check(case kind when 'start' then session_id is null and cut is not null and amount is null and difference is null
 when 'count' then session_id is not null and cut is not null and amount is not null and difference is not null
 when 'cancel_count' then session_id is not null and amount is null and difference is null
 when 'review' then session_id is not null and amount is null and difference is null
 when 'expense_request' then session_id is null and amount is not null and amount>0 and coalesce(char_length(trim(expense_type)),0) between 2 and 100
 when 'opening_request' then session_id is null and amount is not null and amount>0 and coalesce(char_length(trim(source)),0) between 2 and 500 else false end)
);
create unique index c9_one_count_result on public.treasury_control_documents(session_id) where kind in ('count','cancel_count');
create unique index c9_one_review on public.treasury_control_documents(session_id) where kind='review';
create index c9_documents_page on public.treasury_control_documents(created_at,id);
alter table public.treasury_control_documents enable row level security;
revoke all on public.treasury_control_documents from public,anon,authenticated,service_role;
grant select on public.treasury_control_documents to authenticated;
-- RLS must not require USAGE of finance_private. Public boolean wrapper has no data capability.
create function public.can_read_treasury_document(document_kind text) returns boolean language sql stable security definer set search_path='' as $$
 select case when document_kind in ('start','count','cancel_count') then finance_private.c9_can('count') or finance_private.c9_can('review')
 when document_kind='review' then finance_private.c9_can('review') when document_kind='expense_request' then finance_private.c9_can('expense')
 when document_kind='opening_request' then finance_private.c9_can('opening') else false end
$$;
create policy c9_document_read on public.treasury_control_documents for select to authenticated using(public.can_read_treasury_document(kind));
create trigger c9_document_immutable before update or delete on public.treasury_control_documents for each row execute function finance_private.reject_mutation();
create function finance_private.c9_validate_document() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.treasury_control_documents%rowtype;
begin
 if not exists(select 1 from public.financial_operations o where o.id=new.operation_id and o.actor_id=new.actor_id and o.operation_type='c9_'||new.kind and o.state='completed' and o.result->>'id'=new.id::text) then raise exception 'uncompleted treasury audit operation';end if;
 if new.session_id is not null then
  select * into strict s from public.treasury_control_documents where id=new.session_id;
  if new.kind in ('count','cancel_count') and s.kind<>'start' or new.kind='count' and s.actor_id<>new.actor_id then raise exception 'foreign count session';end if;
  if new.kind='count' and (new.cut->>'fingerprint' is distinct from s.cut->>'fingerprint' or new.difference is distinct from new.amount-(new.cut->>'balance')::numeric) then raise exception 'invalid count cut';end if;
  if new.kind='review' and (s.kind<>'count' or s.difference=0) then raise exception 'review needs a difference';end if;
 end if;return null;
end $$;
create constraint trigger c9_document_complete after insert on public.treasury_control_documents deferrable initially deferred for each row execute function finance_private.c9_validate_document();

create function public.record_treasury_action(expected_user uuid,attempt_key uuid,action_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text;reason_value text;amount_value numeric;session_value uuid;document_value uuid:=gen_random_uuid();
 permission_value text;op public.financial_operations%rowtype;s public.treasury_control_documents%rowtype;cut_value jsonb;result_value jsonb;canonical jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'session mismatch' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'C9 requires READ COMMITTED';end if;
 k:=action_input->>'kind';reason_value:=trim(action_input->>'reason');
 permission_value:=case k when 'start' then 'count' when 'count' then 'count' when 'cancel_count' then 'count' when 'review' then 'review' when 'expense_request' then 'expense' when 'opening_request' then 'opening' end;
 if permission_value is null or not finance_private.c9_can(permission_value) then raise exception 'treasury permission required' using errcode='42501';end if;
 if k in ('expense_request','opening_request') then raise exception 'use request_treasury_finance workflow' using errcode='0A000';end if;
 if jsonb_typeof(action_input)<>'object' or reason_value is null or char_length(reason_value) not between 2 and 1500 or
 exists(select 1 from jsonb_object_keys(action_input) q(key) where key not in ('kind','reason','amount','session_id','expense_type','source')) then raise exception 'invalid treasury input';end if;
 if k in ('count','expense_request','opening_request') then
  if jsonb_typeof(action_input->'amount') is distinct from 'string' or (action_input->>'amount')!~ '^[0-9]{1,20}(\.[0-9]{1,2})?$' then raise exception 'exact decimal SYP required';end if;
  amount_value:=(action_input->>'amount')::numeric;
  if k<>'count' and amount_value<=0 then raise exception 'positive amount required';end if;
 end if;
 if k in ('count','cancel_count','review') then session_value:=(action_input->>'session_id')::uuid;if session_value is null then raise exception 'session required';end if;end if;
 if k='expense_request' and coalesce(char_length(trim(action_input->>'expense_type')),0) not between 2 and 100 then raise exception 'expense category required';end if;
 if k='opening_request' and coalesce(char_length(trim(action_input->>'source')),0) not between 2 and 500 then raise exception 'opening source required';end if;
 canonical:=jsonb_build_object('kind',k,'reason',reason_value,'amount',amount_value,'session_id',session_value,
 'expense_type',case when k='expense_request' then trim(action_input->>'expense_type') end,'source',case when k='opening_request' then trim(action_input->>'source') end);
 -- No driver/merchant/profile locks are acquired after this shared treasury mutex.
 perform 1 from finance_private.c6_treasury_mutex where singleton for update;
 op:=finance_private.begin_operation('c9_'||k,attempt_key,canonical);
 if op.state in ('completed','rejected') then return op.result;end if;
 if not (select enabled from finance_private.c9_control where singleton) then return finance_private.c4_reject_operation(op.id,'c9_disabled');end if;
 if session_value is not null then
  select * into s from public.treasury_control_documents where id=session_value;
  if not found or (k='review' and (s.kind<>'count' or s.difference=0)) or (k in ('count','cancel_count') and s.kind<>'start') or (k='count' and s.actor_id<>auth.uid()) then return finance_private.c4_reject_operation(op.id,'session_unavailable');end if;
  if exists(select 1 from public.treasury_control_documents where session_id=session_value and kind in ('count','cancel_count','review')) then return finance_private.c4_reject_operation(op.id,'already_completed');end if;
 end if;
 if k='start' and exists(select 1 from public.treasury_control_documents d where d.kind='start' and not exists(select 1 from public.treasury_control_documents r where r.session_id=d.id and r.kind in ('count','cancel_count'))) then return finance_private.c4_reject_operation(op.id,'count_already_open');end if;
 if k in ('start','count') then
  cut_value:=finance_private.c9_cash_cut();
  if k='count' and cut_value->>'fingerprint' is distinct from s.cut->>'fingerprint' then return finance_private.c4_reject_operation(op.id,'cash_moved_restart_count');end if;
 end if;
 set constraints public.c9_document_complete deferred;
 insert into public.treasury_control_documents(id,kind,session_id,operation_id,actor_id,reason,amount,expense_type,source,cut,difference)
 values(document_value,k,session_value,op.id,auth.uid(),reason_value,amount_value,canonical->>'expense_type',canonical->>'source',cut_value,
 case when k='count' then amount_value-(cut_value->>'balance')::numeric end);
 -- Audit RPC never posts money. Approved finance uses the companion C9 posting RPCs.
 result_value:=jsonb_build_object('state','completed','id',document_value,'kind',k,'posted',false);
 perform finance_private.complete_operation(op.id,result_value);set constraints all immediate;return result_value;
end $$;
create function public.recover_treasury_action(expected_user uuid,attempt_key uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not public.is_admin() then raise exception 'session mismatch' using errcode='42501';end if;
 return coalesce((select result from public.financial_operations where actor_id=auth.uid() and financial_operations.attempt_key=recover_treasury_action.attempt_key and left(operation_type,3)='c9_' and state in ('completed','rejected')),jsonb_build_object('state','unknown'));
end $$;
create function public.read_treasury_control(expected_user uuid,view_value text default 'dashboard',page_number integer default 0,
 from_time timestamptz default null,to_time timestamptz default null,direction_value text default 'all',target_journal uuid default null)
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare data_value jsonb;permissions jsonb;metrics jsonb;details jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not public.is_admin() then raise exception 'session mismatch' using errcode='42501';end if;
 if page_number is null or page_number<0 or page_number>100000 or direction_value is null or direction_value not in ('all','in','out') or
 (from_time is not null and to_time is not null and from_time>=to_time) then raise exception 'invalid treasury page';end if;
 if view_value is null or view_value not in ('dashboard','ledger','expenses','counts','differences','opening') or not finance_private.c9_can(
 case view_value when 'dashboard' then 'dashboard' when 'ledger' then 'ledger' when 'expenses' then 'expense' when 'counts' then 'count' when 'differences' then 'review' when 'opening' then 'opening' end) then raise exception 'treasury permission required' using errcode='42501';end if;
 if target_journal is not null and view_value<>'ledger' then raise exception 'journal requires ledger permission' using errcode='42501';end if;
 select jsonb_object_agg(p,finance_private.c9_can(p)) into permissions from unnest(array['dashboard','ledger','expense','pay','count','review','adjust','opening']) p;
 if view_value='dashboard' then
  with posted as(
   select a.definition_code,l.side,l.amount from public.financial_accounts a join public.journal_lines l on l.account_id=a.id
   join public.journal_entries j on j.id=l.journal_entry_id and j.status='posted'
   join public.financial_events e on e.id=j.event_id join public.financial_operations o on o.id=e.operation_id and o.state='completed'
  ), positions as(select definition_code,sum(case when side='debit' then amount else -amount end) balance from posted group by definition_code),
  flows as(select coalesce(sum(amount) filter(where side='debit'),0) receipts,coalesce(sum(amount) filter(where side='credit'),0) payments
   from finance_private.c9_cash_lines where (from_time is null or posted_at>=from_time) and(to_time is null or posted_at<to_time))
  select jsonb_build_object('treasury',coalesce((select balance from positions where definition_code='treasury_cash'),0)::text,
  'receipts',receipts::text,'payments',payments::text,'net',(receipts-payments)::text,
  'driver_cash',coalesce((select balance from positions where definition_code='driver_cash'),0)::text,
  'driver_payable',(-coalesce((select balance from positions where definition_code='driver_earnings_payable'),0))::text,
  'merchant_payable',(-coalesce((select balance from positions where definition_code='merchant_sales_payable'),0))::text,
  'subscription_receivable',coalesce((select balance from positions where definition_code='subscription_receivable'),0)::text,
  'unreviewed_differences',(select count(*) from public.treasury_control_documents d where kind='count' and difference<>0 and not exists(select 1 from public.treasury_control_documents r where r.kind='review' and r.session_id=d.id)),
  'cash_receipt_discrepancies',(select count(distinct a.request_id) from public.driver_cash_handover_attempts a where a.outcome='discrepancy' and not exists(select 1 from public.driver_cash_handover_attempts b where b.request_id=a.request_id and b.outcome='confirmed')),
  'pricing_exceptions',(select count(*) from public.order_pricing_current where review_required),
  'negative_accounts',(select count(*) from positions where (definition_code in ('treasury_cash','driver_cash','subscription_receivable') and balance<0) or (definition_code in ('driver_earnings_payable','merchant_sales_payable') and balance>0))) into metrics from flows;
  data_value:='[]'::jsonb;
 elsif view_value='ledger' then
  with ordered as(select c.*,sum(delta) over(order by posted_at,journal_entry_id,line_number,id rows unbounded preceding) as running_balance from finance_private.c9_cash_lines c),
  page as(select * from ordered where (from_time is null or posted_at>=from_time) and(to_time is null or posted_at<to_time)
  and(direction_value='all' or direction_value='in' and side='debit' or direction_value='out' and side='credit')
  and(target_journal is null or journal_entry_id=target_journal) order by posted_at desc,journal_entry_id desc,line_number desc,id desc limit 21 offset page_number*20)
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'journal_id',journal_entry_id,'at',posted_at,'amount',amount::text,'side',side,'balance',running_balance::text,
  'event',event_type,'operation_type',operation_type,'operation_id',operation_id,'actor_id',actor_id,'state',state,'reference',source_reference,'journal_reference',journal_reference,
  'reversal_of',reversal_of) order by posted_at desc,journal_entry_id desc,line_number desc,id desc),'[]') into data_value from page;
  if target_journal is not null then
   if not exists(select 1 from finance_private.c9_cash_lines where journal_entry_id=target_journal) then raise exception 'posted treasury journal unavailable';end if;
   select jsonb_build_object('reason',j.reason,'lines',(select jsonb_agg(jsonb_build_object('account',d.name_ar,'code',a.definition_code,'side',l.side,'amount',l.amount::text) order by l.line_number)
   from public.journal_lines l join public.financial_accounts a on a.id=l.account_id join public.financial_account_definitions d on d.code=a.definition_code where l.journal_entry_id=j.id)) into details from public.journal_entries j where j.id=target_journal;
  end if;
 else
  select coalesce(jsonb_agg(x.payload order by x.occurred desc,x.id desc),'[]') into data_value from (
   select d.created_at as occurred,d.id,jsonb_build_object('id',d.id,'kind',kind,'session_id',session_id,'actor_id',actor_id,'at',created_at,'reason',reason,
   'amount',amount::text,'difference',difference::text,'cut',cut,'expense_type',expense_type,'source',source,'operation_id',operation_id,
   'reviewed',exists(select 1 from public.treasury_control_documents r where r.kind='review' and r.session_id=d.id)) payload
   from public.treasury_control_documents d where case view_value when 'expenses' then kind='expense_request' when 'opening' then kind='opening_request'
   when 'differences' then kind='count' and difference<>0 else kind in ('start','count','cancel_count') end
   and(from_time is null or created_at>=from_time) and(to_time is null or created_at<to_time)
   order by created_at desc,id desc limit 21 offset page_number*20
  ) x;
 end if;
 return jsonb_build_object('view',view_value,'metrics',metrics,'rows',case when jsonb_array_length(data_value)>20 then data_value-20 else data_value end,
 'has_more',jsonb_array_length(data_value)>20,'permissions',permissions,'enabled',(select enabled from finance_private.c9_control where singleton),
 'expense_posting_enabled',false,'adjustment_posting_enabled',false,'opening_posting_enabled',false,'server_time',statement_timestamp(),'details',details,
 'open_session',case when finance_private.c9_can('count') then (select jsonb_build_object('id',d.id,'actor_id',d.actor_id,'cut',d.cut,'at',d.created_at)
 from public.treasury_control_documents d where d.kind='start' and not exists(select 1 from public.treasury_control_documents r where r.session_id=d.id and r.kind in ('count','cancel_count')) limit 1) else null end);
end $$;
revoke all on function public.can_read_treasury_document(text) from public,anon,service_role;
grant execute on function public.can_read_treasury_document(text) to authenticated;
revoke all on function public.record_treasury_action(uuid,uuid,jsonb),public.recover_treasury_action(uuid,uuid),public.read_treasury_control(uuid,text,integer,timestamptz,timestamptz,text,uuid) from public,anon,service_role;
grant execute on function public.record_treasury_action(uuid,uuid,jsonb),public.recover_treasury_action(uuid,uuid),public.read_treasury_control(uuid,text,integer,timestamptz,timestamptz,text,uuid) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;
commit;
