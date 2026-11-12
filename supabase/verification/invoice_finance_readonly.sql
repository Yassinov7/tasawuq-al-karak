-- Owner-run, read-only, no personal values. Apply the cutover first.
begin transaction read only;
select public.get_signup_capabilities() as onboarding_expected_3;
select to_regnamespace('finance_private') is null as old_private_schema_removed;
select to_regclass('public.wallets') is null as old_wallets_removed,
 to_regclass('public.financial_events') is null as old_events_removed,
 to_regclass('public.journal_entries') is null as old_journal_removed,
 to_regclass('public.subscription_invoices') is null as old_subscription_invoices_removed;
select kind,count(*) from public.money_invoices group by kind order by kind;
select count(*) as excess_allocations_expected_0 from public.money_dues d
where (select coalesce(sum(a.amount),0) from public.money_allocations a join public.money_invoices s on s.id=a.settlement_id
 where a.due_id=d.id and s.voided_by is null and s.status='confirmed')>d.amount;
select coalesce(sum(case cash_direction when 'in' then amount else -amount end),0) as actual_treasury_cash
from public.money_invoices where kind='SET' and status='confirmed' and voided_by is null;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in('money_accounts','money_invoices','money_dues','money_allocations','money_attempts','money_delivery_attempts','money_salary_periods','money_driver_policies','merchant_terms');
select has_table_privilege('authenticated','public.money_invoices','INSERT') as invoice_insert_expected_false,
 has_table_privilege('authenticated','public.money_invoices','UPDATE') as invoice_update_expected_false,
 has_table_privilege('authenticated','public.money_allocations','INSERT') as allocation_insert_expected_false;
select p.proname as dangling_old_writer_expected_no_rows from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in('public','money_private','commerce_private') and p.prokind='f' and p.prosrc like '%finance_private.%';
commit;
