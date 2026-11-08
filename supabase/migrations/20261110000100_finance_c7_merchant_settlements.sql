-- C7 LOCAL DRAFT: C4 already recognizes merchant payable and commission. NO second accrual.
begin;
do $$ begin
 if to_regprocedure('finance_private.c6_treasury_balance()') is null or to_regclass('finance_private.c6_treasury_mutex') is null then raise exception 'C7 requires C4-C6 drafts';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'C7 requires READ COMMITTED';end if;
end $$;
create table finance_private.c7_control(singleton boolean primary key default true check(singleton),accept_settlements boolean not null default false,payout_enabled boolean not null default false);
insert into finance_private.c7_control default values;
create table finance_private.c7_permissions(user_id uuid primary key references public.profiles(id),may_prepare boolean not null default false,may_pay boolean not null default false);
revoke all on finance_private.c7_control,finance_private.c7_permissions from public,anon,authenticated,service_role;
create function finance_private.c7_can(permission_value text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.is_admin(),false) and exists(select 1 from finance_private.c7_permissions where user_id=auth.uid() and case permission_value when 'prepare' then may_prepare when 'pay' then may_pay else false end)
$$;
create table public.merchant_delivery_positions(
 store_order_id uuid primary key references public.store_orders(id),task_id uuid not null references public.delivery_collection_results(task_id),
 customer_order_id uuid not null references public.customer_orders(id),store_id uuid not null references public.stores(id),merchant_id uuid not null references public.merchants(id),
 gross numeric not null check(gross>=0 and gross<100000000000000000000 and gross=round(gross,2)),
 commission_rate numeric not null check(commission_rate>=0 and commission_rate<=100 and commission_rate=round(commission_rate,4)),
 commission numeric not null check(commission>=0 and commission=round(commission,2)),net numeric not null check(net>=0 and net=round(net,2)),
 delivery_event_id uuid references public.financial_events(id),recorded_at timestamptz not null default clock_timestamp(),
 check(commission=round(gross*commission_rate/100,2) and net=gross-commission)
);
create index c7_positions_store on public.merchant_delivery_positions(store_id,recorded_at,store_order_id);
create index c7_positions_merchant on public.merchant_delivery_positions(merchant_id);
create table public.merchant_settlement_documents(
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),merchant_id uuid not null references public.merchants(id),
 amount numeric not null check(amount>0 and amount<100000000000000000000 and amount=round(amount,2)),
 operation_id uuid not null unique references public.financial_operations(id),prepared_by uuid not null references public.profiles(id),prepared_at timestamptz not null default clock_timestamp()
);
create table public.merchant_settlement_document_items(
 settlement_id uuid not null references public.merchant_settlement_documents(id),store_order_id uuid not null unique references public.merchant_delivery_positions(store_order_id),
 store_id uuid not null references public.stores(id),merchant_id uuid not null references public.merchants(id),amount numeric not null check(amount>0 and amount=round(amount,2)),primary key(settlement_id,store_order_id)
);
create table public.c7_merchant_settlement_payments(
 id uuid primary key default gen_random_uuid(),settlement_id uuid not null unique references public.merchant_settlement_documents(id),
 store_id uuid not null references public.stores(id),merchant_id uuid not null references public.merchants(id),amount numeric not null check(amount>0 and amount=round(amount,2)),
 operation_id uuid not null unique references public.financial_operations(id),paid_by uuid not null references public.profiles(id),paid_at timestamptz not null default clock_timestamp()
);
create index c7_settlements_store on public.merchant_settlement_documents(store_id,prepared_at,id);
create index c7_payments_store on public.c7_merchant_settlement_payments(store_id,paid_at,id);
alter table public.financial_document_references add column merchant_settlement_id uuid references public.merchant_settlement_documents(id),add column merchant_payment_id uuid references public.c7_merchant_settlement_payments(id);
alter table public.financial_document_references drop constraint c6_reference_one_document,drop constraint c6_reference_kind_document;
alter table public.financial_document_references add constraint c7_reference_one_document check(num_nonnulls(customer_order_id,store_order_id,delivery_task_id,subscription_id,subscription_invoice_id,journal_entry_id,cash_handover_id,wage_payment_id,merchant_settlement_id,merchant_payment_id)=1);
alter table public.financial_document_references add constraint c7_reference_kind_document check(case kind
 when 'ORD' then customer_order_id=document_id and customer_order_id is not null
 when 'SUB' then store_order_id=document_id and store_order_id is not null
 when 'DLV' then delivery_task_id=document_id and delivery_task_id is not null
 when 'MSB' then subscription_id=document_id and subscription_id is not null
 when 'SIN' then subscription_invoice_id=document_id and subscription_invoice_id is not null
 when 'TXN' then journal_entry_id=document_id and journal_entry_id is not null
 when 'RCT' then cash_handover_id=document_id and cash_handover_id is not null
 when 'SET' then merchant_settlement_id=document_id and merchant_settlement_id is not null
 when 'PAY' then (wage_payment_id=document_id and wage_payment_id is not null) or (merchant_payment_id=document_id and merchant_payment_id is not null) else false end);
