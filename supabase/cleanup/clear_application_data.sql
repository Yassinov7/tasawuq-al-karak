-- Database-only cleanup. Run this WHOLE file in SQL Editor as postgres.
-- Stop application writes/renewal jobs during this transaction and until your
-- manual Storage/Auth cleanup finishes. This file does not require Migration 015.
-- Keeps subscription_plans, product_categories, store_categories, delivery_zones.
-- No SQL writes to auth/storage; no schema recreation or sequence reset.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $cleanup$
DECLARE
  -- Children precede parents, including FKs added by ALTER TABLE in 003/005.
  targets text[] := ARRAY[
    'merchant_financial_audit_events',
    'merchant_ledger_entries',
    'merchant_settlement_payment_allocations',
    'merchant_settlement_payments',
    'merchant_settlement_batch_entitlements',
    'merchant_settlement_batches',
    'merchant_order_entitlement_adjustments',
    'merchant_order_entitlements',
    'store_order_commission_reversals',
    'store_order_commissions',
    'invoice_payment_allocations',
    'subscription_payment_allocation_batches',
    'subscription_payments',
    'subscription_invoices',
    'driver_cash_credit_payouts',
    'driver_cash_remittances',
    'customer_order_cash_obligations',
    'driver_delivery_fee_entitlements',
    'product_reviews',
    'store_reviews',
    'store_order_status_history',
    'store_order_items',
    'store_order_totals',
    'store_orders',
    'delivery_tasks',
    'customer_order_totals',
    'customer_orders',
    'customer_cart_offer_selections',
    'customer_cart_items',
    'customer_cart_store_notes',
    'customer_carts',
    'store_offer_media',
    'store_offer_products',
    'store_offers',
    'product_media',
    'products',
    'notifications',
    'wallet_transactions',
    'customer_addresses',
    'merchant_subscription_plan_changes',
    'merchant_subscriptions',
    'merchant_billing_settings',
    'merchant_credit_limits',
    'stores',
    'merchants',
    'merchant_applications',
    'driver_applications',
    'wallets',
    'audit_logs',
    'profiles'
  ];
  target text;
  guard record;
  remaining bigint;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Run the complete file as the trusted database operator (postgres)';
  END IF;

  -- Keep concurrent inserts/updates from changing the deletion set.
  FOREACH target IN ARRAY targets LOOP
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', target);
  END LOOP;

  -- Reject incoming references from outside the deletion set, including
  -- CASCADE / SET NULL, and reject a deployed FK with a different required order.
  -- Ledger self-reference is handled explicitly below.
  IF EXISTS (
    WITH ordered AS (
      SELECT to_regclass('public.' || name) AS relation_id, ord
      FROM unnest(targets) WITH ORDINALITY AS t(name, ord)
    )
    SELECT 1 FROM pg_constraint fk
    JOIN ordered parent ON parent.relation_id = fk.confrelid
    LEFT JOIN ordered child ON child.relation_id = fk.conrelid
    WHERE fk.contype = 'f'
      AND (child.relation_id IS NULL OR
        (fk.conrelid <> fk.confrelid AND child.ord > parent.ord))
  ) THEN
    RAISE EXCEPTION 'Deployed foreign keys differ from the reviewed cleanup order; no data deleted';
  END IF;

  -- Only these four append-only guards block maintenance DELETEs.
  -- Require their original enabled state; never silently change an existing
  -- disabled/replica/always state. Other triggers, RLS and FK checks stay active.
  FOR guard IN SELECT * FROM (VALUES
    ('subscription_invoices', 'subscription_invoices_reject_before_delete'),
    ('subscription_payments', 'subscription_payments_reject_mutation'),
    ('invoice_payment_allocations', 'invoice_payment_allocations_reject_mutation'),
    ('merchant_ledger_entries', 'merchant_ledger_entries_reject_mutation')
  ) AS guards(table_name, trigger_name) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = to_regclass('public.' || guard.table_name)
        AND t.tgname = guard.trigger_name AND NOT t.tgisinternal AND t.tgenabled = 'O'
    ) THEN
      RAISE EXCEPTION 'Missing guard or unexpected trigger state: %', guard.trigger_name;
    END IF;
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I', guard.table_name, guard.trigger_name);
  END LOOP;

  -- Reversal rows reference their originals through a self FK.
  DELETE FROM public.merchant_ledger_entries WHERE reversal_of IS NOT NULL;
  FOREACH target IN ARRAY targets LOOP
    EXECUTE format('DELETE FROM public.%I', target);
  END LOOP;
  -- Audit triggers remain enabled and may have added maintenance records.
  DELETE FROM public.audit_logs;

  ALTER TABLE public.subscription_invoices ENABLE TRIGGER subscription_invoices_reject_before_delete;
  ALTER TABLE public.subscription_payments ENABLE TRIGGER subscription_payments_reject_mutation;
  ALTER TABLE public.invoice_payment_allocations ENABLE TRIGGER invoice_payment_allocations_reject_mutation;
  ALTER TABLE public.merchant_ledger_entries ENABLE TRIGGER merchant_ledger_entries_reject_mutation;
  SET CONSTRAINTS ALL IMMEDIATE;

  FOREACH target IN ARRAY targets LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', target) INTO remaining;
    IF remaining <> 0 THEN
      RAISE EXCEPTION 'Cleanup failed: public.% still contains % rows', target, remaining;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS: all 50 operational tables are empty; four financial guards re-enabled.';
END;
$cleanup$;

COMMIT;
