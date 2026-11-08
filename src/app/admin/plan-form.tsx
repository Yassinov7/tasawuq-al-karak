import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { loadManagedSubscriptionPlan, saveManagedSubscriptionPlan } from "@/lib/admin-subscription-plans";

type FieldErrors = Partial<Record<"name" | "description" | "duration" | "price" | "commission" | "limit" | "features", string>>;

const parseDecimal = (value: string) => Number(value.trim().replace(",", "."));
const finiteWithPrecision = (value: number, precision: number) => Number.isFinite(value) && value === Number(value.toFixed(precision));

export default function AdminPlanFormScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { planId: rawPlanId } = useLocalSearchParams<{ planId?: string | string[] }>();
  const planId = Array.isArray(rawPlanId) ? rawPlanId[0] : rawPlanId;
  const editing = Boolean(planId);
  const [initialLoading, setInitialLoading] = useState(editing);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("1");
  const [price, setPrice] = useState("");
  const [commission, setCommission] = useState("");
  const [productLimit, setProductLimit] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [featureDraft, setFeatureDraft] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");

  const load = useCallback(async () => {
    if (!planId) return;
    setInitialLoading(true); setLoadError("");
    try {
      const plan = await loadManagedSubscriptionPlan(planId);
      setName(plan.name); setDescription(plan.description); setDuration(String(plan.duration_months));
      setPrice(String(plan.price)); setCommission(plan.commission_rate === null ? "" : String(plan.commission_rate));
      setProductLimit(plan.product_limit === null ? "" : String(plan.product_limit)); setFeatures(plan.features ?? []); setIsActive(plan.is_active);
    } catch (requestError) {
      console.warn("Unable to load subscription plan for editing", requestError);
      setLoadError("تعذر تحميل الخطة. قد تكون غير متاحة أو لا تملك صلاحية مراجعتها.");
    } finally { setInitialLoading(false); }
  }, [planId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const formComplete = useMemo(() => Boolean(description.trim()) && commission.trim() !== "" && productLimit.trim() !== "" && features.length > 0, [commission, description, features.length, productLimit]);
  const addFeature = () => {
    const value = featureDraft.trim();
    if (!value) return;
    if (!features.includes(value)) setFeatures((current) => [...current, value]);
    setFeatureDraft("");
  };

  const save = async () => {
    Keyboard.dismiss(); setSubmitError("");
    const nextErrors: FieldErrors = {};
    const durationValue = Number(duration);
    const priceValue = parseDecimal(price);
    const commissionValue = commission.trim() === "" ? null : parseDecimal(commission);
    const productLimitValue = productLimit.trim() === "" ? null : Number(productLimit);
    if (name.trim().length < 2 || name.trim().length > 80) nextErrors.name = "أدخل اسمًا بين حرفين و80 حرفًا.";
    if (!Number.isInteger(durationValue) || durationValue < 1 || durationValue > 60) nextErrors.duration = "المدة من شهر إلى 60 شهرًا.";
    if (!finiteWithPrecision(priceValue, 2) || priceValue <= 0) nextErrors.price = "أدخل رسومًا موجبة بمنزلتين عشريتين كحد أقصى.";
    if (commissionValue !== null && (!finiteWithPrecision(commissionValue, 4) || commissionValue < 0 || commissionValue > 100)) nextErrors.commission = "النسبة من 0 إلى 100 وبحد أقصى أربع منازل عشرية.";
    if (productLimitValue !== null && (!Number.isInteger(productLimitValue) || productLimitValue < 0)) nextErrors.limit = "أدخل عددًا صحيحًا يساوي صفرًا أو أكبر.";
    if (isActive) {
      if (!description.trim()) nextErrors.description = "الوصف مطلوب لتفعيل الخطة.";
      if (commissionValue === null) nextErrors.commission = "نسبة العمولة مطلوبة لتفعيل الخطة، ويُقبل 0%.";
      if (productLimitValue === null) nextErrors.limit = "حد المنتجات مطلوب لتفعيل الخطة.";
      if (!features.length) nextErrors.features = "أضف ميزة واحدة على الأقل لتفعيل الخطة.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      await saveManagedSubscriptionPlan({ name: name.trim(), description: description.trim(), durationMonths: durationValue, price: priceValue, commissionRate: commissionValue, productLimit: productLimitValue, features, isActive }, planId);
      Alert.alert("تم الحفظ", editing ? "تم حفظ تعديلات الخطة. لا تتغير الاشتراكات أو الفواتير أو اللقطات السابقة." : "تم إنشاء الخطة كمسودة أو خطة نشطة بحسب الإعدادات.", [{ text: "حسنًا", onPress: () => router.back() }]);
    } catch (requestError) {
      console.warn("Unable to save subscription plan", requestError);
      const message = requestError instanceof Error ? requestError.message : "";
      setSubmitError(message.includes("active subscription plan") ? "لا يمكن تفعيل خطة غير مكتملة الشروط المطلوبة للتسجيل." : "تعذر حفظ الخطة. احتفظنا بالمدخلات؛ تحقق من البيانات والصلاحيات ثم أعد المحاولة.");
    } finally { setSaving(false); }
  };

  if (initialLoading) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.loading, { color: colors.textSecondary }]}>يتم تحميل بيانات الخطة…</Text></View>;
  if (loadError) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.errorText, { color: colors.error }]}>{loadError}</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={() => void load()} /></View>;

  return <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={[styles.notice, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}><AppIcon name="information-circle-outline" size={20} color={colors.primary} /><Text style={[styles.noticeText, { color: colors.textSecondary }]}>تُحفظ شروط الخطة الجديدة فقط؛ الاشتراكات وطلبات التجار السابقة تحتفظ باللقطات المسجلة لها.</Text></View>
      <Section title="البيانات الأساسية"><AppTextField label="اسم الخطة" value={name} onChangeText={setName} maxLength={80} error={errors.name} /><AppTextField label="وصف الخطة" value={description} onChangeText={setDescription} multiline error={errors.description} helperText="يظهر للمتقدم عند اختيار الخطة." /><Choice label="الحالة" value={isActive ? "active" : "draft"} values={[["draft", "مسودة"], ["active", "نشطة"]]} onChange={(value) => setIsActive(value === "active")} /></Section>
      <Section title="الرسوم والعمولة"><AppTextField label="رسوم الاشتراك" value={price} onChangeText={setPrice} keyboardType="decimal-pad" error={errors.price} placeholder="0" /><AppTextField label="نسبة العمولة (%)" value={commission} onChangeText={setCommission} keyboardType="decimal-pad" error={errors.commission} helperText="يسمح بـ 0% عند تحديدها صراحة." /></Section>
      <Section title="المدة والحدود"><AppTextField label="المدة بالأشهر" value={duration} onChangeText={setDuration} keyboardType="number-pad" error={errors.duration} /><AppTextField label="حد المنتجات" value={productLimit} onChangeText={setProductLimit} keyboardType="number-pad" error={errors.limit} helperText="اكتب 0 عند عدم السماح بإضافة منتجات." /></Section>
      <Section title="المزايا"><AppTextField label="إضافة ميزة" value={featureDraft} onChangeText={setFeatureDraft} onSubmitEditing={addFeature} returnKeyType="done" placeholder="مثال: دعم فني" /><AppButton title="إضافة الميزة" icon="add-outline" variant="secondary" onPress={addFeature} disabled={!featureDraft.trim()} />{features.length ? <View style={styles.chips}>{features.map((feature) => <Pressable key={feature} accessibilityRole="button" accessibilityLabel={`حذف ميزة ${feature}`} onPress={() => setFeatures((current) => current.filter((item) => item !== feature))} style={[styles.chip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><AppIcon name="close-outline" size={15} color={colors.textSecondary} /><Text style={[styles.chipText, { color: colors.text }]}>{feature}</Text></Pressable>)}</View> : <Text style={[styles.helper, { color: errors.features ? colors.error : colors.textMuted }]}>{errors.features ?? "أضف الميزات كعناصر مستقلة لتسهيل مراجعتها."}</Text>}</Section>
      {isActive && !formComplete ? <View style={[styles.incomplete, { backgroundColor: colors.surfaceSecondary }]}><Text style={[styles.helper, { color: colors.error }]}>لا يمكن حفظ الخطة نشطة قبل استكمال الوصف والعمولة وحد المنتجات والميزات.</Text></View> : null}
      {submitError ? <View style={[styles.submitError, { backgroundColor: colors.surfaceSecondary }]}><Text style={[styles.errorText, { color: colors.error }]}>{submitError}</Text></View> : null}
      <AppButton title={editing ? "حفظ التعديلات" : "إنشاء الخطة"} icon="checkmark-outline" loading={saving} disabled={saving} onPress={() => void save()} />
      <AppButton title="إلغاء" variant="outline" disabled={saving} onPress={() => router.back()} />
    </ScrollView>
  </KeyboardAvoidingView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { const { colors } = useTheme(); return <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>{children}</View>; }
function Choice({ label, value, values, onChange }: { label: string; value: string; values: [string, string][]; onChange: (value: string) => void }) { const { colors } = useTheme(); return <View style={styles.choiceGroup}><Text style={[styles.choiceLabel, { color: colors.text }]}>{label}</Text><View style={styles.choiceRow}>{values.map(([key, title]) => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected: key === value }} onPress={() => onChange(key)} style={[styles.choice, { borderColor: key === value ? colors.primary : colors.border, backgroundColor: key === value ? colors.primaryLight : colors.surface }]}><Text style={[styles.choiceText, { color: key === value ? colors.primary : colors.textSecondary }]}>{title}</Text></Pressable>)}</View></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, padding: Spacing.five, gap: Spacing.three, justifyContent: "center" }, loading: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center" }, content: { width: "100%", maxWidth: 800, alignSelf: "center", padding: Spacing.five, paddingBottom: Spacing.ten, gap: Spacing.three }, notice: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.three, flexDirection: "row-reverse", gap: Spacing.two, alignItems: "flex-start" }, noticeText: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", lineHeight: 21 }, section: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four }, sectionTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" }, choiceGroup: { marginTop: Spacing.four, gap: Spacing.two }, choiceLabel: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" }, choiceRow: { flexDirection: "row-reverse", gap: Spacing.two }, choice: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.two }, choiceText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm }, chips: { marginTop: Spacing.three, flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two }, chip: { minHeight: 38, flexDirection: "row-reverse", alignItems: "center", gap: Spacing.one, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.three }, chipText: { fontFamily: Fonts.medium, fontSize: FontSizes.xs }, helper: { marginTop: Spacing.three, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", lineHeight: 20 }, incomplete: { borderRadius: Radius.md, padding: Spacing.three }, submitError: { borderRadius: Radius.md, padding: Spacing.three }, errorText: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 },
});