create unique index c7_set_reference on public.financial_document_references(merchant_settlement_id) where merchant_settlement_id is not null;
create unique index c7_pay_reference on public.financial_document_references(merchant_payment_id) where merchant_payment_id is not null;
create function finance_private.c7_owns(store_value uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.is_admin(),false) or exists(select 1 from public.stores s join public.merchants m on m.id=s.merchant_id where s.id=store_value and m.owner_user_id=auth.uid())
$$;
do $$ declare t text;begin
 foreach t in array array['merchant_delivery_positions','merchant_settlement_documents','merchant_settlement_document_items','c7_merchant_settlement_payments'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy c7_read on public.%1$I for select to authenticated using(public.is_admin() or exists(select 1 from public.stores s join public.merchants m on m.id=s.merchant_id where s.id=%1$I.store_id and m.owner_user_id=auth.uid()))',t);
  execute format('create trigger c7_immutable before update or delete on public.%I for each row execute function finance_private.reject_mutation()',t);
 end loop;
end $$;
create function finance_private.c7_capture(task_value uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.delivery_collection_results%rowtype;p public.order_pricing_current%rowtype;goods numeric;commission_value numeric;journal_value uuid;expected_lines integer;
begin
 select * into strict r from public.delivery_collection_results where task_id=task_value;
 if not finance_private.c4_is_order(r.customer_order_id) or not exists(select 1 from public.financial_operations where id=r.operation_id and state='completed') then raise exception 'C7 needs completed C4 delivery';end if;
 select * into strict p from public.order_pricing_current where customer_order_id=r.customer_order_id;
 if p.review_required or p.version<>r.pricing_version or p.total<>r.amount then raise exception 'C7 pricing conflict';end if;
 if exists(select 1 from public.store_orders s left join public.store_order_totals t on t.store_order_id=s.id left join public.store_order_commissions c on c.store_order_id=s.id
  join public.stores st on st.id=s.store_id where s.customer_order_id=r.customer_order_id and s.status not in ('rejected','cancelled')
  and (s.status<>'delivered' or c.id is null or t.store_order_id is null or c.merchant_id<>st.merchant_id or c.base_amount<>t.items_subtotal or c.commission_amount<>round(t.items_subtotal*c.commission_rate/100,2))) then raise exception 'C7 invalid delivered SUB snapshot';end if;
 select sum(t.items_subtotal),sum(c.commission_amount) into goods,commission_value from public.store_orders s join public.store_order_totals t on t.store_order_id=s.id join public.store_order_commissions c on c.store_order_id=s.id where s.customer_order_id=r.customer_order_id and s.status='delivered';
 if goods is null or goods<>p.items_amount or goods+p.delivery_fee<>r.amount then raise exception 'C7 merchandise reconciliation failed';end if;
 if r.amount=0 then
  if goods<>0 or commission_value<>0 or p.delivery_fee<>0 or r.delivery_event_id is not null then raise exception 'C7 zero economic conflict';end if;
 else
  select j.id into strict journal_value from public.journal_entries j join public.financial_events e on e.id=j.event_id join public.financial_document_references f on f.id=e.source_reference_id and f.kind='DLV' and f.delivery_task_id=r.task_id where e.id=r.delivery_event_id and e.operation_id=r.operation_id and e.event_type='delivery_completed' and j.status='posted';
  if exists(select 1 from (select st.merchant_id,sum(t.items_subtotal-c.commission_amount) net from public.store_orders s join public.stores st on st.id=s.store_id join public.store_order_totals t on t.store_order_id=s.id join public.store_order_commissions c on c.store_order_id=s.id where s.customer_order_id=r.customer_order_id and s.status='delivered' group by st.merchant_id) x
    where x.net>0 and not exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=journal_value and a.definition_code='merchant_sales_payable' and a.merchant_id=x.merchant_id and l.side='credit' and l.amount=x.net)) then raise exception 'C7 merchant C4 credit mismatch';end if;
  if commission_value>0 and not exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=journal_value and a.definition_code='commission_revenue' and l.side='credit' and l.amount=commission_value) then raise exception 'C7 commission credit mismatch';end if;
  if p.delivery_fee>0 and not exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=journal_value and a.definition_code='delivery_revenue' and l.side='credit' and l.amount=p.delivery_fee) then raise exception 'C7 delivery credit mismatch';end if;
  if not exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=journal_value and a.definition_code='customer_advance' and l.side='debit' and l.amount=r.amount) then raise exception 'C7 advance debit mismatch';end if;
  select 1+count(*) filter(where x.net>0)+(case when commission_value>0 then 1 else 0 end)+(case when p.delivery_fee>0 then 1 else 0 end) into expected_lines from (select st.merchant_id,sum(t.items_subtotal-c.commission_amount) net from public.store_orders s join public.stores st on st.id=s.store_id join public.store_order_totals t on t.store_order_id=s.id join public.store_order_commissions c on c.store_order_id=s.id where s.customer_order_id=r.customer_order_id and s.status='delivered' group by st.merchant_id) x;
  if (select count(*) from public.journal_lines where journal_entry_id=journal_value)<>expected_lines then raise exception 'C7 unexpected C4 journal lines';end if;
 end if;
 insert into public.merchant_delivery_positions(store_order_id,task_id,customer_order_id,store_id,merchant_id,gross,commission_rate,commission,net,delivery_event_id)
  select s.id,r.task_id,r.customer_order_id,s.store_id,st.merchant_id,t.items_subtotal,c.commission_rate,c.commission_amount,t.items_subtotal-c.commission_amount,r.delivery_event_id
  from public.store_orders s join public.stores st on st.id=s.store_id join public.store_order_totals t on t.store_order_id=s.id join public.store_order_commissions c on c.store_order_id=s.id
  where s.customer_order_id=r.customer_order_id and s.status='delivered' on conflict(store_order_id) do nothing;
