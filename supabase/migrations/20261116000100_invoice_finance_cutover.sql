-- NEW FINANCE CUTOVER. Owner applies; never run by the development agent remotely.
-- Requires MIG-001..003 and all previous migrations. Back up the TEST database first.
-- Deletes ALL old financial records, and resets test orders/carts/delivery histories.
-- Preserves accounts, applications, merchants, stores, products, offers, addresses and media.
-- No old balances or invoices are migrated. Existing commercial terms are retained.
begin;
create schema money_private;
revoke all on schema money_private from public,anon,authenticated;
create schema commerce_private;
revoke all on schema commerce_private from public,anon,authenticated;
create table public.merchant_terms (
 id uuid primary key default gen_random_uuid(), merchant_id uuid not null unique references public.merchants(id),
 plan_id uuid references public.subscription_plans(id),plan_name_snapshot text not null,duration_months integer not null,
 price_snapshot numeric(14,2) not null,currency_snapshot public.currency_code not null default 'SYP',
 commission_rate_snapshot numeric(7,4) not null check(commission_rate_snapshot between 0 and 100),
 product_limit integer not null, starts_at timestamptz,expires_at timestamptz,
 created_at timestamptz not null default now()
);
insert into public.merchant_terms(merchant_id,plan_id,plan_name_snapshot,duration_months,price_snapshot,commission_rate_snapshot,product_limit,starts_at,expires_at)
select distinct on(s.merchant_id) s.merchant_id,s.plan_id,s.plan_name_snapshot,s.duration_months,s.price_snapshot,
 coalesce(s.commission_rate_snapshot,p.commission_rate),p.product_limit,s.starts_at,s.expires_at
from public.merchant_subscriptions s join public.subscription_plans p on p.id=s.plan_id
where coalesce(s.commission_rate_snapshot,p.commission_rate) is not null and p.product_limit is not null
order by s.merchant_id,s.expires_at desc;

