import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { FinancialCard, financialDate, FinancialLink, FinancialMetrics, FinancialRecord, financialStatus, FinancialText } from "@/components/merchant/MerchantFinancialCards";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { loadMerchantFinancialAccount, type MerchantFinancialCurrency, type MerchantFinancialData, type MerchantFinancialSection } from "@/lib/merchant-financial-account";

const links = [
  ["المبيعات المسلّمة", "/merchant/financial-sales"], ["التسويات", "/merchant/settlements"],
  ["عمولات المبيعات", "/merchant/sales-commissions"], ["فواتير الاشتراك", "/merchant/subscription-invoices"],
  ["مدفوعات الاشتراك", "/merchant/subscription-payments"],
] as const;

export function MerchantFinancialScreen({ section }: { section: MerchantFinancialSection }) {
  const { colors } = useTheme(); const { user } = useAuth();
  const params = useLocalSearchParams<{ storeOrderId?: string | string[]; batchId?: string | string[] }>();
  const rawId = section === "sale" ? params.storeOrderId : section === "settlement" ? params.batchId : undefined;
  const recordId = typeof rawId === "string" ? rawId : undefined;
  const [currency, setCurrency] = useState<MerchantFinancialCurrency | undefined>();
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [status, setStatus] = useState(""); const [order, setOrder] = useState("");
  const [page, setPage] = useState(0); const [paymentsPage, setPaymentsPage] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; data: MerchantFinancialData } | null>(null);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  const requestId = useRef(0); const userId = user?.id;
  const key = JSON.stringify([userId, section, recordId, currency, from, to, status, order, page, paymentsPage]);
  const data = loaded?.key === key ? loaded?.data : null;
  const load = useCallback(async (manual = false) => {
    const request = ++requestId.current;
    if (!userId) { setLoaded(null); setLoading(false); setRefreshing(false); setError("سجّل الدخول بحساب التاجر لعرض حسابك المالي."); return; }
    if (manual) setRefreshing(true); else setLoading(true);
    try {
      const next = await loadMerchantFinancialAccount(section, { currency, from, to, status, order, recordId, page, paymentsPage });
      if (request !== requestId.current) return;
      setLoaded({ key, data: next }); setError("");
    } catch (caught) {
      if (request !== requestId.current) return;
      setLoaded(null); setError(caught instanceof Error ? caught.message : "تعذر تحميل الحساب المالي.");
    } finally {
      if (request === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [section, currency, from, to, status, order, recordId, page, paymentsPage, userId, key]);
  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [load]));
  const change = (setter: (value: string) => void, value: string) => { setLoaded(null); setPage(0); setter(value); };
  const list = !["overview", "sale", "settlement"].includes(section);
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} colors={[colors.primary]} />}>
      <FinancialText>سجلات للقراءة فقط. مستحقات المبيعات منفصلة عن فواتير الاشتراك ومدفوعاته.</FinancialText>

      {list ? <>
        <View style={styles.filters}>{([undefined, "SYP", "USD"] as const).map((value) => <Choice key={value ?? "all"} title={value ?? "كل العملات"} active={currency === value} onPress={() => { setLoaded(null); setPage(0); setCurrency(value); }} />)}</View>
        <View style={styles.filters}>
          <TextInput accessibilityLabel="بداية الفترة" placeholder="من YYYY-MM-DD" placeholderTextColor={colors.textMuted} value={from} onChangeText={(value) => change(setFrom, value)} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
          <TextInput accessibilityLabel="نهاية الفترة" placeholder="إلى YYYY-MM-DD" placeholderTextColor={colors.textMuted} value={to} onChangeText={(value) => change(setTo, value)} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
        </View>
        <FinancialText>الفترة حسب توقيت جهازك، وتشمل يوم النهاية كاملًا.</FinancialText>
        {section === "sales" || section === "settlements" ? <View style={styles.filters}>{["", ...(section === "sales" ? ["unsettled"] : []), "open", "partially_paid", "completed"].map((value) => <Choice key={value || "all"} title={financialStatus[value] ?? "كل الحالات"} active={status === value} onPress={() => change(setStatus, value)} />)}</View> : null}
        {section === "sales" || section === "commissions" ? <TextInput accessibilityLabel="رقم الطلب" placeholder="بحث برقم الطلب الكامل" placeholderTextColor={colors.textMuted} value={order} onChangeText={(value) => change(setOrder, value)} keyboardType="number-pad" style={[styles.input, { color: colors.text, borderColor: colors.border }]} /> : null}
      </> : null}
      {section === "sales" ? <FinancialText>الفترة بتاريخ التسليم؛ المستحق والمدفوع والمتبقي أرصدة حالية للطلبات المطابقة، وتشمل دفعات وتعديلات لاحقة. المؤشرات تشمل جميع النتائج، وليس الصفحة الحالية.</FinancialText> : null}
      {section === "commissions" ? <FinancialText>الفترة بتاريخ استحقاق العمولة. النسبة وأساس الحساب محفوظان وقت الطلب؛ العكوس وصافي العمولة يعكسان التصحيحات المسجلة حتى الآن. افتح تفاصيل الطلب لرؤية سجلها.</FinancialText> : null}
      {section === "settlements" ? <FinancialText>الفترة بتاريخ إنشاء التسوية؛ المبالغ والحالة تعكس وضعها الحالي.</FinancialText> : null}
      {section === "invoices" || section === "payments" ? <FinancialText>المبالغ المخصصة والمتبقية حالية. المدفوعات المسجلة لا تعني تحققًا مصرفيًا مستقلًا.</FinancialText> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <FinancialCard><Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{error}</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={() => void load()} /></FinancialCard> : null}
      {!loading && !error && data ? <>
        {section === "overview" ? <><FinancialOverview data={data} />{links.map(([title, href]) => <FinancialLink key={href} title={title} href={href} />)}</> : null}
        {section === "sales" ? data.summary.map((row) => <FinancialCard key={String(row.currency)} title={`إجمالي الطلبات المطابقة · ${row.currency}`}><FinancialMetrics row={row} /></FinancialCard>) : null}
        {data.record ? <FinancialRecord row={data.record} section={section} /> : null}
        {section === "sale" ? <FinancialText>سجل التصحيحات والتسويات والدفعات. عكس العمولة وزيادة المستحق الناتجة عنه وجهان للعملية نفسها؛ لا تُجمع مبالغ هذا السجل كمؤشر.</FinancialText> : null}
        {section === "settlement" ? <FinancialText title>الطلبات المشمولة</FinancialText> : null}
        {section !== "overview" ? <>
          {data.rows.map((row, index) => <FinancialRecord key={`${row.event_type ?? "row"}-${row.id ?? row.store_order_id ?? index}`} row={row} section={section} />)}
          {!data.rows.length ? <FinancialText>لا توجد سجلات مطابقة.</FinancialText> : null}
          <Pagination page={page} count={data.count} onChange={(value) => { setLoaded(null); setPage(value); }} />
        </> : null}
        {section === "settlement" ? <>
          <FinancialText title>سجل دفعات المكتب</FinancialText>
          {data.payments.map((row) => <FinancialRecord key={String(row.id)} row={row} section="payments" />)}
          {!data.payments.length ? <FinancialText>لا توجد دفعات مسجلة.</FinancialText> : null}
          <Pagination page={paymentsPage} count={data.payments_count} onChange={(value) => { setLoaded(null); setPaymentsPage(value); }} />
        </> : null}
      </> : null}
    </ScrollView>
  </View>;
}

