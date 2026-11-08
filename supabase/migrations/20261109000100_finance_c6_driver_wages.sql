-- C6 LOCAL DRAFT. Requires revised UNAPPLIED C4 extension hook + C5. Admission OFF.
begin;
do $$ begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'C6 requires READ COMMITTED';end if;
 if to_regclass('public.driver_cash_handover_attempts') is null
   or to_regprocedure('finance_private.c4_delivery_extensions(uuid,uuid)') is null
   or to_regprocedure('finance_private.c4_defer_extensions()') is null
   or position('c4_delivery_extensions' in pg_get_functiondef(to_regprocedure('public.complete_delivery_and_collect_cash(uuid,uuid,uuid,bigint)')))=0 then
   raise exception 'C6 requires C5 and revised unapplied C4 extension';end if;
end $$;
create table finance_private.c6_control(singleton boolean primary key default true check(singleton),accept_tasks boolean not null default false,payout_enabled boolean not null default false);
insert into finance_private.c6_control default values;
create table finance_private.c6_treasury_mutex(singleton boolean primary key default true check(singleton));
insert into finance_private.c6_treasury_mutex default values;
create table finance_private.c6_permissions(user_id uuid primary key references public.profiles(id),may_edit_policy boolean not null default false,may_pay_wages boolean not null default false);
revoke all on finance_private.c6_control,finance_private.c6_treasury_mutex,finance_private.c6_permissions from public,anon,authenticated,service_role;
create function finance_private.c6_can(permission_value text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.is_admin(),false) and exists(select 1 from finance_private.c6_permissions where user_id=auth.uid()
   and case permission_value when 'policy' then may_edit_policy when 'pay' then may_pay_wages else false end)
$$;
create table public.driver_wage_policies(
 id uuid primary key default gen_random_uuid(),version bigint generated always as identity unique,
 percentage numeric not null check(percentage>=0 and percentage<=100 and percentage=round(percentage,4)),
 effective_at timestamptz not null default clock_timestamp(),changed_by uuid references public.profiles(id),reason text not null check(char_length(trim(reason)) between 2 and 1500),
 check(changed_by is not null or version=1)
);
insert into public.driver_wage_policies(percentage,reason) values(70,'النسبة الابتدائية 70 بالمئة للمهام الجديدة المؤهلة فقط');
revoke all on sequence public.driver_wage_policies_version_seq from public,anon,authenticated,service_role;
create table finance_private.c6_task_births(task_id uuid primary key references public.delivery_tasks(id),birth_xid bigint not null);
revoke all on finance_private.c6_task_births from public,anon,authenticated,service_role;
create table public.delivery_wage_snapshots(
 task_id uuid primary key references public.delivery_tasks(id),customer_order_id uuid not null references public.customer_orders(id),
 policy_id uuid not null references public.driver_wage_policies(id),percentage numeric not null check(percentage>=0 and percentage<=100 and percentage=round(percentage,4)),
 captured_at timestamptz not null default clock_timestamp()
);
create table public.driver_wage_entitlements(
 task_id uuid primary key references public.delivery_wage_snapshots(task_id) references public.delivery_collection_results(task_id),driver_id uuid not null references public.profiles(id),
 operation_id uuid not null references public.financial_operations(id),fee_amount numeric not null check(fee_amount>=0 and fee_amount=round(fee_amount,2)),
 amount numeric not null check(amount>=0 and amount<100000000000000000000 and amount=round(amount,2)),pricing_version bigint not null,
 event_id uuid unique references public.financial_events(id),accrued_at timestamptz not null default clock_timestamp(),check((amount=0)=(event_id is null))
);
create index c6_entitlements_driver on public.driver_wage_entitlements(driver_id,accrued_at,task_id);
create table public.driver_cash_receipt_allocations(
 receipt_id uuid not null references public.driver_cash_handover_attempts(id),task_id uuid not null references public.delivery_collection_results(task_id),
 driver_id uuid not null references public.profiles(id),amount numeric not null check(amount>0 and amount=round(amount,2)),
 allocated_at timestamptz not null default clock_timestamp(),basis text not null check(basis in ('confirmed_receipt_fifo','historical_receipt_fifo')),primary key(receipt_id,task_id)
);
create index c6_allocations_task on public.driver_cash_receipt_allocations(task_id);
create index c6_allocations_driver on public.driver_cash_receipt_allocations(driver_id);
create table public.driver_wage_payments(
 id uuid primary key default gen_random_uuid(),driver_id uuid not null references public.profiles(id),amount numeric not null check(amount>0 and amount<100000000000000000000 and amount=round(amount,2)),
 operation_id uuid not null unique references public.financial_operations(id),paid_by uuid not null references public.profiles(id),paid_at timestamptz not null default clock_timestamp()
);
create table public.driver_wage_payment_items(
 payment_id uuid not null references public.driver_wage_payments(id),task_id uuid not null unique references public.driver_wage_entitlements(task_id),
 driver_id uuid not null references public.profiles(id),amount numeric not null check(amount>0 and amount=round(amount,2)),primary key(payment_id,task_id)
);
create index c6_payment_driver on public.driver_wage_payments(driver_id,paid_at,id);
alter table public.financial_document_references add column wage_payment_id uuid references public.driver_wage_payments(id);
alter table public.financial_document_references drop constraint c5_reference_one_document,drop constraint c5_reference_kind_document;
alter table public.financial_document_references add constraint c6_reference_one_document check(num_nonnulls(customer_order_id,store_order_id,delivery_task_id,subscription_id,subscription_invoice_id,journal_entry_id,cash_handover_id,wage_payment_id)=1);
alter table public.financial_document_references add constraint c6_reference_kind_document check(case kind
 when 'ORD' then customer_order_id=document_id and customer_order_id is not null
 when 'SUB' then store_order_id=document_id and store_order_id is not null
 when 'DLV' then delivery_task_id=document_id and delivery_task_id is not null
 when 'MSB' then subscription_id=document_id and subscription_id is not null
 when 'SIN' then subscription_invoice_id=document_id and subscription_invoice_id is not null
 when 'TXN' then journal_entry_id=document_id and journal_entry_id is not null
 when 'RCT' then cash_handover_id=document_id and cash_handover_id is not null
 when 'PAY' then wage_payment_id=document_id and wage_payment_id is not null else false end);
