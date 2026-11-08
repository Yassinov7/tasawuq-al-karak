import { formatSyp } from "@/lib/money";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getManagedSubscriptionPlansInvalidatedAt, loadManagedSubscriptionPlans, setManagedSubscriptionPlanActive, type ManagedSubscriptionPlan, type PlanCurrency } from "@/lib/admin-subscription-plans";

const cacheTtlMs = 15_000;
let cachedPlans: { rows: ManagedSubscriptionPlan[]; updatedAt: number } | null = null;


const money = (value: number, currency: PlanCurrency) => formatSyp(Number(value), currency);
const complete = (plan: Pick<ManagedSubscriptionPlan, "description" | "commission_rate" | "product_limit" | "features">) => Boolean(plan.description.trim()) && plan.commission_rate !== null && plan.product_limit !== null && Boolean(plan.features?.length);

export default function AdminPlansScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const source = from === "more" ? "more" : "finance";
  const [plans, setPlans] = useState<ManagedSubscriptionPlan[]>(() => cachedPlans?.rows ?? []);
  const [loading, setLoading] = useState(() => !cachedPlans);
  const [refreshing, setRefreshing] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async (manual = false) => {
    const invalidated = cachedPlans && getManagedSubscriptionPlansInvalidatedAt() > cachedPlans.updatedAt;
    if (cachedPlans) setPlans(cachedPlans.rows);
    if (!manual && cachedPlans && !invalidated && Date.now() - cachedPlans.updatedAt < cacheTtlMs) { setLoading(false); return; }
    if (cachedPlans) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const rows = await loadManagedSubscriptionPlans();
      cachedPlans = { rows, updatedAt: Date.now() };
      setPlans(rows);
    } catch (requestError) {
      console.warn("Unable to load managed subscription plans", requestError);
      setError("تعذر تحميل خطط الاشتراك. تحقق من اتصال الشبكة وصلاحيات الإدارة ثم أعد المحاولة.");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const activeCount = useMemo(() => plans.filter((plan) => plan.is_active).length, [plans]);

  const toggleActive = async (plan: ManagedSubscriptionPlan) => {
    if (!plan.is_active && !complete(plan)) { setError("لا يمكن تفعيل الخطة قبل استكمال الوصف والعمولة وحد المنتجات والميزات."); return; }
    setChangingId(plan.id); setError("");
    try { await setManagedSubscriptionPlanActive(plan.id, !plan.is_active); await refresh(true); }
    catch (requestError) { console.warn("Unable to change subscription plan activity", requestError); setError("تعذر تغيير حالة الخطة. تحقق من الصلاحيات والاتصال ثم أعد المحاولة."); }
    finally { setChangingId(null); }
  };

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    {loading && !plans.length ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.primary} colors={[colors.primary]} />}>
      <View style={[styles.intro, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}><View style={styles.icon}><AppIcon name="pricetags-outline" size={23} color={colors.primary} /></View><View style={styles.grow}><Text style={[styles.title, { color: colors.text }]}>خطط الاشتراك</Text><Text style={[styles.description, { color: colors.textSecondary }]}>تعديل الخطة لا يغيّر اشتراكًا أو فاتورة أو Snapshot قائمًا. الخطط الناقصة تبقى مسودات ولا تظهر للمتقدمين.</Text></View></View>
      <View style={styles.metrics}><Metric label="خطط نشطة" value={activeCount} /><Metric label="إجمالي الخطط" value={plans.length} /></View>
      <AppButton title="إضافة خطة" icon="add-outline" onPress={() => router.push(`/admin/plan-form?from=${source}`)} />
      {refreshing ? <Text style={[styles.refresh, { color: colors.textSecondary }]}>يتم التحديث في الخلفية…</Text> : null}
      {error ? <View style={[styles.error, { backgroundColor: colors.surfaceSecondary }]}><Text style={[styles.errorText, { color: colors.error }]}>{error}</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={() => void refresh(true)} /></View> : null}
      {!error && !plans.length ? <Text style={[styles.empty, { color: colors.textSecondary, backgroundColor: colors.surfaceSecondary }]}>لا توجد خطط بعد. أضف مسودة مكتملة ثم فعّلها لتصبح متاحة في طلبات انضمام التجار.</Text> : null}
      {plans.map((plan) => <PlanCard key={plan.id} plan={plan} changing={changingId === plan.id} onEdit={() => router.push(`/admin/plan-form?planId=${encodeURIComponent(plan.id)}&from=${source}`)} onToggle={() => void toggleActive(plan)} />)}
    </ScrollView>}
  </View>;
}

