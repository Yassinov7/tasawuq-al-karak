-- Merchant renewal lifecycle: future plan selection, manual and scheduled
-- renewals, a seven-day grace period, and server-side order eligibility.
-- No historical periods, invoices, or ledger entries are backfilled.

begin;

-- A NULL actor denotes a database-scheduled event, rather than attributing it
-- incorrectly to a merchant or an arbitrary administrator.
alter table public.merchant_financial_audit_events
  alter column actor_id drop not null;

create table public.merchant_subscription_plan_changes (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  plan_name_snapshot text not null,
  duration_months integer not null check (duration_months between 1 and 60),
  price_snapshot numeric(14,2) not null check (price_snapshot > 0),
  currency_snapshot public.currency_code not null,
  idempotency_key uuid not null unique,
  selected_by uuid not null references public.profiles(id) on delete restrict,
  selected_at timestamptz not null default now(),
  superseded_at timestamptz,
  consumed_by_subscription uuid references public.merchant_subscriptions(id) on delete restrict,
  check (not (superseded_at is not null and consumed_by_subscription is not null))
);
create unique index merchant_subscription_plan_changes_one_pending_idx
  on public.merchant_subscription_plan_changes (merchant_id)
  where superseded_at is null and consumed_by_subscription is null;

alter table public.merchant_subscription_plan_changes enable row level security;
revoke all on table public.merchant_subscription_plan_changes from anon, authenticated;
grant select on table public.merchant_subscription_plan_changes to authenticated;
create policy merchant_subscription_plan_changes_read
  on public.merchant_subscription_plan_changes
  for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.merchants m
    where m.id = merchant_id and m.owner_user_id = auth.uid()
  ));

-- A store can remain public and accept new orders for seven complete days after
-- its latest period that has actually started ends. A future period cannot make
-- a store available before its own starts_at. Owner/admin paths are handled by
-- RLS policies separately, so expiry never removes administrative access.
create function public.store_accepts_new_orders(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores s
    join public.merchants m on m.id = s.merchant_id
    where s.id = target_store
      and s.status = 'accepted'
      and m.status = 'accepted'
      and now() < coalesce((
        select ms.expires_at + interval '7 days'
        from public.merchant_subscriptions ms
        where ms.merchant_id = s.merchant_id
          and ms.starts_at <= now()
        order by ms.expires_at desc, ms.id desc
        limit 1
      ), '-infinity'::timestamptz)
  );
$$;

