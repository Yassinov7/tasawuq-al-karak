import { formatSyp } from "@/lib/money";
import { type Href, useRouter } from "expo-router";
import { Share, StyleSheet, Text, View } from "react-native";
import { useState } from 'react';
import { AppButton } from "@/components/ui/AppButton";
import { Typography, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { MerchantFinancialRow } from "@/lib/merchant-financial-account";
import type { FinancialView } from '@/lib/merchant-financial-details';

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
  initial_net_entitlement_amount: 'المستحق الأولي', reserved_amount: 'المبلغ المحجوز بتسويات مفتوحة',
};
const eventLabels: Record<string, string> = {
  entitlement_adjustment: "زيادة مستحق موثقة", commission_reversal: "عكس عمولة موثق",
  settlement_inclusion: "إدراج في تسوية", sale_payment: "دفعة مخصصة لهذا الطلب",
};
export const financialDate = (value: MerchantFinancialRow[string] | undefined) => typeof value === "string" && value ? new Date(value).toLocaleString("ar-SY") : "—";
export const financialMoney = (value: MerchantFinancialRow[string], currency: MerchantFinancialRow[string]) => {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(numeric) ? formatSyp(numeric, currency) : "غير متاح";
};

export function FinancialText({ children, title = false }: { children: React.ReactNode; title?: boolean }) {
  const { colors } = useTheme(); return <Text selectable style={[title ? styles.title : styles.text, { color: title ? colors.text : colors.textSecondary }]}>{children}</Text>;
}
export function FinancialCard({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors } = useTheme(); return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{title ? <FinancialText title>{title}</FinancialText> : null}{children}</View>;
}
export function FinancialLink({ title, href }: { title: string; href: string }) {
  const router = useRouter(); return <AppButton design="refined" title={title} variant="outline" onPress={() => router.push(href as Href)} />;
}
export function FinancialMetrics({ row, invoice = false }: { row: MerchantFinancialRow; invoice?: boolean }) {
  return <>{Object.entries(metricLabels).filter(([key]) => row[key] !== undefined && row[key] !== null && !(key.startsWith("credit_") && row.credit_enabled === false)).map(([key, label]) => {
    const count = key.endsWith("_count");
    const value = key === "commission_rate" ? `${row[key]}%` : count ? String(row[key]) : financialMoney(row[key], row.currency);
    return <FinancialText key={key}>{invoice && key === "paid_amount" ? "المخصص من المدفوعات" : label}: {value}</FinancialText>;
  })}</>;
}
export function FinancialRecord({ row, section, detail = false }: { row: MerchantFinancialRow; section: FinancialView; detail?: boolean }) {
  const [expanded,setExpanded] = useState(detail);
  const status = row.settlement_status ?? row.status;
  const date = row.occurred_at ?? row.delivered_at ?? row.created_at;
  const order = row.order_number;
  const title = row.event_type ? eventLabels[String(row.event_type)] : row.invoice_number ? `فاتورة ${row.invoice_number}` : order ? `طلب #${order}` : section === 'ledger' || section === 'entry' ? `قيد ${String(row.id).slice(0,8)}` : section === 'settlement' && row.amount !== undefined ? 'دفعة تسوية مسجلة' : section === 'settlements' || section === 'settlement' ? `تسوية ${String(row.id).slice(0,8)}` : row.payment_id ? 'تخصيص من دفعة اشتراك' : section === 'payments' || section === 'payment' ? 'دفعة اشتراك' : 'سجل مالي';
  return <FinancialCard title={title}>
    <FinancialText>{row.currency} · {financialDate(date)}</FinancialText>
    {status ? <FinancialStatus status={String(status)} /> : null}
    <FinancialMetrics row={expanded ? row : Object.fromEntries(Object.entries(row).filter(([key]) => ['currency','amount','total_amount','remaining_amount','current_entitlement_amount','commission_amount'].includes(key)))} invoice={section === "invoices" || section === 'invoice'} />
    {row.effect ? <FinancialText>الأثر: {row.effect === 'increase_exposure' ? 'زيادة الالتزامات' : 'خفض الالتزامات'}</FinancialText> : null}
    {row.source_type ? <FinancialText>المصدر: {ledgerSources[String(row.source_type)] ?? String(row.source_type)}</FinancialText> : null}
    {!expanded ? <AppButton design="refined" title="عرض البيانات" variant="outline" onPress={() => setExpanded(true)} /> : null}
    {expanded ? <>
    {row.plan_name_snapshot ? <FinancialText>الخطة: {row.plan_name_snapshot}</FinancialText> : null}
    {row.starts_at ? <FinancialText>فترة الاشتراك: {financialDate(row.starts_at)} — {financialDate(row.expires_at)}</FinancialText> : null}
    {row.due_at ? <FinancialText>الاستحقاق: {financialDate(row.due_at)}</FinancialText> : null}
    {row.period_starts_at || row.period_ends_at ? <FinancialText>فترة التسوية: {financialDate(row.period_starts_at)} — {financialDate(row.period_ends_at)}</FinancialText> : null}
    {row.method !== undefined ? <FinancialText>الوسيلة المسجلة: {row.method === "cash" ? "نقدي" : row.method === "external_transfer" ? "حوالة خارجية" : "غير مسجلة"}</FinancialText> : null}
    {row.kind ? <FinancialText>نوع الفاتورة: {row.kind === 'initial' ? 'أولية' : row.kind === 'renewal' ? 'تجديد' : 'تعديل'}</FinancialText> : null}
    {row.external_reference ? <FinancialText>المرجع: {row.external_reference}</FinancialText> : null}
    {row.reason ? <FinancialText>سبب العكس: {row.reason}</FinancialText> : null}
    {row.note ? <FinancialText>ملاحظات: {row.note}</FinancialText> : null}
    {row.id ? <FinancialText>معرّف السجل: {row.id}</FinancialText> : null}
    {row.source_id ? <FinancialText>مرجع المصدر: {row.source_id}</FinancialText> : null}
    <FinancialText>اضغط مطولًا على المرجع لتحديده ونسخه.</FinancialText>
    <FinancialShare row={row} title={title ?? 'سجل مالي'} />
    </> : null}
    {row.store_order_id && section !== "sale" ? <FinancialLink title="التفاصيل المالية للطلب" href={`/merchant/financial-sale-details?storeOrderId=${encodeURIComponent(String(row.store_order_id))}`} /> : null}
    {section === "settlements" ? <FinancialLink title="تفاصيل التسوية" href={`/merchant/settlement-details?batchId=${encodeURIComponent(String(row.id))}`} /> : null}
    {row.batch_id ? <FinancialLink title="فتح التسوية" href={`/merchant/settlement-details?batchId=${encodeURIComponent(String(row.batch_id))}`} /> : null}
    {section === 'invoices' || row.invoice_id ? <FinancialLink title="تفاصيل فاتورة الاشتراك" href={`/merchant/subscription-invoice-details?invoiceId=${encodeURIComponent(String(row.invoice_id ?? row.id))}`} /> : null}
    {section === 'payments' && row.allocated_amount !== undefined || row.payment_id ? <FinancialLink title="تفاصيل دفعة الاشتراك" href={`/merchant/subscription-payment-details?paymentId=${encodeURIComponent(String(row.payment_id ?? row.id))}`} /> : null}
    {section === 'ledger' ? <FinancialLink title="تفاصيل القيد" href={`/merchant/financial-ledger-details?entryId=${encodeURIComponent(String(row.id))}`} /> : null}
    {row.entry_id ? <FinancialLink title="القيد الأصلي" href={`/merchant/financial-ledger-details?entryId=${encodeURIComponent(String(row.entry_id))}`} /> : null}
  </FinancialCard>;
}
const styles = StyleSheet.create({
  card: { padding: Spacing.four, borderWidth: 1, borderRadius: Radius.lg, gap: Spacing.two },
  title: { ...Typography.cardTitle, textAlign: 'right' },
  text: { ...Typography.body, textAlign: 'right' },
});
export const ledgerSources: Record<string,string> = { subscription_invoice:'فاتورة اشتراك', store_order_commission:'عمولة طلب', commission_reversal:'عكس عمولة', payment_allocation:'تخصيص دفعة', manual_adjustment:'تعديل موثق', ledger_reversal:'عكس قيد' };
function FinancialStatus({status}:{status:string}) {
  const {colors}=useTheme();
  const paid=status==='paid'||status==='completed',waiting=['open','partially_paid','unsettled'].includes(status);
  return <View style={{alignSelf:'flex-end',paddingHorizontal:10,paddingVertical:6,borderRadius:Radius.sm,backgroundColor:paid?colors.successSurface:waiting?colors.warningSurface:colors.surfaceSecondary}}><Text style={[Typography.bodyStrong,{textAlign:'right',color:paid?colors.successForeground:waiting?colors.warningForeground:colors.textSecondary}]}>{financialStatus[status]??status}</Text></View>;
}
export function FinancialShare({row,title,scope='مستند فردي؛ ليست هذه محفظة أو كشف رصيد شامل'}:{row:MerchantFinancialRow;title:string;scope?:string}) {
  const [error,setError]=useState('');
  const share=()=>{
    setError('');
    const message=[
      `تسوق — ${title}`,
      `المصدر: الحساب المالي للتاجر · ${scope}`,
      `وقت المشاركة: ${new Date().toLocaleString('ar-SY')}`,
      row.id?`المرجع: ${row.id}`:'',
      row.external_reference?`المرجع الخارجي: ${row.external_reference}`:'',
      row.occurred_at||row.delivered_at||row.created_at?`تاريخ السجل: ${financialDate(row.occurred_at??row.delivered_at??row.created_at)}`:'',
      ...Object.entries(metricLabels).filter(([key])=>row[key]!==undefined&&row[key]!==null&&!key.endsWith('_count')).map(([key,label])=>`${label}: ${key==='commission_rate'?`${row[key]}%`:financialMoney(row[key],row.currency)}`),
      'المبالغ وفق آخر البيانات المعروضة؛ ليست إثباتًا مصرفيًا مستقلًا.',
    ].filter(Boolean).join('\n');
    void Share.share({message}).catch(()=>setError('تعذرت المشاركة. يمكنك تحديد المرجع ونسخه.'));
  };
  return <><AppButton design="refined" title="مشاركة ملخص نصي" variant="outline" onPress={share}/>{error?<FinancialText>{error}</FinancialText>:null}</>;
}
