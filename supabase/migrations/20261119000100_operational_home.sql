-- UI-02 read-only dashboard APIs. Owner applies after 20261118000100.
-- No financial writers, balances, acceptance rules, tables or existing migrations are replaced.
-- Rollback: drop these three functions; remove only publications added here if no other feature uses them.
begin;
create function public.read_admin_home(expected_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from expected_user or not public.is_admin() then
  raise exception 'administrator required' using errcode='42501';
 end if;
 return jsonb_build_object(
  'owner',auth.uid(),
  'merchant_pending',(select count(*) from public.merchant_applications where status='pending'),
  'driver_pending',(select count(*) from public.driver_applications where status='pending'),
  'new_orders',(select count(*) from public.customer_orders where status='submitted'),
  'delivery_orders',(select count(*) from public.customer_orders where status in ('ready_for_delivery','out_for_delivery')),
  'pricing_review',(select count(*) from public.order_pricing_current p join public.customer_orders o on o.id=p.customer_order_id where p.review_required and o.status not in ('delivered','cancelled')));
end $$;
create function public.read_merchant_home_status(target_store uuid,expected_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.stores%rowtype; m public.merchants%rowtype; t public.merchant_terms%rowtype; eligible boolean; reason text;
begin
 if auth.uid() is null or auth.uid() is distinct from expected_user then raise exception 'account required' using errcode='42501';end if;
 select * into s from public.stores where id=target_store;
 select * into m from public.merchants where id=s.merchant_id and owner_user_id=auth.uid();
 if m.id is null then raise exception 'owned store required' using errcode='42501';end if;
 select * into t from public.merchant_terms where merchant_id=m.id;
 eligible:=public.store_accepts_new_orders(s.id);
 reason:=case when eligible then 'ready'
  when m.status<>'accepted' or s.status<>'accepted' then 'approval'
  when t.id is null then 'subscription_unavailable'
  when t.starts_at is null or t.expires_at is null then 'subscription_unpaid'
  when t.starts_at>now() then 'subscription_not_started'
  when t.expires_at<=now() then 'subscription_expired'
  else 'unavailable' end;
 return jsonb_build_object('owner',auth.uid(),'store_id',s.id,'eligible',eligible,'reason',reason,
  'server_now',now(),'recheck_at',case when eligible then t.expires_at when reason='subscription_not_started' then t.starts_at else null end);
end $$;
create function public.read_admin_review_order_ids(page_value integer default 0,page_size integer default 20, search_value text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() or auth.uid() is null then raise exception 'administrator required' using errcode='42501';end if;
 if page_value is null or page_value<0 or page_value>100000 or page_size is null or page_size<1 or page_size>100 then raise exception 'invalid page';end if;
 return coalesce((select jsonb_agg(x.id order by x.created_at desc,x.id desc) from (
  select o.id,o.created_at from public.customer_orders o join public.order_pricing_current p on p.customer_order_id=o.id
  where p.review_required and o.status not in ('delivered','cancelled')
   and (coalesce(trim(search_value),'')='' or position(lower(trim(search_value)) in lower(o.recipient_name))>0
    or o.order_number::text=translate(trim(search_value),'٠١٢٣٤٥٦٧٨٩','0123456789')
    or exists(select 1 from public.profiles pr where pr.id=o.customer_id and position(lower(trim(search_value)) in lower(pr.full_name))>0)
    or exists(select 1 from public.commerce_references r where r.record_id=o.id and position(upper(trim(search_value)) in r.reference)>0))
  order by o.created_at desc,o.id desc limit page_size+1 offset page_value*page_size
 ) x),'[]'::jsonb);
end $$;
revoke all on function public.read_admin_home(uuid),public.read_merchant_home_status(uuid,uuid),public.read_admin_review_order_ids(integer,integer,text) from public,anon;
grant execute on function public.read_admin_home(uuid),public.read_merchant_home_status(uuid,uuid),public.read_admin_review_order_ids(integer,integer,text) to authenticated;
do $$ declare t text; begin
 foreach t in array array['merchants','stores','products','store_offers','merchant_terms','order_pricing_current'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
commit;