create unique index c6_pay_reference_once on public.financial_document_references(wage_payment_id) where wage_payment_id is not null;
do $$ declare t text;begin
 foreach t in array array['driver_wage_policies','delivery_wage_snapshots','driver_wage_entitlements','driver_cash_receipt_allocations','driver_wage_payments','driver_wage_payment_items'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create trigger c6_immutable before update or delete on public.%I for each row execute function finance_private.reject_mutation()',t);
 end loop;
end $$;
create policy c6_policy_read on public.driver_wage_policies for select to authenticated using(public.is_admin());
create policy c6_snapshot_read on public.delivery_wage_snapshots for select to authenticated using(public.is_admin() or exists(select 1 from public.delivery_tasks d where d.id=task_id and d.driver_id=auth.uid()));
create policy c6_entitlement_read on public.driver_wage_entitlements for select to authenticated using(public.is_admin() or driver_id=auth.uid());
create policy c6_allocation_read on public.driver_cash_receipt_allocations for select to authenticated using(public.is_admin() or driver_id=auth.uid());
create policy c6_payment_read on public.driver_wage_payments for select to authenticated using(public.is_admin() or driver_id=auth.uid());
create policy c6_item_read on public.driver_wage_payment_items for select to authenticated using(public.is_admin() or driver_id=auth.uid());
create function finance_private.c6_capture_policy() returns trigger language plpgsql security definer set search_path='' as $$
declare enabled_value boolean;p public.driver_wage_policies%rowtype;
begin
 if not finance_private.c4_is_order(new.customer_order_id) then return new;end if;
 select accept_tasks into enabled_value from finance_private.c6_control where singleton for share;
 if not coalesce(enabled_value,false) then return new;end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'C6 snapshot requires READ COMMITTED';end if;
 select * into strict p from public.driver_wage_policies order by version desc limit 1;
 insert into finance_private.c6_task_births values(new.id,txid_current());
 insert into public.delivery_wage_snapshots(task_id,customer_order_id,policy_id,percentage) values(new.id,new.customer_order_id,p.id,p.percentage);return new;
end $$;
create trigger c6_capture_on_new_dlv after insert on public.delivery_tasks for each row execute function finance_private.c6_capture_policy();
create function finance_private.c6_validate_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.delivery_tasks d join public.driver_wage_policies p on p.id=new.policy_id where d.id=new.task_id and exists(select 1 from finance_private.c6_task_births b where b.task_id=d.id and b.birth_xid=txid_current()) and d.customer_order_id=new.customer_order_id and finance_private.c4_is_order(d.customer_order_id) and p.percentage=new.percentage) then raise exception 'invalid C6 snapshot';end if;
 new.captured_at:=clock_timestamp();return new;
