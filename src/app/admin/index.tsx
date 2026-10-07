import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type Role = "driver" | "merchant";
type RequestRow = { id: string; user_id: string; full_name?: string; contact_phone: string; vehicle_type?: string; contract_duration_months?: number; available_hours?: { schedule?: string }; store_name?: string; store_address?: string; store_categories?: { name: string } | { name: string }[] | null; plan_name_snapshot?: string; plan_price_snapshot?: number; plan_currency_snapshot?: string; status: string; submitted_at: string; review_note?: string | null };
type Profile = { id: string; full_name: string; email: string; role: string };
type Wallet = { user_id: string; currency: "SYP" | "USD"; balance: number };
type Plan = { id: string; name: string; duration_months: number; price: number; currency: "SYP" | "USD"; description: string; is_active: boolean };
type TransactionTarget = { profile: Profile; currency: "SYP" | "USD"; balance: number };
const statusName: Record<string, string> = { pending: "قيد المراجعة", accepted: "مقبول", rejected: "مرفوض", changes_requested: "معلومات إضافية" };
const currencyName = (currency: string) => currency === "USD" ? "دولار" : "ل.س";

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth(); const { colors } = useTheme();
  const [section, setSection] = useState<"requests" | "finance">("requests"); const [requestRole, setRequestRole] = useState<Role>("merchant"); const [financeView, setFinanceView] = useState<"wallets" | "plans">("wallets");
  const [merchantRequests, setMerchantRequests] = useState<RequestRow[]>([]); const [driverRequests, setDriverRequests] = useState<RequestRow[]>([]); const [profiles, setProfiles] = useState<Profile[]>([]); const [wallets, setWallets] = useState<Wallet[]>([]); const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<{ role: Role; row: RequestRow; decision: "accepted" | "rejected" | "changes_requested" } | null>(null); const [reviewNote, setReviewNote] = useState("");
  const [walletTarget, setWalletTarget] = useState<TransactionTarget | null>(null); const [operation, setOperation] = useState<"funding" | "settlement" | "adjustment">("funding"); const [direction, setDirection] = useState<"credit" | "debit">("credit"); const [amount, setAmount] = useState(""); const [note, setNote] = useState("");
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null); const [planName, setPlanName] = useState(""); const [planDuration, setPlanDuration] = useState("1"); const [planPrice, setPlanPrice] = useState(""); const [planCurrency, setPlanCurrency] = useState<"SYP" | "USD">("SYP"); const [planDescription, setPlanDescription] = useState("");
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setRefreshing(true);
    const [m, d, p, w, sp] = await Promise.all([
      supabase.from("merchant_applications").select("id,user_id,contact_phone,store_name,store_address,store_categories(name),plan_name_snapshot,plan_price_snapshot,plan_currency_snapshot,status,submitted_at,review_note").order("submitted_at", { ascending: false }),
      supabase.from("driver_applications").select("id,user_id,full_name,contact_phone,vehicle_type,contract_duration_months,available_hours,status,submitted_at,review_note").order("submitted_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,email,role").order("created_at", { ascending: false }),
      supabase.from("wallets").select("user_id,currency,balance").order("updated_at", { ascending: false }),
      supabase.from("subscription_plans").select("id,name,duration_months,price,currency,description,is_active").order("duration_months"),
    ]);
    const anyError = m.error ?? d.error ?? p.error ?? w.error ?? sp.error;
    if (anyError) setError("تعذر تحميل بعض بيانات الإدارة. تحقق من صلاحيات الحساب واتصال قاعدة البيانات.");
    setMerchantRequests((m.data ?? []) as RequestRow[]); setDriverRequests((d.data ?? []) as RequestRow[]); setProfiles((p.data ?? []) as Profile[]); setWallets((w.data ?? []) as Wallet[]); setPlans((sp.data ?? []) as Plan[]); setLoading(false); setRefreshing(false);
  }, []);
  useEffect(() => { const timer = setTimeout(() => void refresh(false), 0); return () => clearTimeout(timer); }, [refresh]);

  const review = async () => {
    if (!selectedRequest || !user) return;
    setBusy(true);
    const rpc = selectedRequest.role === "merchant" ? "review_merchant_application" : "review_driver_application";
    const { error: rpcError } = await supabase.rpc(rpc, { target_application: selectedRequest.row.id, decision: selectedRequest.decision, decision_note: reviewNote.trim() || undefined });
    setBusy(false);
    if (rpcError) { setError("تعذر حفظ قرار المراجعة. تأكد من أن حسابك مسؤول وأن الترحيل مطبق."); return; }
    setSelectedRequest(null); setReviewNote(""); setMessage(selectedRequest.decision === "accepted" ? "تمت الموافقة وإنشاء المحفظة المطلوبة." : "تم حفظ قرار المراجعة وملاحظته."); await refresh(false);
  };

  const saveWalletOperation = async () => {
    if (!walletTarget || !amount.trim()) return setError("أدخل قيمة العملية.");
    const numericAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || Math.round(numericAmount * 100) !== numericAmount * 100) return setError("أدخل مبلغًا صحيحًا حتى منزلتين عشريتين.");
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("record_wallet_transaction", { target_user: walletTarget.profile.id, target_currency: walletTarget.currency, operation, operation_direction: direction, operation_amount: numericAmount, operation_note: note.trim() || undefined });
    setBusy(false);
    if (rpcError) { setError(rpcError.message.includes("exceeds") ? "المبلغ أكبر من الرصيد المتاح للتسوية." : "تعذر حفظ العملية المالية."); return; }
    setWalletTarget(null); setAmount(""); setNote(""); setMessage("تم تسجيل العملية وتحديث الرصيد وسجل التدقيق."); await refresh(false);
  };

  const beginPlan = (plan?: Plan) => { setEditingPlan(plan ?? null); setPlanName(plan?.name ?? ""); setPlanDuration(String(plan?.duration_months ?? 1)); setPlanPrice(plan ? String(plan.price) : ""); setPlanCurrency(plan?.currency ?? "SYP"); setPlanDescription(plan?.description ?? ""); setPlanModalOpen(true); };
  const savePlan = async () => {
    const months = Number(planDuration); const cost = Number(planPrice.replace(",", "."));
    if (!planName.trim() || !Number.isInteger(months) || months < 1 || months > 60 || !Number.isFinite(cost) || cost <= 0) return setError("تحقق من اسم الخطة ومدتها وسعرها.");
    setBusy(true);
    const query = editingPlan ? supabase.from("subscription_plans").update({ name: planName.trim(), duration_months: months, price: cost, currency: planCurrency, description: planDescription.trim() }).eq("id", editingPlan.id) : supabase.from("subscription_plans").insert({ name: planName.trim(), duration_months: months, price: cost, currency: planCurrency, description: planDescription.trim() });
    const { error: planError } = await query;
    setBusy(false);
    if (planError) { setError("تعذر حفظ الخطة. تحقق من صلاحيات المسؤول."); return; }
    setEditingPlan(null); setPlanModalOpen(false); setMessage("تم حفظ خطة الاشتراك."); await refresh(false);
  };
  const togglePlan = async (plan: Plan) => { const { error: planError } = await supabase.from("subscription_plans").update({ is_active: !plan.is_active }).eq("id", plan.id); if (planError) setError("تعذر تغيير حالة الخطة."); else await refresh(false); };

  const getProfile = (id: string) => profiles.find((profile) => profile.id === id);
  const requestRows = requestRole === "merchant" ? merchantRequests : driverRequests;
  const transactionTitle = operation === "funding" ? "تمويل" : operation === "settlement" ? "تسوية" : "تعديل";

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: colors.text }]}>إدارة المنصة</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>طلبات الانتساب وحسابات المحافظ وخطط الاشتراك في مكان واحد.</Text>
      <View style={[styles.tabs, { backgroundColor: colors.surfaceSecondary }]}>{([ ["requests", "الطلبات"], ["finance", "المالية والمحافظ"] ] as const).map(([key, label]) => <Pressable key={key} onPress={() => setSection(key)} style={[styles.tab, section === key && { backgroundColor: colors.surface }]}><Text style={[styles.tabText, { color: section === key ? colors.primary : colors.textSecondary }]}>{label}</Text></Pressable>)}</View>
      {section === "requests" ? <>
        <View style={styles.metrics}><Metric label="طلبات التجار" value={merchantRequests.filter((r) => r.status === "pending").length} /><Metric label="طلبات السائقين" value={driverRequests.filter((r) => r.status === "pending").length} /></View>
        <View style={styles.subTabs}>{([ ["merchant", "طلبات التجار"], ["driver", "طلبات السائقين"] ] as const).map(([key, label]) => <Pressable key={key} onPress={() => setRequestRole(key)} style={[styles.subTab, { borderColor: requestRole === key ? colors.primary : colors.border, backgroundColor: requestRole === key ? colors.primaryLight : colors.surface }]}><Text style={{ color: requestRole === key ? colors.primary : colors.textSecondary, fontFamily: Fonts.semiBold }}>{label}</Text></Pressable>)}</View>
        {!requestRows.length ? <Empty text="لا توجد طلبات في هذا القسم بعد." /> : requestRows.map((row) => <RequestCard key={row.id} row={row} role={requestRole} profile={getProfile(row.user_id)} onDecision={(decision) => { setSelectedRequest({ role: requestRole, row, decision }); setReviewNote(""); }} />)}
      </> : <>
        <View style={styles.subTabs}>{([ ["wallets", "المحافظ والعمليات"], ["plans", "خطط المتاجر"] ] as const).map(([key, label]) => <Pressable key={key} onPress={() => setFinanceView(key)} style={[styles.subTab, { borderColor: financeView === key ? colors.primary : colors.border, backgroundColor: financeView === key ? colors.primaryLight : colors.surface }]}><Text style={{ color: financeView === key ? colors.primary : colors.textSecondary, fontFamily: Fonts.semiBold }}>{label}</Text></Pressable>)}</View>
        {financeView === "wallets" ? <>{wallets.length ? wallets.map((wallet) => { const profile = getProfile(wallet.user_id); if (!profile) return null; return <View key={`${wallet.user_id}-${wallet.currency}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{profile.full_name}</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{profile.role === "merchant" ? "تاجر" : profile.role === "driver" ? "سائق" : profile.role} · {profile.email}</Text></View><Text style={[styles.walletBalance, { color: colors.primary }]}>{Number(wallet.balance).toLocaleString("ar-SY")} {currencyName(wallet.currency)}</Text></View><AppButton title="تسجيل عملية مالية" icon="swap-horizontal-outline" onPress={() => { setWalletTarget({ profile, currency: wallet.currency, balance: Number(wallet.balance) }); setOperation("funding"); setDirection("credit"); }} /></View>; }) : <Empty text="لا توجد محافظ حتى الآن. تُنشأ محفظة السائق أو التاجر عند الموافقة على الطلب." />}</> : <><AppButton title="إضافة خطة اشتراك" icon="add-outline" onPress={() => beginPlan()} />{plans.length ? plans.map((plan) => <View key={plan.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{plan.name} · {plan.duration_months} شهر</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{Number(plan.price).toLocaleString("ar-SY")} {currencyName(plan.currency)} · {plan.is_active ? "متاحة" : "متوقفة"}</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{plan.description || "بدون وصف"}</Text></View></View><View style={styles.actions}><AppButton title="تعديل" variant="outline" onPress={() => beginPlan(plan)} /><AppButton title={plan.is_active ? "إيقاف الخطة" : "تفعيل الخطة"} variant={plan.is_active ? "danger" : "secondary"} onPress={() => void togglePlan(plan)} /></View></View>) : <Empty text="أضف خطة واحدة على الأقل حتى يتمكن التاجر من تقديم طلبه." />}</>}
      </>}
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      <AppButton title={refreshing ? "جارٍ التحديث…" : "تحديث البيانات"} variant="outline" onPress={() => void refresh()} loading={refreshing} />
      <AppButton title="تسجيل الخروج" variant="outline" onPress={async () => { await supabase.auth.signOut(); router.replace("/login"); }} />
    </ScrollView>

    <AppModal visible={Boolean(selectedRequest)} title={selectedRequest?.decision === "accepted" ? "تأكيد الموافقة" : selectedRequest?.decision === "rejected" ? "رفض الطلب" : "طلب استكمال معلومات"} message={selectedRequest?.decision === "accepted" ? "سيتم اعتماد الحساب وإنشاء المتجر أو محفظة السائق حسب نوع الطلب." : "أضف ملاحظة واضحة لتظهر لصاحب الطلب."} confirmText={selectedRequest?.decision === "accepted" ? "موافقة" : "حفظ القرار"} cancelText="رجوع" busy={busy} onCancel={() => setSelectedRequest(null)} onConfirm={() => void review()}>{selectedRequest?.decision !== "accepted" ? <AppTextField label="ملاحظة للإجابة أو سبب الرفض" value={reviewNote} onChangeText={setReviewNote} multiline placeholder="اكتب ملاحظة مفيدة لصاحب الطلب" /> : null}</AppModal>

    <AppModal visible={Boolean(walletTarget)} title={`عملية ${transactionTitle}`} message={`${walletTarget?.profile.full_name ?? ""} · الرصيد الحالي ${walletTarget?.balance.toLocaleString("ar-SY")} ${walletTarget ? currencyName(walletTarget.currency) : ""}`} confirmText="حفظ العملية" cancelText="إلغاء" busy={busy} onCancel={() => setWalletTarget(null)} onConfirm={() => void saveWalletOperation()}>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      <Choice label="نوع العملية" values={[["funding", "تمويل"], ["settlement", "تسوية"], ["adjustment", "تعديل"]]} value={operation} onChange={(value) => { const next = value as typeof operation; setOperation(next); setDirection(next === "settlement" ? "debit" : "credit"); }} />
      <Choice label="اتجاه القيد" values={[["credit", "إضافة إلى المحفظة"], ["debit", "خصم من المحفظة"]]} value={direction} onChange={(value) => setDirection(value as typeof direction)} />
      <AppTextField label="المبلغ" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
      <AppTextField label="ملاحظة وتفاصيل العملية" value={note} onChangeText={setNote} multiline placeholder="سبب التمويل أو تفاصيل التسوية" />
    </AppModal>

    <AppModal visible={planModalOpen} title={editingPlan ? "تعديل خطة" : "خطة اشتراك جديدة"} confirmText="حفظ الخطة" cancelText="إلغاء" busy={busy} onCancel={() => { setEditingPlan(null); setPlanModalOpen(false); }} onConfirm={() => void savePlan()}>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      <AppTextField label="اسم الخطة" value={planName} onChangeText={setPlanName} />
      <AppTextField label="مدة الخطة بالأشهر" value={planDuration} onChangeText={setPlanDuration} keyboardType="number-pad" />
      <AppTextField label="السعر" value={planPrice} onChangeText={setPlanPrice} keyboardType="decimal-pad" />
      <Choice label="العملة" values={[["SYP", "ليرة سورية"], ["USD", "دولار"]]} value={planCurrency} onChange={(value) => setPlanCurrency(value as typeof planCurrency)} />
      <AppTextField label="وصف الخطة" value={planDescription} onChangeText={setPlanDescription} multiline />
    </AppModal>

    <AppModal visible={Boolean(message)} title="تمت العملية" message={message} onCancel={() => setMessage("")} />
    <AppModal visible={Boolean(error && !selectedRequest && !walletTarget && editingPlan === null)} title="تعذر إكمال العملية" message={error} onCancel={() => setError("")} />
  </View>;
}

function Metric({ label, value }: { label: string; value: number }) { const { colors } = useTheme(); return <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.metricValue, { color: colors.primary }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text></View>; }
function Empty({ text }: { text: string }) { const { colors } = useTheme(); return <Text style={[styles.empty, { backgroundColor: colors.surfaceSecondary, color: colors.textSecondary }]}>{text}</Text>; }
function RequestCard({ row, role, profile, onDecision }: { row: RequestRow; role: Role; profile?: Profile; onDecision: (decision: "accepted" | "rejected" | "changes_requested") => void }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{role === "merchant" ? row.store_name : row.full_name || profile?.full_name || "طلب سائق"}</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{profile?.email ?? ""} · {row.contact_phone}</Text></View><Text style={[styles.badge, { color: row.status === "accepted" ? colors.success : colors.accent, backgroundColor: colors.surfaceSecondary }]}>{statusName[row.status] ?? row.status}</Text></View>
    {role === "merchant" ? <><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>تصنيف المتجر: {(Array.isArray(row.store_categories) ? row.store_categories[0]?.name : row.store_categories?.name) ?? "غير محدد"} · العنوان: {row.store_address}</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>الخطة: {row.plan_name_snapshot} · {Number(row.plan_price_snapshot ?? 0).toLocaleString("ar-SY")} {currencyName(row.plan_currency_snapshot ?? "SYP")}</Text></> : <><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>المركبة: {row.vehicle_type} · العقد: {row.contract_duration_months} أشهر</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>الأوقات المتاحة: {row.available_hours?.schedule ?? "غير محددة"}</Text></>}
    <Text style={[styles.cardMeta, { color: colors.textMuted }]}>تاريخ الطلب: {new Date(row.submitted_at).toLocaleDateString("ar-SY")}</Text>{row.review_note ? <Text style={[styles.cardNote, { color: colors.textSecondary, backgroundColor: colors.surfaceSecondary }]}>{row.review_note}</Text> : null}
    {row.status !== "accepted" ? <View style={styles.actions}><AppButton title="موافقة" icon="checkmark-outline" onPress={() => onDecision("accepted")} /><AppButton title="استكمال" variant="outline" onPress={() => onDecision("changes_requested")} /><AppButton title="رفض" variant="danger" onPress={() => onDecision("rejected")} /></View> : null}
  </View>;
}
function Choice({ label, values, value, onChange }: { label: string; values: [string, string][]; value: string; onChange: (value: string) => void }) { const { colors } = useTheme(); return <View style={{ marginTop: Spacing.three, gap: Spacing.two }}><Text style={{ color: colors.text, textAlign: "right", fontFamily: Fonts.semiBold }}>{label}</Text><View style={styles.choiceRow}>{values.map(([key, title]) => <Pressable key={key} onPress={() => onChange(key)} style={[styles.choice, { borderColor: key === value ? colors.primary : colors.border, backgroundColor: key === value ? colors.primaryLight : colors.surface }]}><Text style={{ color: key === value ? colors.primary : colors.textSecondary, fontFamily: Fonts.semiBold, fontSize: FontSizes.xs }}>{title}</Text></Pressable>)}</View></View>; }

const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, justifyContent: "center" }, container: { padding: Spacing.five, paddingBottom: Spacing.ten, maxWidth: 900, width: "100%", alignSelf: "center", gap: Spacing.three }, title: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, textAlign: "right" }, subtitle: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 23 }, tabs: { flexDirection: "row-reverse", borderRadius: Radius.lg, padding: Spacing.one }, tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 46, borderRadius: Radius.md }, tabText: { fontFamily: Fonts.bold, fontSize: FontSizes.sm }, metrics: { flexDirection: "row-reverse", gap: Spacing.three }, metric: { flex: 1, borderWidth: 1, padding: Spacing.three, borderRadius: Radius.lg, alignItems: "center", gap: Spacing.one }, metricValue: { fontFamily: Fonts.bold, fontSize: FontSizes.xl }, metricLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.xs }, subTabs: { flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" }, subTab: { minHeight: 40, paddingHorizontal: Spacing.three, justifyContent: "center", borderRadius: Radius.full, borderWidth: 1 }, card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two }, row: { flexDirection: "row-reverse", alignItems: "center", gap: Spacing.three }, cardTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" }, cardMeta: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", lineHeight: 21 }, badge: { fontFamily: Fonts.bold, fontSize: FontSizes.xs, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.full }, cardNote: { textAlign: "right", padding: Spacing.two, borderRadius: Radius.sm, fontFamily: Fonts.regular, lineHeight: 21 }, actions: { flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" }, walletBalance: { fontFamily: Fonts.bold, fontSize: FontSizes.md }, empty: { padding: Spacing.four, borderRadius: Radius.md, textAlign: "right", fontFamily: Fonts.regular, lineHeight: 24 }, choiceRow: { flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" }, choice: { flexGrow: 1, minHeight: 40, paddingHorizontal: Spacing.two, borderWidth: 1, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" }, error: { padding: Spacing.three, borderRadius: Radius.md, textAlign: "right", fontFamily: Fonts.medium } });