-- Explicit source-catalogued cutover inventory; no unbounded CASCADE.
drop trigger if exists "delivery_dispatch_after_store_ready" on public.store_orders;
drop trigger if exists "store_orders_subscription_grace_before_insert" on public.store_orders;
drop trigger if exists "store_order_totals_snapshot_commission_after_insert" on public.store_order_totals;
drop trigger if exists "store_orders_apply_commission_after_status_change" on public.store_orders;
drop trigger if exists "subscription_plans_validate_active_configuration" on public.subscription_plans;
drop trigger if exists "store_orders_cash_financial_foundations_after_status_change" on public.store_orders;
drop trigger if exists "delivery_tasks_cash_financial_foundations_after_status_change" on public.delivery_tasks;
drop trigger if exists "c3_zone_version" on public.delivery_zones;
drop trigger if exists "c3_snapshot_immutable" on public.order_pricing_snapshots;
drop trigger if exists "c3_revision_immutable" on public.order_pricing_revisions;
drop trigger if exists "c4_order_birth" on public.customer_orders;
drop trigger if exists "c4_select_order_mode" on public.order_pricing_snapshots;
drop trigger if exists "c4_no_reassignment" on public.delivery_tasks;
drop trigger if exists "c4_task_progress" on public.delivery_tasks;
drop trigger if exists "c4_task_atomic_result" on public.delivery_tasks;
drop trigger if exists "c4_child_atomic_result" on public.store_orders;
drop trigger if exists "c6_capture_on_new_dlv" on public.delivery_tasks;
drop trigger if exists "c8_plan_permission" on public.subscription_plans;
drop trigger if exists "wallets_updated_at" on public.wallets;
drop trigger if exists "wallet_transaction_apply_before_insert" on public.wallet_transactions;
drop trigger if exists "audit_merchant_subscriptions" on public.merchant_subscriptions;
drop trigger if exists "audit_wallets" on public.wallets;
drop trigger if exists "audit_wallet_transactions" on public.wallet_transactions;
drop trigger if exists "subscription_invoices_identity_before_update" on public.subscription_invoices;
drop trigger if exists "subscription_invoices_reject_before_delete" on public.subscription_invoices;
drop trigger if exists "subscription_payments_reject_mutation" on public.subscription_payments;
drop trigger if exists "invoice_payment_allocations_validate_before_insert" on public.invoice_payment_allocations;
drop trigger if exists "invoice_payment_allocations_reject_mutation" on public.invoice_payment_allocations;
drop trigger if exists "merchant_ledger_entries_validate_before_insert" on public.merchant_ledger_entries;
drop trigger if exists "merchant_ledger_entries_reject_mutation" on public.merchant_ledger_entries;
drop trigger if exists "merchant_subscription_plan_changes_snapshot_commission_before_i" on public.merchant_subscription_plan_changes;
drop trigger if exists "merchant_subscriptions_snapshot_commission_before_insert" on public.merchant_subscriptions;
drop trigger if exists "store_order_commission_reversal_append_merchant_entitlement_adj" on public.store_order_commission_reversals;
drop trigger if exists "merchant_settlement_payment_notification" on public.merchant_settlement_payments;
drop trigger if exists "financial_document_reference_assign" on public.financial_document_references;
drop trigger if exists "financial_document_reference_immutable" on public.financial_document_references;
drop trigger if exists "financial_account_validate" on public.financial_accounts;
drop trigger if exists "financial_account_immutable" on public.financial_accounts;
drop trigger if exists "financial_account_definition_immutable" on public.financial_account_definitions;
drop trigger if exists "financial_event_immutable" on public.financial_events;
drop trigger if exists "journal_entry_guard" on public.journal_entries;
drop trigger if exists "journal_line_guard" on public.journal_lines;
drop trigger if exists "journal_entry_complete" on public.journal_entries;
drop trigger if exists "journal_line_balanced" on public.journal_lines;
drop trigger if exists "financial_operation_guard" on public.financial_operations;
drop trigger if exists "financial_operation_complete" on public.financial_operations;
drop trigger if exists "financial_event_complete" on public.financial_events;
drop trigger if exists "lifecycle_event_immutable" on public.order_lifecycle_events;
drop trigger if exists "lifecycle_event_validate" on public.order_lifecycle_events;
drop trigger if exists "c4_mode_immutable" on public.order_financial_modes;
drop trigger if exists "c4_workflow_immutable" on public.delivery_pickup_workflows;
drop trigger if exists "c4_pickup_immutable" on public.delivery_store_pickups;
drop trigger if exists "c4_pickup_validate" on public.delivery_store_pickups;
drop trigger if exists "c4_legacy_write_guard" on public.customer_order_cash_obligations;
drop trigger if exists "c4_legacy_write_guard" on public.driver_delivery_fee_entitlements;
drop trigger if exists "c4_legacy_write_guard" on public.merchant_order_entitlements;
drop trigger if exists "c4_legacy_write_guard" on public.store_order_commission_reversals;
drop trigger if exists "c4_legacy_write_guard" on public.merchant_order_entitlement_adjustments;
drop trigger if exists "c4_legacy_write_guard" on public.merchant_ledger_entries;
drop trigger if exists "c4_commission_due_guard" on public.store_order_commissions;
drop trigger if exists "c4_collection_immutable" on public.delivery_collection_results;
drop trigger if exists "c5_request_immutable" on public.driver_cash_handover_requests;
drop trigger if exists "c5_attempt_immutable" on public.driver_cash_handover_attempts;
drop trigger if exists "c5_request_validate" on public.driver_cash_handover_requests;
drop trigger if exists "c5_request_completed" on public.driver_cash_handover_requests;
drop trigger if exists "c5_attempt_validate" on public.driver_cash_handover_attempts;
drop trigger if exists "c5_confirmed_receipt" on public.driver_cash_handover_attempts;
drop trigger if exists "c6_immutable" on public.driver_wage_policies;
drop trigger if exists "c6_immutable" on public.delivery_wage_snapshots;
drop trigger if exists "c6_immutable" on public.driver_wage_entitlements;
drop trigger if exists "c6_immutable" on public.driver_cash_receipt_allocations;
drop trigger if exists "c6_immutable" on public.driver_wage_payments;
drop trigger if exists "c6_immutable" on public.driver_wage_payment_items;
drop trigger if exists "c6_validate_snapshot" on public.delivery_wage_snapshots;
drop trigger if exists "c6_accrual_required" on public.delivery_collection_results;
drop trigger if exists "c6_allocation_validate" on public.driver_cash_receipt_allocations;
drop trigger if exists "c6_allocate_rct" on public.driver_cash_handover_attempts;
drop trigger if exists "c6_payment_item_validate" on public.driver_wage_payment_items;
drop trigger if exists "c6_payment_complete" on public.driver_wage_payments;
drop trigger if exists "c7_immutable" on public.merchant_delivery_positions;
drop trigger if exists "c7_immutable" on public.merchant_settlement_documents;
drop trigger if exists "c7_immutable" on public.merchant_settlement_document_items;
drop trigger if exists "c7_immutable" on public.c7_merchant_settlement_payments;
drop trigger if exists "c7_delivery_detail" on public.delivery_collection_results;
drop trigger if exists "c7_item_validate" on public.merchant_settlement_document_items;
drop trigger if exists "c7_set_complete" on public.merchant_settlement_documents;
drop trigger if exists "c7_pay_complete" on public.c7_merchant_settlement_payments;
drop trigger if exists "c8_immutable" on public.subscription_plan_versions;
drop trigger if exists "c8_immutable" on public.subscription_memberships;
drop trigger if exists "c8_immutable" on public.subscription_account_events;
drop trigger if exists "c8_immutable" on public.subscription_billing_documents;
drop trigger if exists "c8_immutable" on public.subscription_cash_receipts;
drop trigger if exists "c8_native_period_guard" on public.merchant_subscriptions;
drop trigger if exists "c8_old_invoice_guard" on public.subscription_invoices;
drop trigger if exists "c8_old_billing_guard" on public.merchant_billing_settings;
drop trigger if exists "c8_old_change_guard" on public.merchant_subscription_plan_changes;
drop trigger if exists "c8_old_payment_guard" on public.subscription_payments;
drop trigger if exists "c8_invoice_complete" on public.subscription_billing_documents;
drop trigger if exists "c8_receipt_complete" on public.subscription_cash_receipts;
drop trigger if exists "c9_serialize_c5_receipt" on public.driver_cash_handover_attempts;
drop trigger if exists "c9_document_immutable" on public.treasury_control_documents;
drop trigger if exists "c9_document_complete" on public.treasury_control_documents;
drop trigger if exists "c9_finance_immutable" on public.treasury_finance_requests;
drop trigger if exists "c9_finance_immutable" on public.treasury_finance_events;
drop trigger if exists "c9_finance_immutable" on public.treasury_finance_postings;
drop trigger if exists "c9_finance_request_complete" on public.treasury_finance_requests;
drop trigger if exists "c9_finance_event_complete" on public.treasury_finance_events;
drop trigger if exists "c9_finance_posting_complete" on public.treasury_finance_postings;
drop trigger if exists "c11_order_event_writer" on public.financial_events;
drop trigger if exists "c11_new_treasury_request" on public.treasury_finance_requests;
drop trigger if exists "c11_subscription_admission" on public.subscription_memberships;
drop trigger if exists "c11_record_enrollment" on public.subscription_memberships;
-- Private-schema dependency closure is catalogued in docs/finance-cutover-removal.json.
drop schema finance_private cascade;
do $$ declare r record;begin for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename=any(array['c7_merchant_settlement_payments','customer_order_cash_obligations','delivery_collection_results','delivery_pickup_workflows','delivery_store_pickups','delivery_wage_snapshots','driver_cash_credit_payouts','driver_cash_handover_attempts','driver_cash_handover_requests','driver_cash_receipt_allocations','driver_cash_remittances','driver_delivery_fee_entitlements','driver_wage_entitlements','driver_wage_payment_items','driver_wage_payments','driver_wage_policies','financial_account_definitions','financial_accounts','financial_document_references','financial_events','financial_operations','invoice_payment_allocations','journal_entries','journal_lines','merchant_billing_settings','merchant_credit_limits','merchant_delivery_positions','merchant_financial_audit_events','merchant_ledger_entries','merchant_order_entitlement_adjustments','merchant_order_entitlements','merchant_settlement_batch_entitlements','merchant_settlement_batches','merchant_settlement_document_items','merchant_settlement_documents','merchant_settlement_payment_allocations','merchant_settlement_payments','merchant_subscription_plan_changes','merchant_subscriptions','order_financial_modes','order_lifecycle_events','store_order_commission_reversals','store_order_commissions','subscription_account_events','subscription_billing_documents','subscription_cash_receipts','subscription_invoices','subscription_memberships','subscription_payment_allocation_batches','subscription_payments','subscription_plan_versions','treasury_control_documents','treasury_finance_events','treasury_finance_postings','treasury_finance_requests','wallet_transactions','wallets']) loop execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);end loop;end $$;
drop view if exists public.admin_cash_movement_events,public.admin_delivery_fee_report_rows,public.admin_merchant_financial_report_events,public.admin_merchant_payout_report_rows,public.admin_merchant_settlement_report_batches,public.admin_platform_revenue_report_events,public.driver_cash_custody_positions,public.merchant_account_sale_rows,public.merchant_account_settlement_rows,public.merchant_financial_positions,public.merchant_order_entitlement_positions,public.merchant_settlement_batch_positions;
drop function if exists public.validate_invoice_payment_allocation();
drop function if exists public.validate_merchant_ledger_entry();
drop function if exists public.allocate_subscription_payment(target_payment uuid, allocation_input jsonb, allocation_idempotency_key uuid);
drop function if exists public.subscription_renewal_internal(target_merchant uuid, renewal_idempotency_key uuid, require_credit boolean, audit_actor uuid, audit_event_type text, audit_reason text);
drop function if exists public.reject_store_order_after_subscription_grace();
drop function if exists public.set_merchant_auto_renew(target_merchant uuid, enabled boolean, change_reason text);
drop function if exists public.schedule_merchant_subscription_plan_change(target_merchant uuid, target_plan uuid, change_idempotency_key uuid, change_reason text);
drop function if exists public.record_subscription_payment(target_merchant uuid, payment_amount numeric, payment_method text, payment_idempotency_key uuid, allocation_input jsonb, payment_external_reference text, payment_received_at timestamp with time zone);
drop function if exists public.process_due_merchant_subscription_renewals(batch_limit integer);
drop function if exists public.admin_financial_report(report_kind text, period_from timestamp with time zone, period_until timestamp with time zone, movement_type text, target_driver uuid, zone_snapshot text, page_number integer);
drop function if exists public.apply_store_order_commission_status_change();
drop function if exists public.snapshot_subscription_commission_rate();
drop function if exists public.reconcile_subscription_commission_rate(target_subscription uuid, reconciled_commission_rate numeric, reconciliation_reason text);
drop function if exists public.append_commission_reversal_entitlement_adjustment();
drop function if exists public.find_c2_document_reference(reference_value text);
drop function if exists public.record_merchant_settlement_payment(target_batch uuid, payment_amount numeric, payment_allocations jsonb, payment_idempotency_key uuid, payment_reference text, payment_note text);
drop function if exists public.apply_wallet_transaction();
drop function if exists public.snapshot_store_order_commission_after_totals();
drop function if exists public.record_wallet_transaction(target_user uuid, operation wallet_transaction_type, operation_direction wallet_direction, operation_amount numeric, operation_note text);
drop function if exists public.set_merchant_credit_limit(target_merchant uuid, credit_is_enabled boolean, credit_amount numeric, change_reason text);
drop function if exists public.admin_sales_revenue_report(report_kind text, period_from timestamp with time zone, period_until timestamp with time zone, target_merchant uuid, detail_type text, settlement_state text, page_number integer);
drop function if exists public.merchant_financial_account(section_name text, period_from timestamp with time zone, period_until timestamp with time zone, selected_status text, order_search text, record_id uuid, page_number integer, payments_page integer);
drop function if exists public.pay_driver_cash_credit(target_driver uuid, payout_amount numeric, payout_idempotency_key uuid, payout_reference text, payout_note text);
drop function if exists public.record_driver_cash_remittance(target_driver uuid, remittance_amount numeric, remittance_idempotency_key uuid, remittance_reference text, remittance_note text);
drop function if exists public.create_merchant_settlement_batch(target_merchant uuid, entitlement_ids uuid[], batch_idempotency_key uuid, period_start_value timestamp with time zone, period_end_value timestamp with time zone, batch_note text);
drop function if exists public.get_c2_financial_operation(attempt_key_value uuid);
drop function if exists public.accrue_store_order_commission(target_store_order uuid, delivered_at_value timestamp with time zone);
drop function if exists public.create_delivered_order_cash_foundations(target_customer_order uuid);
drop function if exists public.reverse_store_order_commission(target_commission uuid, reversal_amount numeric, reversal_idempotency_key uuid, reversal_reason text);
drop function if exists public.request_c5_cash_handover(expected_user uuid, attempt_key uuid, requested_amount numeric);
drop function if exists public.recover_c5_cash_handover(expected_user uuid, attempt_key uuid);
drop function if exists public.get_c5_driver_custody(target_driver uuid, expected_user uuid, page_number integer);
drop function if exists public.list_c5_cash_requests(expected_user uuid, state_filter text, page_number integer);
drop function if exists public.confirm_c5_cash_handover(target_request uuid, target_driver uuid, expected_user uuid, attempt_key uuid, counted_amount numeric);
drop function if exists public.save_c6_wage_policy(expected_user uuid, attempt_key uuid, expected_policy uuid, percentage_value numeric, change_reason text);
drop function if exists public.pay_c6_driver_wages(target_driver uuid, expected_user uuid, attempt_key uuid, target_tasks uuid[], expected_amount numeric);
drop function if exists public.recover_c6_operation(expected_user uuid, attempt_key uuid);
drop function if exists public.get_c6_wage_policy(expected_user uuid, page_number integer);
drop function if exists public.get_c6_driver_wages(target_driver uuid, expected_user uuid, page_number integer);
drop function if exists public.list_c6_driver_wages(expected_user uuid, page_number integer);
drop function if exists public.prepare_c7_settlement(target_store uuid, expected_user uuid, attempt_key uuid, target_subs uuid[], expected_amount numeric);
drop function if exists public.pay_c7_settlement(target_store uuid, target_settlement uuid, expected_user uuid, attempt_key uuid, expected_amount numeric);
drop function if exists public.recover_c7_operation(expected_user uuid, attempt_key uuid);
drop function if exists public.get_c7_merchant_settlements(expected_user uuid, target_store uuid, page_number integer);
drop function if exists public.list_c7_merchant_settlements(expected_user uuid, page_number integer);
drop function if exists public.read_subscription_account(expected_user uuid, target_merchant uuid, page_number integer);
drop function if exists public.save_subscription_plan_version(expected_user uuid, attempt_key uuid, target_plan uuid, plan_name text, plan_description text, price_value numeric, months_value integer, available_value boolean, effective_time timestamp with time zone, change_reason text);
drop function if exists public.enroll_subscription_account(target_merchant uuid, target_plan uuid, expected_user uuid, attempt_key uuid, enrollment_reason text);
drop function if exists public.recover_subscription_operation(expected_user uuid, attempt_key uuid);
drop function if exists public.change_subscription_account(target_merchant uuid, expected_user uuid, attempt_key uuid, action_value text, value_text text, change_reason text);
drop function if exists public.issue_subscription_invoice(target_merchant uuid, expected_user uuid, attempt_key uuid, issue_reason text);
drop function if exists public.collect_subscription_invoice(target_invoice uuid, target_merchant uuid, expected_user uuid, attempt_key uuid, counted_amount numeric, collection_reason text);
drop function if exists public.list_subscription_accounts(expected_user uuid, page_number integer);
drop function if exists public.can_read_treasury_document(document_kind text);
drop function if exists public.record_treasury_action(expected_user uuid, attempt_key uuid, action_input jsonb);
drop function if exists public.recover_treasury_action(expected_user uuid, attempt_key uuid);
drop function if exists public.read_treasury_control(expected_user uuid, view_value text, page_number integer, from_time timestamp with time zone, to_time timestamp with time zone, direction_value text, target_journal uuid);
drop function if exists public.request_treasury_finance(expected_user uuid, attempt_key uuid, request_input jsonb);
drop function if exists public.act_on_treasury_finance(expected_user uuid, attempt_key uuid, target_request uuid, action_value text, action_reason text, owner_confirmed boolean);
drop function if exists public.can_read_treasury_finance(kind_value text);
drop function if exists public.read_treasury_finance(expected_user uuid, kind_value text, page_number integer);
drop function if exists public.read_financial_reconciliation(expected_user uuid, page_number integer, scope_value text);
drop function if exists public.set_finance_transition_gate(expected_user uuid, path_value text, enabled_value boolean, change_reason text);
drop function if exists public.transition_legacy_subscription(target_merchant uuid, target_plan uuid, expected_user uuid, attempt_key uuid, transition_reason text);
drop function if exists public.get_legacy_delivery_collection(expected_user uuid, target_task uuid);
drop function if exists public.read_finance_transition(expected_user uuid, page_number integer);
drop function if exists public.renew_merchant_subscription(target_merchant uuid, renewal_idempotency_key uuid, renewal_reason text);
drop function if exists public.create_delivered_order_cash_foundations_after_store_delivery();
drop function if exists public.create_delivered_order_cash_foundations_after_task_delivery();
drop table public.c7_merchant_settlement_payments,public.customer_order_cash_obligations,public.delivery_collection_results,public.delivery_pickup_workflows,public.delivery_store_pickups,public.delivery_wage_snapshots,public.driver_cash_credit_payouts,public.driver_cash_handover_attempts,public.driver_cash_handover_requests,public.driver_cash_receipt_allocations,public.driver_cash_remittances,public.driver_delivery_fee_entitlements,public.driver_wage_entitlements,public.driver_wage_payment_items,public.driver_wage_payments,public.driver_wage_policies,public.financial_account_definitions,public.financial_accounts,public.financial_document_references,public.financial_events,public.financial_operations,public.invoice_payment_allocations,public.journal_entries,public.journal_lines,public.merchant_billing_settings,public.merchant_credit_limits,public.merchant_delivery_positions,public.merchant_financial_audit_events,public.merchant_ledger_entries,public.merchant_order_entitlement_adjustments,public.merchant_order_entitlements,public.merchant_settlement_batch_entitlements,public.merchant_settlement_batches,public.merchant_settlement_document_items,public.merchant_settlement_documents,public.merchant_settlement_payment_allocations,public.merchant_settlement_payments,public.merchant_subscription_plan_changes,public.merchant_subscriptions,public.order_financial_modes,public.order_lifecycle_events,public.store_order_commission_reversals,public.store_order_commissions,public.subscription_account_events,public.subscription_billing_documents,public.subscription_cash_receipts,public.subscription_invoices,public.subscription_memberships,public.subscription_payment_allocation_batches,public.subscription_payments,public.subscription_plan_versions,public.treasury_control_documents,public.treasury_finance_events,public.treasury_finance_postings,public.treasury_finance_requests,public.wallet_transactions,public.wallets;
truncate table public.store_reviews,public.product_reviews,public.customer_cart_items,public.customer_cart_offer_selections,public.customer_cart_store_notes,public.customer_order_requests,public.order_pricing_revisions,public.order_pricing_current,public.order_pricing_snapshots,public.store_order_status_history,public.store_order_items,public.store_order_totals,public.customer_order_totals,public.delivery_tasks,public.store_orders,public.customer_orders;
-- Invoice-driven finance: positive balance is owed TO the participant.
create table public.money_accounts (
 owner_id uuid primary key references public.profiles(id), reference text not null unique,
 created_at timestamptz not null default now()
);
create table public.money_invoices (
 id uuid primary key default gen_random_uuid(), reference text not null unique,
 kind text not null check(kind in ('INV','SUB','SAL','DLV','WAG','SET','COR')),
 owner_id uuid not null references public.profiles(id), title text not null,
 source_key text not null unique, customer_order_id uuid references public.customer_orders(id),
 store_order_id uuid references public.store_orders(id), task_id uuid references public.delivery_tasks(id),
 amount numeric(14,2) not null check(amount>=0), details jsonb not null default '{}',
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled')),
 cash_direction text check(cash_direction in ('in','out')), corrects uuid references public.money_invoices(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(),
 confirmed_at timestamptz, voided_by uuid references public.money_invoices(id)
);
create index money_invoices_owner on public.money_invoices(owner_id,created_at desc);
create index money_invoices_order on public.money_invoices(customer_order_id);
create table public.money_dues (
 id uuid primary key default gen_random_uuid(),invoice_id uuid not null references public.money_invoices(id),
 owner_id uuid not null references public.profiles(id),
 purpose text not null check(purpose in ('subscription','sale','collection','wage')),
 direction text not null check(direction in ('in','out')),
 amount numeric(14,2) not null check(amount>0), unique(invoice_id,purpose)
);
create table public.money_allocations (
 settlement_id uuid not null references public.money_invoices(id),due_id uuid not null references public.money_dues(id),
 amount numeric(14,2) not null check(amount>0),primary key(settlement_id,due_id)
);
create table public.money_driver_policies (
 driver_id uuid primary key references public.profiles(id),
 mode text not null check(mode in ('fixed','percentage','salary')),
 value numeric(14,2) not null check(value>0),
 updated_at timestamptz not null default now(),updated_by uuid not null references public.profiles(id),
 check(mode<>'percentage' or value<=100)
);
create table public.money_salary_periods (
 driver_id uuid not null references public.profiles(id), period daterange not null,
 invoice_id uuid not null unique references public.money_invoices(id),
 exclude using gist(driver_id with =,period with &&)
);
create table public.money_attempts (
 actor uuid not null references public.profiles(id), key uuid not null, input jsonb not null,
 result jsonb not null,primary key(actor,key)
);
create table public.commerce_references (
 kind text not null,record_id uuid not null,reference text not null unique,
 primary key(kind,record_id)
);
create table money_private.sequences (kind text primary key,value bigint not null);
create function money_private.reference(kind_value text) returns text language plpgsql security definer set search_path='' as $$
declare n text;begin
 insert into money_private.sequences(kind,value) values(kind_value,1)
 on conflict(kind) do update set value=money_private.sequences.value+1 returning value::text into n;
 return kind_value||'-'||repeat('0',greatest(0,7-length(n)))||n;
end $$;
create function commerce_private.register_document(kind_value text,target uuid) returns void language plpgsql security definer set search_path='' as $$
begin insert into public.commerce_references(kind,record_id,reference) values(kind_value,target,money_private.reference(kind_value)) on conflict(kind,record_id) do nothing; end $$;
create function money_private.account(owner_value uuid) returns void language plpgsql security definer set search_path='' as $$
begin insert into public.money_accounts(owner_id,reference) values(owner_value,money_private.reference('ACC')) on conflict(owner_id) do nothing;end $$;
create function money_private.invoice(kind_value text,owner_value uuid,title_value text,source_value text,amount_value numeric,details_value jsonb,
 order_value uuid default null,store_value uuid default null,task_value uuid default null,state_value text default 'pending') returns uuid
language plpgsql security definer set search_path='' as $$
declare result_value uuid;begin
 if exists(select 1 from public.profiles where id=owner_value and role in ('merchant','driver')) then perform money_private.account(owner_value);end if;
 insert into public.money_invoices(reference,kind,owner_id,title,source_key,amount,details,customer_order_id,store_order_id,task_id,status,created_by,confirmed_at)
 values(money_private.reference(kind_value),kind_value,owner_value,title_value,source_value,amount_value,details_value,order_value,store_value,task_value,state_value,auth.uid(),case when state_value='confirmed' then now() end)
 on conflict(source_key) do nothing returning id into result_value;
 if result_value is null then select id into strict result_value from public.money_invoices where source_key=source_value;end if;
 return result_value;
end $$;
create function money_private.due(invoice_value uuid,owner_value uuid,purpose_value text,direction_value text,amount_value numeric) returns void
language plpgsql security definer set search_path='' as $$ begin
 if amount_value>0 then insert into public.money_dues(invoice_id,owner_id,purpose,direction,amount)
 values(invoice_value,owner_value,purpose_value,direction_value,amount_value) on conflict(invoice_id,purpose) do nothing;end if;
end $$;
create function money_private.remaining(due_value uuid) returns numeric language sql stable security definer set search_path='' as $$
 select d.amount-coalesce((select sum(a.amount) from public.money_allocations a join public.money_invoices s on s.id=a.settlement_id
 where a.due_id=d.id and s.status='confirmed' and s.voided_by is null),0) from public.money_dues d where d.id=due_value
$$;
create function money_private.cash() returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(case cash_direction when 'in' then amount else -amount end),0) from public.money_invoices where kind='SET' and status='confirmed' and voided_by is null
$$;
create function money_private.can_read(invoice_value uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or exists(select 1 from public.money_invoices where id=invoice_value and owner_id=auth.uid())
$$;
-- No financial table is client-writable, including for an administrator.
alter table public.money_invoices enable row level security;
create policy invoices_read on public.money_invoices for select to authenticated using(owner_id=auth.uid() or public.is_admin());
alter table public.money_accounts enable row level security;
create policy accounts_read on public.money_accounts for select to authenticated using(owner_id=auth.uid() or public.is_admin());
alter table public.money_dues enable row level security;
create policy dues_read on public.money_dues for select to authenticated using(owner_id=auth.uid() or public.is_admin());
alter table public.money_allocations enable row level security;
create policy allocations_read on public.money_allocations for select to authenticated using(exists(select 1 from public.money_invoices i where i.id=settlement_id and (i.owner_id=auth.uid() or public.is_admin())));
alter table public.money_driver_policies enable row level security;
create policy wage_policy_read on public.money_driver_policies for select to authenticated using(driver_id=auth.uid() or public.is_admin());
alter table public.money_salary_periods enable row level security;
alter table public.money_attempts enable row level security;
alter table public.commerce_references enable row level security;
alter table public.merchant_terms enable row level security;
create policy merchant_terms_read on public.merchant_terms for select to authenticated using(public.is_admin() or exists(select 1 from public.merchants m where m.id=merchant_id and m.owner_user_id=auth.uid()));
grant select on public.money_invoices,public.money_accounts,public.money_dues,public.money_allocations,public.money_driver_policies,public.merchant_terms to authenticated;
-- Existing approved accounts start clean, without manufacturing historical dues.
do $$ declare r record;begin for r in select id from public.profiles where role in ('merchant','driver') loop perform money_private.account(r.id);end loop;end $$;
create or replace function public.read_money(search_value text default '',page_value integer default 0,target_owner uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_value uuid:=coalesce(target_owner,auth.uid());admin_value boolean:=public.is_admin();query_value text;result_value jsonb;begin
 if auth.uid() is null or (owner_value<>auth.uid() and not admin_value) then raise exception 'account access denied' using errcode='42501';end if;
 if page_value is null or page_value<0 or page_value>100000 then raise exception 'invalid page';end if;
 query_value:=upper(translate(trim(coalesce(search_value,'')),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'));
 select jsonb_build_object('admin',admin_value,'owner',owner_value,
 'account_reference',(select reference from public.money_accounts where owner_id=owner_value),
 'cash',case when admin_value then money_private.cash()::text end,
 'receivable',coalesce((select sum(money_private.remaining(d.id)) from public.money_dues d join public.money_invoices i on i.id=d.invoice_id where (admin_value and target_owner is null or d.owner_id=owner_value) and i.status='confirmed' and i.voided_by is null and d.direction='in'),0)::text,
 'payable',coalesce((select sum(money_private.remaining(d.id)) from public.money_dues d join public.money_invoices i on i.id=d.invoice_id where (admin_value and target_owner is null or d.owner_id=owner_value) and i.status='confirmed' and i.voided_by is null and d.direction='out'),0)::text,
 'collection_due',coalesce((select sum(money_private.remaining(d.id)) from public.money_dues d join public.money_invoices i on i.id=d.invoice_id where (admin_value and target_owner is null or d.owner_id=owner_value) and i.status='confirmed' and i.voided_by is null and d.purpose='collection'),0)::text,
 'subscription_due',coalesce((select sum(money_private.remaining(d.id)) from public.money_dues d join public.money_invoices i on i.id=d.invoice_id where (admin_value and target_owner is null or d.owner_id=owner_value) and i.status='confirmed' and i.voided_by is null and d.purpose='subscription'),0)::text,
 'rows',coalesce((select jsonb_agg(to_jsonb(x)) from (
 select i.id,i.reference,i.kind,i.title,i.amount::text,i.status,i.created_at,i.owner_id,p.full_name as owner_name,
 i.voided_by,i.customer_order_id,i.store_order_id,i.task_id,
 coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'purpose',d.purpose,'direction',d.direction,'amount',d.amount::text,'remaining',money_private.remaining(d.id)::text)) from public.money_dues d where d.invoice_id=i.id),'[]') as dues
 from public.money_invoices i join public.profiles p on p.id=i.owner_id
 where (admin_value and target_owner is null or i.owner_id=owner_value)
 and (query_value='' or position(query_value in i.reference)>0 or exists(select 1 from public.commerce_references r where position(query_value in r.reference)>0 and r.record_id in(i.customer_order_id,i.store_order_id,i.task_id)))
 order by i.created_at desc,i.id limit 51 offset page_value*50) x),'[]')) into result_value;
 return result_value;