end $$;
create trigger c6_validate_snapshot before insert on public.delivery_wage_snapshots for each row execute function finance_private.c6_validate_snapshot();
create or replace function finance_private.c4_delivery_extensions(target_task uuid,target_operation uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.delivery_wage_snapshots%rowtype;r public.delivery_collection_results%rowtype;p public.order_pricing_current%rowtype;
 amount_value numeric;ref_value uuid;event_value uuid;expense uuid;payable uuid;
begin
 select * into s from public.delivery_wage_snapshots where task_id=target_task;if not found then return;end if;
 select * into strict r from public.delivery_collection_results where task_id=target_task and operation_id=target_operation;
 select * into strict p from public.order_pricing_current where customer_order_id=s.customer_order_id;
 if not finance_private.c4_is_order(s.customer_order_id) or r.driver_id is distinct from auth.uid() or p.review_required or p.version<>r.pricing_version
   or not exists(select 1 from public.delivery_tasks where id=target_task and status='delivered' and driver_id=r.driver_id)
   or not exists(select 1 from public.financial_operations where id=target_operation and state='pending' and actor_id=auth.uid()) then raise exception 'valid atomic C4 delivery required for wage';end if;
 amount_value:=round(p.delivery_fee*s.percentage/100,2); -- Only rounding boundary: exact nonnegative numeric HALF-UP.
 if amount_value>0 then
  select id into strict ref_value from public.financial_document_references where kind='DLV' and document_id=target_task;
  event_value:=finance_private.record_financial_event(ref_value,'driver_wage_accrued',target_operation);
  expense:=finance_private.c4_account('driver_earnings_expense');payable:=finance_private.c4_account('driver_earnings_payable',r.driver_id);
  perform finance_private.post_journal(event_value,jsonb_build_array(jsonb_build_object('account_id',expense,'side','debit','amount',amount_value),jsonb_build_object('account_id',payable,'side','credit','amount',amount_value)),'driver wage accrued from final delivery fee');
 end if;
 insert into public.driver_wage_entitlements(task_id,driver_id,operation_id,fee_amount,amount,pricing_version,event_id) values(target_task,r.driver_id,target_operation,p.delivery_fee,amount_value,p.version,event_value);
end $$;
create function finance_private.c6_require_accrual() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.delivery_wage_snapshots where task_id=new.task_id) and not exists(
   select 1 from public.driver_wage_entitlements e join public.delivery_wage_snapshots s on s.task_id=e.task_id join public.order_pricing_current p on p.customer_order_id=s.customer_order_id
   where e.task_id=new.task_id and e.driver_id=new.driver_id and e.operation_id=new.operation_id and e.pricing_version=new.pricing_version and e.fee_amount=p.delivery_fee and e.amount=round(e.fee_amount*s.percentage/100,2)
     and (e.amount=0 or exists(select 1 from public.journal_entries j join public.financial_events f on f.id=j.event_id
       join public.financial_document_references d on d.id=f.source_reference_id and d.kind='DLV' and d.document_id=e.task_id
       where j.event_id=e.event_id and j.status='posted' and f.operation_id=e.operation_id and f.event_type='driver_wage_accrued'
         and (select count(*) from public.journal_lines where journal_entry_id=j.id)=2
         and exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=j.id and l.side='debit' and l.amount=e.amount and a.definition_code='driver_earnings_expense')
         and exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=j.id and l.side='credit' and l.amount=e.amount and a.definition_code='driver_earnings_payable' and a.owner_user_id=e.driver_id)))) then raise exception 'C6 enrolled delivery must atomically accrue its wage';end if;
 return null;
end $$;
create constraint trigger c6_accrual_required after insert on public.delivery_collection_results deferrable initially deferred for each row execute function finance_private.c6_require_accrual();