end $$;
create function finance_private.c7_capture_delivery() returns trigger language plpgsql security definer set search_path='' as $$ begin perform finance_private.c7_capture(new.task_id);return null;end $$;
create constraint trigger c7_delivery_detail after insert on public.delivery_collection_results deferrable initially deferred for each row execute function finance_private.c7_capture_delivery();
create or replace function finance_private.c4_defer_extensions() returns void language plpgsql security definer set search_path='' as $$ begin set constraints public.c6_accrual_required,public.c7_delivery_detail deferred;end $$;
-- Reconcile historical C4 entries as immutable metadata only, NEVER post the delivery again.
do $$ declare r record;begin for r in select task_id from public.delivery_collection_results order by completed_at,task_id loop perform finance_private.c7_capture(r.task_id);end loop;end $$;
create function finance_private.c7_position(store_value uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare merchant_value uuid;gross_value numeric;commission_value numeric;net_value numeric;paid_value numeric;reserved_value numeric;balance_value numeric;expected_value numeric;review_value boolean;
begin
 select merchant_id into strict merchant_value from public.stores where id=store_value;
 select coalesce(sum(gross),0),coalesce(sum(commission),0),coalesce(sum(net),0) into gross_value,commission_value,net_value from public.merchant_delivery_positions where store_id=store_value and merchant_id=merchant_value;
 select coalesce(sum(p.amount),0) into paid_value from public.c7_merchant_settlement_payments p join public.financial_operations o on o.id=p.operation_id and o.state='completed' where p.store_id=store_value;
 select coalesce(sum(s.amount),0) into reserved_value from public.merchant_settlement_documents s where s.store_id=store_value and not exists(select 1 from public.c7_merchant_settlement_payments p where p.settlement_id=s.id);
 select coalesce(sum(case l.side when 'credit' then l.amount else -l.amount end),0) into balance_value from public.financial_accounts a join public.journal_lines l on l.account_id=a.id join public.journal_entries j on j.id=l.journal_entry_id and j.status='posted' join public.financial_events e on e.id=j.event_id join public.financial_operations o on o.id=e.operation_id and o.state='completed' where a.definition_code='merchant_sales_payable' and a.merchant_id=merchant_value;
 select coalesce(sum(net),0)-(select coalesce(sum(p.amount),0) from public.c7_merchant_settlement_payments p join public.financial_operations o on o.id=p.operation_id and o.state='completed' where p.merchant_id=merchant_value) into expected_value from public.merchant_delivery_positions where merchant_id=merchant_value;
 review_value:=balance_value<>expected_value or balance_value<0 or net_value-paid_value-reserved_value<0
  or exists(select 1 from public.merchant_delivery_positions x join public.store_order_commissions c on c.store_order_id=x.store_order_id join public.order_pricing_current pc on pc.customer_order_id=x.customer_order_id join public.delivery_collection_results r on r.task_id=x.task_id join public.stores st on st.id=x.store_id
   where x.merchant_id=merchant_value and (x.merchant_id<>st.merchant_id or c.base_amount<>x.gross or c.commission_rate<>x.commission_rate or c.commission_amount<>x.commission or pc.review_required or pc.version<>r.pricing_version))
  or exists(select 1 from public.merchant_delivery_positions x join public.journal_entries j on j.event_id=x.delivery_event_id join public.journal_entries rev on rev.reversal_of=j.id and rev.status='posted' where x.merchant_id=merchant_value);
 return jsonb_build_object('gross',gross_value::text,'commission',commission_value::text,'net',net_value::text,'pending',reserved_value::text,'paid',paid_value::text,'available',(case when review_value then 0 else net_value-paid_value-reserved_value end)::text,'review_required',review_value);
end $$;
create function finance_private.c7_validate_item() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.merchant_delivery_positions x join public.merchant_settlement_documents s on s.id=new.settlement_id where x.store_order_id=new.store_order_id and x.store_id=new.store_id and s.store_id=x.store_id and s.merchant_id=x.merchant_id and new.merchant_id=x.merchant_id and new.amount=x.net and new.amount>0) then raise exception 'C7 full delivered SUB required';end if;return new;
end $$;
create trigger c7_item_validate before insert on public.merchant_settlement_document_items for each row execute function finance_private.c7_validate_item();
create function finance_private.c7_require_settlement() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.financial_operations o join public.financial_document_references f on f.merchant_settlement_id=new.id and f.kind='SET' where o.id=new.operation_id and o.state='completed' and o.operation_type='c7_prepare'
  and (select sum(amount) from public.merchant_settlement_document_items where settlement_id=new.id)=new.amount) then raise exception 'C7 SET incomplete';end if;return null;