end $$;
create or replace function public.read_money_invoice(target_invoice uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.money_invoices%rowtype;begin
 select * into r from public.money_invoices where id=target_invoice and (owner_id=auth.uid() or public.is_admin());
 if not found then raise exception 'invoice unavailable' using errcode='42501';end if;
 return to_jsonb(r)||jsonb_build_object('admin',public.is_admin(),'amount',r.amount::text,
 'dues',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'purpose',d.purpose,'direction',d.direction,'amount',d.amount::text,'remaining',money_private.remaining(d.id)::text)) from public.money_dues d where d.invoice_id=r.id),'[]'),
 'settlements',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'reference',s.reference,'amount',a.amount::text,'voided',s.voided_by is not null)) from public.money_allocations a join public.money_dues d on d.id=a.due_id join public.money_invoices s on s.id=a.settlement_id where d.invoice_id=r.id),'[]'),
 'references',coalesce((select jsonb_object_agg(kind,reference) from public.commerce_references where record_id in(r.customer_order_id,r.store_order_id,r.task_id)),'{}'));
end $$;
create function money_private.record_action(attempt_key uuid,action_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.money_attempts%rowtype;action_value text:=action_input->>'action';
 owner_value uuid;invoice_value uuid;due_value public.money_dues%rowtype;original public.money_invoices%rowtype;
 amount_value numeric;value_number numeric;mode_value text;result_value jsonb;reason_value text:=trim(coalesce(action_input->>'reason',''));
 period_start date;period_end date;begin
 if not public.is_admin() or attempt_key is null then raise exception 'administrator required' using errcode='42501';end if;
 -- One cash/account mutation at a time: exact overpayment and treasury checks across admins.
 perform pg_advisory_xact_lock(725601);
 select * into previous from public.money_attempts where actor=auth.uid() and key=attempt_key;
 if found then if previous.input is distinct from action_input then raise exception 'attempt input mismatch';end if;return previous.result;end if;
 if length(reason_value) not between 3 and 1000 then raise exception 'a clear reason is required';end if;
 owner_value:=nullif(action_input->>'owner','')::uuid;
 if action_value='settle' then
 select * into due_value from public.money_dues where id=(action_input->>'due')::uuid for update;
 select * into original from public.money_invoices where id=due_value.invoice_id for update;
 if due_value.id is null or original.status<>'confirmed' or original.voided_by is not null then raise exception 'due unavailable';end if;
 owner_value:=due_value.owner_id;amount_value:=(action_input->>'amount')::numeric;
 if amount_value is null or amount_value<=0 or amount_value<>round(amount_value,2) or amount_value::text in ('NaN','Infinity','-Infinity') or amount_value>money_private.remaining(due_value.id) then raise exception 'invalid or excess settlement';end if;
 if due_value.direction='out' and amount_value>money_private.cash() then raise exception 'insufficient treasury cash';end if;
 invoice_value:=money_private.invoice('SET',owner_value,case due_value.direction when 'in' then 'فاتورة تسوية — قبض' else 'فاتورة تسوية — صرف' end,'SET:'||auth.uid()::text||':'||attempt_key::text,amount_value,jsonb_build_object('reason',reason_value,'original_reference',original.reference,'purpose',due_value.purpose),state_value=>'confirmed');
 update public.money_invoices set cash_direction=due_value.direction where id=invoice_value;
 insert into public.money_allocations(settlement_id,due_id,amount) values(invoice_value,due_value.id,amount_value);
 -- Subscription starts only once its full fee is received; no automatic renewal or credit.
 if due_value.purpose='subscription' and money_private.remaining(due_value.id)=0 then
 update public.merchant_terms set starts_at=now(),expires_at=now()+make_interval(months=>duration_months)
 where merchant_id=(original.details->>'merchant_id')::uuid and starts_at is null;
 end if;
 elsif action_value='policy' then
 if not exists(select 1 from public.driver_applications where user_id=owner_value and status='accepted') then raise exception 'approved driver required';end if;
 mode_value:=action_input->>'mode';value_number:=(action_input->>'value')::numeric;
 if value_number is null or value_number::text in ('NaN','Infinity','-Infinity') or value_number<>round(value_number,2) then raise exception 'invalid wage value';end if;
 insert into public.money_driver_policies(driver_id,mode,value,updated_by) values(owner_value,mode_value,value_number,auth.uid())
 on conflict(driver_id) do update set mode=excluded.mode,value=excluded.value,updated_by=excluded.updated_by,updated_at=now();
 elsif action_value='salary' then
 select mode,value into mode_value,value_number from public.money_driver_policies where driver_id=owner_value for share;
 if mode_value is distinct from 'salary' then raise exception 'salary policy required';end if;
 period_start:=(action_input->>'from')::date;period_end:=(action_input->>'until')::date;
 if period_start is null or period_end is null or period_end<=period_start or period_end>current_date then raise exception 'valid completed salary period required';end if;
 if exists(select 1 from public.delivery_tasks where driver_id=owner_value and accepted_at>=period_start and accepted_at<period_end and wage_policy->>'mode'<>'salary') then raise exception 'period includes task-based wages';end if;
 invoice_value:=money_private.invoice('WAG',owner_value,'فاتورة استحقاق راتب','WAG:'||auth.uid()::text||':'||attempt_key::text,value_number,jsonb_build_object('from',period_start,'until',period_end,'reason',reason_value,'policy_value',value_number),state_value=>'confirmed');
 insert into public.money_salary_periods values(owner_value,daterange(period_start,period_end,'[)'),invoice_value);
 perform money_private.due(invoice_value,owner_value,'wage','out',value_number);
 elsif action_value='correct' then
 select * into original from public.money_invoices where id=(action_input->>'invoice')::uuid for update;
 if not found or original.voided_by is not null or original.status<>'confirmed' or original.kind in('COR','INV') then raise exception 'invoice cannot be corrected';end if;
 if exists(select 1 from public.money_dues d join public.money_allocations a on a.due_id=d.id join public.money_invoices s on s.id=a.settlement_id where d.invoice_id=original.id and s.voided_by is null) then raise exception 'correct its settlements first';end if;
 if original.kind='SET' and original.cash_direction='in' and money_private.cash()<original.amount then raise exception 'insufficient cash to reverse receipt';end if;
 invoice_value:=money_private.invoice('COR',original.owner_id,'فاتورة تصحيح وإلغاء أثر','COR:'||original.id::text,original.amount,jsonb_build_object('reason',reason_value,'original_reference',original.reference),original.customer_order_id,original.store_order_id,original.task_id,'confirmed');
 update public.money_invoices set corrects=original.id where id=invoice_value;
 update public.money_invoices set voided_by=invoice_value where id=original.id;
 if original.kind='WAG' then delete from public.money_salary_periods where invoice_id=original.id;end if;
 if original.kind='SUB' or (original.kind='SET' and original.details->>'purpose'='subscription') then
 update public.merchant_terms set starts_at=null,expires_at=null where merchant_id=coalesce((original.details->>'merchant_id')::uuid,(select (i.details->>'merchant_id')::uuid from public.money_allocations a join public.money_dues d on d.id=a.due_id join public.money_invoices i on i.id=d.invoice_id where a.settlement_id=original.id limit 1));
 end if;
 else raise exception 'unsupported action';end if;
 result_value:=jsonb_build_object('state','completed','invoice_id',invoice_value);
 insert into public.money_attempts(actor,key,input,result) values(auth.uid(),attempt_key,action_input,result_value);
 return result_value;
end $$;
create or replace function public.recover_money_action(attempt_key uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select result from public.money_attempts where actor=auth.uid() and key=attempt_key),'{}'::jsonb)
$$;
-- Administrative people picker includes approved professionals only.
create or replace function public.money_people() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not public.is_admin() then raise exception 'administrator required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'role',p.role,'account_reference',a.reference,'policy',to_jsonb(w)))
 from public.profiles p join public.money_accounts a on a.owner_id=p.id left join public.money_driver_policies w on w.driver_id=p.id
 where exists(select 1 from public.merchants m where m.owner_user_id=p.id) or exists(select 1 from public.driver_applications d where d.user_id=p.id and d.status='accepted')),'[]');
