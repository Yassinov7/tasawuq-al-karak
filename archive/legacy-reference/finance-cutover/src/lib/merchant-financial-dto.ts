import { assertSypDocuments } from '@/lib/money';
export type FinancialRow = Record<string, string | number | boolean | null>;
type Money = { currency: 'SYP' };
export type SummaryDTO = FinancialRow & Money & { current_entitlement_amount: number; paid_amount: number; remaining_amount: number; open_count: number; partial_count: number; completed_count: number };
export type SalesSummaryDTO = FinancialRow & Money & { gross_items_amount: number; commission_amount_at_delivery: number; adjustment_amount: number; current_entitlement_amount: number; paid_amount: number; remaining_amount: number };
export type SubscriptionDTO = FinancialRow & { plan_name_snapshot: string; starts_at: string; expires_at: string; commission_rate_snapshot: number | null; currency_snapshot: 'SYP'; price_snapshot: number; auto_renew: boolean; subscription_status: string };
export type SettlementPaymentDTO = FinancialRow & Money & { id: string; amount: number; occurred_at: string; method: null; external_reference: string | null; note: string };
export type ObligationsDTO = FinancialRow & Money & { invoice_outstanding: number; effective_exposure: number; credit_enabled: boolean; credit_limit: number; credit_available: number };
export type SaleDTO = FinancialRow & Money & { store_order_id: string; order_number: string | number; delivered_at: string; gross_items_amount: number; commission_amount_at_delivery: number; initial_net_entitlement_amount: number; adjustment_amount: number; current_entitlement_amount: number; paid_amount: number; remaining_amount: number; unbatched_amount: number; settlement_status: string };
export type SettlementDTO = FinancialRow & Money & { id: string; created_at: string; total_amount: number; paid_amount: number; remaining_amount: number; settlement_status: string };
export type CommissionDTO = FinancialRow & Money & { id: string; store_order_id: string; base_amount: number; commission_rate: number; commission_amount: number; reversed_amount: number; net_commission_amount: number; occurred_at: string };
export type InvoiceDTO = FinancialRow & Money & { id: string; invoice_number: string; total_amount: number; paid_amount: number; remaining_amount: number; status: string; occurred_at: string };
export type PaymentDTO = FinancialRow & Money & { id: string; amount: number; method: string; occurred_at: string };
export type SubscriptionPaymentDTO = PaymentDTO & { allocated_amount: number; unallocated_amount: number };
export type SaleEventDTO = FinancialRow & Money & { id: string; event_type: 'entitlement_adjustment' | 'commission_reversal' | 'settlement_inclusion' | 'sale_payment'; amount: number; occurred_at: string };
export type SettlementItemDTO = FinancialRow & Money & { id: string; store_order_id: string; current_entitlement_amount: number; paid_amount: number; remaining_amount: number; occurred_at: string };
export type FinancialSectionRows = { overview: never; sales: SaleDTO; sale: SaleEventDTO; settlements: SettlementDTO; settlement: SettlementItemDTO; commissions: CommissionDTO; invoices: InvoiceDTO; payments: SubscriptionPaymentDTO };
export type FinancialSectionRecord = { overview: null; sales: null; sale: SaleDTO; settlements: null; settlement: SettlementDTO; commissions: null; invoices: null; payments: null };
export function financialRow(value: unknown): FinancialRow {
  assertSypDocuments(value);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(item => item !== null && !['string', 'number', 'boolean'].includes(typeof item)) || Object.values(value).some(item => typeof item === 'number' && !Number.isFinite(item))) throw new Error('بيانات الحساب المالي غير مكتملة.');
  return value as FinancialRow;
}
export function requiredRow(value: unknown, numbers: string[], strings: string[] = []): FinancialRow {
  const row = financialRow(value);
  if (row.currency !== 'SYP' || numbers.some(key => typeof row[key] !== 'number') || strings.some(key => typeof row[key] !== 'string' || !row[key])) throw new Error('حقول المستند المالي غير مكتملة.');
  return row;
}
export const saleNumbers = ['gross_items_amount', 'commission_amount_at_delivery', 'initial_net_entitlement_amount', 'adjustment_amount', 'current_entitlement_amount', 'paid_amount', 'remaining_amount', 'unbatched_amount'];
export const settlementNumbers = ['total_amount', 'paid_amount', 'remaining_amount'];
export function decodeSectionRow<S extends keyof FinancialSectionRows>(section: S, value: unknown): FinancialSectionRows[S] {
  const fields: Record<keyof FinancialSectionRows, [string[], string[]]> = {
    overview: [[], []], sales: [saleNumbers, ['store_order_id', 'delivered_at', 'settlement_status']],
    sale: [['amount'], ['id', 'event_type', 'occurred_at']], settlements: [settlementNumbers, ['id', 'created_at', 'settlement_status']],
    settlement: [['current_entitlement_amount', 'paid_amount', 'remaining_amount'], ['id', 'store_order_id', 'occurred_at']],
    commissions: [['base_amount', 'commission_rate', 'commission_amount', 'reversed_amount', 'net_commission_amount'], ['id', 'store_order_id', 'occurred_at']],
    invoices: [['total_amount', 'paid_amount', 'remaining_amount'], ['id', 'invoice_number', 'status', 'occurred_at']],
    payments: [['amount', 'allocated_amount', 'unallocated_amount'], ['id', 'method', 'occurred_at']],
  };
  const [numbers, strings] = fields[section], row = requiredRow(value, numbers, strings);
  if (section === 'sales' && typeof row.order_number !== 'number' && typeof row.order_number !== 'string') throw new Error('مرجع الطلب غير مكتمل.');
  if (typeof row.order_number === 'number' && !Number.isSafeInteger(row.order_number)) throw new Error('تعذر قراءة مرجع الطلب بدقة.');
  if (section === 'sale' && !['entitlement_adjustment', 'commission_reversal', 'settlement_inclusion', 'sale_payment'].includes(String(row.event_type))) throw new Error('حركة مالية غير معروفة.');
  return row as FinancialSectionRows[S];
}