end $$;
create constraint trigger c7_set_complete after insert on public.merchant_settlement_documents deferrable initially deferred for each row execute function finance_private.c7_require_settlement();
create function public.prepare_c7_settlement(target_store uuid,expected_user uuid,attempt_key uuid,target_subs uuid[],expected_amount numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare merchant_value uuid;subs uuid[];total_value numeric;op public.financial_operations%rowtype;set_value uuid;ref_value uuid;r jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c7_can('prepare') then raise exception 'authorized settlement preparer required' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'C7 writes require READ COMMITTED';end if;
 if attempt_key is null or target_subs is null or cardinality(target_subs) not between 1 and 100 or array_position(target_subs,null) is not null or expected_amount is null or expected_amount<=0 or expected_amount>=100000000000000000000 or expected_amount<>round(expected_amount,2) then raise exception 'invalid settlement intent';end if;
 select array_agg(distinct t order by t) into subs from unnest(target_subs) t;if cardinality(subs)<>cardinality(target_subs) then raise exception 'duplicate SUB';end if;
 select merchant_id into strict merchant_value from public.stores where id=target_store for update;
 op:=finance_private.begin_operation('c7_prepare',attempt_key,jsonb_build_object('store',target_store,'subs',to_jsonb(subs),'expected_amount',expected_amount));if op.state in ('completed','rejected') then return op.result;end if;
 if not exists(select 1 from finance_private.c7_control where singleton and accept_settlements) then return finance_private.c4_reject_operation(op.id,'settlements_disabled');end if;
 if (finance_private.c7_position(target_store)->>'review_required')::boolean then return finance_private.c4_reject_operation(op.id,'ledger_requires_review');end if;
 if (select count(*) from public.merchant_delivery_positions where store_order_id=any(subs) and store_id=target_store and merchant_id=merchant_value and net>0)<>cardinality(subs) or exists(select 1 from public.merchant_settlement_document_items where store_order_id=any(subs)) then return finance_private.c4_reject_operation(op.id,'sub_not_available');end if;
 select sum(net) into total_value from public.merchant_delivery_positions where store_order_id=any(subs) and store_id=target_store;
 if total_value is distinct from expected_amount then return finance_private.c4_reject_operation(op.id,'amount_changed');end if;
 set constraints public.c7_set_complete deferred;
 insert into public.merchant_settlement_documents(store_id,merchant_id,amount,operation_id,prepared_by) values(target_store,merchant_value,total_value,op.id,auth.uid()) returning id into set_value;
 insert into public.merchant_settlement_document_items(settlement_id,store_order_id,store_id,merchant_id,amount) select set_value,store_order_id,store_id,merchant_id,net from public.merchant_delivery_positions where store_order_id=any(subs) order by store_order_id;
 insert into public.financial_document_references(kind,document_id,merchant_settlement_id) values('SET',set_value,set_value) returning id into ref_value;
 r:=jsonb_build_object('state','completed','kind','settlement','settlement_id',set_value,'store_id',target_store,'amount',total_value::text,'reference',(select public_reference from public.financial_document_references where id=ref_value));
 perform finance_private.complete_operation(op.id,r);set constraints all immediate;return r;
end $$;
create function finance_private.c7_require_payment() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.merchant_settlement_documents s join public.financial_operations o on o.id=new.operation_id and o.state='completed' and o.operation_type='c7_pay'
   join public.financial_document_references f on f.merchant_payment_id=new.id and f.kind='PAY' join public.financial_events e on e.source_reference_id=f.id and e.operation_id=o.id and e.event_type='merchant_settlement_paid' join public.journal_entries j on j.event_id=e.id and j.status='posted'
   where s.id=new.settlement_id and s.store_id=new.store_id and s.merchant_id=new.merchant_id and s.amount=new.amount
   and (select count(*) from public.journal_lines where journal_entry_id=j.id)=2
   and exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=j.id and l.side='debit' and l.amount=new.amount and a.definition_code='merchant_sales_payable' and a.merchant_id=new.merchant_id)
   and exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=j.id and l.side='credit' and l.amount=new.amount and a.definition_code='treasury_cash')) then raise exception 'C7 payment must post full balanced PAY';end if;return null;
