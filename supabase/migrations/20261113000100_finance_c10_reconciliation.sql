-- LOCAL / UNAPPLIED. READ-ONLY reconciliation, no financial writer, no activation/backfill.
begin;
do $$ begin
 if to_regclass('public.treasury_finance_postings') is null or to_regprocedure('finance_private.c9_request_state(uuid)') is null then raise exception 'C10 requires the COMPLETE C2-C9 chain';end if;
end $$;
create table finance_private.c10_permissions(user_id uuid primary key references public.profiles(id),may_reconcile boolean not null default false);
revoke all on finance_private.c10_permissions from public,anon,authenticated,service_role;
-- Signed debit-minus-credit expectations from operational documents. NEVER writes a balance.
create view finance_private.c10_expected_lines with(security_barrier=true) as
 select 'driver_cash'::text definition_code,r.driver_id owner_user_id,null::uuid merchant_id,r.amount delta from public.delivery_collection_results r where r.kind='cash_delivery'
 union all select 'customer_advance',o.customer_id,null,0::numeric from public.delivery_collection_results r join public.customer_orders o on o.id=r.customer_order_id
 union all select 'merchant_sales_payable',null,x.merchant_id,-x.net from public.merchant_delivery_positions x
 union all select 'commission_revenue',null,null,-x.commission from public.merchant_delivery_positions x
 union all select 'delivery_revenue',null,null,-p.delivery_fee from public.delivery_collection_results r join public.order_pricing_current p on p.customer_order_id=r.customer_order_id
 union all select 'driver_earnings_expense',null,null,e.amount from public.driver_wage_entitlements e
 union all select 'driver_earnings_payable',e.driver_id,null,-e.amount from public.driver_wage_entitlements e
 union all select 'driver_cash',h.driver_id,null,-h.counted_amount from public.driver_cash_handover_attempts h where h.outcome='confirmed'
 union all select 'treasury_cash',null,null,h.counted_amount from public.driver_cash_handover_attempts h where h.outcome='confirmed'
 union all select 'driver_earnings_payable',p.driver_id,null,p.amount from public.driver_wage_payments p
 union all select 'treasury_cash',null,null,-p.amount from public.driver_wage_payments p
 union all select 'merchant_sales_payable',null,p.merchant_id,p.amount from public.c7_merchant_settlement_payments p
 union all select 'treasury_cash',null,null,-p.amount from public.c7_merchant_settlement_payments p
 union all select 'subscription_receivable',null,i.merchant_id,i.amount from public.subscription_billing_documents i where not finance_private.subscription_invoice_voided(i.id)
 union all select 'subscription_revenue',null,null,-i.amount from public.subscription_billing_documents i where not finance_private.subscription_invoice_voided(i.id)
 union all select 'subscription_receivable',null,r.merchant_id,-r.amount from public.subscription_cash_receipts r
 union all select 'treasury_cash',null,null,r.amount from public.subscription_cash_receipts r
 union all select 'treasury_cash',null,null,p.cash_delta from public.treasury_finance_postings p
 union all select case when p.kind='expense' then 'office_operating_expense' when p.kind='opening' then 'opening_balance_equity'
  when p.cash_delta<0 then 'treasury_cash_shortage_expense' else 'treasury_cash_overage_income' end,null,null,-p.cash_delta from public.treasury_finance_postings p;
create view finance_private.c10_account_comparison with(security_barrier=true) as
 with expected as(select definition_code,owner_user_id,merchant_id,sum(delta) amount from finance_private.c10_expected_lines group by definition_code,owner_user_id,merchant_id),
 actual as(select a.id account_id,a.definition_code,a.owner_user_id,a.merchant_id,sum(case l.side when 'debit' then l.amount else -l.amount end) amount
  from public.financial_accounts a join public.journal_lines l on l.account_id=a.id join public.journal_entries j on j.id=l.journal_entry_id and j.status='posted'
  join public.financial_events e on e.id=j.event_id join public.financial_operations o on o.id=e.operation_id and o.state='completed'
  where a.definition_code not in ('authorized_suspense_asset','authorized_suspense_liability') group by a.id,a.definition_code,a.owner_user_id,a.merchant_id)
 select coalesce(a.definition_code,x.definition_code) definition_code,coalesce(a.owner_user_id,x.owner_user_id) owner_user_id,coalesce(a.merchant_id,x.merchant_id) merchant_id,
 a.account_id,coalesce(x.amount,0) expected,coalesce(a.amount,0) actual from expected x full join actual a on a.definition_code=x.definition_code
 and a.owner_user_id is not distinct from x.owner_user_id and a.merchant_id is not distinct from x.merchant_id;

