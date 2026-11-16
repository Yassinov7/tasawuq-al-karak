-- Paginated, customer-owned order search for RUI-CUS-10.
-- Requires the invoice-finance cutover (commerce_references) and the existing
-- immutable product_title_snapshot on store_order_items. The owner applies this
-- migration; it does not rewrite orders, prices, references, or historical rows.
-- Verify with two customer JWTs: each account sees only its own rows; search by
-- ORD/order_number, current store name, and historical product title; filters and
-- offset/limit preserve created_at/id ordering; anon execution is denied.
begin;

create or replace function public.read_customer_orders_page(
  query_value text default '',
  status_value text default 'all',
  offset_value integer default 0,
  limit_value integer default 12
)
returns setof public.customer_orders
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := lower(translate(
    regexp_replace(regexp_replace(trim(coalesce(query_value, '')), '[ًٌٍَُِّْـ]', '', 'g'), '\s+', ' ', 'g'),
    'أإآى', 'اااي'
  ));
  reference_q text := upper(translate(trim(coalesce(query_value, '')), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'));
  safe_offset integer := greatest(0, coalesce(offset_value, 0));
  safe_limit integer := least(50, greatest(1, coalesce(limit_value, 12)));
begin
  if auth.uid() is null then
    raise exception 'customer account required' using errcode = '42501';
  end if;
  if status_value not in ('all', 'active', 'completed', 'cancelled') then
    raise exception 'invalid order filter' using errcode = '22023';
  end if;
  if offset_value is null or offset_value < 0 or offset_value > 1000000 then
    raise exception 'invalid order offset' using errcode = '22023';
  end if;

  return query
  select co.*
  from public.customer_orders co
  where co.customer_id = auth.uid()
    and case status_value
      when 'active' then co.status not in ('delivered', 'cancelled')
      when 'completed' then co.status = 'delivered'
      when 'cancelled' then co.status = 'cancelled'
      else true
    end
    and (
      q = ''
      or position(reference_q in co.order_number::text) > 0
      or exists (
        select 1 from public.commerce_references cr
        where cr.kind = 'ORD' and cr.record_id = co.id
          and position(reference_q in upper(cr.reference)) > 0
      )
      or exists (
        select 1
        from public.store_orders so
        join public.stores s on s.id = so.store_id
        where so.customer_order_id = co.id
          and position(q in lower(translate(regexp_replace(regexp_replace(s.name, '[ًٌٍَُِّْـ]', '', 'g'), '\s+', ' ', 'g'), 'أإآى', 'اااي'))) > 0
      )
      or exists (
        select 1
        from public.store_orders so
        join public.store_order_items soi on soi.store_order_id = so.id
        where so.customer_order_id = co.id
          and position(q in lower(translate(regexp_replace(regexp_replace(soi.product_title_snapshot, '[ًٌٍَُِّْـ]', '', 'g'), '\s+', ' ', 'g'), 'أإآى', 'اااي'))) > 0
      )
    )
  order by co.created_at desc, co.id desc
  offset safe_offset
  limit safe_limit;
end
$$;

revoke all on function public.read_customer_orders_page(text,text,integer,integer) from public, anon;
grant execute on function public.read_customer_orders_page(text,text,integer,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
