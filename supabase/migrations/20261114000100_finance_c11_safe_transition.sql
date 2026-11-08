-- LOCAL UNAPPLIED. No activation, no backfill, no legacy balance transfer.
begin;
do $$ begin
 if to_regprocedure('public.read_financial_reconciliation(uuid,integer,text)') is null then raise exception 'C11 requires complete C2-C10';end if;
 if to_regclass('public.c7_merchant_settlement_payments') is null then raise exception 'C11 requires revised UNAPPLIED C7/C10 drafts; never rename an applied legacy payment table';end if;
end $$;
create table finance_private.c11_permissions(user_id uuid primary key references public.profiles(id),may_control boolean not null default false,may_review boolean not null default false);
create table finance_private.c11_gates(path text primary key check(path in ('new_orders','delivery','custody','wages','settlements','subscriptions','treasury','reconciliation')),admit boolean not null default false);
insert into finance_private.c11_gates(path) select unnest(array['new_orders','delivery','custody','wages','settlements','subscriptions','treasury','reconciliation']);
create table finance_private.c11_gate_audit(id bigint generated always as identity primary key,path text not null references finance_private.c11_gates(path),enabled boolean not null,actor_id uuid not null references public.profiles(id),reason text not null,at timestamptz not null default clock_timestamp());
create table finance_private.c11_order_contracts(customer_order_id uuid primary key references public.order_financial_modes(customer_order_id),admission_policy_id uuid not null references public.driver_wage_policies(id),created_at timestamptz not null default clock_timestamp());
create table finance_private.c11_subscription_transitions(merchant_id uuid primary key references public.subscription_memberships(merchant_id),previous_period_id uuid references public.merchant_subscriptions(id),previous_end timestamptz,operation_id uuid not null unique references public.financial_operations(id),actor_id uuid not null references public.profiles(id),reason text not null,at timestamptz not null default clock_timestamp());
revoke all on finance_private.c11_permissions,finance_private.c11_gates,finance_private.c11_gate_audit,finance_private.c11_order_contracts,finance_private.c11_subscription_transitions from public,anon,authenticated,service_role;
revoke all on sequence finance_private.c11_gate_audit_id_seq from public,anon,authenticated,service_role;
create trigger c11_audit_immutable before update or delete on finance_private.c11_gate_audit for each row execute function finance_private.reject_mutation();
create trigger c11_contract_immutable before update or delete on finance_private.c11_order_contracts for each row execute function finance_private.reject_mutation();
create trigger c11_transition_immutable before update or delete on finance_private.c11_subscription_transitions for each row execute function finance_private.reject_mutation();

