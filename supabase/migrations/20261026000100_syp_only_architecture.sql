-- Phase 11.4.0-B. SYP is the only monetary unit. No data conversion/deletion.
-- Initially generated from preceding migrations; hand-reviewed ACL and view dependency fixes follow.
-- Do not regenerate this file with the temporary build script.
begin;
set local lock_timeout = '10s';

-- Serialize migration with all table writers, including service-role writers.
do $$ declare r record; begin
  for r in select c.oid::regclass as relation from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by c.oid
  loop execute format('lock table %s in access exclusive mode',r.relation); end loop;
end; $$;

-- Report offending table/column/row identifiers. NEVER relabel a dollar amount.
do $$ declare r record; bad jsonb; problems jsonb := '[]'; begin
  if to_regtype('public.currency_code') is null then raise exception 'Missing prerequisite public.currency_code; establish the existing schema before applying this migration'; end if;
  for r in select table_name,column_name from information_schema.columns
    where table_schema='public' and (udt_name='currency_code' or column_name in ('currency','currency_snapshot','plan_currency_snapshot','delivery_currency'))
      and table_name in (select tablename from pg_tables where schemaname='public')
  loop
    execute format('select jsonb_agg(jsonb_build_object(''row'', coalesce(to_jsonb(t)->>''id'',to_jsonb(t)->>''user_id'',to_jsonb(t)->>''merchant_id'',to_jsonb(t)->>''store_order_id'',to_jsonb(t)->>''customer_order_id''),''currency'',%I::text)) from public.%I t where %I::text is distinct from ''SYP''',r.column_name,r.table_name,r.column_name) into bad;
    if bad is not null then problems := problems || jsonb_build_object('table',r.table_name,'column',r.column_name,'rows',bad); end if;
  end loop;
  -- Nested offer snapshots and financial audit snapshots are also monetary data.
  for r in select c.table_name,c.column_name from information_schema.columns c join pg_tables t on t.schemaname=c.table_schema and t.tablename=c.table_name where c.table_schema='public' and c.udt_name in ('json','jsonb') loop
    execute format('select jsonb_agg(jsonb_build_object(''row'',to_jsonb(t)->>''id'',''column'',%L)) from public.%I t where jsonb_path_exists(%I::jsonb, ''$.** ? (@.currency != "SYP" || @.currency_snapshot != "SYP" || @.plan_currency_snapshot != "SYP" || @.delivery_currency != "SYP")'')',r.column_name,r.table_name,r.column_name) into bad;
    if bad is not null then problems := problems || jsonb_build_object('table',r.table_name,'rows',bad); end if;
  end loop;
  if jsonb_array_length(problems)>0 then raise exception using message='SYP-only preflight failed: non-SYP development data', detail=problems::text; end if;
end; $$;

-- Preserve effective ACLs before replacing objects. Newly created functions must
-- not inherit PostgreSQL's default PUBLIC EXECUTE privilege.
create temporary table syp_acl on commit drop as
select 'view'::text as kind,c.relname as name,a.grantee,a.privilege_type,a.is_grantable
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
where n.nspname='public' and c.relname in ('merchant_financial_positions','merchant_order_entitlement_positions','driver_cash_custody_positions','merchant_settlement_batch_positions','admin_cash_movement_events','admin_delivery_fee_report_rows','admin_merchant_payout_report_rows','admin_merchant_settlement_report_batches','admin_merchant_financial_report_events','admin_platform_revenue_report_events','merchant_account_sale_rows','merchant_account_settlement_rows')
union all
select 'function',p.proname,a.grantee,a.privilege_type,a.is_grantable
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
where n.nspname='public' and p.proname in ('save_store_offer','record_wallet_transaction','record_subscription_payment','set_merchant_credit_limit','record_driver_cash_remittance','pay_driver_cash_credit','create_merchant_settlement_batch','admin_financial_report','admin_sales_revenue_report','merchant_financial_account');

-- Owners and column ACLs are independent of relation ACLs. Capture them before DROP.
create temporary table syp_view_metadata on commit drop as
select c.relname as name, pg_get_userbyid(c.relowner) as owner_name,
  coalesce(c.reloptions, array[]::text[]) as options
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v'
  and c.relname in ('merchant_financial_positions','merchant_order_entitlement_positions','driver_cash_custody_positions','merchant_settlement_batch_positions','admin_cash_movement_events','admin_delivery_fee_report_rows','admin_merchant_payout_report_rows','admin_merchant_settlement_report_batches','admin_merchant_financial_report_events','admin_platform_revenue_report_events','merchant_account_sale_rows','merchant_account_settlement_rows');
create temporary table syp_view_column_acl on commit drop as
select c.relname as name, att.attname as column_name,
  a.grantee, a.privilege_type, a.is_grantable
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute att on att.attrelid=c.oid and att.attnum>0 and not att.attisdropped
cross join lateral aclexplode(att.attacl) a
where n.nspname='public' and c.relname in (select name from syp_view_metadata);
do $$ begin
  if exists(select 1 from syp_view_metadata where not
    (options @> array['security_invoker=true','security_barrier=true'])) then
    raise exception 'Unexpected view security options; review schema drift before migration';
  end if;
end; $$;
-- Dependent read models must be removed before their bases or currency columns.
-- Catch schema drift before DROP without removing unknown dependent objects.
do $$ declare missing_dependents text; begin
  select string_agg(distinct format('%I.%I depends on public.%I',n.nspname,c.relname,base.name), ', ')
    into missing_dependents
  from syp_view_metadata base
  join pg_namespace bn on bn.nspname='public'
  join pg_class bc on bc.relnamespace=bn.oid and bc.relname=base.name
  join pg_depend d on d.refclassid='pg_class'::regclass and d.refobjid=bc.oid
    and d.classid='pg_rewrite'::regclass
  join pg_rewrite r on r.oid=d.objid
  join pg_class c on c.oid=r.ev_class and c.oid<>bc.oid and c.relkind in ('v','m')
  join pg_namespace n on n.oid=c.relnamespace
  where not exists(select 1 from syp_view_metadata planned where n.nspname='public' and planned.name=c.relname);
  if missing_dependents is not null then
    raise exception 'Unplanned SYP view dependencies; update explicit DROP/CREATE and ACL plan: %',missing_dependents;
  end if;
end; $$;

drop view public.merchant_account_sale_rows;
drop view public.merchant_account_settlement_rows;
drop view public.admin_platform_revenue_report_events;
drop view public.admin_merchant_financial_report_events;
drop view public.admin_merchant_settlement_report_batches;
drop view public.admin_merchant_payout_report_rows;
drop view public.admin_delivery_fee_report_rows;
drop view public.admin_cash_movement_events;
drop view public.merchant_settlement_batch_positions;
drop view public.driver_cash_custody_positions;
drop view public.merchant_order_entitlement_positions;
drop view public.merchant_financial_positions;
do $$ declare r record; begin for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('save_store_offer','record_wallet_transaction','record_subscription_payment','set_merchant_credit_limit','record_driver_cash_remittance','pay_driver_cash_credit','create_merchant_settlement_batch','admin_financial_report','admin_sales_revenue_report','merchant_financial_account') loop execute format('drop function %s',r.signature); end loop; end; $$;
alter table public.wallet_transactions drop constraint wallet_transactions_user_id_currency_fkey;
alter table public.wallets drop constraint wallets_pkey;
alter table public.wallets add primary key(user_id);
alter table public.merchant_credit_limits drop constraint merchant_credit_limits_pkey;
alter table public.merchant_credit_limits add primary key(merchant_id);
alter table public.store_order_totals drop constraint store_order_totals_pkey;
alter table public.store_order_totals add primary key(store_order_id);
alter table public.customer_order_totals drop constraint customer_order_totals_pkey;
alter table public.customer_order_totals add primary key(customer_order_id);
alter table public.customer_order_cash_obligations drop constraint customer_order_cash_obligations_customer_order_id_currency_key;
alter table public.customer_order_cash_obligations add unique(customer_order_id);
alter table public.products drop column currency;
alter table public.store_offers drop column currency;
alter table public.subscription_plans drop column currency;
alter table public.delivery_zones drop column currency;
alter table public.wallets drop column currency;
alter table public.merchant_credit_limits drop column currency;
alter table public.wallet_transactions add foreign key(user_id) references public.wallets(user_id) on delete restrict;
-- Replace, rather than edit pg_enum or retain a dormant USD label.
alter type public.currency_code rename to currency_code_previous;
create type public.currency_code as enum ('SYP');
do $$ declare r record; c record; begin
  for r in select table_name,column_name from information_schema.columns where table_schema='public' and udt_name='currency_code_previous' order by table_name,column_name loop
    -- The two original delivery CHECKs depend on the old enum operator.
    for c in select conname from pg_constraint where conrelid=format('public.%I',r.table_name)::regclass and contype='c' and pg_get_constraintdef(oid) like '%' || r.column_name || '%SYP%' loop execute format('alter table public.%I drop constraint %I',r.table_name,c.conname); end loop;
    execute format('alter table public.%I alter column %I drop default',r.table_name,r.column_name);
    execute format('alter table public.%I alter column %I type public.currency_code using %I::text::public.currency_code',r.table_name,r.column_name,r.column_name);
    execute format('alter table public.%I alter column %I set not null, alter column %I set default ''SYP''::public.currency_code, add constraint %I check (%I = ''SYP''::public.currency_code)',r.table_name,r.column_name,r.column_name,r.table_name || '_' || r.column_name || '_syp_only',r.column_name);
  end loop;
end; $$;

create or replace function public.apply_wallet_transaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  current_balance numeric(14,2);
  next_balance numeric(14,2);
begin
  select w.balance into current_balance from public.wallets w
    where w.user_id = new.user_id for update;
  if not found then raise exception 'wallet not found'; end if;
  next_balance := case when new.direction = 'credit'
    then current_balance + new.amount else current_balance - new.amount end;
  if next_balance < 0 then raise exception 'transaction exceeds available wallet balance'; end if;
  new.balance_after := next_balance;
  update public.wallets set balance = next_balance
    where user_id = new.user_id;
  return new;
end;
$$;

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
    plan_row.price, 'SYP'::public.currency_code, plan_row.commission_rate,
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
    plan_row.duration_months, plan_row.price, 'SYP'::public.currency_code,
    now(), now() + make_interval(months => plan_row.duration_months)
  );
  insert into public.subscription_invoices(
    id, invoice_number, merchant_id, subscription_id, kind, currency,
    total_amount, due_at, status, idempotency_key
  ) values (
    invoice_id_value, 'SUB-INITIAL-' || subscription_id_value::text,
    merchant_id_value, subscription_id_value, 'initial', 'SYP'::public.currency_code,
    plan_row.price, now(), 'open', subscription_id_value
  );
  insert into public.merchant_ledger_entries(
    merchant_id, currency, effect, source_type, source_id, amount
  ) values (
    merchant_id_value, 'SYP'::public.currency_code, 'increase_exposure',
    'subscription_invoice', invoice_id_value, plan_row.price
  );
  insert into public.merchant_billing_settings(merchant_id, auto_renew)
  values (merchant_id_value, false);
  insert into public.wallets(user_id, balance)
  values (application_row.user_id, 0)
  on conflict (user_id) do nothing;
  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    merchant_id_value, auth.uid(), 'initial_subscription_activated',
    'first merchant approval', jsonb_build_object('application_id', application_row.id),
    jsonb_build_object(
      'subscription_id', subscription_id_value, 'invoice_id', invoice_id_value,
      'currency', 'SYP'::public.currency_code, 'amount', plan_row.price,
      'commission_rate', plan_row.commission_rate, 'product_limit', plan_row.product_limit,
      'features', plan_row.features, 'auto_renew', false, 'credit_enabled', false
    )
  );
  update public.merchant_applications set status = 'accepted', review_note = null,
    reviewed_by = auth.uid(), reviewed_at = now() where id = target_application;
end;
$$;

