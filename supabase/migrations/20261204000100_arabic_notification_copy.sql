-- UX-AR-FINAL: future COPY ONLY, owner applies manually after the central-notifications migration.
-- Existing render_notification owns event/reference enrichment and legacy readiness deduplication.
-- This migration does not reimplement either contract or add any suppression.
-- Two guarded text-only repairs in that existing renderer avoid title-based role guessing
-- and stop an unsupported task status being paraphrased before the copy-only trigger sees it.
begin;
do $repair$
declare definition text; old_part text; new_part text;
begin
  if to_regprocedure('notification_private.render_notification()') is null then
    raise exception 'Apply central notifications first';
  end if;
  definition:=replace(pg_get_functiondef('notification_private.render_notification()'::regprocedure),E'\r','');
  old_part:=$old$if new.title='تم استلام طلبك' then
      new.body:=order_label||' أُرسل إلى المتاجر للمراجعة.';
    else
      new.title:='ورد طلب شراء جديد';
      new.body:=order_label||' متاح في قائمة الطلبات. افتحه لمتابعة أجزائه.';
    end if;$old$;
  new_part:=$new$if exists(select 1 from public.customer_orders where id=parent_id and customer_id=new.user_id) then
      new.body:=order_label||' أُرسل إلى المتاجر للمراجعة.';
    elsif exists(select 1 from public.profiles where id=new.user_id and role='admin') then
      new.title:='ورد طلب شراء جديد';
      new.body:=order_label||' متاح في قائمة الطلبات. افتحه لمتابعة أجزائه.';
    end if;$new$;
  if position(old_part in definition)>0 then definition:=replace(definition,old_part,new_part);
  elsif position(new_part in definition)=0 then raise exception 'Unexpected original renderer; review before applying copy changes'; end if;
  old_part:=$old$new.body:=case when split_part(key_value,':',3)='accepted'
      then 'قبل سائق توصيل '||order_label||'. يمكنك متابعة الطلب من تفاصيله.'
      else 'استلم السائق '||order_label||' وهو الآن في طريقه للتسليم.' end;$old$;
  new_part:=$new$new.body:=case split_part(key_value,':',3) when 'accepted'
      then 'قبل سائق توصيل '||order_label||'. يمكنك متابعة الطلب من تفاصيله.'
      when 'picked_up' then 'استلم السائق '||order_label||' وهو الآن في طريقه للتسليم.' else new.body end;$new$;
  if position(old_part in definition)>0 then definition:=replace(definition,old_part,new_part);
  elsif position(new_part in definition)=0 then raise exception 'Unexpected original renderer; review before applying copy changes'; end if;
  execute definition;
end $repair$;

