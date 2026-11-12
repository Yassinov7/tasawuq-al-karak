-- Read-only driver documents and balances. Reuses the existing owner/page index and remaining-due calculation.
create function public.read_driver_money(
  search_value text,
  kind_value text,
  before_created_at timestamptz,
  before_id uuid
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  owner_value uuid := auth.uid();
  query_value text;
  result_value jsonb;
begin
  if owner_value is null or not exists (
    select 1 from public.profiles where id = owner_value and role = 'driver'
  ) then
    raise exception 'account access denied' using errcode = '42501';
  end if;
  if kind_value is null or kind_value not in ('ALL', 'DLV', 'SET', 'COR', 'WAG')
    or (before_created_at is null) <> (before_id is null) then
    raise exception 'invalid invoice filter or cursor' using errcode = '22023';
  end if;
  query_value := upper(translate(trim(coalesce(search_value, '')),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'));

  with candidates as materialized (
    select i.id, i.reference, i.kind, i.title, i.amount::text, i.status, i.created_at,
      i.owner_id, i.voided_by, i.customer_order_id, i.store_order_id, i.task_id
    from public.money_invoices i
    where i.owner_id = owner_value
      and i.kind in ('DLV', 'SET', 'COR', 'WAG')
      and (kind_value = 'ALL' or i.kind = kind_value)
      and (before_id is null or (i.created_at, i.id) < (before_created_at, before_id))
      and (query_value = '' or position(query_value in i.reference) > 0 or exists (
        select 1 from public.commerce_references r
        where position(query_value in r.reference) > 0
          and ((r.kind = 'ORD' and r.record_id = i.customer_order_id)
            or (r.kind = 'SOR' and r.record_id = i.store_order_id)
            or (r.kind = 'TSK' and r.record_id = i.task_id))
      ))
    order by i.created_at desc, i.id desc
    limit 11
  ), page_rows as (
    select c.*, coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'purpose', d.purpose, 'direction', d.direction,
        'amount', d.amount::text, 'remaining', money_private.remaining(d.id)::text
      ))
      from public.money_dues d where d.invoice_id = c.id
    ), '[]'::jsonb) as dues
    from candidates c
    order by c.created_at desc, c.id desc
    limit 10
  ), balances as (
    select coalesce(sum(remaining) filter (where direction = 'in'), 0)::text as receivable,
      coalesce(sum(remaining) filter (where direction = 'out'), 0)::text as payable,
      coalesce(sum(remaining) filter (where purpose = 'collection'), 0)::text as collection_due,
      coalesce(sum(remaining) filter (where purpose = 'subscription'), 0)::text as subscription_due
    from (
      select d.direction, d.purpose, money_private.remaining(d.id) as remaining
      from public.money_dues d join public.money_invoices i on i.id = d.invoice_id
      where d.owner_id = owner_value and i.status = 'confirmed' and i.voided_by is null
    ) as open_dues
  )
  select jsonb_build_object(
    'admin', false, 'owner', owner_value, 'cash', null,
    'account_reference', (select reference from public.money_accounts where owner_id = owner_value),
    'receivable', b.receivable, 'payable', b.payable,
    'collection_due', b.collection_due, 'subscription_due', b.subscription_due,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id desc) from page_rows p
    ), '[]'::jsonb),
    'has_more', (select count(*) > 10 from candidates)
  ) into result_value
  from balances b;
  return result_value;
end;
$$;

revoke all on function public.read_driver_money(text, text, timestamptz, uuid) from public, anon;
grant execute on function public.read_driver_money(text, text, timestamptz, uuid) to authenticated;
