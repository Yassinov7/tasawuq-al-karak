-- Owner applies after invoice_finance_cutover. No financial amounts, balances or old migrations change.
begin;
create schema notification_private;
revoke all on schema notification_private from public,anon,authenticated;
alter table public.notifications add column event_key text unique;
do $$ declare t text;begin
 foreach t in array array['money_invoices','money_allocations','money_driver_policies','merchant_applications','driver_applications','notifications','customer_orders','store_orders','delivery_tasks'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
 execute format('alter publication supabase_realtime add table public.%I',t);
 end if;
 end loop;
end $$;
create function notification_private.emit(owner_value uuid,key_value text,title_value text,body_value text,data_value jsonb) returns void
language plpgsql security definer set search_path='' as $$ begin
 insert into public.notifications(user_id,type,title,body,data,event_key)
 values(owner_value,'system',title_value,body_value,data_value,key_value) on conflict(event_key) do nothing;
end $$;
create function notification_private.invoice_event() returns trigger language plpgsql security definer set search_path='' as $$ begin
 -- SET first INSERT has no cash direction; emit after the writer sets the actual direction.
 if new.status<>'confirmed' or new.voided_by is not null or (new.kind='SET' and new.cash_direction is null) then return new;end if;
 perform notification_private.emit(new.owner_id,'invoice:'||new.id::text||':confirmed',
 case new.kind when 'SET' then case new.cash_direction when 'in' then 'تم تسجيل قبض للمنصة' else 'تم تسجيل صرف لك' end
 when 'COR' then 'تصحيح مستند مالي' when 'SUB' then 'صدرت فاتورة اشتراكك' else 'تحديث فاتورتك' end,
 'يمكنك مراجعة المستند '||new.reference||' من حسابك.',
 jsonb_build_object('invoiceId',new.id,'reference',new.reference,'orderId',new.customer_order_id,'deliveryTaskId',new.task_id,'route','/financial-invoice'));
 return new;
end $$;
create trigger money_invoice_notification after insert or update on public.money_invoices for each row execute function notification_private.invoice_event();
create function notification_private.application_event() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.status is not distinct from old.status then return new;end if;
 perform notification_private.emit(new.user_id,'application:'||new.id::text||':'||new.status::text||':'||coalesce(new.reviewed_at,new.submitted_at)::text,
 'تحديث طلب الانضمام','تغيرت حالة طلبك '||new.public_reference||'. افتح الطلب لمراجعة التفاصيل.',jsonb_build_object('route','/application-status','reference',new.public_reference));
 return new;
end $$;
create trigger merchant_application_notification after update of status on public.merchant_applications for each row execute function notification_private.application_event();
create trigger driver_application_notification after update of status on public.driver_applications for each row execute function notification_private.application_event();
-- Tokens and delivery queue are intentionally not directly accessible through client tables.
create table public.push_devices (
 installation_id uuid primary key,owner_id uuid not null references public.profiles(id) on delete cascade,
 token text not null unique check(token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
 platform text not null check(platform in('android','ios')),enabled boolean not null default true,
 registered_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.push_deliveries (
 id uuid primary key default gen_random_uuid(),notification_id uuid not null references public.notifications(id) on delete cascade,
 installation_id uuid not null references public.push_devices(installation_id) on delete cascade,
 state text not null default 'pending' check(state in('pending','leased','ticket','sent','dead')),
 attempts integer not null default 0,next_attempt timestamptz not null default now(),
 lease uuid,leased_token text,lease_until timestamptz,ticket text,last_error text,created_at timestamptz not null default now(),
 unique(notification_id,installation_id)
);
create index push_deliveries_due on public.push_deliveries(state,next_attempt);
alter table public.push_devices enable row level security;
alter table public.push_deliveries enable row level security;
revoke all on public.push_devices,public.push_deliveries from public,anon,authenticated;
create function public.register_push_device(installation_value uuid,token_value text,platform_value text,expected_user uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
 if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'account changed' using errcode='42501';end if;
 if installation_value is null then raise exception 'installation required';end if;
 -- Serializes a physical installation changing owner or token without transferring old queued messages.
 perform pg_advisory_xact_lock(hashtextextended(token_value,7352));
 delete from public.push_devices where token=token_value and installation_id<>installation_value;
 insert into public.push_devices(installation_id,owner_id,token,platform) values(installation_value,expected_user,token_value,platform_value)
 on conflict(installation_id) do update set owner_id=excluded.owner_id,token=excluded.token,platform=excluded.platform,enabled=true,
 registered_at=case when push_devices.owner_id<>excluded.owner_id or push_devices.token<>excluded.token then now() else push_devices.registered_at end,updated_at=now();
end $$;
create function public.disable_push_device(installation_value uuid,expected_user uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if expected_user is distinct from auth.uid() or expected_user is null then raise exception 'account changed' using errcode='42501';end if;
 update public.push_devices set enabled=false,updated_at=now() where installation_id=installation_value and owner_id=expected_user;
end $$;
create function notification_private.enqueue_push() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.push_deliveries(notification_id,installation_id)
 select new.id,d.installation_id from public.push_devices d where d.owner_id=new.user_id and d.enabled;
 return new;
end $$;
create trigger notification_push_enqueue after insert on public.notifications for each row execute function notification_private.enqueue_push();
-- At-most-one active lease; tickets are receipt-polled, never resent as new messages.
create function public.claim_push_deliveries(batch_limit integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$
declare result_value jsonb;begin
 if auth.role() is distinct from 'service_role' then raise exception 'service required' using errcode='42501';end if;
 if batch_limit is null or batch_limit not between 1 and 100 then raise exception 'invalid batch';end if;
 update public.push_deliveries set state='dead',last_error='expired' where state not in('sent','dead') and (created_at<now()-interval '24 hours' or attempts>=12);
 update public.push_deliveries q set state='dead',last_error='device_inactive' from public.notifications n,public.push_devices d
 where q.notification_id=n.id and q.installation_id=d.installation_id and q.state not in('sent','dead')
 and (not d.enabled or d.owner_id<>n.user_id or n.created_at<d.registered_at);
 with candidates as (
 select q.id from public.push_deliveries q where state in('pending','ticket','leased') and next_attempt<=now()
 and (lease_until is null or lease_until<now()) order by next_attempt,id for update skip locked limit batch_limit
 ), claimed as (
 update public.push_deliveries q set state=case when q.ticket is null then 'leased' else 'ticket' end,
 lease=gen_random_uuid(),leased_token=(select token from public.push_devices d where d.installation_id=q.installation_id),lease_until=now()+interval '2 minutes',attempts=attempts+1 from candidates c where q.id=c.id
 returning q.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'notification_id',q.notification_id,'lease',q.lease,'ticket',q.ticket,'token',d.token)), '[]') into result_value
 from claimed q join public.push_devices d on d.installation_id=q.installation_id;
 return result_value;
end $$;
create function public.finish_push_delivery(delivery_value uuid,lease_value uuid,result_kind text,ticket_value text default null,error_value text default null) returns void
language plpgsql security definer set search_path='' as $$ declare q public.push_deliveries%rowtype;begin
 if auth.role() is distinct from 'service_role' then raise exception 'service required' using errcode='42501';end if;
 select * into q from public.push_deliveries where id=delivery_value and lease=lease_value for update;
 if not found then return;end if;
 if result_kind not in('retry','ticket','sent','dead','device_gone') then raise exception 'invalid push outcome';end if;
 if result_kind='ticket' and nullif(ticket_value,'') is null then raise exception 'ticket required';end if;
 if result_kind='device_gone' then update public.push_devices set enabled=false where installation_id=q.installation_id and token=q.leased_token;end if;
 update public.push_deliveries set state=case when result_kind in('dead','device_gone') then 'dead' when result_kind='sent' then 'sent' when result_kind='ticket' or q.ticket is not null then 'ticket' else 'pending' end,
 ticket=coalesce(ticket_value,ticket),last_error=left(error_value,120),lease=null,lease_until=null,
 next_attempt=now()+case when result_kind='ticket' then interval '15 minutes' else make_interval(secs=>least(3600,30*power(2,least(q.attempts,7)))::integer) end
 where id=q.id;
end $$;
revoke all on function public.register_push_device(uuid,text,text,uuid),public.disable_push_device(uuid,uuid),public.claim_push_deliveries(integer),public.finish_push_delivery(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.register_push_device(uuid,text,text,uuid),public.disable_push_device(uuid,uuid) to authenticated;
grant execute on function public.claim_push_deliveries(integer),public.finish_push_delivery(uuid,uuid,text,text,text) to service_role;
revoke all on all functions in schema notification_private from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
