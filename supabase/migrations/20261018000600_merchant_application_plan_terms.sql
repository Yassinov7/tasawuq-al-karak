-- Plan selection is captured at merchant-application submission, then checked
-- again at approval. Existing applications remain untouched and are never
-- assigned inferred terms.

begin;

alter table public.subscription_plans
  add column product_limit integer check (product_limit >= 0),
  add column features jsonb check (features is null or jsonb_typeof(features) = 'array');

alter table public.merchant_applications
  add column plan_commission_rate_snapshot numeric(7,4)
    check (plan_commission_rate_snapshot >= 0 and plan_commission_rate_snapshot <= 100),
  add column plan_product_limit_snapshot integer check (plan_product_limit_snapshot >= 0),
  add column plan_features_snapshot jsonb
    check (plan_features_snapshot is null or jsonb_typeof(plan_features_snapshot) = 'array');

create or replace function public.submit_merchant_application(
  selected_plan uuid,
  input_contact_phone text,
  input_store_name text,
  input_store_description text,
  input_store_address text,
  selected_store_category uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  plan_row public.subscription_plans%rowtype;
  application_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = current_user_id and p.role = 'merchant'
  ) then
    raise exception 'merchant account required';
  end if;
  if exists (
    select 1 from public.merchants m where m.owner_user_id = current_user_id
  ) then
    raise exception 'merchant account is already approved';
  end if;
  if nullif(trim(input_contact_phone), '') is null
     or nullif(trim(input_store_name), '') is null
     or nullif(trim(input_store_address), '') is null
     or selected_store_category is null then
    raise exception 'required merchant and store details are missing';
  end if;

  select * into plan_row
  from public.subscription_plans p
  where p.id = selected_plan
    and p.is_active
    and p.commission_rate is not null
    and p.product_limit is not null
    and p.features is not null
    and jsonb_typeof(p.features) = 'array'
  for share;
  if not found then
    raise exception 'selected subscription plan is unavailable or incomplete';
  end if;

  insert into public.merchant_applications(
    user_id, plan_id, plan_name_snapshot, plan_duration_months_snapshot,
    plan_price_snapshot, plan_currency_snapshot, plan_commission_rate_snapshot,
    plan_product_limit_snapshot, plan_features_snapshot, category_id,
    contact_phone, store_name, store_description, store_address
  ) values (
    current_user_id, plan_row.id, plan_row.name, plan_row.duration_months,
    plan_row.price, plan_row.currency, plan_row.commission_rate,
    plan_row.product_limit, plan_row.features, selected_store_category,
    trim(input_contact_phone), trim(input_store_name),
    coalesce(trim(input_store_description), ''), trim(input_store_address)
  )
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    plan_name_snapshot = excluded.plan_name_snapshot,
    plan_duration_months_snapshot = excluded.plan_duration_months_snapshot,
    plan_price_snapshot = excluded.plan_price_snapshot,
    plan_currency_snapshot = excluded.plan_currency_snapshot,
    plan_commission_rate_snapshot = excluded.plan_commission_rate_snapshot,
    plan_product_limit_snapshot = excluded.plan_product_limit_snapshot,
    plan_features_snapshot = excluded.plan_features_snapshot,
    category_id = excluded.category_id,
    contact_phone = excluded.contact_phone,
    store_name = excluded.store_name,
    store_description = excluded.store_description,
    store_address = excluded.store_address,
    status = 'pending',
    review_note = null,
    reviewed_by = null,
    reviewed_at = null,
    submitted_at = now()
  where public.merchant_applications.status in ('rejected', 'changes_requested')
  returning id into application_id;

  if application_id is null then
    raise exception 'merchant application is already awaiting review';
  end if;
  return application_id;