create or replace function public.review_driver_application(
  target_application uuid,
  decision public.application_status,
  decision_note text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  application_row public.driver_applications%rowtype;
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if decision not in ('accepted', 'rejected', 'changes_requested') then raise exception 'invalid review decision'; end if;
  select * into application_row from public.driver_applications
    where id = target_application for update;
  if not found or application_row.status not in ('pending', 'changes_requested', 'rejected') then
    raise exception 'driver application is not available for review';
  end if;
  update public.driver_applications set status = decision,
    review_note = case when decision = 'accepted' then null else nullif(trim(decision_note), '') end,
    reviewed_by = auth.uid(), reviewed_at = now() where id = target_application;
  if decision = 'accepted' then
    insert into public.wallets(user_id, balance)
      values (application_row.user_id, 0) on conflict (user_id) do nothing;
  end if;
end;
$$;

create or replace function public.record_wallet_transaction(
  target_user uuid,
  operation public.wallet_transaction_type,
  operation_direction public.wallet_direction,
  operation_amount numeric,
  operation_note text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  transaction_id uuid;
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if operation not in ('funding', 'settlement', 'adjustment') then raise exception 'invalid wallet operation'; end if;
  if operation = 'funding' and operation_direction <> 'credit' then
    raise exception 'funding operations must credit the wallet';
  end if;
  if operation = 'settlement' and operation_direction <> 'debit' then
    raise exception 'settlement operations must debit the wallet';
  end if;
  if operation_amount <= 0 or operation_amount <> round(operation_amount, 2) then
    raise exception 'amount must be positive with at most two decimal places';
  end if;
  if char_length(coalesce(operation_note, '')) > 2000 then raise exception 'note is too long'; end if;
  insert into public.wallet_transactions(
    user_id, currency, transaction_type, direction, amount, balance_after, note, recorded_by
  ) values (
    target_user, 'SYP'::public.currency_code, operation, operation_direction, operation_amount, 0,
    coalesce(nullif(trim(operation_note), ''), ''), auth.uid()
  ) returning id into transaction_id;
  return transaction_id;
end;
$$;

create or replace function public.save_store_offer(
  selected_offer uuid,
  input_title text,
  input_description text,
  input_type public.store_offer_type,
  input_discount_method public.offer_discount_method,
  input_discount_value numeric,
  input_bundle_price numeric,
  input_ends_at timestamptz,
  input_is_active boolean,
  input_items jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  owner_store uuid;
  saved_offer uuid;
  item jsonb;
  item_role_value public.offer_product_role;
  product_id_value uuid;
  quantity_value numeric;
  product_price numeric;
  bundle_total numeric := 0;
  buy_count integer := 0;
  reward_count integer := 0;
  item_count integer := 0;
begin
  select s.id into owner_store from public.stores s
    join public.merchants m on m.id = s.merchant_id
    where m.owner_user_id = auth.uid() and s.status = 'accepted' and m.status = 'accepted';
  if owner_store is null then raise exception 'approved merchant store required'; end if;
  if nullif(trim(input_title), '') is null or char_length(trim(input_title)) > 140
     or char_length(coalesce(input_description, '')) > 5000
     or (input_ends_at is not null and input_ends_at <= now()) then
    raise exception 'offer details are invalid';
  end if;
  if input_items is null or jsonb_typeof(input_items) is distinct from 'array' or jsonb_array_length(input_items) = 0 then
    raise exception 'at least one product must be assigned to the offer';
  end if;
  if input_type = 'discount' and (input_discount_method is null or input_discount_value is null or input_discount_value <= 0
      or (input_discount_method = 'percentage' and input_discount_value > 100)) then
    raise exception 'discount amount is invalid';
  end if;
  if input_type = 'bundle' and (input_bundle_price is null or input_bundle_price <= 0) then
    raise exception 'bundle price is invalid';
  end if;

  if selected_offer is null then
    insert into public.store_offers(store_id, title, description, offer_type, discount_method, discount_value,
      bundle_price, ends_at, is_active)
    values (owner_store, trim(input_title), coalesce(trim(input_description), ''), input_type,
      case when input_type = 'discount' then input_discount_method else null end,
      case when input_type = 'discount' then input_discount_value else null end,
      case when input_type = 'bundle' then input_bundle_price else null end,
      input_ends_at, coalesce(input_is_active, true))
    returning id into saved_offer;
  else
    update public.store_offers set title = trim(input_title), description = coalesce(trim(input_description), ''),
      offer_type = input_type, discount_method = case when input_type = 'discount' then input_discount_method else null end,
      discount_value = case when input_type = 'discount' then input_discount_value else null end,
      bundle_price = case when input_type = 'bundle' then input_bundle_price else null end,
      ends_at = input_ends_at, is_active = coalesce(input_is_active, true)
      where id = selected_offer and store_id = owner_store returning id into saved_offer;
    if saved_offer is null then raise exception 'offer not found'; end if;
    delete from public.store_offer_products where offer_id = saved_offer;
  end if;

  for item in select value from jsonb_array_elements(input_items)
  loop
    item_count := item_count + 1;
    product_id_value := nullif(item ->> 'product_id', '')::uuid;
    item_role_value := (item ->> 'item_role')::public.offer_product_role;
    quantity_value := (item ->> 'quantity')::numeric;
    if quantity_value is null or quantity_value <= 0 or product_id_value is null then
      raise exception 'offer product selection is invalid';
    end if;
    if (input_type = 'discount' and item_role_value <> 'discounted')
       or (input_type = 'bundle' and item_role_value <> 'bundle')
       or (input_type = 'buy_x_get_y' and item_role_value not in ('buy', 'reward')) then
      raise exception 'offer product role does not match offer type';
    end if;
    select p.price into product_price from public.products p
      where p.id = product_id_value and p.store_id = owner_store and p.is_available;
    if not found then
      raise exception 'offer products must belong to your store';
    end if;
    if input_type = 'discount' and input_discount_method = 'fixed_amount' then
      if input_discount_value >= product_price then
        raise exception 'fixed discount must be less than the product price';
      end if;
    end if;
    if input_type = 'bundle' then
      bundle_total := bundle_total + product_price * quantity_value;
    end if;
    if item_role_value = 'buy' then buy_count := buy_count + 1; end if;
    if item_role_value = 'reward' then reward_count := reward_count + 1; end if;
    insert into public.store_offer_products(store_id, offer_id, product_id, item_role, quantity)
      values (owner_store, saved_offer, product_id_value, item_role_value, quantity_value);
  end loop;
  if input_type = 'buy_x_get_y' and (buy_count <> 1 or reward_count <> 1 or item_count <> 2) then
    raise exception 'buy X get Y offers require exactly one buy product and one reward product';
  end if;
  if input_type = 'bundle' and input_bundle_price >= bundle_total then
    raise exception 'bundle price must be less than the selected products total';
  end if;
  return saved_offer;
end;
$$;

create or replace function public.create_order_from_cart(
  input_recipient_name text,
  input_contact_phone text,
  input_delivery_address text,
  input_delivery_zone uuid,
  input_customer_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer uuid := auth.uid();
  cart_row public.customer_carts%rowtype;
  zone_row public.delivery_zones%rowtype;
  new_order uuid;
  store_row record;
  created_store_order uuid;
  offer_row record;
  offer_item record;
  offer_original_total numeric(14,2);
  offer_bundle_total numeric(14,2);
  allocated_total numeric(14,2);
  item_original_total numeric(14,2);
  item_final_total numeric(14,2);
  item_quantity numeric(12,3);
  item_unit_price numeric(14,2);
  offer_item_count integer;
  offer_item_index integer;
  item_offer_role public.offer_product_role;
  item_offer_snapshot jsonb;
begin
  if current_customer is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = current_customer and p.role = 'customer'
  ) then raise exception 'customer account required'; end if;
  if nullif(trim(input_recipient_name), '') is null
     or nullif(trim(input_contact_phone), '') is null
     or nullif(trim(input_delivery_address), '') is null then
    raise exception 'recipient and delivery details are required';
  end if;
  if char_length(trim(input_recipient_name)) > 120
     or char_length(trim(input_contact_phone)) > 32
     or char_length(trim(input_delivery_address)) > 1000 then
    raise exception 'delivery details exceed the allowed length';
  end if;
  if char_length(coalesce(input_customer_note, '')) > 1500 then
    raise exception 'customer note is too long';
  end if;

  select * into zone_row
  from public.delivery_zones z
  where z.id = input_delivery_zone and z.is_active
  for share;
  if not found then raise exception 'delivery zone is unavailable'; end if;

  select * into cart_row
  from public.customer_carts c
  where c.customer_id = current_customer
  for update;
  if not found then raise exception 'cart is empty'; end if;
  if not exists (
    select 1 from public.customer_cart_items ci where ci.cart_id = cart_row.id
  ) and not exists (
    select 1 from public.customer_cart_offer_selections selection
    where selection.cart_id = cart_row.id
  ) then raise exception 'cart is empty'; end if;

  if exists (
    select 1
    from public.customer_cart_items ci
      join public.products p on p.id = ci.product_id
      join public.stores s on s.id = p.store_id
      join public.merchants m on m.id = s.merchant_id
    where ci.cart_id = cart_row.id and (
      not p.is_available or s.status <> 'accepted' or m.status <> 'accepted'
      or ci.quantity < p.minimum_quantity
      or mod(ci.quantity - p.minimum_quantity, p.quantity_step) <> 0
    )
  ) then raise exception 'one or more cart items are unavailable or have an invalid quantity'; end if;

  if exists (
    select 1
    from public.customer_cart_offer_selections selection
      join public.store_offers o on o.id = selection.offer_id
      join public.stores s on s.id = o.store_id
      join public.merchants m on m.id = s.merchant_id
    where selection.cart_id = cart_row.id and (
      not o.is_active or o.starts_at > now() or (o.ends_at is not null and o.ends_at <= now())
      or s.status <> 'accepted' or m.status <> 'accepted'
      or exists (
        select 1 from public.store_offer_products op
          left join public.products p on p.id = op.product_id and p.store_id = op.store_id
        where op.offer_id = o.id and (p.id is null or not p.is_available)
      )
    )
  ) then raise exception 'one or more selected offers are no longer available'; end if;




  if exists (
    select 1
    from public.customer_cart_offer_selections selection
      join public.store_offer_products op on op.offer_id = selection.offer_id
      join public.products p on p.id = op.product_id and p.store_id = op.store_id
    where selection.cart_id = cart_row.id and p.is_available and (
      op.quantity < p.minimum_quantity
      or mod(op.quantity - p.minimum_quantity, p.quantity_step) <> 0
    )
  ) then raise exception 'selected offer contains a product quantity that is not valid for sale'; end if;

  insert into public.customer_orders(
    customer_id, recipient_name, contact_phone, delivery_address,
    delivery_zone_id, delivery_zone_name_snapshot, delivery_fee, customer_note
  )
  values (
    current_customer, trim(input_recipient_name), trim(input_contact_phone),
    trim(input_delivery_address), zone_row.id, zone_row.name, zone_row.fixed_fee,
    coalesce(trim(input_customer_note), '')
  )
  returning id into new_order;

  insert into public.delivery_tasks(customer_order_id, status)
  values (new_order, 'pending_stores');

  for store_row in
    select distinct p.store_id
    from public.customer_cart_items ci
      join public.products p on p.id = ci.product_id
    where ci.cart_id = cart_row.id
    union
    select distinct o.store_id
    from public.customer_cart_offer_selections selection
      join public.store_offers o on o.id = selection.offer_id
    where selection.cart_id = cart_row.id
    order by store_id
  loop
    insert into public.store_orders(customer_order_id, store_id, customer_note)
    values (
      new_order, store_row.store_id,
      coalesce((
        select n.note from public.customer_cart_store_notes n
        where n.cart_id = cart_row.id and n.store_id = store_row.store_id
      ), '')
    )
    returning id into created_store_order;

    insert into public.store_order_items(
      store_order_id, product_id, product_title_snapshot, selling_unit_snapshot,
      quantity, unit_price_snapshot, currency, line_total
    )
    select
      created_store_order, p.id, p.title, p.selling_unit, ci.quantity, p.price,
      'SYP'::public.currency_code, round(ci.quantity * p.price, 2)
    from public.customer_cart_items ci
      join public.products p on p.id = ci.product_id
    where ci.cart_id = cart_row.id and p.store_id = store_row.store_id;

    for offer_row in
      select o.*
      from public.customer_cart_offer_selections selection
        join public.store_offers o on o.id = selection.offer_id
      where selection.cart_id = cart_row.id and o.store_id = store_row.store_id
      order by o.id
    loop
      select count(*)::integer
      into offer_item_count
      from public.store_offer_products op
      where op.offer_id = offer_row.id;

      select round(sum(round(p.price * op.quantity, 2)), 2)
      into offer_original_total
      from public.store_offer_products op
        join public.products p on p.id = op.product_id and p.store_id = op.store_id
      where op.offer_id = offer_row.id;

      if offer_item_count = 0 or offer_original_total is null then
        raise exception 'selected offer has no available products';
      end if;
      offer_bundle_total := round(coalesce(offer_row.bundle_price, 0), 2);
      allocated_total := 0;
      offer_item_index := 0;

      for offer_item in
        select op.product_id, op.item_role, op.quantity, p.title,
          p.selling_unit, p.price, 'SYP'::public.currency_code as currency
        from public.store_offer_products op
          join public.products p on p.id = op.product_id and p.store_id = op.store_id
        where op.offer_id = offer_row.id and p.is_available
        order by op.id
      loop
        offer_item_index := offer_item_index + 1;
        item_quantity := offer_item.quantity;
        item_original_total := round(offer_item.price * item_quantity, 2);
        item_offer_role := offer_item.item_role;
        item_final_total := item_original_total;

        if offer_row.offer_type = 'discount' then
          if item_offer_role <> 'discounted' then
            raise exception 'discount offer contains an invalid product role';
          end if;
          if offer_row.discount_method = 'percentage' then
            item_final_total := round(
              item_original_total * (100 - offer_row.discount_value) / 100, 2
            );
          elsif offer_row.discount_method = 'fixed_amount' then
            item_final_total := round(
              greatest(0, offer_item.price - offer_row.discount_value) * item_quantity, 2
            );
          else
            raise exception 'discount offer is missing its discount rule';
          end if;
        elsif offer_row.offer_type = 'bundle' then
          if item_offer_role <> 'bundle' then
            raise exception 'bundle offer contains an invalid product role';
          end if;
          if offer_item_index = offer_item_count then
            item_final_total := offer_bundle_total - allocated_total;
          else
            item_final_total := round(
              offer_bundle_total * item_original_total / offer_original_total, 2
            );
            allocated_total := allocated_total + item_final_total;
          end if;
        elsif offer_row.offer_type = 'buy_x_get_y' then
          if item_offer_role = 'reward' then
            item_final_total := 0;
          elsif item_offer_role <> 'buy' then
            raise exception 'buy X get Y offer contains an invalid product role';
          end if;
        end if;

        item_unit_price := case
          when item_quantity > 0 then round(item_final_total / item_quantity, 2)
          else 0
        end;
        item_offer_snapshot := jsonb_build_object(
          'offer_id', offer_row.id,
          'title', offer_row.title,
          'offer_type', offer_row.offer_type,
          'discount_method', offer_row.discount_method,
          'discount_value', offer_row.discount_value,
          'bundle_price', offer_row.bundle_price,
          'currency', 'SYP'::public.currency_code,
          'item_role', item_offer_role,
          'original_line_total', item_original_total,
          'final_line_total', item_final_total
        );

        insert into public.store_order_items(
          store_order_id, product_id, product_title_snapshot, selling_unit_snapshot,
          quantity, unit_price_snapshot, currency, line_total, offer_snapshot
        )
        values (
          created_store_order, offer_item.product_id, offer_item.title,
          offer_item.selling_unit, item_quantity, item_unit_price,
          'SYP'::public.currency_code, item_final_total, item_offer_snapshot
        );
      end loop;
    end loop;

    insert into public.store_order_totals(store_order_id, currency, items_subtotal)
    select soi.store_order_id, 'SYP'::public.currency_code, sum(soi.line_total)
    from public.store_order_items soi
    where soi.store_order_id = created_store_order
    group by soi.store_order_id;
  end loop;

  insert into public.customer_order_totals(customer_order_id, currency, items_subtotal, delivery_fee, total)
  select new_order, 'SYP', coalesce(sum(soi.line_total),0), zone_row.fixed_fee,
    coalesce(sum(soi.line_total),0) + zone_row.fixed_fee
  from public.store_order_items soi join public.store_orders so on so.id=soi.store_order_id
  where so.customer_order_id=new_order;

  delete from public.customer_cart_items where cart_id = cart_row.id;
  delete from public.customer_cart_store_notes where cart_id = cart_row.id;
  delete from public.customer_cart_offer_selections where cart_id = cart_row.id;
  return new_order;
end;
$$;

create or replace function public.add_customer_cart_offer(target_offer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer uuid := auth.uid();
  target_cart uuid;
begin
  if current_customer is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = current_customer and p.role = 'customer'
  ) then raise exception 'customer account required'; end if;
  if not exists (
    select 1 from public.store_offers o
      join public.stores s on s.id = o.store_id
      join public.merchants m on m.id = s.merchant_id
    where o.id = target_offer and o.is_active
      and o.starts_at <= now() and (o.ends_at is null or o.ends_at > now())
      and s.status = 'accepted' and m.status = 'accepted'
  ) then raise exception 'offer is unavailable'; end if;

  if not exists (
    select 1
    from public.store_offer_products op
      join public.products p on p.id = op.product_id and p.store_id = op.store_id
      join public.store_offers o on o.id = op.offer_id
    where op.offer_id = target_offer
  ) or exists (
    select 1
    from public.store_offer_products op
      join public.products p on p.id = op.product_id and p.store_id = op.store_id
      join public.store_offers o on o.id = op.offer_id
    where op.offer_id = target_offer
      and (not p.is_available)
  ) then raise exception 'offer products are unavailable or use a different currency'; end if;

  insert into public.customer_carts(customer_id)
  values (current_customer)
  on conflict (customer_id) do update set updated_at = now()
  returning id into target_cart;

  insert into public.customer_cart_offer_selections(cart_id, offer_id)
  values (target_cart, target_offer)
  on conflict (cart_id, offer_id) do nothing;
end;
$$;

create or replace function public.reject_subscription_invoice_identity_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.id is distinct from old.id
     or new.invoice_number is distinct from old.invoice_number
     or new.merchant_id is distinct from old.merchant_id
     or new.subscription_id is distinct from old.subscription_id
     or new.kind is distinct from old.kind
     or new.currency is distinct from old.currency
     or new.total_amount is distinct from old.total_amount
     or new.due_at is distinct from old.due_at
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at then
    raise exception 'invoice financial identity is immutable';
  end if;
  return new;
end;
$$;

create or replace function public.validate_invoice_payment_allocation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  invoice_row public.subscription_invoices%rowtype;
  payment_row public.subscription_payments%rowtype;
  invoice_allocated numeric(14,2);
  payment_allocated numeric(14,2);
begin
  select * into payment_row from public.subscription_payments p
    where p.id = new.payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  select * into invoice_row from public.subscription_invoices i
    where i.id = new.invoice_id for update;
  if not found then raise exception 'invoice not found'; end if;
  if invoice_row.merchant_id <> payment_row.merchant_id
     or invoice_row.currency <> payment_row.currency then
    raise exception 'invoice and payment must belong to the same merchant and currency';
  end if;
  if invoice_row.status = 'void' then
    raise exception 'a void invoice cannot receive an allocation';
  end if;
  select coalesce(sum(a.amount), 0) into invoice_allocated
    from public.invoice_payment_allocations a where a.invoice_id = new.invoice_id;
  select coalesce(sum(a.amount), 0) into payment_allocated
    from public.invoice_payment_allocations a where a.payment_id = new.payment_id;
  if invoice_allocated + new.amount > invoice_row.total_amount
     or payment_allocated + new.amount > payment_row.amount then
    raise exception 'allocation exceeds the remaining invoice or payment amount';
  end if;
  return new;
end;
$$;

create or replace function public.validate_merchant_ledger_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare original_row public.merchant_ledger_entries%rowtype;
begin
  if new.reversal_of is null then
    if new.source_type = 'ledger_reversal' then
      raise exception 'ledger reversal source requires reversal_of';
    end if;
    return new;
  end if;
  select * into original_row from public.merchant_ledger_entries e
    where e.id = new.reversal_of for update;
  if not found then raise exception 'original ledger entry not found'; end if;
  if original_row.source_type = 'ledger_reversal' then
    raise exception 'a ledger reversal cannot itself be reversed';
  end if;
  if new.source_type <> 'ledger_reversal'
     or new.source_id <> original_row.id
     or new.merchant_id <> original_row.merchant_id
     or new.currency <> original_row.currency
     or new.amount <> original_row.amount
     or new.effect = original_row.effect then
    raise exception 'ledger reversal must exactly negate its original entry';
  end if;
  return new;
end;
$$;

create or replace function public.allocate_subscription_payment(
  target_payment uuid,
  allocation_input jsonb,
  allocation_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.subscription_payments%rowtype;
  invoice_row public.subscription_invoices%rowtype;
  allocation_row record;
  batch_id_value uuid;
  existing_batch_count integer;
  requested_count integer;
  distinct_invoice_count integer;
  requested_total numeric(14,2);
  allocated_total numeric(14,2);
  invoice_allocated numeric(14,2);
  allocation_id_value uuid;
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  if allocation_idempotency_key is null then
    raise exception 'allocation idempotency key is required';
  end if;
  if allocation_input is null or jsonb_typeof(allocation_input) <> 'array' then
    raise exception 'allocations must be a JSON array';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(allocation_input) entry
    where jsonb_typeof(entry) <> 'object'
       or not (entry ? 'invoice_id' and entry ? 'amount')
       or exists (
         select 1 from jsonb_object_keys(entry) key
         where key not in ('invoice_id', 'amount')
       )
  ) then
    raise exception 'each allocation must contain only invoice_id and amount';
  end if;

  select count(*), count(distinct entry.invoice_id), coalesce(sum(entry.amount), 0)
    into requested_count, distinct_invoice_count, requested_total
  from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric);

  if requested_count <> distinct_invoice_count then
    raise exception 'an invoice may appear only once in an allocation batch';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric)
    where entry.invoice_id is null
       or entry.amount is null
       or entry.amount <= 0
       or entry.amount::text in ('NaN', 'Infinity', '-Infinity')
       or entry.amount <> trunc(entry.amount, 2)
  ) then
    raise exception 'allocation amounts must be positive finite numbers with at most two decimal places';
  end if;

  select * into payment_row
  from public.subscription_payments p
  where p.id = target_payment
  for update;
  if not found then
    raise exception 'subscription payment not found';
  end if;

  -- A retry may only replay the same payment and allocation set.
  select b.id into batch_id_value
  from public.subscription_payment_allocation_batches b
  where b.idempotency_key = allocation_idempotency_key
  for update;
  if found then
    if (select payment_id from public.subscription_payment_allocation_batches where id = batch_id_value)
       <> target_payment then
      raise exception 'allocation idempotency key belongs to another payment';
    end if;
    if (select recorded_by from public.subscription_payment_allocation_batches where id = batch_id_value)
       <> auth.uid() then
      raise exception 'allocation idempotency key belongs to another administrator';
    end if;
    select count(*) into existing_batch_count
    from public.invoice_payment_allocations a
    where a.allocation_batch_id = batch_id_value;
    if existing_batch_count <> requested_count
       or exists (
         select 1 from (
           (select entry.invoice_id, entry.amount
            from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric)
            except
            select a.invoice_id, a.amount
            from public.invoice_payment_allocations a
            where a.allocation_batch_id = batch_id_value)
           union all
           (select a.invoice_id, a.amount
            from public.invoice_payment_allocations a
            where a.allocation_batch_id = batch_id_value
            except
            select entry.invoice_id, entry.amount
            from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric))
         ) mismatched_allocation
       ) then
      raise exception 'allocation idempotency key was reused with different allocations';
    end if;
    return batch_id_value;
  end if;

  -- This aggregate is protected by the payment row lock above. The existing
  -- allocation trigger also locks the same row as defense in depth.
  select coalesce(sum(a.amount), 0) into allocated_total
  from public.invoice_payment_allocations a
  where a.payment_id = target_payment;
  if allocated_total + requested_total > payment_row.amount then
    raise exception 'allocation exceeds the remaining payment amount';
  end if;

  -- Lock and validate targets before inserting. Ordering prevents two batches
  -- from taking their invoice locks in opposite directions.
  for allocation_row in
    select entry.invoice_id, entry.amount
    from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric)
    order by entry.invoice_id
  loop
    select * into invoice_row
    from public.subscription_invoices i
    where i.id = allocation_row.invoice_id
    for update;
    if not found then
      raise exception 'subscription invoice not found';
    end if;
    if invoice_row.merchant_id <> payment_row.merchant_id
       or invoice_row.currency <> payment_row.currency then
      raise exception 'invoice and payment must belong to the same merchant and currency';
    end if;
    if invoice_row.status = 'void' then
      raise exception 'a void invoice cannot receive an allocation';
    end if;
    select coalesce(sum(a.amount), 0) into invoice_allocated
    from public.invoice_payment_allocations a
    where a.invoice_id = invoice_row.id;
    if invoice_allocated + allocation_row.amount > invoice_row.total_amount then
      raise exception 'allocation exceeds the remaining invoice amount';
    end if;
  end loop;

  insert into public.subscription_payment_allocation_batches(
    payment_id, idempotency_key, recorded_by
  ) values (
    target_payment, allocation_idempotency_key, auth.uid()
  ) returning id into batch_id_value;

  for allocation_row in
    select entry.invoice_id, entry.amount
    from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric)
    order by entry.invoice_id
  loop
    insert into public.invoice_payment_allocations(
      invoice_id, payment_id, amount, allocation_batch_id
    ) values (
      allocation_row.invoice_id, target_payment, allocation_row.amount, batch_id_value
    ) returning id into allocation_id_value;

    -- Exposure falls only when money is applied to a real invoice.
    insert into public.merchant_ledger_entries(
      merchant_id, currency, effect, source_type, source_id, amount
    ) values (
      payment_row.merchant_id, payment_row.currency, 'decrease_exposure',
      'payment_allocation', allocation_id_value, allocation_row.amount
    );
  end loop;

  update public.subscription_invoices i
  set status = case
    when totals.allocated_amount = 0 then 'open'
    when totals.allocated_amount >= i.total_amount then 'paid'
    else 'partially_paid'
  end
  from (
    select a.invoice_id, coalesce(sum(a.amount), 0) as allocated_amount
    from public.invoice_payment_allocations a
    where a.invoice_id in (
      select entry.invoice_id
      from jsonb_to_recordset(allocation_input) as entry(invoice_id uuid, amount numeric)
    )
    group by a.invoice_id
  ) totals
  where i.id = totals.invoice_id;

  if requested_count > 0 then
    insert into public.merchant_financial_audit_events(
      merchant_id, actor_id, event_type, reason, after_data
    ) values (
      payment_row.merchant_id, auth.uid(), 'subscription_payment_allocated',
      'payment allocation batch',
      jsonb_build_object(
        'payment_id', target_payment,
        'allocation_batch_id', batch_id_value,
        'allocated_amount', requested_total,
        'currency', payment_row.currency
      )
    );
  end if;

  return batch_id_value;