create or replace function finance_private.c4_defer_extensions() returns void language plpgsql security definer set search_path='' as $$
begin set constraints public.c6_accrual_required deferred;end $$;
create function finance_private.c6_validate_allocation() returns trigger language plpgsql security definer set search_path='' as $$
declare h public.driver_cash_handover_attempts%rowtype;r public.delivery_collection_results%rowtype;
begin
 select * into strict h from public.driver_cash_handover_attempts where id=new.receipt_id;
 perform 1 from public.profiles where id=h.driver_id for update;
 select * into strict r from public.delivery_collection_results where task_id=new.task_id;
 if h.outcome<>'confirmed' or h.driver_id<>new.driver_id or r.driver_id<>new.driver_id or r.kind<>'cash_delivery' or r.completed_at>h.attempted_at
   or not exists(select 1 from public.financial_events e join public.journal_entries j on j.event_id=e.id and j.status='posted'
     join public.journal_lines l on l.journal_entry_id=j.id and l.side='debit' and l.amount=r.amount
     join public.financial_accounts a on a.id=l.account_id and a.definition_code='driver_cash' and a.owner_user_id=r.driver_id
     join public.financial_operations o on o.id=e.operation_id and o.state='completed' where e.id=r.cash_event_id and e.operation_id=r.operation_id and e.event_type='full_cash_collected')
   or not exists(select 1 from public.financial_document_references f join public.financial_events e on e.source_reference_id=f.id and e.operation_id=h.operation_id and e.event_type='office_cash_received'
     join public.journal_entries j on j.event_id=e.id and j.status='posted' join public.financial_operations o on o.id=e.operation_id and o.state='completed' where f.cash_handover_id=h.id and f.kind='RCT') then raise exception 'allocation needs confirmed posted RCT and earlier collected DLV';end if;
 if coalesce((select sum(amount) from public.driver_cash_receipt_allocations where receipt_id=h.id),0)+new.amount>h.counted_amount
   or coalesce((select sum(amount) from public.driver_cash_receipt_allocations where task_id=r.task_id),0)+new.amount>r.amount then raise exception 'allocation exceeds RCT or DLV cash';end if;
 new.allocated_at:=clock_timestamp();return new;
end $$;
create trigger c6_allocation_validate before insert on public.driver_cash_receipt_allocations for each row execute function finance_private.c6_validate_allocation();
create function finance_private.c6_allocate_receipt(receipt_value uuid,basis_value text default 'confirmed_receipt_fifo') returns void language plpgsql security definer set search_path='' as $$
declare h public.driver_cash_handover_attempts%rowtype;r record;remaining numeric;piece numeric;existing_sum numeric;
begin
 select * into strict h from public.driver_cash_handover_attempts where id=receipt_value and outcome='confirmed';
 perform 1 from public.profiles where id=h.driver_id for update;
 select coalesce(sum(amount),0) into existing_sum from public.driver_cash_receipt_allocations where receipt_id=h.id;
 if existing_sum=h.counted_amount then return;end if;
 if existing_sum<>0 then raise exception 'partial old allocation needs review';end if;
 remaining:=h.counted_amount;
 for r in select d.task_id,d.amount-coalesce((select sum(a.amount) from public.driver_cash_receipt_allocations a where a.task_id=d.task_id),0) as due
   from public.delivery_collection_results d where d.driver_id=h.driver_id and d.kind='cash_delivery' and d.completed_at<=h.attempted_at order by d.completed_at,d.task_id loop
   piece:=least(remaining,r.due);
   if piece>0 then insert into public.driver_cash_receipt_allocations(receipt_id,task_id,driver_id,amount,basis) values(h.id,r.task_id,h.driver_id,piece,basis_value);remaining:=remaining-piece;end if;
   exit when remaining=0;
 end loop;
 if remaining<>0 then raise exception 'RCT cannot be proved against collected DLV cash; no synthetic allocation';end if;
end $$;
create function finance_private.c6_allocate_new_rct() returns trigger language plpgsql security definer set search_path='' as $$
begin perform finance_private.c6_allocate_receipt(new.id);return null;end $$;
create constraint trigger c6_allocate_rct after insert on public.driver_cash_handover_attempts deferrable initially deferred for each row when(new.outcome='confirmed') execute function finance_private.c6_allocate_new_rct();
-- Metadata-only: existing REAL RCTs are reconstructed chronologically, without new money or retroactive wage rates.
-- Any unverifiable historical receipt aborts the entire migration.
do $$ declare h record;begin
 for h in select id from public.driver_cash_handover_attempts where outcome='confirmed' order by attempted_at,id loop
  perform finance_private.c6_allocate_receipt(h.id,'historical_receipt_fifo');
 end loop;
end $$;
alter function public.confirm_c5_cash_handover(uuid,uuid,uuid,uuid,numeric) set schema finance_private;
alter function finance_private.confirm_c5_cash_handover(uuid,uuid,uuid,uuid,numeric) rename to c6_previous_confirm_handover;
create function public.confirm_c5_cash_handover(target_request uuid,target_driver uuid,expected_user uuid,attempt_key uuid,counted_amount numeric) returns jsonb language plpgsql security definer set search_path='' as $$
begin set constraints public.c6_allocate_rct deferred;return finance_private.c6_previous_confirm_handover(target_request,target_driver,expected_user,attempt_key,counted_amount);end $$;
create function finance_private.c6_cash_remaining(task_value uuid) returns numeric language sql stable security definer set search_path='' as $$
 select r.amount-coalesce((select sum(a.amount) from public.driver_cash_receipt_allocations a where a.task_id=r.task_id),0) from public.delivery_collection_results r where r.task_id=task_value
