import { supabase } from "@/lib/supabase";
import { assertSypDocuments } from "@/lib/money";

export type FinancialReportKind = "cash" | "delivery" | "custody" | "merchant" | "platform";
export type ReportCurrency = "SYP";
export type FinancialReportRow = Record<string, string | number | null>;
export type FinancialReportFilter = { from?: string; to?: string; eventType?: string; driverId?: string; zone?: string; merchantId?: string; detailType?: string; settlementState?: string; page?: number };
export type FinancialReportData = { rows: FinancialReportRow[]; summary: FinancialReportRow[]; groups: FinancialReportRow[]; options: FinancialReportRow[]; count: number; summaryAvailable: boolean };

// Migration 011 relations are intentionally isolated until generated types
// are refreshed after the migration is deployed.
const client = supabase as unknown as {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: Omit<FinancialReportData, "summaryAvailable"> | null; error: { message: string } | null }>;
};
const dateFields: Partial<Record<FinancialReportKind, string>> = { cash: "occurred_at", delivery: "delivered_at", merchant: "delivered_at", platform: "created_at" };

function reportData(data: Omit<FinancialReportData, "summaryAvailable"> | null): FinancialReportData {
  assertSypDocuments(data);
  if (!data || ![data.rows, data.summary, data.groups, data.options].every(Array.isArray)
    || !Number.isSafeInteger(data.count) || data.count < 0) throw new Error("استجابة التقرير غير صالحة.");
  return { ...data, summaryAvailable: true };
}

// Dates are local calendar days, converted to instants. The exclusive end
// includes the complete final day without depending on timestamp precision.
function dateBoundary(value: string | undefined, nextDay = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("أدخل التاريخ بصيغة YYYY-MM-DD.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error("التاريخ غير صالح.");
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export async function loadFinancialReport(kind: FinancialReportKind, filter: FinancialReportFilter = {}): Promise<FinancialReportData> {
  const from = dateBoundary(filter.from);
  const until = dateBoundary(filter.to, true);
  if (from && until && from >= until) throw new Error("يجب أن تسبق بداية الفترة نهايتها.");
  if (["cash", "delivery", "custody"].includes(kind)) {
    const { data, error } = await client.rpc("admin_financial_report", {
      report_kind: kind, period_from: from, period_until: until, movement_type: filter.eventType || null,
      target_driver: filter.driverId || null, zone_snapshot: filter.zone || null, page_number: filter.page ?? 0,
    });
    if (error) throw new Error(error.message);
    return reportData(data);
  }
  const { data, error } = await client.rpc("admin_sales_revenue_report", {
    report_kind: kind, period_from: from, period_until: until, target_merchant: filter.merchantId || null,
    detail_type: filter.detailType || null, settlement_state: filter.settlementState || null,
    page_number: filter.page ?? 0,
  });
  if (error) throw new Error(error.message);
  return reportData(data);
}

export const reportDateField = (kind: FinancialReportKind) => kind === "custody" ? "period_movements" : dateFields[kind] ?? null;