function PlanCard({ plan, changing, onEdit, onToggle }: { plan: ManagedSubscriptionPlan; changing: boolean; onEdit: () => void; onToggle: () => void }) {
  const { colors } = useTheme(); const isComplete = complete(plan);
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={styles.cardHeader}><View style={styles.grow}><Text style={[styles.planName, { color: colors.text }]} numberOfLines={1}>{plan.name}</Text><Text style={[styles.meta, { color: colors.textSecondary }]}>{money(plan.price, "SYP")} · {plan.duration_months} شهر</Text></View><Text style={[styles.status, { color: plan.is_active ? colors.success : colors.textMuted, backgroundColor: plan.is_active ? colors.primaryLight : colors.surfaceSecondary }]}>{plan.is_active ? "نشطة" : "مسودة"}</Text></View>
    <View style={styles.terms}><Term label="العمولة" value={plan.commission_rate === null ? "غير محددة" : `${plan.commission_rate}%`} /><Term label="حد المنتجات" value={plan.product_limit === null ? "غير محدد" : String(plan.product_limit)} /></View>
    <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={2}>{plan.description || "لم يُضف وصف للخطة بعد."}</Text>
    {plan.features?.length ? <Text style={[styles.features, { color: colors.textSecondary }]} numberOfLines={2}>{plan.features.join(" · ")}</Text> : null}
    {!isComplete ? <Text style={[styles.incomplete, { color: colors.error }]}>غير مكتملة: لا يمكن تفعيلها أو اختيارها في طلبات التجار.</Text> : null}
    <View style={styles.actions}><AppButton title="تعديل" icon="create-outline" variant="secondary" fullWidth={false} onPress={onEdit} /><AppButton title={plan.is_active ? "إيقاف" : "تفعيل"} variant={plan.is_active ? "outline" : "primary"} fullWidth={false} loading={changing} onPress={onToggle} /></View>
  </View>;
}

function Metric({ label, value }: { label: string; value: number }) { const { colors } = useTheme(); return <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.metricValue, { color: colors.primary }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text></View>; }
function Term({ label, value }: { label: string; value: string }) { const { colors } = useTheme(); return <View style={styles.term}><Text style={[styles.termLabel, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.termValue, { color: colors.text }]}>{value}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, content: { width: "100%", maxWidth: 800, alignSelf: "center", padding: Spacing.five, paddingBottom: Spacing.ten, gap: Spacing.three }, intro: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, flexDirection: "row-reverse", gap: Spacing.three, alignItems: "flex-start" }, icon: { width: 42, height: 42, borderRadius: Radius.full, alignItems: "center", justifyContent: "center" }, grow: { flex: 1 }, title: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" }, description: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 23 }, metrics: { flexDirection: "row-reverse", gap: Spacing.three }, metric: { flex: 1, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.three, alignItems: "center", gap: Spacing.one }, metricValue: { fontFamily: Fonts.bold, fontSize: FontSizes.xl }, metricLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.xs }, refresh: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }, error: { padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.three }, errorText: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 }, empty: { borderRadius: Radius.md, padding: Spacing.four, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 23 }, card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.three }, cardHeader: { flexDirection: "row-reverse", gap: Spacing.three, alignItems: "center" }, planName: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" }, meta: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", lineHeight: 21 }, status: { fontFamily: Fonts.bold, fontSize: FontSizes.xs, borderRadius: Radius.full, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }, terms: { flexDirection: "row-reverse", gap: Spacing.four }, term: { flexDirection: "row-reverse", gap: Spacing.two, alignItems: "center" }, termLabel: { fontFamily: Fonts.regular, fontSize: FontSizes.xs }, termValue: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs }, features: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", lineHeight: 21 }, incomplete: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "right", lineHeight: 20 }, actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two },
});