create function public.subscription_renewal_internal(
  target_merchant uuid,
  renewal_idempotency_key uuid,
  require_credit boolean,
  audit_actor uuid,
  audit_event_type text,
  audit_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  merchant_id_value uuid;
  previous_subscription public.merchant_subscriptions%rowtype;
  scheduled_change public.merchant_subscription_plan_changes%rowtype;
  invoice_row public.subscription_invoices%rowtype;
  credit_row public.merchant_credit_limits%rowtype;
  financial_position record;
  next_subscription_id uuid;
  period_starts_at timestamptz;
  period_expires_at timestamptz;
  chosen_plan_id uuid;
  chosen_plan_name text;
  chosen_duration integer;
  chosen_price numeric(14,2);
  chosen_currency public.currency_code;
begin
  if renewal_idempotency_key is null then
    raise exception 'renewal idempotency key is required';
  end if;
  if audit_event_type not in ('subscription_renewed_manually', 'subscription_renewed_automatically') then
    raise exception 'invalid renewal audit event type';
  end if;

  select m.id into merchant_id_value
  from public.merchants m
  where m.id = target_merchant and m.status = 'accepted'
  for update;
  if not found then
    raise exception 'accepted merchant not found';
  end if;

  -- The invoice key is the idempotency root. A committed retry returns the
  -- same period and can never create another invoice or ledger entry.
  select i.* into invoice_row
  from public.subscription_invoices i
  where i.idempotency_key = renewal_idempotency_key
  for update;
  if found then
    if invoice_row.merchant_id <> target_merchant or invoice_row.kind <> 'renewal' then
      raise exception 'renewal idempotency key was reused with different renewal details';
    end if;
    return invoice_row.subscription_id;
  end if;

  select * into previous_subscription
  from public.merchant_subscriptions ms
  where ms.merchant_id = target_merchant
  order by ms.expires_at desc, ms.id desc
  limit 1
  for update;
  if not found then
    raise exception 'merchant has no subscription period to renew';
  end if;

  -- The scheduler can select an overdue period just before a manual renewal
  -- creates a future one. This runs while the merchant row is locked, so an
  -- automatic run never extends the latest period before that period is due.
  if require_credit and previous_subscription.expires_at > now() then
    raise exception 'automatic renewal is not due for the latest subscription period';
  end if;

  select * into scheduled_change
  from public.merchant_subscription_plan_changes c
  where c.merchant_id = target_merchant
    and c.superseded_at is null
    and c.consumed_by_subscription is null
  order by c.selected_at desc, c.id desc
  limit 1
  for update;

  if found then
    chosen_plan_id := scheduled_change.plan_id;
    chosen_plan_name := scheduled_change.plan_name_snapshot;
    chosen_duration := scheduled_change.duration_months;
    chosen_price := scheduled_change.price_snapshot;
    chosen_currency := scheduled_change.currency_snapshot;
  else
    chosen_plan_id := previous_subscription.plan_id;
    chosen_plan_name := previous_subscription.plan_name_snapshot;
    chosen_duration := previous_subscription.duration_months;
    chosen_price := previous_subscription.price_snapshot;
    chosen_currency := previous_subscription.currency_snapshot;
  end if;

  if chosen_currency::text not in ('SYP', 'USD') then
    raise exception 'subscription renewals support SYP and USD only';
  end if;

  if require_credit then
    select * into credit_row
    from public.merchant_credit_limits l
    where l.merchant_id = target_merchant and l.currency = chosen_currency
    for update;
    if not found or not credit_row.credit_enabled then
      raise exception 'automatic renewal requires enabled merchant credit';
    end if;

    select * into financial_position
    from public.merchant_financial_positions p
    where p.merchant_id = target_merchant and p.currency = chosen_currency;
    if not found
       or financial_position.effective_exposure + chosen_price > credit_row.credit_limit then
      raise exception 'automatic renewal would exceed the merchant credit limit';
    end if;
  end if;

  -- Never backdate a newly issued renewal. Early manual renewal starts when
  -- the current period ends; a late renewal starts at the current instant.
  period_starts_at := greatest(previous_subscription.expires_at, now());
  period_expires_at := period_starts_at + make_interval(months => chosen_duration);

  insert into public.merchant_subscriptions(
    merchant_id, plan_id, plan_name_snapshot, duration_months,
    price_snapshot, currency_snapshot, starts_at, expires_at
  ) values (
    target_merchant, chosen_plan_id, chosen_plan_name, chosen_duration,
    chosen_price, chosen_currency, period_starts_at, period_expires_at
  ) returning id into next_subscription_id;

  insert into public.subscription_invoices(
    invoice_number, merchant_id, subscription_id, kind, currency,
    total_amount, due_at, status, idempotency_key
  ) values (
    'SUB-RENEW-' || next_subscription_id::text,
    target_merchant, next_subscription_id, 'renewal', chosen_currency,
    chosen_price, now(), 'open', renewal_idempotency_key
  ) returning * into invoice_row;

  insert into public.merchant_ledger_entries(
    merchant_id, currency, effect, source_type, source_id, amount
  ) values (
    target_merchant, chosen_currency, 'increase_exposure',
    'subscription_invoice', invoice_row.id, chosen_price
  );

  if scheduled_change.id is not null then
    update public.merchant_subscription_plan_changes
    set consumed_by_subscription = next_subscription_id
    where id = scheduled_change.id;
  end if;

  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    target_merchant, audit_actor, audit_event_type, nullif(trim(audit_reason), ''),
    jsonb_build_object('previous_subscription_id', previous_subscription.id),
    jsonb_build_object(
      'subscription_id', next_subscription_id,
      'invoice_id', invoice_row.id,
      'currency', chosen_currency,
      'amount', chosen_price,
      'starts_at', period_starts_at,
      'expires_at', period_expires_at,
      'plan_change_id', scheduled_change.id
    )
  );

  return next_subscription_id;
end;
$$;

