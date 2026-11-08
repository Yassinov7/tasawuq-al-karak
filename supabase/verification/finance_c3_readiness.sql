-- OWNER-EXECUTED, READ ONLY. Never installs objects or repairs data.
begin read only;
select current_database() as database_name, current_user as executing_role, version();
select 'C3 objects' as check_name, to_regclass('public.order_pricing_snapshots') is not null
  and to_regclass('public.order_pricing_current') is not null
  and to_regclass('public.order_pricing_revisions') is not null
  and to_regclass('public.customer_order_requests') is not null as pass;
select c.relname,c.relrowsecurity,c.relowner::regrole as owner,c.relacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in('order_pricing_snapshots','order_pricing_current','order_pricing_revisions','customer_order_requests');
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where tablename in('order_pricing_snapshots','order_pricing_current','order_pricing_revisions','customer_order_requests');
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.proname like '%c3%' or (n.nspname='public' and p.proname in
 ('create_order_from_cart','make_order_delivery_available','refresh_customer_order_status','update_store_order_status','cancel_customer_order','accept_delivery_task','update_delivery_task_status'))
order by n.nspname,p.proname;
-- ZERO ROWS expected: empty search_path is required on every new definer.
select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.prosecdef and p.proname like '%c3%' and not coalesce(p.proconfig @> array['search_path=""'],false);
select c.relname,con.conname,pg_get_constraintdef(con.oid) from pg_constraint con
join pg_class c on c.oid=con.conrelid where c.relname in
 ('delivery_zones','delivery_tasks','order_pricing_snapshots','order_pricing_current','order_pricing_revisions','customer_order_requests') order by c.relname,con.conname;
select c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid
where not t.tgisinternal and (t.tgname like 'c3_%' or c.relname in('store_orders','delivery_tasks')) order by c.relname,t.tgname;
-- ZERO ROWS expected: no duplicate task/record/reference/lifecycle sequence.
select customer_order_id,count(*) from public.delivery_tasks group by customer_order_id having count(*)>1;
select kind,document_id,count(*) from public.financial_document_references group by kind,document_id having count(*)>1;
select customer_order_id,order_sequence,count(*) from public.order_lifecycle_events group by customer_order_id,order_sequence having count(*)>1;
-- ZERO ROWS expected: C3 task exists only after every nonexcluded child progressed to ready or later.
select d.id,d.customer_order_id,d.status from public.delivery_tasks d
join public.order_pricing_current p using(customer_order_id)
where (p.review_required and d.status<>'cancelled') or not exists
 (select 1 from public.store_orders s where s.customer_order_id=d.customer_order_id and s.status not in('rejected','cancelled'))
 or exists(select 1 from public.store_orders s where s.customer_order_id=d.customer_order_id and s.status not in('ready_for_pickup','handed_to_driver','delivered','rejected','cancelled'));
-- ZERO ROWS expected: current never above original, original persisted independently.
select p.customer_order_id,p.total,s.approved_total from public.order_pricing_current p
join public.order_pricing_snapshots s using(customer_order_id) where p.total>s.approved_total or p.total<>p.items_amount+p.delivery_fee;
-- ZERO ROWS expected: original legacy total must still equal initial approval.
select s.customer_order_id from public.order_pricing_snapshots s
join public.customer_order_totals t using(customer_order_id)
where t.total<>s.approved_total or t.items_subtotal<>s.original_items_amount or t.delivery_fee<>s.original_delivery_fee;
-- ZERO ROWS expected: new ORD/SUB exist, DLV only for a real task, never a phantom.
select s.customer_order_id from public.order_pricing_snapshots s where not exists
 (select 1 from public.financial_document_references r where r.kind='ORD' and r.document_id=s.customer_order_id);
select c.id from public.store_orders c join public.order_pricing_snapshots s on s.customer_order_id=c.customer_order_id
where not exists(select 1 from public.financial_document_references r where r.kind='SUB' and r.document_id=c.id);
select d.id from public.delivery_tasks d join public.order_pricing_snapshots s using(customer_order_id)
where not exists(select 1 from public.financial_document_references r where r.kind='DLV' and r.document_id=d.id);
-- Review list only; these are blocked exceptions, not amounts authorized to collect.
select customer_order_id,version,total,updated_at from public.order_pricing_current where review_required order by updated_at;
-- C3 does not post journal rows: inspect attached writers and function source.
select count(*) as c2_journal_rows_not_a_behavioral_test from public.journal_entries;
select pg_get_functiondef('finance_private.c3_recalculate(uuid,uuid,text)'::regprocedure);
select pg_get_functiondef('finance_private.c3_dispatch(uuid)'::regprocedure);
-- ACL inspection is NOT a real JWT test. Expected: no direct DML or private execute.
select role_name,c.relname,has_table_privilege(role_name,c.oid,'SELECT') as can_select,
  has_table_privilege(role_name,c.oid,'INSERT,UPDATE,DELETE') as can_write
from (values('anon'),('authenticated'),('service_role')) roles(role_name)
cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in('order_pricing_snapshots','order_pricing_current','order_pricing_revisions','customer_order_requests');
select role_name,p.proname,has_function_privilege(role_name,p.oid,'EXECUTE') as can_execute
from (values('anon'),('authenticated'),('service_role')) roles(role_name)
cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='finance_private' and p.proname like 'c3_%';
-- Old provisional C3 overloads must not exist. The 5-argument builder remains private by ACL.
select to_regprocedure('public.create_c3_order_from_cart(text,text,text,uuid,text,uuid,numeric,uuid,text)') is not null as expected_create,
  to_regprocedure('public.create_c3_order_from_cart(text,text,text,uuid,text,uuid,numeric)') is null as no_old_create,
  to_regprocedure('public.recover_c3_order_request(uuid,uuid)') is not null as expected_recovery,
  to_regprocedure('public.recover_c3_order_request(uuid)') is null as no_old_recovery,
  to_regprocedure('public.quote_c3_cart(uuid,uuid)') is not null as expected_quote;
select has_function_privilege('authenticated','public.create_order_from_cart(text,text,text,uuid,text)','EXECUTE') as old_builder_must_be_false;
-- ZERO ROWS expected: persisted results are complete and rejected intents cannot carry an order.
select customer_id,request_key,state from public.customer_order_requests where
  (state='completed' and customer_order_id is null) or (state='rejected' and (customer_order_id is not null or failure_code is null)) or state='pending';
-- ZERO ROWS expected: merchandise cents are retained, fees alone are whole SYP.
select customer_order_id from public.order_pricing_current where items_amount<>round(items_amount,2) or delivery_fee<>trunc(delivery_fee);
select r.customer_id,r.request_key from public.customer_order_requests r join public.customer_orders o on o.id=r.customer_order_id where r.customer_id<>o.customer_id;
rollback;