create view finance_private.c10_required_references with(security_barrier=true) as
 select 'ORD'::text kind,p.customer_order_id document_id from public.order_pricing_snapshots p
 union all select 'SUB',s.id from public.store_orders s join public.order_pricing_snapshots p on p.customer_order_id=s.customer_order_id
 union all select 'DLV',t.id from public.delivery_tasks t join public.order_pricing_snapshots p on p.customer_order_id=t.customer_order_id
 union all select 'RCT',h.id from public.driver_cash_handover_attempts h where h.outcome='confirmed'
 union all select 'PAY',p.id from public.driver_wage_payments p
 union all select 'SET',s.id from public.merchant_settlement_documents s
 union all select 'PAY',p.id from public.c7_merchant_settlement_payments p
 union all select 'SIN',i.id from public.subscription_billing_documents i
 union all select 'RCT',r.id from public.subscription_cash_receipts r
 union all select case when p.kind='expense' then 'PAY' else 'ADJ' end,p.id from public.treasury_finance_postings p
 union all select 'TXN',j.id from public.journal_entries j where j.status='posted';

create view finance_private.c10_reconciliation_issues with(security_barrier=true) as
 select 'ledger'::text scope,'account_mismatch'::text code,'error'::text severity,coalesce(owner_user_id,merchant_id,account_id) entity_id,
 expected,actual,jsonb_build_object('account',definition_code,'owner_user_id',owner_user_id,'merchant_id',merchant_id) details
 from finance_private.c10_account_comparison where expected<>actual
 union all select 'ledger','journal_invalid','error',j.id,0,coalesce(sum(case l.side when 'debit' then l.amount else -l.amount end),0),jsonb_build_object('line_count',count(l.id))
 from public.journal_entries j left join public.journal_lines l on l.journal_entry_id=j.id where j.status='posted' group by j.id
 having count(l.id)<2 or sum(case l.side when 'debit' then l.amount else -l.amount end)<>0 or bool_or(l.amount<=0 or l.amount<>round(l.amount,2))
 union all select 'ledger','event_not_posted','error',e.id,null,null,jsonb_build_object('operation_id',e.operation_id)
 from public.financial_events e join public.financial_operations o on o.id=e.operation_id
 where o.state<>'completed' or not exists(select 1 from public.journal_entries j where j.event_id=e.id and j.status='posted')
 union all select 'ledger','pending_operation','warning',o.id,null,null,jsonb_build_object('operation_type',o.operation_type) from public.financial_operations o where o.state='pending'
 union all select 'references','missing_reference','error',r.document_id,null,null,jsonb_build_object('kind',r.kind) from finance_private.c10_required_references r
 where not exists(select 1 from public.financial_document_references f where f.kind=r.kind and f.document_id=r.document_id)
 union all select 'references','journal_reference_mismatch','error',j.id,null,null,'{}'::jsonb from public.journal_entries j join public.financial_document_references f on f.id=j.reference_id where f.kind<>'TXN' or f.document_id<>j.id
 union all select 'references','lifecycle_parent_mismatch','error',e.id,null,null,'{}'::jsonb from public.order_lifecycle_events e
 where e.store_order_id is not null and not exists(select 1 from public.store_orders s where s.id=e.store_order_id and s.customer_order_id=e.customer_order_id)
 or e.delivery_task_id is not null and not exists(select 1 from public.delivery_tasks d where d.id=e.delivery_task_id and d.customer_order_id=e.customer_order_id)
 union all select 'references','pickup_reference_mismatch','error',p.store_order_id,null,null,'{}'::jsonb from public.delivery_store_pickups p join public.delivery_pickup_workflows w on w.task_id=p.task_id
 join public.financial_document_references o on o.id=p.ord_reference_id join public.financial_document_references s on s.id=p.sub_reference_id join public.financial_document_references d on d.id=p.dlv_reference_id
 where o.kind<>'ORD' or o.document_id<>w.customer_order_id or s.kind<>'SUB' or s.document_id<>p.store_order_id or d.kind<>'DLV' or d.document_id<>p.task_id
 union all select 'orders','collection_context_mismatch','error',r.task_id,r.amount,p.total,jsonb_build_object('order_id',r.customer_order_id)
 from public.delivery_collection_results r join public.delivery_tasks d on d.id=r.task_id left join public.order_pricing_current p on p.customer_order_id=r.customer_order_id
 where not finance_private.c4_is_order(r.customer_order_id) or d.status<>'delivered' or r.driver_id is distinct from d.driver_id or p.customer_order_id is null or p.review_required or p.version<>r.pricing_version or p.total<>r.amount
 union all select 'orders','premature_delivery_task','error',d.id,null,null,jsonb_build_object('status',d.status)
 from public.delivery_tasks d where finance_private.c4_is_order(d.customer_order_id) and d.status in ('available','accepted') and exists(select 1 from public.store_orders s where s.customer_order_id=d.customer_order_id and s.status not in ('rejected','cancelled','ready_for_pickup','handed_to_driver'))
 union all select 'orders','delivery_before_pickups','error',d.id,null,null,'{}'::jsonb from public.delivery_tasks d where finance_private.c4_is_order(d.customer_order_id) and d.status in ('picked_up','delivered')
 and exists(select 1 from public.store_orders s where s.customer_order_id=d.customer_order_id and s.status not in ('rejected','cancelled') and not exists(select 1 from public.delivery_store_pickups p where p.task_id=d.id and p.store_order_id=s.id and p.driver_id=d.driver_id))
 union all select 'orders','task_without_active_stores','error',d.id,null,null,'{}'::jsonb from public.delivery_tasks d where finance_private.c4_is_order(d.customer_order_id) and d.status<>'cancelled' and not exists(select 1 from public.store_orders s where s.customer_order_id=d.customer_order_id and s.status not in ('rejected','cancelled'))
 union all select 'orders','task_progressed_during_review','error',d.id,null,null,'{}'::jsonb from public.delivery_tasks d join public.order_pricing_current p on p.customer_order_id=d.customer_order_id where p.review_required and d.status in ('accepted','picked_up','delivered')
 union all select 'orders','zero_delivery_has_cash','error',r.task_id,0,r.amount,'{}'::jsonb from public.delivery_collection_results r where r.kind='zero_cash_delivery'
 and (r.amount<>0 or r.cash_event_id is not null or r.delivery_event_id is not null or exists(select 1 from public.financial_events e where e.operation_id=r.operation_id))
 union all select 'orders','legacy_double_writer','error',r.customer_order_id,null,null,'{}'::jsonb from public.delivery_collection_results r
 where exists(select 1 from public.customer_order_cash_obligations o where o.customer_order_id=r.customer_order_id)
 or exists(select 1 from public.driver_delivery_fee_entitlements e where e.customer_order_id=r.customer_order_id)
 or exists(select 1 from public.merchant_order_entitlements e join public.store_orders s on s.id=e.store_order_id where s.customer_order_id=r.customer_order_id)
 or exists(select 1 from public.store_order_commissions c join public.store_orders s on s.id=c.store_order_id where s.customer_order_id=r.customer_order_id and c.status='due')
 union all select 'wages','wage_snapshot_not_enrolled','warning',r.task_id,null,null,'{}'::jsonb from public.delivery_collection_results r where not exists(select 1 from public.delivery_wage_snapshots s where s.task_id=r.task_id)
 union all select 'wages','wage_accrual_missing','error',s.task_id,null,null,'{}'::jsonb from public.delivery_wage_snapshots s join public.delivery_collection_results r on r.task_id=s.task_id where not exists(select 1 from public.driver_wage_entitlements e where e.task_id=s.task_id)
 union all select 'wages','wage_snapshot_mismatch','error',e.task_id,round(e.fee_amount*s.percentage/100,2),e.amount,'{}'::jsonb from public.driver_wage_entitlements e join public.delivery_wage_snapshots s on s.task_id=e.task_id join public.delivery_collection_results r on r.task_id=e.task_id
 where e.amount<>round(e.fee_amount*s.percentage/100,2) or e.driver_id<>r.driver_id or e.pricing_version<>r.pricing_version
 union all select 'wages','wage_paid_before_custody','error',i.task_id,0,finance_private.c6_cash_remaining(i.task_id),'{}'::jsonb from public.driver_wage_payment_items i where finance_private.c6_cash_remaining(i.task_id)<>0
 union all select 'custody','receipt_allocation_mismatch','error',h.id,h.counted_amount,coalesce(sum(a.amount),0),'{}'::jsonb from public.driver_cash_handover_attempts h left join public.driver_cash_receipt_allocations a on a.receipt_id=h.id where h.outcome='confirmed' group by h.id having h.counted_amount<>coalesce(sum(a.amount),0)
 union all select 'custody','task_overallocated','error',r.task_id,r.amount,sum(a.amount),'{}'::jsonb from public.delivery_collection_results r join public.driver_cash_receipt_allocations a on a.task_id=r.task_id group by r.task_id having sum(a.amount)>r.amount
 union all select 'merchants','delivered_sub_missing','error',s.id,null,null,'{}'::jsonb from public.store_orders s join public.delivery_collection_results r on r.customer_order_id=s.customer_order_id where s.status='delivered' and not exists(select 1 from public.merchant_delivery_positions x where x.store_order_id=s.id)
 union all select 'merchants','commission_snapshot_mismatch','error',x.store_order_id,t.items_subtotal,x.gross,'{}'::jsonb from public.merchant_delivery_positions x join public.store_orders s on s.id=x.store_order_id left join public.store_order_totals t on t.store_order_id=s.id left join public.store_order_commissions c on c.store_order_id=s.id
 where s.status<>'delivered' or t.store_order_id is null or c.id is null or x.gross<>t.items_subtotal or x.commission<>c.commission_amount or x.commission_rate<>c.commission_rate or x.net<>x.gross-x.commission or x.commission<>round(x.gross*x.commission_rate/100,2)
 union all select 'subscriptions','receipt_period_mismatch','error',r.id,r.amount,p.price_snapshot,'{}'::jsonb from public.subscription_cash_receipts r left join public.merchant_subscriptions p on p.id=r.period_id
 join public.subscription_billing_documents i on i.id=r.invoice_id join public.subscription_plan_versions v on v.id=i.plan_version_id left join public.merchant_subscriptions anchor on anchor.id=i.anchor_period_id
 where p.id is null or p.merchant_id<>r.merchant_id or p.price_snapshot<>r.amount or i.amount<>r.amount or p.plan_id<>v.plan_id or p.commission_rate_snapshot<>v.commission_rate
 or p.starts_at<>finance_private.subscription_activation_start(anchor.expires_at,r.received_at) or p.expires_at<>((p.starts_at at time zone 'UTC')+make_interval(months=>v.months)) at time zone 'UTC' or finance_private.subscription_invoice_voided(r.invoice_id)
 union all select 'treasury','posting_stage_mismatch','error',p.id,null,null,'{}'::jsonb from public.treasury_finance_postings p where finance_private.c9_request_state(p.request_id)<>'posted'
 union all select 'treasury','stale_pending_correction','warning',q.id,null,null,'{}'::jsonb from public.treasury_finance_requests q where q.kind='adjustment' and finance_private.c9_request_state(q.id)='requested'
 and q.cut->>'fingerprint' is distinct from finance_private.c9_cash_cut()->>'fingerprint';

