import { type Href, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { MerchantFinancialRow, MerchantFinancialSection } from "@/lib/merchant-financial-account";

export const financialStatus: Record<string, string> = {
  open: "مفتوحة", partially_paid: "مدفوعة جزئيًا", completed: "مكتملة", unsettled: "غير مدرجة بتسوية",
  paid: "مسددة", partially_paid_invoice: "مسددة جزئيًا", void: "ملغاة",
  active: "نشط", grace: "فترة سماح", expired: "منتهٍ",
};
const metricLabels: Record<string, string> = {
  gross_items_amount: "قيمة المنتجات بعد الخصومات", commission_amount_at_delivery: "العمولة عند التسليم",
  adjustment_amount: "تعديلات المستحقات", net_commission_amount: "صافي العمولة الحالي",
  current_entitlement_amount: "صافي مستحق المبيعات", paid_amount: "المدفوع فعليًا",
  remaining_amount: "المتبقي غير المدفوع", unbatched_amount: "مستحقات متاحة غير محجوزة بتسوية",
  total_amount: "الإجمالي", base_amount: "أساس احتساب العمولة", commission_rate: "النسبة المحفوظة",
  commission_amount: "قيمة العمولة", reversed_amount: "إجمالي عكوس العمولة", amount: "المبلغ",
  allocated_amount: "المخصص للفواتير", unallocated_amount: "غير المخصص", delivered_count: "الطلبات المسلّمة",
  open_count: "التسويات المفتوحة (تشمل الجزئية)", partial_count: "من المفتوحة: المدفوعة جزئيًا", completed_count: "التسويات المكتملة",
  invoice_outstanding: "الفواتير غير المسددة", payments_recorded: "مدفوعات الاشتراك المسجلة",
  payments_allocated: "مدفوعات مخصصة للفواتير", unapplied_payment_balance: "مدفوعات غير مخصصة",
  commissions_due: "العمولات المستحقة في دفتر الالتزامات", effective_exposure: "رصيد الالتزامات وفق الدفتر",
  credit_limit: "الحد الائتماني", credit_available: "المتاح من الائتمان",
};
const eventLabels: Record<string, string> = {
  entitlement_adjustment: "زيادة مستحق موثقة", commission_reversal: "عكس عمولة موثق",
  settlement_inclusion: "إدراج في تسوية", sale_payment: "دفعة مخصصة لهذا الطلب",
};
export const financialDate = (value: MerchantFinancialRow[string] | undefined) => typeof value === "string" && value ? new Date(value).toLocaleString("ar-SY") : "—";
export const financialMoney = (value: MerchantFinancialRow[string], currency: MerchantFinancialRow[string]) => {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(numeric) ? `${numeric.toLocaleString("ar-SY", { maximumFractionDigits: 2 })} ${currency === "SYP" ? "ل.س" : currency === "USD" ? "دولار" : ""}` : "غير متاح";
};

export function FinancialText({ children, title = false }: { children: React.ReactNode; title?: boolean }) {
  const { colors } = useTheme(); return <Text style={[title ? styles.title : styles.text, { color: title ? colors.text : colors.textSecondary }]}>{children}</Text>;
}
export function FinancialCard({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors } = useTheme(); return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{title ? <FinancialText title>{title}</FinancialText> : null}{children}</View>;
}
export function FinancialLink({ title, href }: { title: string; href: string }) {
  const router = useRouter(); return <AppButton title={title} variant="outline" onPress={() => router.push(href as Href)} />;
}
export function FinancialMetrics({ row, invoice = false }: { row: MerchantFinancialRow; invoice?: boolean }) {
  return <>{Object.entries(metricLabels).filter(([key]) => row[key] !== undefined && row[key] !== null && !(key.startsWith("credit_") && row.credit_enabled === false)).map(([key, label]) => {
    const count = key.endsWith("_count");
    const value = key === "commission_rate" ? `${row[key]}%` : count ? String(row[key]) : financialMoney(row[key], row.currency);
    return <FinancialText key={key}>{invoice && key === "paid_amount" ? "المخصص من المدفوعات" : label}: {value}</FinancialText>;
  })}</>;
}
export function FinancialRecord({ row, section }: { row: MerchantFinancialRow; section: MerchantFinancialSection }) {
  const status = row.settlement_status ?? row.status;
  const date = row.occurred_at ?? row.delivered_at ?? row.created_at;
  const order = row.order_number;
  const title = row.event_type ? eventLabels[String(row.event_type)] : row.invoice_number ? `فاتورة ${row.invoice_number}` : order ? `طلب #${order}` : section === "settlements" || section === "settlement" ? `تسوية ${row.id}` : "سجل مالي";
  return <FinancialCard title={title}>
    <FinancialText>{row.currency} · {financialDate(date)}</FinancialText>
    {status ? <FinancialText>الحالة: {financialStatus[String(status)] ?? String(status)}</FinancialText> : null}
    <FinancialMetrics row={row} invoice={section === "invoices"} />
    {row.plan_name_snapshot ? <FinancialText>الخطة: {row.plan_name_snapshot}</FinancialText> : null}
    {row.starts_at ? <FinancialText>فترة الاشتراك: {financialDate(row.starts_at)} — {financialDate(row.expires_at)}</FinancialText> : null}
    {row.due_at ? <FinancialText>الاستحقاق: {financialDate(row.due_at)}</FinancialText> : null}
    {row.period_starts_at || row.period_ends_at ? <FinancialText>فترة التسوية: {financialDate(row.period_starts_at)} — {financialDate(row.period_ends_at)}</FinancialText> : null}
    {row.method !== undefined ? <FinancialText>الوسيلة المسجلة: {row.method === "cash" ? "نقدي" : row.method === "external_transfer" ? "حوالة خارجية" : "غير مسجلة"}</FinancialText> : null}
    {row.external_reference ? <FinancialText>المرجع: {row.external_reference}</FinancialText> : null}
    {row.reason ? <FinancialText>سبب العكس: {row.reason}</FinancialText> : null}
    {row.note ? <FinancialText>ملاحظات: {row.note}</FinancialText> : null}
    {row.id ? <FinancialText>معرّف السجل: {row.id}</FinancialText> : null}
    {row.store_order_id && section !== "sale" ? <FinancialLink title="التفاصيل المالية للطلب" href={`/merchant/financial-sale-details?storeOrderId=${encodeURIComponent(String(row.store_order_id))}`} /> : null}
    {section === "settlements" ? <FinancialLink title="تفاصيل التسوية" href={`/merchant/settlement-details?batchId=${encodeURIComponent(String(row.id))}`} /> : null}
    {row.batch_id ? <FinancialLink title="فتح التسوية" href={`/merchant/settlement-details?batchId=${encodeURIComponent(String(row.batch_id))}`} /> : null}
  </FinancialCard>;
}
const styles = StyleSheet.create({
  card: { padding: Spacing.four, borderWidth: 1, borderRadius: Radius.lg, gap: Spacing.two },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right", lineHeight: 26 },
  text: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 24 },
});
