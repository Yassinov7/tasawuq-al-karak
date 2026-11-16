-- Offer lifecycle phase 1 (additive and backwards compatible).
-- Apply before switching merchant/customer clients to the v2 RPCs.
-- Legacy rows are preserved exactly: no synthetic ends_at and no NOT NULL change.

create or replace function public.read_customer_active_offers()
returns setof public.store_offers
language sql
stable
security definer
set search_path = ''
as $$
  select o.*
  from public.store_offers o
  join public.stores s on s.id = o.store_id
  join public.merchants m on m.id = s.merchant_id
  where o.is_active
    and o.starts_at <= statement_timestamp()
    and (o.ends_at is null or o.ends_at > statement_timestamp())
    and s.status = 'accepted'
    and m.status = 'accepted'
  order by o.starts_at desc, o.id;
$$;

create or replace function public.read_customer_next_offer_transition()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(transition_at)
  from (
    select o.starts_at as transition_at
    from public.store_offers o
    join public.stores s on s.id = o.store_id
    join public.merchants m on m.id = s.merchant_id
    where o.is_active
      and o.starts_at > statement_timestamp()
      and o.ends_at is not null
      and o.ends_at > o.starts_at
      and s.status = 'accepted'
      and m.status = 'accepted'
    union all
    select o.ends_at as transition_at
    from public.store_offers o
    join public.stores s on s.id = o.store_id
    join public.merchants m on m.id = s.merchant_id
    where o.is_active
      and o.starts_at <= statement_timestamp()
      and o.ends_at > statement_timestamp()
      and s.status = 'accepted'
      and m.status = 'accepted'
  ) transitions;
$$;

create or replace function public.save_store_offer_v2(
  selected_offer uuid,
  input_title text,
  input_description text,
  input_type public.store_offer_type,
  input_discount_method public.offer_discount_method,
  input_discount_value numeric,
  input_bundle_price numeric,
  input_starts_at timestamptz,
  input_ends_at timestamptz,
  input_is_active boolean,
  input_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_offer uuid;
begin
  if input_starts_at is null then
    raise exception 'offer start is required';
  end if;

  -- Every new offer has a bounded period. Existing legacy offers may only
  -- remain unbounded while stopped, so they can be preserved and repaired.
  if (selected_offer is null or coalesce(input_is_active, true)) and input_ends_at is null then
    raise exception 'active and new offers require an end';
  end if;
  if input_ends_at is not null and input_ends_at <= input_starts_at then
    raise exception 'offer end must be after start';
  end if;
  if coalesce(input_is_active, true) and input_ends_at <= statement_timestamp() then
    raise exception 'active offer end must be in the future';
  end if;

  -- Reuse the established product, quantity, type and price validation.
  saved_offer := public.save_store_offer(
    selected_offer,
    input_title,
    input_description,
    input_type,
    input_discount_method,
    input_discount_value,
    input_bundle_price,
    input_ends_at,
    input_is_active,
    input_items
  );

  update public.store_offers o
  set starts_at = input_starts_at
  where o.id = saved_offer;

  return saved_offer;
end;
$$;

revoke all on function public.read_customer_active_offers() from public;
revoke all on function public.read_customer_next_offer_transition() from public;
revoke all on function public.save_store_offer_v2(uuid,text,text,public.store_offer_type,public.offer_discount_method,numeric,numeric,timestamptz,timestamptz,boolean,jsonb) from public;

grant execute on function public.read_customer_active_offers() to anon, authenticated;
grant execute on function public.read_customer_next_offer_transition() to anon, authenticated;
grant execute on function public.save_store_offer_v2(uuid,text,text,public.store_offer_type,public.offer_discount_method,numeric,numeric,timestamptz,timestamptz,boolean,jsonb) to authenticated;

comment on function public.read_customer_active_offers() is
  'Server-clock filtered customer offers. Scheduled, stopped and expired rows are excluded; legacy active rows with no end remain compatible.';
comment on function public.read_customer_next_offer_transition() is
  'Next server-clock start or end boundary without exposing scheduled offer details.';
comment on function public.save_store_offer_v2(uuid,text,text,public.store_offer_type,public.offer_discount_method,numeric,numeric,timestamptz,timestamptz,boolean,jsonb) is
  'Bounded-period offer save contract. New/active offers require starts_at and ends_at; stopped legacy rows may remain unbounded until repaired.';
