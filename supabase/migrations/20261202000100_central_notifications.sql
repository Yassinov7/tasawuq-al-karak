-- Requires notification delivery hardening and offer lifecycle phase 1.
-- Owner applies. No backfill of notifications, commerce transitions or financial writes.
begin;

drop trigger if exists notify_customers_after_offer_insert on public.store_offers;

create table public.store_notification_follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  followed_at timestamptz not null default clock_timestamp(),
  primary key (user_id, store_id)
);
create index store_notification_follows_store on public.store_notification_follows(store_id, followed_at);
create table public.store_offer_notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null,
  changed_at timestamptz not null default clock_timestamp()
);
alter table public.store_notification_follows enable row level security;
alter table public.store_offer_notification_preferences enable row level security;
revoke all on public.store_notification_follows, public.store_offer_notification_preferences from public, anon, authenticated;

create function notification_private.customer() returns uuid
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='customer') then
    raise exception 'customer required' using errcode='42501';
  end if;
  return auth.uid();
end $$;

create function public.read_store_notification_preferences(expected_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid := notification_private.customer();
begin
  if owner_id is distinct from expected_user then raise exception 'account changed' using errcode='42501'; end if;
  return jsonb_build_object(
    'enabled',coalesce((select p.enabled from public.store_offer_notification_preferences p where p.user_id=owner_id),true),
    'stores',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,
      'name',case when s.status='accepted' and m.status='accepted' then s.name else 'متجر غير متاح' end) order by f.followed_at,s.id)
      from public.store_notification_follows f join public.stores s on s.id=f.store_id
      join public.merchants m on m.id=s.merchant_id where f.user_id=owner_id),'[]'::jsonb));
end $$;

