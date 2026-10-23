import { supabase } from "@/lib/supabase";

export type MerchantFinancialSection = "overview" | "sales" | "sale" | "settlements" | "settlement" | "commissions" | "invoices" | "payments";
export type MerchantFinancialCurrency = "SYP" | "USD";
export type MerchantFinancialRow = Record<string, string | number | boolean | null>;
export type MerchantFinancialFilter = {
  currency?: MerchantFinancialCurrency;
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

// A narrow boundary for Migration 012, pending regenerated database types.
// No merchant ID is accepted: the RPC resolves ownership using auth.uid().
const client = supabase as unknown as {
  rpc(name: "merchant_financial_account", args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

function row(value: unknown): MerchantFinancialRow {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.values(value).some((item) => item !== null && !["string", "number", "boolean"].includes(typeof item))
    || Object.values(value).some((item) => typeof item === "number" && !Number.isFinite(item))) {
    throw new Error("بيانات الحساب المالي غير مكتملة. أعد المحاولة.");
  }
  return value as MerchantFinancialRow;
}
function rows(value: unknown) {
  if (!Array.isArray(value)) throw new Error("بيانات الحساب المالي غير مكتملة. أعد المحاولة.");
  return value.map(row);
}
function boundary(value: string | undefined, nextDay = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("أدخل التاريخ بصيغة YYYY-MM-DD.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error("التاريخ غير صالح.");
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export async function loadMerchantFinancialAccount(section: MerchantFinancialSection, filter: MerchantFinancialFilter = {}): Promise<MerchantFinancialData> {
  const from = boundary(filter.from); const until = boundary(filter.to, true);
  if (from && until && from >= until) throw new Error("بداية الفترة يجب أن تسبق نهايتها.");
  const order = (filter.order ?? "").trim().replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  if (!/^\d{0,30}$/.test(order)) throw new Error("أدخل رقم الطلب بالأرقام فقط.");
  if (["sale", "settlement"].includes(section) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filter.recordId ?? "")) throw new Error("معرّف السجل غير صالح.");
  for (const page of [filter.page ?? 0, filter.paymentsPage ?? 0]) {
    if (!Number.isInteger(page) || page < 0 || page > 1000000) throw new Error("رقم الصفحة غير صالح.");
  }
  const { data, error } = await client.rpc("merchant_financial_account", {
    section_name: section, selected_currency: filter.currency ?? null,
    period_from: from, period_until: until, selected_status: filter.status || null,
    order_search: order || null, record_id: filter.recordId || null,
    page_number: filter.page ?? 0, payments_page: filter.paymentsPage ?? 0,
  });
  if (error) {
    if (error.code === "P0002") throw new Error("السجل غير موجود أو غير متاح لحسابك.");
    if (error.code === "42501") throw new Error("هذا الحساب المالي متاح لصاحب حساب التاجر فقط.");
    throw new Error("تعذر تحميل الحساب المالي. تحقق من الاتصال، ثم أعد المحاولة أو تواصل مع الإدارة.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("استجابة الحساب المالي غير صالحة.");
  const value = data as Record<string, unknown>;
  if (typeof value.count !== "number" || !Number.isSafeInteger(value.count) || value.count < 0
    || typeof value.payments_count !== "number" || !Number.isSafeInteger(value.payments_count) || value.payments_count < 0) throw new Error("استجابة الحساب المالي غير صالحة.");
  return {
    summary: rows(value.summary), obligations: rows(value.obligations),
    subscription: value.subscription === null ? null : row(value.subscription),
    record: value.record === null ? null : row(value.record), rows: rows(value.rows),
    count: value.count, payments: rows(value.payments), payments_count: value.payments_count,
  };
}