$$;
create function finance_private.c6_treasury_balance() returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(case l.side when 'debit' then l.amount else -l.amount end),0) from public.financial_accounts a join public.journal_lines l on l.account_id=a.id
 join public.journal_entries j on j.id=l.journal_entry_id and j.status='posted' join public.financial_events e on e.id=j.event_id
 join public.financial_operations o on o.id=e.operation_id and o.state='completed' where a.definition_code='treasury_cash'
$$;
create function finance_private.c6_position(driver_value uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare earned numeric;paid numeric;balance numeric;blocked numeric;available numeric;review_value boolean;
begin
 select coalesce(sum(l.amount),0) into earned from public.driver_wage_entitlements e join public.financial_events f on f.id=e.event_id and f.operation_id=e.operation_id
   join public.journal_entries j on j.event_id=f.id and j.status='posted' join public.financial_operations o on o.id=f.operation_id and o.state='completed'
   join public.journal_lines l on l.journal_entry_id=j.id and l.side='credit'
   join public.financial_accounts a on a.id=l.account_id and a.definition_code='driver_earnings_payable' and a.owner_user_id=driver_value where e.driver_id=driver_value;
 select coalesce(sum(l.amount),0) into paid from public.driver_wage_payments p join public.financial_operations o on o.id=p.operation_id and o.state='completed'
   join public.financial_document_references f on f.wage_payment_id=p.id join public.financial_events e on e.source_reference_id=f.id and e.operation_id=o.id
   join public.journal_entries j on j.event_id=e.id and j.status='posted' join public.journal_lines l on l.journal_entry_id=j.id and l.side='debit'
   join public.financial_accounts a on a.id=l.account_id and a.definition_code='driver_earnings_payable' and a.owner_user_id=driver_value where p.driver_id=driver_value;
 select coalesce(sum(case l.side when 'credit' then l.amount else -l.amount end),0) into balance from public.financial_accounts a
   join public.journal_lines l on l.account_id=a.id join public.journal_entries j on j.id=l.journal_entry_id and j.status='posted'
   join public.financial_events f on f.id=j.event_id join public.financial_operations o on o.id=f.operation_id and o.state='completed'
   where a.definition_code='driver_earnings_payable' and a.owner_user_id=driver_value;
 review_value:=balance<>earned-paid or balance<0 or (finance_private.c5_position(driver_value)->>'ledger_requires_review')::boolean
   or exists(select 1 from public.driver_wage_entitlements e join public.delivery_wage_snapshots s on s.task_id=e.task_id
     left join public.order_pricing_current p on p.customer_order_id=s.customer_order_id
     where e.driver_id=driver_value and not exists(select 1 from public.driver_wage_payment_items i where i.task_id=e.task_id)
       and (p.customer_order_id is null or p.review_required or p.version<>e.pricing_version or p.delivery_fee<>e.fee_amount));
 select coalesce(sum(l.amount),0) into available from public.driver_wage_entitlements e
   join public.financial_events f on f.id=e.event_id and f.operation_id=e.operation_id join public.financial_operations o on o.id=f.operation_id and o.state='completed'
   join public.journal_entries j on j.event_id=f.id and j.status='posted' join public.journal_lines l on l.journal_entry_id=j.id and l.side='credit'
   join public.financial_accounts a on a.id=l.account_id and a.definition_code='driver_earnings_payable' and a.owner_user_id=driver_value
   where e.driver_id=driver_value and e.amount>0
   and not exists(select 1 from public.driver_wage_payment_items i where i.task_id=e.task_id) and finance_private.c6_cash_remaining(e.task_id)=0;
 if review_value then available:=0;end if;blocked:=earned-paid-available;
 return jsonb_build_object('earned',earned::text,'paid',paid::text,'outstanding',balance::text,'available',available::text,'blocked',blocked::text,'review_required',review_value);
end $$;
create function public.save_c6_wage_policy(expected_user uuid,attempt_key uuid,expected_policy uuid,percentage_value numeric,change_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare op public.financial_operations%rowtype;current_policy uuid;next_id uuid;r jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c6_can('policy') then raise exception 'authorized policy editor required' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'C6 writes require READ COMMITTED';end if;
 if attempt_key is null or percentage_value is null or percentage_value<0 or percentage_value>100 or percentage_value<>round(percentage_value,4)
   or change_reason is null or char_length(trim(change_reason)) not between 2 and 1500 then raise exception 'invalid exact policy';end if;
 perform 1 from finance_private.c6_control where singleton for update;
 op:=finance_private.begin_operation('c6_policy',attempt_key,jsonb_build_object('previous',expected_policy,'percentage',percentage_value,'reason',trim(change_reason)));
 if op.state in ('completed','rejected') then return op.result;end if;
 select id into strict current_policy from public.driver_wage_policies order by version desc limit 1;
 if current_policy is distinct from expected_policy then return finance_private.c4_reject_operation(op.id,'policy_changed');end if;
 insert into public.driver_wage_policies(percentage,changed_by,reason) values(percentage_value,auth.uid(),trim(change_reason)) returning id into next_id;
 r:=jsonb_build_object('state','completed','kind','policy','policy_id',next_id,'percentage',percentage_value::text);
 perform finance_private.complete_operation(op.id,r);set constraints all immediate;return r;
end $$;
create function finance_private.c6_validate_payment_item() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.driver_wage_entitlements e join public.driver_wage_payments p on p.id=new.payment_id
   where e.task_id=new.task_id and p.driver_id=e.driver_id and new.driver_id=e.driver_id and new.amount=e.amount and e.amount>0 and finance_private.c6_cash_remaining(e.task_id)=0) then raise exception 'only full settled wage may be paid';end if;
 return new;
end $$;
create trigger c6_payment_item_validate before insert on public.driver_wage_payment_items for each row execute function finance_private.c6_validate_payment_item();
create function finance_private.c6_require_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.financial_operations o join public.financial_document_references f on f.wage_payment_id=new.id and f.kind='PAY'
   join public.financial_events e on e.source_reference_id=f.id and e.operation_id=o.id and e.event_type='driver_wage_paid' join public.journal_entries j on j.event_id=e.id and j.status='posted'
   where o.id=new.operation_id and o.state='completed' and (select sum(i.amount) from public.driver_wage_payment_items i where i.payment_id=new.id)=new.amount
   and (select count(*) from public.journal_lines where journal_entry_id=j.id)=2
   and exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=j.id and l.side='debit' and l.amount=new.amount and a.definition_code='driver_earnings_payable' and a.owner_user_id=new.driver_id)
   and exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=j.id and l.side='credit' and l.amount=new.amount and a.definition_code='treasury_cash')) then raise exception 'wage payout needs posted PAY transfer';end if;
 return null;
