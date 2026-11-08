-- LOCAL / OWNER REVIEW ONLY. Fixed per-order mode; new-order admission defaults OFF.
begin;
create table finance_private.c4_rollout (
  singleton boolean primary key default true check(singleton),
  accept_new_orders boolean not null default false
);
insert into finance_private.c4_rollout default values;
revoke all on finance_private.c4_rollout from public,anon,authenticated,service_role;

-- Birth markers prevent later snapshot insertion from converting an existing order.
create table finance_private.c4_order_births (
  order_id uuid primary key references public.customer_orders(id) on delete restrict,
  birth_xid bigint not null
);
create table public.order_financial_modes (
  customer_order_id uuid primary key references public.customer_orders(id) on delete restrict,
  mode text not null check(mode in ('legacy','c4')),
  decided_at timestamptz not null default clock_timestamp()
);
revoke all on finance_private.c4_order_births from public,anon,authenticated,service_role;
alter table public.order_financial_modes enable row level security;
revoke all on public.order_financial_modes from public,anon,authenticated,service_role;
grant select on public.order_financial_modes to authenticated;
create policy c4_mode_read on public.order_financial_modes for select to authenticated
  using(public.is_admin() or public.c3_pricing_readable(customer_order_id));
create trigger c4_mode_immutable before update or delete on public.order_financial_modes
  for each row execute function finance_private.reject_mutation();
create function finance_private.c4_is_order(order_value uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.order_financial_modes where customer_order_id=order_value and mode='c4')
$$;
create function finance_private.c4_mark_birth()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into finance_private.c4_order_births values(new.id,txid_current());
  return new;
end $$;
create trigger c4_order_birth after insert on public.customer_orders
for each row execute function finance_private.c4_mark_birth();
create function finance_private.c4_select_mode()
returns trigger language plpgsql security definer set search_path='' as $$
declare admission boolean;
begin
  if not exists(select 1 from finance_private.c4_order_births where order_id=new.customer_order_id and birth_xid=txid_current()) then
    return new; -- No historical conversion/backfill, even if a snapshot is added later.
  end if;
  select accept_new_orders into admission from finance_private.c4_rollout where singleton for share;
  if coalesce(admission,false) and to_regprocedure('public.complete_delivery_and_collect_cash(uuid,uuid,uuid,bigint)') is null then
    raise exception 'C4 admission requires the atomic collection migration'; end if;
  insert into public.order_financial_modes(customer_order_id,mode)
    values(new.customer_order_id,case when coalesce(admission,false) and new.approved_total>0 then 'c4' else 'legacy' end);
  return new;
end $$;
-- Runs in C3 creation, before return and before deferred commission snapshots commit.
create trigger c4_select_order_mode after insert on public.order_pricing_snapshots
for each row execute function finance_private.c4_select_mode();

