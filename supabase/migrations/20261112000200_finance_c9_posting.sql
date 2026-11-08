-- LOCAL UNAPPLIED C9 completion. Apply AFTER 20261112000100. No activation / legacy import.
begin;
-- C2's actual constraint is a text classification, NOT an enum. Existing types/rows retain meaning.
alter table public.financial_account_definitions drop constraint financial_account_definitions_account_type_check;
alter table public.financial_account_definitions add constraint financial_account_definitions_account_type_check
 check(account_type in ('asset','liability','income','expense','equity'));
insert into public.financial_account_definitions(code,name_ar,account_type,owner_kind) values
 ('office_operating_expense','مصروف تشغيل المكتب','expense','system'),
 ('treasury_cash_shortage_expense','مصروف نقص الخزينة','expense','system'),
 ('treasury_cash_overage_income','إيراد زيادة الخزينة','income','system'),
 ('opening_balance_equity','المقابل المحاسبي للرصيد الافتتاحي','equity','system');
alter table finance_private.c9_control add column opening_enabled boolean not null default false;
alter table finance_private.c9_permissions add column expense_approve boolean not null default false,
 add column adjust_request boolean not null default false,add column opening_approve boolean not null default false;
-- Set only by the trusted database owner after identifying the real project owner. NO public setter.
create table finance_private.c9_system_owners(user_id uuid primary key references public.profiles(id),reason text not null check(length(trim(reason)) between 2 and 1500),recorded_at timestamptz not null default clock_timestamp());
revoke all on finance_private.c9_system_owners from public,anon,authenticated,service_role;
create function finance_private.c9_finance_can(kind_value text,action_value text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.is_admin(),false) and exists(select 1 from finance_private.c9_permissions p where p.user_id=auth.uid() and
 case kind_value when 'expense' then case action_value when 'request' then p.expense when 'approve' then p.expense_approve when 'reject' then p.expense_approve when 'pay' then p.pay else false end
 when 'adjustment' then case action_value when 'request' then p.adjust_request when 'approve' then p.adjust when 'reject' then p.adjust else false end
 when 'opening' then case action_value when 'request' then p.opening when 'approve' then p.opening_approve and exists(select 1 from finance_private.c9_system_owners where user_id=auth.uid())
 when 'reject' then p.opening_approve and exists(select 1 from finance_private.c9_system_owners where user_id=auth.uid()) else false end else false end)
$$;
create function public.can_read_treasury_finance(kind_value text) returns boolean language sql stable security definer set search_path='' as $$
 select finance_private.c9_can('ledger') or finance_private.c9_finance_can(kind_value,'request') or finance_private.c9_finance_can(kind_value,'approve') or finance_private.c9_finance_can(kind_value,'pay')
