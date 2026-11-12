-- ARCHIVED pre-SYP-only draft. DO NOT RUN against the current schema.
-- Positive foreign-currency fixtures and old RPC signatures below are historical.
-- Current checks: supabase/tests/syp_only_schema.sql and syp_only_integration.sql.

-- STAGING ONLY. Every write below is rolled back.
-- Replace both UUIDs with dedicated, approved test merchants; never run this
-- against production customer or financial records.

begin;

do $$
declare
  test_merchant uuid := '0caa69c6-8632-4d5c-aa85-58920572575e';
other_merchant uuid := '87f8cb6b-75d2-42e4-aba0-ac0ee679c979';
  test_plan uuid;
  test_owner uuid;
  period_one uuid := gen_random_uuid();
  invoice_one uuid := gen_random_uuid();
  invoice_two uuid := gen_random_uuid();
  payment_syp uuid := gen_random_uuid();
  payment_usd uuid := gen_random_uuid();
  payment_other uuid := gen_random_uuid();
  original_ledger uuid := gen_random_uuid();
  reversal_ledger uuid := gen_random_uuid();
  original_source uuid := gen_random_uuid();
begin
  select sp.id into test_plan from public.subscription_plans sp order by sp.created_at limit 1;
  select m.owner_user_id into test_owner from public.merchants m where m.id = test_merchant;
  if test_plan is null or test_owner is null
     or not exists (select 1 from public.merchants where id = other_merchant) then
    raise exception 'set both merchant UUIDs to dedicated approved staging merchants';
  end if;

  -- One period succeeds; a temporal overlap must fail.
  insert into public.merchant_subscriptions(
    id, merchant_id, plan_id, plan_name_snapshot, duration_months,
    price_snapshot, currency_snapshot, starts_at, expires_at
  ) values (
    period_one, test_merchant, test_plan, 'TEST ONLY', 1, 1, 'SYP',
    '2099-01-01 00:00:00+00', '2099-02-01 00:00:00+00'
  );
  begin
    insert into public.merchant_subscriptions(
      merchant_id, plan_id, plan_name_snapshot, duration_months,
      price_snapshot, currency_snapshot, starts_at, expires_at
    ) values (
      test_merchant, test_plan, 'OVERLAP TEST', 1, 1, 'SYP',
      '2099-01-15 00:00:00+00', '2099-02-15 00:00:00+00'
    );
    raise exception 'overlapping subscription period was accepted';
  exception when exclusion_violation then null;
  end;

  insert into public.subscription_invoices(
    id, invoice_number, merchant_id, subscription_id, kind, currency,
    total_amount, status, idempotency_key
  ) values
    (invoice_one, 'TEST-' || invoice_one::text, test_merchant, period_one,
     'initial', 'SYP', 100, 'open', gen_random_uuid()),
    (invoice_two, 'TEST-' || invoice_two::text, test_merchant, period_one,
     'adjustment', 'SYP', 100, 'open', gen_random_uuid());

  insert into public.subscription_payments(
    id, merchant_id, currency, amount, method, idempotency_key, received_at, recorded_by
  ) values
    (payment_syp, test_merchant, 'SYP', 100, 'cash', gen_random_uuid(), now(), test_owner),
    (payment_usd, test_merchant, 'USD', 100, 'cash', gen_random_uuid(), now(), test_owner),
    (payment_other, other_merchant, 'SYP', 100, 'cash', gen_random_uuid(), now(), test_owner);

  -- Currency mismatch must fail.
  begin
    insert into public.invoice_payment_allocations(invoice_id, payment_id, amount)
    values (invoice_one, payment_usd, 1);
    raise exception 'cross-currency allocation was accepted';
  exception when raise_exception then
    if position('same merchant and currency' in sqlerrm) = 0 then raise; end if;
  end;

  -- Merchant mismatch must fail even when both amounts use the same currency.
  begin
    insert into public.invoice_payment_allocations(invoice_id, payment_id, amount)
    values (invoice_one, payment_other, 1);
    raise exception 'cross-merchant allocation was accepted';
  exception when raise_exception then
    if position('same merchant and currency' in sqlerrm) = 0 then raise; end if;
  end;

  insert into public.invoice_payment_allocations(invoice_id, payment_id, amount)
  values (invoice_one, payment_syp, 80);

  -- The remaining payment amount is 20, so allocating 21 must fail.
  begin
    insert into public.invoice_payment_allocations(invoice_id, payment_id, amount)
    values (invoice_two, payment_syp, 21);
    raise exception 'over-allocation was accepted';
  exception when raise_exception then
    if position('allocation exceeds' in sqlerrm) = 0 then raise; end if;
  end;

  -- Allocations cannot be altered or removed after creation.
  begin
    update public.invoice_payment_allocations set amount = 79
      where invoice_id = invoice_one and payment_id = payment_syp;
    raise exception 'allocation update was accepted';
  exception when raise_exception then
    if position('append-only' in sqlerrm) = 0 then raise; end if;
  end;

  insert into public.merchant_ledger_entries(
    id, merchant_id, currency, effect, source_type, source_id, amount
  ) values (
    original_ledger, test_merchant, 'SYP', 'increase_exposure',
    'manual_adjustment', original_source, 10
  );

  begin
    insert into public.merchant_ledger_entries(
      merchant_id, currency, effect, source_type, source_id, amount
    ) values (
      test_merchant, 'SYP', 'increase_exposure', 'manual_adjustment', original_source, 10
    );
    raise exception 'duplicate ledger source was accepted';
  exception when unique_violation then null;
  end;
  insert into public.merchant_ledger_entries(
    id, merchant_id, currency, effect, source_type, source_id, amount, reversal_of
  ) values (
    reversal_ledger, test_merchant, 'SYP', 'decrease_exposure',
    'ledger_reversal', original_ledger, 10, original_ledger
  );

  -- A reversal cannot itself be reversed, and the original cannot be reversed twice.
  begin
    insert into public.merchant_ledger_entries(
      merchant_id, currency, effect, source_type, source_id, amount, reversal_of
    ) values (
      test_merchant, 'SYP', 'increase_exposure', 'ledger_reversal',
      reversal_ledger, 10, reversal_ledger
    );
    raise exception 'reversal of a reversal was accepted';
  exception when raise_exception then
    if position('cannot itself be reversed' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    insert into public.merchant_ledger_entries(
      merchant_id, currency, effect, source_type, source_id, amount, reversal_of
    ) values (
      test_merchant, 'SYP', 'decrease_exposure', 'ledger_reversal',
      original_ledger, 10, original_ledger
    );
    raise exception 'second reversal of original entry was accepted';
  exception when unique_violation then null;
  end;
end;
$$;

rollback;