end $$;
create constraint trigger c7_pay_complete after insert on public.c7_merchant_settlement_payments deferrable initially deferred for each row execute function finance_private.c7_require_payment();
create function public.pay_c7_settlement(target_store uuid,target_settlement uuid,expected_user uuid,attempt_key uuid,expected_amount numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.merchant_settlement_documents%rowtype;p public.c7_merchant_settlement_payments%rowtype;op public.financial_operations%rowtype;payment_value uuid;ref_value uuid;event_value uuid;payable uuid;treasury uuid;r jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c7_can('pay') then raise exception 'authorized merchant payer required' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'C7 writes require READ COMMITTED';end if;
 if attempt_key is null or expected_amount is null or expected_amount<=0 or expected_amount>=100000000000000000000 or expected_amount<>round(expected_amount,2) then raise exception 'invalid payout intent';end if;
 perform 1 from public.stores where id=target_store for update;if not found then raise exception 'store unavailable';end if;
 -- SAME global outflow mutex and lock order as C6: party FIRST, treasury SECOND.
 perform 1 from finance_private.c6_treasury_mutex where singleton for update;
 select * into strict s from public.merchant_settlement_documents where id=target_settlement and store_id=target_store for update;
 op:=finance_private.begin_operation('c7_pay',attempt_key,jsonb_build_object('store',target_store,'settlement',target_settlement,'expected_amount',expected_amount));if op.state in ('completed','rejected') then return op.result;end if;
 if s.amount is distinct from expected_amount then return finance_private.c4_reject_operation(op.id,'amount_changed');end if;
 select * into p from public.c7_merchant_settlement_payments where settlement_id=s.id;
 if found then select o.result into strict r from public.financial_operations o where o.id=p.operation_id and o.state='completed';perform finance_private.complete_operation(op.id,r);set constraints all immediate;return r;end if;
 if not exists(select 1 from finance_private.c7_control where singleton and payout_enabled) then return finance_private.c4_reject_operation(op.id,'payout_disabled');end if;
 if (finance_private.c7_position(target_store)->>'review_required')::boolean then return finance_private.c4_reject_operation(op.id,'ledger_requires_review');end if;
 if s.amount>finance_private.c6_treasury_balance() then return finance_private.c4_reject_operation(op.id,'insufficient_treasury');end if;
 set constraints public.c7_pay_complete deferred;
 insert into public.c7_merchant_settlement_payments(settlement_id,store_id,merchant_id,amount,operation_id,paid_by) values(s.id,s.store_id,s.merchant_id,s.amount,op.id,auth.uid()) returning id into payment_value;
 insert into public.financial_document_references(kind,document_id,merchant_payment_id) values('PAY',payment_value,payment_value) returning id into ref_value;
 event_value:=finance_private.record_financial_event(ref_value,'merchant_settlement_paid',op.id);
 payable:=finance_private.c4_account('merchant_sales_payable',null,s.merchant_id);treasury:=finance_private.c4_account('treasury_cash');
 perform finance_private.post_journal(event_value,jsonb_build_array(jsonb_build_object('account_id',payable,'side','debit','amount',s.amount),jsonb_build_object('account_id',treasury,'side','credit','amount',s.amount)),'office paid full merchant settlement');
 r:=jsonb_build_object('state','completed','kind','payment','payment_id',payment_value,'settlement_id',s.id,'store_id',s.store_id,'amount',s.amount::text,'reference',(select public_reference from public.financial_document_references where id=ref_value));
 perform finance_private.complete_operation(op.id,r);set constraints all immediate;return r;
end $$;
create function public.recover_c7_operation(expected_user uuid,attempt_key uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ declare r jsonb;begin
 if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'attempt owner required' using errcode='42501';end if;
 select o.result into r from public.financial_operations o where o.actor_id=expected_user and o.attempt_key=recover_c7_operation.attempt_key and o.operation_type in ('c7_prepare','c7_pay') and o.state in ('completed','rejected');return coalesce(r,jsonb_build_object('state','unknown'));
end $$;
create function public.get_c7_merchant_settlements(expected_user uuid,target_store uuid default null,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare store_value uuid:=target_store;store_name text;rows_value jsonb;sets_value jsonb;pos jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'account scope denied' using errcode='42501';end if;
 if store_value is null and not coalesce(public.is_admin(),false) then select s.id into strict store_value from public.stores s join public.merchants m on m.id=s.merchant_id where m.owner_user_id=auth.uid();end if;
 if store_value is null or not finance_private.c7_owns(store_value) then raise exception 'store scope denied' using errcode='42501';end if;
 if page_number is null or page_number<0 or page_number>100000 then raise exception 'invalid page';end if;
 select name into strict store_name from public.stores where id=store_value;pos:=finance_private.c7_position(store_value);
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into rows_value from (
  select x.store_order_id,x.gross::text,x.commission_rate::text,x.commission::text,x.net::text,x.recorded_at,sr.public_reference as sub_reference,orr.public_reference as order_reference,
   case when x.net=0 then 'zero_net' when exists(select 1 from public.merchant_settlement_document_items i join public.c7_merchant_settlement_payments p on p.settlement_id=i.settlement_id where i.store_order_id=x.store_order_id) then 'paid'
    when exists(select 1 from public.merchant_settlement_document_items i where i.store_order_id=x.store_order_id) then 'pending'
    when (pos->>'review_required')::boolean then 'review' else 'available' end as status
  from public.merchant_delivery_positions x join public.financial_document_references sr on sr.store_order_id=x.store_order_id and sr.kind='SUB' join public.financial_document_references orr on orr.customer_order_id=x.customer_order_id and orr.kind='ORD'
  where x.store_id=store_value order by x.recorded_at desc,x.store_order_id limit 20 offset page_number*20) q;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into sets_value from (
  select s.id,s.amount::text,s.prepared_at,f.public_reference as reference,case when p.id is null then 'pending' else 'paid' end as status,
    pf.public_reference as pay_reference,p.paid_at,
    (select jsonb_agg(jsonb_build_object('sub_reference',r.public_reference,'amount',i.amount::text) order by i.store_order_id) from public.merchant_settlement_document_items i join public.financial_document_references r on r.kind='SUB' and r.store_order_id=i.store_order_id where i.settlement_id=s.id) as items
  from public.merchant_settlement_documents s join public.financial_document_references f on f.merchant_settlement_id=s.id left join public.c7_merchant_settlement_payments p on p.settlement_id=s.id left join public.financial_document_references pf on pf.merchant_payment_id=p.id
  where s.store_id=store_value order by s.prepared_at desc,s.id limit 20 offset page_number*20) q;
 return jsonb_build_object('store_id',store_value,'store_name',store_name,'position',pos,'subs',rows_value,'settlements',sets_value,
  'can_prepare',finance_private.c7_can('prepare') and exists(select 1 from finance_private.c7_control where singleton and accept_settlements),
  'can_pay',finance_private.c7_can('pay') and exists(select 1 from finance_private.c7_control where singleton and payout_enabled),
  'treasury_balance',case when public.is_admin() then finance_private.c6_treasury_balance()::text else null end,
  'has_more',greatest((select count(*) from public.merchant_delivery_positions where store_id=store_value),(select count(*) from public.merchant_settlement_documents where store_id=store_value))>(page_number+1)*20);
end $$;
create function public.list_c7_merchant_settlements(expected_user uuid,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not coalesce(public.is_admin(),false) then raise exception 'admin required' using errcode='42501';end if;
 if page_number is null or page_number<0 or page_number>100000 then raise exception 'invalid page';end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into r from (select s.id as store_id,s.name as store_name,finance_private.c7_position(s.id) as position from public.stores s where exists(select 1 from public.merchant_delivery_positions x where x.store_id=s.id) order by s.id limit 20 offset page_number*20) q;
 return jsonb_build_object('rows',r,'has_more',(select count(*) from public.stores s where exists(select 1 from public.merchant_delivery_positions x where x.store_id=s.id))>(page_number+1)*20);
end $$;
revoke all on function public.prepare_c7_settlement(uuid,uuid,uuid,uuid[],numeric),public.pay_c7_settlement(uuid,uuid,uuid,uuid,numeric),public.recover_c7_operation(uuid,uuid),public.get_c7_merchant_settlements(uuid,uuid,integer),public.list_c7_merchant_settlements(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.prepare_c7_settlement(uuid,uuid,uuid,uuid[],numeric),public.pay_c7_settlement(uuid,uuid,uuid,uuid,numeric),public.recover_c7_operation(uuid,uuid),public.get_c7_merchant_settlements(uuid,uuid,integer),public.list_c7_merchant_settlements(uuid,integer) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;
do $$ declare t text;begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['merchant_delivery_positions','merchant_settlement_documents','c7_merchant_settlement_payments'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
  end loop;
 end if;
end $$;
commit;
