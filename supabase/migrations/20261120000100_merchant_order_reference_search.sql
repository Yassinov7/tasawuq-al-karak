-- Read-only exact reference search for the merchant's own store.
-- Requires the accepted invoice-finance cutover (commerce_references).
-- No data reset, financial changes, or changes to existing administrator access.
-- Owner applies this migration. Before application, the normal list still works;
-- submitting a search requires this function. Verify as two different merchant
-- JWTs: own SOR/ORD/order_number returns own store-order id; another store's SOR
-- returns null; targeting another owner's store raises 42501. Anonymous denied.
begin;
create function public.find_merchant_store_order(search_value text, target_store uuid)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare
  v text:=upper(translate(trim(coalesce(search_value,'')),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'));
  result_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.stores s join public.merchants m on m.id=s.merchant_id
    join public.profiles p on p.id=m.owner_user_id and p.role='merchant'
    where s.id=target_store and m.owner_user_id=auth.uid()
  ) then raise exception 'store access denied' using errcode='42501'; end if;
  if v ~ '^(SOR|ORD)-[0-9]{7,18}$' then
    select so.id into result_id from public.store_orders so
    join public.commerce_references r on
      (r.kind='SOR' and r.record_id=so.id) or (r.kind='ORD' and r.record_id=so.customer_order_id)
    where so.store_id=target_store and r.reference=v limit 1;
  elsif v ~ '^[0-9]{1,18}$' then
    select so.id into result_id from public.store_orders so
    join public.customer_orders co on co.id=so.customer_order_id
    where so.store_id=target_store and ltrim(co.order_number::text,'0')=ltrim(v,'0') limit 1;
  end if;
  return result_id;
end $$;
revoke all on function public.find_merchant_store_order(text,uuid) from public,anon;
grant execute on function public.find_merchant_store_order(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