$$;
create table public.treasury_finance_requests(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('expense','adjustment','opening')),
 amount numeric not null check(amount>0 and amount<100000000000000000000 and amount=round(amount,2) and amount::text not in ('NaN','Infinity','-Infinity')),
 reason text not null check(length(trim(reason)) between 2 and 1500),expense_type text,source text,cash_date date,
 count_id uuid references public.treasury_control_documents(id),cut jsonb,
 requested_by uuid not null references public.profiles(id),operation_id uuid not null unique references public.financial_operations(id),created_at timestamptz not null default clock_timestamp(),
 check(case kind when 'expense' then coalesce(length(trim(expense_type)),0) between 2 and 100 and source is null and cash_date is null and count_id is null and cut is null
 when 'opening' then coalesce(length(trim(source)),0) between 2 and 500 and cash_date is not null and count_id is null and cut is not null and expense_type is null
 when 'adjustment' then count_id is not null and cut is not null and source is null and cash_date is null and expense_type is null else false end)
);
create index c9_requests_page on public.treasury_finance_requests(kind,created_at,id);
create table public.treasury_finance_events(
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.treasury_finance_requests(id),action text not null check(action in ('approved','posted','rejected')),
 actor_id uuid not null references public.profiles(id),reason text not null check(length(trim(reason)) between 2 and 1500),
 operation_id uuid not null references public.financial_operations(id),created_at timestamptz not null default clock_timestamp(),unique(request_id,action)
);
create table public.treasury_finance_postings(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique references public.treasury_finance_requests(id),
 kind text not null check(kind in ('expense','adjustment','opening')),count_id uuid unique references public.treasury_control_documents(id),
 amount numeric not null check(amount>0 and amount<100000000000000000000 and amount=round(amount,2)),
 cash_delta numeric not null check(cash_delta<>0 and abs(cash_delta)=amount),operation_id uuid not null unique references public.financial_operations(id),
 posted_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 check((kind='adjustment')=(count_id is not null)),check(kind<>'expense' or cash_delta<0),check(kind<>'opening' or cash_delta>0)
);
create unique index c9_one_opening_ever on public.treasury_finance_postings((true)) where kind='opening';
alter table public.financial_document_references add column treasury_posting_id uuid unique references public.treasury_finance_postings(id);
alter table public.financial_document_references drop constraint c8_reference_one_document,drop constraint c8_reference_kind_document;
alter table public.financial_document_references add constraint c9_reference_one_document check(num_nonnulls(customer_order_id,store_order_id,delivery_task_id,subscription_id,subscription_invoice_id,journal_entry_id,cash_handover_id,wage_payment_id,merchant_settlement_id,merchant_payment_id,billing_document_id,subscription_cash_receipt_id,treasury_posting_id)=1);
alter table public.financial_document_references add constraint c9_reference_kind_document check(case kind
 when 'ORD' then customer_order_id=document_id and customer_order_id is not null when 'SUB' then store_order_id=document_id and store_order_id is not null
 when 'DLV' then delivery_task_id=document_id and delivery_task_id is not null when 'MSB' then subscription_id=document_id and subscription_id is not null
 when 'SIN' then (subscription_invoice_id=document_id and subscription_invoice_id is not null) or (billing_document_id=document_id and billing_document_id is not null)
 when 'TXN' then journal_entry_id=document_id and journal_entry_id is not null
 when 'RCT' then (cash_handover_id=document_id and cash_handover_id is not null) or (subscription_cash_receipt_id=document_id and subscription_cash_receipt_id is not null)
 when 'SET' then merchant_settlement_id=document_id and merchant_settlement_id is not null
 when 'PAY' then (wage_payment_id=document_id and wage_payment_id is not null) or (merchant_payment_id=document_id and merchant_payment_id is not null) or (treasury_posting_id=document_id and treasury_posting_id is not null)
 when 'ADJ' then treasury_posting_id=document_id and treasury_posting_id is not null else false end);
do $$ declare t text;begin
 foreach t in array array['treasury_finance_requests','treasury_finance_events','treasury_finance_postings'] loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);execute format('create trigger c9_finance_immutable before update or delete on public.%I for each row execute function finance_private.reject_mutation()',t);
 end loop;
end $$;

create policy c9_finance_request_read on public.treasury_finance_requests for select to authenticated using(public.can_read_treasury_finance(kind));
create policy c9_finance_posting_read on public.treasury_finance_postings for select to authenticated using(public.can_read_treasury_finance(kind));
create policy c9_finance_event_read on public.treasury_finance_events for select to authenticated using(exists(select 1 from public.treasury_finance_requests q where q.id=request_id and public.can_read_treasury_finance(q.kind)));
create function finance_private.c9_request_state(request_value uuid) returns text language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.treasury_finance_events where request_id=request_value and action='posted') then 'posted'
 when exists(select 1 from public.treasury_finance_events where request_id=request_value and action='rejected') then 'rejected'
 when exists(select 1 from public.treasury_finance_events where request_id=request_value and action='approved') then 'approved' else 'requested' end
$$;
create function finance_private.c9_finance_validate() returns trigger language plpgsql security definer set search_path='' as $$
declare q public.treasury_finance_requests%rowtype;c public.treasury_control_documents%rowtype;posting public.treasury_finance_postings%rowtype;
 j public.journal_entries%rowtype;expected_debit text;expected_credit text;cut_fingerprint text;