create table public.delivery_pickup_workflows (
  task_id uuid primary key references public.delivery_tasks(id) on delete restrict,
  customer_order_id uuid not null unique references public.customer_orders(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);
create table public.delivery_store_pickups (
  task_id uuid not null references public.delivery_pickup_workflows(task_id) on delete restrict,
  store_order_id uuid not null references public.store_orders(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  ord_reference_id uuid not null references public.financial_document_references(id) on delete restrict,
  sub_reference_id uuid not null references public.financial_document_references(id) on delete restrict,
  dlv_reference_id uuid not null references public.financial_document_references(id) on delete restrict,
  status text not null default 'confirmed' check(status='confirmed'),
  picked_up_at timestamptz not null default clock_timestamp(),
  primary key(task_id,store_order_id), unique(store_order_id)
);
alter table public.delivery_pickup_workflows enable row level security;
alter table public.delivery_store_pickups enable row level security;
revoke all on public.delivery_pickup_workflows,public.delivery_store_pickups from public,anon,authenticated,service_role;
grant select on public.delivery_pickup_workflows,public.delivery_store_pickups to authenticated;
create policy c4_workflow_read on public.delivery_pickup_workflows for select to authenticated
  using(public.is_admin() or (driver_id=auth.uid() and exists(select 1 from public.delivery_tasks d where d.id=task_id and d.driver_id=auth.uid())));
create policy c4_pickup_read on public.delivery_store_pickups for select to authenticated
  using(public.is_admin() or (driver_id=auth.uid() and exists(select 1 from public.delivery_tasks d where d.id=task_id and d.driver_id=auth.uid()))
    or exists(select 1 from public.store_orders s where s.id=store_order_id and public.is_store_owner(s.store_id)));
create trigger c4_workflow_immutable before update or delete on public.delivery_pickup_workflows
  for each row execute function finance_private.reject_mutation();
create trigger c4_pickup_immutable before update or delete on public.delivery_store_pickups
  for each row execute function finance_private.reject_mutation();

create function finance_private.c4_validate_pickup()
returns trigger language plpgsql security definer set search_path='' as $$
declare parent_value uuid;
begin
  select d.customer_order_id into parent_value from public.delivery_tasks d
    join public.delivery_pickup_workflows w on w.task_id=d.id and w.customer_order_id=d.customer_order_id and w.driver_id=d.driver_id
    where d.id=new.task_id and d.driver_id=auth.uid() and d.status='accepted';
  if not found or not public.is_approved_driver() or not finance_private.c4_is_order(parent_value) then raise exception 'assigned approved driver required' using errcode='42501'; end if;
  if not exists(select 1 from public.store_orders s where s.id=new.store_order_id and s.customer_order_id=parent_value and s.status='ready_for_pickup') then
    raise exception 'store is not a required ready part of this task'; end if;
  if not exists(select 1 from public.financial_document_references where id=new.ord_reference_id and kind='ORD' and document_id=parent_value)
    or not exists(select 1 from public.financial_document_references where id=new.sub_reference_id and kind='SUB' and document_id=new.store_order_id)
    or not exists(select 1 from public.financial_document_references where id=new.dlv_reference_id and kind='DLV' and document_id=new.task_id) then
    raise exception 'pickup document relationship mismatch'; end if;
  new.driver_id:=auth.uid(); new.picked_up_at:=clock_timestamp(); new.status:='confirmed';
  return new;
end $$;
create trigger c4_pickup_validate before insert on public.delivery_store_pickups
  for each row execute function finance_private.c4_validate_pickup();

-- Preserve C3 for immutable legacy orders; C4 must use scoped/atomic RPCs.
create or replace function public.update_delivery_task_status(target_customer_order uuid,next_status public.delivery_task_status)
returns void language plpgsql security definer set search_path='' as $$
declare task_value public.delivery_tasks%rowtype;
begin
  perform 1 from public.customer_orders where id=target_customer_order for update;
  select * into task_value from public.delivery_tasks where customer_order_id=target_customer_order for update;
  if exists(select 1 from public.order_pricing_current where customer_order_id=target_customer_order and review_required) then
    raise exception 'order pricing is under review'; end if;
  if finance_private.c4_is_order(target_customer_order) then
    raise exception 'C4_USE_SCOPED_PICKUP_OR_ATOMIC_COLLECTION';
  end if;
  perform finance_private.c3_legacy_update_delivery_task_status(target_customer_order,next_status);
end $$;

create function public.confirm_c4_store_pickup(target_task uuid,target_store_order uuid,expected_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare task_value public.delivery_tasks%rowtype; parent_value uuid; ord_ref uuid; sub_ref uuid; dlv_ref uuid;
begin
  if expected_user is null or expected_user is distinct from auth.uid() or not public.is_approved_driver() then
    raise exception 'assigned approved driver required' using errcode='42501'; end if;
  select customer_order_id into parent_value from public.delivery_tasks where id=target_task;
  perform 1 from public.customer_orders where id=parent_value for update;
  select * into task_value from public.delivery_tasks where id=target_task for update;
  if not found or task_value.driver_id is distinct from expected_user then raise exception 'assigned driver required' using errcode='42501'; end if;
  if exists(select 1 from public.delivery_store_pickups where task_id=target_task and store_order_id=target_store_order) then
    raise exception 'store pickup already confirmed' using errcode='23505'; end if;
  if task_value.status<>'accepted' or not finance_private.c4_is_order(parent_value) then
    raise exception 'C4 requires an accepted C3 task; use the documented legacy path'; end if;
  if not exists(select 1 from public.order_pricing_current where customer_order_id=parent_value and not review_required) then
    raise exception 'order pricing is under review'; end if;
  if not exists(select 1 from public.store_orders where id=target_store_order and customer_order_id=parent_value and status='ready_for_pickup') then
    raise exception 'store is not a ready part of this task'; end if;
  insert into public.delivery_pickup_workflows(task_id,customer_order_id,driver_id)
    values(target_task,parent_value,expected_user) on conflict(task_id) do nothing;
  select id into strict ord_ref from public.financial_document_references where kind='ORD' and document_id=parent_value;
  select id into strict sub_ref from public.financial_document_references where kind='SUB' and document_id=target_store_order;
  select id into strict dlv_ref from public.financial_document_references where kind='DLV' and document_id=target_task;
  insert into public.delivery_store_pickups(task_id,store_order_id,driver_id,ord_reference_id,sub_reference_id,dlv_reference_id)
    values(target_task,target_store_order,expected_user,ord_ref,sub_ref,dlv_ref);
  update public.store_orders set status='handed_to_driver' where id=target_store_order;
  perform finance_private.append_lifecycle_event(parent_value,target_store_order,target_task,'store_pickup_confirmed',
    'ready_for_pickup','handed_to_driver','confirm_c4_store_pickup','c4:pickup:'||target_store_order::text);
  if not exists(select 1 from public.store_orders s where s.customer_order_id=parent_value and s.status not in ('rejected','cancelled')
    and not exists(select 1 from public.delivery_store_pickups p where p.task_id=target_task and p.store_order_id=s.id and p.driver_id=expected_user)) then
    perform finance_private.c3_legacy_update_delivery_task_status(parent_value,'picked_up');
    perform finance_private.append_lifecycle_event(parent_value,null,target_task,'all_store_pickups_confirmed',
      'accepted','picked_up','confirm_c4_store_pickup','c4:picked-up:'||target_task::text);
  end if;
  return jsonb_build_object('state','confirmed','task_id',target_task,'store_order_id',target_store_order);
end $$;

create function public.get_c4_pickup_context(target_tasks uuid[],expected_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result_value jsonb:='{}'; t public.delivery_tasks%rowtype; is_c4 boolean; ready boolean; all_received boolean; version_value bigint; reason_value text;
begin
  if expected_user is null or expected_user is distinct from auth.uid() or not public.is_approved_driver() then
    raise exception 'approved driver required' using errcode='42501'; end if;
  if target_tasks is null or cardinality(target_tasks)>80 then raise exception 'too many tasks'; end if;
  for t in select * from public.delivery_tasks where id=any(target_tasks) and driver_id=expected_user loop
    is_c4:=finance_private.c4_is_order(t.customer_order_id);
    select version,not review_required into version_value,ready from public.order_pricing_current where customer_order_id=t.customer_order_id;
    all_received:=exists(select 1 from public.store_orders where customer_order_id=t.customer_order_id and status not in ('rejected','cancelled'))
      and not exists(select 1 from public.store_orders s where s.customer_order_id=t.customer_order_id and s.status not in ('rejected','cancelled')
        and not exists(select 1 from public.delivery_store_pickups p where p.task_id=t.id and p.store_order_id=s.id and p.driver_id=expected_user));
    reason_value:=case when not coalesce(ready,false) then 'pricing_review' when t.status='delivered' then 'completed'
      when t.status not in ('accepted','picked_up') then 'task_not_active'
      else null end;
    result_value:=result_value||jsonb_build_object(t.id::text,jsonb_build_object('mode',case when is_c4 then 'c4' else 'legacy' end,
      'can_confirm_pickup',is_c4 and coalesce(ready,false) and t.status='accepted' and not all_received,
      'can_complete_delivery',is_c4 and coalesce(ready,false) and t.status='picked_up' and all_received,
      'pricing_version',version_value,'reason',reason_value,
      'confirmed',coalesce((select jsonb_agg(store_order_id order by store_order_id) from public.delivery_store_pickups
        where task_id=t.id and driver_id=expected_user),'[]'::jsonb)));
  end loop;
  return result_value;
end $$;
create function finance_private.c4_no_reassignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.driver_id is distinct from old.driver_id and finance_private.c4_is_order(old.customer_order_id)
    and exists(select 1 from public.delivery_store_pickups where task_id=old.id) then
    raise exception 'C4 reassignment after first pickup is prohibited'; end if;
  return new;
end $$;
create trigger c4_no_reassignment before update of driver_id on public.delivery_tasks
for each row execute function finance_private.c4_no_reassignment();
revoke all on function public.confirm_c4_store_pickup(uuid,uuid,uuid) from public,anon,service_role;
revoke all on function public.get_c4_pickup_context(uuid[],uuid) from public,anon,service_role;
revoke all on function public.update_delivery_task_status(uuid,public.delivery_task_status) from public,anon,service_role;
grant execute on function public.confirm_c4_store_pickup(uuid,uuid,uuid),public.get_c4_pickup_context(uuid[],uuid),
  public.update_delivery_task_status(uuid,public.delivery_task_status) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;
commit;