end;
$$;

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
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if decision not in ('accepted', 'rejected', 'changes_requested') then raise exception 'invalid review decision'; end if;
  select * into application_row from public.merchant_applications
    where id = target_application for update;
  if not found then raise exception 'merchant application not found'; end if;
  if application_row.status = 'accepted' then
    if exists (select 1 from public.merchants m where m.owner_user_id = application_row.user_id) then return; end if;
    raise exception 'accepted merchant application is not provisioned; manual reconciliation required';
  end if;
  if application_row.status not in ('pending', 'changes_requested', 'rejected') then
    raise exception 'merchant application is not available for review';
  end if;
  if decision <> 'accepted' then
    update public.merchant_applications set status = decision,
      review_note = nullif(trim(decision_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
    where id = target_application;
    return;
  end if;
  if exists (select 1 from public.merchants m where m.owner_user_id = application_row.user_id) then
    raise exception 'merchant is already provisioned';
  end if;

  select * into plan_row from public.subscription_plans p
  where p.id = application_row.plan_id and p.is_active
    and p.commission_rate is not null and p.product_limit is not null
    and p.features is not null and jsonb_typeof(p.features) = 'array'
  for share;
  if not found
     or application_row.plan_commission_rate_snapshot is null
     or application_row.plan_product_limit_snapshot is null
     or application_row.plan_features_snapshot is null
     or plan_row.name <> application_row.plan_name_snapshot
     or plan_row.duration_months <> application_row.plan_duration_months_snapshot
     or plan_row.price <> application_row.plan_price_snapshot
     or plan_row.currency <> application_row.plan_currency_snapshot
     or plan_row.commission_rate <> application_row.plan_commission_rate_snapshot
     or plan_row.product_limit <> application_row.plan_product_limit_snapshot
     or plan_row.features <> application_row.plan_features_snapshot then
    raise exception 'selected subscription plan is unavailable, incomplete, or no longer matches the application snapshot';
  end if;

  subscription_id_value := application_row.id;
  invoice_id_value := application_row.id;
  insert into public.merchants(owner_user_id, contact_phone, status)
  values (application_row.user_id, application_row.contact_phone, 'accepted')
  returning id into merchant_id_value;
  insert into public.stores(merchant_id, name, description, phone, address, category_id, status)
  values (merchant_id_value, application_row.store_name, application_row.store_description,
    application_row.contact_phone, application_row.store_address, application_row.category_id, 'accepted');
  insert into public.merchant_subscriptions(
    id, merchant_id, plan_id, plan_name_snapshot, duration_months,
    price_snapshot, currency_snapshot, starts_at, expires_at
  ) values (
    subscription_id_value, merchant_id_value, plan_row.id, plan_row.name,
    plan_row.duration_months, plan_row.price, plan_row.currency,
    now(), now() + make_interval(months => plan_row.duration_months)
  );
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
  insert into public.merchant_billing_settings(merchant_id, auto_renew)
  values (merchant_id_value, false);
  insert into public.wallets(user_id, currency, balance)
  values (application_row.user_id, plan_row.currency, 0)
  on conflict (user_id, currency) do nothing;
  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    merchant_id_value, auth.uid(), 'initial_subscription_activated',
    'first merchant approval', jsonb_build_object('application_id', application_row.id),
    jsonb_build_object(
      'subscription_id', subscription_id_value, 'invoice_id', invoice_id_value,
      'currency', plan_row.currency, 'amount', plan_row.price,
      'commission_rate', plan_row.commission_rate, 'product_limit', plan_row.product_limit,
      'features', plan_row.features, 'auto_renew', false, 'credit_enabled', false
    )
  );
  update public.merchant_applications set status = 'accepted', review_note = null,
    reviewed_by = auth.uid(), reviewed_at = now() where id = target_application;
end;
$$;

revoke all on function public.submit_merchant_application(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.submit_merchant_application(uuid, text, text, text, text, uuid) to authenticated;
revoke all on function public.review_merchant_application(uuid, public.application_status, text) from public, anon;
grant execute on function public.review_merchant_application(uuid, public.application_status, text) to authenticated;

commit;