create function public.renew_merchant_subscription(
  target_merchant uuid,
  renewal_idempotency_key uuid,
  renewal_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  return public.subscription_renewal_internal(
    target_merchant,
    renewal_idempotency_key,
    false,
    auth.uid(),
    'subscription_renewed_manually',
    renewal_reason
  );
end;
$$;

create function public.schedule_merchant_subscription_plan_change(
  target_merchant uuid,
  target_plan uuid,
  change_idempotency_key uuid,
  change_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_row public.subscription_plans%rowtype;
  existing_change public.merchant_subscription_plan_changes%rowtype;
  merchant_id_value uuid;
  change_id_value uuid;
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  if change_idempotency_key is null then
    raise exception 'plan-change idempotency key is required';
  end if;
  select m.id into merchant_id_value
  from public.merchants m
  where m.id = target_merchant and m.status = 'accepted'
  for update;
  if not found then
    raise exception 'accepted merchant not found';
  end if;

  select * into existing_change
  from public.merchant_subscription_plan_changes c
  where c.idempotency_key = change_idempotency_key
  for update;
  if found then
    if existing_change.merchant_id <> target_merchant or existing_change.plan_id <> target_plan then
      raise exception 'plan-change idempotency key was reused with different details';
    end if;
    return existing_change.id;
  end if;

  select * into plan_row
  from public.subscription_plans p
  where p.id = target_plan and p.is_active
  for share;
  if not found then
    raise exception 'selected subscription plan is unavailable';
  end if;
  if plan_row.currency::text not in ('SYP', 'USD') then
    raise exception 'subscription plans must use SYP or USD';
  end if;

  update public.merchant_subscription_plan_changes
  set superseded_at = now()
  where merchant_id = target_merchant
    and superseded_at is null
    and consumed_by_subscription is null;

  insert into public.merchant_subscription_plan_changes(
    merchant_id, plan_id, plan_name_snapshot, duration_months,
    price_snapshot, currency_snapshot, idempotency_key, selected_by
  ) values (
    target_merchant, plan_row.id, plan_row.name, plan_row.duration_months,
    plan_row.price, plan_row.currency, change_idempotency_key, auth.uid()
  ) returning id into change_id_value;

  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, after_data
  ) values (
    target_merchant, auth.uid(), 'subscription_plan_change_scheduled',
    nullif(trim(change_reason), ''),
    jsonb_build_object(
      'plan_change_id', change_id_value,
      'plan_id', plan_row.id,
      'plan_name', plan_row.name,
      'duration_months', plan_row.duration_months,
      'price', plan_row.price,
      'currency', plan_row.currency
    )
  );

  return change_id_value;
end;
$$;

create function public.set_merchant_auto_renew(
  target_merchant uuid,
  enabled boolean,
  change_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_value jsonb;
  after_value jsonb;
  merchant_id_value uuid;
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  select m.id into merchant_id_value
  from public.merchants m
  where m.id = target_merchant and m.status = 'accepted'
  for update;
  if not found then
    raise exception 'accepted merchant not found';
  end if;

  select to_jsonb(b) into before_value
  from public.merchant_billing_settings b
  where b.merchant_id = target_merchant
  for update;

  insert into public.merchant_billing_settings(merchant_id, auto_renew, updated_at)
  values (target_merchant, enabled, now())
  on conflict (merchant_id) do update
  set auto_renew = excluded.auto_renew,
      updated_at = excluded.updated_at;

  select to_jsonb(b) into after_value
  from public.merchant_billing_settings b
  where b.merchant_id = target_merchant;

  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    target_merchant, auth.uid(), 'merchant_auto_renew_updated',
    nullif(trim(change_reason), ''), before_value, after_value
  );
end;
$$;

-- This RPC is intended only for a trusted scheduler/service role. It is safe
-- to run repeatedly: each due period gets a deterministic renewal key derived
-- from that period's UUID, and the renewal helper locks the merchant row.
create function public.process_due_merchant_subscription_renewals(
  batch_limit integer default 50
)
returns table (renewed_count integer, skipped_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  automatic_key uuid;
begin
  if batch_limit is null or batch_limit < 1 or batch_limit > 100 then
    raise exception 'batch limit must be between 1 and 100';
  end if;
  renewed_count := 0;
  skipped_count := 0;

  for candidate in
    select ms.merchant_id, ms.id as subscription_id
    from public.merchant_billing_settings b
    join lateral (
      select s.id, s.merchant_id, s.expires_at
      from public.merchant_subscriptions s
      where s.merchant_id = b.merchant_id
      order by s.expires_at desc, s.id desc
      limit 1
    ) ms on true
    join public.merchants m on m.id = ms.merchant_id and m.status = 'accepted'
    where b.auto_renew and ms.expires_at <= now()
    order by ms.expires_at, ms.id
    limit batch_limit
  loop
    automatic_key := (
      substr(md5('tasawuq:subscription-renewal:auto:' || candidate.subscription_id::text), 1, 8)
      || '-' || substr(md5('tasawuq:subscription-renewal:auto:' || candidate.subscription_id::text), 9, 4)
      || '-' || substr(md5('tasawuq:subscription-renewal:auto:' || candidate.subscription_id::text), 13, 4)
      || '-' || substr(md5('tasawuq:subscription-renewal:auto:' || candidate.subscription_id::text), 17, 4)
      || '-' || substr(md5('tasawuq:subscription-renewal:auto:' || candidate.subscription_id::text), 21, 12)
    )::uuid;
    begin
      perform public.subscription_renewal_internal(
        candidate.merchant_id,
        automatic_key,
        true,
        null,
        'subscription_renewed_automatically',
        'scheduled automatic renewal'
      );
      renewed_count := renewed_count + 1;
    exception when others then
      skipped_count := skipped_count + 1;
      insert into public.merchant_financial_audit_events(
        merchant_id, actor_id, event_type, reason, after_data
      ) values (
        candidate.merchant_id, null, 'subscription_auto_renewal_skipped',
        sqlerrm,
        jsonb_build_object('subscription_id', candidate.subscription_id)
      );
    end;
  end loop;
  return next;
end;
$$;

-- Enforce the grace policy at the write boundary. Existing orders never pass
-- through this trigger, so their fulfillment and delivery remain unaffected.
create function public.reject_store_order_after_subscription_grace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.store_accepts_new_orders(new.store_id) then
    raise exception 'store is unavailable for new orders because its subscription grace period has ended';
  end if;
  return new;
end;
$$;

create trigger store_orders_subscription_grace_before_insert
  before insert on public.store_orders
  for each row execute function public.reject_store_order_after_subscription_grace();

-- Public catalog access ends after grace; the merchant owner and admins keep
-- their administrative access to stores, products, offers, and media.
drop policy if exists stores_read_accepted_public on public.stores;
create policy stores_read_accepted_public
  on public.stores for select to anon, authenticated
  using (
    (public.store_accepts_new_orders(id))
    or public.is_admin()
    or exists (
      select 1 from public.merchants m
      where m.id = merchant_id and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists products_read_available_owner_admin on public.products;
create policy products_read_available_owner_admin
  on public.products for select to anon, authenticated
  using (
    (is_available and public.store_accepts_new_orders(store_id))
    or public.is_admin()
    or exists (
      select 1 from public.stores s
      join public.merchants m on m.id = s.merchant_id
      where s.id = store_id and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists product_media_read_public_owner on public.product_media;
create policy product_media_read_public_owner
  on public.product_media for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.is_available
        and public.store_accepts_new_orders(p.store_id)
    )
    or public.is_admin()
    or exists (
      select 1 from public.stores s
      join public.merchants m on m.id = s.merchant_id
      where s.id = store_id and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists offers_read_active_owner_admin on public.store_offers;
create policy offers_read_active_owner_admin
  on public.store_offers for select to anon, authenticated
  using (
    (is_active and starts_at <= now() and (ends_at is null or ends_at > now())
      and public.store_accepts_new_orders(store_id))
    or public.is_admin()
    or exists (
      select 1 from public.stores s
      join public.merchants m on m.id = s.merchant_id
      where s.id = store_id and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists offer_products_read_public_owner on public.store_offer_products;
create policy offer_products_read_public_owner
  on public.store_offer_products for select to anon, authenticated
  using (
    exists (
      select 1 from public.store_offers o
      where o.id = offer_id and o.is_active and o.starts_at <= now()
        and (o.ends_at is null or o.ends_at > now())
        and public.store_accepts_new_orders(o.store_id)
    )
    or public.is_admin()
    or exists (
      select 1 from public.stores s
      join public.merchants m on m.id = s.merchant_id
      where s.id = store_id and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists offer_media_read_public_owner on public.store_offer_media;
create policy offer_media_read_public_owner
  on public.store_offer_media for select to anon, authenticated
  using (
    exists (
      select 1 from public.store_offers o
      where o.id = offer_id and o.is_active and o.starts_at <= now()
        and (o.ends_at is null or o.ends_at > now())
        and public.store_accepts_new_orders(o.store_id)
    )
    or public.is_admin()
    or exists (
      select 1 from public.stores s
      join public.merchants m on m.id = s.merchant_id
      where s.id = store_id and m.owner_user_id = auth.uid()
    )
  );

-- PostgreSQL combines permissive policies with OR. These restrictive gates
-- constrain every SELECT policy applicable to anonymous/authenticated users,
-- including the pre-existing owner-management policies. That prevents any
-- older permissive policy from exposing a catalog after the grace period,
-- while retaining owner and administrator access.
drop policy if exists stores_subscription_grace_read_gate on public.stores;
create policy stores_subscription_grace_read_gate
  on public.stores as restrictive for select to anon, authenticated
  using (
    public.store_accepts_new_orders(id)
    or public.is_admin()
    or exists (
      select 1
      from public.merchants m
      where m.id = merchant_id and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists products_subscription_grace_read_gate on public.products;
create policy products_subscription_grace_read_gate
  on public.products as restrictive for select to anon, authenticated
  using (
    public.store_accepts_new_orders(store_id)
    or public.is_admin()
    or exists (
      select 1
      from public.stores s
      join public.merchants m on m.id = s.merchant_id
      where s.id = products.store_id and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists product_media_subscription_grace_read_gate on public.product_media;
create policy product_media_subscription_grace_read_gate
  on public.product_media as restrictive for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_media.product_id
        and public.store_accepts_new_orders(p.store_id)
    )
    or public.is_admin()
    or exists (
      select 1
      from public.stores s
      join public.merchants m on m.id = s.merchant_id
      where s.id = product_media.store_id and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists store_offers_subscription_grace_read_gate on public.store_offers;
create policy store_offers_subscription_grace_read_gate
  on public.store_offers as restrictive for select to anon, authenticated
  using (
    public.store_accepts_new_orders(store_id)
    or public.is_admin()
    or exists (
      select 1
      from public.stores s
      join public.merchants m on m.id = s.merchant_id
      where s.id = store_offers.store_id
        and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists store_offer_products_subscription_grace_read_gate on public.store_offer_products;
create policy store_offer_products_subscription_grace_read_gate
  on public.store_offer_products as restrictive for select to anon, authenticated
  using (
    exists (
      select 1
      from public.store_offers so
      where so.id = store_offer_products.offer_id
        and public.store_accepts_new_orders(so.store_id)
    )
    or public.is_admin()
    or exists (
      select 1
      from public.stores s
      join public.merchants m on m.id = s.merchant_id
      where s.id = store_offer_products.store_id and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists store_offer_media_subscription_grace_read_gate on public.store_offer_media;
create policy store_offer_media_subscription_grace_read_gate
  on public.store_offer_media as restrictive for select to anon, authenticated
  using (
    exists (
      select 1
      from public.store_offers so
      where so.id = store_offer_media.offer_id
        and public.store_accepts_new_orders(so.store_id)
    )
    or public.is_admin()
    or exists (
      select 1
      from public.stores s
      join public.merchants m on m.id = s.merchant_id
      where s.id = store_offer_media.store_id and m.owner_user_id = auth.uid()
    )
  );

-- Internal helpers cannot be reached through PostgREST. Manual operations
-- still perform an explicit administrator check; automatic processing is only
-- executable by a trusted service role or the database scheduler owner.
revoke all on function public.subscription_renewal_internal(uuid, uuid, boolean, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.process_due_merchant_subscription_renewals(integer)
  from public, anon, authenticated;
revoke all on function public.reject_store_order_after_subscription_grace()
  from public, anon, authenticated;
revoke all on function public.store_accepts_new_orders(uuid) from public;
grant execute on function public.store_accepts_new_orders(uuid) to anon, authenticated;

revoke all on function public.renew_merchant_subscription(uuid, uuid, text)
  from public, anon;
revoke all on function public.schedule_merchant_subscription_plan_change(uuid, uuid, uuid, text)
  from public, anon;
revoke all on function public.set_merchant_auto_renew(uuid, boolean, text)
  from public, anon;
grant execute on function public.renew_merchant_subscription(uuid, uuid, text) to authenticated;
grant execute on function public.schedule_merchant_subscription_plan_change(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.set_merchant_auto_renew(uuid, boolean, text) to authenticated;
grant execute on function public.process_due_merchant_subscription_renewals(integer) to service_role;

commit;