create function public.set_store_notification_follow(target_store uuid, following boolean, expected_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid := notification_private.customer();
begin
  if owner_id is distinct from expected_user then raise exception 'account changed' using errcode='42501'; end if;
  if following then
    if not exists(select 1 from public.stores s join public.merchants m on m.id=s.merchant_id
      where s.id=target_store and s.status='accepted' and m.status='accepted') then
      raise exception 'store unavailable';
    end if;
    insert into public.store_notification_follows(user_id,store_id) values(owner_id,target_store) on conflict do nothing;
  else
    delete from public.store_notification_follows where user_id=owner_id and store_id=target_store;
  end if;
end $$;

create function public.set_store_offer_notifications(input_enabled boolean, expected_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid := notification_private.customer();
begin
  if owner_id is distinct from expected_user then raise exception 'account changed' using errcode='42501'; end if;
  insert into public.store_offer_notification_preferences(user_id,enabled) values(owner_id,input_enabled)
  on conflict(user_id) do update set enabled=excluded.enabled,changed_at=clock_timestamp()
  where store_offer_notification_preferences.enabled is distinct from excluded.enabled;
end $$;

revoke all on function public.read_store_notification_preferences(uuid), public.set_store_notification_follow(uuid,boolean,uuid),
  public.set_store_offer_notifications(boolean,uuid) from public,anon,authenticated;
grant execute on function public.read_store_notification_preferences(uuid), public.set_store_notification_follow(uuid,boolean,uuid),
  public.set_store_offer_notifications(boolean,uuid) to authenticated;

create table notification_private.offer_start_events (
  offer_id uuid primary key references public.store_offers(id) on delete cascade
);
-- Do not replay existing starts when enabling the feature.
insert into notification_private.offer_start_events
select id from public.store_offers where starts_at <= statement_timestamp();
create index store_offers_notification_start on public.store_offers(starts_at,id);

create function notification_private.publish_offer_starts()
returns integer language plpgsql security definer set search_path='' as $$
declare emitted integer;
begin
  if not pg_try_advisory_xact_lock(7360,1) then return 0; end if;
  with due as materialized (
    select o.id,o.store_id,o.starts_at,o.title,o.is_active,o.ends_at
    from public.store_offers o
    where o.starts_at <= statement_timestamp()
      and o.starts_at > statement_timestamp()-interval '10 minutes'
      and not exists(select 1 from notification_private.offer_start_events e where e.offer_id=o.id)
    order by o.starts_at,o.id limit 100 for update of o skip locked
  ), consumed as (
    insert into notification_private.offer_start_events(offer_id)
    select id from due on conflict do nothing returning offer_id
  )
  insert into public.notifications(user_id,type,title,body,data,event_key)
  select f.user_id,'offer','بدأ عرض من '||left(s.name,110),
    left('عرض «'||d.title||'» متاح الآن لدى '||s.name||'. افتح العرض للاطلاع على التفاصيل.',1000),
    jsonb_build_object('offerId',d.id,'storeId',s.id,'route','/offer-details','event','offer-start'),
    'offer-start:'||d.id||':'||f.user_id
  from consumed e join due d on d.id=e.offer_id
  join public.stores s on s.id=d.store_id join public.merchants m on m.id=s.merchant_id
  join public.store_notification_follows f on f.store_id=d.store_id and f.followed_at<=d.starts_at
  join public.profiles p on p.id=f.user_id and p.role='customer'
  left join public.store_offer_notification_preferences pref on pref.user_id=f.user_id
  where d.is_active and d.ends_at>clock_timestamp() and s.status='accepted' and m.status='accepted'
    and (pref.user_id is null or (pref.enabled and pref.changed_at<=d.starts_at))
  on conflict(event_key) do nothing;
  get diagnostics emitted=row_count;
  return emitted;
end $$;

-- A reschedule after the first start cannot create a second launch. A future
-- start can still be moved before it becomes due.
create function notification_private.retain_started_offer() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.starts_at is distinct from new.starts_at and old.starts_at <= statement_timestamp()
     and old.is_active then
    insert into notification_private.offer_start_events values(old.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger retain_started_offer after update of starts_at on public.store_offers
for each row execute function notification_private.retain_started_offer();

create function notification_private.offer_push_current(owner_id uuid, payload jsonb) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.store_offers o
    join public.stores s on s.id=o.store_id join public.merchants m on m.id=s.merchant_id
    join public.store_notification_follows f on f.store_id=s.id and f.user_id=owner_id and f.followed_at<=o.starts_at
    join public.profiles p on p.id=f.user_id and p.role='customer'
    left join public.store_offer_notification_preferences pref on pref.user_id=f.user_id
    where o.id=(payload->>'offerId')::uuid and o.starts_at<=(now()) and o.is_active and o.ends_at>now()
      and s.status='accepted' and m.status='accepted'
      and (pref.user_id is null or (pref.enabled and pref.changed_at<=o.starts_at)));
$$;

create or replace function notification_private.enqueue_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.type not in ('order','system') and new.data->>'event' is distinct from 'offer-start' then return new; end if;
  insert into public.push_deliveries(notification_id,installation_id)
  select new.id,d.installation_id from public.push_devices d
  where d.owner_id=new.user_id and d.enabled and d.updated_at>now()-interval '30 days'
  on conflict do nothing;
  return new;
exception when others then
  raise warning 'Push enqueue deferred, code=%',sqlstate;
  return new;
end $$;

-- Central Arabic copy for the existing writers. Event keys and structured
-- identifiers remain independent of the recipient-facing text.
create function notification_private.render_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  parent_id uuid := (new.data->>'orderId')::uuid;
  child_id uuid := (new.data->>'storeOrderId')::uuid;
  key_value text := coalesce(new.event_key,'');
  state_value text;
  store_name text;
  order_ref text;
  child_ref text;
  order_label text;
  task_ref text;
  invoice_kind text;
  event_name text;
  driver_recipient boolean := coalesce(new.data->>'route',new.data->>'url','')='/driver/orders';
begin
  if parent_id is not null then
    select coalesce(r.reference,'رقم '||o.order_number::text) into order_ref
    from public.customer_orders o left join public.commerce_references r on r.record_id=o.id and r.kind='ORD'
    where o.id=parent_id;
  end if;
  order_label:=concat_ws(' ','الطلب',order_ref);
  if child_id is not null then
    select so.status::text,s.name,r.reference into state_value,store_name,child_ref
    from public.store_orders so join public.stores s on s.id=so.store_id
    left join public.commerce_references r on r.record_id=so.id and r.kind='SOR' where so.id=child_id;
  end if;
  if key_value like 'order-created:%' then
    if new.title='تم استلام طلبك' then
      new.body:=order_label||' أُرسل إلى المتاجر للمراجعة.';
    else
      new.title:='ورد طلب شراء جديد';
      new.body:=order_label||' متاح في قائمة الطلبات. افتحه لمتابعة أجزائه.';
    end if;
    event_name:='order-created';
  elsif key_value like 'store-created:%' then
    new.title:='طلب جديد بانتظار مراجعتك';
    new.body:='وصل '||order_label||' إلى '||coalesce(store_name,'متجرك')||'. افتح الجزء الخاص بمتجرك للقبول أو الاعتذار.';
    event_name:='merchant-review';
  elsif key_value like 'store-status:%' then
    -- In a one-store order the dispatch writer already announces readiness.
    if state_value='ready_for_pickup' and not driver_recipient
      and exists(select 1 from public.notifications n where n.user_id=new.user_id
        and n.data->>'orderId'=parent_id::text and n.data->>'event'='order-ready')
      and (select count(*) from public.store_orders where customer_order_id=parent_id
        and status not in('rejected','cancelled'))=1 then return null; end if;
    new.title:=case state_value when 'preparing' then 'المتجر يجهّز طلبك'
      when 'ready_for_pickup' then 'اكتمل التجهيز لدى المتجر'
      when 'rejected' then 'اعتذر المتجر عن التنفيذ' when 'cancelled' then 'أُلغي جزء من الطلب' else new.title end;
    new.body:=case state_value when 'preparing' then 'بدأ '||coalesce(store_name,'المتجر')||' تجهيز حصته من '||order_label||'.'
      when 'ready_for_pickup' then 'أصبح الجزء الخاص بـ'||coalesce(store_name,'المتجر')||' من '||order_label||' جاهزًا للاستلام.'
      when 'rejected' then 'تعذر تنفيذ جزء '||coalesce(store_name,'المتجر')||' من '||order_label||'. افتح التفاصيل لمعرفة أثره.'
      when 'cancelled' then 'أُلغي جزء '||coalesce(store_name,'المتجر')||' من '||order_label||'. راجع التفاصيل المحدثة.' else new.body end;
    if driver_recipient then
      if state_value='ready_for_pickup' then new.title:='جزء جاهز للاستلام'; end if;
      new.body:=new.body||' راجع خطة الاستلام في المهمة.';
    end if;
    event_name:='store-'||state_value;
  elsif key_value like 'task-available:%' then
    select reference into task_ref from public.commerce_references where kind='TSK' and record_id=(new.data->>'deliveryTaskId')::uuid;
    new.title:='مهمة توصيل متاحة';
    new.body:=concat_ws(' ','المهمة',task_ref)||' جاهزة للاستلام. افتح المهام المتاحة لمراجعتها وقبولها.';
    event_name:='task-available';
  elsif key_value like 'task:%' then
    new.body:=case when split_part(key_value,':',3)='accepted'
      then 'قبل سائق توصيل '||order_label||'. يمكنك متابعة الطلب من تفاصيله.'
      else 'استلم السائق '||order_label||' وهو الآن في طريقه للتسليم.' end;
    event_name:='task-'||split_part(key_value,':',3);
  elsif key_value like 'pickup:%' then
    new.body:='تسلّم السائق الجزء الخاص بـ'||coalesce(store_name,'متجرك')||' من '||order_label||'.';
    event_name:='merchant-pickup';
  elsif key_value like 'order-update:%' then
    new.body:=order_label||' — '||new.body;
    event_name:=case new.title when 'طلبك جاهز للتوصيل' then 'order-ready' when 'أُلغي الطلب' then 'order-cancelled'
      when 'طلبك قيد المراجعة' then 'order-pricing-review' when 'تحديث مبلغ الطلب' then 'order-amount' end;
  elsif key_value like 'store-exception:%' then
    select s.name into store_name from public.store_orders so join public.stores s on s.id=so.store_id
      where so.id=split_part(key_value,':',2)::uuid;
    new.title:=case split_part(key_value,':',3) when 'rejected' then 'اعتذار عن تنفيذ جزء' else 'إلغاء جزء من الطلب' end;
    new.body:='راجع أثر الجزء الخاص بـ'||coalesce(store_name,'المتجر')||' على '||order_label||'.';
    event_name:='store-exception';
  elsif key_value like 'pricing-review:%' then
    new.body:='توقف إرسال '||order_label||' لحين مراجعة المبلغ. افتح الطلب لمراجعة السبب.';
    event_name:='pricing-review';
  elsif key_value like 'review:%' then
    new.body:=new.body||' افتح سجل الانضمام للاطلاع على البيانات واتخاذ القرار.';
    event_name:='application-review';
  elsif key_value like 'application:%' then
    new.title:=case split_part(key_value,':',3) when 'accepted' then 'قُبل طلب انضمامك'
      when 'rejected' then 'لم يُقبل طلب انضمامك' when 'changes_requested' then 'طلب انضمامك يحتاج تعديلات'
      else 'طلب انضمامك قيد المراجعة' end;
    new.body:='افتح طلب الانضمام '||coalesce(new.data->>'reference','')||' للاطلاع على التفاصيل والخطوة التالية.';
    event_name:='application-'||split_part(key_value,':',3);
  elsif key_value like 'invoice:%' then
    select kind into invoice_kind from public.money_invoices where id=(new.data->>'invoiceId')::uuid;
    new.title:=case invoice_kind when 'INV' then 'تأكدت فاتورة مشترياتك' when 'SAL' then 'تأكدت فاتورة مبيعات متجرك'
      when 'DLV' then 'تأكد مستند تحصيل التوصيل' when 'WAG' then 'سُجّل استحقاق أجرك' else new.title end;
    new.body:=concat_ws(' ',new.body,case when invoice_kind in ('INV','SAL','DLV') and order_ref is not null then 'المرجع المرتبط: '||order_ref||'.' end);
    event_name:='invoice-'||invoice_kind;
    if invoice_kind='INV' and exists(select 1 from public.delivery_tasks t where t.customer_order_id=parent_id and t.status='delivered') then
      new.title:='تم تسليم طلبك';
      new.body:=order_label||' سُلّم، وفاتورة الشراء '||coalesce(new.data->>'reference','')||' متاحة من حسابك.';
    end if;
  end if;
  if event_name is not null then
    new.title:=left(new.title,140);
    new.body:=left(new.body,1000);
    new.data:=new.data||jsonb_strip_nulls(jsonb_build_object('event',event_name,'reference',coalesce(new.data->>'reference',child_ref,order_ref,task_ref)));
  end if;
  return new;
end $$;
create trigger render_notification before insert on public.notifications
for each row execute function notification_private.render_notification();

create function notification_private.driver_assignment_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare ref_value text;
begin
  if old.driver_id is not distinct from new.driver_id and
    not (new.status='cancelled' and old.status is distinct from new.status) then return new; end if;
  select reference into ref_value from public.commerce_references where record_id=new.id and kind='TSK';
  if old.driver_id is not null and (new.status='cancelled' or old.driver_id is distinct from new.driver_id) then
    perform notification_private.emit(old.driver_id,'driver-removed:'||new.id||':'||old.driver_id||':'||txid_current(),
      case when new.status='cancelled' then 'أُلغيت مهمة التوصيل' else 'تغيّر إسناد مهمة التوصيل' end,
      concat_ws(' ','المهمة',ref_value,'أُزيلت من مهامك النشطة. راجع قائمة توصيلاتك.'),
      jsonb_build_object('route','/driver/orders','event','driver-removed','reference',ref_value));
  end if;
  -- The driver's own acceptance is already confirmed by the foreground action.
  if new.driver_id is not null and new.driver_id is distinct from old.driver_id and new.status in ('accepted','picked_up')
    and auth.uid() is distinct from new.driver_id then
    perform notification_private.emit(new.driver_id,'driver-assigned:'||new.id||':'||new.driver_id||':'||txid_current(),
      'أُسندت إليك مهمة توصيل',concat_ws(' ','افتح المهمة',ref_value,'لمراجعة الاستلام والتسليم.'),
      jsonb_build_object('route','/driver/task-details','deliveryTaskId',new.id,'event','driver-assigned','reference',ref_value));
  end if;
  return new;
end $$;
create trigger driver_assignment_notification after update of driver_id,status on public.delivery_tasks
for each row execute function notification_private.driver_assignment_event();

create function notification_private.merchant_cancel_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; store_name text; ref_value text;
begin
  if new.status<>'cancelled' or old.status=new.status then return new; end if;
  select m.owner_user_id,s.name into recipient,store_name from public.stores s
    join public.merchants m on m.id=s.merchant_id where s.id=new.store_id;
  if recipient is null or recipient=auth.uid() then return new; end if;
  select reference into ref_value from public.commerce_references where record_id=new.id and kind='SOR';
  perform notification_private.emit(recipient,'merchant-cancelled:'||new.id,
    'أُلغي طلب متجرك',left(concat_ws(' ','أُلغي الطلب',ref_value,'لدى',store_name)||'. راجع جزء المتجر قبل متابعة التجهيز.',1000),
    jsonb_build_object('orderId',new.customer_order_id,'storeOrderId',new.id,'route','/merchant/orders',
      'event','merchant-cancelled','reference',ref_value));
  return new;
end $$;
create trigger merchant_store_cancel_notification after update of status on public.store_orders
for each row execute function notification_private.merchant_cancel_event();

create function public.read_push_delivery_message(delivery_value uuid,lease_value uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.notifications%rowtype; event_name text; copy_value text; detail_value text; ticket_exists boolean; ttl_value integer := 86400;
begin
  if not public.authorize_push_delivery(delivery_value,lease_value) then return null; end if;
  select x.* into n from public.push_deliveries q join public.notifications x on x.id=q.notification_id
  where q.id=delivery_value and q.lease=lease_value;
  if not found then return null; end if;
  select ticket is not null into ticket_exists from public.push_deliveries where id=delivery_value and lease=lease_value;
  if ticket_exists then return '{}'::jsonb; end if;
  event_name:=n.data->>'event';
  if n.type='offer' and (event_name is distinct from 'offer-start' or
    not notification_private.offer_push_current(n.user_id,n.data)) then return null; end if;
  if event_name='offer-start' then
    select floor(extract(epoch from least(ends_at,starts_at+interval '10 minutes')-clock_timestamp()))::integer into ttl_value
    from public.store_offers where id=(n.data->>'offerId')::uuid;
    if coalesce(ttl_value,0)<1 then return null; end if;
  end if;
  if event_name='task-available' and not exists (
    select 1 from public.delivery_tasks t join public.driver_applications a on a.user_id=n.user_id
    where t.id=(n.data->>'deliveryTaskId')::uuid and t.status='available' and a.status='accepted' and a.is_available
  ) then return null; end if;
  if event_name='driver-assigned' and not exists (
    select 1 from public.delivery_tasks t where t.id=(n.data->>'deliveryTaskId')::uuid
    and t.driver_id=n.user_id and t.status in ('accepted','picked_up')
  ) then return null; end if;
  -- Authored titles are safe for the lock screen; offer titles include a store
  -- name so use a separate lock-screen version. Never copy message bodies.
  copy_value:=case when event_name='offer-start' then 'بدأ عرض من متجر تتابعه'
    when event_name is not null then n.title
    when n.type='order' then 'مستجدات طلباتك' else 'مستجدات حسابك في تسوق' end;
  detail_value:=case when event_name='offer-start' then 'العرض متاح الآن. افتح التطبيق للاطلاع عليه.'
    when event_name='merchant-review' then 'افتح طلب المتجر لمراجعته.'
    when event_name in ('task-available','driver-assigned','driver-removed') then 'افتح توصيلاتك لمراجعة المهمة.'
    when event_name like 'invoice-%' then 'المستند متاح للمراجعة من حسابك.'
    when event_name like 'application-%' then 'افتح طلب الانضمام للاطلاع على التفاصيل.'
    when n.type='order' then 'افتح تفاصيل الطلب لمتابعته.' else 'افتح مركز الإشعارات للاطلاع على التفاصيل.' end;
  return jsonb_build_object('title',copy_value,'body',detail_value,'ttl',ttl_value);
end $$;
revoke all on function public.read_push_delivery_message(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_push_delivery_message(uuid,uuid) to service_role;

create or replace function public.reconcile_push_deliveries() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service required' using errcode='42501'; end if;
  insert into public.push_deliveries(notification_id,installation_id)
  select n.id,d.installation_id from public.notifications n join public.push_devices d on d.owner_id=n.user_id
  where n.read_at is null and n.created_at>now()-interval '24 hours' and d.enabled
    and d.updated_at>now()-interval '30 days' and n.created_at>=d.registered_at
    and (n.type in ('order','system') or case when n.data->>'event'='offer-start'
      then notification_private.offer_push_current(n.user_id,n.data) else false end)
    and not exists(select 1 from public.push_deliveries q where q.notification_id=n.id and q.installation_id=d.installation_id)
  order by n.created_at limit 500 on conflict do nothing;
  update public.push_deliveries q set state='dead',last_error='read_or_device_inactive'
  from public.notifications n,public.push_devices d where q.notification_id=n.id and q.installation_id=d.installation_id
    and q.state not in ('sent','dead') and (n.read_at is not null or d.updated_at<=now()-interval '30 days');
end $$;

do $$begin
  if to_regclass('cron.job') is not null then
    execute $cron$select cron.schedule('tasawuq-offer-starts','* * * * *',
      'select notification_private.publish_offer_starts()')$cron$;
  else
    raise notice 'Enable pg_cron before applying this migration to install tasawuq-offer-starts';
  end if;
end $$;

revoke all on all functions in schema notification_private from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