end $$;

alter table public.delivery_tasks add column wage_policy jsonb;
create table public.delivery_store_pickups (
 task_id uuid not null references public.delivery_tasks(id),store_order_id uuid not null unique references public.store_orders(id),
 driver_id uuid not null references public.profiles(id),reference text not null unique,
 picked_up_at timestamptz not null default now(),primary key(task_id,store_order_id)
);
create table public.money_delivery_attempts (
 actor uuid not null references public.profiles(id),key uuid not null,task_id uuid not null references public.delivery_tasks(id),
 version bigint not null,result jsonb not null,primary key(actor,key)
);
alter table public.delivery_store_pickups enable row level security;
create policy pickup_read on public.delivery_store_pickups for select to authenticated using(driver_id=auth.uid() or public.is_admin() or public.can_view_store_order(store_order_id));
grant select on public.delivery_store_pickups to authenticated;
alter table public.money_delivery_attempts enable row level security;
create or replace function public.store_accepts_new_orders(target_store uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.stores s join public.merchants m on m.id=s.merchant_id join public.merchant_terms t on t.merchant_id=m.id
 where s.id=target_store and s.status='accepted' and m.status='accepted' and t.starts_at<=now() and t.expires_at>now())
$$;
create function money_private.sync_customer_invoice(order_value uuid) returns void language plpgsql security definer set search_path='' as $$
declare payload jsonb;amount_value numeric;begin
 select jsonb_build_object('recipient',o.recipient_name,'address',o.delivery_address,'phone',o.contact_phone,'delivery_fee',p.delivery_fee::text,
 'stores',(select jsonb_agg(jsonb_build_object('name',s.name,'status',so.status,'reference',(select reference from public.commerce_references where kind='SOR' and record_id=so.id),
 'items',(select jsonb_agg(jsonb_build_object('title',product_title_snapshot,'quantity',quantity::text,'unit_price',unit_price_snapshot::text,'total',line_total::text,'offer',offer_snapshot)) from public.store_order_items where store_order_id=so.id)))
 from public.store_orders so join public.stores s on s.id=so.store_id where so.customer_order_id=o.id)) ,p.total
 into payload,amount_value from public.customer_orders o join public.order_pricing_current p on p.customer_order_id=o.id where o.id=order_value;
 update public.money_invoices set amount=amount_value,details=payload,status=case when amount_value=0 and exists(select 1 from public.customer_orders where id=order_value and status='cancelled') then 'cancelled' else status end where kind='INV' and customer_order_id=order_value and status='pending';
end $$;
create function money_private.order_invoices(order_value uuid) returns void language plpgsql security definer set search_path='' as $$
declare r record;invoice_value uuid;customer_value uuid;price_value numeric;commission_value numeric;begin
 select customer_id into strict customer_value from public.customer_orders where id=order_value;
 select total into strict price_value from public.order_pricing_current where customer_order_id=order_value;
 perform money_private.invoice('INV',customer_value,'فاتورة طلب العميل','INV:'||order_value::text,price_value,'{}',order_value);
 for r in select so.id,s.name,m.owner_user_id,t.commission_rate_snapshot,st.items_subtotal,
 (select jsonb_agg(jsonb_build_object('title',product_title_snapshot,'quantity',quantity::text,'price',unit_price_snapshot::text,'total',line_total::text,'offer',offer_snapshot)) from public.store_order_items where store_order_id=so.id) as items
 from public.store_orders so join public.stores s on s.id=so.store_id join public.merchants m on m.id=s.merchant_id
 join public.merchant_terms t on t.merchant_id=m.id join public.store_order_totals st on st.store_order_id=so.id where so.customer_order_id=order_value loop
 commission_value:=round(r.items_subtotal*r.commission_rate_snapshot/100,2);
 invoice_value:=money_private.invoice('SAL',r.owner_user_id,'فاتورة مبيعات — '||r.name,'SAL:'||r.id::text,r.items_subtotal,
 jsonb_build_object('store',r.name,'items',r.items,'commission_rate',r.commission_rate_snapshot::text,'commission',commission_value::text,'merchant_net',(r.items_subtotal-commission_value)::text),order_value,r.id);
 perform money_private.due(invoice_value,r.owner_user_id,'sale','out',r.items_subtotal-commission_value);
 end loop;
 perform money_private.sync_customer_invoice(order_value);
end $$;
create or replace function public.make_order_delivery_available() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='UPDATE' and new.status is distinct from old.status then
  if new.status in('rejected','cancelled') then
   perform commerce_private.c3_recalculate(new.customer_order_id,new.id,coalesce(new.rejection_reason,'cancelled'));
   update public.money_invoices set status='cancelled' where store_order_id=new.id and kind='SAL' and status='pending';
   perform money_private.sync_customer_invoice(new.customer_order_id);
  end if;
  if new.status in('preparing','ready_for_pickup','rejected','cancelled') then perform commerce_private.c3_dispatch(new.customer_order_id);end if;
 end if;
 return new;