create function finance_private.c11_can(control_value boolean) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.is_admin(),false) and exists(select 1 from finance_private.c11_permissions p where p.user_id=auth.uid() and case when control_value then p.may_control else p.may_review or p.may_control end)
$$;
-- Structural checks are NOT a substitute for PostgreSQL/JWT tests or owner review.
create function finance_private.c11_readiness(path_value text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare problems text[]:=array[]::text[];dependency text;
begin
 if not exists(select 1 from finance_private.c11_gates where path=path_value) then raise exception 'invalid transition path';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='finance_private' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute') or has_function_privilege('service_role',p.oid,'execute'))) then problems:=array_append(problems,'private_execute_exposed');end if;
 if has_schema_privilege('anon','finance_private','usage') or has_schema_privilege('authenticated','finance_private','usage') or has_schema_privilege('service_role','finance_private','usage') then problems:=array_append(problems,'private_schema_exposed');end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and (n.nspname='finance_private' or n.nspname='public' and p.proname in ('complete_delivery_and_collect_cash','recover_delivery_collection','set_finance_transition_gate','transition_legacy_subscription','get_legacy_delivery_collection','read_finance_transition')) and not coalesce(p.proconfig,'{}'::text[]) @> array['search_path=""']) then problems:=array_append(problems,'unsafe_definer_search_path');end if;
 if exists(select 1 from pg_constraint where connamespace in ('public'::regnamespace,'finance_private'::regnamespace) and not convalidated) then problems:=array_append(problems,'unvalidated_constraints');end if;
 if to_regprocedure('public.complete_delivery_and_collect_cash(uuid,uuid,uuid,bigint)') is null or to_regprocedure('public.recover_delivery_collection(uuid,uuid)') is null then problems:=array_append(problems,'atomic_delivery_missing');end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('order_financial_modes','delivery_collection_results','driver_cash_handover_requests','driver_wage_entitlements','merchant_delivery_positions','subscription_memberships','treasury_finance_postings') and (not c.relrowsecurity or has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') or has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE'))) then problems:=array_append(problems,'financial_table_permissions');end if;
 foreach dependency in array array['c4_select_order_mode','c4_commission_due_guard','c6_capture_on_new_dlv','c11_order_event_writer','c11_subscription_admission','c8_native_period_guard'] loop
  if not exists(select 1 from pg_trigger t where t.tgname=dependency and t.tgrelid in ('public.order_pricing_snapshots'::regclass,'public.store_order_commissions'::regclass,'public.delivery_tasks'::regclass,'public.financial_events'::regclass,'public.subscription_memberships'::regclass,'public.merchant_subscriptions'::regclass) and t.tgenabled in ('O','A')) then problems:=array_append(problems,'trigger_'||dependency);end if;
 end loop;
 foreach dependency in array array['public.order_financial_modes:c4_mode_immutable','public.delivery_tasks:c4_task_progress','public.delivery_tasks:c4_task_atomic_result','public.store_orders:c4_child_atomic_result','public.delivery_store_pickups:c4_pickup_validate','public.delivery_collection_results:c7_delivery_detail','public.journal_entries:journal_entry_complete','public.journal_lines:journal_line_balanced','public.financial_events:financial_event_complete','public.financial_operations:financial_operation_complete'] loop
  if not exists(select 1 from pg_trigger t where t.tgrelid=to_regclass(split_part(dependency,':',1)) and t.tgname=split_part(dependency,':',2) and t.tgenabled in ('O','A')) then problems:=array_append(problems,'guard_'||dependency);end if;
 end loop;
 if path_value='new_orders' then
  foreach dependency in array array['delivery','custody','wages','settlements','treasury','reconciliation'] loop
   if not exists(select 1 from finance_private.c11_gates where path=dependency and admit) then problems:=array_append(problems,'dependency_'||dependency);end if;
  end loop;
  if not exists(select 1 from public.driver_wage_policies) then problems:=array_append(problems,'missing_wage_policy');end if;
  if not exists(select 1 from finance_private.c5_rollout where singleton and accept_requests) or not exists(select 1 from finance_private.c6_control where singleton and accept_tasks and payout_enabled) or not exists(select 1 from finance_private.c7_control where singleton and accept_settlements and payout_enabled) or not exists(select 1 from finance_private.c9_control where singleton and enabled) then problems:=array_append(problems,'underlying_drain_controls_not_ready');end if;
 end if;
 if path_value='subscriptions' then
  foreach dependency in array array['treasury','reconciliation'] loop
   if not exists(select 1 from finance_private.c11_gates where path=dependency and admit) then problems:=array_append(problems,'dependency_'||dependency);end if;
  end loop;
 end if;
 if path_value in ('custody','new_orders') and not exists(select 1 from finance_private.c5_cash_receivers r join public.profiles p on p.id=r.user_id and p.role='admin' where r.enabled) then problems:=array_append(problems,'missing_cash_receiver');end if;
 if path_value in ('wages','new_orders') and not exists(select 1 from finance_private.c6_permissions r join public.profiles p on p.id=r.user_id and p.role='admin' where r.may_pay_wages) then problems:=array_append(problems,'missing_wage_payer');end if;
 if path_value in ('settlements','new_orders') and not exists(select 1 from finance_private.c7_permissions r join public.profiles p on p.id=r.user_id and p.role='admin' where r.may_prepare and r.may_pay) then problems:=array_append(problems,'missing_settlement_permissions');end if;
 if path_value in ('subscriptions') and not exists(select 1 from finance_private.c8_permissions r join public.profiles p on p.id=r.user_id and p.role='admin' where r.issue and r.collect) then problems:=array_append(problems,'missing_subscription_permissions');end if;
 if path_value in ('treasury','new_orders') and not exists(select 1 from finance_private.c9_permissions r join public.profiles p on p.id=r.user_id and p.role='admin' where r.pay and r.expense_approve) then problems:=array_append(problems,'missing_treasury_permissions');end if;
 if path_value in ('reconciliation','new_orders') and not exists(select 1 from finance_private.c10_permissions r join public.profiles p on p.id=r.user_id and p.role='admin' where r.may_reconcile) then problems:=array_append(problems,'missing_reconciler');end if;
 return jsonb_build_object('ready',cardinality(problems)=0,'problems',to_jsonb(problems),'behavioral_tests_proven',false);