function FinancialOverview({ data }: { data: MerchantFinancialData }) {
  const subscription = data.subscription;
  return <>
    <FinancialText title>المبيعات والتسويات حسب العملة</FinancialText>
    {data.summary.map((row) => <FinancialCard key={String(row.currency)} title={String(row.currency)}><FinancialMetrics row={row} /></FinancialCard>)}
    {!data.summary.length ? <FinancialText>لا توجد مبيعات مسلّمة أو تسويات مسجلة.</FinancialText> : null}
    <FinancialCard title="اشتراكي الحالي">
      {subscription ? <><FinancialText title>{subscription.plan_name_snapshot}</FinancialText>
        <FinancialText>الحالة: {financialStatus[String(subscription.subscription_status)]}</FinancialText>
        <FinancialText>البداية: {financialDate(subscription.starts_at)}</FinancialText>
        <FinancialText>الانتهاء: {financialDate(subscription.expires_at)}</FinancialText>
        <FinancialText>نسبة عمولة الخطة المحفوظة: {subscription.commission_rate_snapshot == null ? "قيد مراجعة الإدارة" : `${subscription.commission_rate_snapshot}%`}</FinancialText>
        <FinancialText>التجديد التلقائي: {subscription.auto_renew ? "مفعّل" : "غير مفعّل"}. التجديد وتغيير الخطة يديرهما فريق الإدارة.</FinancialText>
      </> : <FinancialText>لا توجد فترة اشتراك بدأت لهذا الحساب.</FinancialText>}
    </FinancialCard>
    <FinancialText title>دفتر التزامات الاشتراك والعمولات</FinancialText>
    <FinancialText>هذا الدفتر منفصل عن تسويات المبيعات؛ لا يُطرح رصيده تلقائيًا من مستحقاتك.</FinancialText>
    {data.obligations.map((row) => <FinancialCard key={String(row.currency)} title={String(row.currency)}><FinancialMetrics row={row} /></FinancialCard>)}
    {!data.obligations.length ? <FinancialText>لا توجد التزامات أو مدفوعات اشتراك مسجلة.</FinancialText> : null}
  </>;
}
function Choice({ title, active, onPress }: { title: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme(); return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.choice, { borderColor: active ? colors.primary : colors.border }]}><Text style={[styles.text, { color: active ? colors.primary : colors.textSecondary }]}>{title}</Text></Pressable>;
}
function Pagination({ page, count, onChange }: { page: number; count: number; onChange: (value: number) => void }) {
  return <><FinancialText>الصفحة {page + 1} · {count} سجل</FinancialText><View style={styles.filters}><AppButton title="السابق" variant="outline" fullWidth={false} disabled={page === 0} onPress={() => onChange(page - 1)} /><AppButton title="التالي" variant="outline" fullWidth={false} disabled={(page + 1) * 20 >= count} onPress={() => onChange(page + 1)} /></View></>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: Spacing.five, paddingBottom: Spacing.ten, gap: Spacing.three, maxWidth: 800, width: "100%", alignSelf: "center" },
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two },
  input: { flex: 1, minWidth: 130, minHeight: 48, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, fontFamily: Fonts.regular, textAlign: "right" },
  choice: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: Radius.md, padding: Spacing.two },
  text: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" },
  error: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 24 },
});
