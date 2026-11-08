-- C8 LOCAL DRAFT. No scheduler registration, activation or legacy financial backfill.
begin;
create table finance_private.c8_control(singleton boolean primary key default true check(singleton),accept_operations boolean not null default false,enforce_gate boolean not null default false,scheduler_enabled boolean not null default false);
insert into finance_private.c8_control default values;
create table finance_private.c8_permissions(user_id uuid primary key references public.profiles(id),plans boolean not null default false,issue boolean not null default false,collect boolean not null default false,suspend boolean not null default false,resume boolean not null default false,cancel boolean not null default false);
revoke all on finance_private.c8_control,finance_private.c8_permissions from public,anon,authenticated,service_role;
create function finance_private.c8_can(action_value text) returns boolean language sql stable security definer set search_path='' as $$ select coalesce(public.is_admin(),false) and exists(select 1 from finance_private.c8_permissions where user_id=auth.uid() and case action_value when 'plans' then plans when 'issue' then issue when 'collect' then collect when 'suspend' then suspend when 'resume' then resume when 'cancel' then cancel else false end) $$;
-- A scheduled invoice is a system operation, NOT a falsely attributed human/JWT.
-- All pre-existing human operations retain their exact contracts.
alter table public.financial_operations add column system_source text;
alter table public.financial_operations alter column actor_id drop not null,alter column actor_role drop not null;
alter table public.financial_operations add constraint c8_operation_provenance check(
 (actor_id is not null and actor_role is not null and system_source is null) or
 (actor_id is null and actor_role is null and system_source is not null and system_source='subscription_scheduler' and operation_type='c8_issue'));
create unique index c8_system_attempt on public.financial_operations(attempt_key) where actor_id is null;
create table public.subscription_plan_versions(
 id uuid primary key default gen_random_uuid(),version bigint generated always as identity unique,plan_id uuid not null references public.subscription_plans(id),
 name text not null check(length(trim(name)) between 2 and 80),description text not null check(length(trim(description)) between 1 and 4000),
 price numeric not null check(price>0 and price<1000000000000 and price=round(price,2)),months integer not null check(months between 1 and 60),
 commission_rate numeric not null check(commission_rate>=0 and commission_rate<=100 and commission_rate=round(commission_rate,4)),
 available boolean not null,effective_at timestamptz not null,changed_by uuid not null references public.profiles(id),reason text not null check(length(trim(reason)) between 2 and 1500),created_at timestamptz not null default clock_timestamp()
);
revoke all on sequence public.subscription_plan_versions_version_seq from public,anon,authenticated,service_role;
create table public.subscription_memberships(
 merchant_id uuid primary key references public.merchants(id),plan_id uuid not null references public.subscription_plans(id),enrolled_by uuid not null references public.profiles(id),reason text not null,created_at timestamptz not null default clock_timestamp()
);
create table public.subscription_account_events(
 id uuid primary key default gen_random_uuid(),seq bigint generated always as identity unique,merchant_id uuid not null references public.subscription_memberships(merchant_id),
 kind text not null check(kind in ('renewal','administrative')),value text not null,
 actor_id uuid not null references public.profiles(id),reason text not null check(length(trim(reason)) between 2 and 1500),operation_id uuid not null unique references public.financial_operations(id),at timestamptz not null default clock_timestamp(),
 check((kind='renewal' and value in ('automatic','manual','disabled')) or (kind='administrative' and value in ('active','suspended','cancelled')))
);
revoke all on sequence public.subscription_account_events_seq_seq from public,anon,authenticated,service_role;
create table public.subscription_billing_documents(
 id uuid primary key default gen_random_uuid(),merchant_id uuid not null references public.subscription_memberships(merchant_id),plan_version_id uuid not null references public.subscription_plan_versions(id),
 anchor_period_id uuid references public.merchant_subscriptions(id),period_start_snapshot timestamptz not null,period_end_snapshot timestamptz not null check(period_end_snapshot>period_start_snapshot),amount numeric not null check(amount>0 and amount<1000000000000 and amount=round(amount,2)),
 operation_id uuid not null unique references public.financial_operations(id),issued_at timestamptz not null default clock_timestamp()
);
create unique index c8_one_initial on public.subscription_billing_documents(merchant_id) where anchor_period_id is null;
create unique index c8_one_renewal on public.subscription_billing_documents(anchor_period_id) where anchor_period_id is not null;
create table public.subscription_cash_receipts(
 id uuid primary key default gen_random_uuid(),invoice_id uuid not null unique references public.subscription_billing_documents(id),merchant_id uuid not null references public.subscription_memberships(merchant_id),
 amount numeric not null check(amount>0 and amount<1000000000000 and amount=round(amount,2)),operation_id uuid not null unique references public.financial_operations(id),received_by uuid not null references public.profiles(id),reason text not null,
 period_id uuid not null unique references public.merchant_subscriptions(id) deferrable initially deferred,received_at timestamptz not null default clock_timestamp()
);
alter table public.financial_document_references add column billing_document_id uuid references public.subscription_billing_documents(id),add column subscription_cash_receipt_id uuid references public.subscription_cash_receipts(id);
alter table public.financial_document_references drop constraint c7_reference_one_document,drop constraint c7_reference_kind_document;
alter table public.financial_document_references add constraint c8_reference_one_document check(num_nonnulls(customer_order_id,store_order_id,delivery_task_id,subscription_id,subscription_invoice_id,journal_entry_id,cash_handover_id,wage_payment_id,merchant_settlement_id,merchant_payment_id,billing_document_id,subscription_cash_receipt_id)=1);
alter table public.financial_document_references add constraint c8_reference_kind_document check(case kind
 when 'ORD' then customer_order_id=document_id and customer_order_id is not null when 'SUB' then store_order_id=document_id and store_order_id is not null when 'DLV' then delivery_task_id=document_id and delivery_task_id is not null when 'MSB' then subscription_id=document_id and subscription_id is not null
 when 'SIN' then (subscription_invoice_id=document_id and subscription_invoice_id is not null) or (billing_document_id=document_id and billing_document_id is not null)
 when 'TXN' then journal_entry_id=document_id and journal_entry_id is not null
 when 'RCT' then (cash_handover_id=document_id and cash_handover_id is not null) or (subscription_cash_receipt_id=document_id and subscription_cash_receipt_id is not null)
 when 'SET' then merchant_settlement_id=document_id and merchant_settlement_id is not null
 when 'PAY' then (wage_payment_id=document_id and wage_payment_id is not null) or (merchant_payment_id=document_id and merchant_payment_id is not null) else false end);
create unique index c8_sin_reference on public.financial_document_references(billing_document_id) where billing_document_id is not null;
create unique index c8_rct_reference on public.financial_document_references(subscription_cash_receipt_id) where subscription_cash_receipt_id is not null;
do $$ declare t text;begin
 foreach t in array array['subscription_plan_versions','subscription_memberships','subscription_account_events','subscription_billing_documents','subscription_cash_receipts'] loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('grant select on public.%I to authenticated',t);execute format('create trigger c8_immutable before update or delete on public.%I for each row execute function finance_private.reject_mutation()',t);
  if t='subscription_plan_versions' then execute format('create policy c8_read on public.%I for select to authenticated using(public.is_admin() or (effective_at<=statement_timestamp() and exists(select 1 from public.merchants where owner_user_id=auth.uid())))',t);
  else execute format('create policy c8_read on public.%1$I for select to authenticated using(public.is_admin() or exists(select 1 from public.merchants m where m.id=%1$I.merchant_id and m.owner_user_id=auth.uid()))',t);end if;
 end loop;
