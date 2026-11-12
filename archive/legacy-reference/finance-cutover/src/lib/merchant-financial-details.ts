import { supabase } from '@/lib/supabase';
import { requireSyp } from '@/lib/money';
import { allFinancialRows, centsAmount, financialPeriod, moneyCents, validFinancialId } from '@/lib/financial-input';
import { loadMerchantFinancialAccount, type MerchantFinancialData, type MerchantFinancialFilter, type MerchantFinancialSection } from '@/lib/merchant-financial-account';
import type { Tables } from '@/types/database';
export type FinancialView = MerchantFinancialSection | 'invoice' | 'payment' | 'ledger' | 'entry';
export type FinancialViewFilter = MerchantFinancialFilter & { search?: string; effect?: string; source?: string };
export type FinancialIdentity = { merchantId: string; storeId: string | null; localTimeScope?: string };
export type SaleItem = Pick<Tables<'store_order_items'>, 'id' | 'product_title_snapshot' | 'selling_unit_snapshot' | 'quantity' | 'unit_price_snapshot' | 'line_total' | 'currency' | 'offer_snapshot'>;
export type FinancialViewData = MerchantFinancialData & { orderItems?: SaleItem[] };
const empty = (): MerchantFinancialData => ({ summary: [], obligations: [], subscription: null, record: null, rows: [], count: 0, payments: [], payments_count: 0 });
const unavailable = () => new Error('السجل غير موجود أو غير متاح لحسابك.');
const escape = (value: string) => value.trim().replace(/[\\%_]/g, '\\$&');
export async function financialIdentity(ownerId: string, signal?: AbortSignal): Promise<FinancialIdentity> {
  let q = supabase.from('merchants').select('id').eq('owner_user_id', ownerId);
  if (signal) q = q.abortSignal(signal);
  const merchant = await q.maybeSingle(); if (merchant.error || !merchant.data) throw unavailable();
  let s = supabase.from('stores').select('id').eq('merchant_id', merchant.data.id); if (signal) s = s.abortSignal(signal);
  const store = await s.maybeSingle(); if (store.error) throw unavailable();
  return { merchantId: merchant.data.id, storeId: store.data?.id ?? null, localTimeScope: JSON.stringify([Intl.DateTimeFormat().resolvedOptions().timeZone,new Date().getTimezoneOffset()]) };
}
async function invoiceAllocations(invoiceIds: string[], signal?: AbortSignal) {
  return allFinancialRows(after => {
    let q = supabase.from('invoice_payment_allocations').select('id,invoice_id,payment_id,amount,created_at').in('invoice_id', invoiceIds).order('id').limit(200);
    if (after) q = q.gt('id', after); if (signal) q = q.abortSignal(signal); return q;
  }, signal);
}
async function paymentAllocations(paymentIds: string[], signal?: AbortSignal) {
  return allFinancialRows(after => {
    let q = supabase.from('invoice_payment_allocations').select('id,invoice_id,payment_id,amount,created_at').in('payment_id', paymentIds).order('id').limit(200);
    if (after) q = q.gt('id', after); if (signal) q = q.abortSignal(signal); return q;
  }, signal);
}
function allocatedMap(rows: { invoice_id: string; payment_id: string; amount: number }[], by: 'invoice_id' | 'payment_id') {
  const result = new Map<string, bigint>(); for (const row of rows) result.set(row[by], (result.get(row[by]) ?? 0n) + moneyCents(row.amount)); return result;
}
/** Fill a logical 20-row page even if REST caps each individual response lower. No financial sum is derived from this window. */
async function windowRows<T extends { id: string }>(page: number, read: (offset: number, end: number) => PromiseLike<{ data: T[] | null; count: number | null; error: { message: string } | null }>) {
  const rows: T[] = []; let count: number | null = null;
  while (rows.length < 20) {
    const result = await read(page * 20 + rows.length, page * 20 + 19); if (result.error || result.count === null) throw new Error('تعذر تحميل القائمة كاملة.');
    count = result.count; const part = result.data ?? []; if (!part.length) break;
    if (part.some(row => rows.some(existing => existing.id === row.id))) throw new Error('تغير ترتيب القائمة؛ أعد التحديث.');
    rows.push(...part); if (page * 20 + rows.length >= count) break;
  }
  return { rows, count: count ?? 0 };
}
async function invoices(merchantId: string, filter: FinancialViewFilter, signal?: AbortSignal): Promise<MerchantFinancialData> {
  const period = financialPeriod(filter.from, filter.to), page = filter.page ?? 0;
  const result = await windowRows(page, (offset, end) => {
    let q = supabase.from('subscription_invoices').select('id,invoice_number,subscription_id,currency,total_amount,due_at,status,kind,created_at', { count: 'exact' }).eq('merchant_id', merchantId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, end);
    if (period.from) q = q.gte('created_at', period.from); if (period.until) q = q.lt('created_at', period.until);
    if (filter.status) q = q.eq('status', filter.status); if (filter.search?.trim()) q = q.ilike('invoice_number', `%${escape(filter.search)}%`); if (signal) q = q.abortSignal(signal); return q;
  });
  const allocations = result.rows.length ? await invoiceAllocations(result.rows.map(row => row.id), signal) : [], totals = allocatedMap(allocations, 'invoice_id');
  return { ...empty(), count: result.count, rows: result.rows.map(row => {
    requireSyp(row.currency); const paid = totals.get(row.id) ?? 0n, total = moneyCents(row.total_amount);
    if (paid > total) throw new Error('تعذر التحقق من تخصيصات الفاتورة.');
    return { ...row, occurred_at: row.created_at, paid_amount: centsAmount(paid), remaining_amount: row.status === 'void' ? 0 : centsAmount(total - paid) };
  }) };
}
async function payments(merchantId: string, filter: FinancialViewFilter, signal?: AbortSignal): Promise<MerchantFinancialData> {
  const period = financialPeriod(filter.from, filter.to);
  const result = await windowRows(filter.page ?? 0, (offset, end) => {
    let q = supabase.from('subscription_payments').select('id,currency,amount,method,external_reference,received_at', { count: 'exact' }).eq('merchant_id', merchantId).order('received_at', { ascending: false }).order('id', { ascending: false }).range(offset, end);
    if (period.from) q = q.gte('received_at', period.from); if (period.until) q = q.lt('received_at', period.until);
    if (filter.search?.trim()) q = q.ilike('external_reference', `%${escape(filter.search)}%`); if (filter.status) q = q.eq('method', filter.status); if (signal) q = q.abortSignal(signal); return q;
  });
  const allocations = result.rows.length ? await paymentAllocations(result.rows.map(row => row.id), signal) : [], totals = allocatedMap(allocations, 'payment_id');
  return { ...empty(), count: result.count, rows: result.rows.map(row => {
    requireSyp(row.currency); const used = totals.get(row.id) ?? 0n, total = moneyCents(row.amount); if (used > total) throw new Error('تخصيصات الدفعة غير متسقة.');
    return { ...row, occurred_at: row.received_at, allocated_amount: centsAmount(used), unallocated_amount: centsAmount(total - used) };
  }) };
}
async function invoiceDetail(merchantId: string, id: string, page: number, signal?: AbortSignal): Promise<MerchantFinancialData> {
  const result = await supabase.from('subscription_invoices').select('id,invoice_number,subscription_id,kind,currency,total_amount,due_at,status,created_at').eq('id', id).eq('merchant_id', merchantId).abortSignal(signal ?? new AbortController().signal).maybeSingle();
  if (result.error || !result.data) throw unavailable(); const invoice = result.data; requireSyp(invoice.currency);
  // No allocations or related documents are fetched until ownership of the invoice is established.
  const [allocations, subscription] = await Promise.all([invoiceAllocations([id], signal), supabase.from('merchant_subscriptions').select('plan_name_snapshot,starts_at,expires_at').eq('id', invoice.subscription_id).eq('merchant_id', merchantId).abortSignal(signal ?? new AbortController().signal).maybeSingle()]);
  if (subscription.error || !subscription.data) throw unavailable();
  const used = allocations.reduce((sum, row) => sum + moneyCents(row.amount), 0n), total = moneyCents(invoice.total_amount); if (used > total) throw new Error('تخصيصات الفاتورة غير متسقة.');
  const visible = allocations.sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(page * 20, page * 20 + 20);
  const related = visible.length ? await allFinancialRows(after => {
    let q = supabase.from('subscription_payments').select('id,external_reference,method,received_at').eq('merchant_id', merchantId).in('id', visible.map(row => row.payment_id)).order('id').limit(100);
    if (after) q = q.gt('id', after); if (signal) q = q.abortSignal(signal); return q;
  }, signal) : [];
  const lookup = new Map(related.map(row => [row.id, row]));
  return { ...empty(), record: { ...invoice, ...subscription.data, occurred_at: invoice.created_at, paid_amount: centsAmount(used), remaining_amount: invoice.status === 'void' ? 0 : centsAmount(total - used) }, count: allocations.length,
    rows: visible.map(row => { const payment = lookup.get(row.payment_id); if (!payment) throw unavailable(); return { id: row.id, payment_id: row.payment_id, currency: invoice.currency, amount: row.amount, occurred_at: row.created_at, external_reference: payment.external_reference, method: payment.method }; }) };
}
async function paymentDetail(merchantId: string, id: string, page: number, signal?: AbortSignal): Promise<MerchantFinancialData> {
  const result = await supabase.from('subscription_payments').select('id,currency,amount,method,external_reference,received_at,created_at').eq('id', id).eq('merchant_id', merchantId).abortSignal(signal ?? new AbortController().signal).maybeSingle();
  if (result.error || !result.data) throw unavailable(); const payment = result.data; requireSyp(payment.currency);
  const allocations = await paymentAllocations([id], signal), used = allocations.reduce((sum, row) => sum + moneyCents(row.amount), 0n), total = moneyCents(payment.amount); if (used > total) throw new Error('تخصيصات الدفعة غير متسقة.');
  const visible = allocations.sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(page * 20, page * 20 + 20);
  const related = visible.length ? await allFinancialRows(after => {
    let q = supabase.from('subscription_invoices').select('id,invoice_number').eq('merchant_id', merchantId).in('id', visible.map(row => row.invoice_id)).order('id').limit(100);
    if (after) q = q.gt('id', after); if (signal) q = q.abortSignal(signal); return q;
  }, signal) : [], lookup = new Map(related.map(row => [row.id, row]));
  return { ...empty(), record: { ...payment, occurred_at: payment.received_at, allocated_amount: centsAmount(used), unallocated_amount: centsAmount(total - used) }, count: allocations.length,
    rows: visible.map(row => { const invoice = lookup.get(row.invoice_id); if (!invoice) throw unavailable(); return { id: row.id, invoice_id: row.invoice_id, invoice_number: invoice.invoice_number, currency: payment.currency, amount: row.amount, occurred_at: row.created_at }; }) };
}
async function ledger(merchantId: string, filter: FinancialViewFilter, signal?: AbortSignal): Promise<MerchantFinancialData> {
  const period = financialPeriod(filter.from, filter.to);
  if (filter.search?.trim()) validFinancialId(filter.search.trim());
  const result = await windowRows(filter.page ?? 0, (offset, end) => {
    let q = supabase.from('merchant_ledger_entries').select('id,currency,effect,source_type,source_id,amount,reversal_of,created_at', { count: 'exact' }).eq('merchant_id', merchantId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, end);
    if (period.from) q = q.gte('created_at', period.from); if (period.until) q = q.lt('created_at', period.until);
    if (filter.effect) q = q.eq('effect', filter.effect); if (filter.source) q = q.eq('source_type', filter.source); if (filter.search?.trim()) q = q.eq('source_id', filter.search.trim()); if (signal) q = q.abortSignal(signal); return q;
  });
  return { ...empty(), count: result.count, rows: result.rows.map(row => { requireSyp(row.currency); return { ...row, occurred_at: row.created_at }; }) };
}
async function entry(merchantId: string, id: string, signal?: AbortSignal): Promise<MerchantFinancialData> {
  const result = await supabase.from('merchant_ledger_entries').select('id,currency,effect,source_type,source_id,amount,reversal_of,created_at').eq('id', id).eq('merchant_id', merchantId).abortSignal(signal ?? new AbortController().signal).maybeSingle();
  if (result.error || !result.data) throw unavailable(); const row = result.data; requireSyp(row.currency);
  const record: NonNullable<MerchantFinancialData['record']> = { ...row, occurred_at: row.created_at };
  if (row.source_type === 'subscription_invoice') { const own = await supabase.from('subscription_invoices').select('id').eq('id', row.source_id).eq('merchant_id', merchantId).maybeSingle(); if (own.error) throw unavailable(); if (own.data) record.invoice_id = own.data.id; }
  if (row.source_type === 'payment_allocation') {
    const allocation = await supabase.from('invoice_payment_allocations').select('invoice_id').eq('id', row.source_id).maybeSingle(); if (allocation.error) throw unavailable();
    if (allocation.data) { const own = await supabase.from('subscription_invoices').select('id').eq('id', allocation.data.invoice_id).eq('merchant_id', merchantId).maybeSingle(); if (own.error) throw unavailable(); if (own.data) record.invoice_id = own.data.id; }
  }
  let commissionId = row.source_type === 'store_order_commission' ? row.source_id : null;
  if (row.source_type === 'commission_reversal') { const reversal = await supabase.from('store_order_commission_reversals').select('commission_id,reason').eq('id', row.source_id).eq('merchant_id', merchantId).maybeSingle(); if (reversal.error) throw unavailable(); if (reversal.data) { commissionId = reversal.data.commission_id; record.reason = reversal.data.reason; } }
  if (commissionId) { const own = await supabase.from('store_order_commissions').select('store_order_id').eq('id', commissionId).eq('merchant_id', merchantId).maybeSingle(); if (own.error) throw unavailable(); if (own.data) record.store_order_id = own.data.store_order_id; }
  if (row.reversal_of) { const own = await supabase.from('merchant_ledger_entries').select('id').eq('id', row.reversal_of).eq('merchant_id', merchantId).maybeSingle(); if (own.error) throw unavailable(); if (own.data) record.entry_id=own.data.id; }
  return { ...empty(), record };
}
export async function loadFinancialView(identity: FinancialIdentity, section: FinancialView, filter: FinancialViewFilter, signal?: AbortSignal): Promise<FinancialViewData> {
  if (!Number.isInteger(filter.page ?? 0) || (filter.page ?? 0) < 0 || (filter.page ?? 0) > 1000000) throw new Error('رقم الصفحة غير صالح.');
  if (['invoice','payment','entry'].includes(section)) validFinancialId(filter.recordId);
  if (section === 'invoices') return invoices(identity.merchantId, filter, signal);
  if (section === 'payments') return payments(identity.merchantId, filter, signal);
  if (section === 'invoice') return invoiceDetail(identity.merchantId, filter.recordId!, filter.page ?? 0, signal);
  if (section === 'payment') return paymentDetail(identity.merchantId, filter.recordId!, filter.page ?? 0, signal);
  if (section === 'ledger') return ledger(identity.merchantId, filter, signal);
  if (section === 'entry') return entry(identity.merchantId, filter.recordId!, signal);
  const result = await loadMerchantFinancialAccount(section, filter, signal);
  if (section !== 'sale') return result;
  if (!identity.storeId) throw unavailable();
  const own = await supabase.from('store_orders').select('id').eq('id', filter.recordId!).eq('store_id', identity.storeId).abortSignal(signal ?? new AbortController().signal).maybeSingle();
  if (own.error || !own.data) throw unavailable();
  const ownedOrderId = own.data.id;
  const orderItems = await allFinancialRows(after => {
    let q = supabase.from('store_order_items').select('id,product_title_snapshot,selling_unit_snapshot,quantity,unit_price_snapshot,line_total,currency,offer_snapshot').eq('store_order_id', ownedOrderId).order('id').limit(200);
    if (after) q = q.gt('id', after); if (signal) q = q.abortSignal(signal); return q;
  }, signal);
  orderItems.forEach(row => requireSyp(row.currency)); return { ...result, orderItems };
}