create or replace function notification_private.arabic_notification_copy() returns trigger
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
  cash_direction_value text;
  event_name text := new.data->>'event';
  customer_recipient uuid;
  invoice_parent_id uuid;
  invoice_owner uuid;
  invoice_status text;
  invoice_voided uuid;
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
    select customer_id into customer_recipient from public.customer_orders where id=parent_id;
    if customer_recipient=new.user_id then
      new.title:='أُرسل طلبك للمتاجر';
      new.body:=order_label||' بانتظار مراجعة المتاجر. سننبهك عند بدء التجهيز.';
    elsif exists(select 1 from public.profiles where id=new.user_id and role='admin') then
      new.title:='طلب شراء جديد';
      new.body:=order_label||' متاح لمراجعة حالته وطلبات متاجره.';
    else return new; end if;
  elsif key_value like 'store-created:%' then
    new.title:='طلب جديد لمتجرك';
    new.body:=order_label||' لدى '||coalesce(store_name,'متجرك')||'. راجع المنتجات ثم اقبل الطلب وابدأ التجهيز، أو اعتذر مع ذكر السبب.';
  elsif key_value like 'store-status:%' then
    if state_value is null or state_value not in('preparing','ready_for_pickup','rejected','cancelled') then return new; end if;
    new.title:=case state_value when 'preparing' then 'بدأ المتجر تجهيز طلبك'
      when 'ready_for_pickup' then 'متجر أنهى تجهيز طلبك'
      when 'rejected' then 'اعتذر متجر عن طلبك' when 'cancelled' then 'أُلغي طلب أحد المتاجر' else new.title end;
    new.body:=case state_value when 'preparing' then 'وافق '||coalesce(store_name,'المتجر')||' وبدأ تجهيز المنتجات الخاصة به في '||order_label||'.'
      when 'ready_for_pickup' then 'منتجات '||coalesce(store_name,'المتجر')||' جاهزة لاستلام السائق. تابع بقية المتاجر من '||order_label||'.'
      when 'rejected' then 'اعتذر '||coalesce(store_name,'المتجر')||'. راجع السبب والمبلغ المحدّث داخل '||order_label||'.'
      when 'cancelled' then 'أُلغي طلب '||coalesce(store_name,'المتجر')||'. راجع أثر الإلغاء داخل '||order_label||'.' else new.body end;
    if driver_recipient then
      new.title:=case when state_value='ready_for_pickup' then 'متجر جاهز للاستلام' else 'تغيّرت متاجر المهمة' end;
      new.body:=case when state_value='ready_for_pickup' then 'منتجات أحد متاجر مهمتك جاهزة. افتح المهمة لمعرفة نقطة الاستلام.'
        else 'راجع نقاط الاستلام ومبلغ التحصيل المحدّث قبل المتابعة.' end;
    end if;
  elsif key_value like 'merchant-cancelled:%' then
    new.title:='أُلغي طلب متجرك';
    new.body:='راجع طلب المتجر الملغى قبل مواصلة تجهيز منتجاته.';
  elsif key_value like 'driver-assigned:%' then
    new.title:='أُسندت إليك مهمة توصيل';
    new.body:='افتح المهمة لمراجعة المتاجر ووجهة التسليم.';
  elsif key_value like 'driver-removed:%' then
    if exists(select 1 from public.delivery_tasks where id=split_part(key_value,':',2)::uuid and status='cancelled') then
      new.title:='أُلغيت مهمتك'; new.body:='افتح قائمة التوصيلات لمراجعة الحالة الحالية.';
    elsif exists(select 1 from public.delivery_tasks where id=split_part(key_value,':',2)::uuid and driver_id is distinct from new.user_id) then
      new.title:='تغيّر إسناد المهمة'; new.body:='لم تعد المهمة ضمن توصيلاتك المسندة.';
    else return new; end if;
  elsif key_value like 'task-available:%' then
    select reference into task_ref from public.commerce_references where kind='TSK' and record_id=(new.data->>'deliveryTaskId')::uuid;
    new.title:='مهمة توصيل جديدة';
    new.body:=concat_ws(' ','المهمة',task_ref)||'. راجع المنطقة والمتاجر ثم اقبل المهمة إذا كانت مناسبة.';
  elsif key_value like 'task:%' then
    if split_part(key_value,':',3) not in('accepted','picked_up') then return new; end if;
    new.title:=case when split_part(key_value,':',3)='accepted' then 'سائق سيتولى توصيل طلبك' else 'استلم السائق طلبك' end;
    new.body:=case when split_part(key_value,':',3)='accepted'
      then 'قبل السائق مهمة '||order_label||'، وسيستلم المنتجات من المتاجر.'
      else 'استلم السائق منتجات '||order_label||' من المتاجر وبدأ مرحلة التوصيل.' end;
  elsif key_value like 'pickup:%' then
    new.title:='استلم السائق منتجات متجرك';
    new.body:='أصبحت منتجات '||coalesce(store_name,'متجرك')||' لدى السائق ضمن مهمة توصيل '||order_label||'.';
  elsif key_value like 'order-update:%' then
    if event_name is null or event_name not in('order-ready','order-cancelled','order-pricing-review','order-amount') then return new; end if;
    new.title:=case event_name when 'order-ready' then 'طلبك جاهز لاستلام السائق' when 'order-cancelled' then 'أُلغي طلبك'
      when 'order-pricing-review' then 'طلبك بانتظار المراجعة' when 'order-amount' then 'تغيّر مبلغ طلبك' else new.title end;
    new.body:=order_label||' — '||case event_name when 'order-ready' then 'انتهت المتاجر من تجهيز المنتجات. الطلب بانتظار استلام السائق.'
      when 'order-cancelled' then 'تعذر تنفيذ الطلب لدى المتاجر. راجع تفاصيل الإلغاء.'
      when 'order-pricing-review' then 'تراجع الإدارة المبلغ قبل متابعة التوصيل. افتح الطلب لمعرفة المستجدات.'
      when 'order-amount' then 'راجع المبلغ المعتمد بعد تحديث طلبات المتاجر.' else new.body end;
  elsif key_value like 'store-exception:%' then
    if split_part(key_value,':',3) not in('rejected','cancelled') then return new; end if;
    select s.name into store_name from public.store_orders so join public.stores s on s.id=so.store_id
      where so.id=split_part(key_value,':',2)::uuid;
    new.title:=case split_part(key_value,':',3) when 'rejected' then 'متجر اعتذر عن طلب' else 'أُلغي طلب متجر' end;
    new.body:='راجع '||order_label||' وأثر التغيير على المتاجر والمبلغ.';
  elsif key_value like 'pricing-review:%' then
    new.title:='طلب بانتظار مراجعة المبلغ';
    new.body:='راجع سبب اختلاف المبلغ في '||order_label||' قبل السماح بمتابعة الطلب.';
  elsif key_value like 'review:%' then
    new.title:='طلب انضمام جديد';
    new.body:='راجع طلب الانضمام والبيانات المرفقة لاتخاذ القرار.';
  elsif key_value like 'application:%' then
    if split_part(key_value,':',3) not in('pending','accepted','rejected','changes_requested') then return new; end if;
    new.title:=case split_part(key_value,':',3) when 'accepted' then 'قُبل طلب انضمامك'
      when 'rejected' then 'لم يُقبل طلب انضمامك' when 'changes_requested' then 'يرجى تعديل طلب انضمامك'
      else 'طلب انضمامك قيد المراجعة' end;
    new.body:=case split_part(key_value,':',3) when 'accepted' then 'افتح حسابك للاطلاع على الخطوة التالية.'
      when 'rejected' then 'راجع القرار والملاحظات المسجلة داخل طلبك.'
      when 'changes_requested' then 'افتح الطلب وراجع البيانات المطلوب تعديلها.'
      else 'سننبهك عند صدور قرار أو طلب تعديل البيانات.' end;
  elsif key_value like 'invoice:%' then
    select kind,cash_direction,customer_order_id,owner_id,status,voided_by
      into invoice_kind,cash_direction_value,invoice_parent_id,invoice_owner,invoice_status,invoice_voided
    from public.money_invoices where id=(new.data->>'invoiceId')::uuid;
    if invoice_owner is distinct from new.user_id or invoice_status is distinct from 'confirmed' or invoice_voided is not null then return new; end if;
    if invoice_kind='SET' and (cash_direction_value is null or cash_direction_value not in('in','out')) then return new; end if;
    if invoice_kind not in('INV','SAL','DLV','SUB','SET','COR','WAG') then return new; end if;
    new.title:=case invoice_kind when 'INV' then 'اعتُمدت فاتورة شرائك' when 'SAL' then 'اعتُمدت فاتورة مبيعاتك'
      when 'DLV' then 'اعتُمد مستند التوصيل والتحصيل' when 'SUB' then 'اعتُمدت فاتورة الاشتراك'
      when 'SET' then case cash_direction_value when 'in' then 'سُجّل مبلغ استلمته المنصة' when 'out' then 'سُجّل مبلغ صُرف لك' else new.title end
      when 'COR' then 'اعتُمد مستند تصحيح' when 'WAG' then 'سُجّل استحقاق أجر' else new.title end;
    new.body:=case invoice_kind when 'INV' then 'راجع فاتورة الطلب من حسابك. حالة السداد موضحة داخلها.'
      when 'SAL' then 'فاتورة المبيعات متاحة للمراجعة من حسابك المالي.'
      when 'DLV' then 'راجع تفاصيل التسليم والتحصيل وتسليم المبالغ للمنصة من حسابك المالي.'
      when 'SUB' then 'راجع فاتورة الاشتراك وحالة سدادها من حسابك المالي.'
      when 'SET' then case cash_direction_value when 'in' then 'راجع مستند التسوية لمعرفة المبلغ والرصيد المتبقي.' when 'out' then 'راجع مستند التسوية وتفاصيل المبلغ من حسابك المالي.' else new.body end
      when 'COR' then 'راجع التصحيح وأثره على المستند المرتبط.'
      when 'WAG' then 'راجع مستند الأجر وتفاصيل استحقاقه؛ لا تعني الرسالة صرفه.' else new.body end;
    -- invoice.reference is INV, not ORD. Resolve copy context from the owned invoice's FK.
    -- Never add/fix orderId/reference in data, and never trust a conflicting payload orderId.
    if invoice_kind='INV' and invoice_parent_id is not null and (parent_id is null or parent_id=invoice_parent_id)
      and exists(select 1 from public.customer_orders where id=invoice_parent_id and customer_id=new.user_id)
      and exists(select 1 from public.delivery_tasks t where t.customer_order_id=invoice_parent_id and t.status='delivered')
      and exists(select 1 from public.store_orders so where so.customer_order_id=invoice_parent_id and so.status='delivered')
      and not exists(select 1 from public.store_orders so where so.customer_order_id=invoice_parent_id and so.status not in('delivered','rejected','cancelled')) then
      select reference into order_ref from public.commerce_references where kind='ORD' and record_id=invoice_parent_id;
      new.title:='تم تسليم طلبك';
      new.body:=concat_ws(' ','اكتمل تسليم المنتجات المنفذة من طلبك',order_ref)||'. راجع فاتورة الطلب وحالة السداد من حسابك.';
    end if;
  elsif new.data->>'event'='offer-start' then
    select name into store_name from public.stores where id=(new.data->>'storeId')::uuid;
    new.title:='عرض جديد لدى متجر تتابعه';
    new.body:='بدأ عرض لدى '||coalesce(store_name,'المتجر')||'. افتح تفاصيله لمعرفة المنتجات والمدة.';
  end if;
  new.title:=left(new.title,140);
  new.body:=left(new.body,1000);
  return new;
end $$;

-- PostgreSQL executes BEFORE INSERT triggers by name: normalize -> render -> zz copy.
drop trigger if exists zz_arabic_notification_copy on public.notifications;
create trigger zz_arabic_notification_copy before insert on public.notifications
for each row execute function notification_private.arabic_notification_copy();
revoke all on function notification_private.arabic_notification_copy() from public,anon,authenticated;
-- No INSERT/UPDATE/DELETE, event-key, recipient, historical-row, RLS, device, dispatcher or Cron changes.
commit;