begin
 if tg_table_name='treasury_finance_requests' then
  if not exists(select 1 from public.financial_operations o where o.id=new.operation_id and o.actor_id=new.requested_by and o.state='completed' and o.operation_type='c9_finance_request' and o.result->>'request_id'=new.id::text and o.result->>'stage'='requested') then raise exception 'request operation incomplete';end if;
  if new.kind='adjustment' then
   select * into strict c from public.treasury_control_documents where id=new.count_id;
   if c.kind<>'count' or c.difference=0 or abs(c.difference)<>new.amount or new.cut is distinct from c.cut then raise exception 'invalid adjustment source';end if;
  end if;return null;
 end if;
 select * into strict q from public.treasury_finance_requests where id=new.request_id;
 if tg_table_name='treasury_finance_events' then
  if not exists(select 1 from public.financial_operations o where o.id=new.operation_id and o.actor_id=new.actor_id and o.state='completed' and o.operation_type='c9_finance_action' and o.result->>'request_id'=q.id::text and
   (o.result->>'stage'=new.action or new.action='approved' and o.result->>'stage'='posted')) then raise exception 'event operation incomplete';end if;
  if new.action='approved' and new.actor_id=q.requested_by then raise exception 'self approval forbidden';end if;
  if new.action='approved' and q.kind='adjustment' and exists(select 1 from public.treasury_control_documents where id=q.count_id and actor_id=new.actor_id) then raise exception 'counter cannot approve adjustment';end if;
  if new.action='rejected' and exists(select 1 from public.treasury_finance_events where request_id=q.id and action in ('approved','posted')) then raise exception 'rejected approved document';end if;
  if new.action='posted' and not exists(select 1 from public.treasury_finance_postings where request_id=q.id and operation_id=new.operation_id and posted_by=new.actor_id) then raise exception 'missing posting';end if;
  return null;
 end if;
 posting:=new;
 if posting.kind<>q.kind or posting.amount<>q.amount or posting.count_id is distinct from q.count_id then raise exception 'posting/request mismatch';end if;
 if not exists(select 1 from public.treasury_finance_events where request_id=q.id and action='approved' and actor_id<>q.requested_by) or
 not exists(select 1 from public.treasury_finance_events where request_id=q.id and action='posted' and operation_id=posting.operation_id) then raise exception 'missing independent approval/posting event';end if;
 select je.* into strict j from public.financial_document_references f join public.financial_events e on e.source_reference_id=f.id and e.operation_id=posting.operation_id
 join public.journal_entries je on je.event_id=e.id and je.status='posted' join public.financial_operations o on o.id=e.operation_id and o.state='completed'
 where f.treasury_posting_id=posting.id and f.kind=case when q.kind='expense' then 'PAY' else 'ADJ' end
 and e.event_type=case q.kind when 'expense' then 'office_expense_paid' when 'opening' then 'treasury_opening_posted'
 else case when posting.cash_delta<0 then 'treasury_shortage_adjusted' else 'treasury_overage_adjusted' end end;
 if j.reversal_of is not null then raise exception 'original posting cannot be a reversal';end if;
 expected_debit:=case when posting.cash_delta>0 then 'treasury_cash' when q.kind='expense' then 'office_operating_expense' else 'treasury_cash_shortage_expense' end;
 expected_credit:=case when posting.cash_delta<0 then 'treasury_cash' when q.kind='opening' then 'opening_balance_equity' else 'treasury_cash_overage_income' end;
 if (select count(*) from public.journal_lines where journal_entry_id=j.id)<>2 or
 not exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id and a.definition_code=expected_debit and a.owner_user_id is null and a.merchant_id is null where l.journal_entry_id=j.id and l.side='debit' and l.amount=q.amount) or
 not exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id and a.definition_code=expected_credit and a.owner_user_id is null and a.merchant_id is null where l.journal_entry_id=j.id and l.side='credit' and l.amount=q.amount) then raise exception 'wrong treasury accounting';end if;
 if q.kind='adjustment' then
  select * into strict c from public.treasury_control_documents where id=q.count_id;
  select md5(coalesce(string_agg(id::text,',' order by id),'')) into cut_fingerprint from finance_private.c9_cash_lines where operation_id<>posting.operation_id;
  if posting.cash_delta<>c.difference or cut_fingerprint is distinct from q.cut->>'fingerprint' then raise exception 'stale correction cut';end if;
 elsif q.kind='opening' and exists(select 1 from finance_private.c9_cash_lines where operation_id<>posting.operation_id) then raise exception 'opening after cash movements';end if;
 return null;
