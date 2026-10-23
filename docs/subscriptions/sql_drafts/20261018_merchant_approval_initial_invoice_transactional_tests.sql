-- STAGING ONLY — every write and test trigger is rolled back.
-- Replace UUIDs with dedicated test profiles and PENDING merchant applications.
-- Never use real applicants, merchants, payments, or production data.

begin;

-- Success, idempotency, no-payment, disabled-credit/renewal, and non-admin test.
do $$
declare
  admin_user uuid := '00000000-0000-0000-0000-000000000010';
  non_admin_user uuid := '00000000-0000-0000-0000-000000000011';
  success_application uuid := '00000000-0000-0000-0000-000000000020';
  failure_application uuid := '00000000-0000-0000-0000-000000000021';
  success_user uuid;
  failure_user uuid;
  created_merchant uuid;
  created_subscription uuid;
  created_invoice uuid;
begin
  if not exists (select 1 from public.profiles where id = admin_user and role = 'admin')
     or not exists (select 1 from public.profiles where id = non_admin_user and role <> 'admin') then
    raise exception 'replace profile UUIDs with dedicated staging admin and non-admin profiles';
  end if;
  select user_id into success_user from public.merchant_applications
    where id = success_application and status = 'pending';
  select user_id into failure_user from public.merchant_applications
    where id = failure_application and status = 'pending';
  if success_user is null or failure_user is null
     or exists (select 1 from public.merchants where owner_user_id in (success_user, failure_user)) then
    raise exception 'replace application UUIDs with unused dedicated pending staging applications';
  end if;

  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  perform public.review_merchant_application(success_application, 'accepted', null);
  perform public.review_merchant_application(success_application, 'accepted', null);

  select id into created_merchant from public.merchants where owner_user_id = success_user;
  select id into created_subscription from public.merchant_subscriptions
    where merchant_id = created_merchant;
  select id into created_invoice from public.subscription_invoices
    where merchant_id = created_merchant and subscription_id = created_subscription and kind = 'initial';

  if created_merchant is null or created_subscription is null or created_invoice is null then
    raise exception 'first approval did not create merchant, period, and initial invoice';
  end if;
  if (select count(*) from public.merchant_subscriptions where merchant_id = created_merchant) <> 1
     or (select count(*) from public.subscription_invoices where merchant_id = created_merchant and kind = 'initial') <> 1
     or (select count(*) from public.merchant_ledger_entries
         where source_type = 'subscription_invoice' and source_id = created_invoice) <> 1 then
    raise exception 'approval retry created duplicate financial records';
  end if;
  if exists (select 1 from public.subscription_payments where merchant_id = created_merchant)
     or exists (select 1 from public.merchant_credit_limits where merchant_id = created_merchant and credit_enabled)
     or not exists (select 1 from public.merchant_billing_settings
                    where merchant_id = created_merchant and not auto_renew) then
    raise exception 'approval created payment, enabled credit, or enabled auto-renew';
  end if;

  perform set_config('request.jwt.claim.sub', non_admin_user::text, true);
  begin
    perform public.review_merchant_application(failure_application, 'accepted', null);
    raise exception 'non-admin approval was accepted';
  exception when raise_exception then
    if position('administrator access required' in sqlerrm) = 0 then raise; end if;
  end;
end;
$$;

-- Force the invoice insert to fail. DDL is deliberately outside PL/pgSQL.
create function public.test_reject_initial_invoice_insert()
returns trigger language plpgsql as $test_invoice_trigger$
begin
  raise exception 'test invoice failure';
end;
$test_invoice_trigger$;
create trigger test_reject_initial_invoice_insert
  before insert on public.subscription_invoices
  for each row execute function public.test_reject_initial_invoice_insert();

do $$
declare
  admin_user uuid := '00000000-0000-0000-0000-000000000010';
  failure_application uuid := '00000000-0000-0000-0000-000000000021';
  failure_user uuid;
  invoice_error boolean := false;
begin
  select user_id into failure_user from public.merchant_applications
    where id = failure_application and status = 'pending';
  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  begin
    perform public.review_merchant_application(failure_application, 'accepted', null);
  exception when raise_exception then
    if position('test invoice failure' in sqlerrm) > 0 then invoice_error := true; else raise; end if;
  end;
  if not invoice_error
     or exists (select 1 from public.merchants where owner_user_id = failure_user)
      or exists (select 1 from public.merchant_applications where id = failure_application and status = 'accepted')
      or exists (select 1 from public.merchant_subscriptions where id = failure_application)
      or exists (select 1 from public.subscription_invoices where id = failure_application)
      or exists (select 1 from public.merchant_ledger_entries
                 where source_type = 'subscription_invoice' and source_id = failure_application) then
    raise exception 'invoice failure did not roll back the approval transaction';
  end if;
end;
$$;

drop trigger test_reject_initial_invoice_insert on public.subscription_invoices;
drop function public.test_reject_initial_invoice_insert();

-- Force the ledger insert to fail after invoice creation was attempted.
create function public.test_reject_initial_ledger_insert()
returns trigger language plpgsql as $test_ledger_trigger$
begin
  raise exception 'test ledger failure';
end;
$test_ledger_trigger$;
create trigger test_reject_initial_ledger_insert
  before insert on public.merchant_ledger_entries
  for each row execute function public.test_reject_initial_ledger_insert();

do $$
declare
  admin_user uuid := '00000000-0000-0000-0000-000000000010';
  failure_application uuid := '00000000-0000-0000-0000-000000000021';
  failure_user uuid;
  ledger_error boolean := false;
begin
  select user_id into failure_user from public.merchant_applications
    where id = failure_application and status = 'pending';
  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  begin
    perform public.review_merchant_application(failure_application, 'accepted', null);
  exception when raise_exception then
    if position('test ledger failure' in sqlerrm) > 0 then ledger_error := true; else raise; end if;
  end;
  if not ledger_error
     or exists (select 1 from public.merchants where owner_user_id = failure_user)
     or exists (select 1 from public.merchant_applications where id = failure_application and status = 'accepted')
      or exists (select 1 from public.merchant_subscriptions where id = failure_application)
      or exists (select 1 from public.subscription_invoices where id = failure_application)
      or exists (select 1 from public.merchant_ledger_entries
                 where source_type = 'subscription_invoice' and source_id = failure_application) then
    raise exception 'ledger failure did not roll back the approval transaction';
  end if;
end;
$$;

drop trigger test_reject_initial_ledger_insert on public.merchant_ledger_entries;
drop function public.test_reject_initial_ledger_insert();

rollback;
