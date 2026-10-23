import { useCallback, useEffect, useRef, useState } from "react";
import { type Href, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { loadFinancialReport, reportDateField, type FinancialReportData, type FinancialReportKind, type FinancialReportRow, type ReportCurrency } from "@/lib/admin-financial-reports";

const titles: Record<FinancialReportKind, string> = { cash: "الحركة النقدية المؤكدة", delivery: "أجور التوصيل", custody: "عهد السائقين", merchant: "مستحقات التجار", platform: "إيرادات المنصة" };
const cashTypes = ["", "driver_remittance", "driver_credit_payout", "merchant_settlement_payment", "subscription_payment"];
const detailTypes = {
  merchant: ["", "entitlement", "entitlement_adjustment", "merchant_payment", "settlement"],
  platform: ["", "commission", "commission_reversal", "invoice", "subscription_payment", "invoice_allocation"],
};
const labels: Record<string, string> = {
  driver_remittance: "استلام من سائق", driver_credit_payout: "صرف رصيد سائق", merchant_settlement_payment: "دفع مستحقات تاجر", subscription_payment: "دفعة اشتراك مسجلة",
  entitlement: "استحقاق مبيعات", entitlement_adjustment: "تعديل استحقاق", merchant_payment: "دفعة مستحقات", settlement: "تسوية", commission: "عمولة مستحقة", commission_reversal: "عكس عمولة", invoice: "فاتورة اشتراك", invoice_allocation: "تخصيص دفعة لفاتورة",
  open: "مفتوحة", completed: "مكتملة", partially_paid: "مدفوعة جزئيًا",
  period_sales_entitlements: "مستحقات مبيعات الفترة", period_entitlement_adjustments: "تعديلات الفترة", period_merchant_payments: "المدفوعات الفعلية خلال الفترة", sales_entitlements: "إجمالي مستحقات المبيعات", entitlement_adjustments: "إجمالي تعديلات المستحقات", merchant_payments: "إجمالي المدفوعات الفعلية", merchant_remaining: "صافي المستحق الحالي", unbatched_entitlements: "مستحقات متاحة غير محجوزة بتسوية",
  open_settlements: "تسويات الفترة المفتوحة (تشمل الجزئية)", completed_settlements: "تسويات الفترة المكتملة", partial_settlements: "من المفتوحة: المدفوعة جزئيًا",
  commissions: "عمولات مستحقة خلال الفترة", commission_reversals: "عكوس خلال الفترة", net_commissions: "صافي حركة العمولات خلال الفترة", invoices_issued: "قيمة فواتير الفترة غير الملغاة", invoice_count: "عدد فواتير الفترة غير الملغاة", payments_registered: "مدفوعات اشتراك مسجلة خلال الفترة", payments_allocated: "المخصص حاليًا من مدفوعات الفترة", payments_unallocated: "غير المخصص من مدفوعات الفترة", invoice_remaining: "المتبقي حاليًا على فواتير الفترة", period_allocations: "التخصيصات المسجلة خلال الفترة",
  movement_count: "عدد الحركات", inflow: "النقد الوارد", outflow: "النقد الصادر", delivery_fee_amount: "أجور التوصيل", delivered_count: "عدد الطلبات المسلّمة", average_fee: "متوسط أجر التوصيل", driver_count: "عدد السائقين",
  amount: "المبلغ", cash_collected_amount: "إجمالي العهدة", delivery_fee_entitled_amount: "أجور التوصيل المستحقة", net_custody_due_amount: "المطلوب للمكتب", office_received_amount: "المستلم فعليًا", custody_remaining_amount: "المتبقي على السائق", driver_credit_amount: "الرصيد الدائن", driver_credit_paid_amount: "المصروف من الرصيد الدائن",
  period_obligations: "التزامات الطلبات خلال الفترة", period_receipts: "استلامات المكتب خلال الفترة", period_payouts: "صرف أرصدة خلال الفترة", remaining_amount: "المتبقي", current_entitlement_amount: "المستحق", paid_amount: "المدفوع", commission_amount: "العمولة",
};
const amountKeys = ["amount", "delivery_fee_amount", "cash_collected_amount", "delivery_fee_entitled_amount", "net_custody_due_amount", "office_received_amount", "custody_remaining_amount", "driver_credit_amount", "driver_credit_paid_amount", "remaining_amount", "current_entitlement_amount", "paid_amount", "commission_amount"];
const format = (value: string | number | null) => typeof value === "number" ? value.toLocaleString("ar-SY", { maximumFractionDigits: 2 }) : String(value ?? "—");

export function FinancialReportScreen({ kind }: { kind: FinancialReportKind }) {
  const { colors } = useTheme();
  const [currency, setCurrency] = useState<ReportCurrency | undefined>();
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [eventType, setEventType] = useState(""); const [driverId, setDriverId] = useState(""); const [zone, setZone] = useState("");
  const [merchantId, setMerchantId] = useState(""); const [detailType, setDetailType] = useState(""); const [settlementState, setSettlementState] = useState("");
  const [page, setPage] = useState(0); const [data, setData] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  const requestId = useRef(0);
  const load = useCallback(async (manual = false) => {
    const request = ++requestId.current;
    if (manual) setRefreshing(true); else setLoading(true);
    try {
      const next = await loadFinancialReport(kind, { currency, from, to, eventType, driverId, zone, merchantId, detailType, settlementState, page });
      if (request !== requestId.current) return;
      setData(next); setError("");
    } catch (caught) {
      if (request !== requestId.current) return;
      setData(null); setError(caught instanceof Error ? caught.message : "تعذر تحميل التقرير. تحقق من تطبيق migrations المالية.");
    } finally {
      if (request === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [currency, driverId, eventType, from, kind, page, to, zone, merchantId, detailType, settlementState]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 350);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [load]);
  const change = (setter: (value: string) => void, value: string) => { setPage(0); setData(null); setter(value); };
  const options = data?.options ?? [];
  const showDrivers = kind === "delivery" || kind === "custody";
  return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
    <Text style={[styles.title, { color: colors.text }]}>{titles[kind]}</Text>
    <View style={styles.filters}>{([undefined, "SYP", "USD"] as const).map((item) => <Filter key={item ?? "all"} label={item ?? "كل العملات"} active={currency === item} onPress={() => { setPage(0); setData(null); setCurrency(item); }} />)}</View>
    {reportDateField(kind) ? <View style={styles.filters}>
      <TextInput accessibilityLabel="بداية الفترة" value={from} onChangeText={(v) => change(setFrom, v)} placeholder="من YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
      <TextInput accessibilityLabel="نهاية الفترة" value={to} onChangeText={(v) => change(setTo, v)} placeholder="إلى YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
    </View> : null}
    <ReportText>التواريخ وفق توقيت الجهاز المحلي؛ تشمل الفترة يوم النهاية كاملًا.</ReportText>
    {kind === "cash" ? <View style={styles.filters}>{cashTypes.map((item) => <Filter key={item || "all-events"} label={labels[item] ?? "كل الحركات"} active={eventType === item} onPress={() => change(setEventType, item)} />)}</View> : null}
    {showDrivers ? <View style={styles.filters}><Filter label="كل السائقين" active={!driverId} onPress={() => change(setDriverId, "")} />{options.filter((o) => o.kind === "driver").map((o) => <Filter key={String(o.value)} label={String(o.label)} active={driverId === o.value} onPress={() => change(setDriverId, String(o.value))} />)}{driverId && !options.length ? <Filter label="إلغاء فلتر السائق" active onPress={() => change(setDriverId, "")} /> : null}</View> : null}
    {kind === "delivery" ? <View style={styles.filters}><Filter label="كل المناطق" active={!zone} onPress={() => change(setZone, "")} />{options.filter((o) => o.kind === "zone").map((o) => <Filter key={String(o.value)} label={String(o.label)} active={zone === o.value} onPress={() => change(setZone, String(o.value))} />)}{zone && !options.length ? <Filter label="إلغاء فلتر المنطقة" active onPress={() => change(setZone, "")} /> : null}</View> : null}
    {kind === "merchant" || kind === "platform" ? <>
      <View style={styles.filters}><Filter label="كل التجار" active={!merchantId} onPress={() => change(setMerchantId, "")} />{options.filter((o) => o.kind === "merchant").map((o) => <Filter key={String(o.value)} label={String(o.label)} active={merchantId === o.value} onPress={() => change(setMerchantId, String(o.value))} />)}</View>
      <ReportText>نوع التفاصيل وحالة التسوية يفلتران القائمة فقط؛ المؤشرات تشمل الفترة والعملة والتاجر المحدد.</ReportText>
      <View style={styles.filters}>{detailTypes[kind].map((item) => <Filter key={item || "all-details"} label={labels[item] ?? "كل التفاصيل"} active={detailType === item} onPress={() => { setSettlementState(""); change(setDetailType, item); }} />)}</View>
      {kind === "merchant" && detailType === "settlement" ? <View style={styles.filters}>{["", "open", "completed", "partially_paid"].map((item) => <Filter key={item || "all-states"} label={labels[item] ?? "كل حالات التسوية"} active={settlementState === item} onPress={() => change(setSettlementState, item)} />)}</View> : null}
    </> : null}
    {kind === "delivery" ? <ReportText>أجور التوصيل مستحقة للسائقين، وليست إيرادًا للمنصة. المناطق من لقطة التسليم المحفوظة.</ReportText> : null}
    {kind === "custody" ? <ReportText>الأرصدة الحالية تراكمية ولا تتأثر بالفترة. تظهر حركات الفترة مستقلة أدناه.</ReportText> : null}
    {kind === "merchant" ? <ReportText>حركات الفترة بتاريخ التسليم أو التعديل أو الدفع؛ وعدد التسويات بتاريخ إنشائها وحالتها الحالية. الأرصدة الحالية أدناه تشمل كامل التاريخ ولا تُخصم منها اشتراكات التاجر.</ReportText> : null}
    {kind === "platform" ? <ReportText>العمولات حسب تاريخ الاستحقاق والعكوس حسب تسجيلها. الفواتير والمدفوعات حسب إصدارها واستلامها؛ المخصص والمتبقي أرصدة حالية لسجلات الفترة، وليست أرصدة تاريخية. هذه ليست أرباحًا صافية أو نقدًا متاحًا.</ReportText> : null}
    {loading ? <ActivityIndicator color={colors.primary} /> : null}
    {error ? <><Text accessibilityRole="alert" style={[styles.meta, { color: colors.error }]}>{error}</Text><Filter label="إعادة المحاولة" onPress={() => void load()} /></> : null}
    {!loading && !error && data ? <>
      {data.summaryAvailable ? <><ReportText>{kind === "custody" ? "الأرصدة الحالية حسب العملة" : "المؤشرات لجميع السجلات المطابقة للفلاتر"}</ReportText>{data.summary.map((row) => <Metrics key={String(row.currency)} row={row} />)}</> : <ReportText>هذا التقرير غير مكتمل: التفاصيل أدناه محدودة بصفحة؛ الإجماليات الشاملة غير متاحة بعد، ولا تُحسب من هذه الصفحة.</ReportText>}
      {data.groups.length ? <ReportText>{kind === "custody" ? "حركة الفترة حسب العملة" : kind === "merchant" ? "الأرصدة الحالية لجميع التواريخ حسب العملة" : "التجميع حسب المنطقة والسائق"}</ReportText> : null}
      {data.groups.map((row, i) => <Metrics key={`${row.currency}-${row.group_type ?? "period"}-${row.group_key ?? i}`} row={row} />)}
      <ReportText>تفاصيل الصفحة {page + 1} · {data.count} سجل مطابق</ReportText>
      {data.rows.map((row, index) => <RecordCard key={`${row.event_type ?? "row"}-${row.id ?? row.customer_order_id ?? row.batch_entitlement_id ?? row.driver_id ?? index}-${row.currency}`} row={row} kind={kind} />)}
      {!data.rows.length ? <ReportText>لا توجد بيانات مطابقة.</ReportText> : null}
      <View style={styles.filters}><Filter label="السابق" disabled={page === 0} onPress={() => { setData(null); setPage((value) => value - 1); }} /><Filter label="التالي" disabled={(page + 1) * 20 >= data.count} onPress={() => { setData(null); setPage((value) => value + 1); }} /></View>
    </> : null}
  </ScrollView>;
}

function ReportText({ children }: { children: React.ReactNode }) { const { colors } = useTheme(); return <Text style={[styles.meta, { color: colors.textSecondary }]}>{children}</Text>; }
function Filter({ label, active = false, disabled = false, onPress }: { label: string; active?: boolean; disabled?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress} style={[styles.filter, { opacity: disabled ? .4 : 1, borderColor: active ? colors.primary : colors.border }]}><Text style={[styles.meta, { color: active ? colors.primary : colors.textSecondary }]}>{label}</Text></Pressable>;
}
function Metrics({ row }: { row: FinancialReportRow }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><ReportText>{String(row.currency)}{row.label ? ` · ${row.group_type === "zone" ? "منطقة" : "سائق"}: ${row.label}` : ""}</ReportText>{Object.entries(row).filter(([key]) => labels[key]).map(([key, value]) => <ReportText key={key}>{labels[key]}: {format(value)}</ReportText>)}</View>;
}
function RecordCard({ row, kind }: { row: FinancialReportRow; kind: FinancialReportKind }) {
  const { colors } = useTheme(); const router = useRouter();
  const link = (label: string, path: string) => <Filter label={label} onPress={() => router.push(path as Href)} />;
  const date = row.occurred_at ?? row.delivered_at ?? row.created_at;
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <ReportText>{row.party_name ?? row.driver_id ?? row.merchant_id ?? "سجل مالي"}</ReportText>
    {row.event_type ? <ReportText>{labels[String(row.event_type)] ?? String(row.event_type)}{row.direction ? ` · ${row.direction === "inflow" ? "وارد" : "صادر"}` : ""}</ReportText> : null}
    {row.status ? <ReportText>الحالة: {labels[String(row.status)] ?? row.status}</ReportText> : null}
    <ReportText>{date ? new Date(String(date)).toLocaleString("ar-SY") : "رصيد حالي"} · {row.currency}</ReportText>
    {amountKeys.filter((key) => row[key] !== undefined && row[key] !== null).map((key) => <ReportText key={key}>{labels[key]}: {format(row[key])}</ReportText>)}
    {row.zone_name ? <ReportText>المنطقة: {row.zone_name}</ReportText> : null}
    {row.reference ? <ReportText>المرجع: {row.reference}</ReportText> : null}
    {row.id ? <ReportText>معرّف السجل: {row.id}</ReportText> : null}
    {row.note ? <ReportText>{row.note}</ReportText> : null}
    <View style={styles.filters}>
      {row.customer_order_id ? link("تفاصيل الطلب", `/admin/order-details?orderId=${encodeURIComponent(String(row.customer_order_id))}`) : null}
      {row.driver_id || (kind === "cash" && String(row.event_type).startsWith("driver_")) ? link("عهدة السائق وسجل المكتب", `/admin/driver-custody-details?driverId=${encodeURIComponent(String(row.driver_id ?? row.party_id))}`) : null}
      {row.batch_id ? link("تفاصيل التسوية", `/admin/merchant-settlement-details?batchId=${encodeURIComponent(String(row.batch_id))}`) : null}
      {row.event_type === "subscription_payment" || row.payment_id ? link("تفاصيل الدفعة", `/admin/payment-details?paymentId=${encodeURIComponent(String(row.payment_id ?? row.id))}`) : null}
      {row.invoice_id ? link("تفاصيل الفاتورة", `/admin/invoice-details?invoiceId=${encodeURIComponent(String(row.invoice_id))}`) : null}
      {row.merchant_id ? link("مالية التاجر", `/admin/merchant-finance?merchantId=${encodeURIComponent(String(row.merchant_id))}`) : null}
      {kind === "merchant" && row.merchant_id ? link("تسويات التاجر", `/admin/merchant-settlements?merchantId=${encodeURIComponent(String(row.merchant_id))}`) : null}
      {row.commission_id ? link("تفاصيل العمولة والعكوس", `/admin/commission-details?commissionId=${encodeURIComponent(String(row.commission_id))}`) : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { padding: Spacing.five, gap: Spacing.three, paddingBottom: Spacing.ten }, title: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" }, filters: { flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" }, filter: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }, input: { flex: 1, minWidth: 130, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.two, minHeight: 44, textAlign: "right" }, card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.one }, meta: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 } });