end $$;
create constraint trigger c9_finance_request_complete after insert on public.treasury_finance_requests deferrable initially deferred for each row execute function finance_private.c9_finance_validate();
create constraint trigger c9_finance_event_complete after insert on public.treasury_finance_events deferrable initially deferred for each row execute function finance_private.c9_finance_validate();
create constraint trigger c9_finance_posting_complete after insert on public.treasury_finance_postings deferrable initially deferred for each row execute function finance_private.c9_finance_validate();
create function finance_private.c9_finance_result(request_value uuid,action_value text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('state','completed','request_id',q.id,'kind',q.kind,'action',action_value,'stage',finance_private.c9_request_state(q.id),
 'amount',q.amount::text,'posting_id',p.id,'reference',f.public_reference,'posted',p.id is not null)
 from public.treasury_finance_requests q left join public.treasury_finance_postings p on p.request_id=q.id
 left join public.financial_document_references f on f.treasury_posting_id=p.id where q.id=request_value
$$;
create function public.request_treasury_finance(expected_user uuid,attempt_key uuid,request_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text:=request_input->>'kind';why text:=trim(request_input->>'reason');amount_value numeric;date_value date;count_value uuid;
 document_value uuid:=gen_random_uuid();c public.treasury_control_documents%rowtype;cut_value jsonb;op public.financial_operations%rowtype;r jsonb;canonical jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c9_finance_can(k,'request') then raise exception 'request permission required' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'C9 requires READ COMMITTED';end if;
 if jsonb_typeof(request_input) is distinct from 'object' or why is null or length(why) not between 2 and 1500 or
 exists(select 1 from jsonb_object_keys(request_input) v(key) where key not in ('kind','reason','amount','expense_type','source','cash_date','count_id')) then raise exception 'invalid finance input';end if;
 if k in ('expense','opening') then
  if jsonb_typeof(request_input->'amount') is distinct from 'string' or (request_input->>'amount')!~ '^[0-9]{1,20}(\.[0-9]{1,2})?$' then raise exception 'exact decimal SYP required';end if;
  amount_value:=(request_input->>'amount')::numeric;if amount_value<=0 then raise exception 'positive SYP required';end if;
 elsif k='adjustment' then
  if request_input ? 'amount' then raise exception 'adjustment amount is server-derived';end if;
  count_value:=(request_input->>'count_id')::uuid;if count_value is null then raise exception 'count required';end if;
 end if;
 if k='expense' and coalesce(length(trim(request_input->>'expense_type')),0) not between 2 and 100 then raise exception 'expense category required';end if;
 if k='opening' then
  if coalesce(length(trim(request_input->>'source')),0) not between 2 and 500 or coalesce(request_input->>'cash_date','')!~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'documented opening source/date required';end if;
  date_value:=(request_input->>'cash_date')::date;
 end if;
 canonical:=jsonb_build_object('kind',k,'reason',why,'amount',amount_value,'count_id',count_value,
 'expense_type',case when k='expense' then trim(request_input->>'expense_type') end,
 'source',case when k='opening' then trim(request_input->>'source') end,'cash_date',date_value);
 perform 1 from finance_private.c6_treasury_mutex where singleton for update;
 op:=finance_private.begin_operation('c9_finance_request',attempt_key,canonical);
 if op.state in ('completed','rejected') then return op.result;end if;
 if not (select enabled from finance_private.c9_control where singleton) then return finance_private.c4_reject_operation(op.id,'c9_disabled');end if;
 if k='adjustment' then
  select * into c from public.treasury_control_documents where id=count_value and kind='count' and difference<>0;
  if not found then return finance_private.c4_reject_operation(op.id,'count_unavailable');end if;
  if exists(select 1 from public.treasury_finance_requests where count_id=count_value and finance_private.c9_request_state(id)<>'rejected') then return finance_private.c4_reject_operation(op.id,'correction_exists');end if;
  cut_value:=finance_private.c9_cash_cut();if cut_value->>'fingerprint' is distinct from c.cut->>'fingerprint' then return finance_private.c4_reject_operation(op.id,'stale_count');end if;
  amount_value:=abs(c.difference);cut_value:=c.cut;
 elsif k='opening' then
  if date_value>(clock_timestamp() at time zone 'UTC')::date then return finance_private.c4_reject_operation(op.id,'invalid_cash_date');end if;
  cut_value:=finance_private.c9_cash_cut();
  if (cut_value->>'line_count')::bigint<>0 or exists(select 1 from public.treasury_finance_postings where kind='opening') then return finance_private.c4_reject_operation(op.id,'opening_after_movements');end if;
 end if;
 set constraints public.c9_finance_request_complete deferred;
 insert into public.treasury_finance_requests(id,kind,amount,reason,expense_type,source,cash_date,count_id,cut,requested_by,operation_id)
 values(document_value,k,amount_value,why,canonical->>'expense_type',canonical->>'source',date_value,count_value,cut_value,auth.uid(),op.id);
 r:=finance_private.c9_finance_result(document_value,'request');perform finance_private.complete_operation(op.id,r);set constraints all immediate;return r;
end $$;
create function public.act_on_treasury_finance(expected_user uuid,attempt_key uuid,target_request uuid,action_value text,action_reason text,owner_confirmed boolean default false)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.treasury_finance_requests%rowtype;op public.financial_operations%rowtype;status_value text;cut_value jsonb;
 posting_value uuid:=gen_random_uuid();ref_value uuid;event_value uuid;cash_delta numeric;debit_code text;credit_code text;event_name text;r jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'session mismatch' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'C9 requires READ COMMITTED';end if;
 if action_value is null or action_value not in ('approve','reject','pay') or action_reason is null or length(trim(action_reason)) not between 2 and 1500 then raise exception 'documented action required';end if;
 select * into q from public.treasury_finance_requests where id=target_request;
 if not found or not finance_private.c9_finance_can(q.kind,action_value) then raise exception 'financial authority required' using errcode='42501';end if;
 -- One global cash lock. No driver/store/merchant row locks are requested after this point.
 perform 1 from finance_private.c6_treasury_mutex where singleton for update;
 op:=finance_private.begin_operation('c9_finance_action',attempt_key,jsonb_build_object('request',target_request,'action',action_value,'reason',trim(action_reason),'owner_confirmed',owner_confirmed));
 if op.state in ('completed','rejected') then return op.result;end if;
 status_value:=finance_private.c9_request_state(q.id);
 if status_value='posted' and action_value in ('approve','pay') or status_value='approved' and action_value='approve' or status_value='rejected' and action_value='reject' then
  r:=finance_private.c9_finance_result(q.id,action_value);perform finance_private.complete_operation(op.id,r);set constraints all immediate;return r;
 end if;
 if not (select enabled from finance_private.c9_control where singleton) then return finance_private.c4_reject_operation(op.id,'c9_disabled');end if;
 if action_value in ('approve','reject') and status_value<>'requested' or action_value='pay' and status_value<>'approved' then return finance_private.c4_reject_operation(op.id,'invalid_stage');end if;
 if action_value='approve' and q.requested_by=auth.uid() then return finance_private.c4_reject_operation(op.id,'self_approval');end if;
 if action_value='approve' and q.kind='adjustment' and exists(select 1 from public.treasury_control_documents where id=q.count_id and actor_id=auth.uid()) then return finance_private.c4_reject_operation(op.id,'counter_approval');end if;
 if q.kind='opening' and action_value='approve' and (owner_confirmed is distinct from true or not (select opening_enabled from finance_private.c9_control where singleton)) then return finance_private.c4_reject_operation(op.id,'opening_disabled_or_unconfirmed');end if;
 if action_value='approve' and q.kind='adjustment' then
  cut_value:=finance_private.c9_cash_cut();if cut_value->>'fingerprint' is distinct from q.cut->>'fingerprint' then return finance_private.c4_reject_operation(op.id,'stale_count');end if;
  if exists(select 1 from public.treasury_finance_postings where count_id=q.count_id) then return finance_private.c4_reject_operation(op.id,'correction_exists');end if;
 end if;
 if action_value='approve' and q.kind='opening' and (exists(select 1 from finance_private.c9_cash_lines) or exists(select 1 from public.treasury_finance_postings where kind='opening')) then return finance_private.c4_reject_operation(op.id,'opening_after_movements');end if;
 -- Check cash BEFORE inserting approval/posting. Inflows never bypass precision or source validation.
 if action_value='pay' or action_value='approve' and q.kind='adjustment' then
  cash_delta:=case when q.kind='expense' then -q.amount else (select difference from public.treasury_control_documents where id=q.count_id) end;
  if cash_delta<0 and -cash_delta>finance_private.c6_treasury_balance() then return finance_private.c4_reject_operation(op.id,'insufficient_treasury');end if;
 end if;
 set constraints public.c9_finance_event_complete,public.c9_finance_posting_complete deferred;
 if action_value in ('approve','reject') then
  insert into public.treasury_finance_events(request_id,action,actor_id,reason,operation_id) values(q.id,case action_value when 'approve' then 'approved' else 'rejected' end,auth.uid(),trim(action_reason),op.id);
 end if;
 if action_value='pay' or action_value='approve' and q.kind in ('adjustment','opening') then
  cash_delta:=case q.kind when 'expense' then -q.amount when 'opening' then q.amount else (select difference from public.treasury_control_documents where id=q.count_id) end;
  debit_code:=case when cash_delta>0 then 'treasury_cash' when q.kind='expense' then 'office_operating_expense' else 'treasury_cash_shortage_expense' end;
  credit_code:=case when cash_delta<0 then 'treasury_cash' when q.kind='opening' then 'opening_balance_equity' else 'treasury_cash_overage_income' end;
  event_name:=case q.kind when 'expense' then 'office_expense_paid' when 'opening' then 'treasury_opening_posted' else case when cash_delta<0 then 'treasury_shortage_adjusted' else 'treasury_overage_adjusted' end end;
  insert into public.treasury_finance_postings(id,request_id,kind,count_id,amount,cash_delta,operation_id,posted_by) values(posting_value,q.id,q.kind,q.count_id,q.amount,cash_delta,op.id,auth.uid());
  insert into public.financial_document_references(kind,document_id,treasury_posting_id) values(case q.kind when 'expense' then 'PAY' else 'ADJ' end,posting_value,posting_value) returning id into ref_value;
  event_value:=finance_private.record_financial_event(ref_value,event_name,op.id);
  perform finance_private.post_journal(event_value,jsonb_build_array(
   jsonb_build_object('account_id',finance_private.c4_account(debit_code),'side','debit','amount',q.amount),
   jsonb_build_object('account_id',finance_private.c4_account(credit_code),'side','credit','amount',q.amount)),trim(action_reason));
  insert into public.treasury_finance_events(request_id,action,actor_id,reason,operation_id) values(q.id,'posted',auth.uid(),trim(action_reason),op.id);
 end if;
 r:=finance_private.c9_finance_result(q.id,action_value);perform finance_private.complete_operation(op.id,r);set constraints all immediate;return r;
end $$;
create function public.read_treasury_finance(expected_user uuid,kind_value text,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows_value jsonb;counts_value jsonb;cut_value jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not public.can_read_treasury_finance(kind_value) then raise exception 'financial read permission required' using errcode='42501';end if;
 if kind_value is null or kind_value not in ('expense','adjustment','opening') or page_number is null or page_number<0 or page_number>100000 then raise exception 'invalid finance page';end if;
 if kind_value='adjustment' then cut_value:=finance_private.c9_cash_cut();end if;
 select coalesce(jsonb_agg(v.payload order by v.created_at desc,v.id desc),'[]') into rows_value from (
  select q.created_at,q.id,jsonb_build_object('id',q.id,'kind',q.kind,'amount',q.amount::text,'reason',q.reason,'expense_type',q.expense_type,'source',q.source,'cash_date',q.cash_date,
  'count_id',q.count_id,'count_actor',(select actor_id from public.treasury_control_documents where id=q.count_id),'requested_by',q.requested_by,'at',q.created_at,
  'stage',finance_private.c9_request_state(q.id),'posting_id',p.id,'reference',f.public_reference,'cash_delta',p.cash_delta::text,
  'difference',d.difference::text,'book',d.cut->>'balance','counted',d.amount::text,'cut_current',case when q.kind='adjustment' then q.cut->>'fingerprint'=cut_value->>'fingerprint' else null end,
  'events',(select coalesce(jsonb_agg(jsonb_build_object('action',e.action,'actor_id',e.actor_id,'reason',e.reason,'at',e.created_at,'operation_id',e.operation_id) order by e.created_at,case e.action when 'approved' then 1 when 'posted' then 2 else 3 end,e.id),'[]') from public.treasury_finance_events e where e.request_id=q.id)) payload
  from public.treasury_finance_requests q left join public.treasury_finance_postings p on p.request_id=q.id left join public.financial_document_references f on f.treasury_posting_id=p.id left join public.treasury_control_documents d on d.id=q.count_id
  where q.kind=kind_value order by q.created_at desc,q.id desc limit 21 offset page_number*20
 ) v;
 counts_value:='[]'::jsonb;
 if kind_value='adjustment' then
  select coalesce(jsonb_agg(x.payload order by x.created_at desc,x.id desc),'[]') into counts_value from (
   select d.created_at,d.id,jsonb_build_object('id',d.id,'difference',d.difference::text,'counted',d.amount::text,'book',(d.cut->>'balance'),'actor_id',d.actor_id,'at',d.created_at,
   'eligible',d.cut->>'fingerprint'=cut_value->>'fingerprint' and not exists(select 1 from public.treasury_finance_requests q where q.count_id=d.id and finance_private.c9_request_state(q.id)<>'rejected')) payload
   from public.treasury_control_documents d where d.kind='count' and d.difference<>0 order by d.created_at desc,d.id desc limit 20 offset page_number*20
  ) x;
 end if;
 return jsonb_build_object('kind',kind_value,'rows',case when jsonb_array_length(rows_value)>20 then rows_value-20 else rows_value end,'has_more',jsonb_array_length(rows_value)>20,
 'counts',counts_value,'enabled',(select enabled from finance_private.c9_control where singleton),'opening_enabled',(select opening_enabled from finance_private.c9_control where singleton),
 'permissions',jsonb_build_object('request',finance_private.c9_finance_can(kind_value,'request'),'approve',finance_private.c9_finance_can(kind_value,'approve'),'pay',finance_private.c9_finance_can(kind_value,'pay')),
 'treasury_balance',case when finance_private.c9_can('dashboard') or finance_private.c9_can('ledger') or finance_private.c9_finance_can(kind_value,'pay') then finance_private.c6_treasury_balance()::text else null end);
end $$;
revoke all on function public.can_read_treasury_finance(text),public.request_treasury_finance(uuid,uuid,jsonb),public.act_on_treasury_finance(uuid,uuid,uuid,text,text,boolean),public.read_treasury_finance(uuid,text,integer) from public,anon,service_role;
grant execute on function public.can_read_treasury_finance(text),public.request_treasury_finance(uuid,uuid,jsonb),public.act_on_treasury_finance(uuid,uuid,uuid,text,text,boolean),public.read_treasury_finance(uuid,text,integer) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;
commit;
