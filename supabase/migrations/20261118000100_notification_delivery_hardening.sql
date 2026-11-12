-- Owner applies after both 20261117 migrations. No financial formulas/data reset.
-- Adds event targeting/deduplication and isolates Push queue failure. No historical notification blast.
begin;
create or replace function notification_private.emit(owner_value uuid,key_value text,title_value text,body_value text,data_value jsonb) returns void
language plpgsql security definer set search_path='' as $$ begin
 insert into public.notifications(user_id,type,title,body,data,event_key)
 values(owner_value,case when data_value ? 'orderId' and not(data_value ? 'invoiceId') then 'order' else 'system' end,title_value,body_value,data_value,key_value)
 on conflict(event_key) do nothing;
end $$;
create or replace function public.register_push_device(installation_value uuid,token_value text,platform_value text,expected_user uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
 if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'account changed' using errcode='42501';end if;
 if installation_value is null then raise exception 'installation required';end if;
 perform pg_advisory_xact_lock(hashtextextended(installation_value::text,7354));
 perform pg_advisory_xact_lock(hashtextextended(token_value,7352));
 delete from public.push_devices where token=token_value and installation_id<>installation_value;
 insert into public.push_devices(installation_id,owner_id,token,platform) values(installation_value,expected_user,token_value,platform_value)
 on conflict(installation_id) do update set owner_id=excluded.owner_id,token=excluded.token,platform=excluded.platform,enabled=true,
 registered_at=case when not push_devices.enabled or push_devices.owner_id<>excluded.owner_id then now() else push_devices.registered_at end,updated_at=now();
end $$;
create or replace function notification_private.enqueue_push() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.type not in('order','system') then return new;end if;
 insert into public.push_deliveries(notification_id,installation_id)
 select new.id,d.installation_id from public.push_devices d where d.owner_id=new.user_id and d.enabled and d.updated_at>now()-interval '30 days';
 return new;
exception when others then
 -- Only queue failure is isolated; do not swallow a failed financial write. Never log tokens/payloads.
 raise warning 'Push enqueue deferred, code=%',sqlstate;return new;
end $$;

-- Repair missed enqueue attempts asynchronously, bounded by age and device registration.
-- Older pending notifications are suppressed after they have been read or the device lease expired.
create function public.reconcile_push_deliveries() returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.role() is distinct from 'service_role' then raise exception 'service required' using errcode='42501';end if;
 insert into public.push_deliveries(notification_id,installation_id)
 select n.id,d.installation_id from public.notifications n join public.push_devices d on d.owner_id=n.user_id
 where n.type in('order','system') and n.read_at is null and n.created_at>now()-interval '24 hours'
 and d.enabled and d.updated_at>now()-interval '30 days' and n.created_at>=d.registered_at
 and not exists(select 1 from public.push_deliveries q where q.notification_id=n.id and q.installation_id=d.installation_id)
 order by n.created_at limit 500 on conflict(notification_id,installation_id) do nothing;
 update public.push_deliveries q set state='dead',last_error='read_or_device_inactive'
 from public.notifications n,public.push_devices d where q.notification_id=n.id and q.installation_id=d.installation_id
 and q.state not in('sent','dead') and (n.read_at is not null or d.updated_at<=now()-interval '30 days');
end $$;
create function public.authorize_push_delivery(delivery_value uuid,lease_value uuid) returns boolean language plpgsql security definer set search_path='' as $$ begin
 if auth.role() is distinct from 'service_role' then raise exception 'service required' using errcode='42501';end if;
 return exists(select 1 from public.push_deliveries q join public.notifications n on n.id=q.notification_id join public.push_devices d on d.installation_id=q.installation_id
 where q.id=delivery_value and q.lease=lease_value and q.lease_until>now() and q.state in('leased','ticket')
 and d.enabled and d.owner_id=n.user_id and d.token=q.leased_token and d.updated_at>now()-interval '30 days'
 and n.created_at>=d.registered_at and n.read_at is null);
end $$;
revoke all on function public.reconcile_push_deliveries(),public.authorize_push_delivery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_push_deliveries(),public.authorize_push_delivery(uuid,uuid) to service_role;

create or replace function public.notify_customer_new_order() returns trigger language plpgsql security definer set search_path='' as $$ declare who uuid;begin
 perform notification_private.emit(new.customer_id,'order-created:'||new.id||':'||new.customer_id,'تم استلام طلبك','أُرسل الطلب إلى المتاجر للمراجعة.',jsonb_build_object('orderId',new.id));
 for who in select id from public.profiles where role='admin' loop
 perform notification_private.emit(who,'order-created:'||new.id||':'||who,'طلب جديد','طلب جديد متاح للمتابعة.',jsonb_build_object('orderId',new.id));end loop;
 return new;end $$;
create or replace function public.notify_merchant_of_new_order() returns trigger language plpgsql security definer set search_path='' as $$ declare who uuid;begin
 select m.owner_user_id into who from public.stores s join public.merchants m on m.id=s.merchant_id where s.id=new.store_id;
 if who is not null then perform notification_private.emit(who,'store-created:'||new.id||':'||who,'طلب جديد لمتجرك','راجع جزء متجرك واتخذ قرار التجهيز.',jsonb_build_object('orderId',new.customer_order_id,'storeOrderId',new.id,'route','/merchant/orders'));end if;
 return new;end $$;
create or replace function public.notify_delivery_task_change() returns trigger language plpgsql security definer set search_path='' as $$ declare who uuid;r record;begin
 if new.status is not distinct from old.status then return new;end if;
 select customer_id into who from public.customer_orders where id=new.customer_order_id;
 if new.status in('accepted','picked_up') then
 perform notification_private.emit(who,'task:'||new.id||':'||new.status||':'||who,case new.status when 'accepted' then 'أُسند طلبك لسائق' else 'طلبك في الطريق' end,'راجع حالة التوصيل من طلبك.',jsonb_build_object('orderId',new.customer_order_id));end if;
 if new.status='picked_up' then
 for r in select so.id,m.owner_user_id from public.store_orders so join public.stores s on s.id=so.store_id join public.merchants m on m.id=s.merchant_id
 where so.customer_order_id=new.customer_order_id and so.status not in('rejected','cancelled') loop
 perform notification_private.emit(r.owner_user_id,'pickup:'||new.id||':'||r.id,'استلم السائق طلب متجرك','يمكن متابعة التسليم من جزء الطلب.',jsonb_build_object('orderId',new.customer_order_id,'storeOrderId',r.id,'route','/merchant/orders'));end loop;end if;
 -- On delivery, INV/SAL/DLV notifications already confirm the same successful event.
 return new;end $$;

create function notification_private.review_requested() returns trigger language plpgsql security definer set search_path='' as $$ declare who uuid;kind text;begin
 if new.status<>'pending' then return new;end if;
 if tg_op='UPDATE' then if old.status is not distinct from new.status then return new;end if;end if;
 kind:=case tg_table_name when 'merchant_applications' then 'merchant' else 'driver' end;
 for who in select id from public.profiles where role='admin' loop
 perform notification_private.emit(who,'review:'||new.id||':'||txid_current()||':'||who,'طلب انضمام يحتاج مراجعة','طلب '||case kind when 'merchant' then 'تاجر' else 'سائق' end||' متاح للمراجعة.',jsonb_build_object('applicationId',new.id,'applicationRole',kind,'route','/admin/application-details'));end loop;
 return new;end $$;
create trigger merchant_review_requested after insert or update of status on public.merchant_applications for each row execute function notification_private.review_requested();
create trigger driver_review_requested after insert or update of status on public.driver_applications for each row execute function notification_private.review_requested();
create function notification_private.order_exception() returns trigger language plpgsql security definer set search_path='' as $$ declare who uuid;begin
 if new.status is not distinct from old.status or new.status not in('rejected','cancelled') then return new;end if;
 for who in select id from public.profiles where role='admin' loop
 perform notification_private.emit(who,'store-exception:'||new.id||':'||new.status||':'||who,'جزء طلب يحتاج متابعة','اعتذار أو إلغاء جزء من طلب. راجع الإجمالي والحالة.',jsonb_build_object('orderId',new.customer_order_id));end loop;return new;end $$;
create trigger order_exception_notification after update of status on public.store_orders for each row execute function notification_private.order_exception();
create function notification_private.pricing_review() returns trigger language plpgsql security definer set search_path='' as $$ declare who uuid;begin
 if not new.review_required or old.review_required then return new;end if;
 for who in select id from public.profiles where role='admin' loop
 perform notification_private.emit(who,'pricing-review:'||new.customer_order_id||':'||txid_current()||':'||who,'طلب يحتاج مراجعة المبلغ','توقف إرسال طلب لحين مراجعة المبلغ. افتح الطلب لمتابعة السبب.',jsonb_build_object('orderId',new.customer_order_id));end loop;
 return new;end $$;
create trigger pricing_review_notification after update of review_required on public.order_pricing_current for each row execute function notification_private.pricing_review();

-- Normalize legacy operational inserts without touching tested commerce writers.
create function notification_private.normalize_order_event() returns trigger language plpgsql security definer set search_path='' as $$
declare record_value uuid;parent_value uuid;task_value uuid;state_value text;path_value text;kind_value text;reference_value text;
begin
 if new.type<>'order' or new.event_key is not null then return new;end if;
 path_value:=coalesce(new.data->>'route',new.data->>'url','');
 record_value:=nullif(new.data->>'storeOrderId','')::uuid;
 parent_value:=nullif(new.data->>'orderId','')::uuid;
 if record_value is not null then
 select status::text into state_value from public.store_orders where id=record_value;
 new.event_key:='store-status:'||record_value||':'||state_value||':'||new.user_id;
 kind_value:='SOR';
 if path_value like '/driver/orders%' then
 select id into task_value from public.delivery_tasks where customer_order_id=parent_value and driver_id=new.user_id limit 1;
 new.data:=new.data||jsonb_build_object('deliveryTaskId',task_value);
 end if;
 elsif parent_value is not null then
 if path_value='/driver' then
 select id into task_value from public.delivery_tasks where customer_order_id=parent_value limit 1;
 new.data:=new.data||jsonb_build_object('deliveryTaskId',task_value,'route','/driver');
 new.event_key:='task-available:'||coalesce(task_value,parent_value)||':'||new.user_id;
 else new.event_key:='order-update:'||parent_value||':'||md5(new.title||new.body)||':'||new.user_id;end if;
 record_value:=parent_value;kind_value:='ORD';
 end if;
 if record_value is not null then select reference into reference_value from public.commerce_references where record_id=record_value and kind=kind_value;
 if reference_value is not null then new.data:=new.data||jsonb_build_object('reference',reference_value);end if;end if;
 if new.event_key is not null then
 perform pg_advisory_xact_lock(hashtextextended(new.event_key,7353));
 if exists(select 1 from public.notifications where event_key=new.event_key) then return null;end if;
 end if;return new;
exception when others then
 raise warning 'Notification normalization deferred, code=%',sqlstate;new.event_key:=null;return new;
end $$;
create trigger normalize_order_notification before insert on public.notifications for each row execute function notification_private.normalize_order_event();
-- Recover a schedule omitted when the previous migration ran without pg_cron.
do $$begin
 if to_regclass('cron.job') is not null then execute $sql$select cron.schedule('tasawuq-push-dispatch','* * * * *','select notification_private.dispatch_tick()')$sql$;end if;
end $$;
revoke all on all functions in schema notification_private from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