end $$;
create trigger delivery_dispatch_after_store_ready after update of status on public.store_orders for each row execute function public.make_order_delivery_available();
create or replace function public.accept_delivery_task(target_customer_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.delivery_tasks%rowtype;p public.money_driver_policies%rowtype;invoice_value uuid;price_value numeric;fee_value numeric;begin
 if not public.is_available_driver() then raise exception 'available approved driver required' using errcode='42501';end if;
 perform 1 from public.customer_orders where id=target_customer_order for update;
 select * into t from public.delivery_tasks where customer_order_id=target_customer_order for update;
 if t.driver_id=auth.uid() and t.status in('accepted','picked_up','delivered') then return;end if;
 if t.id is null or t.status<>'available' or t.driver_id is not null then raise exception 'task unavailable';end if;
 select * into p from public.money_driver_policies where driver_id=auth.uid() for share;
 if not found then raise exception 'configure driver wage policy before accepting tasks';end if;
 select total,delivery_fee into price_value,fee_value from public.order_pricing_current where customer_order_id=target_customer_order and not review_required;
 if not found then raise exception 'pricing unavailable';end if;
 update public.delivery_tasks set driver_id=auth.uid(),status='accepted',accepted_at=now(),wage_policy=jsonb_build_object('mode',p.mode,'value',p.value::text) where id=t.id;
 invoice_value:=money_private.invoice('DLV',auth.uid(),'فاتورة مهمة توصيل','DLV:'||t.id::text,price_value,
 jsonb_build_object('recipient',(select recipient_name from public.customer_orders where id=target_customer_order),'address',(select delivery_address from public.customer_orders where id=target_customer_order),'phone',(select contact_phone from public.customer_orders where id=target_customer_order),'expected_collection',price_value::text,'collected','0','delivery_fee',fee_value::text,'wage_policy',jsonb_build_object('mode',p.mode,'value',p.value::text)),target_customer_order,null,t.id);
end $$;
create or replace function public.confirm_c4_store_pickup(target_task uuid,target_store_order uuid,expected_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.delivery_tasks%rowtype;parent_value uuid;begin
 if expected_user is distinct from auth.uid() or not public.is_approved_driver() then raise exception 'assigned driver required' using errcode='42501';end if;
 select customer_order_id into parent_value from public.delivery_tasks where id=target_task;
 perform 1 from public.customer_orders where id=parent_value for update;
 select * into t from public.delivery_tasks where id=target_task for update;
 if t.driver_id is distinct from expected_user then raise exception 'assigned driver required' using errcode='42501';end if;
 if exists(select 1 from public.delivery_store_pickups where task_id=target_task and store_order_id=target_store_order) then return jsonb_build_object('state','confirmed');end if;
 if t.status<>'accepted' or not exists(select 1 from public.order_pricing_current where customer_order_id=parent_value and not review_required) then raise exception 'pickup unavailable';end if;
 if not exists(select 1 from public.store_orders where id=target_store_order and customer_order_id=parent_value and status='ready_for_pickup') then raise exception 'store is not ready';end if;
 insert into public.delivery_store_pickups(task_id,store_order_id,driver_id,reference) values(target_task,target_store_order,expected_user,money_private.reference('PUP'));
 update public.store_orders set status='handed_to_driver' where id=target_store_order;
 if not exists(select 1 from public.store_orders where customer_order_id=parent_value and status not in('rejected','cancelled','handed_to_driver')) then
 update public.delivery_tasks set status='picked_up',picked_up_at=now() where id=target_task;
 perform public.refresh_customer_order_status(parent_value);
 end if;
 return jsonb_build_object('state','confirmed');
end $$;
create or replace function public.get_c4_pickup_context(target_tasks uuid[],expected_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result_value jsonb:='{}';t record;begin
 if expected_user is distinct from auth.uid() or not public.is_approved_driver() then raise exception 'driver required' using errcode='42501';end if;
 if cardinality(target_tasks)>80 then raise exception 'too many tasks';end if;
 for t in select d.*,p.version,p.review_required from public.delivery_tasks d join public.order_pricing_current p on p.customer_order_id=d.customer_order_id where d.id=any(target_tasks) and d.driver_id=expected_user loop
 result_value:=result_value||jsonb_build_object(t.id::text,jsonb_build_object('mode','c4','can_confirm_pickup',t.status='accepted' and not t.review_required,
 'can_complete_delivery',t.status='picked_up' and not t.review_required,'pricing_version',t.version,'reason',case when t.review_required then 'pricing_review' else null end,
 'confirmed',coalesce((select jsonb_agg(store_order_id) from public.delivery_store_pickups where task_id=t.id),'[]')));
 end loop;return result_value;
end $$;
create or replace function public.complete_delivery_and_collect_cash(target_task uuid,expected_user uuid,attempt_key uuid,expected_pricing_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.delivery_tasks%rowtype;p public.order_pricing_current%rowtype;a public.money_delivery_attempts%rowtype;
 invoice_value uuid;wage_value numeric;result_value jsonb;parent_value uuid;begin
 if expected_user is distinct from auth.uid() or not public.is_approved_driver() or attempt_key is null then raise exception 'assigned driver required' using errcode='42501';end if;
 select customer_order_id into parent_value from public.delivery_tasks where id=target_task;
 perform 1 from public.customer_orders where id=parent_value for update;
 select * into t from public.delivery_tasks where id=target_task for update;
 if t.id is null or t.driver_id is distinct from expected_user then raise exception 'assigned driver required' using errcode='42501';end if;
 select * into a from public.money_delivery_attempts where actor=expected_user and key=attempt_key;
 if found then if a.task_id<>target_task or a.version<>expected_pricing_version then raise exception 'attempt input mismatch';end if;return a.result;end if;
 select * into strict p from public.order_pricing_current where customer_order_id=parent_value;
 if t.status='delivered' then
 select id into strict invoice_value from public.money_invoices where task_id=t.id and kind='DLV' and status='confirmed';
 result_value:=jsonb_build_object('state','completed','task_id',t.id,'amount',p.total::text,'kind',case when p.total=0 then 'zero_cash_delivery' else 'cash_delivery' end);
 elsif p.review_required or p.version<>expected_pricing_version then result_value:=jsonb_build_object('state','rejected','code','pricing_changed');
 elsif t.status<>'picked_up' or exists(select 1 from public.store_orders where customer_order_id=parent_value and status not in('rejected','cancelled','handed_to_driver')) then result_value:=jsonb_build_object('state','rejected','code','pickups_incomplete');
 else
 wage_value:=case t.wage_policy->>'mode' when 'fixed' then (t.wage_policy->>'value')::numeric when 'percentage' then round(p.delivery_fee*(t.wage_policy->>'value')::numeric/100,2) when 'salary' then 0 else null end;
 if wage_value is null then raise exception 'wage policy unavailable';end if;
 select id into strict invoice_value from public.money_invoices where task_id=t.id and kind='DLV';
 update public.money_invoices set status='confirmed',confirmed_at=now(),details=details||jsonb_build_object('collected',p.total::text,'wage',wage_value::text) where id=invoice_value;
 perform money_private.due(invoice_value,expected_user,'collection','in',p.total);
 perform money_private.due(invoice_value,expected_user,'wage','out',wage_value);
 update public.store_orders set status='delivered',delivered_at=now() where customer_order_id=parent_value and status='handed_to_driver';
 update public.delivery_tasks set status='delivered',delivered_at=now() where id=t.id;
 update public.money_invoices set status='confirmed',confirmed_at=now() where customer_order_id=parent_value and kind in('INV','SAL') and status='pending';
 perform public.refresh_customer_order_status(parent_value);
 result_value:=jsonb_build_object('state','completed','task_id',t.id,'amount',p.total::text,'kind',case when p.total=0 then 'zero_cash_delivery' else 'cash_delivery' end);
 end if;
 insert into public.money_delivery_attempts(actor,key,task_id,version,result) values(expected_user,attempt_key,t.id,expected_pricing_version,result_value);
 return result_value;
end $$;
create or replace function public.recover_delivery_collection(attempt_key uuid,expected_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if expected_user is distinct from auth.uid() then raise exception 'account changed' using errcode='42501';end if;
 return coalesce((select result from public.money_delivery_attempts where actor=expected_user and key=attempt_key),jsonb_build_object('state','unknown'));
end $$;
create or replace function public.review_merchant_application(target_application uuid,decision public.application_status,decision_note text default null) returns void language plpgsql security definer set search_path='' as $$
declare a public.merchant_applications%rowtype;p public.subscription_plans%rowtype;m uuid;i uuid;begin
 if not public.is_admin() then raise exception 'administrator required' using errcode='42501';end if;
 if decision not in('accepted','rejected','changes_requested') then raise exception 'invalid decision';end if;
 select * into strict a from public.merchant_applications where id=target_application for update;
 if a.status='accepted' then if exists(select 1 from public.merchants where owner_user_id=a.user_id) then return;end if;raise exception 'accepted merchant application is not provisioned';end if;
 if decision='accepted' then
 select * into p from public.subscription_plans where id=a.plan_id and is_active for share;
 if p.id is null or a.plan_commission_rate_snapshot is null or a.plan_product_limit_snapshot is null or
 (p.name,p.price,p.duration_months,p.commission_rate,p.product_limit,p.features) is distinct from (a.plan_name_snapshot,a.plan_price_snapshot,a.plan_duration_months_snapshot,a.plan_commission_rate_snapshot,a.plan_product_limit_snapshot,a.plan_features_snapshot) then raise exception 'selected subscription plan no longer matches';end if;
 insert into public.merchants(owner_user_id,contact_phone,status) values(a.user_id,a.contact_phone,'accepted') returning id into m;
 insert into public.stores(merchant_id,name,description,phone,address,category_id,status) values(m,a.store_name,a.store_description,a.contact_phone,a.store_address,a.category_id,'accepted');
 insert into public.merchant_terms(merchant_id,plan_id,plan_name_snapshot,duration_months,price_snapshot,commission_rate_snapshot,product_limit)
 values(m,a.plan_id,a.plan_name_snapshot,a.plan_duration_months_snapshot,a.plan_price_snapshot,a.plan_commission_rate_snapshot,a.plan_product_limit_snapshot);
 i:=money_private.invoice('SUB',a.user_id,'فاتورة اشتراك','SUB:'||a.id::text,a.plan_price_snapshot,
 jsonb_build_object('merchant_id',m,'plan',a.plan_name_snapshot,'months',a.plan_duration_months_snapshot,'commission_rate',a.plan_commission_rate_snapshot,'product_limit',a.plan_product_limit_snapshot,'features',a.plan_features_snapshot),state_value=>'confirmed');
 perform money_private.due(i,a.user_id,'subscription','in',a.plan_price_snapshot);
 end if;
 update public.merchant_applications set status=decision,review_note=nullif(trim(decision_note),''),reviewed_by=auth.uid(),reviewed_at=now() where id=a.id;
end $$;

CREATE OR REPLACE FUNCTION commerce_private.c3_fee(base_value numeric, uplift_value numeric, stores_count integer)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$

declare result_value numeric;

begin

  if base_value is null or uplift_value is null or stores_count is null or stores_count<0

    or base_value<0 or uplift_value<0 or base_value<>trunc(base_value) or uplift_value<>trunc(uplift_value)

    or base_value::text in ('NaN','Infinity','-Infinity') or uplift_value::text in ('NaN','Infinity','-Infinity') then

    raise exception 'invalid C3 delivery pricing';

  end if;

  result_value:=case when stores_count=0 then 0 else base_value+greatest(stores_count-1,0)*uplift_value end;

  if result_value>999999999999 then raise exception 'delivery fee exceeds supported order amount'; end if;

  return result_value;

end $function$;

CREATE OR REPLACE FUNCTION commerce_private.c3_cart_signature(cart_value uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$

  select jsonb_build_object('cart',cart_value,

    'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.product_id) from (

      select ci.product_id,ci.quantity,p.price,p.title,p.selling_unit,p.minimum_quantity,p.quantity_step,p.is_available

      from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_value

    ) x),'[]'::jsonb),

    'offers',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (

      select o.id,extract(epoch from o.updated_at) as offer_version,o.is_active,

        extract(epoch from o.starts_at) as starts_at_epoch,extract(epoch from o.ends_at) as ends_at_epoch,

        (select jsonb_agg(jsonb_build_array(op.id,op.product_id,op.item_role,op.quantity,p.price,p.is_available)

          order by op.id) from public.store_offer_products op join public.products p on p.id=op.product_id where op.offer_id=o.id) as components

      from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id where cs.cart_id=cart_value

    ) x),'[]'::jsonb),

    'notes',coalesce((select jsonb_agg(jsonb_build_array(store_id,note) order by store_id)

      from public.customer_cart_store_notes where cart_id=cart_value),'[]'::jsonb))::text

$function$;

CREATE OR REPLACE FUNCTION commerce_private.c3_lock_cart(owner_value uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$

declare cart_value uuid;

begin

  select id into cart_value from public.customer_carts where customer_id=owner_value for update;

  if not found then raise exception 'cart is empty'; end if;

  perform 1 from public.customer_cart_items where cart_id=cart_value order by product_id for update;

  perform 1 from public.customer_cart_offer_selections where cart_id=cart_value order by offer_id for update;

  perform 1 from public.customer_cart_store_notes where cart_id=cart_value order by store_id for update;

  perform 1 from public.store_offers o where exists(select 1 from public.customer_cart_offer_selections cs

    where cs.cart_id=cart_value and cs.offer_id=o.id) order by o.id for share;

  perform 1 from public.store_offer_products op where exists(select 1 from public.customer_cart_offer_selections cs

    where cs.cart_id=cart_value and cs.offer_id=op.offer_id) order by op.id for share;

  perform 1 from public.products p where exists(select 1 from public.customer_cart_items ci where ci.cart_id=cart_value and ci.product_id=p.id)

    or exists(select 1 from public.customer_cart_offer_selections cs join public.store_offer_products op on op.offer_id=cs.offer_id

      where cs.cart_id=cart_value and op.product_id=p.id) order by p.id for share;

  return cart_value;

end $function$;

CREATE OR REPLACE FUNCTION commerce_private.c3_zone_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

begin

  if not public.is_admin() then raise exception 'administrator required' using errcode='42501'; end if;

  if tg_op='UPDATE' then new.pricing_version:=old.pricing_version+1;

  else new.pricing_version:=1; end if;

  return new;

end $function$;

CREATE OR REPLACE FUNCTION commerce_private.c3_legacy_update_store_order_status(target_store_order uuid, next_status store_order_status, reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  order_row public.store_orders%rowtype;
begin
  select * into order_row from public.store_orders so where so.id = target_store_order for update;
  if not found then raise exception 'store order not found'; end if;
  if not public.is_admin() and not public.is_store_owner(order_row.store_id) then
    raise exception 'store owner or administrator access required';
  end if;
  if next_status = 'preparing' and order_row.status = 'awaiting_review' then
    update public.store_orders set status = 'preparing', rejection_reason = null where id = target_store_order;
  elsif next_status = 'ready_for_pickup' and order_row.status = 'preparing' then
    update public.store_orders set status = 'ready_for_pickup', rejection_reason = null where id = target_store_order;
  elsif next_status = 'rejected' and order_row.status = 'awaiting_review' then
    if nullif(trim(reason), '') is null then raise exception 'a rejection reason is required'; end if;
    update public.store_orders set status = 'rejected', rejection_reason = trim(reason) where id = target_store_order;
  else
    raise exception 'invalid store order status transition';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION commerce_private.c3_legacy_cancel_customer_order(target_customer_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

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

$function$;

CREATE OR REPLACE FUNCTION commerce_private.c3_recalculate(target_order uuid, source_child uuid, change_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare snap public.order_pricing_snapshots%rowtype; previous public.order_pricing_current%rowtype;

  count_value integer; goods numeric; fee_value numeric; proposed_total numeric; blocked boolean;

  customer_value uuid; next_version bigint;

begin

  select customer_id into strict customer_value from public.customer_orders where id=target_order for update;

  select * into snap from public.order_pricing_snapshots where customer_order_id=target_order;

  if not found then return; end if;

  select * into strict previous from public.order_pricing_current where customer_order_id=target_order for update;

  if exists(select 1 from public.store_orders s left join public.store_order_totals t on t.store_order_id=s.id

    where s.customer_order_id=target_order and s.status not in ('rejected','cancelled') and t.store_order_id is null) then

    raise exception 'missing authoritative store total';

  end if;

  select count(*)::integer,coalesce(sum(t.items_subtotal),0) into count_value,goods

  from public.store_orders s join public.store_order_totals t on t.store_order_id=s.id

  where s.customer_order_id=target_order and s.status not in ('rejected','cancelled');

  if goods<>round(goods,2) or goods<0 or goods::text in ('NaN','Infinity','-Infinity') then raise exception 'invalid C3 store total'; end if;

  fee_value:=commerce_private.c3_fee(snap.base_fee,snap.additional_store_fee,count_value);

  proposed_total:=goods+fee_value;

  blocked:=count_value>0 and (previous.review_required or proposed_total>least(previous.total,snap.approved_total) or proposed_total>999999999999.99);

  next_version:=previous.version+1;

  insert into public.order_pricing_revisions(customer_order_id,version,source_store_order_id,before_amounts,proposed_amounts,applied,reason,actor_id)

  values(target_order,next_version,source_child,to_jsonb(previous),jsonb_build_object('active_store_count',count_value,

    'items_amount',goods,'delivery_fee',fee_value,'total',proposed_total),not blocked,change_reason,auth.uid());

  update public.order_pricing_current set version=next_version,review_required=blocked,

    active_store_count=case when blocked then active_store_count else count_value end,

    items_amount=case when blocked then items_amount else goods end,

    delivery_fee=case when blocked then delivery_fee else fee_value end,

    total=case when blocked then total else proposed_total end,updated_at=clock_timestamp()

  where customer_order_id=target_order;

  if count_value=0 then

    update public.order_pricing_current set active_store_count=0,items_amount=0,delivery_fee=0,total=0,review_required=false where customer_order_id=target_order;

    update public.customer_orders set status='cancelled',delivery_fee=0 where id=target_order;

  elsif not blocked then

    -- Legacy cash foundations read this effective fee at delivery. Original fee

    -- and approved totals remain in the immutable C3 snapshot and old totals.

    update public.customer_orders set delivery_fee=fee_value where id=target_order;

  end if;

  insert into public.notifications(user_id,type,title,body,data) values(customer_value,'order',

    case when count_value=0 then 'أُلغي الطلب' when blocked then 'طلبك قيد المراجعة' else 'تحديث مبلغ الطلب' end,

    case when count_value=0 then 'لم تتبق متاجر لتنفيذ الطلب.' when blocked then 'توقف الإرسال لحين مراجعة اختلاف المبلغ؛ لم تُطبق زيادة.'

      else 'أصبح إجمالي الدفع عند الاستلام '||proposed_total::text||' ل.س بعد تحديث أجزاء الطلب.' end,

    jsonb_build_object('orderId',target_order,'url','/order-details?id='||target_order::text));

end $function$;

CREATE OR REPLACE FUNCTION commerce_private.c3_dispatch(target_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare current_price public.order_pricing_current%rowtype; task_value uuid; customer_value uuid;

  active_count integer; ready_count integer; driver_value uuid;

begin

  select customer_id into customer_value from public.customer_orders

  where id=target_order and status not in ('cancelled','delivered','partially_cancelled') for update;

  if not found then return; end if;

  select * into current_price from public.order_pricing_current where customer_order_id=target_order;

  if not found or current_price.review_required then return; end if;

  select count(*)::integer,count(*) filter(where status='ready_for_pickup')::integer into active_count,ready_count

  from public.store_orders where customer_order_id=target_order and status not in ('rejected','cancelled');

  if active_count=0 or active_count<>ready_count or active_count<>current_price.active_store_count then return; end if;

  if exists(select 1 from public.delivery_tasks where customer_order_id=target_order) then return; end if;

  insert into public.delivery_tasks(customer_order_id,status) values(target_order,'available') returning id into task_value;

  perform commerce_private.register_document('TSK',task_value);

  update public.customer_orders set status='ready_for_delivery' where id=target_order;

  insert into public.notifications(user_id,type,title,body,data) values(customer_value,'order','طلبك جاهز للتوصيل',

    'أصبحت جميع أجزاء الطلب المتبقية جاهزة للاستلام.',jsonb_build_object('orderId',target_order,'url','/order-details?id='||target_order::text));

  for driver_value in select p.id from public.profiles p join public.driver_applications a on a.user_id=p.id

    where p.role='driver' and a.status='accepted' and a.is_available loop

    insert into public.notifications(user_id,type,title,body,data) values(driver_value,'order','طلب توصيل متاح',

      'أصبح طلب جديد جاهزًا للاستلام.',jsonb_build_object('orderId',target_order,'url','/driver'));

  end loop;

end $function$;

create trigger delivery_zone_version before update on public.delivery_zones for each row execute function commerce_private.c3_zone_version();

CREATE OR REPLACE FUNCTION public.create_order_from_cart(input_recipient_name text, input_contact_phone text, input_delivery_address text, input_delivery_zone uuid, input_customer_note text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

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

  cumulative_original_total numeric(14,2);

  item_original_total numeric(14,2);

  item_final_total numeric(14,2);

  item_quantity numeric(12,3);

  item_unit_price numeric(14,2);

  offer_item_count integer;

  offer_item_index integer;

  item_offer_role public.offer_product_role;

  item_offer_snapshot jsonb;

  store_count_value integer;

  fee_value numeric;

  items_value numeric;

  child_value record;

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

  select count(*)::integer into store_count_value from (

    select p.store_id from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_row.id

    union select o.store_id from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id where cs.cart_id=cart_row.id

  ) stores_in_cart;

  if exists(select 1 from (select p.store_id from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_row.id union select o.store_id from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id where cs.cart_id=cart_row.id) x where not public.store_accepts_new_orders(x.store_id)) then raise exception 'C8_STORE_UNAVAILABLE';end if;
  fee_value:=commerce_private.c3_fee(zone_row.fixed_fee,zone_row.additional_store_fee,store_count_value);

  insert into public.customer_orders(

    customer_id, recipient_name, contact_phone, delivery_address,

    delivery_zone_id, delivery_zone_name_snapshot, delivery_fee, customer_note

  )

  values (

    current_customer, trim(input_recipient_name), trim(input_contact_phone),

    trim(input_delivery_address), zone_row.id, zone_row.name, fee_value,

    coalesce(trim(input_customer_note), '')

  )

  returning id into new_order;

  -- DLV is created by the C3 gate only after all active stores are ready.

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

      cumulative_original_total := 0;

      offer_item_index := 0;

      if offer_row.offer_type='bundle' and offer_original_total<=0 then

        raise exception 'bundle has no allocation basis';

      end if;

      for offer_item in

        select op.product_id, op.item_role, op.quantity, p.title,

          p.selling_unit, p.price, 'SYP'::public.currency_code as currency

        from public.store_offer_products op

          join public.products p on p.id = op.product_id and p.store_id = op.store_id

        where op.offer_id = offer_row.id and p.is_available

        order by op.item_role, op.id

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

          -- Round cumulative shares, not independent components. Successive

          -- boundaries are monotone and the last boundary is the exact bundle

          -- price, so residual cents cannot produce a negative last component.

          cumulative_original_total := cumulative_original_total + item_original_total;

          if offer_item_index = offer_item_count then

            item_final_total := offer_bundle_total - allocated_total;

          else

            item_final_total := round(

              offer_bundle_total * cumulative_original_total / offer_original_total, 2

            ) - allocated_total;

          end if;

          allocated_total := allocated_total + item_final_total;

          if item_final_total<0 or allocated_total>offer_bundle_total then

            raise exception 'invalid bundle allocation';

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

      if offer_row.offer_type='bundle' and

        (allocated_total<>offer_bundle_total or cumulative_original_total<>offer_original_total) then

        raise exception 'incomplete bundle allocation';

      end if;

    end loop;

    insert into public.store_order_totals(store_order_id, currency, items_subtotal)

    select soi.store_order_id, 'SYP'::public.currency_code, sum(soi.line_total)

    from public.store_order_items soi

    where soi.store_order_id = created_store_order

    group by soi.store_order_id;

  end loop;

  insert into public.customer_order_totals(customer_order_id, currency, items_subtotal, delivery_fee, total)

  select new_order, 'SYP', coalesce(sum(soi.line_total),0), fee_value,

    coalesce(sum(soi.line_total),0) + fee_value

  from public.store_order_items soi join public.store_orders so on so.id=soi.store_order_id

  where so.customer_order_id=new_order;

  select items_subtotal into strict items_value from public.customer_order_totals where customer_order_id=new_order;

  insert into public.order_pricing_snapshots(customer_order_id,zone_id,zone_name,base_fee,additional_store_fee,

    original_store_count,original_items_amount,original_delivery_fee,approved_total,zone_version)

  values(new_order,zone_row.id,zone_row.name,zone_row.fixed_fee,zone_row.additional_store_fee,

    store_count_value,items_value,fee_value,items_value+fee_value,zone_row.pricing_version);

  insert into public.order_pricing_current(customer_order_id,version,active_store_count,items_amount,delivery_fee,total)

  values(new_order,1,store_count_value,items_value,fee_value,items_value+fee_value);

  perform commerce_private.register_document('ORD',new_order);

  for child_value in select id from public.store_orders where customer_order_id=new_order order by id loop

    perform commerce_private.register_document('SOR',child_value.id);

  end loop;

  delete from public.customer_cart_items where cart_id = cart_row.id;

  delete from public.customer_cart_store_notes where cart_id = cart_row.id;

  delete from public.customer_cart_offer_selections where cart_id = cart_row.id;

  perform money_private.order_invoices(new_order);
  return new_order;

end;

$function$;

CREATE OR REPLACE FUNCTION public.quote_c3_cart(target_zone uuid, expected_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare zone_row public.delivery_zones%rowtype; cart_value uuid; goods numeric; offer_goods numeric;

  count_value integer; fee_value numeric;

begin

  if expected_user is null or expected_user is distinct from auth.uid() then raise exception 'C3_ACCOUNT_CHANGED' using errcode='42501'; end if;

  if not exists(select 1 from public.profiles where id=expected_user and role='customer') then raise exception 'customer required' using errcode='42501'; end if;

  select * into zone_row from public.delivery_zones where id=target_zone and is_active for share;

  if not found then raise exception 'delivery zone is unavailable'; end if;

  cart_value:=commerce_private.c3_lock_cart(expected_user);

  select count(*)::integer into count_value from (

    select p.store_id from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_value

    union select o.store_id from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id where cs.cart_id=cart_value

  ) stores_in_cart;

  if exists(select 1 from (select p.store_id from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_value union select o.store_id from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id where cs.cart_id=cart_value) x where not public.store_accepts_new_orders(x.store_id)) then raise exception 'C8_STORE_UNAVAILABLE';end if;
  if count_value=0 then raise exception 'cart is empty'; end if;

  select coalesce(sum(round(ci.quantity*p.price,2)),0) into goods

  from public.customer_cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=cart_value;

  select coalesce(sum(offer_total),0) into offer_goods from (

    select o.id,case when o.offer_type='bundle' then round(o.bundle_price,2) else sum(case

      when o.offer_type='discount' and o.discount_method='percentage' then round(round(p.price*op.quantity,2)*(100-o.discount_value)/100,2)

      when o.offer_type='discount' then round(greatest(0,p.price-o.discount_value)*op.quantity,2)

      when op.item_role='reward' then 0 else round(p.price*op.quantity,2) end) end as offer_total

    from public.customer_cart_offer_selections cs join public.store_offers o on o.id=cs.offer_id

    join public.store_offer_products op on op.offer_id=o.id join public.products p on p.id=op.product_id

    where cs.cart_id=cart_value group by o.id

  ) priced_offers;

  goods:=goods+offer_goods;

  fee_value:=commerce_private.c3_fee(zone_row.fixed_fee,zone_row.additional_store_fee,count_value);

  if goods+fee_value>999999999999.99 then raise exception 'order total exceeds supported amount'; end if;

  return jsonb_build_object('items_amount',goods,'delivery_fee',fee_value,'total',goods+fee_value,'store_count',count_value,'cart_signature',commerce_private.c3_cart_signature(cart_value));

end $function$;

CREATE OR REPLACE FUNCTION public.create_c3_order_from_cart(input_recipient_name text, input_contact_phone text, input_delivery_address text, input_delivery_zone uuid, input_customer_note text, request_key_value uuid, expected_total numeric, expected_user uuid, expected_cart_signature text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare request_row public.customer_order_requests%rowtype; payload jsonb; order_value uuid; total_value numeric;

  cart_value uuid; failure_value text;

begin

  -- Before INSERT, locks, or replay: a new bearer must never execute an old account's intent.

  if expected_user is null or expected_user is distinct from auth.uid() then

    raise exception 'C3_ACCOUNT_CHANGED' using errcode='42501'; end if;

  if not exists(select 1 from public.profiles where id=expected_user and role='customer') then

    raise exception 'customer required' using errcode='42501'; end if;

  if request_key_value is null or expected_total is null or expected_total<0 or expected_total<>round(expected_total,2)

    or expected_total>999999999999.99 or expected_total::text in ('NaN','Infinity','-Infinity')

    or expected_cart_signature is null or char_length(expected_cart_signature) not between 1 and 1000000 then

    raise exception 'invalid confirmed checkout input'; end if;

  payload:=jsonb_build_array(expected_user,input_recipient_name,input_contact_phone,input_delivery_address,input_delivery_zone,

    input_customer_note,expected_total,expected_cart_signature);

  insert into public.customer_order_requests(customer_id,request_key,canonical_input)

    values(expected_user,request_key_value,payload) on conflict do nothing;

  select * into strict request_row from public.customer_order_requests

    where customer_id=expected_user and request_key=request_key_value for update;

  if request_row.canonical_input is distinct from payload then raise exception 'C3_ATTEMPT_INPUT_MISMATCH'; end if;

  if request_row.state='completed' then

    if not exists(select 1 from public.customer_orders where id=request_row.customer_order_id and customer_id=expected_user) then raise exception 'C3_ORDER_OWNERSHIP_MISMATCH' using errcode='42501'; end if;

    return jsonb_build_object('state','completed','order_id',request_row.customer_order_id,'replayed',true); end if;

  if request_row.state='rejected' then return jsonb_build_object('state','rejected','code',request_row.failure_code); end if;

  begin

    perform 1 from public.delivery_zones where id=input_delivery_zone and is_active for share;

    if not found then raise exception 'delivery zone is unavailable'; end if;

    if not exists(select 1 from public.profiles where id=expected_user and role='customer') then raise exception 'customer required' using errcode='42501';end if;

 cart_value:=commerce_private.c3_lock_cart(expected_user);

    if commerce_private.c3_cart_signature(cart_value) is distinct from expected_cart_signature then raise exception 'C3_CART_CHANGED'; end if;

    order_value:=public.create_order_from_cart(input_recipient_name,input_contact_phone,input_delivery_address,input_delivery_zone,input_customer_note);

    select approved_total into strict total_value from public.order_pricing_snapshots where customer_order_id=order_value;

    if total_value<>expected_total then raise exception 'C3_PRICE_CHANGED'; end if;

  exception when raise_exception or numeric_value_out_of_range or check_violation or foreign_key_violation then

    -- The subtransaction rolls back order/items/references/notifications. Persist a

    -- terminal rejection so a delayed same-key request cannot later create an order.

    failure_value:=case when sqlerrm='C8_STORE_UNAVAILABLE' then 'C8_STORE_UNAVAILABLE' when sqlerrm='C3_CART_CHANGED' then 'C3_CART_CHANGED'

      when sqlerrm='C3_PRICE_CHANGED' then 'C3_PRICE_CHANGED' else 'C3_ORDER_REJECTED' end;

    update public.customer_order_requests set state='rejected',failure_code=failure_value

      where customer_id=expected_user and request_key=request_key_value;

    return jsonb_build_object('state','rejected','code',failure_value);

  end;

  update public.customer_order_requests set state='completed',customer_order_id=order_value

    where customer_id=expected_user and request_key=request_key_value;

  return jsonb_build_object('state','completed','order_id',order_value,'replayed',false);

end $function$;

CREATE OR REPLACE FUNCTION public.update_store_order_status(target_store_order uuid, next_status store_order_status, reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare parent_value uuid; current_status public.store_order_status; store_value uuid;

begin

  select customer_order_id into parent_value from public.store_orders where id=target_store_order;

  if not found then raise exception 'store order not found'; end if;

  perform 1 from public.customer_orders where id=parent_value for update;

  select status,store_id into strict current_status,store_value from public.store_orders where id=target_store_order for update;

  if not public.is_admin() and not public.is_store_owner(store_value) then raise exception 'store owner required' using errcode='42501'; end if;

  if current_status=next_status then

    if next_status='rejected' and nullif(trim(reason),'') is distinct from (select rejection_reason from public.store_orders where id=target_store_order) then

      raise exception 'retry reason mismatch';

    end if;

    return;

  end if;

  if exists(select 1 from public.order_pricing_snapshots where customer_order_id=parent_value)

    and exists(select 1 from public.delivery_tasks where customer_order_id=parent_value) then

    raise exception 'store transitions closed after dispatch';

  end if;

  perform commerce_private.c3_legacy_update_store_order_status(target_store_order,next_status,reason);

end $function$;

CREATE OR REPLACE FUNCTION public.cancel_customer_order(target_customer_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

begin

  perform 1 from public.customer_orders where id=target_customer_order and customer_id=auth.uid() for update;

  if not found then raise exception 'customer order not found' using errcode='42501'; end if;

  if exists(select 1 from public.customer_orders where id=target_customer_order and status='cancelled') then return; end if;

  perform commerce_private.c3_legacy_cancel_customer_order(target_customer_order);

end $function$;

CREATE OR REPLACE FUNCTION public.save_c3_delivery_zone(target_zone uuid, zone_name text, base_fee numeric, uplift_fee numeric, active boolean, expected_version bigint DEFAULT NULL::bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare result_id uuid;

begin

  if not public.is_admin() then raise exception 'administrator required' using errcode='42501'; end if;

  if nullif(trim(zone_name),'') is null or active is null then raise exception 'zone fields required'; end if;

  perform commerce_private.c3_fee(base_fee,uplift_fee,1);

  if target_zone is null then

    insert into public.delivery_zones(name,fixed_fee,additional_store_fee,is_active)

    values(trim(zone_name),base_fee,uplift_fee,active) returning id into result_id;

  else

    update public.delivery_zones set name=trim(zone_name),fixed_fee=base_fee,additional_store_fee=uplift_fee,is_active=active

    where id=target_zone and pricing_version=expected_version returning id into result_id;

    if result_id is null then raise exception 'zone changed; reload before saving'; end if;

  end if;

  return result_id;

end $function$;

CREATE OR REPLACE FUNCTION public.get_c3_pricing_exceptions(page_number integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

begin

  if not public.is_admin() then raise exception 'administrator required' using errcode='42501'; end if;

  if page_number<0 or page_number>100000 or page_number is null then raise exception 'invalid page'; end if;

  return coalesce((select jsonb_agg(to_jsonb(x)) from (

    select c.customer_order_id,c.total::text as current_amount,c.updated_at,r.reference as public_reference,s.approved_total::text as approved_total,

      a.proposed_amounts->>'total' as proposed_total,

      ((a.proposed_amounts->>'total')::numeric-c.total)::text as difference,

      a.recorded_at,s.decided_at,a.proposed_amounts,a.reason

    from public.order_pricing_current c join public.order_pricing_snapshots s using(customer_order_id)

    join public.commerce_references r

      on r.kind='ORD' and r.record_id=c.customer_order_id

    join public.order_pricing_revisions a on a.customer_order_id=c.customer_order_id and a.version=c.version

    where c.review_required order by c.updated_at,c.customer_order_id limit 20 offset page_number*20

  ) x),'[]'::jsonb);

end $function$;

CREATE OR REPLACE FUNCTION public.get_c3_order_context(target_orders uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare result_value jsonb:='{}'; order_value uuid; refs jsonb; pricing jsonb; parent_row public.customer_orders%rowtype;

  may_read boolean; has_context boolean;

begin

  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;

  if target_orders is null or cardinality(target_orders)>100 then raise exception 'too many order IDs'; end if;

  foreach order_value in array target_orders loop

    select * into parent_row from public.customer_orders where id=order_value;

    if not found then continue; end if;

    may_read:=public.can_view_customer_order(order_value) or (public.is_available_driver()

      and exists(select 1 from public.delivery_tasks where customer_order_id=order_value and status='available'));

    if not may_read then continue; end if;

    select jsonb_object_agg(r.kind||':'||r.record_id::text,r.reference) into refs from public.commerce_references r
    where (r.kind='ORD' and r.record_id=order_value)
    or (r.kind='TSK' and exists(select 1 from public.delivery_tasks d where d.id=r.record_id and d.customer_order_id=order_value))
    or (r.kind='SOR' and exists(select 1 from public.store_orders s where s.id=r.record_id and s.customer_order_id=order_value
      and (public.is_admin() or parent_row.customer_id=auth.uid() or public.is_store_owner(s.store_id) or exists(select 1 from public.delivery_tasks d where d.customer_order_id=order_value and d.driver_id=auth.uid()))));
    pricing:=null;

    if public.c3_pricing_readable(order_value) then

      select jsonb_build_object('original',to_jsonb(s),'current',to_jsonb(c)) into pricing

      from public.order_pricing_snapshots s join public.order_pricing_current c using(customer_order_id)

      where s.customer_order_id=order_value;

    end if;

    has_context:=refs is not null or pricing is not null;

    if has_context then result_value:=result_value||jsonb_build_object(order_value::text,jsonb_build_object('references',coalesce(refs,'{}'), 'pricing',pricing)); end if;

  end loop;

  return result_value;

end $function$;

CREATE OR REPLACE FUNCTION public.publish_store_branding(asset_id uuid, expected_current uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.store_branding_assets; c uuid; o storage.objects;
begin
 select * into a from public.store_branding_assets where id=asset_id;
 if not found or not public.branding_owner(a.store_id) then raise exception 'not authorized' using errcode='42501'; end if;
 perform 1 from public.stores where id=a.store_id for update;
 if not public.branding_owner(a.store_id) then raise exception 'not authorized' using errcode='42501'; end if;
 select * into a from public.store_branding_assets where id=asset_id for update;
 if not public.store_accepts_new_orders(a.store_id) then raise exception 'store not eligible' using errcode='42501'; end if;
 if a.is_current then
  if not public.branding_object_unchanged(asset_id) then raise exception 'storage object changed'; end if;
  return to_jsonb(a);
 end if;
 if a.state<>'registered' then raise exception 'asset retired'; end if;
 select * into o from storage.objects where bucket_id=case a.kind when 'logo' then 'store-logos' else 'store-videos' end and name=a.storage_path for share;
 if not found then raise exception 'upload not confirmed'; end if;
 -- Storage metadata is its recorded byte count/declared MIME, NOT codec/content verification.
 if (o.metadata->>'size')::bigint is distinct from a.byte_size or o.metadata->>'mimetype' is distinct from a.mime_type then raise exception 'uploaded metadata mismatch'; end if;
 select id into c from public.store_branding_assets where store_id=a.store_id and kind=a.kind and is_current;
 if c is distinct from expected_current then raise exception 'current asset changed' using errcode='40001'; end if;
 update public.store_branding_assets set is_current=false,state='retired',retired_at=now() where id=c;
 update public.store_branding_assets set is_current=true,state='current',storage_object_id=o.id,storage_updated_at=o.updated_at where id=asset_id returning * into a;
 return to_jsonb(a);
end $function$;

CREATE OR REPLACE FUNCTION public.branding_can_read(target_store uuid, current_asset boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select public.branding_owner(target_store) or public.is_admin() or (current_asset and public.store_accepts_new_orders(target_store));
$function$;

CREATE OR REPLACE FUNCTION public.branding_asset_readable(asset_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.store_branding_assets a where a.id=asset_id and public.branding_can_read(a.store_id,a.is_current and public.branding_object_unchanged(a.id)));
$function$;

CREATE OR REPLACE FUNCTION public.branding_read_allowed(target_bucket text, object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.store_branding_assets a where a.storage_path=object_name and target_bucket=case a.kind when 'logo' then 'store-logos' else 'store-videos' end and public.branding_can_read(a.store_id,a.is_current and public.branding_object_unchanged(a.id)));
$function$;

CREATE OR REPLACE FUNCTION public.review_driver_application(target_application uuid, decision application_status, decision_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    perform money_private.account(application_row.user_id);
  end if;
end;
$function$;

create or replace function public.update_delivery_task_status(target_customer_order uuid,next_status public.delivery_task_status) returns void language plpgsql security definer set search_path='' as $$ begin raise exception 'use per-store pickup and delivery collection';end $$;
revoke all on all functions in schema money_private,commerce_private from public,anon,authenticated;
revoke all on function public.read_money(text,integer,uuid) from public,anon;
grant execute on function public.read_money(text,integer,uuid) to authenticated;
revoke all on function public.read_money_invoice(uuid) from public,anon;
grant execute on function public.read_money_invoice(uuid) to authenticated;
revoke all on function public.recover_money_action(uuid) from public,anon;
grant execute on function public.recover_money_action(uuid) to authenticated;
revoke all on function public.money_people() from public,anon;
grant execute on function public.money_people() to authenticated;
revoke all on function public.branding_can_read(target_store uuid, current_asset boolean) from public,anon;
grant execute on function public.branding_can_read(target_store uuid, current_asset boolean) to authenticated;
revoke all on function public.create_c3_order_from_cart(input_recipient_name text, input_contact_phone text, input_delivery_address text, input_delivery_zone uuid, input_customer_note text, request_key_value uuid, expected_total numeric, expected_user uuid, expected_cart_signature text) from public,anon;
grant execute on function public.create_c3_order_from_cart(input_recipient_name text, input_contact_phone text, input_delivery_address text, input_delivery_zone uuid, input_customer_note text, request_key_value uuid, expected_total numeric, expected_user uuid, expected_cart_signature text) to authenticated;
revoke all on function public.branding_asset_readable(asset_id uuid) from public,anon;
grant execute on function public.branding_asset_readable(asset_id uuid) to authenticated;
revoke all on function public.create_order_from_cart(input_recipient_name text, input_contact_phone text, input_delivery_address text, input_delivery_zone uuid, input_customer_note text) from public,anon;
revoke all on function public.recover_delivery_collection(attempt_key uuid, expected_user uuid) from public,anon;
grant execute on function public.recover_delivery_collection(attempt_key uuid, expected_user uuid) to authenticated;
revoke all on function public.make_order_delivery_available() from public,anon;
revoke all on function public.get_c4_pickup_context(target_tasks uuid[], expected_user uuid) from public,anon;
grant execute on function public.get_c4_pickup_context(target_tasks uuid[], expected_user uuid) to authenticated;
revoke all on function public.cancel_customer_order(target_customer_order uuid) from public,anon;
grant execute on function public.cancel_customer_order(target_customer_order uuid) to authenticated;
revoke all on function public.store_accepts_new_orders(target_store uuid) from public,anon;
grant execute on function public.store_accepts_new_orders(target_store uuid) to authenticated;
revoke all on function public.get_c3_pricing_exceptions(page_number integer) from public,anon;
grant execute on function public.get_c3_pricing_exceptions(page_number integer) to authenticated;
revoke all on function public.publish_store_branding(asset_id uuid, expected_current uuid) from public,anon;
grant execute on function public.publish_store_branding(asset_id uuid, expected_current uuid) to authenticated;
revoke all on function public.complete_delivery_and_collect_cash(target_task uuid, expected_user uuid, attempt_key uuid, expected_pricing_version bigint) from public,anon;
grant execute on function public.complete_delivery_and_collect_cash(target_task uuid, expected_user uuid, attempt_key uuid, expected_pricing_version bigint) to authenticated;
revoke all on function public.update_delivery_task_status(target_customer_order uuid, next_status delivery_task_status) from public,anon;
grant execute on function public.update_delivery_task_status(target_customer_order uuid, next_status delivery_task_status) to authenticated;
revoke all on function public.accept_delivery_task(target_customer_order uuid) from public,anon;
grant execute on function public.accept_delivery_task(target_customer_order uuid) to authenticated;
revoke all on function public.review_merchant_application(target_application uuid, decision application_status, decision_note text) from public,anon;
grant execute on function public.review_merchant_application(target_application uuid, decision application_status, decision_note text) to authenticated;
revoke all on function public.quote_c3_cart(target_zone uuid, expected_user uuid) from public,anon;
grant execute on function public.quote_c3_cart(target_zone uuid, expected_user uuid) to authenticated;
revoke all on function public.branding_read_allowed(target_bucket text, object_name text) from public,anon;
grant execute on function public.branding_read_allowed(target_bucket text, object_name text) to authenticated;
revoke all on function public.save_c3_delivery_zone(target_zone uuid, zone_name text, base_fee numeric, uplift_fee numeric, active boolean, expected_version bigint) from public,anon;
grant execute on function public.save_c3_delivery_zone(target_zone uuid, zone_name text, base_fee numeric, uplift_fee numeric, active boolean, expected_version bigint) to authenticated;
revoke all on function public.confirm_c4_store_pickup(target_task uuid, target_store_order uuid, expected_user uuid) from public,anon;
grant execute on function public.confirm_c4_store_pickup(target_task uuid, target_store_order uuid, expected_user uuid) to authenticated;
revoke all on function public.update_store_order_status(target_store_order uuid, next_status store_order_status, reason text) from public,anon;
grant execute on function public.update_store_order_status(target_store_order uuid, next_status store_order_status, reason text) to authenticated;
revoke all on function public.review_driver_application(target_application uuid, decision application_status, decision_note text) from public,anon;
grant execute on function public.review_driver_application(target_application uuid, decision application_status, decision_note text) to authenticated;
revoke all on function public.get_c3_order_context(target_orders uuid[]) from public,anon;
grant execute on function public.get_c3_order_context(target_orders uuid[]) to authenticated;
-- New snapshot/revision triggers are private and immutable to application clients.
revoke all on public.money_invoices,public.money_accounts,public.money_dues,public.money_allocations,public.money_attempts,public.money_delivery_attempts,public.money_salary_periods,public.money_driver_policies,public.commerce_references,public.merchant_terms from anon;
-- Verify cutover did not remove the operational tables through an unexpected dependency.
do $$ begin
 if to_regclass('public.customer_orders') is null or to_regclass('public.products') is null or to_regclass('public.stores') is null then raise exception 'cutover removed an operational table';end if;
end $$;
create or replace function public.record_money_action(attempt_key uuid,action_input jsonb,expected_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;old public.money_attempts%rowtype;begin
 if expected_user is distinct from auth.uid() or not public.is_admin() or attempt_key is null then raise exception 'administrator required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(725601);
 select * into old from public.money_attempts where actor=auth.uid() and key=attempt_key;
 if found then if old.input is distinct from action_input then raise exception 'attempt input mismatch';end if;return old.result;end if;
 begin r:=money_private.record_action(attempt_key,action_input);
 exception when raise_exception or integrity_constraint_violation or data_exception then
 r:=jsonb_build_object('state','rejected','message',sqlerrm);
 insert into public.money_attempts(actor,key,input,result) values(auth.uid(),attempt_key,action_input,r);
 end;
 return r;
end $$;
revoke all on function public.record_money_action(uuid,jsonb,uuid) from public,anon;
grant execute on function public.record_money_action(uuid,jsonb,uuid) to authenticated;
create function public.find_order_invoice(target_order uuid) returns uuid language sql stable security definer set search_path='' as $$
 select id from public.money_invoices where kind='INV' and customer_order_id=target_order and (owner_id=auth.uid() or public.is_admin())
$$;
revoke all on function public.find_order_invoice(uuid) from public,anon;
grant execute on function public.find_order_invoice(uuid) to authenticated;
revoke all on all functions in schema money_private,commerce_private from public,anon,authenticated;
-- Searchable references for other user-followed operational entities.
create function commerce_private.assign_entity_reference() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' then new.public_reference:=money_private.reference(tg_argv[0]);
 elsif new.public_reference is distinct from old.public_reference then raise exception 'reference is immutable';end if;return new;
end $$;
do $$ declare r record;begin
 for r in select * from (values('merchants','MER'),('stores','STR'),('products','PRD'),('store_offers','OFR')) as t(table_name,kind) loop
 execute format('alter table public.%I add column public_reference text unique',r.table_name);
 execute format('update public.%I set public_reference=money_private.reference(%L)',r.table_name,r.kind);
 execute format('alter table public.%I alter column public_reference set not null',r.table_name);
 execute format('create trigger entity_reference before insert or update on public.%I for each row execute function commerce_private.assign_entity_reference(%L)',r.table_name,r.kind);
 end loop;
end $$;
-- Historical technical audit entries for removed money are experimental data too.
delete from public.audit_logs where table_name in('public.wallets','public.wallet_transactions','public.merchant_subscriptions');
delete from public.notifications where type='order';
revoke all on all functions in schema money_private,commerce_private from public,anon,authenticated;
-- Unused trigger functions and entry points belonging solely to removed money.
drop function if exists public.reject_invoice_payment_allocation_mutation();
drop function if exists public.reject_subscription_invoice_delete();
drop function if exists public.reject_subscription_payment_mutation();
drop function if exists public.reject_merchant_ledger_mutation();
drop function if exists public.reject_subscription_invoice_identity_mutation();
drop function if exists public.snapshot_plan_change_commission_rate();
drop function if exists public.assign_application_plan(uuid,uuid);
drop type if exists public.wallet_direction;
drop type if exists public.wallet_transaction_type;
alter table public.money_invoices add constraint finite_invoice_amount check(amount::text not in ('NaN','Infinity','-Infinity'));
alter table public.money_dues add constraint finite_due_amount check(amount::text not in ('NaN','Infinity','-Infinity'));
alter table public.money_allocations add constraint finite_allocation_amount check(amount::text not in ('NaN','Infinity','-Infinity'));
alter table public.money_driver_policies add constraint finite_policy_value check(value::text not in ('NaN','Infinity','-Infinity'));
-- Refuse to leave hidden old renewal jobs pointing at deleted writers.
do $$ declare r record;begin
 if to_regclass('cron.job') is not null then
 for r in execute $q$select jobid from cron.job where command like '%finance_private.%' or command like '%process_due_merchant_subscription_renewals%'$q$ loop
 execute format('select cron.unschedule(%s)',r.jobid);
 end loop;
 end if;
end $$;
-- Supabase installations may grant table privileges through DEFAULT PRIVILEGES.
revoke all on public.money_accounts,public.money_invoices,public.money_dues,public.money_allocations,public.money_driver_policies,public.money_salary_periods,public.money_attempts,public.money_delivery_attempts,public.merchant_terms,public.commerce_references,public.delivery_store_pickups from anon,authenticated;
grant select on public.money_accounts,public.money_invoices,public.money_dues,public.money_allocations,public.money_driver_policies,public.merchant_terms,public.delivery_store_pickups to authenticated;
create function public.find_order_reference(reference_value text) returns uuid language plpgsql stable security definer set search_path='' as $$
declare r public.commerce_references%rowtype;v text:=upper(translate(trim(reference_value),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'));begin
 if not public.is_admin() then raise exception 'administrator required' using errcode='42501';end if;
 select * into r from public.commerce_references where reference=v or (kind='ORD' and v ~ '^[0-9]+$' and ltrim(split_part(reference,'-',2),'0')=ltrim(v,'0'));
 if r.kind='ORD' then return r.record_id;
 elsif r.kind='SOR' then return(select customer_order_id from public.store_orders where id=r.record_id);
 elsif r.kind='TSK' then return(select customer_order_id from public.delivery_tasks where id=r.record_id);end if;return null;
end $$;
revoke all on function public.find_order_reference(text) from public,anon;
grant execute on function public.find_order_reference(text) to authenticated;
create trigger subscription_plans_validate_active_configuration before insert or update on public.subscription_plans
for each row execute function public.validate_active_subscription_plan();
notify pgrst,'reload schema';
drop function public.update_delivery_task_status(uuid,public.delivery_task_status);
commit;







