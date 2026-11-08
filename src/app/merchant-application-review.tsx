import { formatSypNumber } from "@/lib/money";
import { type Href, useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";
import { OnboardingFrame } from "@/components/auth/OnboardingFrame";
import { AppButton } from "@/components/ui/AppButton";
import { LayoutSpacing, Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { invalidateLocalCache, readLocalCache } from "@/lib/local-cache";
import { applicationPlanReady, merchantDraftKey, merchantPlanColumns, validateMerchantDraft, type ApplicationCategory, type ApplicationDraft, type ApplicationPlan } from "@/lib/merchant-application-draft";
import { supabase } from "@/lib/supabase";

type Review = { plan: ApplicationPlan; category: ApplicationCategory };
const planTerms = (plan: ApplicationPlan) => JSON.stringify([plan.id, plan.name, plan.description, plan.duration_months, plan.price, "SYP", plan.commission_rate, plan.product_limit, plan.features]);

export default function MerchantApplicationReviewScreen() {
  const { user } = useAuth();
  return <ReviewForm key={user?.id ?? "guest"} />;
}
function ReviewForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const columns = Math.min(width - LayoutSpacing.pageGutter * 2, 720) >= 320 && fontScale <= 1.2;
  const [draft, setDraft] = useState<ApplicationDraft | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const key = user ? merchantDraftKey(user.id) : "";
  const edit = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace("/merchant-application" as Href); }, [router]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => { if (!busy) edit(); return true; });
    return () => listener.remove();
  }, [busy, edit]));
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!key) { if (active) { setError("سجّل الدخول لعرض مسودتك."); setLoading(false); } return; }
      const [saved, proof] = await Promise.all([readLocalCache<ApplicationDraft>(key), readLocalCache<Review>(key + ":review")]);
      if (!active) return;
      if (!saved || !proof?.plan || !proof.category || Object.keys(validateMerchantDraft(saved)).length) setError("لا توجد مسودة مكتملة للمراجعة. عد إلى النموذج.");
      else { setDraft(saved); setReview(proof); }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [key]);
  const submit = async () => {
    if (!user || !draft || !review || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      // Resolve a prior ambiguous submission before attempting another write.
      const existing = await supabase.from("merchant_applications").select("id,status").eq("user_id", user.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data || ["changes_requested", "rejected"].includes(existing.data.status)) {
        const [plan, category] = await Promise.all([
          supabase.from("subscription_plans").select(merchantPlanColumns).eq("id", draft.planId).eq("is_active", true).maybeSingle(),
          supabase.from("store_categories").select("id,name").eq("id", draft.categoryId).eq("is_active", true).maybeSingle(),
        ]);
        if (plan.error || category.error) throw plan.error ?? category.error;
        if (!plan.data || !category.data || !applicationPlanReady(plan.data) || planTerms(plan.data) !== planTerms(review.plan) || category.data.name !== review.category.name || category.data.id !== review.category.id) {
          setError("تغيرت الخطة أو التصنيف المتاح. عد للتعديل وراجع الاختيار قبل التأكيد."); return;
        }
        const identity = await supabase.auth.getUser();
        if (identity.error || identity.data.user?.id !== user.id) throw new Error("session-changed");
        const result = await supabase.rpc("submit_merchant_application", {
          selected_plan: draft.planId, selected_store_category: draft.categoryId,
          input_contact_phone: draft.phone.trim(), input_store_name: draft.store.trim(),
          input_store_description: draft.description.trim(), input_store_address: draft.address.trim(),
        });
        if (result.error) throw result.error;
      }
      await invalidateLocalCache(key); await invalidateLocalCache(key + ":review");
      router.replace("/application-status");
    } catch { setError("تعذر تأكيد تقديم الطلب. احتفظنا بالمسودة؛ أعد المحاولة لنتحقق من حالة الطلب أولًا."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <OnboardingFrame title="مراجعة طلب المتجر — ٢ من ٢">
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: LayoutSpacing.pageGutter, gap: LayoutSpacing.cardGap, width: "100%", maxWidth: 752, alignSelf: "center" }}>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text accessibilityRole="alert" style={[Typography.body, { color: colors.errorForeground, textAlign: "right" }]}>{error}</Text> : null}
      {draft && review ? <>
        <Text accessibilityRole="alert" style={[Typography.bodyStrong, { color: colors.warningForeground, backgroundColor: colors.warningSurface, padding: 12, borderRadius: 12, textAlign: "right" }]}>{busy ? "جارٍ تأكيد تقديم الطلب…" : error ? "راجع الرسالة وحالة الطلب قبل إعادة المحاولة" : "مراجعة فقط — لم يُرسل الطلب بعد"}</Text>
        <View style={{ padding: LayoutSpacing.compactCardPadding, gap: 8, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle }}>
          <Text style={[Typography.cardTitle, { color: colors.primary, textAlign: "right" }]}>المتقدم والمتجر</Text>
          <GridRow columns={columns}>
            <Line label="اسم المتقدم" value={typeof user?.user_metadata.full_name === "string" ? user.user_metadata.full_name : "غير متاح"} />
            <Line label="اسم المتجر" value={draft.store} />
          </GridRow>
          <GridRow columns={columns}>
            <Line label="تصنيف المتجر" value={review.category.name} />
            <Line label="عنوان المتجر" value={draft.address} />
          </GridRow>
          <Line label="البريد الإلكتروني" value={user?.email ?? "غير متاح"} />
          <Line label="هاتف المتجر" value={draft.phone} />
          <Line label="وصف المتجر" value={draft.description || "لم يضف وصفًا"} />
        </View>
        <View style={{ padding: LayoutSpacing.compactCardPadding, gap: 8, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary }}>
          <View style={{ padding: 12, gap: 4, backgroundColor: colors.primaryLight, borderRadius: 8, borderStartWidth: 3, borderStartColor: colors.accent }}>
            <Text style={[Typography.cardTitle, { color: colors.primary, textAlign: "right" }]}>{review.plan.name}</Text>
            {review.plan.description?.trim() ? <Text style={[Typography.body, { color: colors.text, textAlign: "right" }]}>{review.plan.description}</Text> : null}
          </View>
          <GridRow columns={columns}>
            <Line label="المدة" value={String(review.plan.duration_months) + " شهر"} />
            <Line label="الرسوم" value={formatSypNumber(review.plan.price) + " " + ("ليرة سورية")} />
          </GridRow>
          <GridRow columns={columns}>
            <Line label="العمولة" value={String(review.plan.commission_rate) + "%"} />
            <Line label="حد المنتجات" value={String(review.plan.product_limit) + " منتج"} />
          </GridRow>
          <View style={{ padding: 8, gap: 8, borderRadius: 8, backgroundColor: colors.warningSurface }}>
            <Text style={[Typography.bodyStrong, { color: colors.warningForeground, textAlign: "right" }]}>مزايا الخطة</Text>
            {review.plan.features?.length ? review.plan.features.map((feature, index) => <View key={index} style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 }}>
              <AppIcon name="checkmark-circle-outline" size={20} color={colors.warningForeground} />
              <Text style={[Typography.body, { flex: 1, color: colors.text, textAlign: "right" }]}>{feature}</Text>
            </View>) : <Text style={[Typography.body, { color: colors.textSecondary, textAlign: "right" }]}>لا توجد مزايا مسجلة لهذه الخطة.</Text>}
          </View>
          <Text style={[Typography.caption, { color: colors.textSecondary, textAlign: "right" }]}>يبدأ الاشتراك بعد الموافقة وفق النظام.</Text>
        </View>
        <AppButton design="refined" title="تأكيد تقديم الطلب" loading={busy} onPress={() => void submit()} />
      </> : null}
      <AppButton design="refined" title="العودة للتعديل" variant="outline" disabled={busy} onPress={edit} />
    </ScrollView>
  </OnboardingFrame>;
}
function GridRow({ columns, children }: { columns: boolean; children: [React.ReactNode, React.ReactNode] }) {
  return <View style={{ flexDirection: columns ? "row-reverse" : "column", alignItems: "stretch", gap: 8 }}>
    {children.map((child, index) => <View key={index} style={columns ? { flex: 1, minWidth: 0 } : undefined}>{child}</View>)}
  </View>;
}
function Line({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return <View style={{ gap: 2, padding: 8, borderRadius: 8, backgroundColor: colors.surfaceSecondary }}>
    <Text style={[Typography.label, { color: colors.textSecondary, textAlign: "right" }]}>{label}</Text>
    <Text style={[Typography.bodyStrong, { color: colors.text, textAlign: "right", flexShrink: 1 }]}>{value}</Text>
  </View>;
}
