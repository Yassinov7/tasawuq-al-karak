-- Fix customer order cancellation rules and merchant wallet initialization.
--
-- Rules:
-- 1. A customer may cancel while no store has started preparation.
-- 2. Rejected/cancelled store orders do not mean preparation has started.
-- 3. Once any store order reaches preparing or a later active state,
--    customer cancellation is blocked.
-- 4. Accepting a merchant creates an empty wallet only.
-- 5. Merchant subscription price is never credited to the wallet.
--
-- Important:
-- We intentionally do NOT rewrite historical wallet transaction balances here.
-- Existing financial history must not be silently recalculated or changed.

-- ============================================================
-- 1. Fix customer order cancellation
-- ============================================================

create or replace function public.cancel_customer_order(
  target_customer_order uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.customer_orders%rowtype;
begin
  select *
  into order_row
  from public.customer_orders co
  where co.id = target_customer_order
    and co.customer_id = auth.uid()
  for update;

  if not found then
    raise exception 'customer order not found';
  end if;

  /*
   * Customer cancellation is allowed as long as no store has
   * started preparation.
   *
   * These states do NOT mean preparation started:
   * - awaiting_review
   * - rejected
   * - cancelled
   *
   * Any other store-order state means the store has moved beyond
   * the review stage, so customer cancellation is blocked.
   */
  if exists (
    select 1
    from public.store_orders so
    where so.customer_order_id = target_customer_order
      and so.status not in (
        'awaiting_review',
        'rejected',
        'cancelled'
      )
  ) then
    raise exception
      'order cannot be cancelled after store preparation has started';
  end if;

  update public.store_orders
  set status = 'cancelled'
  where customer_order_id = target_customer_order
    and status = 'awaiting_review';

  update public.delivery_tasks
  set status = 'cancelled'
  where customer_order_id = target_customer_order
    and status = 'pending_stores';

  update public.customer_orders
  set status = 'cancelled'
  where id = target_customer_order;
end;
$$;

revoke all
on function public.cancel_customer_order(uuid)
from public, anon;

grant execute
on function public.cancel_customer_order(uuid)
to authenticated;


-- ============================================================
-- 2. Fix merchant application approval
-- ============================================================

create or replace function public.review_merchant_application(
  target_application uuid,
  decision public.application_status,
  decision_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_row public.merchant_applications%rowtype;
  merchant_id_value uuid;
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;

  if decision not in (
    'accepted',
    'rejected',
    'changes_requested'
  ) then
    raise exception 'invalid review decision';
  end if;

  select *
  into application_row
  from public.merchant_applications
  where id = target_application
  for update;

  if not found
     or application_row.status not in (
       'pending',
       'changes_requested',
       'rejected'
     ) then
    raise exception 'merchant application is not available for review';
  end if;

  if decision = 'accepted' then

    if exists (
      select 1
      from public.merchants m
      where m.owner_user_id = application_row.user_id
    ) then
      raise exception 'merchant is already provisioned';
    end if;

    insert into public.merchants(
      owner_user_id,
      contact_phone,
      status
    )
    values (
      application_row.user_id,
      application_row.contact_phone,
      'accepted'
    )
    returning id
    into merchant_id_value;

    insert into public.stores(
      merchant_id,
      name,
      description,
      phone,
      address,
      category_id,
      status
    )
    values (
      merchant_id_value,
      application_row.store_name,
      application_row.store_description,
      application_row.contact_phone,
      application_row.store_address,
      application_row.category_id,
      'accepted'
    );

    insert into public.merchant_subscriptions(
      merchant_id,
      plan_id,
      plan_name_snapshot,
      duration_months,
      price_snapshot,
      currency_snapshot,
      starts_at,
      expires_at
    )
    values (
      merchant_id_value,
      application_row.plan_id,
      application_row.plan_name_snapshot,
      application_row.plan_duration_months_snapshot,
      application_row.plan_price_snapshot,
      application_row.plan_currency_snapshot,
      now(),
      now() + make_interval(
        months => application_row.plan_duration_months_snapshot
      )
    );

    /*
     * Merchant wallet starts empty.
     *
     * The subscription price is stored in
     * merchant_subscriptions.price_snapshot.
     * It is NOT wallet credit.
     */
    insert into public.wallets(
      user_id,
      currency,
      balance
    )
    values (
      application_row.user_id,
      application_row.plan_currency_snapshot,
      0
    )
    on conflict (user_id, currency) do nothing;

    update public.merchant_applications
    set
      status = 'accepted',
      review_note = null,
      reviewed_by = auth.uid(),
      reviewed_at = now()
    where id = target_application;

  else

    update public.merchant_applications
    set
      status = decision,
      review_note = nullif(trim(decision_note), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
    where id = target_application;

  end if;
end;
$$;

revoke all
on function public.review_merchant_application(
  uuid,
  public.application_status,
  text
)
from public, anon;

grant execute
on function public.review_merchant_application(
  uuid,
  public.application_status,
  text
)
to authenticated;