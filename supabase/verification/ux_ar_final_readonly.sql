-- Owner-only manual diagnostics. READ ONLY; replace the example TSK reference.
-- No UUIDs, account identities, phone numbers, addresses, tokens or notification bodies returned.
with target as (
  select t.*,o.status as parent_status,o.customer_id
  from public.delivery_tasks t
  join public.commerce_references r on r.kind='TSK' and r.record_id=t.id
  join public.customer_orders o on o.id=t.customer_order_id
  where r.reference='TSK-0000001'
), snapshot as (
  select t.*,p.review_required,p.version,
    (select count(*) from public.store_orders s where s.customer_order_id=t.customer_order_id and s.status not in('rejected','cancelled')) as required_stores,
    (select count(*) from public.store_orders s where s.customer_order_id=t.customer_order_id and s.status not in('rejected','cancelled','handed_to_driver','delivered')) as stores_not_handed_over,
    (select count(*) from public.store_orders s where s.customer_order_id=t.customer_order_id and s.status='delivered') as delivered_stores,
    (select count(*) from public.store_orders s where s.customer_order_id=t.customer_order_id and s.status in('rejected','cancelled')) as excluded_stores,
    (select count(*) from public.delivery_store_pickups x join public.store_orders s on s.id=x.store_order_id
      where x.task_id=t.id and s.customer_order_id=t.customer_order_id and s.status not in('rejected','cancelled')) as pickup_confirmations
  from target t left join public.order_pricing_current p on p.customer_order_id=t.customer_order_id
)
select r.reference as task_reference,co.reference as order_reference,s.status as task_status,s.parent_status,
  s.driver_id is not null as assigned,s.required_stores,s.pickup_confirmations,s.stores_not_handed_over,s.delivered_stores,s.excluded_stores,
  s.review_required,s.version as pricing_version,
  (s.status='picked_up' and s.review_required is false and s.stores_not_handed_over=0 and s.required_stores>0) as server_prerequisites_snapshot,
  (select count(*) from public.money_invoices i where i.customer_order_id=s.customer_order_id and i.kind='INV' and i.status='confirmed') as confirmed_purchase_documents,
  (select count(*) from public.money_invoices i where i.task_id=s.id and i.kind='DLV' and i.status='confirmed') as confirmed_delivery_documents,
  (select count(*) from public.notifications n where n.user_id=s.customer_id and n.data->>'orderId'=s.customer_order_id::text
    and n.data->>'event'='invoice-INV' and n.title='تم تسليم طلبك') as customer_delivery_notifications
from snapshot s
left join public.commerce_references r on r.kind='TSK' and r.record_id=s.id
left join public.commerce_references co on co.kind='ORD' and co.record_id=s.customer_order_id;

-- Inspect renderer version safely before/after applying the copy-only migration.
select p.proname,md5(replace(p.prosrc,E'\r','')) as normalized_body_fingerprint
from pg_proc p where p.oid in (to_regprocedure('notification_private.render_notification()'),
  to_regprocedure('notification_private.arabic_notification_copy()'));

select t.tgname,pg_get_triggerdef(t.oid) as definition from pg_trigger t
where t.tgrelid='public.notifications'::regclass and not t.tgisinternal
  and t.tgname in('render_notification','zz_arabic_notification_copy') order by t.tgname;

-- This does not inspect/recover a phone's local pending attempt, grant a role,
-- call a workflow RPC as auth.uid(), change any status, or resume a dispatcher.
