import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { WorkspaceButton, WorkspaceConfirmModal, WorkspaceEmptyState, WorkspaceField, WorkspaceFormModal, WorkspaceFrame, WorkspaceStatus, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type Plan = { id: string; name: string; duration_months: number; price: number; currency: string; commission_rate: number; is_active: boolean };
type MerchantOption = { id: string; legal_name: string | null; contact_phone: string; stores: { id: string; name: string }[] };
type MerchantSubscription = {
  id: string;
  merchant_id: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  price_snapshot: number;
  currency_snapshot: string;
  duration_months_snapshot: number;
  commission_rate_override: number | null;
  commission_rate_snapshot: number;
  created_at: string;
  merchants: { legal_name: string | null; contact_phone: string } | { legal_name: string | null; contact_phone: string }[] | null;
  subscription_plans: { name: string; commission_rate: number } | { name: string; commission_rate: number }[] | null;
};
type Currency = "SYP" | "USD";

export default function AdminSubscriptions() {
  const { colors } = useTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [subscriptions, setSubscriptions] = useState<MerchantSubscription[]>([]);
  const [name, setName] = useState("اشتراك متجر");
  const [duration, setDuration] = useState("1");
  const [price, setPrice] = useState("");
  const [commissionRate, setCommissionRate] = useState("0");
  const [currency, setCurrency] = useState<Currency>("SYP");
  const [commissionOverrides, setCommissionOverrides] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null);
  const [activatingSubscriptionId, setActivatingSubscriptionId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ kind: "plan"; plan: Plan; nextActive: boolean } | { kind: "subscription"; subscription: MerchantSubscription; merchantName: string } | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [subscriptionFormVisible, setSubscriptionFormVisible] = useState(false);
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [creatingSubscription, setCreatingSubscription] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [plansResult, subscriptionsResult, merchantsResult] = await Promise.all([
      supabase.from("subscription_plans").select("id,name,duration_months,price,currency,commission_rate,is_active").order("duration_months").order("name"),
      supabase.from("merchant_subscriptions").select("id,merchant_id,status,starts_at,expires_at,price_snapshot,currency_snapshot,duration_months_snapshot,commission_rate_override,commission_rate_snapshot,created_at,merchants(legal_name,contact_phone),subscription_plans(name,commission_rate)").order("created_at", { ascending: false }).limit(100),
      supabase.from("merchants").select("id,legal_name,contact_phone,stores(id,name)").eq("approval", "approved").order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    if (plansResult.error || subscriptionsResult.error || merchantsResult.error) {
      Alert.alert("تعذر تحميل الخطط", "تحقق من صلاحيات الإدارة واتصال الإنترنت.");
      return;
    }
    setPlans((plansResult.data ?? []) as Plan[]);
    setMerchants((merchantsResult.data ?? []) as unknown as MerchantOption[]);
    setSubscriptions((subscriptionsResult.data ?? []) as unknown as MerchantSubscription[]);
    setCommissionOverrides((current) => ({
      ...Object.fromEntries((subscriptionsResult.data ?? []).map((item) => [item.id, item.commission_rate_override == null ? "" : String(item.commission_rate_override)])),
      ...current,
    }));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const clearForm = () => {
    setEditingId(null);
    setName("اشتراك متجر");
    setDuration("1");
    setPrice("");
    setCommissionRate("0");
    setCurrency("SYP");
  };

  const save = async () => {
    const normalizedName = name.trim();
    const durationMonths = Number(duration);
    const planPrice = Number(price);
    const rate = Number(commissionRate);
    if (!normalizedName || !Number.isInteger(durationMonths) || durationMonths < 1 || !price.trim() || !Number.isFinite(planPrice) || planPrice < 0 || !commissionRate.trim() || !Number.isFinite(rate) || rate < 0 || rate > 100) {
      Alert.alert("بيانات غير صالحة", "أدخل اسم الخطة ومدة صحيحة وسعرًا وعمولة بين 0 و100٪.");
      return;
    }

    setSaving(true);
    const result = editingId
      ? await supabase.from("subscription_plans").update({ name: normalizedName, duration_months: durationMonths, price: planPrice, currency, commission_rate: rate }).eq("id", editingId)
      : await supabase.from("subscription_plans").insert({ name: normalizedName, duration_months: durationMonths, price: planPrice, currency, commission_rate: rate, is_active: false });
    setSaving(false);

    if (result.error) {
      const duplicate = result.error.code === "23505";
      Alert.alert("تعذر حفظ الخطة", duplicate ? "توجد خطة بالاسم والمدة نفسيهما. عدّل الخطة الموجودة بدل إضافة نسخة مكررة." : "تحقق من البيانات وصلاحيات الإدارة ثم حاول مرة أخرى.");
      return;
    }
    clearForm();
    setFormVisible(false);
    await refresh();
  };

  const updateActive = async (plan: Plan, isActive: boolean) => {
    setChangingPlanId(plan.id);
    const { error } = await supabase.from("subscription_plans").update({ is_active: isActive }).eq("id", plan.id);
    setChangingPlanId(null);
    if (error) {
      setConfirmation(null);
      Alert.alert("تعذر تحديث الخطة", "تحقق من الصلاحيات وحاول مرة أخرى.");
      return;
    }
    setConfirmation(null);
    await refresh();
  };

  const confirmToggle = (plan: Plan) => {
    const nextActive = !plan.is_active;
    setConfirmation({ kind: "plan", plan, nextActive });
  };

  const confirmActivation = (subscription: MerchantSubscription, merchantName: string) => {
    setConfirmation({ kind: "subscription", subscription, merchantName });
  };

  const createSubscription = async () => {
    const merchant = merchants.find((item) => item.id === selectedMerchantId);
    const plan = plans.find((item) => item.id === selectedPlanId && item.is_active);
    if (!merchant || !plan) {
      Alert.alert("اختر التاجر والخطة", "يجب اختيار تاجر معتمد وخطة متاحة للاشتراك.");
      return;
    }
    setCreatingSubscription(true);
    const { error } = await supabase.from("merchant_subscriptions").insert({
      merchant_id: merchant.id,
      plan_id: plan.id,
      status: "pending",
      price_snapshot: plan.price,
      currency_snapshot: plan.currency,
      duration_months_snapshot: plan.duration_months,
      commission_rate_snapshot: plan.commission_rate,
    });
    setCreatingSubscription(false);
    if (error) {
      Alert.alert("تعذر تسجيل الاشتراك", "تحقق من اتصال الإنترنت وصلاحيات الإدارة ثم حاول مرة أخرى.");
      return;
    }
    setSubscriptionFormVisible(false);
    setSelectedMerchantId("");
    setSelectedPlanId("");
    await refresh();
    Alert.alert("تم تسجيل الاشتراك", "أضيف إلى قائمة الانتظار. أكّد استلام الرسوم من بطاقة الاشتراك لتفعيله.");
  };

  const activateSubscription = async (subscription: MerchantSubscription) => {
    const overrideText = commissionOverrides[subscription.id]?.trim() ?? "";
    const override = overrideText ? Number(overrideText) : null;
    const plan = Array.isArray(subscription.subscription_plans) ? subscription.subscription_plans[0] : subscription.subscription_plans;
    const effectiveRate = override ?? Number(plan?.commission_rate ?? subscription.commission_rate_snapshot);
    if (override !== null && (!Number.isFinite(override) || override < 0 || override > 100)) {
      setActivatingSubscriptionId(null);
      Alert.alert("نسبة غير صالحة", "أدخل نسبة خاصة بين 0 و100٪ أو اترك الحقل فارغًا لاستخدام نسبة الخطة.");
      return;
    }
    const startsAt = new Date();
    const expiresAt = addMonths(startsAt, subscription.duration_months_snapshot);
    setActivatingSubscriptionId(subscription.id);
    const { data, error } = await supabase
      .from("merchant_subscriptions")
      .update({ status: "active", starts_at: startsAt.toISOString(), expires_at: expiresAt.toISOString(), commission_rate_override: override, commission_rate_snapshot: effectiveRate })
      .eq("id", subscription.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    setActivatingSubscriptionId(null);
    if (error || !data) {
      setConfirmation(null);
      Alert.alert("تعذر تفعيل الاشتراك", "قد تكون حالته تغيرت. حدّث القائمة وحاول مرة أخرى.");
      return;
    }
    setConfirmation(null);
    await refresh();
  };

  return (
    <WorkspaceFrame title="خطط الاشتراك">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <WorkspaceTitle title="خطط المتاجر" detail="المدة والسعر والعمولة المحفوظة لكل اشتراك جديد." />
        <WorkspaceButton title="إنشاء خطة اشتراك" onPress={() => { clearForm(); setFormVisible(true); }} disabled={saving || loading || changingPlanId !== null} />
        <WorkspaceTitle title="الخطط الحالية" detail="يمكن إيقاف الخطة عن الاشتراكات الجديدة دون تغيير اشتراك نشط." />
        {loading ? <Text style={{ padding: 18, textAlign: "center", color: colors.textSecondary }}>جارٍ تحميل الخطط…</Text> : null}
        {!loading && plans.map((plan) => (
          <View key={plan.id} style={{ marginHorizontal: 16, marginTop: 10, padding: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12 }}>
            <Text style={{ textAlign: "right", color: colors.text, fontWeight: "600" }}>{plan.name}</Text>
            <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 4 }}>{plan.duration_months} شهر · {Number(plan.price).toLocaleString("en-US")} {plan.currency} · عمولة {Number(plan.commission_rate).toLocaleString("en-US")}٪</Text>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <WorkspaceStatus label={plan.is_active ? "متاحة" : "متوقفة"} color={plan.is_active ? colors.primary : colors.textMuted} />
              <View style={{ flexDirection: "row-reverse", gap: 18 }}>
                <Pressable accessibilityRole="button" disabled={saving || changingPlanId !== null} onPress={() => confirmToggle(plan)} hitSlop={8}>
                  <Text style={{ color: plan.is_active ? colors.error : colors.primary }}>{changingPlanId === plan.id ? "جارٍ الحفظ…" : plan.is_active ? "إيقاف" : "إتاحة"}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={saving || changingPlanId !== null} onPress={() => { setEditingId(plan.id); setName(plan.name); setDuration(String(plan.duration_months)); setPrice(String(plan.price)); setCommissionRate(String(plan.commission_rate)); setCurrency(plan.currency as Currency); setFormVisible(true); }} hitSlop={8}>
                  <Text style={{ color: colors.primary }}>تعديل</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
        {!loading && plans.length === 0 ? <WorkspaceEmptyState icon="card-outline" title="لا توجد خطط اشتراك" detail="أنشئ خطة شهرية أو متعددة الأشهر ليتمكن التجار من الاشتراك." /> : null}

        <WorkspaceTitle title="اشتراكات التجار" detail="السعر والمدة هنا هما النسخة المحفوظة وقت الاشتراك." />
        <WorkspaceButton title="تسجيل اشتراك لتاجر معتمد" onPress={() => { setSelectedMerchantId(merchants[0]?.id ?? ""); setSelectedPlanId(plans.find((item) => item.is_active)?.id ?? ""); setSubscriptionFormVisible(true); }} disabled={loading || saving || creatingSubscription || merchants.length === 0 || !plans.some((item) => item.is_active)} />
        {!loading && merchants.length === 0 ? <Text style={{ marginHorizontal: 16, marginTop: 8, textAlign: "right", color: colors.textMuted }}>لا يوجد تجار معتمدون لإسناد اشتراك إليهم.</Text> : null}
        {!loading && merchants.length > 0 && !plans.some((item) => item.is_active) ? <Text style={{ marginHorizontal: 16, marginTop: 8, textAlign: "right", color: colors.textMuted }}>أتِح خطة اشتراك أولًا حتى تتمكن من تسجيل اشتراك للتاجر.</Text> : null}
        {!loading && subscriptions.map((subscription) => {
          const merchant = Array.isArray(subscription.merchants) ? subscription.merchants[0] : subscription.merchants;
          const plan = Array.isArray(subscription.subscription_plans) ? subscription.subscription_plans[0] : subscription.subscription_plans;
          const statusLabel: Record<string, string> = { pending: "بانتظار التفعيل", active: "فعال", expired: "منتهي", cancelled: "ملغى", suspended: "موقوف" };
          const statusColor = subscription.status === "active" ? colors.primary : ["cancelled", "suspended", "expired"].includes(subscription.status) ? colors.textMuted : colors.accent;
          return (
            <View key={subscription.id} style={{ marginHorizontal: 16, marginTop: 10, padding: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12 }}>
              <Text style={{ textAlign: "right", color: colors.text, fontWeight: "600" }}>{merchant?.legal_name || "تاجر"}</Text>
              {merchant?.contact_phone ? <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 3 }}>{merchant.contact_phone}</Text> : null}
              <Text style={{ textAlign: "right", color: colors.textMuted, marginTop: 3 }}>يشمل الاشتراك فروع هذا التاجر المعتمدة ({merchants.find((item) => item.id === subscription.merchant_id)?.stores.length ?? 0} فرع)</Text>
              <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 7 }}>{plan?.name ?? "خطة محفوظة"} · {subscription.duration_months_snapshot} شهر · {Number(subscription.price_snapshot).toLocaleString("en-US")} {subscription.currency_snapshot} · عمولة {Number(subscription.commission_rate_snapshot).toLocaleString("en-US")}٪</Text>
              <Text style={{ textAlign: "right", color: colors.textMuted, marginTop: 4 }}>البداية: {subscription.starts_at ? new Date(subscription.starts_at).toLocaleDateString("ar-SY") : "لم تبدأ"} · الانتهاء: {subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString("ar-SY") : "غير محدد"}</Text>
              <View style={{ alignSelf: "flex-end", marginTop: 8 }}><WorkspaceStatus label={statusLabel[subscription.status] ?? subscription.status} color={statusColor} /></View>
              {subscription.status === "pending" ? <>
                <WorkspaceField label="عمولة متفق عليها خصيصًا (%) · اختياري" value={commissionOverrides[subscription.id] ?? ""} onChangeText={(value) => setCommissionOverrides((current) => ({ ...current, [subscription.id]: value }))} keyboardType="numeric" placeholder={`افتراضية الخطة: ${Number(plan?.commission_rate ?? 0).toLocaleString("en-US")}٪`} />
                <WorkspaceButton title={activatingSubscriptionId === subscription.id ? "جارٍ التفعيل…" : "تأكيد استلام الرسوم وتفعيل الاشتراك"} onPress={() => confirmActivation(subscription, merchant?.legal_name || "التاجر")} disabled={loading || activatingSubscriptionId !== null || saving || changingPlanId !== null} />
              </> : null}
            </View>
          );
        })}
        {!loading && subscriptions.length === 0 ? <WorkspaceEmptyState icon="people-outline" title="لا توجد اشتراكات مسجلة" detail="ستظهر طلبات الاشتراك هنا عند تقديمها من التجار." /> : null}
        {!loading && subscriptions.length === 100 ? <Text style={{ marginHorizontal: 16, marginTop: 10, textAlign: "center", color: colors.textMuted, fontSize: 12 }}>يعرض النظام أحدث 100 اشتراك.</Text> : null}
      </ScrollView>
      <WorkspaceFormModal visible={formVisible} title={editingId ? "تعديل خطة الاشتراك" : "إنشاء خطة اشتراك"} detail="تُحفظ العمولة والسعر كنسخة عند تفعيل كل اشتراك." onClose={() => { setFormVisible(false); clearForm(); }}>
        <WorkspaceField label="اسم الخطة" value={name} onChangeText={setName} />
        <WorkspaceField label="المدة بالأشهر" value={duration} onChangeText={setDuration} keyboardType="numeric" />
        <WorkspaceField label="السعر" value={price} onChangeText={setPrice} keyboardType="numeric" />
        <WorkspaceField label="عمولة المنصة (%)" value={commissionRate} onChangeText={setCommissionRate} keyboardType="numeric" />
        <View style={{ flexDirection: "row-reverse", marginHorizontal: 16, marginTop: 12, gap: 8 }}>{(["SYP", "USD"] as const).map((value) => { const selected = currency === value; return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setCurrency(value)} style={{ minWidth: 76, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface }}><Text style={{ color: selected ? colors.surface : colors.text, fontWeight: "600" }}>{value}</Text></Pressable>; })}</View>
        <WorkspaceButton title={saving ? "جارٍ الحفظ…" : editingId ? "حفظ التعديلات" : "إنشاء خطة غير مفعّلة"} onPress={() => void save()} disabled={saving || loading || changingPlanId !== null} />
      </WorkspaceFormModal>
      <WorkspaceFormModal visible={subscriptionFormVisible} title="تسجيل اشتراك لتاجر" detail="الاشتراك على مستوى حساب التاجر ويغطي فروعه المعتمدة. سيبقى بانتظار تأكيد استلام الرسوم قبل التفعيل." onClose={() => { if (!creatingSubscription) setSubscriptionFormVisible(false); }}>
        <Text style={{ marginHorizontal: 16, marginTop: 12, textAlign: "right", color: colors.text, fontWeight: "600" }}>اختر التاجر</Text>
        {merchants.map((merchant) => {
          const selected = selectedMerchantId === merchant.id;
          return <Pressable key={merchant.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setSelectedMerchantId(merchant.id)} style={{ marginHorizontal: 16, marginTop: 8, padding: 12, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, borderRadius: 12, backgroundColor: selected ? colors.primaryLight : colors.surface }}>
            <Text style={{ textAlign: "right", color: colors.text, fontWeight: "600" }}>{merchant.legal_name || "تاجر جديد"}</Text>
            <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 3 }}>{merchant.contact_phone} · {merchant.stores.length} فرع</Text>
            {merchant.stores.length ? <Text style={{ textAlign: "right", color: colors.textMuted, marginTop: 3 }}>{merchant.stores.map((store) => store.name).join("، ")}</Text> : null}
          </Pressable>;
        })}
        <Text style={{ marginHorizontal: 16, marginTop: 16, textAlign: "right", color: colors.text, fontWeight: "600" }}>اختر الخطة</Text>
        {plans.filter((plan) => plan.is_active).map((plan) => {
          const selected = selectedPlanId === plan.id;
          return <Pressable key={plan.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setSelectedPlanId(plan.id)} style={{ marginHorizontal: 16, marginTop: 8, padding: 12, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, borderRadius: 12, backgroundColor: selected ? colors.primaryLight : colors.surface }}>
            <Text style={{ textAlign: "right", color: colors.text, fontWeight: "600" }}>{plan.name} · {plan.duration_months} شهر</Text>
            <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 3 }}>{Number(plan.price).toLocaleString("en-US")} {plan.currency} · عمولة {Number(plan.commission_rate).toLocaleString("en-US")}٪</Text>
          </Pressable>;
        })}
        <WorkspaceButton title={creatingSubscription ? "جارٍ التسجيل…" : "تسجيل الاشتراك بانتظار التفعيل"} onPress={() => void createSubscription()} disabled={creatingSubscription || !selectedMerchantId || !selectedPlanId} />
      </WorkspaceFormModal>
      <WorkspaceConfirmModal visible={confirmation !== null} title={confirmation?.kind === "plan" ? confirmation.nextActive ? "إتاحة خطة الاشتراك" : "إيقاف خطة الاشتراك" : "تفعيل اشتراك التاجر"} detail={confirmation?.kind === "plan" ? confirmation.nextActive ? `ستصبح خطة «${confirmation.plan.name}» متاحة للاشتراكات الجديدة.` : `لن يتمكن التجار من اختيار «${confirmation.plan.name}» للاشتراكات الجديدة. الاشتراكات الحالية تبقى كما هي.` : confirmation?.kind === "subscription" ? `تأكد من استلام الرسوم من ${confirmation.merchantName}. سيبدأ الاشتراك الآن لمدة ${confirmation.subscription.duration_months_snapshot} شهرًا، وبعمولة ${Number(commissionOverrides[confirmation.subscription.id] || confirmation.subscription.commission_rate_snapshot).toLocaleString("en-US")}٪.` : ""} confirmLabel={confirmation?.kind === "plan" ? confirmation.nextActive ? "إتاحة الخطة" : "إيقاف الخطة" : "تأكيد الاستلام والتفعيل"} danger={confirmation?.kind === "plan" ? !confirmation.nextActive : false} busy={changingPlanId !== null || activatingSubscriptionId !== null} onCancel={() => setConfirmation(null)} onConfirm={() => { if (confirmation?.kind === "plan") void updateActive(confirmation.plan, confirmation.nextActive); else if (confirmation?.kind === "subscription") void activateSubscription(confirmation.subscription); }} />
    </WorkspaceFrame>
  );
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}