end;
$$;

create or replace function public.record_subscription_payment(
  target_merchant uuid,
  payment_amount numeric,
  payment_method text,
  payment_idempotency_key uuid,
  allocation_input jsonb default '[]'::jsonb,
  payment_external_reference text default null,
  payment_received_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.subscription_payments%rowtype;
  payment_id_value uuid;
  allocated_amount numeric(14,2);
  allocation_batch_id_value uuid;
  initial_allocation_idempotency_key uuid;
  initial_allocation_hash text;
  payment_was_created boolean := false;
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  if payment_idempotency_key is null then
    raise exception 'payment idempotency key is required';
  end if;
  if payment_amount is null
     or payment_amount <= 0
     or payment_amount::text in ('NaN', 'Infinity', '-Infinity')
     or payment_amount <> trunc(payment_amount, 2) then
    raise exception 'payment amount must be a positive finite number with at most two decimal places';
  end if;
  if payment_method not in ('cash', 'external_transfer') then
    raise exception 'unsupported subscription payment method';
  end if;
  if allocation_input is null or jsonb_typeof(allocation_input) <> 'array' then
    raise exception 'allocations must be a JSON array';
  end if;
  if not exists (select 1 from public.merchants m where m.id = target_merchant) then
    raise exception 'merchant not found';
  end if;

  -- A payment key and its initial allocation-batch key are deliberately
  -- separate namespaces. The MD5-derived UUID is deterministic for retries,
  -- while later allocations must provide their own independent UUID keys.
  initial_allocation_hash := md5(
    'tasawuq:subscription-payment:initial-allocation:' || payment_idempotency_key::text
  );
  initial_allocation_idempotency_key := (
    substr(initial_allocation_hash, 1, 8)
    || '-' || substr(initial_allocation_hash, 9, 4)
    || '-' || substr(initial_allocation_hash, 13, 4)
    || '-' || substr(initial_allocation_hash, 17, 4)
    || '-' || substr(initial_allocation_hash, 21, 12)
  )::uuid;

  insert into public.subscription_payments(
    merchant_id, currency, amount, method, external_reference,
    idempotency_key, received_at, recorded_by
  ) values (
    target_merchant, 'SYP'::public.currency_code, payment_amount, payment_method,
    nullif(trim(payment_external_reference), ''), payment_idempotency_key,
    coalesce(payment_received_at, now()), auth.uid()
  )
  on conflict (idempotency_key) do nothing
  returning id into payment_id_value;

  if payment_id_value is null then
    select * into payment_row
    from public.subscription_payments p
    where p.idempotency_key = payment_idempotency_key
    for update;
    if payment_row.merchant_id <> target_merchant
       or payment_row.currency <> 'SYP'::public.currency_code
       or payment_row.amount <> payment_amount
       or payment_row.method <> payment_method
       or payment_row.external_reference is distinct from nullif(trim(payment_external_reference), '')
       or payment_row.recorded_by <> auth.uid()
       or (payment_received_at is not null and payment_row.received_at <> payment_received_at) then
      raise exception 'payment idempotency key was reused with different payment details';
    end if;
    payment_id_value := payment_row.id;
  else
    payment_was_created := true;
    select * into payment_row from public.subscription_payments where id = payment_id_value;
  end if;

  -- Always create or validate the initial allocation batch. Empty input records
  -- a durable, idempotent decision to leave the payment unapplied for now.
  select public.allocate_subscription_payment(
    payment_id_value, allocation_input, initial_allocation_idempotency_key
  ) into allocation_batch_id_value;

  if payment_was_created then
    select coalesce(sum(a.amount), 0) into allocated_amount
    from public.invoice_payment_allocations a
    where a.allocation_batch_id = allocation_batch_id_value;

    insert into public.merchant_financial_audit_events(
      merchant_id, actor_id, event_type, reason, after_data
    ) values (
      target_merchant, auth.uid(), 'subscription_payment_recorded',
      'administrator recorded subscription payment',
      jsonb_build_object(
        'payment_id', payment_id_value,
        'currency', 'SYP'::public.currency_code,
        'amount', payment_amount,
        'allocated_amount', allocated_amount,
        'unallocated_amount', payment_amount - allocated_amount,
        'method', payment_method
      )
    );
  end if;

  return payment_id_value;
end;
$$;

create or replace function public.set_merchant_credit_limit(
  target_merchant uuid,
  credit_is_enabled boolean,
  credit_amount numeric,
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
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  if credit_amount is null
     or credit_amount < 0
     or credit_amount::text in ('NaN', 'Infinity', '-Infinity')
     or credit_amount <> trunc(credit_amount, 2) then
    raise exception 'credit limit must be a non-negative finite number with at most two decimal places';
  end if;
  if not exists (select 1 from public.merchants m where m.id = target_merchant) then
    raise exception 'merchant not found';
  end if;

  select to_jsonb(l) into before_value
  from public.merchant_credit_limits l
  where l.merchant_id = target_merchant and true
  for update;

  insert into public.merchant_credit_limits(
    merchant_id, credit_enabled, credit_limit, updated_by, updated_at
  ) values (
    target_merchant, credit_is_enabled, credit_amount, auth.uid(), now()
  )
  on conflict (merchant_id) do update
  set credit_enabled = excluded.credit_enabled,
      credit_limit = excluded.credit_limit,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  select to_jsonb(l) into after_value
  from public.merchant_credit_limits l
  where l.merchant_id = target_merchant and true;

  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    target_merchant, auth.uid(), 'merchant_credit_limit_updated',
    nullif(trim(change_reason), ''), before_value, after_value
  );
end;
$$;

create or replace function public.subscription_renewal_internal(
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


  if require_credit then
    select * into credit_row
    from public.merchant_credit_limits l
    where l.merchant_id = target_merchant
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

create or replace function public.schedule_merchant_subscription_plan_change(
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
    plan_row.price, 'SYP'::public.currency_code, change_idempotency_key, auth.uid()
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
      'currency', 'SYP'::public.currency_code
    )
  );

  return change_id_value;
end;
$$;

create or replace function public.accrue_store_order_commission(
  target_store_order uuid,
  delivered_at_value timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  commission_row public.store_order_commissions%rowtype;
  effective_due_at timestamptz := coalesce(delivered_at_value, now());
begin
  select * into commission_row
  from public.store_order_commissions c
  where c.store_order_id = target_store_order
  for update;

  if not found or commission_row.status <> 'pending_delivery' then
    return;
  end if;

  update public.store_order_commissions
  set status = 'due', due_at = effective_due_at
  where id = commission_row.id and status = 'pending_delivery';

  if commission_row.commission_amount > 0 then
    insert into public.merchant_ledger_entries(
      merchant_id, currency, effect, source_type, source_id, amount
    ) values (
      commission_row.merchant_id, commission_row.currency, 'increase_exposure',
      'store_order_commission', commission_row.id, commission_row.commission_amount
    ) on conflict (source_type, source_id) do nothing;
  end if;

  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    commission_row.merchant_id, auth.uid(), 'store_order_commission_due',
    'store order delivered',
    jsonb_build_object('status', 'pending_delivery'),
    jsonb_build_object(
      'commission_id', commission_row.id,
      'store_order_id', commission_row.store_order_id,
      'currency', commission_row.currency,
      'amount', commission_row.commission_amount,
      'due_at', effective_due_at
    )
  );
end;
$$;

create or replace function public.snapshot_store_order_commission_after_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row record;
  total_count integer;
  total_currency public.currency_code;
  total_base_amount numeric(14,2);
  subscription_row record;
  rate_value numeric(7,4);
  commission_value numeric(14,2);
begin
  select so.id, so.created_at, so.status, so.delivered_at, s.merchant_id
    into order_row
  from public.store_orders so
  join public.stores s on s.id = so.store_id
  where so.id = new.store_order_id
  for key share of so;

  if not found then
    raise exception 'store order was not found while snapshotting commission';
  end if;

  -- Deferred triggers observe the final row state. A transaction that creates
  -- and then rejects/cancels an order must not leave a pending commission.
  if order_row.status in ('rejected', 'cancelled') then
    return new;
  end if;

  select count(*) into total_count
  from public.store_order_totals t
  where t.store_order_id = new.store_order_id;

  if total_count <> 1 then
    raise exception 'a store order must have exactly one currency total before commission snapshotting';
  end if;

  select t.currency, t.items_subtotal
    into total_currency, total_base_amount
  from public.store_order_totals t
  where t.store_order_id = new.store_order_id;

  select ms.id as subscription_id, ms.plan_id, ms.plan_name_snapshot,
         ms.commission_rate_snapshot
    into subscription_row
  from public.merchant_subscriptions ms
  where ms.merchant_id = order_row.merchant_id
    and ms.starts_at <= order_row.created_at
    and ms.expires_at + interval '7 days' > order_row.created_at
  order by ms.starts_at desc, ms.expires_at desc, ms.id desc
  limit 1
  for share of ms;

  if not found then
    raise exception 'no active subscription period covers this store order';
  end if;

  rate_value := subscription_row.commission_rate_snapshot;
  if rate_value is null then
    raise exception 'the active subscription period has no commission rate snapshot';
  end if;

  commission_value := round(total_base_amount * rate_value / 100, 2);

  insert into public.store_order_commissions(
    store_order_id, merchant_id, subscription_id, plan_id, plan_name_snapshot,
    currency, commission_rate, base_amount, commission_amount, status
  ) values (
    new.store_order_id, order_row.merchant_id, subscription_row.subscription_id,
    subscription_row.plan_id, subscription_row.plan_name_snapshot, total_currency,
    rate_value, total_base_amount, commission_value, 'pending_delivery'
  ) on conflict (store_order_id) do nothing;

  if order_row.status = 'delivered' then
    perform public.accrue_store_order_commission(
      new.store_order_id,
      order_row.delivered_at
    );
  end if;

  return new;
end;
$$;

create or replace function public.reverse_store_order_commission(
  target_commission uuid,
  reversal_amount numeric,
  reversal_idempotency_key uuid,
  reversal_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  commission_row public.store_order_commissions%rowtype;
  existing_reversal public.store_order_commission_reversals%rowtype;
  reversed_total numeric(14,2);
  reversal_id_value uuid;
  normalized_reason text := nullif(trim(reversal_reason), '');
begin
  if not public.is_admin() then
    raise exception 'administrator access required';
  end if;
  if reversal_amount is null
     or reversal_amount::text in ('NaN', 'Infinity', '-Infinity')
     or reversal_amount <= 0
     or reversal_amount <> round(reversal_amount, 2) then
    raise exception 'commission reversal amount must be positive with at most two decimal places';
  end if;
  if reversal_idempotency_key is null then
    raise exception 'commission reversal idempotency key is required';
  end if;
  if normalized_reason is null
     or char_length(normalized_reason) < 2
     or char_length(normalized_reason) > 1500 then
    raise exception 'commission reversal reason must contain between 2 and 1500 characters';
  end if;

  select * into existing_reversal
  from public.store_order_commission_reversals r
  where r.idempotency_key = reversal_idempotency_key
  for update;
  if found then
    if existing_reversal.commission_id <> target_commission
       or existing_reversal.amount <> reversal_amount
       or existing_reversal.reason <> normalized_reason then
      raise exception 'commission reversal idempotency key was reused with different details';
    end if;
    return existing_reversal.id;
  end if;

  select * into commission_row
  from public.store_order_commissions c
  where c.id = target_commission
  for update;
  if not found then
    raise exception 'store-order commission not found';
  end if;
  if commission_row.status <> 'due' then
    raise exception 'only a due commission can be reversed';
  end if;

  select coalesce(sum(r.amount), 0) into reversed_total
  from public.store_order_commission_reversals r
  where r.commission_id = commission_row.id;
  if reversed_total + reversal_amount > commission_row.commission_amount then
    raise exception 'commission reversal exceeds the remaining commission amount';
  end if;

  insert into public.store_order_commission_reversals(
    commission_id, merchant_id, currency, amount, idempotency_key, reason, reversed_by
  ) values (
    commission_row.id, commission_row.merchant_id, commission_row.currency,
    reversal_amount, reversal_idempotency_key, normalized_reason, auth.uid()
  ) returning id into reversal_id_value;

  insert into public.merchant_ledger_entries(
    merchant_id, currency, effect, source_type, source_id, amount
  ) values (
    commission_row.merchant_id, commission_row.currency, 'decrease_exposure',
    'commission_reversal', reversal_id_value, reversal_amount
  );

  insert into public.merchant_financial_audit_events(
    merchant_id, actor_id, event_type, reason, before_data, after_data
  ) values (
    commission_row.merchant_id, auth.uid(), 'store_order_commission_reversed',
    normalized_reason,
    jsonb_build_object(
      'commission_id', commission_row.id,
      'reversed_total_before', reversed_total
    ),
    jsonb_build_object(
      'commission_id', commission_row.id,
      'reversal_id', reversal_id_value,
      'reversal_amount', reversal_amount,
      'reversed_total_after', reversed_total + reversal_amount
    )
  );

  return reversal_id_value;
end;
$$;

create or replace function public.create_delivered_order_cash_foundations(target_customer_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.customer_orders%rowtype;
  task_row public.delivery_tasks%rowtype;
  delivered_store_row record;
  has_delivered_store boolean;
  has_nonterminal_store boolean;
begin
  select * into order_row
  from public.customer_orders co
  where co.id = target_customer_order
  for key share;
  if not found then
    raise exception 'customer order not found while creating delivered cash foundations';
  end if;

  select * into task_row
  from public.delivery_tasks dt
  where dt.customer_order_id = target_customer_order
  for key share;
  if not found or task_row.status <> 'delivered'
     or task_row.driver_id is null or task_row.delivered_at is null then
    return;
  end if;

  select
    bool_or(so.status = 'delivered'),
    bool_or(so.status not in ('delivered', 'rejected', 'cancelled'))
  into has_delivered_store, has_nonterminal_store
  from public.store_orders so
  where so.customer_order_id = target_customer_order;

  if not coalesce(has_delivered_store, false) or coalesce(has_nonterminal_store, true) then
    return;
  end if;

  -- The current status trigger is named before this migration's store-order
  -- trigger and therefore normally accrues first. Calling the same idempotent
  -- server helper here makes the dependency explicit and also protects a
  -- future server delivery path from creating a merchant entitlement before
  -- its commission is due.
  for delivered_store_row in
    select so.id, coalesce(so.delivered_at, task_row.delivered_at) as delivered_at
    from public.store_orders so
    where so.customer_order_id = target_customer_order
      and so.status = 'delivered'
  loop
    perform public.accrue_store_order_commission(
      delivered_store_row.id,
      delivered_store_row.delivered_at
    );
  end loop;

  -- Do not read customer_order_totals here: those historical totals are kept
  -- intact and can include a child order later rejected before delivery.
  insert into public.customer_order_cash_obligations(
    customer_order_id, delivery_task_id, driver_id, currency,
    delivered_store_items_amount, delivery_fee_amount, collectible_amount,
    delivery_zone_id, delivery_zone_name_snapshot, delivered_at)
  select order_row.id, task_row.id, task_row.driver_id, 'SYP',
    coalesce(sum(sot.items_subtotal),0), order_row.delivery_fee,
    coalesce(sum(sot.items_subtotal),0)+order_row.delivery_fee,
    order_row.delivery_zone_id, order_row.delivery_zone_name_snapshot, task_row.delivered_at
  from public.store_orders so join public.store_order_totals sot on sot.store_order_id=so.id
  where so.customer_order_id=target_customer_order and so.status='delivered'
  on conflict (customer_order_id) do nothing;

  insert into public.driver_delivery_fee_entitlements(
    customer_order_id, delivery_task_id, driver_id, currency,
    delivery_fee_amount, delivery_zone_id, delivery_zone_name_snapshot, delivered_at
  ) values (
    order_row.id, task_row.id, task_row.driver_id, order_row.delivery_currency,
    order_row.delivery_fee, order_row.delivery_zone_id,
    order_row.delivery_zone_name_snapshot, task_row.delivered_at
  ) on conflict (customer_order_id) do nothing;

  -- Existing, pre-migration commissions are not backfilled because they never
  -- pass through this delivery transition.
  insert into public.merchant_order_entitlements(
    store_order_id, merchant_id, commission_id, currency,
    gross_items_amount, commission_amount_at_delivery,
    initial_net_entitlement_amount, delivered_at
  )
  select
    so.id, s.merchant_id, c.id, sot.currency,
    sot.items_subtotal, c.commission_amount,
    sot.items_subtotal - c.commission_amount, task_row.delivered_at
  from public.store_orders so
  join public.stores s on s.id = so.store_id
  join public.store_order_totals sot on sot.store_order_id = so.id
  join public.store_order_commissions c
    on c.store_order_id = so.id
   and c.currency = sot.currency
   and c.status = 'due'
  where so.customer_order_id = target_customer_order
    and so.status = 'delivered'
  on conflict (store_order_id) do nothing;
end;
$$;

create or replace function public.append_commission_reversal_entitlement_adjustment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.merchant_order_entitlement_adjustments(
    merchant_order_entitlement_id, merchant_id, currency, amount,
    effect, source_type, source_id
  )
  select
    e.id, e.merchant_id, e.currency, new.amount,
    'increase_entitlement', 'commission_reversal', new.id
  from public.merchant_order_entitlements e
  where e.commission_id = new.commission_id
    and e.merchant_id = new.merchant_id
    and e.currency = new.currency
  on conflict (source_type, source_id) do nothing;
  return new;
end;
$$;

create or replace function public.record_driver_cash_remittance(
  target_driver uuid,
  remittance_amount numeric,
  remittance_idempotency_key uuid,
  remittance_reference text default null,
  remittance_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_row public.driver_cash_remittances%rowtype;
  remittance_id uuid;
  normalized_reference text := nullif(trim(remittance_reference), '');
  normalized_note text := coalesce(nullif(trim(remittance_note), ''), '');
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if remittance_amount is null or remittance_amount::text in ('NaN', 'Infinity', '-Infinity')
     or remittance_amount <= 0 or remittance_amount <> round(remittance_amount, 2) then
    raise exception 'remittance amount must be positive with at most two decimal places';
  end if;
  if remittance_idempotency_key is null then raise exception 'remittance idempotency key is required'; end if;
  if char_length(normalized_note) > 1500 or (normalized_reference is not null and char_length(normalized_reference) > 250) then
    raise exception 'remittance note or reference is too long';
  end if;

  select * into existing_row from public.driver_cash_remittances
  where idempotency_key = remittance_idempotency_key for update;
  if found then
    if existing_row.driver_id <> target_driver or existing_row.currency <> 'SYP'::public.currency_code
       or existing_row.amount <> remittance_amount or existing_row.external_reference is distinct from normalized_reference
       or existing_row.note <> normalized_note then
      raise exception 'remittance idempotency key was reused with different details';
    end if;
    return existing_row.id;
  end if;

  if not exists (select 1 from public.driver_applications da where da.user_id = target_driver and da.status = 'accepted') then
    raise exception 'approved driver account required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_driver::text || ':SYP', 0));
  insert into public.driver_cash_remittances(
    driver_id, currency, amount, idempotency_key, external_reference, note, received_by
  ) values (
    target_driver, 'SYP'::public.currency_code, remittance_amount, remittance_idempotency_key,
    normalized_reference, normalized_note, auth.uid()
  ) returning id into remittance_id;
  return remittance_id;
end;
$$;

create or replace function public.pay_driver_cash_credit(
  target_driver uuid,
  payout_amount numeric,
  payout_idempotency_key uuid,
  payout_reference text default null,
  payout_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_row public.driver_cash_credit_payouts%rowtype;
  current_credit numeric(14,2);
  payout_id uuid;
  normalized_reference text := nullif(trim(payout_reference), '');
  normalized_note text := coalesce(nullif(trim(payout_note), ''), '');
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if payout_amount is null or payout_amount::text in ('NaN', 'Infinity', '-Infinity')
     or payout_amount <= 0 or payout_amount <> round(payout_amount, 2) then
    raise exception 'credit payout amount must be positive with at most two decimal places';
  end if;
  if payout_idempotency_key is null then raise exception 'credit payout idempotency key is required'; end if;
  if char_length(normalized_note) > 1500 or (normalized_reference is not null and char_length(normalized_reference) > 250) then
    raise exception 'credit payout note or reference is too long';
  end if;

  select * into existing_row from public.driver_cash_credit_payouts
  where idempotency_key = payout_idempotency_key for update;
  if found then
    if existing_row.driver_id <> target_driver or existing_row.currency <> 'SYP'::public.currency_code
       or existing_row.amount <> payout_amount or existing_row.external_reference is distinct from normalized_reference
       or existing_row.note <> normalized_note then
      raise exception 'credit payout idempotency key was reused with different details';
    end if;
    return existing_row.id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_driver::text || ':SYP', 0));
  select p.driver_credit_amount into current_credit
  from public.driver_cash_custody_positions p
  where p.driver_id = target_driver and p.currency = 'SYP'::public.currency_code;
  if coalesce(current_credit, 0) < payout_amount then
    raise exception 'credit payout exceeds the available driver credit';
  end if;

  insert into public.driver_cash_credit_payouts(
    driver_id, currency, amount, idempotency_key, external_reference, note, paid_by
  ) values (
    target_driver, 'SYP'::public.currency_code, payout_amount, payout_idempotency_key,
    normalized_reference, normalized_note, auth.uid()
  ) returning id into payout_id;
  return payout_id;
end;
$$;

create or replace function public.create_merchant_settlement_batch(
  target_merchant uuid, entitlement_ids uuid[],
  batch_idempotency_key uuid, period_start_value timestamptz default null,
  period_end_value timestamptz default null, batch_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare batch_id_value uuid; normalized_note text := coalesce(nullif(trim(batch_note), ''), ''); existing_row public.merchant_settlement_batches%rowtype; expected_count integer;
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if batch_idempotency_key is null or cardinality(entitlement_ids) is null or cardinality(entitlement_ids) = 0 then raise exception 'a batch key and at least one entitlement are required'; end if;
  if cardinality(entitlement_ids) <> cardinality(array(select distinct unnest(entitlement_ids))) then raise exception 'duplicate entitlement selected'; end if;
  if char_length(normalized_note) > 1500 then raise exception 'settlement note is too long'; end if;
  select * into existing_row from public.merchant_settlement_batches where idempotency_key = batch_idempotency_key for update;
  if found then
    if existing_row.merchant_id <> target_merchant or existing_row.currency <> 'SYP'::public.currency_code then raise exception 'settlement idempotency key was reused with different details'; end if;
    return existing_row.id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_merchant::text || ':SYP', 0));
  select count(*) into expected_count from public.merchant_order_entitlement_positions p
  where p.merchant_id = target_merchant and p.currency = 'SYP'::public.currency_code and p.status = 'pending_settlement'
    and p.merchant_order_entitlement_id = any(entitlement_ids)
    and p.current_entitlement_amount > coalesce((
      select sum(a.amount) from public.merchant_settlement_payment_allocations a
      join public.merchant_settlement_batch_entitlements be on be.id = a.batch_entitlement_id
      where be.merchant_order_entitlement_id = p.merchant_order_entitlement_id
    ), 0) + coalesce((
      select sum(be.amount_snapshot) from public.merchant_settlement_batch_entitlements be
      join public.merchant_settlement_batches b on b.id = be.batch_id
      where be.merchant_order_entitlement_id = p.merchant_order_entitlement_id and b.status = 'open'
    ), 0);
  if expected_count <> cardinality(entitlement_ids) then raise exception 'one or more entitlements are unavailable for settlement'; end if;
  insert into public.merchant_settlement_batches(merchant_id,currency,idempotency_key,period_starts_at,period_ends_at,note,created_by)
  values(target_merchant,'SYP'::public.currency_code,batch_idempotency_key,period_start_value,period_end_value,normalized_note,auth.uid()) returning id into batch_id_value;
  insert into public.merchant_settlement_batch_entitlements(batch_id,merchant_order_entitlement_id,amount_snapshot)
  select batch_id_value,p.merchant_order_entitlement_id,
    p.current_entitlement_amount - coalesce((select sum(a.amount) from public.merchant_settlement_payment_allocations a join public.merchant_settlement_batch_entitlements be on be.id = a.batch_entitlement_id where be.merchant_order_entitlement_id = p.merchant_order_entitlement_id), 0)
      - coalesce((select sum(be.amount_snapshot) from public.merchant_settlement_batch_entitlements be join public.merchant_settlement_batches b on b.id = be.batch_id where be.merchant_order_entitlement_id = p.merchant_order_entitlement_id and b.status = 'open'), 0)
  from public.merchant_order_entitlement_positions p where p.merchant_order_entitlement_id = any(entitlement_ids);
  return batch_id_value;
end;
$$;

create or replace function public.record_merchant_settlement_payment(
  target_batch uuid, payment_amount numeric, payment_allocations jsonb, payment_idempotency_key uuid,
  payment_reference text default null, payment_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare batch_row public.merchant_settlement_batches%rowtype; payment_id_value uuid; existing_row public.merchant_settlement_payments%rowtype; normalized_note text := coalesce(nullif(trim(payment_note), ''), ''); normalized_reference text := nullif(trim(payment_reference), ''); allocated_total numeric(14,2); allocation record; remaining_value numeric(14,2); has_remaining boolean;
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if payment_amount is null or payment_amount::text in ('NaN','Infinity','-Infinity') or payment_amount <= 0 or payment_amount <> round(payment_amount,2) then raise exception 'payment amount must be positive with at most two decimal places'; end if;
  if payment_idempotency_key is null or jsonb_typeof(payment_allocations) <> 'array' or jsonb_array_length(payment_allocations) = 0 then raise exception 'a payment key and allocations are required'; end if;
  if char_length(normalized_note) > 1500 or (normalized_reference is not null and char_length(normalized_reference) > 250) then raise exception 'payment note or reference is too long'; end if;
  select * into existing_row from public.merchant_settlement_payments where idempotency_key = payment_idempotency_key for update;
  if found then
    if existing_row.batch_id <> target_batch or existing_row.amount <> payment_amount or existing_row.external_reference is distinct from normalized_reference or existing_row.note <> normalized_note then raise exception 'payment idempotency key was reused with different details'; end if;
    return existing_row.id;
  end if;
  select * into batch_row from public.merchant_settlement_batches where id = target_batch for update;
  if not found or batch_row.status <> 'open' then raise exception 'open settlement batch not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(batch_row.merchant_id::text || ':' || batch_row.currency::text, 0));
  select coalesce(sum((item->>'amount')::numeric),0) into allocated_total from jsonb_array_elements(payment_allocations) item;
  if allocated_total <> payment_amount then raise exception 'payment allocations must equal the payment amount'; end if;
  if (select count(*) from (select distinct item->>'batch_entitlement_id' from jsonb_array_elements(payment_allocations) item) unique_allocations) <> jsonb_array_length(payment_allocations) then raise exception 'duplicate payment allocation selected'; end if;
  for allocation in select (item->>'batch_entitlement_id')::uuid as batch_entitlement_id, (item->>'amount')::numeric as amount from jsonb_array_elements(payment_allocations) item loop
    if allocation.amount <= 0 or allocation.amount <> round(allocation.amount,2) then raise exception 'allocation amount is invalid'; end if;
    select p.remaining_amount into remaining_value from public.merchant_settlement_batch_positions p where p.batch_entitlement_id = allocation.batch_entitlement_id and p.batch_id = batch_row.id;
    if remaining_value is null or allocation.amount > remaining_value then raise exception 'payment allocation exceeds the remaining entitlement'; end if;
  end loop;
  insert into public.merchant_settlement_payments(batch_id,merchant_id,currency,amount,idempotency_key,external_reference,note,paid_by)
  values(batch_row.id,batch_row.merchant_id,batch_row.currency,payment_amount,payment_idempotency_key,normalized_reference,normalized_note,auth.uid()) returning id into payment_id_value;
  insert into public.merchant_settlement_payment_allocations(payment_id,batch_entitlement_id,amount)
  select payment_id_value,(item->>'batch_entitlement_id')::uuid,(item->>'amount')::numeric from jsonb_array_elements(payment_allocations) item;
  select exists(select 1 from public.merchant_settlement_batch_positions p where p.batch_id = batch_row.id and p.remaining_amount > 0) into has_remaining;
  if not has_remaining then update public.merchant_settlement_batches set status = 'completed', completed_at = now(), completed_by = auth.uid() where id = batch_row.id; end if;
  return payment_id_value;
end;
$$;

create or replace function public.admin_financial_report(
  report_kind text,
  period_from timestamptz default null,
  period_until timestamptz default null,
  movement_type text default null,
  target_driver uuid default null,
  zone_snapshot text default null,
  page_number integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result_value jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if report_kind is null or report_kind not in ('cash', 'delivery', 'custody') then
    raise exception 'unsupported report';
  end if;
  if page_number is null or page_number < 0 or page_number > 1000000 then
    raise exception 'invalid page';
  end if;
  if period_from is not null and period_until is not null and period_from >= period_until then
    raise exception 'invalid period';
  end if;
  if movement_type is not null and movement_type not in
    ('driver_remittance', 'driver_credit_payout', 'merchant_settlement_payment', 'subscription_payment') then
    raise exception 'invalid movement type';
  end if;

  if report_kind = 'cash' then
    with filtered as materialized (
      select e.*, coalesce(p.full_name, mp.full_name, 'طرف غير محدد') as party_name,
        sp.batch_id
      from public.admin_cash_movement_events e
      left join public.profiles p on p.id = e.party_id
        and e.event_type in ('driver_remittance', 'driver_credit_payout')
      left join public.merchants m on m.id = e.party_id
        and e.event_type in ('merchant_settlement_payment', 'subscription_payment')
      left join public.profiles mp on mp.id = m.owner_user_id
      left join public.merchant_settlement_payments sp on sp.id = e.id
        and e.event_type = 'merchant_settlement_payment'
      where true
        and (period_from is null or e.occurred_at >= period_from)
        and (period_until is null or e.occurred_at < period_until)
        and (movement_type is null or e.event_type = movement_type)
    ), totals as (
      select currency, count(*) as movement_count,
        coalesce(sum(amount) filter (where direction = 'inflow'), 0) as inflow,
        coalesce(sum(amount) filter (where direction = 'outflow'), 0) as outflow
      from filtered group by currency
    ), details as (
      select * from filtered order by occurred_at desc, event_type, id
      limit 20 offset (page_number::bigint * 20)
    )
    select jsonb_build_object(
      'summary', coalesce((select jsonb_agg(to_jsonb(t) order by currency) from totals t), '[]'::jsonb),
      'rows', coalesce((select jsonb_agg(to_jsonb(d) order by occurred_at desc, event_type, id) from details d), '[]'::jsonb),
      'count', (select count(*) from filtered), 'groups', '[]'::jsonb, 'options', '[]'::jsonb
    ) into result_value;
  elsif report_kind = 'delivery' then
    with source as materialized (
      select e.*, coalesce(p.full_name, 'سائق غير محدد') as party_name,
        coalesce(nullif(trim(e.delivery_zone_name_snapshot), ''), 'منطقة غير محددة') as zone_name,
        coalesce(e.delivery_zone_id::text, 'unknown') || '|' ||
          coalesce(nullif(trim(e.delivery_zone_name_snapshot), ''), 'منطقة غير محددة') as zone_key
      from public.admin_delivery_fee_report_rows e
      left join public.profiles p on p.id = e.driver_id
    ), filtered as materialized (
      select * from source e
      where true
        and (period_from is null or e.delivered_at >= period_from)
        and (period_until is null or e.delivered_at < period_until)
        and (target_driver is null or e.driver_id = target_driver)
        and (zone_snapshot is null or e.zone_key = zone_snapshot)
    ), totals as (
      select currency, sum(delivery_fee_amount) as delivery_fee_amount,
        count(*) as delivered_count, avg(delivery_fee_amount) as average_fee,
        count(distinct driver_id) as driver_count from filtered group by currency
    ), grouped as (
      select currency, 'zone'::text as group_type, zone_name as label, zone_key as group_key,
        sum(delivery_fee_amount) as delivery_fee_amount, count(*) as delivered_count
      from filtered group by currency, zone_name, zone_key
      union all
      select currency, 'driver', party_name, driver_id::text,
        sum(delivery_fee_amount), count(*) from filtered group by currency, driver_id, party_name
    ), details as (
      select * from filtered order by delivered_at desc, customer_order_id
      limit 20 offset (page_number::bigint * 20)
    ), choices as (
      select distinct 'driver'::text as kind, driver_id::text as value, party_name as label from source
      union
      select distinct 'zone', zone_key, zone_name from source
    )
    select jsonb_build_object(
      'summary', coalesce((select jsonb_agg(to_jsonb(t) order by currency) from totals t), '[]'::jsonb),
      'rows', coalesce((select jsonb_agg(to_jsonb(d) order by delivered_at desc, customer_order_id) from details d), '[]'::jsonb),
      'count', (select count(*) from filtered),
      'groups', coalesce((select jsonb_agg(to_jsonb(g) order by currency, group_type, label) from grouped g), '[]'::jsonb),
      'options', coalesce((select jsonb_agg(to_jsonb(c) order by kind, label, value) from choices c), '[]'::jsonb)
    ) into result_value;
  else
    -- Current positions never receive a date filter. Period flows are grouped
    -- independently before joining on currency; they cannot multiply balances.
    with positions as materialized (
      select c.*, coalesce(p.full_name, 'سائق غير محدد') as party_name
      from public.driver_cash_custody_positions c
      left join public.profiles p on p.id = c.driver_id
      where true
        and (target_driver is null or c.driver_id = target_driver)
    ), movements as (
      select driver_id, currency, delivered_at as occurred_at, collectible_amount as obligations,
        0::numeric as receipts, 0::numeric as payouts
      from public.customer_order_cash_obligations
      union all
      select driver_id, currency, received_at, 0, amount, 0 from public.driver_cash_remittances
      union all
      select driver_id, currency, paid_at, 0, 0, amount from public.driver_cash_credit_payouts
    ), flows as (
      select currency, sum(obligations) as period_obligations,
        sum(receipts) as period_receipts, sum(payouts) as period_payouts
      from movements e
      where true
        and (target_driver is null or e.driver_id = target_driver)
        and (period_from is null or e.occurred_at >= period_from)
        and (period_until is null or e.occurred_at < period_until)
      group by currency
    ), totals as (
      select currency, sum(cash_collected_amount) as cash_collected_amount,
        sum(delivery_fee_entitled_amount) as delivery_fee_entitled_amount,
        sum(net_custody_due_amount) as net_custody_due_amount,
        sum(office_received_amount) as office_received_amount,
        sum(custody_remaining_amount) as custody_remaining_amount,
        sum(driver_credit_amount) as driver_credit_amount,
        sum(driver_credit_paid_amount) as driver_credit_paid_amount
      from positions group by currency
    ), details as (
      select * from positions order by driver_id, currency
      limit 20 offset (page_number::bigint * 20)
    ), choices as (
      select distinct c.driver_id::text as value, coalesce(p.full_name, 'سائق غير محدد') as label,
        'driver'::text as kind
      from public.driver_cash_custody_positions c left join public.profiles p on p.id = c.driver_id
    )
    select jsonb_build_object(
      'summary', coalesce((select jsonb_agg(to_jsonb(t) order by currency) from totals t), '[]'::jsonb),
      'rows', coalesce((select jsonb_agg(to_jsonb(d) order by driver_id, currency) from details d), '[]'::jsonb),
      'count', (select count(*) from positions),
      'groups', coalesce((select jsonb_agg(to_jsonb(f) order by currency) from flows f), '[]'::jsonb),
      'options', coalesce((select jsonb_agg(to_jsonb(c) order by label, value) from choices c), '[]'::jsonb)
    ) into result_value;
  end if;
  return result_value;
end;
$$;

create or replace function public.admin_sales_revenue_report(
  report_kind text,
  period_from timestamptz default null,
  period_until timestamptz default null,
  target_merchant uuid default null,
  detail_type text default null,
  settlement_state text default null,
  page_number integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result_value jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if report_kind is null or report_kind not in ('merchant', 'platform') then raise exception 'unsupported report'; end if;
  if page_number is null or page_number < 0 or page_number > 1000000 then raise exception 'invalid page'; end if;
  if period_from is not null and period_until is not null and period_from >= period_until then raise exception 'invalid period'; end if;
  if settlement_state is not null and settlement_state not in ('open', 'completed', 'partially_paid') then raise exception 'invalid settlement state'; end if;
  if detail_type is not null and (
    (report_kind = 'merchant' and detail_type not in ('entitlement', 'entitlement_adjustment', 'merchant_payment', 'settlement')) or
    (report_kind = 'platform' and detail_type not in ('commission', 'commission_reversal', 'invoice', 'subscription_payment', 'invoice_allocation'))
  ) then raise exception 'invalid detail type'; end if;

  with source as materialized (
    select e.id, e.merchant_id, e.currency, e.occurred_at, e.event_type, e.amount,
      to_jsonb(e) as payload
    from public.admin_merchant_financial_report_events e where report_kind = 'merchant'
    union all
    select e.id, e.merchant_id, e.currency, e.occurred_at, e.event_type, e.amount, to_jsonb(e)
    from public.admin_platform_revenue_report_events e where report_kind = 'platform'
  ), scope as materialized (
    select s.*, coalesce(p.full_name, 'تاجر غير محدد') as party_name,
      so.customer_order_id
    from source s
    left join public.merchants m on m.id = s.merchant_id
    left join public.profiles p on p.id = m.owner_user_id
    left join public.store_orders so on so.id = (s.payload->>'store_order_id')::uuid
    where true
      and (target_merchant is null or s.merchant_id = target_merchant)
  ), period_events as materialized (
    select * from scope s where (period_from is null or s.occurred_at >= period_from)
      and (period_until is null or s.occurred_at < period_until)
  ), period_totals as (
    select currency,
      coalesce(sum(amount) filter (where event_type = 'entitlement'), 0) as period_sales_entitlements,
      coalesce(sum(amount) filter (where event_type = 'entitlement_adjustment'), 0) as period_entitlement_adjustments,
      coalesce(sum(amount) filter (where event_type = 'merchant_payment'), 0) as period_merchant_payments,
      coalesce(sum(amount) filter (where event_type = 'commission'), 0) as commissions,
      coalesce(sum(amount) filter (where event_type = 'commission_reversal'), 0) as commission_reversals,
      coalesce(sum(case when event_type = 'commission' then amount when event_type = 'commission_reversal' then -amount else 0 end), 0) as net_commissions,
      coalesce(sum(amount) filter (where event_type = 'invoice'), 0) as invoices_issued,
      count(*) filter (where event_type = 'invoice') as invoice_count,
      coalesce(sum(amount) filter (where event_type = 'subscription_payment'), 0) as payments_registered,
      coalesce(sum(amount) filter (where event_type = 'invoice_allocation'), 0) as period_allocations
    from period_events group by currency
  ), invoice_positions as (
    -- Remaining is the current balance of invoices issued in the selected
    -- period, including allocations made later; it is not a historical balance.
    select s.currency, sum(s.amount - coalesce((select sum(a.amount)
      from public.invoice_payment_allocations a where a.invoice_id = s.id), 0)) as invoice_remaining
    from period_events s where event_type = 'invoice' group by s.currency
  ), payment_positions as (
    select s.currency, sum(coalesce((select sum(a.amount)
      from public.invoice_payment_allocations a where a.payment_id = s.id), 0)) as payments_allocated
    from period_events s where event_type = 'subscription_payment' group by s.currency
  ), current_merchant as (
    select currency,
      coalesce(sum(amount) filter (where event_type = 'entitlement'), 0) as sales_entitlements,
      coalesce(sum(amount) filter (where event_type = 'entitlement_adjustment'), 0) as entitlement_adjustments,
      coalesce(sum(amount) filter (where event_type = 'merchant_payment'), 0) as merchant_payments,
      coalesce(sum(case when event_type in ('entitlement', 'entitlement_adjustment') then amount
        when event_type = 'merchant_payment' then -amount else 0 end), 0) as merchant_remaining
    from scope group by currency
  ), unbatched as (
    -- Match Migration 010 availability: subtract actual allocations and open
    -- reservations independently. Later adjustments can become available again.
    select e.currency, sum(greatest(e.current_entitlement_amount
      - coalesce((select sum(a.amount) from public.merchant_settlement_payment_allocations a
        join public.merchant_settlement_batch_entitlements be on be.id = a.batch_entitlement_id
        where be.merchant_order_entitlement_id = e.merchant_order_entitlement_id), 0)
      - coalesce((select sum(be.amount_snapshot) from public.merchant_settlement_batch_entitlements be
        join public.merchant_settlement_batches b on b.id = be.batch_id
        where be.merchant_order_entitlement_id = e.merchant_order_entitlement_id and b.status = 'open'), 0), 0)) as unbatched_entitlements
    from public.merchant_order_entitlement_positions e
    where report_kind = 'merchant' and true
      and (target_merchant is null or e.merchant_id = target_merchant) group by e.currency
  ), batches as (
    select currency, count(*) filter (where payload->>'status' in ('open', 'partially_paid')) as open_settlements,
      count(*) filter (where payload->>'status' = 'completed') as completed_settlements,
      count(*) filter (where payload->>'status' = 'partially_paid') as partial_settlements
    from period_events where event_type = 'settlement' group by currency
  ), filtered_details as materialized (
    select * from period_events s where (detail_type is null or s.event_type = detail_type)
      and (report_kind <> 'merchant' or settlement_state is null or
        (s.event_type = 'settlement' and s.payload->>'status' = settlement_state))
  ), details as (
    select * from filtered_details order by occurred_at desc, event_type, id
    limit 20 offset (page_number::bigint * 20)
  ), summaries as (
    select t.currency, case when report_kind = 'merchant' then
      jsonb_build_object('currency', t.currency,
        'period_sales_entitlements', t.period_sales_entitlements,
        'period_entitlement_adjustments', t.period_entitlement_adjustments,
        'period_merchant_payments', t.period_merchant_payments,
        'open_settlements', coalesce(b.open_settlements, 0),
        'completed_settlements', coalesce(b.completed_settlements, 0),
        'partial_settlements', coalesce(b.partial_settlements, 0))
      else jsonb_build_object('currency', t.currency, 'commissions', t.commissions,
        'commission_reversals', t.commission_reversals, 'net_commissions', t.net_commissions,
        'invoices_issued', t.invoices_issued, 'invoice_count', t.invoice_count,
        'payments_registered', t.payments_registered,
        'payments_allocated', coalesce(pp.payments_allocated, 0),
        'payments_unallocated', t.payments_registered - coalesce(pp.payments_allocated, 0),
        'invoice_remaining', coalesce(ip.invoice_remaining, 0), 'period_allocations', t.period_allocations) end as payload
    from period_totals t left join batches b using (currency)
    left join invoice_positions ip using (currency) left join payment_positions pp using (currency)
  ), current_totals as (
    select c.*, coalesce(u.unbatched_entitlements, 0) as unbatched_entitlements
    from current_merchant c left join unbatched u using (currency) where report_kind = 'merchant'
  ), choices as (
    select distinct s.merchant_id::text as value, coalesce(p.full_name, 'تاجر غير محدد') as label,
      'merchant'::text as kind
    from source s join public.merchants m on m.id = s.merchant_id
    left join public.profiles p on p.id = m.owner_user_id
  )
  select jsonb_build_object(
    'summary', coalesce((select jsonb_agg(payload order by currency) from summaries), '[]'::jsonb),
    'groups', coalesce((select jsonb_agg(to_jsonb(c) order by currency) from current_totals c), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(payload || jsonb_build_object('party_name', party_name,
      'customer_order_id', customer_order_id) order by occurred_at desc, event_type, id) from details), '[]'::jsonb),
    'count', (select count(*) from filtered_details),
    'options', coalesce((select jsonb_agg(to_jsonb(c) order by label, value) from choices c), '[]'::jsonb)
  ) into result_value;
  return result_value;
end;
$$;

create or replace function public.merchant_financial_account(
  section_name text default 'overview',
  period_from timestamptz default null,
  period_until timestamptz default null,
  selected_status text default null,
  order_search text default null,
  record_id uuid default null,
  page_number integer default 0,
  payments_page integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  own_merchant uuid;
  header_value jsonb := null;
  result_value jsonb;
  own_entitlement uuid;
  own_commission uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select m.id into own_merchant from public.merchants m where m.owner_user_id = auth.uid();
  if own_merchant is null then raise exception 'merchant access required' using errcode = '42501'; end if;
  if section_name is null or section_name not in ('overview','sales','sale','settlements','settlement','commissions','invoices','payments') then
    raise exception 'invalid section';
  end if;
  if page_number is null or page_number < 0 or page_number > 1000000
    or payments_page is null or payments_page < 0 or payments_page > 1000000 then raise exception 'invalid page'; end if;
  if period_from is not null and period_until is not null and period_from >= period_until then raise exception 'invalid period'; end if;
  if selected_status is not null and selected_status not in ('open','partially_paid','completed','unsettled') then raise exception 'invalid status'; end if;
  if char_length(coalesce(order_search, '')) > 30 or coalesce(order_search, '') !~ '^[0-9]*$' then raise exception 'invalid order number'; end if;

  if section_name = 'overview' then
    with sales as materialized (
      select * from public.merchant_account_sale_rows s where s.merchant_id = own_merchant
    ), batches as materialized (
      select * from public.merchant_account_settlement_rows b where b.merchant_id = own_merchant
    ), keys as (
      select currency from sales union select currency from batches
      union select p.currency from public.merchant_settlement_payments p where p.merchant_id = own_merchant
    ), sale_totals as (
      select currency, sum(gross_items_amount) as gross_items_amount,
        sum(commission_amount_at_delivery) as commission_amount_at_delivery,
        sum(adjustment_amount) as adjustment_amount,
        sum(net_commission_amount) as net_commission_amount,
        sum(current_entitlement_amount) as current_entitlement_amount,
        sum(unbatched_amount) as unbatched_amount, count(*) as delivered_count
      from sales group by currency
    ), payment_totals as (
      select p.currency, sum(p.amount) as paid_amount from public.merchant_settlement_payments p
      where p.merchant_id = own_merchant group by p.currency
    ), batch_totals as (
      select currency, count(*) filter (where status = 'open') as open_count,
        count(*) filter (where settlement_status = 'partially_paid') as partial_count,
        count(*) filter (where status = 'completed') as completed_count
      from batches group by currency
    ), totals as (
      select k.currency, coalesce(s.gross_items_amount, 0) as gross_items_amount,
        coalesce(s.commission_amount_at_delivery, 0) as commission_amount_at_delivery,
        coalesce(s.adjustment_amount, 0) as adjustment_amount,
        coalesce(s.net_commission_amount, 0) as net_commission_amount,
        coalesce(s.current_entitlement_amount, 0) as current_entitlement_amount,
        coalesce(p.paid_amount, 0) as paid_amount,
        coalesce(s.current_entitlement_amount, 0) - coalesce(p.paid_amount, 0) as remaining_amount,
        coalesce(s.unbatched_amount, 0) as unbatched_amount, coalesce(s.delivered_count, 0) as delivered_count,
        coalesce(b.open_count, 0) as open_count, coalesce(b.partial_count, 0) as partial_count,
        coalesce(b.completed_count, 0) as completed_count
      from keys k left join sale_totals s using (currency)
      left join payment_totals p using (currency) left join batch_totals b using (currency)
    ), subscription as (
      -- A future renewal must not replace the latest period that has started.
      select s.plan_name_snapshot, s.starts_at, s.expires_at, s.commission_rate_snapshot,
        s.currency_snapshot, s.price_snapshot,
        coalesce((select bs.auto_renew from public.merchant_billing_settings bs where bs.merchant_id = own_merchant), false) as auto_renew,
        case when now() < s.expires_at then 'active'
          when now() < s.expires_at + interval '7 days' then 'grace' else 'expired' end as subscription_status
      from public.merchant_subscriptions s where s.merchant_id = own_merchant and s.starts_at <= now()
      order by s.starts_at desc, s.id desc limit 1
    )
    select jsonb_build_object(
      'summary', coalesce((select jsonb_agg(to_jsonb(t) order by currency) from totals t), '[]'::jsonb),
      'obligations', coalesce((select jsonb_agg(to_jsonb(p) - 'merchant_id' order by p.currency)
        from public.merchant_financial_positions p where p.merchant_id = own_merchant), '[]'::jsonb),
      'subscription', (select to_jsonb(s) from subscription s),
      'rows', '[]'::jsonb, 'count', 0, 'record', null,
      'payments', '[]'::jsonb, 'payments_count', 0
    ) into result_value;
    return result_value;
  end if;

  if section_name = 'sale' then
    select to_jsonb(s) - 'merchant_id', s.merchant_order_entitlement_id, s.commission_id
    into header_value, own_entitlement, own_commission
    from public.merchant_account_sale_rows s where s.merchant_id = own_merchant and s.store_order_id = record_id;
    if header_value is null then raise exception 'record not found' using errcode = 'P0002'; end if;
  elsif section_name = 'settlement' then
    select to_jsonb(b) - 'merchant_id' - 'created_by' - 'completed_by' - 'idempotency_key'
    into header_value from public.merchant_account_settlement_rows b
    where b.merchant_id = own_merchant and b.id = record_id;
    if header_value is null then raise exception 'record not found' using errcode = 'P0002'; end if;
  end if;

  with source as materialized (
    select s.store_order_id as id, s.delivered_at as occurred_at, s.currency,
      s.settlement_status as status, s.order_number::text as order_number,
      to_jsonb(s) - 'merchant_id' as payload
    from public.merchant_account_sale_rows s where section_name = 'sales' and s.merchant_id = own_merchant
    union all
    select b.id, b.created_at, b.currency, b.settlement_status, null::text,
      to_jsonb(b) - 'merchant_id' - 'created_by' - 'completed_by' - 'idempotency_key'
    from public.merchant_account_settlement_rows b where section_name = 'settlements' and b.merchant_id = own_merchant
    union all
    select c.id, c.due_at, c.currency, c.status, co.order_number::text,
      jsonb_build_object('id', c.id, 'store_order_id', c.store_order_id, 'order_number', co.order_number,
        'currency', c.currency, 'base_amount', c.base_amount, 'commission_rate', c.commission_rate,
        'commission_amount', c.commission_amount, 'reversed_amount', r.amount,
        'net_commission_amount', c.commission_amount - r.amount, 'occurred_at', c.due_at)
    from public.store_order_commissions c
    join public.store_orders so on so.id = c.store_order_id
    join public.customer_orders co on co.id = so.customer_order_id
    cross join lateral (select coalesce(sum(r.amount), 0) as amount from public.store_order_commission_reversals r where r.commission_id = c.id) r
    where section_name = 'commissions' and c.merchant_id = own_merchant and c.status = 'due'
    union all
    select i.id, i.created_at, i.currency, i.status, null::text,
      jsonb_build_object('id', i.id, 'invoice_number', i.invoice_number, 'currency', i.currency,
        'total_amount', i.total_amount, 'paid_amount', a.amount,
        'remaining_amount', case when i.status = 'void' then 0 else i.total_amount - a.amount end,
        'status', i.status, 'occurred_at', i.created_at, 'due_at', i.due_at,
        'starts_at', s.starts_at, 'expires_at', s.expires_at, 'plan_name_snapshot', s.plan_name_snapshot)
    from public.subscription_invoices i join public.merchant_subscriptions s on s.id = i.subscription_id
    cross join lateral (select coalesce(sum(a.amount), 0) as amount from public.invoice_payment_allocations a where a.invoice_id = i.id) a
    where section_name = 'invoices' and i.merchant_id = own_merchant
    union all
    select p.id, p.received_at, p.currency, null::text, null::text,
      jsonb_build_object('id', p.id, 'currency', p.currency, 'amount', p.amount,
        'allocated_amount', a.amount, 'unallocated_amount', p.amount - a.amount,
        'method', p.method, 'external_reference', p.external_reference, 'occurred_at', p.received_at)
    from public.subscription_payments p
    cross join lateral (select coalesce(sum(a.amount), 0) as amount from public.invoice_payment_allocations a where a.payment_id = p.id) a
    where section_name = 'payments' and p.merchant_id = own_merchant
    union all
    select p.batch_entitlement_id, p.delivered_at, p.currency, p.status, co.order_number::text,
      jsonb_build_object('id', p.batch_entitlement_id, 'store_order_id', p.store_order_id,
        'order_number', co.order_number, 'currency', p.currency,
        'current_entitlement_amount', p.current_entitlement_amount,
        'paid_amount', p.paid_amount, 'remaining_amount', p.remaining_amount, 'occurred_at', p.delivered_at)
    from public.merchant_settlement_batch_positions p
    join public.store_orders so on so.id = p.store_order_id
    join public.customer_orders co on co.id = so.customer_order_id
    where section_name = 'settlement' and p.merchant_id = own_merchant and p.batch_id = record_id
    union all
    select a.id, a.created_at, a.currency, null::text, null::text,
      jsonb_build_object('id', a.id, 'event_type', 'entitlement_adjustment', 'currency', a.currency,
        'amount', a.amount, 'occurred_at', a.created_at, 'source_type', a.source_type)
    from public.merchant_order_entitlement_adjustments a
    where section_name = 'sale' and a.merchant_id = own_merchant and a.merchant_order_entitlement_id = own_entitlement
    union all
    select r.id, r.created_at, r.currency, null::text, null::text,
      jsonb_build_object('id', r.id, 'event_type', 'commission_reversal', 'currency', r.currency,
        'amount', r.amount, 'reason', r.reason, 'occurred_at', r.created_at)
    from public.store_order_commission_reversals r
    where section_name = 'sale' and r.merchant_id = own_merchant and r.commission_id = own_commission
    union all
    select be.id, be.created_at, b.currency, b.status, null::text,
      jsonb_build_object('id', be.id, 'event_type', 'settlement_inclusion', 'currency', b.currency,
        'amount', be.amount_snapshot, 'batch_id', b.id, 'occurred_at', be.created_at)
    from public.merchant_settlement_batch_entitlements be
    join public.merchant_settlement_batches b on b.id = be.batch_id
    where section_name = 'sale' and b.merchant_id = own_merchant and be.merchant_order_entitlement_id = own_entitlement
    union all
    select a.id, p.paid_at, p.currency, null::text, null::text,
      jsonb_build_object('id', a.id, 'event_type', 'sale_payment', 'currency', p.currency,
        'amount', a.amount, 'batch_id', p.batch_id, 'external_reference', p.external_reference,
        'note', p.note, 'method', null, 'occurred_at', p.paid_at)
    from public.merchant_settlement_payment_allocations a
    join public.merchant_settlement_batch_entitlements be on be.id = a.batch_entitlement_id
    join public.merchant_settlement_payments p on p.id = a.payment_id
    where section_name = 'sale' and p.merchant_id = own_merchant and be.merchant_order_entitlement_id = own_entitlement
  ), filtered as materialized (
    select * from source s where true
      and (period_from is null or s.occurred_at >= period_from)
      and (period_until is null or s.occurred_at < period_until)
      and (selected_status is null or s.status = selected_status)
      and (coalesce(order_search, '') = '' or s.order_number = order_search)
  ), details as (
    select * from filtered order by occurred_at desc, id desc limit 20 offset (page_number::bigint * 20)
  ), totals as (
    -- Aggregate the full filtered sales cohort, never the page of details.
    select currency, sum((payload->>'gross_items_amount')::numeric) as gross_items_amount,
      sum((payload->>'commission_amount_at_delivery')::numeric) as commission_amount_at_delivery,
      sum((payload->>'adjustment_amount')::numeric) as adjustment_amount,
      sum((payload->>'current_entitlement_amount')::numeric) as current_entitlement_amount,
      sum((payload->>'paid_amount')::numeric) as paid_amount,
      sum((payload->>'remaining_amount')::numeric) as remaining_amount
    from filtered where section_name = 'sales' group by currency
  ), payment_rows as materialized (
    select p.id, p.currency, p.amount, p.paid_at as occurred_at, null::text as method,
      p.external_reference, p.note
    from public.merchant_settlement_payments p
    where section_name = 'settlement' and p.merchant_id = own_merchant and p.batch_id = record_id
  ), payment_details as (
    select * from payment_rows order by occurred_at desc, id desc limit 20 offset (payments_page::bigint * 20)
  )
  select jsonb_build_object(
    'summary', coalesce((select jsonb_agg(to_jsonb(t) order by currency) from totals t), '[]'::jsonb),
    'obligations', '[]'::jsonb, 'subscription', null, 'record', header_value,
    'rows', coalesce((select jsonb_agg(payload order by occurred_at desc, id desc) from details), '[]'::jsonb),
    'count', (select count(*) from filtered),
    'payments', coalesce((select jsonb_agg(to_jsonb(p) order by occurred_at desc, id desc) from payment_details p), '[]'::jsonb),
    'payments_count', (select count(*) from payment_rows)
  ) into result_value;
  return result_value;
end;
$$;

create or replace function public.notify_merchant_settlement_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id, type, title, body, data)
  select m.owner_user_id, 'system', 'تسجيل دفعة مستحقات',
    'سجّل المكتب دفعة من مستحقات مبيعاتك بقيمة ' || new.amount::text || ' ' || new.currency::text || '. راجع حسابك المالي للتفاصيل.',
    jsonb_build_object('route', '/merchant/finance')
  from public.merchants m where m.id = new.merchant_id;
  return new;
end;
$$;

create view public.merchant_financial_positions
with (security_barrier = true, security_invoker = true)
as
with currency_keys as (
  select merchant_id from public.subscription_invoices
  union
  select merchant_id from public.subscription_payments
  union
  select merchant_id from public.merchant_ledger_entries
  union
  select merchant_id from public.store_order_commissions
  union
  select merchant_id from public.merchant_credit_limits
), invoice_totals as (
  select i.merchant_id,
    coalesce(sum(i.total_amount) filter (where i.status <> 'void'), 0) as invoice_total,
    coalesce(sum(allocated.amount) filter (where i.status <> 'void'), 0) as invoice_allocated
  from public.subscription_invoices i
  left join lateral (
    select coalesce(sum(a.amount), 0) as amount
    from public.invoice_payment_allocations a
    where a.invoice_id = i.id
  ) allocated on true
  group by i.merchant_id
), payment_totals as (
  select p.merchant_id, coalesce(sum(p.amount), 0) as payments_recorded
  from public.subscription_payments p
  group by p.merchant_id
), ledger_totals as (
  select e.merchant_id,
    coalesce(sum(case when e.effect = 'increase_exposure' then e.amount else -e.amount end), 0)
      as booked_exposure
  from public.merchant_ledger_entries e
  group by e.merchant_id
), reversal_totals as (
  select r.commission_id, coalesce(sum(r.amount), 0) as reversed_amount
  from public.store_order_commission_reversals r
  group by r.commission_id
), commission_totals as (
  select c.merchant_id,
    coalesce(sum(c.commission_amount - coalesce(r.reversed_amount, 0)) filter (
      where c.status = 'due'
    ), 0) as commissions_due,
    coalesce(sum(c.commission_amount - coalesce(r.reversed_amount, 0)) filter (
      where c.status = 'due'
        and not exists (
          select 1 from public.merchant_ledger_entries e
          where e.source_type = 'store_order_commission' and e.source_id = c.id
        )
    ), 0) as unbooked_commissions_due
  from public.store_order_commissions c
  left join reversal_totals r on r.commission_id = c.id
  group by c.merchant_id
)
select k.merchant_id, 'SYP'::public.currency_code as currency,
  coalesce(i.invoice_total, 0)::numeric(14,2) as invoices_total,
  coalesce(i.invoice_allocated, 0)::numeric(14,2) as payments_allocated,
  greatest(coalesce(i.invoice_total, 0) - coalesce(i.invoice_allocated, 0), 0)::numeric(14,2)
    as invoice_outstanding,
  coalesce(p.payments_recorded, 0)::numeric(14,2) as payments_recorded,
  greatest(coalesce(p.payments_recorded, 0) - coalesce(i.invoice_allocated, 0), 0)::numeric(14,2)
    as unapplied_payment_balance,
  coalesce(c.commissions_due, 0)::numeric(14,2) as commissions_due,
  coalesce(l.booked_exposure, 0)::numeric(14,2) as booked_exposure,
  (coalesce(l.booked_exposure, 0) + coalesce(c.unbooked_commissions_due, 0))::numeric(14,2)
    as effective_exposure,
  coalesce(cl.credit_enabled, false) as credit_enabled,
  coalesce(cl.credit_limit, 0)::numeric(14,2) as credit_limit,
  case when coalesce(cl.credit_enabled, false)
    then greatest(coalesce(l.booked_exposure, 0) + coalesce(c.unbooked_commissions_due, 0), 0)::numeric(14,2)
    else 0::numeric(14,2)
  end as credit_used,
  case when coalesce(cl.credit_enabled, false)
    then greatest(
      coalesce(cl.credit_limit, 0) - greatest(
        coalesce(l.booked_exposure, 0) + coalesce(c.unbooked_commissions_due, 0), 0
      ),
      0
    )::numeric(14,2)
    else 0::numeric(14,2)
  end as credit_available
from currency_keys k
left join invoice_totals i on i.merchant_id = k.merchant_id
left join payment_totals p on p.merchant_id = k.merchant_id
left join ledger_totals l on l.merchant_id = k.merchant_id
left join commission_totals c on c.merchant_id = k.merchant_id
left join public.merchant_credit_limits cl
  on cl.merchant_id = k.merchant_id;

create view public.merchant_order_entitlement_positions
with (security_barrier = true, security_invoker = true)
as
select
  e.id as merchant_order_entitlement_id,
  e.store_order_id,
  e.merchant_id,
  e.commission_id,
  e.currency,
  e.gross_items_amount,
  e.commission_amount_at_delivery,
  e.initial_net_entitlement_amount,
  coalesce(sum(a.amount), 0)::numeric(14,2) as adjustment_amount,
  (e.initial_net_entitlement_amount + coalesce(sum(a.amount), 0))::numeric(14,2)
    as current_entitlement_amount,
  e.status,
  e.delivered_at,
  e.created_at
from public.merchant_order_entitlements e
left join public.merchant_order_entitlement_adjustments a
  on a.merchant_order_entitlement_id = e.id
group by e.id;

create view public.driver_cash_custody_positions
with (security_barrier = true, security_invoker = true)
as
with keys as (
  select driver_id from public.customer_order_cash_obligations
  union
  select driver_id from public.driver_delivery_fee_entitlements
  union
  select driver_id from public.driver_cash_remittances
  union
  select driver_id from public.driver_cash_credit_payouts
), cash_collected as (
  select driver_id, coalesce(sum(collectible_amount), 0)::numeric(14,2) as amount
  from public.customer_order_cash_obligations group by driver_id
), delivery_fees as (
  select driver_id, coalesce(sum(delivery_fee_amount), 0)::numeric(14,2) as amount
  from public.driver_delivery_fee_entitlements group by driver_id
), remitted as (
  select driver_id, coalesce(sum(amount), 0)::numeric(14,2) as amount
  from public.driver_cash_remittances group by driver_id
), paid_credits as (
  select driver_id, coalesce(sum(amount), 0)::numeric(14,2) as amount
  from public.driver_cash_credit_payouts group by driver_id
)
select k.driver_id, 'SYP'::public.currency_code as currency,
  coalesce(cc.amount, 0)::numeric(14,2) as cash_collected_amount,
  coalesce(df.amount, 0)::numeric(14,2) as delivery_fee_entitled_amount,
  greatest(coalesce(cc.amount, 0) - coalesce(df.amount, 0), 0)::numeric(14,2) as net_custody_due_amount,
  coalesce(r.amount, 0)::numeric(14,2) as office_received_amount,
  greatest(greatest(coalesce(cc.amount, 0) - coalesce(df.amount, 0), 0)
    - coalesce(r.amount, 0) + coalesce(pc.amount, 0), 0)::numeric(14,2) as custody_remaining_amount,
  greatest(coalesce(r.amount, 0) - greatest(coalesce(cc.amount, 0) - coalesce(df.amount, 0), 0)
    - coalesce(pc.amount, 0), 0)::numeric(14,2) as driver_credit_amount,
  coalesce(pc.amount, 0)::numeric(14,2) as driver_credit_paid_amount
from keys k
left join cash_collected cc on cc.driver_id = k.driver_id
left join delivery_fees df on df.driver_id = k.driver_id
left join remitted r on r.driver_id = k.driver_id
left join paid_credits pc on pc.driver_id = k.driver_id;

create view public.merchant_settlement_batch_positions
with (security_barrier = true, security_invoker = true)
as
select
  b.id as batch_id, b.merchant_id, b.currency, b.status, b.created_at,
  be.id as batch_entitlement_id, be.merchant_order_entitlement_id,
  p.store_order_id, p.delivered_at,
  be.amount_snapshot as current_entitlement_amount,
  coalesce(sum(a.amount), 0)::numeric(14,2) as paid_amount,
  greatest(be.amount_snapshot - coalesce(sum(a.amount), 0), 0)::numeric(14,2) as remaining_amount
from public.merchant_settlement_batches b
join public.merchant_settlement_batch_entitlements be on be.batch_id = b.id
join public.merchant_order_entitlement_positions p on p.merchant_order_entitlement_id = be.merchant_order_entitlement_id
left join public.merchant_settlement_payment_allocations a on a.batch_entitlement_id = be.id
group by b.id, be.id, p.merchant_order_entitlement_id, p.store_order_id, p.delivered_at, be.amount_snapshot;

create view public.admin_cash_movement_events
with (security_barrier = true, security_invoker = true) as
  select r.id, r.received_at as occurred_at, r.currency, r.amount,
    'driver_remittance'::text as event_type, 'inflow'::text as direction,
    r.driver_id as party_id, r.external_reference as reference, r.note
  from public.driver_cash_remittances r where public.is_admin()
  union all
  select p.id, p.paid_at, p.currency, p.amount,
    'driver_credit_payout'::text, 'outflow'::text,
    p.driver_id, p.external_reference, p.note
  from public.driver_cash_credit_payouts p where public.is_admin()
  union all
  select p.id, p.paid_at, p.currency, p.amount,
    'merchant_settlement_payment'::text, 'outflow'::text,
    p.merchant_id, p.external_reference, p.note
  from public.merchant_settlement_payments p where public.is_admin()
  union all
  select p.id, p.received_at, p.currency, p.amount,
    'subscription_payment'::text, 'inflow'::text,
    p.merchant_id, p.external_reference, ''::text
  from public.subscription_payments p where public.is_admin() and p.method = 'cash';

create view public.admin_delivery_fee_report_rows
with (security_barrier = true, security_invoker = true) as
  select e.customer_order_id, e.delivery_task_id, e.driver_id, e.currency,
    e.delivery_fee_amount, e.delivery_zone_id, e.delivery_zone_name_snapshot,
    e.delivered_at
  from public.driver_delivery_fee_entitlements e where public.is_admin();

create view public.admin_merchant_payout_report_rows
with (security_barrier = true, security_invoker = true) as
  select p.batch_id, p.merchant_id, p.currency, p.status, p.created_at,
    p.batch_entitlement_id, p.merchant_order_entitlement_id, p.store_order_id,
    p.delivered_at, p.current_entitlement_amount, p.paid_amount,
    p.remaining_amount
  from public.merchant_settlement_batch_positions p where public.is_admin();

create view public.admin_merchant_settlement_report_batches
with (security_barrier = true, security_invoker = true) as
select b.id, b.merchant_id, b.currency, b.status, b.created_at,
  coalesce((select sum(e.amount_snapshot) from public.merchant_settlement_batch_entitlements e
    where e.batch_id = b.id), 0) as entitlement_amount,
  coalesce((select sum(p.amount) from public.merchant_settlement_payments p
    where p.batch_id = b.id), 0) as paid_amount
from public.merchant_settlement_batches b where public.is_admin();

create view public.admin_merchant_financial_report_events
with (security_barrier = true, security_invoker = true) as
select e.id, e.merchant_id, e.currency, e.delivered_at as occurred_at,
  'entitlement'::text as event_type, e.initial_net_entitlement_amount as amount,
  e.store_order_id, null::uuid as batch_id, null::text as status, null::text as reference,
  null::numeric as paid_amount, null::numeric as remaining_amount
from public.merchant_order_entitlements e where public.is_admin()
union all
select a.id, a.merchant_id, a.currency, a.created_at, 'entitlement_adjustment', a.amount,
  e.store_order_id, null::uuid, null::text, a.source_id::text, null::numeric, null::numeric
from public.merchant_order_entitlement_adjustments a
join public.merchant_order_entitlements e on e.id = a.merchant_order_entitlement_id
where public.is_admin()
union all
select p.id, p.merchant_id, p.currency, p.paid_at, 'merchant_payment', p.amount,
  null::uuid, p.batch_id, null::text, p.external_reference, null::numeric, null::numeric
from public.merchant_settlement_payments p where public.is_admin()
union all
select b.id, b.merchant_id, b.currency, b.created_at, 'settlement', b.entitlement_amount,
  null::uuid, b.id,
  case when b.status = 'completed' then 'completed'
    when b.paid_amount > 0 and b.paid_amount < b.entitlement_amount then 'partially_paid'
    else 'open' end, null::text, b.paid_amount, b.entitlement_amount - b.paid_amount
from public.admin_merchant_settlement_report_batches b where public.is_admin();

create view public.admin_platform_revenue_report_events
with (security_barrier = true, security_invoker = true) as
select c.id, c.merchant_id, c.currency, c.due_at as occurred_at,
  'commission'::text as event_type, c.commission_amount as amount,
  c.store_order_id, c.id as commission_id, null::uuid as invoice_id, null::uuid as payment_id,
  null::text as reference
from public.store_order_commissions c where public.is_admin() and c.status = 'due'
union all
select r.id, r.merchant_id, r.currency, r.created_at, 'commission_reversal', r.amount,
  c.store_order_id, c.id, null::uuid, null::uuid, r.reason
from public.store_order_commission_reversals r
join public.store_order_commissions c on c.id = r.commission_id where public.is_admin()
union all
select i.id, i.merchant_id, i.currency, i.created_at, 'invoice', i.total_amount,
  null::uuid, null::uuid, i.id, null::uuid, i.invoice_number
from public.subscription_invoices i where public.is_admin() and i.status <> 'void'
union all
select p.id, p.merchant_id, p.currency, p.received_at, 'subscription_payment', p.amount,
  null::uuid, null::uuid, null::uuid, p.id, p.external_reference
from public.subscription_payments p where public.is_admin()
union all
select a.id, p.merchant_id, p.currency, a.created_at, 'invoice_allocation', a.amount,
  null::uuid, null::uuid, a.invoice_id, a.payment_id, null::text
from public.invoice_payment_allocations a
join public.subscription_payments p on p.id = a.payment_id where public.is_admin();
-- Final definitions from 20261018001200; dependent bases have now been recreated.
create view public.merchant_account_sale_rows
with (security_barrier = true, security_invoker = true) as
with amounts as (
  select e.*, co.order_number, c.base_amount, c.commission_rate,
    coalesce((select sum(a.amount)
      from public.merchant_settlement_payment_allocations a
      join public.merchant_settlement_batch_entitlements be on be.id = a.batch_entitlement_id
      where be.merchant_order_entitlement_id = e.merchant_order_entitlement_id), 0) as paid_amount,
    coalesce((select sum(be.amount_snapshot)
      from public.merchant_settlement_batch_entitlements be
      join public.merchant_settlement_batches b on b.id = be.batch_id
      where be.merchant_order_entitlement_id = e.merchant_order_entitlement_id and b.status = 'open'), 0) as reserved_amount
  from public.merchant_order_entitlement_positions e
  join public.store_order_commissions c on c.id = e.commission_id
  join public.store_orders so on so.id = e.store_order_id
  join public.customer_orders co on co.id = so.customer_order_id
)
select a.*, a.current_entitlement_amount - a.paid_amount as remaining_amount,
  greatest(a.current_entitlement_amount - a.paid_amount - a.reserved_amount, 0) as unbatched_amount,
  a.commission_amount_at_delivery - a.adjustment_amount as net_commission_amount,
  case when a.current_entitlement_amount <= a.paid_amount then 'completed'
    when a.paid_amount > 0 then 'partially_paid'
    when a.reserved_amount > 0 then 'open' else 'unsettled' end as settlement_status
from amounts a;

create view public.merchant_account_settlement_rows
with (security_barrier = true, security_invoker = true) as
with amounts as (
  select b.*,
    coalesce((select sum(e.amount_snapshot) from public.merchant_settlement_batch_entitlements e where e.batch_id = b.id), 0) as total_amount,
    coalesce((select sum(p.amount) from public.merchant_settlement_payments p where p.batch_id = b.id), 0) as paid_amount
  from public.merchant_settlement_batches b
)
select a.*, a.total_amount - a.paid_amount as remaining_amount,
  case when a.status = 'completed' then 'completed'
    when a.paid_amount > 0 and a.paid_amount < a.total_amount then 'partially_paid'
    else 'open' end as settlement_status
from amounts a;

drop index public.wallet_transactions_user_idx;
create index wallet_transactions_user_idx on public.wallet_transactions(user_id,created_at desc);
drop index public.subscription_invoices_merchant_currency_status_idx;
create index subscription_invoices_merchant_currency_status_idx on public.subscription_invoices(merchant_id,status,created_at desc);
drop index public.subscription_payments_merchant_currency_received_idx;
create index subscription_payments_merchant_currency_received_idx on public.subscription_payments(merchant_id,received_at desc);
drop index public.merchant_ledger_entries_exposure_idx;
create index merchant_ledger_entries_exposure_idx on public.merchant_ledger_entries(merchant_id,created_at desc);
drop index public.store_order_commissions_merchant_status_idx;
create index store_order_commissions_merchant_status_idx on public.store_order_commissions(merchant_id,status,created_at desc);
drop index public.merchant_order_entitlements_merchant_idx;
create index merchant_order_entitlements_merchant_idx on public.merchant_order_entitlements(merchant_id,status,delivered_at desc);
drop index public.driver_cash_remittances_driver_idx;
create index driver_cash_remittances_driver_idx on public.driver_cash_remittances(driver_id,received_at desc);
drop index public.driver_cash_credit_payouts_driver_idx;
create index driver_cash_credit_payouts_driver_idx on public.driver_cash_credit_payouts(driver_id,paid_at desc);
drop index public.merchant_settlement_batches_merchant_idx;
create index merchant_settlement_batches_merchant_idx on public.merchant_settlement_batches(merchant_id,status,created_at desc);
alter table public.store_order_items add constraint store_order_items_offer_snapshot_syp
  check (offer_snapshot is null or not jsonb_path_exists(offer_snapshot, '$.** ? (@.currency != "SYP")'));
-- Fail closed if a dependency on the old enum was missed.
drop type public.currency_code_previous;
-- Remove EVERY newly inherited relation/column grant, including custom roles
-- introduced by ALTER DEFAULT PRIVILEGES. Never assume only anon/authenticated.
do $$ declare r record; role_name text; begin
  for r in
    select c.relname as name, a.grantee
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    where n.nspname='public' and c.relname in(select name from syp_view_metadata)
  loop
    role_name := case when r.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(r.grantee)) end;
    execute format('revoke all privileges on table public.%I from %s',r.name,role_name);
  end loop;
  for r in
    select c.relname as name, att.attname as column_name, a.grantee, a.privilege_type
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute att on att.attrelid=c.oid and att.attnum>0 and not att.attisdropped
    cross join lateral aclexplode(att.attacl) a
    where n.nspname='public' and c.relname in(select name from syp_view_metadata)
  loop
    role_name := case when r.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(r.grantee)) end;
    execute format('revoke %s (%I) on table public.%I from %s',r.privilege_type,r.column_name,r.name,role_name);
  end loop;
end; $$;
do $$ declare r record; role_name text; object_name text; begin
  for r in select * from syp_acl loop
    role_name := case when r.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(r.grantee)) end;
    if r.kind='view' then object_name := format('table public.%I',r.name);
    else select 'function ' || p.oid::regprocedure::text into object_name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=r.name; end if;
    if r.kind='function' then execute 'revoke all on ' || object_name || ' from public, anon, authenticated'; end if;
  end loop;
  for r in select * from syp_acl loop
    role_name := case when r.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(r.grantee)) end;
    if r.kind='view' then object_name := format('table public.%I',r.name);
    else select 'function ' || p.oid::regprocedure::text into object_name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=r.name; end if;
    execute 'grant ' || r.privilege_type || ' on ' || object_name || ' to ' || role_name || case when r.is_grantable then ' with grant option' else '' end;
  end loop;
