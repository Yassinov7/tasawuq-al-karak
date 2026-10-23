-- First merchant approval: provision the merchant/store/current subscription,
-- issue one unpaid initial invoice, and record one outstanding ledger entry.
-- Requires 20261018000100_financial_foundation.sql. No historical backfill.

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
  plan_row public.subscription_plans%rowtype;
  merchant_id_value uuid;
  subscription_id_value uuid;
  invoice_id_value uuid;
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;

  if decision not in ('accepted', 'rejected', 'changes_requested') then
    raise exception 'invalid review decision';
  end if;

  select * into application_row
  from public.merchant_applications
  where id = target_application
  for update;

  if not found then
    raise exception 'merchant application not found';
  end if;

  -- This gate intentionally treats every previously accepted application the
  -- same way: a retry of a current approval and a legacy approval both return
  -- without creating a financial backfill. A current approval commits all
  -- financial records atomically below; an accepted application without its
  -- merchant is an inconsistency that requires manual reconciliation.
  if application_row.status = 'accepted' then
    if exists (
      select 1 from public.merchants m where m.owner_user_id = application_row.user_id
    ) then
      return;
    end if;
    raise exception 'accepted merchant application is not provisioned; manual reconciliation required';
  end if;

  if application_row.status not in ('pending', 'changes_requested', 'rejected') then
    raise exception 'merchant application is not available for review';
  end if;

  -- The application ID is a stable idempotency root. IDs are table-scoped, so
  -- reusing it for the initial period and invoice is safe and repeatable.
  subscription_id_value := application_row.id;
  invoice_id_value := application_row.id;

  if decision <> 'accepted' then
    update public.merchant_applications
    set status = decision,
        review_note = nullif(trim(decision_note), ''),
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = target_application;
    return;
  end if;

  if exists (
    select 1 from public.merchants m where m.owner_user_id = application_row.user_id
  ) then
    raise exception 'merchant is already provisioned';
  end if;

  -- Approval uses the submitted snapshot only if it still matches an active,
  -- valid plan at activation time. A changed plan requires a new application.
  select * into plan_row
  from public.subscription_plans p
  where p.id = application_row.plan_id and p.is_active
  for share;

  if not found
     or plan_row.name <> application_row.plan_name_snapshot
     or plan_row.duration_months <> application_row.plan_duration_months_snapshot
     or plan_row.price <> application_row.plan_price_snapshot
     or plan_row.currency <> application_row.plan_currency_snapshot then
    raise exception 'selected subscription plan no longer matches the application snapshot';
  end if;

  insert into public.merchants(owner_user_id, contact_phone, status)
  values (application_row.user_id, application_row.contact_phone, 'accepted')
  returning id into merchant_id_value;

  insert into public.stores(
    merchant_id, name, description, phone, address, category_id, status
  ) values (
    merchant_id_value, application_row.store_name, application_row.store_description,
    application_row.contact_phone, application_row.store_address,
    application_row.category_id, 'accepted'
  );

  insert into public.merchant_subscriptions(
    id, merchant_id, plan_id, plan_name_snapshot, duration_months,
    price_snapshot, currency_snapshot, starts_at, expires_at
  ) values (
    subscription_id_value, merchant_id_value, plan_row.id, plan_row.name,
    plan_row.duration_months, plan_row.price, plan_row.currency,
    now(), now() + make_interval(months => plan_row.duration_months)
  );

  -- Initial activation is allowed before collection, but creates an open debt.
  -- The stable key is the subscription UUID; retries after a rollback reuse no
  -- partial state, and committed retries return at the accepted-application gate.
  insert into public.subscription_invoices(
    id, invoice_number, merchant_id, subscription_id, kind, currency,
    total_amount, due_at, status, idempotency_key
  ) values (
    invoice_id_value, 'SUB-INITIAL-' || subscription_id_value::text,
    merchant_id_value, subscription_id_value, 'initial', plan_row.currency,
    plan_row.price, now(), 'open', subscription_id_value
  );

  insert into public.merchant_ledger_entries(
    merchant_id, currency, effect, source_type, source_id, amount
  ) values (
    merchant_id_value, plan_row.currency, 'increase_exposure',
    'subscription_invoice', invoice_id_value, plan_row.price
  );

  -- Defaults intentionally keep auto-renew and credit disabled.
  insert into public.merchant_billing_settings(merchant_id, auto_renew)
  values (merchant_id_value, false);

  insert into public.wallets(user_id, currency, balance)
  values (application_row.user_id, plan_row.currency, 0)
  on conflict (user_id, currency) do nothing;

  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    merchant_id_value, auth.uid(), 'initial_subscription_activated',
    'first merchant approval',
    jsonb_build_object('application_id', application_row.id),
    jsonb_build_object(
      'subscription_id', subscription_id_value,
      'invoice_id', invoice_id_value,
      'currency', plan_row.currency,
      'amount', plan_row.price,
      'auto_renew', false,
      'credit_enabled', false
    )
  );

  update public.merchant_applications
  set status = 'accepted',
      review_note = null,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = target_application;
end;
$$;

revoke all on function public.review_merchant_application(
  uuid, public.application_status, text
) from public, anon;
grant execute on function public.review_merchant_application(
  uuid, public.application_status, text
) to authenticated;
