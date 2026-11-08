-- Prerequisite for the first account/catalog migration on a fresh Supabase DB.
-- Existing databases: this validates the type without replacing it or its data.
-- Do not automatically repair remote migration history; see the Phase 11.4.0-D report.
do $$
declare labels text[];
begin
  if to_regtype('public.currency_code') is null then
    create type public.currency_code as enum ('SYP');
  else
    if not exists (select 1 from pg_type where oid = 'public.currency_code'::regtype and typtype = 'e') then
      raise exception 'public.currency_code exists but is not an enum';
    end if;
    select array_agg(enumlabel::text order by enumlabel::text) into labels
      from pg_enum where enumtypid = 'public.currency_code'::regtype;
    if labels is distinct from array['SYP']::text[]
       and labels is distinct from array['SYP','USD']::text[] then
      raise exception 'Unexpected existing currency_code labels: %; manual schema review required', labels;
    end if;
  end if;
end;
$$;

-- The same original baseline also omitted these seven enum definitions.
-- Values match the historical SQL contracts and application enum declarations.
-- Existing types must match; never alter existing onboarding/offer/wallet states.
do $$
declare r record; actual text[]; literals text;
begin
  for r in select * from (values
    ('application_status', array['pending','accepted','rejected','changes_requested']::text[]),
    ('wallet_direction', array['credit','debit']::text[]),
    ('wallet_transaction_type', array['subscription_initialization','funding','settlement','adjustment']::text[]),
    ('store_media_type', array['image','video']::text[]),
    ('store_offer_type', array['discount','bundle','buy_x_get_y']::text[]),
    ('offer_discount_method', array['percentage','fixed_amount']::text[]),
    ('offer_product_role', array['discounted','bundle','buy','reward']::text[])
  ) as required(name, labels) loop
    if to_regtype(format('public.%I',r.name)) is null then
      select string_agg(quote_literal(v),', ' order by ordinal) into literals
      from unnest(r.labels) with ordinality as labels(v,ordinal);
      execute format('create type public.%I as enum (%s)',r.name,literals);
    else
      if not exists(select 1 from pg_type where oid=to_regtype(format('public.%I',r.name)) and typtype='e') then
        raise exception 'public.% is not an enum',r.name;
      end if;
      select array_agg(enumlabel::text order by enumlabel::text) into actual
      from pg_enum where enumtypid=to_regtype(format('public.%I',r.name));
      if actual is distinct from (select array_agg(v order by v) from unnest(r.labels) as labels(v)) then
        raise exception 'Unexpected labels for public.%: %; manual review required',r.name,actual;
      end if;
    end if;
  end loop;
end;
$$;