end $$;
create constraint trigger c6_payment_complete after insert on public.driver_wage_payments deferrable initially deferred for each row execute function finance_private.c6_require_payment();
create function public.pay_c6_driver_wages(target_driver uuid,expected_user uuid,attempt_key uuid,target_tasks uuid[],expected_amount numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare op public.financial_operations%rowtype;canonical_tasks uuid[];total_value numeric;payment_value uuid;ref_value uuid;event_value uuid;payable uuid;treasury uuid;r jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c6_can('pay') then raise exception 'authorized wage payer required' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'C6 writes require READ COMMITTED';end if;
 if attempt_key is null or target_tasks is null or cardinality(target_tasks) not between 1 and 100 or array_position(target_tasks,null) is not null
   or expected_amount is null or expected_amount<=0 or expected_amount>=100000000000000000000 or expected_amount<>round(expected_amount,2) then raise exception 'invalid payout intent';end if;
 select array_agg(distinct t order by t) into canonical_tasks from unnest(target_tasks) t;
 if cardinality(canonical_tasks)<>cardinality(target_tasks) then raise exception 'duplicate wage selected';end if;
 perform 1 from public.profiles where id=target_driver and role='driver' for update;if not found then raise exception 'driver unavailable';end if;
 perform 1 from finance_private.c6_treasury_mutex where singleton for update;
 op:=finance_private.begin_operation('c6_pay',attempt_key,jsonb_build_object('driver',target_driver,'tasks',to_jsonb(canonical_tasks),'expected_amount',expected_amount));
 if op.state in ('completed','rejected') then return op.result;end if;
 if not exists(select 1 from finance_private.c6_control where singleton and payout_enabled) then return finance_private.c4_reject_operation(op.id,'payout_disabled');end if;
 if (finance_private.c6_position(target_driver)->>'review_required')::boolean then return finance_private.c4_reject_operation(op.id,'ledger_requires_review');end if;
 if (select count(*) from public.driver_wage_entitlements where task_id=any(canonical_tasks) and driver_id=target_driver)<>cardinality(canonical_tasks)
   or exists(select 1 from public.driver_wage_entitlements e where e.task_id=any(canonical_tasks) and (e.amount<=0 or finance_private.c6_cash_remaining(e.task_id)<>0 or exists(select 1 from public.driver_wage_payment_items i where i.task_id=e.task_id))) then return finance_private.c4_reject_operation(op.id,'wage_not_available');end if;
 select sum(amount) into total_value from public.driver_wage_entitlements where task_id=any(canonical_tasks) and driver_id=target_driver;
 if total_value is distinct from expected_amount then return finance_private.c4_reject_operation(op.id,'amount_changed');end if;
 if total_value>finance_private.c6_treasury_balance() then return finance_private.c4_reject_operation(op.id,'insufficient_treasury');end if;
 set constraints public.c6_payment_complete deferred;
 insert into public.driver_wage_payments(driver_id,amount,operation_id,paid_by) values(target_driver,total_value,op.id,auth.uid()) returning id into payment_value;
 insert into public.driver_wage_payment_items(payment_id,task_id,driver_id,amount) select payment_value,task_id,target_driver,amount from public.driver_wage_entitlements where task_id=any(canonical_tasks) order by task_id;
 insert into public.financial_document_references(kind,document_id,wage_payment_id) values('PAY',payment_value,payment_value) returning id into ref_value;
 event_value:=finance_private.record_financial_event(ref_value,'driver_wage_paid',op.id);
 payable:=finance_private.c4_account('driver_earnings_payable',target_driver);treasury:=finance_private.c4_account('treasury_cash');
 perform finance_private.post_journal(event_value,jsonb_build_array(jsonb_build_object('account_id',payable,'side','debit','amount',total_value),jsonb_build_object('account_id',treasury,'side','credit','amount',total_value)),'office paid full settled driver wages');
 r:=jsonb_build_object('state','completed','kind','payment','payment_id',payment_value,'driver_id',target_driver,'amount',total_value::text,'reference',(select public_reference from public.financial_document_references where id=ref_value));
 perform finance_private.complete_operation(op.id,r);set constraints all immediate;return r;
end $$;
create function public.recover_c6_operation(expected_user uuid,attempt_key uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare op public.financial_operations%rowtype;
begin
 if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'attempt owner required' using errcode='42501';end if;
 select * into op from public.financial_operations o where o.actor_id=expected_user and o.attempt_key=recover_c6_operation.attempt_key and o.operation_type in ('c6_policy','c6_pay');
 if not found or op.state='pending' then return jsonb_build_object('state','unknown');end if;return op.result;
end $$;
create function public.get_c6_wage_policy(expected_user uuid,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare history_value jsonb;current_value jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not coalesce(public.is_admin(),false) then raise exception 'admin required' using errcode='42501';end if;
 if page_number is null or page_number<0 or page_number>100000 then raise exception 'invalid page';end if;
 select to_jsonb(p) into current_value from public.driver_wage_policies p order by version desc limit 1;
 select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) into history_value from (select id,percentage::text,effective_at,changed_by,reason,version from public.driver_wage_policies order by version desc limit 20 offset page_number*20) p;
 return jsonb_build_object('current',jsonb_build_object('id',current_value->>'id','percentage',current_value->>'percentage','effective_at',current_value->>'effective_at'),'history',history_value,
   'has_more',(select count(*) from public.driver_wage_policies)>(page_number+1)*20,'can_edit',finance_private.c6_can('policy'));
end $$;
create function public.get_c6_driver_wages(target_driver uuid,expected_user uuid,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows_value jsonb;payments_value jsonb;uncovered jsonb;pos jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or (not coalesce(public.is_admin(),false) and target_driver is distinct from auth.uid()) then raise exception 'wage scope denied' using errcode='42501';end if;
 if page_number is null or page_number<0 or page_number>100000 or not exists(select 1 from public.profiles where id=target_driver and role='driver') then raise exception 'invalid driver/page';end if;
 pos:=finance_private.c6_position(target_driver);
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into rows_value from (
   select e.task_id,e.amount::text,e.fee_amount::text,s.percentage::text,e.accrued_at,f.public_reference as reference,(select r.amount::text from public.delivery_collection_results r where r.task_id=e.task_id) as cash_total,finance_private.c6_cash_remaining(e.task_id)::text as cash_remaining,
    case when e.amount=0 then 'zero_wage' when exists(select 1 from public.driver_wage_payment_items i where i.task_id=e.task_id) then 'paid'
      when (pos->>'review_required')::boolean then 'review' when finance_private.c6_cash_remaining(e.task_id)=0 then 'available' else 'blocked' end as status,
    coalesce((select jsonb_agg(jsonb_build_object('amount',a.amount::text,'reference',r.public_reference) order by a.allocated_at,a.receipt_id)
      from public.driver_cash_receipt_allocations a join public.financial_document_references r on r.cash_handover_id=a.receipt_id where a.task_id=e.task_id),'[]'::jsonb) as allocations
   from public.driver_wage_entitlements e join public.delivery_wage_snapshots s on s.task_id=e.task_id join public.financial_document_references f on f.kind='DLV' and f.document_id=e.task_id
   where e.driver_id=target_driver order by e.accrued_at desc,e.task_id limit 20 offset page_number*20) q;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into payments_value from (
   select p.id,p.amount::text,p.paid_at,p.paid_by,f.public_reference as reference from public.driver_wage_payments p join public.financial_document_references f on f.wage_payment_id=p.id where p.driver_id=target_driver order by p.paid_at desc,p.id limit 20 offset page_number*20) q;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into uncovered from (
   select r.task_id,f.public_reference as reference from public.delivery_collection_results r join public.financial_document_references f on f.kind='DLV' and f.document_id=r.task_id
   where r.driver_id=target_driver and not exists(select 1 from public.delivery_wage_snapshots s where s.task_id=r.task_id) order by r.completed_at desc,r.task_id limit 20 offset page_number*20) q;
 return jsonb_build_object('position',pos,'tasks',rows_value,'payments',payments_value,'uncovered',uncovered,
   'uncovered_count',(select count(*) from public.delivery_collection_results r where r.driver_id=target_driver and not exists(select 1 from public.delivery_wage_snapshots s where s.task_id=r.task_id)),
   'has_more',greatest((select count(*) from public.driver_wage_entitlements where driver_id=target_driver),(select count(*) from public.driver_wage_payments where driver_id=target_driver),
    (select count(*) from public.delivery_collection_results r where r.driver_id=target_driver and not exists(select 1 from public.delivery_wage_snapshots s where s.task_id=r.task_id)))>(page_number+1)*20,
   'can_pay',finance_private.c6_can('pay') and exists(select 1 from finance_private.c6_control where singleton and payout_enabled),
   'treasury_balance',case when public.is_admin() then finance_private.c6_treasury_balance()::text else null end);
end $$;
create function public.list_c6_driver_wages(expected_user uuid,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows_value jsonb;count_value bigint;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not coalesce(public.is_admin(),false) then raise exception 'admin required' using errcode='42501';end if;
 if page_number is null or page_number<0 or page_number>100000 then raise exception 'invalid page';end if;
 select count(*) into count_value from public.profiles p where p.role='driver' and (exists(select 1 from public.driver_wage_entitlements e where e.driver_id=p.id) or exists(select 1 from public.delivery_collection_results r where r.driver_id=p.id));
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into rows_value from (
  select p.id as driver_id,p.full_name,finance_private.c6_position(p.id) as position from public.profiles p where p.role='driver'
   and (exists(select 1 from public.driver_wage_entitlements e where e.driver_id=p.id) or exists(select 1 from public.delivery_collection_results r where r.driver_id=p.id)) order by p.id limit 20 offset page_number*20) q;
 return jsonb_build_object('rows',rows_value,'has_more',count_value>(page_number+1)*20);
end $$;
revoke all on function public.confirm_c5_cash_handover(uuid,uuid,uuid,uuid,numeric),public.save_c6_wage_policy(uuid,uuid,uuid,numeric,text),public.pay_c6_driver_wages(uuid,uuid,uuid,uuid[],numeric),public.recover_c6_operation(uuid,uuid),public.get_c6_wage_policy(uuid,integer),public.get_c6_driver_wages(uuid,uuid,integer),public.list_c6_driver_wages(uuid,integer) from public,anon,service_role;
grant execute on function public.confirm_c5_cash_handover(uuid,uuid,uuid,uuid,numeric),public.save_c6_wage_policy(uuid,uuid,uuid,numeric,text),public.pay_c6_driver_wages(uuid,uuid,uuid,uuid[],numeric),public.recover_c6_operation(uuid,uuid),public.get_c6_wage_policy(uuid,integer),public.get_c6_driver_wages(uuid,uuid,integer),public.list_c6_driver_wages(uuid,integer) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;
do $$ declare t text;begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['driver_wage_policies','driver_wage_entitlements','driver_cash_receipt_allocations','driver_wage_payments'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
  end loop;
 end if;
end $$;
commit;
