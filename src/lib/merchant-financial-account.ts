import { supabase } from "@/lib/supabase";
import { assertSypDocuments } from "@/lib/money";
import { financialPeriod, validFinancialId } from '@/lib/financial-input';
import { financialRow, requiredRow, decodeSectionRow, saleNumbers, settlementNumbers, type FinancialSectionRows, type FinancialSectionRecord, type SummaryDTO, type SalesSummaryDTO, type ObligationsDTO, type SubscriptionDTO, type SettlementPaymentDTO } from '@/lib/merchant-financial-dto';

export type MerchantFinancialSection = "overview" | "sales" | "sale" | "settlements" | "settlement" | "commissions" | "invoices" | "payments";
export type MerchantFinancialCurrency = "SYP";
export type MerchantFinancialRow = Record<string, string | number | boolean | null>;
export type MerchantFinancialFilter = {
  from?: string;
  to?: string;
  status?: string;
  order?: string;
  recordId?: string;
  page?: number;
  paymentsPage?: number;
};
export type MerchantFinancialData = {
  summary: MerchantFinancialRow[];
  obligations: MerchantFinancialRow[];
  subscription: MerchantFinancialRow | null;
  record: MerchantFinancialRow | null;
  rows: MerchantFinancialRow[];
  count: number;
  payments: MerchantFinancialRow[];
  payments_count: number;
};
export type MerchantFinancialDTO<S extends MerchantFinancialSection> = Omit<MerchantFinancialData, 'rows' | 'record' | 'summary' | 'obligations' | 'subscription' | 'payments'> & { summary: (SummaryDTO | SalesSummaryDTO)[]; obligations: ObligationsDTO[]; subscription: SubscriptionDTO | null; payments: SettlementPaymentDTO[]; rows: FinancialSectionRows[S][]; record: FinancialSectionRecord[S] | null };

// The generated RPC signature resolves ownership from auth.uid(), never a URL merchant ID.

function rows(value: unknown) {
  if (!Array.isArray(value)) throw new Error("بيانات الحساب المالي غير مكتملة. أعد المحاولة.");
  return value.map(financialRow);
}

export async function loadMerchantFinancialAccount<S extends MerchantFinancialSection>(section: S, filter: MerchantFinancialFilter = {}, signal?: AbortSignal): Promise<MerchantFinancialDTO<S>> {
  const { from, until } = financialPeriod(filter.from, filter.to);
  const order = (filter.order ?? "").trim().replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  if (!/^\d{0,30}$/.test(order)) throw new Error("أدخل رقم الطلب بالأرقام فقط.");
  if (["sale", "settlement"].includes(section)) validFinancialId(filter.recordId);
  for (const page of [filter.page ?? 0, filter.paymentsPage ?? 0]) {
    if (!Number.isInteger(page) || page < 0 || page > 1000000) throw new Error("رقم الصفحة غير صالح.");
  }
  let request = supabase.rpc("merchant_financial_account", {
    section_name: section, period_from: from, period_until: until, selected_status: filter.status || null,
    order_search: order || null, record_id: filter.recordId || null,
    page_number: filter.page ?? 0, payments_page: filter.paymentsPage ?? 0,
  });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) {
    if (error.code === "P0002") throw new Error("السجل غير موجود أو غير متاح لحسابك.");
    if (error.code === "42501") throw new Error("هذا الحساب المالي متاح لصاحب حساب التاجر فقط.");
    throw new Error("تعذر تحميل الحساب المالي. تحقق من الاتصال، ثم أعد المحاولة أو تواصل مع الإدارة.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("استجابة الحساب المالي غير صالحة.");
  const value = data as Record<string, unknown>;
  assertSypDocuments(value);
  if (typeof value.count !== "number" || !Number.isSafeInteger(value.count) || value.count < 0
    || typeof value.payments_count !== "number" || !Number.isSafeInteger(value.payments_count) || value.payments_count < 0) throw new Error("استجابة الحساب المالي غير صالحة.");
  const summary = rows(value.summary).map(item => section === 'overview'
    ? requiredRow(item, ['current_entitlement_amount','paid_amount','remaining_amount','open_count','partial_count','completed_count']) as SummaryDTO
    : requiredRow(item, ['gross_items_amount','commission_amount_at_delivery','adjustment_amount','current_entitlement_amount','paid_amount','remaining_amount']) as SalesSummaryDTO);
  const obligations = rows(value.obligations).map(item => {
    const row = requiredRow(item, ['invoice_outstanding','effective_exposure','credit_limit','credit_available']);
    if (typeof row.credit_enabled !== 'boolean') throw new Error('بيانات الائتمان غير مكتملة.');
    return row as ObligationsDTO;
  });
  const record = value.record === null ? null : requiredRow(value.record, section === 'sale' ? saleNumbers : settlementNumbers, section === 'sale' ? ['store_order_id','delivered_at','settlement_status'] : ['id','created_at','settlement_status']);
  if (['sale','settlement'].includes(section) && !record) throw new Error('السجل غير موجود أو غير متاح لحسابك.');
  const subscription = value.subscription === null ? null : financialRow(value.subscription);
  if (subscription && (typeof subscription.plan_name_snapshot !== 'string' || typeof subscription.starts_at !== 'string' || typeof subscription.expires_at !== 'string' || typeof subscription.price_snapshot !== 'number' || subscription.currency_snapshot !== 'SYP' || typeof subscription.auto_renew !== 'boolean' || typeof subscription.subscription_status !== 'string' || !(subscription.commission_rate_snapshot === null || typeof subscription.commission_rate_snapshot === 'number'))) throw new Error('بيانات الاشتراك غير مكتملة.');
  return {
    summary, obligations, subscription: subscription as SubscriptionDTO | null,
    record: record as FinancialSectionRecord[S] | null, rows: rows(value.rows).map(item => decodeSectionRow(section, item)),
    count: value.count, payments: rows(value.payments).map(item => {
      const row = requiredRow(item, ['amount'], ['id','occurred_at']);
      if (row.method !== null || typeof row.note !== 'string' || !(row.external_reference === null || typeof row.external_reference === 'string')) throw new Error('بيانات دفعة التسوية غير مكتملة.');
      return row as SettlementPaymentDTO;
    }), payments_count: value.payments_count,
  };
}
