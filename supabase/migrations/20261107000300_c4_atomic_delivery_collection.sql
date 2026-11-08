-- LOCAL ONLY / OWNER REVIEW. Requires the two unapplied C4 drafts in order.
begin;
-- Keep legacy functions/trigger OIDs callable only through guarded public names.
alter function public.accrue_store_order_commission(uuid,timestamptz) set schema finance_private;
alter function finance_private.accrue_store_order_commission(uuid,timestamptz) rename to c4_legacy_accrue;
create function public.accrue_store_order_commission(target_store_order uuid,delivered_at_value timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.store_orders where id=target_store_order and finance_private.c4_is_order(customer_order_id)) then return; end if;
  perform finance_private.c4_legacy_accrue(target_store_order,delivered_at_value);
end $$;
alter function public.create_delivered_order_cash_foundations(uuid) set schema finance_private;
alter function finance_private.create_delivered_order_cash_foundations(uuid) rename to c4_legacy_cash_foundations;
create function public.create_delivered_order_cash_foundations(target_customer_order uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if finance_private.c4_is_order(target_customer_order) then return; end if;
  perform finance_private.c4_legacy_cash_foundations(target_customer_order);
end $$;
alter function public.reverse_store_order_commission(uuid,numeric,uuid,text) set schema finance_private;
alter function finance_private.reverse_store_order_commission(uuid,numeric,uuid,text) rename to c4_legacy_reverse_commission;
create function public.reverse_store_order_commission(target_commission uuid,reversal_amount numeric,reversal_idempotency_key uuid,reversal_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'administrator required' using errcode='42501'; end if;
  if exists(select 1 from public.store_order_commissions c join public.store_orders s on s.id=c.store_order_id
    where c.id=target_commission and finance_private.c4_is_order(s.customer_order_id)) then
    raise exception 'C4 commission cannot use legacy reversal'; end if;
  return finance_private.c4_legacy_reverse_commission(target_commission,reversal_amount,reversal_idempotency_key,reversal_reason);
end $$;
-- Defense in depth: even another trusted legacy entry point cannot post C4 money.
create function finance_private.c4_guard_legacy_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare parent_value uuid;
begin
  if tg_table_name in ('customer_order_cash_obligations','driver_delivery_fee_entitlements') then
    parent_value:=new.customer_order_id;
  elsif tg_table_name='merchant_order_entitlements' then
    select customer_order_id into parent_value from public.store_orders where id=new.store_order_id;
  elsif tg_table_name='store_order_commissions' then
    if new.status<>'due' then return new; end if;
    select customer_order_id into parent_value from public.store_orders where id=new.store_order_id;
  elsif tg_table_name='store_order_commission_reversals' then
    select s.customer_order_id into parent_value from public.store_order_commissions c join public.store_orders s on s.id=c.store_order_id where c.id=new.commission_id;
  elsif tg_table_name='merchant_order_entitlement_adjustments' then
    select s.customer_order_id into parent_value from public.merchant_order_entitlements e join public.store_orders s on s.id=e.store_order_id where e.id=new.merchant_order_entitlement_id;
  elsif tg_table_name='merchant_ledger_entries' then
    if new.source_type='store_order_commission' then
      select s.customer_order_id into parent_value from public.store_order_commissions c join public.store_orders s on s.id=c.store_order_id where c.id=new.source_id;
    elsif new.source_type='commission_reversal' then
      select s.customer_order_id into parent_value from public.store_order_commission_reversals r
        join public.store_order_commissions c on c.id=r.commission_id join public.store_orders s on s.id=c.store_order_id where r.id=new.source_id;
    end if;
  end if;
  if finance_private.c4_is_order(parent_value) then raise exception 'C4_LEGACY_FINANCIAL_WRITE_PROHIBITED'; end if;
  return new;
end $$;
do $$ declare relation_value text; begin
  foreach relation_value in array array['customer_order_cash_obligations','driver_delivery_fee_entitlements','merchant_order_entitlements',
    'store_order_commission_reversals','merchant_order_entitlement_adjustments','merchant_ledger_entries'] loop
    execute format('create trigger c4_legacy_write_guard before insert on public.%I for each row execute function finance_private.c4_guard_legacy_write()',relation_value);
  end loop;
end $$;
create trigger c4_commission_due_guard before insert or update of status on public.store_order_commissions
for each row execute function finance_private.c4_guard_legacy_write();

create table public.delivery_collection_results (
  task_id uuid primary key references public.delivery_tasks(id) on delete restrict,
  customer_order_id uuid not null unique references public.customer_orders(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  operation_id uuid not null unique references public.financial_operations(id) on delete restrict,
  attempt_key uuid not null,
  canonical_input jsonb not null,
  pricing_version bigint not null,
  amount numeric not null check(amount>=0 and amount=round(amount,2) and amount<=999999999999.99),
  cash_event_id uuid unique references public.financial_events(id),
  delivery_event_id uuid unique references public.financial_events(id),
  kind text not null check(kind in ('cash_delivery','zero_cash_delivery')),
  delivery_lifecycle_event_id uuid not null unique references public.order_lifecycle_events(id),
  result jsonb not null,
  check ((kind='zero_cash_delivery' and amount=0 and cash_event_id is null and delivery_event_id is null)
    or (kind='cash_delivery' and amount>0 and cash_event_id is not null and delivery_event_id is not null)),
  completed_at timestamptz not null default clock_timestamp(),
  unique(driver_id,attempt_key)
);
alter table public.delivery_collection_results enable row level security;
revoke all on public.delivery_collection_results from public,anon,authenticated,service_role;
grant select on public.delivery_collection_results to authenticated;
create policy c4_collection_read on public.delivery_collection_results for select to authenticated
using(public.is_admin() or driver_id=auth.uid());
create trigger c4_collection_immutable before update or delete on public.delivery_collection_results
for each row execute function finance_private.reject_mutation();

-- Defense against other trusted status writers: C4 picked_up needs receipts,
-- and delivered must have the atomic result by the end of the transaction.
create function finance_private.c4_guard_task_progress()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not finance_private.c4_is_order(new.customer_order_id) then return new; end if;
  if new.status in ('picked_up','delivered') and exists(select 1 from public.order_pricing_current where customer_order_id=new.customer_order_id and review_required) then
    raise exception 'C4 task pricing is under review'; end if;
  if new.status='picked_up' and new.status is distinct from old.status then
    if not exists(select 1 from public.store_orders where customer_order_id=new.customer_order_id and status not in ('rejected','cancelled'))
      or exists(select 1 from public.store_orders s where s.customer_order_id=new.customer_order_id and s.status not in ('rejected','cancelled')
        and not exists(select 1 from public.delivery_store_pickups p where p.task_id=new.id and p.store_order_id=s.id and p.driver_id=new.driver_id)) then
      raise exception 'C4 task requires all store receipts'; end if;
  end if;
  return new;
end $$;
create trigger c4_task_progress before update of status on public.delivery_tasks
for each row execute function finance_private.c4_guard_task_progress();
create function finance_private.c4_require_atomic_result()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if finance_private.c4_is_order(new.customer_order_id) and not exists(
    select 1 from public.delivery_collection_results r join public.delivery_tasks d on d.id=r.task_id
      join public.order_pricing_current p on p.customer_order_id=r.customer_order_id
      join public.order_lifecycle_events e on e.id=r.delivery_lifecycle_event_id and e.customer_order_id=r.customer_order_id
        and e.delivery_task_id=r.task_id and e.event_type='delivery_completed'
    where r.customer_order_id=new.customer_order_id and d.status='delivered' and r.driver_id=d.driver_id
      and not p.review_required and r.amount=p.total and r.pricing_version=p.version) then
    raise exception 'C4 delivery requires its committed atomic cash result'; end if;
  return null;
end $$;
create constraint trigger c4_task_atomic_result after update on public.delivery_tasks
deferrable initially deferred for each row when(new.status='delivered')
execute function finance_private.c4_require_atomic_result();
create constraint trigger c4_child_atomic_result after update on public.store_orders
deferrable initially deferred for each row when(new.status='delivered')
execute function finance_private.c4_require_atomic_result();

create function finance_private.c4_account(code_value text,user_value uuid default null,merchant_value uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare account_value uuid;
begin
  insert into public.financial_accounts(definition_code,owner_user_id,merchant_id) values(code_value,user_value,merchant_value) on conflict do nothing;
  select id into strict account_value from public.financial_accounts where definition_code=code_value
    and owner_user_id is not distinct from user_value and merchant_id is not distinct from merchant_value;
  return account_value;
end $$;

create function finance_private.c4_reject_operation(operation_value uuid,code_value text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result_value jsonb:=jsonb_build_object('state','rejected','code',code_value);
begin
  perform finance_private.complete_operation(operation_value,result_value,true);
  set constraints all immediate;
  return result_value;
end $$;

-- Unapplied extension contract: C6 may accrue BEFORE the shared operation completes.
create function finance_private.c4_defer_extensions()
returns void language plpgsql security definer set search_path='' as $$ begin null; end $$;
create function finance_private.c4_delivery_extensions(target_task uuid,target_operation uuid)
returns void language plpgsql security definer set search_path='' as $$ begin null; end $$;

create function public.complete_delivery_and_collect_cash(target_task uuid,expected_user uuid,attempt_key uuid,expected_pricing_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare task_value public.delivery_tasks%rowtype; parent_value uuid; customer_value uuid;
  price public.order_pricing_current%rowtype; receipt public.delivery_collection_results%rowtype;
  op public.financial_operations%rowtype; payload jsonb; source_value uuid;
  cash_event uuid; delivery_event uuid; cash_journal uuid; delivery_journal uuid;
  driver_account uuid; advance_account uuid; commission_account uuid; revenue_account uuid; merchant_account uuid;
  goods numeric; commission numeric; lifecycle_value uuid; outcome_kind text; lines jsonb; merchant_row record; result_value jsonb;
begin
  if expected_user is null or expected_user is distinct from auth.uid() or not public.is_approved_driver() then
    raise exception 'assigned approved driver required' using errcode='42501'; end if;
  if attempt_key is null or expected_pricing_version is null or expected_pricing_version<=0 then raise exception 'invalid collection intent'; end if;
  payload:=jsonb_build_object('task',target_task,'actor',expected_user,'pricing_version',expected_pricing_version,'kind','full_cash_delivery_v1');
  select customer_order_id into parent_value from public.delivery_tasks where id=target_task;
  select customer_id into customer_value from public.customer_orders where id=parent_value for update;
  select * into task_value from public.delivery_tasks where id=target_task for update;
  if not found or task_value.driver_id is distinct from expected_user then raise exception 'assigned driver required' using errcode='42501'; end if;
  if not finance_private.c4_is_order(parent_value) then raise exception 'legacy task must use legacy workflow'; end if;
  -- Canonical key check is BEFORE any recovery result, including a different task.
  select * into op from public.financial_operations where actor_id=expected_user and financial_operations.attempt_key=complete_delivery_and_collect_cash.attempt_key for update;
  if found and (op.operation_type<>'c4_full_cash_delivery' or op.canonical_input is distinct from payload) then raise exception 'attempt key input mismatch'; end if;
  select * into receipt from public.delivery_collection_results where task_id=target_task;
  if found then
    if receipt.driver_id<>expected_user then raise exception 'result ownership mismatch' using errcode='42501'; end if;
    if receipt.attempt_key=attempt_key and receipt.canonical_input is distinct from payload then raise exception 'attempt key input mismatch'; end if;
    return receipt.result||jsonb_build_object('replayed',true,'different_key',receipt.attempt_key<>attempt_key);
  end if;
  if op.id is not null and op.state='rejected' then return op.result; end if;
  if op.id is not null and op.state='completed' then raise exception 'C4 completed operation missing immutable receipt'; end if;
  op:=finance_private.begin_operation('c4_full_cash_delivery',attempt_key,payload);
  if task_value.status<>'picked_up' then return finance_private.c4_reject_operation(op.id,'pickups_incomplete'); end if;
  if not exists(select 1 from public.store_orders where customer_order_id=parent_value and status not in ('rejected','cancelled'))
    or exists(select 1 from public.store_orders s where s.customer_order_id=parent_value and s.status not in ('rejected','cancelled')
      and (s.status<>'handed_to_driver' or not exists(select 1 from public.delivery_store_pickups p where p.task_id=target_task and p.store_order_id=s.id and p.driver_id=expected_user))) then
    return finance_private.c4_reject_operation(op.id,'pickups_incomplete'); end if;
  select * into strict price from public.order_pricing_current where customer_order_id=parent_value for update;
  if price.review_required then return finance_private.c4_reject_operation(op.id,'pricing_review'); end if;
  if price.version<>expected_pricing_version then return finance_private.c4_reject_operation(op.id,'pricing_changed'); end if;
  -- A zero customer amount must not conceal ANY positive delivery economics.
  -- This is a durable rejection, with no delivery, journal or cash event.
  if price.total=0 and (price.items_amount<>0 or price.delivery_fee<>0 or exists(
    select 1 from public.store_orders s left join public.store_order_totals t on t.store_order_id=s.id
      left join public.store_order_commissions c on c.store_order_id=s.id
    where s.customer_order_id=parent_value and s.status not in ('rejected','cancelled')
      and (t.items_subtotal<>0 or c.base_amount<>0 or c.commission_amount<>0))) then
    return finance_private.c4_reject_operation(op.id,'zero_cash_economic_conflict'); end if;
  if exists(select 1 from public.store_orders s left join public.store_order_totals t on t.store_order_id=s.id
    left join public.store_order_commissions c on c.store_order_id=s.id
    where s.customer_order_id=parent_value and s.status not in ('rejected','cancelled')
      and (t.store_order_id is null or c.id is null or c.base_amount<>t.items_subtotal or c.commission_amount<0
        or c.commission_amount>t.items_subtotal or c.status<>'pending_delivery')) then raise exception 'invalid authoritative commission snapshot'; end if;
  select sum(t.items_subtotal),sum(c.commission_amount) into goods,commission
    from public.store_orders s join public.store_order_totals t on t.store_order_id=s.id join public.store_order_commissions c on c.store_order_id=s.id
    where s.customer_order_id=parent_value and s.status not in ('rejected','cancelled');
  if goods<>price.items_amount or goods+price.delivery_fee<>price.total then raise exception 'C4 authoritative pricing mismatch'; end if;
  select id into strict source_value from public.financial_document_references where kind='DLV' and document_id=target_task;
  outcome_kind:=case when price.total=0 then 'zero_cash_delivery' else 'cash_delivery' end;
  if price.total>0 then
  driver_account:=finance_private.c4_account('driver_cash',expected_user);
  advance_account:=finance_private.c4_account('customer_advance',customer_value);
  commission_account:=finance_private.c4_account('commission_revenue');
  revenue_account:=finance_private.c4_account('delivery_revenue');
  cash_event:=finance_private.record_financial_event(source_value,'full_cash_collected',op.id);
  cash_journal:=finance_private.post_journal(cash_event,jsonb_build_array(
    jsonb_build_object('account_id',driver_account,'side','debit','amount',price.total),
    jsonb_build_object('account_id',advance_account,'side','credit','amount',price.total)),'full cash collected by assigned driver');
  lines:=jsonb_build_array(jsonb_build_object('account_id',advance_account,'side','debit','amount',price.total));
  for merchant_row in select st.merchant_id,sum(t.items_subtotal-c.commission_amount) as net
    from public.store_orders s join public.stores st on st.id=s.store_id join public.store_order_totals t on t.store_order_id=s.id
    join public.store_order_commissions c on c.store_order_id=s.id
    where s.customer_order_id=parent_value and s.status not in ('rejected','cancelled') group by st.merchant_id order by st.merchant_id loop
    if merchant_row.net>0 then
      merchant_account:=finance_private.c4_account('merchant_sales_payable',null,merchant_row.merchant_id);
      lines:=lines||jsonb_build_array(jsonb_build_object('account_id',merchant_account,'side','credit','amount',merchant_row.net));
    end if;
  end loop;
  if commission>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account_id',commission_account,'side','credit','amount',commission)); end if;
  if price.delivery_fee>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account_id',revenue_account,'side','credit','amount',price.delivery_fee)); end if;
  delivery_event:=finance_private.record_financial_event(source_value,'delivery_completed',op.id);
  delivery_journal:=finance_private.post_journal(delivery_event,lines,'delivered merchandise and delivery revenue');
  end if; -- zero delivery creates NO financial account, financial event or journal.
  -- Internal transition only after all guards. Central legacy guards suppress all old economic writers.
  set constraints public.c4_task_atomic_result,public.c4_child_atomic_result deferred;
  perform finance_private.c3_legacy_update_delivery_task_status(parent_value,'delivered');
  lifecycle_value:=finance_private.append_lifecycle_event(parent_value,null,target_task,'delivery_completed','picked_up','delivered','complete_delivery_and_collect_cash','c4:delivered:'||target_task::text);
  if price.total>0 then
    perform finance_private.append_lifecycle_event(parent_value,null,target_task,'full_cash_collected',null,null,'complete_delivery_and_collect_cash','c4:cash:'||target_task::text);
  end if;
  result_value:=jsonb_build_object('state','completed','task_id',target_task,'order_id',parent_value,'operation_id',op.id,
    'amount',price.total::text,'pricing_version',price.version,'kind',outcome_kind,'delivery_lifecycle_event_id',lifecycle_value,'cash_event_id',cash_event,'delivery_event_id',delivery_event,
    'cash_journal_id',cash_journal,'delivery_journal_id',delivery_journal,'replayed',false);
  perform finance_private.c4_defer_extensions();
  insert into public.delivery_collection_results(task_id,customer_order_id,driver_id,operation_id,attempt_key,canonical_input,pricing_version,amount,cash_event_id,delivery_event_id,kind,delivery_lifecycle_event_id,result)
    values(target_task,parent_value,expected_user,op.id,attempt_key,payload,price.version,price.total,cash_event,delivery_event,outcome_kind,lifecycle_value,result_value);
  perform finance_private.c4_delivery_extensions(target_task,op.id);
  perform finance_private.complete_operation(op.id,result_value);
  set constraints all immediate; -- Any deferred failure rolls back EVERYTHING, not a success response.
  return result_value;
end $$;

create function public.recover_delivery_collection(attempt_key uuid,expected_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare row_value public.delivery_collection_results%rowtype; op public.financial_operations%rowtype;
begin
  if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'result owner required' using errcode='42501'; end if;
  select * into row_value from public.delivery_collection_results r where r.driver_id=expected_user and r.attempt_key=recover_delivery_collection.attempt_key;
  if not found then
    select * into op from public.financial_operations o where o.actor_id=expected_user and o.attempt_key=recover_delivery_collection.attempt_key
      and o.operation_type='c4_full_cash_delivery';
    if found and op.state='rejected' then return op.result; end if;
    return jsonb_build_object('state','unknown');
  end if;
  return row_value.result||jsonb_build_object('replayed',true);
end $$;
revoke all on function public.accrue_store_order_commission(uuid,timestamptz),public.create_delivered_order_cash_foundations(uuid) from public,anon,authenticated,service_role;
revoke all on function public.reverse_store_order_commission(uuid,numeric,uuid,text),
  public.complete_delivery_and_collect_cash(uuid,uuid,uuid,bigint),public.recover_delivery_collection(uuid,uuid) from public,anon,service_role;
grant execute on function public.reverse_store_order_commission(uuid,numeric,uuid,text),
  public.complete_delivery_and_collect_cash(uuid,uuid,uuid,bigint),public.recover_delivery_collection(uuid,uuid) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;
commit;