end $$;
create function finance_private.c8_owns(merchant_value uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce(public.is_admin(),false) or exists(select 1 from public.merchants where id=merchant_value and owner_user_id=auth.uid()) $$;
create function finance_private.c8_merchant_owner(merchant_value uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.merchants m join public.profiles p on p.id=m.owner_user_id and p.role='merchant' where m.id=merchant_value and m.owner_user_id=auth.uid()) $$;
create function finance_private.c8_state(merchant_value uuid,at_time timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.merchant_subscriptions%rowtype;mode_value text;admin_value text;reason_value text;status_value text;
begin
 select * into p from public.merchant_subscriptions where merchant_id=merchant_value and starts_at<=at_time order by expires_at desc,id desc limit 1;
 select value into mode_value from public.subscription_account_events where merchant_id=merchant_value and kind='renewal' order by seq desc limit 1;
 select value,reason into admin_value,reason_value from public.subscription_account_events where merchant_id=merchant_value and kind='administrative' order by seq desc limit 1;
 status_value:=case when admin_value in ('suspended','cancelled') then admin_value when p.id is null then 'expired' when at_time<p.expires_at then 'active' when at_time<p.expires_at+interval '168 hours' then 'grace_period' else 'expired' end;
 return jsonb_build_object('state',status_value,'renewal_mode',coalesce(mode_value,'disabled'),'paid_until',p.expires_at,'grace_until',p.expires_at+interval '168 hours','period_id',p.id,'plan_name',p.plan_name_snapshot,'paid_price',p.price_snapshot::text,'paid_months',p.duration_months,'administrative_reason',reason_value,'eligible',status_value in ('active','grace_period'),'server_time',at_time);
end $$;
-- Preserve public function OID so existing RLS/expression dependencies receive C8 eligibility.
create function finance_private.c8_legacy_store_eligibility(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores s
    join public.merchants m on m.id = s.merchant_id
    where s.id = target_store
      and s.status = 'accepted'
      and m.status = 'accepted'
      and now() < coalesce((
        select ms.expires_at + interval '7 days'
        from public.merchant_subscriptions ms
        where ms.merchant_id = s.merchant_id
          and ms.starts_at <= now()
        order by ms.expires_at desc, ms.id desc
        limit 1
      ), '-infinity'::timestamptz)
  );
$$;


create or replace function public.store_accepts_new_orders(target_store uuid) returns boolean language plpgsql stable security definer set search_path='' as $$ declare m uuid;begin
 select merchant_id into m from public.stores where id=target_store;
 if not exists(select 1 from public.subscription_memberships where merchant_id=m) then return finance_private.c8_legacy_store_eligibility(target_store);end if;
 return exists(select 1 from public.stores s join public.merchants mm on mm.id=s.merchant_id where s.id=target_store and s.status='accepted' and mm.status='accepted') and (finance_private.c8_state(m,statement_timestamp())->>'eligible')::boolean;
end $$;
create or replace function public.reject_store_order_after_subscription_grace() returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.merchants m join public.stores s on s.merchant_id=m.id where s.id=new.store_id for share of m;
 if not public.store_accepts_new_orders(new.store_id) then raise exception 'C8_STORE_UNAVAILABLE';end if;
 if exists(select 1 from public.stores st join public.subscription_memberships mm on mm.merchant_id=st.merchant_id where st.id=new.store_id) then new.created_at:=clock_timestamp();end if;return new;
end $$;
-- Fence native period creation and old financial writers only for enrolled C8 merchants.
create function finance_private.c8_native_fence() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='DELETE' then if exists(select 1 from public.subscription_memberships where merchant_id=old.merchant_id) then raise exception 'C8 managed period is immutable';end if;return old;end if;
 if not exists(select 1 from public.subscription_memberships where merchant_id=new.merchant_id) then return new;end if;
 if tg_table_name='merchant_subscriptions' and tg_op='INSERT' then
  if exists(select 1 from public.subscription_cash_receipts r join public.financial_operations o on o.id=r.operation_id and o.actor_id=auth.uid() and o.state='pending' and o.operation_type='c8_collect' where r.period_id=new.id and r.merchant_id=new.merchant_id) then return new;end if;
 end if;
 raise exception 'C8 managed subscription cannot use legacy writer';
end $$;
create trigger c8_native_period_guard before insert or update or delete on public.merchant_subscriptions for each row execute function finance_private.c8_native_fence();
create trigger c8_old_invoice_guard before insert on public.subscription_invoices for each row execute function finance_private.c8_native_fence();
create trigger c8_old_billing_guard before insert or update on public.merchant_billing_settings for each row execute function finance_private.c8_native_fence();
create trigger c8_old_change_guard before insert on public.merchant_subscription_plan_changes for each row execute function finance_private.c8_native_fence();
create trigger c8_old_payment_guard before insert on public.subscription_payments for each row execute function finance_private.c8_native_fence();
create function finance_private.c8_enabled() returns void language plpgsql stable security definer set search_path='' as $$ begin if current_setting('transaction_isolation')<>'read committed' then raise exception 'C8 requires READ COMMITTED';end if;if not exists(select 1 from finance_private.c8_control where singleton and accept_operations) then raise exception 'C8_DISABLED';end if;end $$;
create function finance_private.c8_done(op_value uuid,r jsonb,reject_value boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then update public.financial_operations set state=case when reject_value then 'rejected' else 'completed' end,result=r,completed_at=clock_timestamp() where id=op_value and actor_id is null and system_source='subscription_scheduler' and operation_type='c8_issue' and state='pending';if not found then raise exception 'owned system operation required';end if;
 else perform finance_private.complete_operation(op_value,r,reject_value);end if;set constraints all immediate;return r;
end $$;
create function finance_private.c8_reject(op_value uuid,code_value text) returns jsonb language plpgsql security definer set search_path='' as $$ begin return finance_private.c8_done(op_value,jsonb_build_object('state','rejected','code',code_value),true);end $$;
create function public.save_subscription_plan_version(expected_user uuid,attempt_key uuid,target_plan uuid,plan_name text,plan_description text,price_value numeric,months_value integer,available_value boolean,effective_time timestamptz,change_reason text) returns jsonb language plpgsql security definer set search_path='' as $$ declare op public.financial_operations%rowtype;v uuid;rate_value numeric;r jsonb;begin
 if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c8_can('plans') then raise exception 'plan permission required' using errcode='42501';end if;perform finance_private.c8_enabled();
 if price_value is null or price_value<=0 or price_value>=1000000000000 or price_value<>round(price_value,2) or months_value is null or months_value not between 1 and 60 or available_value is null  or length(trim(change_reason)) not between 2 and 1500 then raise exception 'invalid exact plan version';end if;

 op:=finance_private.begin_operation('c8_plan',attempt_key,jsonb_build_object('plan',target_plan,'name',plan_name,'description',plan_description,'price',price_value,'months',months_value,'available',available_value,'effective',effective_time,'reason',change_reason));if op.state in ('completed','rejected') then return op.result;end if;
 select commission_rate into rate_value from public.subscription_plans where id=target_plan and is_active for update;
 if not found then return finance_private.c8_reject(op.id,'plan_unavailable');end if;
 if effective_time is not null and effective_time<statement_timestamp()-interval '1 minute' then return finance_private.c8_reject(op.id,'invalid_effective_time');end if;
 insert into public.subscription_plan_versions(plan_id,name,description,price,months,commission_rate,available,effective_at,changed_by,reason) values(target_plan,trim(plan_name),trim(plan_description),price_value,months_value,rate_value,available_value,coalesce(effective_time,clock_timestamp()),auth.uid(),trim(change_reason)) returning id into v;
 return finance_private.c8_done(op.id,jsonb_build_object('state','completed','kind','plan','id',v));end $$;
create function public.enroll_subscription_account(target_merchant uuid,target_plan uuid,expected_user uuid,attempt_key uuid,enrollment_reason text) returns jsonb language plpgsql security definer set search_path='' as $$ declare op public.financial_operations%rowtype;begin
 if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c8_can('issue') then raise exception 'enrollment permission required' using errcode='42501';end if;perform finance_private.c8_enabled();
 perform 1 from public.merchants where id=target_merchant and status='accepted' for no key update;if not found then raise exception 'merchant unavailable';end if;
 op:=finance_private.begin_operation('c8_enroll',attempt_key,jsonb_build_object('merchant',target_merchant,'plan',target_plan,'reason',enrollment_reason));if op.state in ('completed','rejected') then return op.result;end if;
 if not exists(select 1 from finance_private.c8_control where singleton and enforce_gate) then return finance_private.c8_reject(op.id,'gate_not_enabled');end if;
 if length(trim(enrollment_reason)) not between 2 and 1500 or exists(select 1 from public.merchant_subscriptions where merchant_id=target_merchant and expires_at+interval '168 hours'>clock_timestamp()) or exists(select 1 from public.subscription_invoices where merchant_id=target_merchant and status not in ('paid','void')) or exists(select 1 from public.subscription_payments p where p.merchant_id=target_merchant and p.amount>coalesce((select sum(a.amount) from public.invoice_payment_allocations a where a.payment_id=p.id),0)) or finance_private.c8_receivable(target_merchant)<>0 then return finance_private.c8_reject(op.id,'transition_required');end if;
 perform 1 from (select available from public.subscription_plan_versions where plan_id=target_plan and effective_at<=clock_timestamp() order by effective_at desc,version desc limit 1) latest where latest.available and exists(select 1 from public.subscription_plans where id=target_plan and is_active);if not found then return finance_private.c8_reject(op.id,'plan_unavailable');end if;
 insert into public.subscription_memberships(merchant_id,plan_id,enrolled_by,reason) values(target_merchant,target_plan,auth.uid(),trim(enrollment_reason));
 insert into public.subscription_account_events(merchant_id,kind,value,actor_id,reason,operation_id) values(target_merchant,'renewal','disabled',auth.uid(),trim(enrollment_reason),op.id);
 return finance_private.c8_done(op.id,jsonb_build_object('state','completed','kind','enrollment','id',target_merchant));end $$;
create function public.change_subscription_account(target_merchant uuid,expected_user uuid,attempt_key uuid,action_value text,value_text text,change_reason text) returns jsonb language plpgsql security definer set search_path='' as $$ declare op public.financial_operations%rowtype;current_admin text;kind_value text;begin
 if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'account changed' using errcode='42501';end if;perform finance_private.c8_enabled();
 if action_value='renewal' then if not (finance_private.c8_merchant_owner(target_merchant) or finance_private.c8_can('issue')) or value_text not in ('automatic','manual','disabled') then raise exception 'renewal owner required' using errcode='42501';end if;kind_value:='renewal';
 else if not finance_private.c8_can(action_value) or action_value not in ('suspend','resume','cancel') then raise exception 'administrative permission required' using errcode='42501';end if;kind_value:='administrative';if value_text is distinct from (case action_value when 'suspend' then 'suspended' when 'resume' then 'active' else 'cancelled' end) then raise exception 'invalid action';end if;end if;
 perform 1 from public.merchants where id=target_merchant for no key update;perform 1 from public.subscription_memberships where merchant_id=target_merchant;if not found then raise exception 'C8 enrollment required';end if;
 op:=finance_private.begin_operation('c8_change',attempt_key,jsonb_build_object('merchant',target_merchant,'action',action_value,'value',value_text,'reason',change_reason));if op.state in ('completed','rejected') then return op.result;end if;
 select value into current_admin from public.subscription_account_events where merchant_id=target_merchant and kind='administrative' order by seq desc limit 1;
 if kind_value='administrative' and current_admin='cancelled' then return finance_private.c8_reject(op.id,'administrative_state');end if;
 if action_value='resume' and current_admin is distinct from 'suspended' then return finance_private.c8_reject(op.id,'administrative_state');end if;
 insert into public.subscription_account_events(merchant_id,kind,value,actor_id,reason,operation_id) values(target_merchant,kind_value,value_text,auth.uid(),trim(change_reason),op.id);
 return finance_private.c8_done(op.id,jsonb_build_object('state','completed','kind','change','id',target_merchant));end $$;
create function finance_private.c8_issue(merchant_value uuid,key_value uuid,automatic_value boolean,issue_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.subscription_memberships%rowtype;v public.subscription_plan_versions%rowtype;anchor public.merchant_subscriptions%rowtype;op public.financial_operations%rowtype;i public.subscription_billing_documents%rowtype;ref uuid;evt uuid;receivable uuid;revenue uuid;payload jsonb;start_value timestamptz;r jsonb;
begin
 perform finance_private.c8_enabled();if current_setting('transaction_isolation')<>'read committed' then raise exception 'C8 requires READ COMMITTED';end if;
 perform 1 from public.merchants where id=merchant_value for no key update;select * into strict member from public.subscription_memberships where merchant_id=merchant_value;
 if automatic_value then if auth.uid() is not null or session_user<>current_user or not exists(select 1 from finance_private.c8_control where singleton and scheduler_enabled) then raise exception 'private scheduler only' using errcode='42501';end if;
 elsif not finance_private.c8_can('issue') and (not finance_private.c8_merchant_owner(merchant_value) or finance_private.c8_state(merchant_value,clock_timestamp())->>'renewal_mode'<>'manual') then raise exception 'manual renewal owner required' using errcode='42501';end if;
 select * into anchor from public.merchant_subscriptions where merchant_id=merchant_value order by expires_at desc,id desc limit 1;
 if automatic_value and (anchor.id is null or anchor.expires_at>clock_timestamp() or finance_private.c8_state(merchant_value,clock_timestamp())->>'renewal_mode'<>'automatic' or finance_private.c8_state(merchant_value,clock_timestamp())->>'state' in ('suspended','cancelled')) then return jsonb_build_object('state','skipped');end if;
 if issue_reason is null or length(trim(issue_reason)) not between 2 and 1500 then raise exception 'issuance reason required';end if;
 payload:=jsonb_build_object('merchant',merchant_value,'reason',issue_reason,'origin',case when automatic_value then 'scheduler' else 'interactive' end);
 if automatic_value then
  perform finance_private.defer_foundation_constraints();insert into public.financial_operations(actor_id,actor_role,system_source,operation_type,attempt_key,canonical_input) values(null,null,'subscription_scheduler','c8_issue',key_value,payload) on conflict(attempt_key) where actor_id is null do nothing;
  select * into strict op from public.financial_operations where actor_id is null and attempt_key=key_value for update;if op.canonical_input is distinct from payload then raise exception 'scheduler key mismatch';end if;
 else op:=finance_private.begin_operation('c8_issue',key_value,payload);end if;
 if op.state in ('completed','rejected') then return op.result;end if;
 select d.* into i from public.subscription_billing_documents d where d.merchant_id=merchant_value and not exists(select 1 from public.subscription_cash_receipts r where r.invoice_id=d.id) and not finance_private.subscription_invoice_voided(d.id) order by d.issued_at limit 1;
 if found then return finance_private.c8_done(op.id,(select o.result from public.financial_operations o where o.id=i.operation_id));end if;
 if exists(select 1 from public.subscription_billing_documents d where d.merchant_id=merchant_value and d.anchor_period_id is not distinct from anchor.id and finance_private.subscription_invoice_voided(d.id)) then return finance_private.c8_reject(op.id,'voided_period_requires_review');end if;
 if anchor.id is not null and anchor.starts_at>clock_timestamp() then return finance_private.c8_reject(op.id,'renewal_not_due');end if;
 select * into v from public.subscription_plan_versions where plan_id=member.plan_id and effective_at<=clock_timestamp() order by effective_at desc,version desc limit 1;
 if not found or not v.available or not exists(select 1 from public.subscription_plans where id=v.plan_id and is_active) then return finance_private.c8_reject(op.id,'plan_unavailable');end if;
 start_value:=coalesce(anchor.expires_at,clock_timestamp());
 if finance_private.c8_state(merchant_value,clock_timestamp())->>'state' in ('suspended','cancelled') then return finance_private.c8_reject(op.id,'subscription_stopped');end if;
 set constraints public.c8_invoice_complete deferred;
 insert into public.subscription_billing_documents(merchant_id,plan_version_id,anchor_period_id,period_start_snapshot,period_end_snapshot,amount,operation_id) values(merchant_value,v.id,anchor.id,start_value,((start_value at time zone 'UTC')+make_interval(months=>v.months)) at time zone 'UTC',v.price,op.id) returning * into i;
 insert into public.financial_document_references(kind,document_id,billing_document_id) values('SIN',i.id,i.id) returning id into ref;
 if automatic_value then insert into public.financial_events(source_reference_id,event_type,operation_id) values(ref,'subscription_invoice_issued',op.id) returning id into evt;
 else evt:=finance_private.record_financial_event(ref,'subscription_invoice_issued',op.id);end if;
 receivable:=finance_private.c4_account('subscription_receivable',null,merchant_value);revenue:=finance_private.c4_account('subscription_revenue');
 perform finance_private.post_journal(evt,jsonb_build_array(jsonb_build_object('account_id',receivable,'side','debit','amount',v.price),jsonb_build_object('account_id',revenue,'side','credit','amount',v.price)),'subscription invoice recognized; no cash received');
 r:=jsonb_build_object('state','completed','kind','invoice','id',i.id,'merchant_id',merchant_value,'amount',v.price::text,'reference',(select public_reference from public.financial_document_references where id=ref));return finance_private.c8_done(op.id,r);
end $$;
create function public.issue_subscription_invoice(target_merchant uuid,expected_user uuid,attempt_key uuid,issue_reason text) returns jsonb language plpgsql security definer set search_path='' as $$ begin if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'account changed' using errcode='42501';end if;if not (finance_private.c8_merchant_owner(target_merchant) or finance_private.c8_can('issue')) then raise exception 'subscription owner required' using errcode='42501';end if;return finance_private.c8_issue(target_merchant,attempt_key,false,issue_reason);end $$;
-- Read-only recognition of an independently authorized, exact C2 reversal. No refund/void writer is exposed.
create function finance_private.subscription_invoice_voided(invoice_value uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.subscription_billing_documents i join public.financial_document_references f on f.billing_document_id=i.id
 join public.financial_events issued on issued.source_reference_id=f.id and issued.operation_id=i.operation_id and issued.event_type='subscription_invoice_issued'
 join public.journal_entries original on original.event_id=issued.id and original.status='posted'
 join public.journal_entries reversed on reversed.reversal_of=original.id and reversed.status='posted'
 join public.financial_events e on e.id=reversed.event_id and e.source_reference_id=f.id and e.event_type='subscription_invoice_voided'
 join public.financial_operations o on o.id=e.operation_id and o.state='completed' and o.actor_role='admin' where i.id=invoice_value)
$$;
create function finance_private.c8_receivable(merchant_value uuid) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(case l.side when 'debit' then l.amount else -l.amount end),0) from public.financial_accounts a join public.journal_lines l on l.account_id=a.id join public.journal_entries j on j.id=l.journal_entry_id and j.status='posted' join public.financial_events e on e.id=j.event_id join public.financial_operations o on o.id=e.operation_id and o.state='completed' where a.definition_code='subscription_receivable' and a.merchant_id=merchant_value
$$;
create function finance_private.subscription_activation_start(previous_end timestamptz,paid_at timestamptz) returns timestamptz language sql immutable security definer set search_path='' as $$ select case when previous_end is not null and paid_at<previous_end+interval '168 hours' then previous_end else paid_at end $$;
create function public.collect_subscription_invoice(target_invoice uuid,target_merchant uuid,expected_user uuid,attempt_key uuid,counted_amount numeric,collection_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.subscription_billing_documents%rowtype;v public.subscription_plan_versions%rowtype;previous public.subscription_cash_receipts%rowtype;op public.financial_operations%rowtype;m uuid;receipt_value uuid;period_value uuid:=gen_random_uuid();ref uuid;evt uuid;treasury uuid;receivable uuid;start_value timestamptz;end_value timestamptz;anchor_end timestamptz;at_time timestamptz;expected_balance numeric;r jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c8_can('collect') then raise exception 'cash collector permission required' using errcode='42501';end if;perform finance_private.c8_enabled();
 if current_setting('transaction_isolation')<>'read committed' or counted_amount is null or counted_amount<=0 or counted_amount<>round(counted_amount,2) or collection_reason is null or length(trim(collection_reason)) not between 2 and 1500 then raise exception 'invalid full cash collection';end if;
 select merchant_id into strict m from public.subscription_billing_documents where id=target_invoice;
 if m is distinct from target_merchant then raise exception 'invoice scope mismatch' using errcode='42501';end if;
 perform 1 from public.merchants where id=m for no key update; -- FK compatible with C7 while waiting on treasury.
 perform 1 from finance_private.c6_treasury_mutex where singleton for update;
 select * into strict i from public.subscription_billing_documents where id=target_invoice for update;
 op:=finance_private.begin_operation('c8_collect',attempt_key,jsonb_build_object('invoice',target_invoice,'amount',counted_amount,'reason',collection_reason));if op.state in ('completed','rejected') then return op.result;end if;
 if counted_amount<>i.amount then return finance_private.c8_reject(op.id,'amount_mismatch');end if;
 select * into previous from public.subscription_cash_receipts where invoice_id=i.id;
 if found then return finance_private.c8_done(op.id,(select result from public.financial_operations where id=previous.operation_id));end if;
 select coalesce(sum(d.amount),0)-(select coalesce(sum(amount),0) from public.subscription_cash_receipts where merchant_id=m) into expected_balance from public.subscription_billing_documents d where d.merchant_id=m and not finance_private.subscription_invoice_voided(d.id);
 if finance_private.c8_receivable(m)<>expected_balance or expected_balance<i.amount or finance_private.subscription_invoice_voided(i.id) then return finance_private.c8_reject(op.id,'ledger_requires_review');end if;
 if not exists(select 1 from public.financial_document_references f join public.financial_events e on e.source_reference_id=f.id and e.operation_id=i.operation_id and e.event_type='subscription_invoice_issued' join public.journal_entries j on j.event_id=e.id and j.status='posted' where f.billing_document_id=i.id and not exists(select 1 from public.journal_entries rr where rr.reversal_of=j.id)) then return finance_private.c8_reject(op.id,'invoice_unavailable');end if;
 select * into strict v from public.subscription_plan_versions where id=i.plan_version_id;
 select expires_at into anchor_end from public.merchant_subscriptions where id=i.anchor_period_id;
 at_time:=clock_timestamp();start_value:=finance_private.subscription_activation_start(anchor_end,at_time);
 end_value:=((start_value at time zone 'UTC')+make_interval(months=>v.months)) at time zone 'UTC';
 set constraints all deferred;
 insert into public.subscription_cash_receipts(invoice_id,merchant_id,amount,operation_id,received_by,reason,period_id,received_at) values(i.id,m,i.amount,op.id,auth.uid(),trim(collection_reason),period_value,at_time) returning id into receipt_value;
 -- Only the receipt-backed C8 writer may insert this native operational period.
 insert into public.merchant_subscriptions(id,merchant_id,plan_id,plan_name_snapshot,duration_months,price_snapshot,currency_snapshot,starts_at,expires_at,commission_rate_snapshot) values(period_value,m,v.plan_id,v.name,v.months,i.amount,'SYP',start_value,end_value,v.commission_rate);
 insert into public.financial_document_references(kind,document_id,subscription_cash_receipt_id) values('RCT',receipt_value,receipt_value) returning id into ref;
 evt:=finance_private.record_financial_event(ref,'subscription_cash_received',op.id);treasury:=finance_private.c4_account('treasury_cash');receivable:=finance_private.c4_account('subscription_receivable',null,m);
 perform finance_private.post_journal(evt,jsonb_build_array(jsonb_build_object('account_id',treasury,'side','debit','amount',i.amount),jsonb_build_object('account_id',receivable,'side','credit','amount',i.amount)),'full cash subscription payment');
 r:=jsonb_build_object('state','completed','kind','receipt','id',receipt_value,'merchant_id',m,'invoice_id',i.id,'amount',i.amount::text,'reference',(select public_reference from public.financial_document_references where id=ref));return finance_private.c8_done(op.id,r);
end $$;
create function finance_private.c8_require_document() returns trigger language plpgsql security definer set search_path='' as $$ declare op uuid;ref uuid;amount_value numeric;merchant_value uuid;event_name text;debit_code text;credit_code text;begin
 op:=new.operation_id;amount_value:=new.amount;merchant_value:=new.merchant_id;
 if tg_table_name='subscription_billing_documents' then
  if not exists(select 1 from public.subscription_plan_versions v join public.subscription_memberships m on m.merchant_id=new.merchant_id and m.plan_id=v.plan_id where v.id=new.plan_version_id and new.amount=v.price and new.period_end_snapshot=((new.period_start_snapshot at time zone 'UTC')+make_interval(months=>v.months)) at time zone 'UTC' and (new.anchor_period_id is null or exists(select 1 from public.merchant_subscriptions pp where pp.id=new.anchor_period_id and pp.merchant_id=new.merchant_id and pp.expires_at=new.period_start_snapshot))) then raise exception 'invoice snapshot mismatch';end if;
  select id into ref from public.financial_document_references where billing_document_id=new.id;event_name:='subscription_invoice_issued';debit_code:='subscription_receivable';credit_code:='subscription_revenue';
 else select id into ref from public.financial_document_references where subscription_cash_receipt_id=new.id;event_name:='subscription_cash_received';debit_code:='treasury_cash';credit_code:='subscription_receivable';
  if not exists(select 1 from public.merchant_subscriptions p join public.subscription_billing_documents i on i.id=new.invoice_id join public.subscription_plan_versions v on v.id=i.plan_version_id where p.id=new.period_id and p.merchant_id=new.merchant_id and new.amount=i.amount and p.price_snapshot=i.amount and p.commission_rate_snapshot=v.commission_rate and p.duration_months=v.months and p.plan_id=v.plan_id and p.plan_name_snapshot=v.name and p.starts_at=finance_private.subscription_activation_start((select expires_at from public.merchant_subscriptions where id=i.anchor_period_id),new.received_at) and p.expires_at=((p.starts_at at time zone 'UTC')+make_interval(months=>v.months)) at time zone 'UTC') then raise exception 'receipt needs matching paid period';end if;
 end if;
 if not exists(select 1 from public.financial_operations o join public.financial_events e on e.operation_id=o.id and e.source_reference_id=ref and e.event_type=event_name join public.journal_entries j on j.event_id=e.id and j.status='posted' where o.id=op and o.state='completed'
  and (select count(*) from public.journal_lines where journal_entry_id=j.id)=2
  and exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=j.id and l.side='debit' and l.amount=amount_value and a.definition_code=debit_code and (a.merchant_id=merchant_value or a.merchant_id is null))
  and exists(select 1 from public.journal_lines l join public.financial_accounts a on a.id=l.account_id where l.journal_entry_id=j.id and l.side='credit' and l.amount=amount_value and a.definition_code=credit_code and (a.merchant_id=merchant_value or a.merchant_id is null))) then raise exception 'C8 document must have complete balanced C2 posting';end if;return null;
end $$;
create constraint trigger c8_invoice_complete after insert on public.subscription_billing_documents deferrable initially deferred for each row execute function finance_private.c8_require_document();
create constraint trigger c8_receipt_complete after insert on public.subscription_cash_receipts deferrable initially deferred for each row execute function finance_private.c8_require_document();
create table finance_private.subscription_job_failures(id bigint generated always as identity primary key,merchant_id uuid not null references public.merchants(id),period_id uuid not null references public.merchant_subscriptions(id),error_code text not null,at timestamptz not null default clock_timestamp());
create trigger c8_job_failure_immutable before update or delete on finance_private.subscription_job_failures for each row execute function finance_private.reject_mutation();
revoke all on finance_private.subscription_job_failures from public,anon,authenticated,service_role;
revoke all on sequence finance_private.subscription_job_failures_id_seq from public,anon,authenticated,service_role;
create function finance_private.run_due_subscription_invoices(batch_limit integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$ declare candidate record;n integer:=0;failed integer:=0;key_value uuid;result_value jsonb;begin
 if auth.uid() is not null or session_user<>current_user then raise exception 'database scheduler only' using errcode='42501';end if;
 if not exists(select 1 from finance_private.c8_control where singleton and scheduler_enabled and accept_operations) then return jsonb_build_object('processed',0,'disabled',true);end if;
 if batch_limit is null or batch_limit not between 1 and 100 then raise exception 'invalid batch';end if;
 for candidate in select m.merchant_id,p.id from public.subscription_memberships m join lateral(select id,expires_at from public.merchant_subscriptions where merchant_id=m.merchant_id order by expires_at desc,id desc limit 1) p on true where p.expires_at<=clock_timestamp() and finance_private.c8_state(m.merchant_id,clock_timestamp())->>'renewal_mode'='automatic' and finance_private.c8_state(m.merchant_id,clock_timestamp())->>'state' not in ('suspended','cancelled') order by p.expires_at,m.merchant_id limit batch_limit loop
  key_value:=md5('subscription-invoice:'||candidate.merchant_id::text||':'||candidate.id::text)::uuid;
  begin result_value:=finance_private.c8_issue(candidate.merchant_id,key_value,true,'scheduled subscription renewal');if result_value->>'state'='rejected' then raise exception 'scheduled invoice needs retry after correction';end if;if result_value->>'state'='completed' then n:=n+1;end if;exception when others then insert into finance_private.subscription_job_failures(merchant_id,period_id,error_code) values(candidate.merchant_id,candidate.id,sqlstate);failed:=failed+1;end;
 end loop;return jsonb_build_object('processed',n,'failed',failed);
end $$;
-- No cron.schedule call here. Owner registers the private function only after isolated tests.
create function public.recover_subscription_operation(expected_user uuid,attempt_key uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ declare r jsonb;begin
 if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'attempt owner required' using errcode='42501';end if;
 select o.result into r from public.financial_operations o where o.actor_id=auth.uid() and o.attempt_key=recover_subscription_operation.attempt_key and o.operation_type like 'c8_%' and o.state in ('completed','rejected');return coalesce(r,jsonb_build_object('state','unknown'));end $$;

-- C3 account/cart/recovery/price guards unchanged; expose safe eligibility rejection.
create or replace function public.create_c3_order_from_cart(input_recipient_name text,input_contact_phone text,input_delivery_address text,
  input_delivery_zone uuid,input_customer_note text,request_key_value uuid,expected_total numeric,
  expected_user uuid,expected_cart_signature text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request_row public.customer_order_requests%rowtype; payload jsonb; order_value uuid; total_value numeric;
  cart_value uuid; failure_value text;
begin
  -- Before INSERT, locks, or replay: a new bearer must never execute an old account's intent.
  if expected_user is null or expected_user is distinct from auth.uid() then
    raise exception 'C3_ACCOUNT_CHANGED' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=expected_user and role='customer') then
    raise exception 'customer required' using errcode='42501'; end if;
  if request_key_value is null or expected_total is null or expected_total<0 or expected_total<>round(expected_total,2)
    or expected_total>999999999999.99 or expected_total::text in ('NaN','Infinity','-Infinity')
    or expected_cart_signature is null or char_length(expected_cart_signature) not between 1 and 1000000 then
    raise exception 'invalid confirmed checkout input'; end if;
  payload:=jsonb_build_array(expected_user,input_recipient_name,input_contact_phone,input_delivery_address,input_delivery_zone,
    input_customer_note,expected_total,expected_cart_signature);
  insert into public.customer_order_requests(customer_id,request_key,canonical_input)
    values(expected_user,request_key_value,payload) on conflict do nothing;
  select * into strict request_row from public.customer_order_requests
    where customer_id=expected_user and request_key=request_key_value for update;
  if request_row.canonical_input is distinct from payload then raise exception 'C3_ATTEMPT_INPUT_MISMATCH'; end if;
  if request_row.state='completed' then
    if not exists(select 1 from public.customer_orders where id=request_row.customer_order_id and customer_id=expected_user) then raise exception 'C3_ORDER_OWNERSHIP_MISMATCH' using errcode='42501'; end if;
    return jsonb_build_object('state','completed','order_id',request_row.customer_order_id,'replayed',true); end if;
  if request_row.state='rejected' then return jsonb_build_object('state','rejected','code',request_row.failure_code); end if;
  begin
    perform 1 from public.delivery_zones where id=input_delivery_zone and is_active for share;
    if not found then raise exception 'delivery zone is unavailable'; end if;
    if not exists(select 1 from public.profiles where id=expected_user and role='customer') then raise exception 'customer required' using errcode='42501';end if;
 cart_value:=finance_private.c3_lock_cart(expected_user);
    if finance_private.c3_cart_signature(cart_value) is distinct from expected_cart_signature then raise exception 'C3_CART_CHANGED'; end if;
    order_value:=public.create_order_from_cart(input_recipient_name,input_contact_phone,input_delivery_address,input_delivery_zone,input_customer_note);
    select approved_total into strict total_value from public.order_pricing_snapshots where customer_order_id=order_value;
    if total_value<>expected_total then raise exception 'C3_PRICE_CHANGED'; end if;
  exception when raise_exception or numeric_value_out_of_range or check_violation or foreign_key_violation then
    -- The subtransaction rolls back order/items/references/notifications. Persist a
    -- terminal rejection so a delayed same-key request cannot later create an order.
    failure_value:=case when sqlerrm='C8_STORE_UNAVAILABLE' then 'C8_STORE_UNAVAILABLE' when sqlerrm='C3_CART_CHANGED' then 'C3_CART_CHANGED'
      when sqlerrm='C3_PRICE_CHANGED' then 'C3_PRICE_CHANGED' else 'C3_ORDER_REJECTED' end;
    update public.customer_order_requests set state='rejected',failure_code=failure_value
      where customer_id=expected_user and request_key=request_key_value;
    return jsonb_build_object('state','rejected','code',failure_value);
  end;
  update public.customer_order_requests set state='completed',customer_order_id=order_value
    where customer_id=expected_user and request_key=request_key_value;
  return jsonb_build_object('state','completed','order_id',order_value,'replayed',false);
end $$;
revoke all on function public.create_c3_order_from_cart(text,text,text,uuid,text,uuid,numeric,uuid,text) from public,anon,service_role;
grant execute on function public.create_c3_order_from_cart(text,text,text,uuid,text,uuid,numeric,uuid,text) to authenticated;

create function finance_private.c8_legacy_quote(target_zone uuid,expected_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare zone_row public.delivery_zones%rowtype; cart_value uuid; goods numeric; offer_goods numeric;
  count_value integer; fee_value numeric;
begin
  if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'C3_ACCOUNT_CHANGED' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=expected_user and role='customer') then raise exception 'customer required' using errcode='42501'; end if;
  select * into zone_row from public.delivery_zones where id=target_zone and is_active for share;
  if not found then raise exception 'delivery zone is unavailable'; end if;
  cart_value:=finance_private.c3_lock_cart(expected_user);
  select count(*)::integer into count_value from (
    select p.store_id from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_value
    union select o.store_id from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id where cs.cart_id=cart_value
  ) stores_in_cart;
  if count_value=0 then raise exception 'cart is empty'; end if;
  select coalesce(sum(round(ci.quantity*p.price,2)),0) into goods
  from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_value;
  select coalesce(sum(offer_total),0) into offer_goods from (
    select o.id,case when o.offer_type='bundle' then round(o.bundle_price,2) else sum(case
      when o.offer_type='discount' and o.discount_method='percentage' then round(round(p.price*op.quantity,2)*(100-o.discount_value)/100,2)
      when o.offer_type='discount' then round(greatest(0,p.price-o.discount_value)*op.quantity,2)
      when op.item_role='reward' then 0 else round(p.price*op.quantity,2) end) end as offer_total
    from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id
    join public.store_offer_products op on op.offer_id=o.id join public.products p on p.id=op.product_id
    where cs.cart_id=cart_value group by o.id
  ) priced_offers;
  goods:=goods+offer_goods;
  fee_value:=finance_private.c3_fee(zone_row.fixed_fee,zone_row.additional_store_fee,count_value);
  if goods+fee_value>999999999999.99 then raise exception 'order total exceeds supported amount'; end if;
  return jsonb_build_object('items_amount',goods,'delivery_fee',fee_value,'total',goods+fee_value,'store_count',count_value,'cart_signature',finance_private.c3_cart_signature(cart_value));
end $$;

create or replace function public.quote_c3_cart(target_zone uuid,expected_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare cart_value uuid;begin
 if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'C3_ACCOUNT_CHANGED' using errcode='42501';end if;
 if not exists(select 1 from public.profiles where id=expected_user and role='customer') then raise exception 'customer required' using errcode='42501';end if;
 cart_value:=finance_private.c3_lock_cart(expected_user);
 if exists(select 1 from (select p.store_id from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_value union select o.store_id from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id where cs.cart_id=cart_value) x
  join public.stores s on s.id=x.store_id join public.subscription_memberships m on m.merchant_id=s.merchant_id where not public.store_accepts_new_orders(s.id)) then raise exception 'C8_STORE_UNAVAILABLE';end if;
 return finance_private.c8_legacy_quote(target_zone,expected_user);
end $$;
create function public.read_subscription_account(expected_user uuid,target_merchant uuid default null,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m uuid:=target_merchant;member public.subscription_memberships%rowtype;invoices_value jsonb;events_value jsonb;plans_value jsonb;state_value jsonb;expected_balance numeric;caps jsonb;history_value jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'account changed' using errcode='42501';end if;
 if m is null then select id into strict m from public.merchants where owner_user_id=auth.uid();end if;
 if not finance_private.c8_owns(m) then raise exception 'subscription scope denied' using errcode='42501';end if;
 if page_number is null or page_number<0 or page_number>100000 then raise exception 'invalid page';end if;
 select * into member from public.subscription_memberships where merchant_id=m;
 state_value:=finance_private.c8_state(m,statement_timestamp());
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into invoices_value from (
  select i.id,i.amount::text,i.issued_at,i.period_start_snapshot,i.period_end_snapshot,v.name as plan_name,v.months,
   f.public_reference as reference,case when finance_private.subscription_invoice_voided(i.id) then 'voided' when r.id is null then 'unpaid' else 'paid' end as status,
   r.amount::text as paid_amount,pf.public_reference as receipt_reference,p.starts_at,p.expires_at
  from public.subscription_billing_documents i join public.subscription_plan_versions v on v.id=i.plan_version_id join public.financial_document_references f on f.billing_document_id=i.id left join public.subscription_cash_receipts r on r.invoice_id=i.id left join public.financial_document_references pf on pf.subscription_cash_receipt_id=r.id left join public.merchant_subscriptions p on p.id=r.period_id where i.merchant_id=m order by i.issued_at desc,i.id limit 20 offset page_number*20) q;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into events_value from (select kind,value,reason,at,actor_id from public.subscription_account_events where merchant_id=m order by seq desc limit 20 offset page_number*20) q;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into plans_value from (select distinct on(p.id) p.id as plan_id,p.name as base_name,v.id as version_id,v.name,v.description,v.price::text,v.months,v.available,v.effective_at from public.subscription_plans p left join public.subscription_plan_versions v on v.plan_id=p.id and v.effective_at<=statement_timestamp() where p.is_active order by p.id,v.effective_at desc,v.version desc) q;
 select coalesce(sum(amount),0)-(select coalesce(sum(amount),0) from public.subscription_cash_receipts where merchant_id=m) into expected_balance from public.subscription_billing_documents where merchant_id=m;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into history_value from (select name,price::text,months,effective_at,reason,changed_by from public.subscription_plan_versions where public.is_admin() or (plan_id=member.plan_id and effective_at<=statement_timestamp()) order by version desc limit 20 offset page_number*20) q;
 select jsonb_object_agg(p.key,finance_private.c8_can(p.key)) into caps from unnest(array['plans','issue','collect','suspend','resume','cancel']) as p(key);
 return jsonb_build_object('merchant_id',m,'managed',member.merchant_id is not null,'state',state_value,'plans',plans_value,'plan_history',history_value,'invoices',invoices_value,'events',events_value,'capabilities',caps,
  'enrolled_plan_id',member.plan_id,'outstanding',finance_private.c8_receivable(m)::text,'review_required',finance_private.c8_receivable(m)<>expected_balance or finance_private.c8_receivable(m)<0,
  'operations_enabled',exists(select 1 from finance_private.c8_control where singleton and accept_operations),'gate_enabled',member.merchant_id is not null or exists(select 1 from finance_private.c8_control where singleton and enforce_gate),
  'has_more',greatest((select count(*) from public.subscription_billing_documents where merchant_id=m),(select count(*) from public.subscription_account_events where merchant_id=m),(select count(*) from public.subscription_plan_versions where public.is_admin() or plan_id=member.plan_id))>(page_number+1)*20);
end $$;
create function public.list_subscription_accounts(expected_user uuid,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$ declare r jsonb;begin
 if expected_user is null or expected_user is distinct from auth.uid() or not coalesce(public.is_admin(),false) then raise exception 'admin required' using errcode='42501';end if;
 if page_number is null or page_number<0 or page_number>100000 then raise exception 'invalid page';end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into r from (select m.id as merchant_id,s.name as store_name,exists(select 1 from public.subscription_memberships mm where mm.merchant_id=m.id) as managed,finance_private.c8_state(m.id,statement_timestamp()) as state from public.merchants m join public.stores s on s.merchant_id=m.id where m.status='accepted' order by m.id limit 20 offset page_number*20) q;
 return jsonb_build_object('rows',r,'has_more',(select count(*) from public.merchants m join public.stores s on s.merchant_id=m.id where m.status='accepted')>(page_number+1)*20);
end $$;
create function finance_private.c8_plan_fence() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from public.subscription_plan_versions where plan_id=old.id) and not finance_private.c8_can('plans') then raise exception 'C8 plan management permission required' using errcode='42501';end if;if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger c8_plan_permission before update or delete on public.subscription_plans for each row execute function finance_private.c8_plan_fence();
-- Match the C8 absolute grace boundary when snapshotting commission; legacy calendar policy unchanged.
create or replace function public.snapshot_store_order_commission_after_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row record;
  total_count integer;
  total_currency public.currency_code;
  total_base_amount numeric(14,2);
  subscription_row record;
  rate_value numeric(7,4);
  commission_value numeric(14,2);
begin
  select so.id, so.created_at, so.status, so.delivered_at, s.merchant_id
    into order_row
  from public.store_orders so
  join public.stores s on s.id = so.store_id
  where so.id = new.store_order_id
  for key share of so;

  if not found then
    raise exception 'store order was not found while snapshotting commission';
  end if;

  -- Deferred triggers observe the final row state. A transaction that creates
  -- and then rejects/cancels an order must not leave a pending commission.
  if order_row.status in ('rejected', 'cancelled') then
    return new;
  end if;

  select count(*) into total_count
  from public.store_order_totals t
  where t.store_order_id = new.store_order_id;

  if total_count <> 1 then
    raise exception 'a store order must have exactly one currency total before commission snapshotting';
  end if;

  select t.currency, t.items_subtotal
    into total_currency, total_base_amount
  from public.store_order_totals t
  where t.store_order_id = new.store_order_id;

  select ms.id as subscription_id, ms.plan_id, ms.plan_name_snapshot,
         ms.commission_rate_snapshot
    into subscription_row
  from public.merchant_subscriptions ms
  where ms.merchant_id = order_row.merchant_id
    and ms.starts_at <= order_row.created_at
    and ms.expires_at + case when exists(select 1 from public.subscription_memberships sm where sm.merchant_id=ms.merchant_id) then interval '168 hours' else interval '7 days' end > order_row.created_at
  order by ms.starts_at desc, ms.expires_at desc, ms.id desc
  limit 1
  for share of ms;

  if not found then
    raise exception 'no active subscription period covers this store order';
  end if;

  rate_value := subscription_row.commission_rate_snapshot;
  if rate_value is null then
    raise exception 'the active subscription period has no commission rate snapshot';
  end if;

  commission_value := round(total_base_amount * rate_value / 100, 2);

  insert into public.store_order_commissions(
    store_order_id, merchant_id, subscription_id, plan_id, plan_name_snapshot,
    currency, commission_rate, base_amount, commission_amount, status
  ) values (
    new.store_order_id, order_row.merchant_id, subscription_row.subscription_id,
    subscription_row.plan_id, subscription_row.plan_name_snapshot, total_currency,
    rate_value, total_base_amount, commission_value, 'pending_delivery'
  ) on conflict (store_order_id) do nothing;

  if order_row.status = 'delivered' then
    perform public.accrue_store_order_commission(
      new.store_order_id,
      order_row.delivered_at
    );
  end if;

  return new;
end;
$$;

-- Preserve legacy renewal algorithm/keys; skip C8 cohorts so they cannot starve legacy batches.
create or replace function public.process_due_merchant_subscription_renewals(
  batch_limit integer default 50
)
returns table (renewed_count integer, skipped_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  automatic_key uuid;
begin
  if batch_limit is null or batch_limit < 1 or batch_limit > 100 then
    raise exception 'batch limit must be between 1 and 100';
  end if;
  renewed_count := 0;
  skipped_count := 0;

  for candidate in
    select ms.merchant_id, ms.id as subscription_id
    from public.merchant_billing_settings b
    join lateral (
      select s.id, s.merchant_id, s.expires_at
      from public.merchant_subscriptions s
      where s.merchant_id = b.merchant_id
      order by s.expires_at desc, s.id desc
      limit 1
    ) ms on true
    join public.merchants m on m.id = ms.merchant_id and m.status = 'accepted'
    where b.auto_renew and ms.expires_at <= now() and not exists(select 1 from public.subscription_memberships c8 where c8.merchant_id=ms.merchant_id)
    order by ms.expires_at, ms.id
    limit batch_limit
  loop
    automatic_key := (
      substr(md5('tasawuq:subscription-renewal:auto:' || candidate.subscription_id::text), 1, 8)
      || '-' || substr(md5('tasawuq:subscription-renewal:auto:' || candidate.subscription_id::text), 9, 4)
      || '-' || substr(md5('tasawuq:subscription-renewal:auto:' || candidate.subscription_id::text), 13, 4)
      || '-' || substr(md5('tasawuq:subscription-renewal:auto:' || candidate.subscription_id::text), 17, 4)
      || '-' || substr(md5('tasawuq:subscription-renewal:auto:' || candidate.subscription_id::text), 21, 12)
    )::uuid;
    begin
      perform public.subscription_renewal_internal(
        candidate.merchant_id,
        automatic_key,
        true,
        null,
        'subscription_renewed_automatically',
        'scheduled automatic renewal'
      );
      renewed_count := renewed_count + 1;
    exception when others then
      skipped_count := skipped_count + 1;
      insert into public.merchant_financial_audit_events(
        merchant_id, actor_id, event_type, reason, after_data
      ) values (
        candidate.merchant_id, null, 'subscription_auto_renewal_skipped',
        sqlerrm,
        jsonb_build_object('subscription_id', candidate.subscription_id)
      );
    end;
  end loop;
  return next;
end;
$$;

revoke all on function public.store_accepts_new_orders(uuid),public.quote_c3_cart(uuid,uuid),public.save_subscription_plan_version(uuid,uuid,uuid,text,text,numeric,integer,boolean,timestamptz,text),public.enroll_subscription_account(uuid,uuid,uuid,uuid,text),public.change_subscription_account(uuid,uuid,uuid,text,text,text),public.issue_subscription_invoice(uuid,uuid,uuid,text),public.collect_subscription_invoice(uuid,uuid,uuid,uuid,numeric,text),public.recover_subscription_operation(uuid,uuid),public.read_subscription_account(uuid,uuid,integer),public.list_subscription_accounts(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.store_accepts_new_orders(uuid) to anon,authenticated;
grant execute on function public.quote_c3_cart(uuid,uuid),public.save_subscription_plan_version(uuid,uuid,uuid,text,text,numeric,integer,boolean,timestamptz,text),public.enroll_subscription_account(uuid,uuid,uuid,uuid,text),public.change_subscription_account(uuid,uuid,uuid,text,text,text),public.issue_subscription_invoice(uuid,uuid,uuid,text),public.collect_subscription_invoice(uuid,uuid,uuid,uuid,numeric,text),public.recover_subscription_operation(uuid,uuid),public.read_subscription_account(uuid,uuid,integer),public.list_subscription_accounts(uuid,integer) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;
do $$ declare t text;begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then foreach t in array array['subscription_plan_versions','subscription_memberships','subscription_account_events','subscription_billing_documents','subscription_cash_receipts'] loop if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;end loop;end if;end $$;
commit;