end; $$;
do $$ declare r record; role_name text; begin
  for r in select * from syp_view_column_acl loop
    role_name := case when r.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(r.grantee)) end;
    execute format('grant %s (%I) on table public.%I to %s%s',r.privilege_type,r.column_name,r.name,role_name,
      case when r.is_grantable then ' with grant option' else '' end);
  end loop;
  -- Restore options and ownership after grants while the migration role owns
  -- the replacement views. Ownership changes require the original owner role.
  for r in select * from syp_view_metadata loop
    execute format('alter view public.%I set (%s)',r.name,array_to_string(r.options,', '));
    execute format('alter view public.%I owner to %I',r.name,r.owner_name);
  end loop;
end; $$;
-- Fail the entire transaction if owner/options or non-owner privileges differ.
-- Owner privileges are inherent; PostgreSQL may normalize their explicit ACL.
do $$ begin
  if exists (
    select 1 from syp_view_metadata m
    join pg_namespace n on n.nspname='public'
    left join pg_class c on c.relnamespace=n.oid and c.relname=m.name
    where c.oid is null or pg_get_userbyid(c.relowner)<>m.owner_name
      or not (coalesce(c.reloptions,array[]::text[]) @> m.options)
  ) then raise exception 'SYP migration changed view ownership/security options'; end if;
  if exists (
    with expected as (
      select a.name,a.grantee,a.privilege_type,a.is_grantable
      from syp_acl a join syp_view_metadata m on m.name=a.name
      where a.kind='view' and a.grantee<>to_regrole(quote_ident(m.owner_name))::oid
    ), actual as (
      select c.relname as name,a.grantee,a.privilege_type,a.is_grantable
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      join syp_view_metadata m on m.name=c.relname
      cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where n.nspname='public' and a.grantee<>c.relowner
    )
    (select * from actual except select * from expected)
    union all (select * from expected except select * from actual)
  ) then raise exception 'SYP migration changed view relation privileges'; end if;
  if exists (
    with expected as (
      select a.name,a.column_name,a.grantee,a.privilege_type,a.is_grantable
      from syp_view_column_acl a join syp_view_metadata m on m.name=a.name
      where a.grantee<>to_regrole(quote_ident(m.owner_name))::oid
    ), actual as (
      select c.relname as name,att.attname as column_name,a.grantee,a.privilege_type,a.is_grantable
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      join syp_view_metadata m on m.name=c.relname
      join pg_attribute att on att.attrelid=c.oid and att.attnum>0 and not att.attisdropped
      cross join lateral aclexplode(att.attacl) a
      where n.nspname='public' and a.grantee<>c.relowner
    )
    (select * from actual except select * from expected)
    union all (select * from expected except select * from actual)
  ) then raise exception 'SYP migration changed view column privileges'; end if;
end; $$;
notify pgrst, 'reload schema';
commit;