end $$;

create function public.set_finance_transition_gate(expected_user uuid,path_value text,enabled_value boolean,change_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare readiness jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c11_can(true) then raise exception 'independent transition control permission required' using errcode='42501';end if;
 if enabled_value is null or change_reason is null or length(trim(change_reason)) not between 10 and 1500 then raise exception 'documented transition reason required';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'transition requires READ COMMITTED';end if;
 -- All controllers lock gates in one order; admission takes the same locks in SHARE mode.
 perform 1 from finance_private.c11_gates order by path for update;
 readiness:=finance_private.c11_readiness(path_value);
 if enabled_value and (readiness->>'ready')::boolean is not true then raise exception 'transition not ready: %',readiness;end if;
 if enabled_value and exists(select 1 from finance_private.c10_reconciliation_issues where severity='error') then raise exception 'reconciliation errors require owner review';end if;
 if not enabled_value and path_value in ('delivery','custody','wages','settlements','treasury','reconciliation') and exists(select 1 from finance_private.c11_gates where path='new_orders' and admit) then raise exception 'stop new order admission first';end if;
 if not enabled_value and path_value in ('treasury','reconciliation') and exists(select 1 from finance_private.c11_gates where path='subscriptions' and admit) then raise exception 'stop new subscription admission first';end if;
 update finance_private.c11_gates set admit=enabled_value where path=path_value;
 -- Exactly ONE selected path. Disabling admission never disables its drain/recovery path.
 if path_value='new_orders' then update finance_private.c4_rollout set accept_new_orders=enabled_value where singleton;
 elsif enabled_value and path_value='custody' then update finance_private.c5_rollout set accept_requests=true where singleton;
 elsif enabled_value and path_value='wages' then update finance_private.c6_control set accept_tasks=true,payout_enabled=true where singleton;
 elsif enabled_value and path_value='settlements' then update finance_private.c7_control set accept_settlements=true,payout_enabled=true where singleton;
 elsif enabled_value and path_value='subscriptions' then update finance_private.c8_control set accept_operations=true,enforce_gate=true where singleton;
 elsif enabled_value and path_value='treasury' then update finance_private.c9_control set enabled=true where singleton;
 end if;
 -- No scheduler, owner permission, opening balance or reconciliation grant is auto-enabled.
 insert into finance_private.c11_gate_audit(path,enabled,actor_id,reason) values(path_value,enabled_value,auth.uid(),trim(change_reason));
 return jsonb_build_object('path',path_value,'admit',enabled_value,'existing_operations_preserved',true,'readiness',readiness);
end $$;

create or replace function finance_private.c4_select_mode() returns trigger language plpgsql security definer set search_path='' as $$
declare admission boolean;policy_value uuid;
begin
 if not exists(select 1 from finance_private.c4_order_births where order_id=new.customer_order_id and birth_xid=txid_current()) then return new;end if;
 perform 1 from finance_private.c11_gates order by path for share;
 select accept_new_orders and exists(select 1 from finance_private.c11_gates where path='new_orders' and admit) into admission from finance_private.c4_rollout where singleton for share;
 if coalesce(admission,false) and new.approved_total>0 then
  if (finance_private.c11_readiness('new_orders')->>'ready')::boolean is not true then raise exception 'C11 order admission not ready';end if;
  select id into strict policy_value from public.driver_wage_policies order by version desc limit 1;
 end if;
 insert into public.order_financial_modes(customer_order_id,mode) values(new.customer_order_id,case when coalesce(admission,false) and new.approved_total>0 then 'c4' else 'legacy' end);
 if policy_value is not null then insert into finance_private.c11_order_contracts(customer_order_id,admission_policy_id) values(new.customer_order_id,policy_value);end if;
 return new;
end $$;
-- Capture latest policy at DLV birth, as C6 did. A frozen C11 order cannot lose wages
-- because the global NEW-TASK flag was stopped after checkout. No historical task backfill.
create or replace function finance_private.c6_capture_policy() returns trigger language plpgsql security definer set search_path='' as $$
declare enabled_value boolean;p public.driver_wage_policies%rowtype;
begin
 if not finance_private.c4_is_order(new.customer_order_id) then return new;end if;
 select accept_tasks into enabled_value from finance_private.c6_control where singleton for share;
 if not coalesce(enabled_value,false) and not exists(select 1 from finance_private.c11_order_contracts where customer_order_id=new.customer_order_id) then return new;end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'C6 snapshot requires READ COMMITTED';end if;
 select * into strict p from public.driver_wage_policies order by version desc limit 1;
 insert into finance_private.c6_task_births values(new.id,txid_current());
 insert into public.delivery_wage_snapshots(task_id,customer_order_id,policy_id,percentage) values(new.id,new.customer_order_id,p.id,p.percentage);return new;
end $$;

create function finance_private.c11_guard_order_event() returns trigger language plpgsql security definer set search_path='' as $$
declare parent_value uuid;
begin
 if new.event_type not in ('full_cash_collected','delivery_completed','driver_wage_accrued') then return new;end if;
 select d.customer_order_id into parent_value from public.financial_document_references r join public.delivery_tasks d on d.id=r.delivery_task_id where r.id=new.source_reference_id and r.kind='DLV';
 if parent_value is null or not finance_private.c4_is_order(parent_value) then raise exception 'legacy order cannot use new financial writer';end if;
 return new;
end $$;
create trigger c11_order_event_writer before insert on public.financial_events for each row execute function finance_private.c11_guard_order_event();

create function finance_private.c11_treasury_admission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from finance_private.c11_gates where path='treasury' and admit for share;
 if not found then raise exception 'new treasury requests paused; existing approvals and payments remain available';end if;
 return new;
end $$;
create trigger c11_new_treasury_request before insert on public.treasury_finance_requests for each row execute function finance_private.c11_treasury_admission();

create function finance_private.c11_membership_admission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from finance_private.c11_gates where path='subscriptions' and admit for share;
 if not found then raise exception 'new C8 enrollment paused';end if;
 if (finance_private.c11_readiness('subscriptions')->>'ready')::boolean is not true then raise exception 'C11 subscription admission not ready';end if;
 -- Recheck both native and historical obligations under C8's merchant lock.
 if exists(select 1 from public.merchant_subscriptions where merchant_id=new.merchant_id and expires_at+interval '168 hours'>clock_timestamp()) then raise exception 'preserve legacy paid period and 168-hour grace';end if;
 return new;
end $$;
create trigger c11_subscription_admission before insert on public.subscription_memberships for each row execute function finance_private.c11_membership_admission();
-- Also audit explicit enrollment through the original C8 RPC; no alternate unaudited path.
create function finance_private.c11_record_subscription_transition() returns trigger language plpgsql security definer set search_path='' as $$
declare previous public.merchant_subscriptions%rowtype;op_value uuid;
begin
 select id into strict op_value from public.financial_operations where actor_id=auth.uid() and operation_type='c8_enroll' and state='pending' and canonical_input->>'merchant'=new.merchant_id::text;
 select * into previous from public.merchant_subscriptions where merchant_id=new.merchant_id order by expires_at desc,id desc limit 1;
 insert into finance_private.c11_subscription_transitions(merchant_id,previous_period_id,previous_end,operation_id,actor_id,reason) values(new.merchant_id,previous.id,previous.expires_at,op_value,auth.uid(),new.reason);
 return new;
end $$;
create trigger c11_record_enrollment after insert on public.subscription_memberships for each row execute function finance_private.c11_record_subscription_transition();
create function public.transition_legacy_subscription(target_merchant uuid,target_plan uuid,expected_user uuid,attempt_key uuid,transition_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.merchant_subscriptions%rowtype;r jsonb;op_value uuid;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c11_can(true) or not finance_private.c8_can('issue') then raise exception 'transition and subscription issue permissions required' using errcode='42501';end if;
 -- Same order as enrollment: merchant first, operation next. Recovery works after admission stops.
 perform 1 from public.merchants where id=target_merchant for no key update;
 select * into previous from public.merchant_subscriptions where merchant_id=target_merchant order by expires_at desc,id desc limit 1;
 r:=public.enroll_subscription_account(target_merchant,target_plan,expected_user,attempt_key,transition_reason);
 if r->>'state'='completed' then
  select o.id into strict op_value from public.financial_operations o where o.actor_id=auth.uid() and o.attempt_key=transition_legacy_subscription.attempt_key and o.operation_type='c8_enroll';
  insert into finance_private.c11_subscription_transitions(merchant_id,previous_period_id,previous_end,operation_id,actor_id,reason) values(target_merchant,previous.id,previous.expires_at,op_value,auth.uid(),transition_reason) on conflict(merchant_id) do nothing;
 end if;
 return r;
end $$;

-- Assignment-scoped server preview for pre-C3 legacy tasks; never historical parent totals.
create function public.get_legacy_delivery_collection(expected_user uuid,target_task uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t public.delivery_tasks%rowtype;o public.customer_orders%rowtype;amount_value numeric;active_count integer;total_count integer;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not exists(select 1 from public.profiles where id=auth.uid() and role='driver') then raise exception 'assigned driver required' using errcode='42501';end if;
 select * into t from public.delivery_tasks where id=target_task and driver_id=auth.uid();if not found then raise exception 'task unavailable' using errcode='42501';end if;
 if finance_private.c4_is_order(t.customer_order_id) or exists(select 1 from public.order_pricing_current where customer_order_id=t.customer_order_id) then return jsonb_build_object('state','unavailable');end if;
 if t.status='delivered' then
  select collectible_amount into amount_value from public.customer_order_cash_obligations where delivery_task_id=t.id and driver_id=auth.uid() and customer_order_id=t.customer_order_id;
 else
  if t.status not in ('accepted','picked_up') then return jsonb_build_object('state','unavailable');end if;
  if exists(select 1 from public.store_orders where customer_order_id=t.customer_order_id and status not in ('ready_for_pickup','handed_to_driver','delivered','rejected','cancelled')) then return jsonb_build_object('state','unavailable');end if;
  select * into strict o from public.customer_orders where id=t.customer_order_id;
  if o.status='cancelled' then return jsonb_build_object('state','unavailable');end if;
  select count(*),count(sot.store_order_id),sum(sot.items_subtotal) into active_count,total_count,amount_value from public.store_orders so left join public.store_order_totals sot on sot.store_order_id=so.id where so.customer_order_id=t.customer_order_id and so.status not in ('rejected','cancelled');
  if active_count=0 or active_count<>total_count then return jsonb_build_object('state','unavailable');end if;
  amount_value:=amount_value+o.delivery_fee;
 end if;
 if amount_value is null or amount_value<0 or amount_value<>round(amount_value,2) then return jsonb_build_object('state','unavailable');end if;
 return jsonb_build_object('state','ready','source','legacy_server','task_id',t.id,'customer_order_id',t.customer_order_id,'amount',amount_value::text);
end $$;

-- Review queues are separate amounts, NOT an opening journal or a combined balance.
create view finance_private.c11_legacy_review with(security_barrier=true) as
 select 'driver_custody'::text kind,driver_id entity_id,custody_remaining_amount::numeric amount,'legacy net custody; wages already deducted by historical formula'::text note from public.driver_cash_custody_positions where custody_remaining_amount<>0
 union all select 'driver_credit',driver_id,driver_credit_amount,'legacy driver credit, not C2 cash' from public.driver_cash_custody_positions where driver_credit_amount<>0
 union all select 'merchant_payable',e.merchant_order_entitlement_id,e.current_entitlement_amount-coalesce((select sum(a.amount) from public.merchant_settlement_batch_entitlements b join public.merchant_settlement_payment_allocations a on a.batch_entitlement_id=b.id where b.merchant_order_entitlement_id=e.merchant_order_entitlement_id),0),'legacy entitlement less actual allocations; independent resolution required' from public.merchant_order_entitlement_positions e where e.current_entitlement_amount<>coalesce((select sum(a.amount) from public.merchant_settlement_batch_entitlements b join public.merchant_settlement_payment_allocations a on a.batch_entitlement_id=b.id where b.merchant_order_entitlement_id=e.merchant_order_entitlement_id),0)
 union all select 'subscription_debt',i.id,i.total_amount-coalesce((select sum(a.amount) from public.invoice_payment_allocations a where a.invoice_id=i.id),0),'legacy invoice; never imported into C8' from public.subscription_invoices i where i.status<>'void' and i.total_amount<>coalesce((select sum(a.amount) from public.invoice_payment_allocations a where a.invoice_id=i.id),0)
 union all select 'subscription_credit',p.id,p.amount-coalesce((select sum(a.amount) from public.invoice_payment_allocations a where a.payment_id=p.id),0),'legacy unapplied payment; separate owner decision' from public.subscription_payments p where p.amount<>coalesce((select sum(a.amount) from public.invoice_payment_allocations a where a.payment_id=p.id),0)
 union all select 'legacy_wage_embedded',e.id,e.delivery_fee_amount,'historical wage is embedded in custody formula; NOT a C6 unpaid wage' from public.driver_delivery_fee_entitlements e where e.delivery_fee_amount>0;
revoke all on finance_private.c11_legacy_review from public,anon,authenticated,service_role;
create function public.read_finance_transition(expected_user uuid,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare gates_value jsonb;rows_value jsonb;counts_value jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not finance_private.c11_can(false) then raise exception 'transition review permission required' using errcode='42501';end if;
 if page_number is null or page_number<0 or page_number>100000 then raise exception 'invalid page';end if;
 select jsonb_agg(jsonb_build_object('path',g.path,'admit',g.admit,'readiness',finance_private.c11_readiness(g.path)) order by g.path) into gates_value from finance_private.c11_gates g;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.kind,x.entity_id),'[]') into rows_value from(select kind,entity_id,amount::text,note from finance_private.c11_legacy_review order by kind,entity_id limit 21 offset page_number*20)x;
 select jsonb_build_object('legacy_orders',(select count(*) from public.customer_orders o where not finance_private.c4_is_order(o.id)),
 'c4_orders',(select count(*) from public.order_financial_modes where mode='c4'),'c2_events',(select count(*) from public.financial_events),
 'c8_memberships',(select count(*) from public.subscription_memberships),'reconciliation_errors',(select count(*) from finance_private.c10_reconciliation_issues where severity='error')) into counts_value;
 return jsonb_build_object('read_only',true,'at',statement_timestamp(),'gates',gates_value,'cohorts',counts_value,'legacy_rows',case when jsonb_array_length(rows_value)>20 then rows_value-20 else rows_value end,'has_more',jsonb_array_length(rows_value)>20,'balances_combined',false);
end $$;

revoke all on function public.set_finance_transition_gate(uuid,text,boolean,text),public.transition_legacy_subscription(uuid,uuid,uuid,uuid,text),public.get_legacy_delivery_collection(uuid,uuid) from public,anon,service_role;
grant execute on function public.set_finance_transition_gate(uuid,text,boolean,text),public.transition_legacy_subscription(uuid,uuid,uuid,uuid,text),public.get_legacy_delivery_collection(uuid,uuid) to authenticated;
revoke all on function public.read_finance_transition(uuid,integer) from public,anon,service_role;
grant execute on function public.read_finance_transition(uuid,integer) to authenticated;
-- First invoice after expired legacy grace describes a new period, never catch-up billing.
-- Amount, anchor uniqueness, ledger and actual paid-period creation remain C8 contracts.
create or replace function finance_private.c8_issue(merchant_value uuid,key_value uuid,automatic_value boolean,issue_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 start_value:=finance_private.subscription_activation_start(anchor.expires_at,clock_timestamp());
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

revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;
commit;
