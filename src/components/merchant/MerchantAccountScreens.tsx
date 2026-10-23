import { useRouter, type Href } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AccountShell } from "@/components/account/AccountShell";
import { AccountProfileHeader } from "@/components/account/AccountProfileHeader";
import { AccountMenuItem } from "@/components/account/AccountMenuItem";
import { AccountSection } from "@/components/account/AccountSection";
import { AppButton } from "@/components/ui/AppButton";
import { AppConfirmModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { FinancialCard, FinancialText, FinancialLink, financialDate } from "@/components/merchant/MerchantFinancialCards";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useMerchantWorkspace } from "@/context/MerchantWorkspaceContext";
import { useMerchantLoad } from "@/hooks/useMerchantLoad";
import { loadMerchantIdentity, loadMerchantSubscription, saveMerchantProfile, saveMerchantStoreInfo, type MerchantIdentity, type StoreInfoDraft } from "@/lib/merchant-account";
import { supabase } from "@/lib/supabase";
import { Fonts, Spacing } from "@/constants/theme";
import { type ProfileAgeRange } from "@/types/profile-demographics";

function LoadState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  const { colors } = useTheme();
  return <>{loading ? <ActivityIndicator color={colors.primary} /> : null}{error ? <View style={{ gap: Spacing.two }}><Text accessibilityRole="alert" style={{ color: colors.error, textAlign: "right", fontFamily: Fonts.regular }}>{error}</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={retry} /></View> : null}</>;
}
function useIdentity() {
  const { user } = useAuth();
  const userId = user?.id;
  return useMerchantLoad(useCallback(() => {
    if (!userId) throw new Error("سجّل الدخول بحساب التاجر.");
    return loadMerchantIdentity(userId);
  }, [userId]));
}
export function MerchantAccountHub() {
  const { data, error, loading, load } = useIdentity();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const logoutLock = useRef(false);
  const logout = async () => {
    if (logoutLock.current) return;
    logoutLock.current = true; setBusy(true);
    try {
      const result = await supabase.auth.signOut();
      if (result.error) throw result.error;
      router.replace("/login");
    } catch { setLogoutError("تعذر تسجيل الخروج. تحقق من الاتصال وحاول مجددًا."); }
    finally { logoutLock.current = false; setBusy(false); }
  };
  return <><AccountShell header={null}>
    <LoadState loading={loading} error={error || logoutError} retry={() => void load()} />
    {data ? <AccountProfileHeader name={data.profile.full_name || "حساب التاجر"} roleBadge="تاجر" details={[
      { icon: "mail-outline", value: data.profile.email || "البريد غير متاح" },
      { icon: "storefront-outline", value: data.store?.name || "لا يوجد متجر مرتبط" },
    ]} onEdit={() => router.push("/merchant/personal-info" as Href)} /> : null}
    <AccountSection title="الحساب والمتجر">
      <AccountMenuItem title="المعلومات الشخصية" subtitle="اسمك وبيانات حسابك" icon="person-outline" onPress={() => router.push("/merchant/personal-info" as Href)} />
      <AccountMenuItem title="معلومات المتجر" subtitle="الاسم والتصنيف والتواصل والعنوان" icon="storefront-outline" onPress={() => router.push("/merchant/store-info" as Href)} />
      <AccountMenuItem title="الاشتراك والخطط" subtitle="الخطة الحالية والميزات والخطط المتاحة" icon="calendar-outline" onPress={() => router.push("/merchant/subscription" as Href)} />
      <AccountMenuItem title="حسابي المالي" subtitle="المبيعات والمستحقات والتسويات" icon="wallet-outline" isLast onPress={() => router.push("/merchant/finance")} />
    </AccountSection>
    <AccountSection title="تفضيلات الحساب">
      <AccountMenuItem title="الإعدادات" icon="settings-outline" onPress={() => router.push("/merchant/settings" as Href)} />
      <AccountMenuItem title="الأمان وكلمة المرور" icon="lock-closed-outline" onPress={() => router.push("/merchant/security" as Href)} />
      <AccountMenuItem title="الإشعارات" icon="notifications-outline" isLast onPress={() => router.push("/notifications")} />
    </AccountSection>
    <AppButton title="تسجيل الخروج" variant="outline" onPress={() => setConfirm(true)} />
  </AccountShell><AppConfirmModal visible={confirm} title="تسجيل الخروج؟" message="هل تريد تسجيل الخروج من حساب التاجر؟" onCancel={() => { if (!busy) setConfirm(false); }} onConfirm={() => void logout()} /></>;
}