revoke all on finance_private.c10_expected_lines,finance_private.c10_account_comparison,finance_private.c10_required_references,finance_private.c10_reconciliation_issues from public,anon,authenticated,service_role;
create function public.read_financial_reconciliation(expected_user uuid,page_number integer default 0,scope_value text default 'all') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows_value jsonb;summary_value jsonb;
begin
 if expected_user is null or expected_user is distinct from auth.uid() or not coalesce(public.is_admin(),false) or not exists(select 1 from finance_private.c10_permissions where user_id=auth.uid() and may_reconcile) then raise exception 'independent reconciliation permission required' using errcode='42501';end if;
 if page_number is null or page_number<0 or page_number>100000 or scope_value is null or scope_value not in ('all','ledger','orders','references','wages','custody','merchants','subscriptions','treasury') then raise exception 'invalid reconciliation page/scope';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.scope,x.code,x.entity_id nulls first,x.details::text),'[]') into rows_value from (
  select scope,code,severity,entity_id,expected::text,actual::text,details from finance_private.c10_reconciliation_issues where scope_value='all' or scope=scope_value order by scope,code,entity_id nulls first,details::text limit 21 offset page_number*20
 ) x;
 select jsonb_build_object('errors',count(*) filter(where severity='error'),'warnings',count(*) filter(where severity='warning')) into summary_value from finance_private.c10_reconciliation_issues;
 return jsonb_build_object('rows',case when jsonb_array_length(rows_value)>20 then rows_value-20 else rows_value end,'has_more',jsonb_array_length(rows_value)>20,'summary',summary_value,'scope',scope_value,
 'snapshot',pg_current_snapshot()::text,'at',statement_timestamp(),'read_only',true);
end $$;
revoke all on function public.read_financial_reconciliation(uuid,integer,text) from public,anon,service_role;
grant execute on function public.read_financial_reconciliation(uuid,integer,text) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;
commit;
