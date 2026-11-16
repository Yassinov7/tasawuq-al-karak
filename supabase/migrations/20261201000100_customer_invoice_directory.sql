-- Read-only customer invoice directory with server-side filtering and stable cursor pagination.
-- Requires the finance cutover and the owner/created_at/id index introduced by merchant pagination.
create function public.read_customer_invoices(
  search_value text,
  kind_value text,
  before_created_at timestamptz,
  before_id uuid
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  owner_value uuid := auth.uid();
  query_value text;
begin
  if owner_value is null or not exists (
    select 1 from public.profiles where id = owner_value and role = 'customer'
  ) then
    raise exception 'customer account required' using errcode = '42501';
  end if;
  if kind_value is null or kind_value not in ('ALL', 'INV', 'SET', 'COR')
    or (before_created_at is null) <> (before_id is null) then
    raise exception 'invalid invoice filter or cursor' using errcode = '22023';
  end if;
  query_value := upper(translate(trim(coalesce(search_value, '')),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'));

  return (
    with candidates as materialized (
      select i.id, i.reference, i.kind, i.title, i.amount::text, i.status, i.created_at,
        i.owner_id, i.voided_by, i.customer_order_id, i.store_order_id, i.task_id
      from public.money_invoices i
      where i.owner_id = owner_value
        and i.kind in ('INV', 'SET', 'COR')
        and (kind_value = 'ALL' or i.kind = kind_value)
        and (before_id is null or (i.created_at, i.id) < (before_created_at, before_id))
        and (query_value = '' or position(query_value in i.reference) > 0 or exists (
          select 1 from public.commerce_references r
          where position(query_value in r.reference) > 0
            and r.record_id in (i.customer_order_id, i.store_order_id, i.task_id)
        ))
      order by i.created_at desc, i.id desc
      limit 13
    ), page_rows as (
      select c.*, coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', d.id, 'purpose', d.purpose, 'direction', d.direction,
          'amount', d.amount::text, 'remaining', money_private.remaining(d.id)::text
        )) from public.money_dues d where d.invoice_id = c.id
      ), '[]'::jsonb) as dues
      from candidates c
      order by c.created_at desc, c.id desc
      limit 12
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id desc) from page_rows p), '[]'::jsonb),
      'has_more', (select count(*) > 12 from candidates)
    )
  );
end;
$$;

revoke all on function public.read_customer_invoices(text, text, timestamptz, uuid) from public, anon;
grant execute on function public.read_customer_invoices(text, text, timestamptz, uuid) to authenticated;