export function MerchantPersonalInfo() {
  const { headerHeight } = useMerchantWorkspace();
  const state = useIdentity();
  return <AccountShell header={null} keyboardAware keyboardVerticalOffset={headerHeight}><LoadState loading={state.loading} error={state.error} retry={() => void state.load()} />
    {!state.loading && !state.error && state.data ? <PersonalForm key={JSON.stringify(state.data.profile)} profile={state.data.profile} /> : null}
  </AccountShell>;
}
function PersonalForm({ profile }: { profile: MerchantIdentity["profile"] }) {
  const { user } = useAuth();
  const { setNotice } = useMerchantWorkspace();
  const [name, setName] = useState(profile.full_name);
  const [age, setAge] = useState<ProfileAgeRange | null>(profile.age_range);
  const [gender, setGender] = useState<string | null>(profile.gender);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const save = async () => {
    if (!user || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await saveMerchantProfile(user.id, name, age, gender !== profile.gender ? gender : undefined); setNotice("تم حفظ المعلومات الشخصية."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "تعذر الحفظ."); }
    finally { lock.current = false; setBusy(false); }
  };
  const ages: Record<string, string> = { under_18: "أقل من 18", "18_24": "18–24", "25_34": "25–34", "35_44": "35–44", "45_54": "45–54", "55_plus": "55 فأكثر" };
  const genders: Record<string, string> = { male: "ذكر", female: "أنثى", prefer_not_to_say: "أفضل عدم الإجابة", man: "رجل", woman: "امرأة", non_binary: "غير ثنائي", another_identity: "هوية أخرى" };
  return <FinancialCard title="بيانات حسابك">
    <AppTextField label="الاسم الكامل" value={name} onChangeText={setName} maxLength={120} editable={!busy} />
    <FinancialText>البريد: {profile.email || "غير متاح"}</FinancialText>
    <FinancialText>هاتف الحساب: {user?.phone || "غير مسجل"}</FinancialText>
    <FinancialText>الفئة العمرية (اختياري): {ages[age ?? ""] ?? "غير محددة"}</FinancialText>
    <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two }}>{[null, "under_18", "18_24", "25_34", "35_44", "45_54", "55_plus"].map((value) => <AppButton key={value ?? "none"} title={ages[value ?? ""] ?? "غير محددة"} fullWidth={false} disabled={busy} variant={age === value ? "primary" : "outline"} onPress={() => setAge(value as ProfileAgeRange | null)} />)}</View>
    <FinancialText>الجنس (اختياري): {genders[gender ?? ""] ?? "غير محدد"}</FinancialText>
    <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two }}>{[null, "woman", "man", "non_binary", "another_identity"].map((value) => <AppButton key={value ?? "none"} title={genders[value ?? ""] ?? "غير محدد"} fullWidth={false} disabled={busy} variant={gender === value ? "primary" : "outline"} onPress={() => setGender(value)} />)}</View>
    <FinancialText>البريد ورقم الدخول للعرض فقط؛ كلمة المرور من قسم الأمان، ورقم تواصل المتجر في معلومات المتجر.</FinancialText>
    {error ? <FinancialText>{error}</FinancialText> : null}
    <AppButton title="حفظ المعلومات الشخصية" loading={busy} onPress={() => void save()} />
  </FinancialCard>;
}

export function MerchantStoreInfo() {
  const { headerHeight } = useMerchantWorkspace();
  const state = useIdentity();
  return <AccountShell header={null} keyboardAware keyboardVerticalOffset={headerHeight}><LoadState loading={state.loading} error={state.error} retry={() => void state.load()} />
    {!state.loading && !state.error && state.data ? state.data.store ? <StoreForm key={JSON.stringify(state.data.store)} identity={state.data} /> : <FinancialText>لا يوجد متجر مرتبط بحسابك. تواصل مع الإدارة.</FinancialText> : null}
  </AccountShell>;
}
function StoreForm({ identity }: { identity: MerchantIdentity }) {
  const { user } = useAuth();
  const { setNotice } = useMerchantWorkspace();
  const store = identity.store!;
  const [draft, setDraft] = useState<StoreInfoDraft>({ name: store.name, description: store.description, phone: store.phone, address: store.address });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const save = async () => {
    if (!user || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await saveMerchantStoreInfo(user.id, store.id, draft); setNotice("تم حفظ معلومات المتجر."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "تعذر الحفظ."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <FinancialCard title="متجرك">
    <FinancialText>الاعتماد: {store.status === "accepted" ? "معتمد" : store.status === "pending" ? "قيد المراجعة" : "غير معتمد"}</FinancialText>
    <FinancialText>التصنيف: {identity.categoryName} · يحدّثه فريق الإدارة</FinancialText>
    {([["name", "اسم المتجر", 120], ["description", "وصف المتجر", 5000], ["phone", "رقم التواصل", 32], ["address", "العنوان والموقع", 300]] as const).map(([key, label, maxLength]) =>
      <AppTextField key={key} label={label} maxLength={maxLength} multiline={key === "description" || key === "address"} keyboardType={key === "phone" ? "phone-pad" : "default"} editable={!busy} value={draft[key]} onChangeText={(value) => setDraft((previous) => ({ ...previous, [key]: value }))} />)}
    {error ? <FinancialText>{error}</FinancialText> : null}
    <AppButton title="حفظ بيانات المتجر" loading={busy} onPress={() => void save()} />
  </FinancialCard>;
}

export function MerchantSubscriptionScreen() {
  const { user } = useAuth();
  const userId = user?.id;
  const state = useMerchantLoad(useCallback(() => {
    if (!userId) throw new Error("سجّل الدخول بحساب التاجر.");
    return loadMerchantSubscription(userId);
  }, [userId]));
  const data = state.data;
  const current = data?.current;
  const status = ({ active: "فعّال", grace: "فترة سماح", expired: "منتهٍ" } as Record<string, string>)[String(data?.status)] ?? "لا توجد فترة بدأت";
  const features = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  return <AccountShell header={null}>
    <LoadState loading={state.loading} error={state.error} retry={() => void state.load()} />
    {!state.loading && !state.error && data ? <>
      <FinancialCard title={current?.plan_name_snapshot ?? "الاشتراك الحالي"}>
        <FinancialText>الحالة: {status}</FinancialText>
        {current ? <><FinancialText>البداية: {financialDate(current.starts_at)}</FinancialText><FinancialText>النهاية: {financialDate(current.expires_at)}</FinancialText>
          <FinancialText>الرسوم المحفوظة: {Number(current.price_snapshot).toLocaleString("ar-SY")} {current.currency_snapshot}</FinancialText>
          <FinancialText>العمولة المحفوظة: {data.commissionRate == null ? "قيد مراجعة الإدارة" : `${data.commissionRate}%`}</FinancialText></> : null}
        <FinancialText>تفضيل التجديد التلقائي: {data.autoRenew ? "مفعّل" : "غير مفعّل"}</FinancialText>
        <FinancialText>حد المنتجات حسب تعريف الخطة: {data.currentPlan?.product_limit ?? "غير محدد"}</FinancialText>
        {features(data.currentPlan?.features).map((feature) => <FinancialText key={feature}>• {feature}</FinancialText>)}
      </FinancialCard>
      {data.next ? <FinancialCard title="الفترة القادمة المسجلة"><FinancialText>{data.next.plan_name_snapshot}</FinancialText><FinancialText>تبدأ {financialDate(data.next.starts_at)}</FinancialText></FinancialCard> : null}
      {data.change ? <FinancialCard title="الخطة المختارة للفترة التالية"><FinancialText>{data.change.plan_name_snapshot}</FinancialText></FinancialCard> : null}
      <FinancialCard title="التجديد وتغيير الخطة"><FinancialText>تغيير الخطة والتجديد يديرهما فريق الإدارة حاليًا. تواصل مع الإدارة لاختيار خطة الفترة التالية أو تعديل تفضيل التجديد.</FinancialText><FinancialText>تفضيل التجديد لا يمنح موافقة ائتمانية؛ المدفوعات يدوية ونقدية.</FinancialText></FinancialCard>
      <FinancialText title>الخطط المتاحة للمقارنة</FinancialText>
      {data.plans.map((plan) => <FinancialCard key={plan.id} title={plan.name}>
        <FinancialText>{plan.description || "لا يوجد وصف إضافي"}</FinancialText>
        <FinancialText>{plan.duration_months} شهر · {Number(plan.price).toLocaleString("ar-SY")} {plan.currency}</FinancialText>
        <FinancialText>العمولة: {plan.commission_rate == null ? "قيد المراجعة" : `${plan.commission_rate}%`} · حد المنتجات: {plan.product_limit ?? "غير محدد"}</FinancialText>
        {features(plan.features).map((feature) => <FinancialText key={feature}>• {feature}</FinancialText>)}
      </FinancialCard>)}
      {!data.plans.length ? <FinancialText>لا توجد خطط متاحة للمقارنة حاليًا.</FinancialText> : null}
      <FinancialLink title="فواتير الاشتراك" href="/merchant/subscription-invoices" />
      <FinancialLink title="مدفوعات الاشتراك" href="/merchant/subscription-payments" />
    </> : null}
  </AccountShell>;
}
