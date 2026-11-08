import {MerchantStoreBranding} from '@/components/merchant/MerchantStoreBranding';
import { formatSypNumber } from "@/lib/money";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AccountShell } from "@/components/account/AccountShell";
import {SharedAccountIdentity,SharedAccountMenu,AccountLogout} from "@/components/account/SharedAccountParts";
import {PersonalInfoScreen} from "@/components/account/PersonalInfoScreen";
import { AccountMenuItem } from "@/components/account/AccountMenuItem";
import { AccountSection } from "@/components/account/AccountSection";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { FinancialCard, FinancialText, FinancialLink, financialDate } from "@/components/merchant/MerchantFinancialCards";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useMerchantWorkspace } from "@/context/MerchantWorkspaceContext";
import { useMerchantLoad } from "@/hooks/useMerchantLoad";
import { loadMerchantIdentity, loadMerchantSubscription, saveMerchantStoreInfo, type MerchantIdentity, type StoreInfoDraft } from "@/lib/merchant-account";
import { Fonts, Spacing } from "@/constants/theme";

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
 const router=useRouter();
 return <AccountShell header={null}><SharedAccountIdentity expectedRole="merchant"/>
 <AccountSection title="المتجر والاشتراك">
 <AccountMenuItem title="معلومات المتجر" subtitle="الاسم والتصنيف والتواصل والعنوان" icon="storefront-outline" onPress={()=>router.push('/merchant/store-info')}/>
 <AccountMenuItem title="الاشتراك والخطط" icon="calendar-outline" onPress={()=>router.push('/merchant/subscription')}/>
 <AccountMenuItem title="حسابي المالي" icon="wallet-outline" onPress={()=>router.push('/merchant/finance')}/>
 <AccountMenuItem title="الإشعارات" icon="notifications-outline" isLast onPress={()=>router.push('/notifications')}/>
 </AccountSection><SharedAccountMenu role="merchant"/><AccountLogout/></AccountShell>;
}
export function MerchantPersonalInfo(){const {headerHeight}=useMerchantWorkspace();return <PersonalInfoScreen embedded keyboardOffset={headerHeight}/>;}

export function MerchantStoreInfo() {
 const {user}=useAuth();
 return user?<StoreInfoAccount key={user.id}/>:<FinancialText>سجّل الدخول بحساب التاجر.</FinancialText>;
}
function StoreInfoAccount() {
  const { headerHeight } = useMerchantWorkspace();
  const state = useIdentity();
  const {user}=useAuth();
  return <AccountShell header={null} keyboardAware keyboardVerticalOffset={headerHeight}><LoadState loading={state.loading} error={state.error} retry={() => void state.load()} />
    {!state.loading && !state.error && state.data ? state.data.store ? <View key={user?.id+state.data.store.id} style={{gap:16}}><StoreForm key={JSON.stringify(state.data.store)} identity={state.data} />{user?<MerchantStoreBranding key={user.id+state.data.store.id} owner={user.id} store={state.data.store.id}/>:null}</View> : <FinancialText>لا يوجد متجر مرتبط بحسابك. تواصل مع الإدارة.</FinancialText> : null}
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

export function MerchantSubscriptionScreen({embedded=false}:{embedded?:boolean}={}) {
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
  const content=<>
    <LoadState loading={state.loading} error={state.error} retry={() => void state.load()} />
    {!state.loading && !state.error && data ? <>
      <FinancialCard title={current?.plan_name_snapshot ?? "الاشتراك الحالي"}>
        <FinancialText>الحالة: {status}</FinancialText>
        {current ? <><FinancialText>البداية: {financialDate(current.starts_at)}</FinancialText><FinancialText>النهاية: {financialDate(current.expires_at)}</FinancialText>
          <FinancialText>الرسوم المحفوظة: {formatSypNumber(Number(current.price_snapshot))} {current.currency_snapshot}</FinancialText>
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
        <FinancialText>{plan.duration_months} شهر · {formatSypNumber(Number(plan.price))} {"SYP"}</FinancialText>
        <FinancialText>العمولة: {plan.commission_rate == null ? "قيد المراجعة" : `${plan.commission_rate}%`} · حد المنتجات: {plan.product_limit ?? "غير محدد"}</FinancialText>
        {features(plan.features).map((feature) => <FinancialText key={feature}>• {feature}</FinancialText>)}
      </FinancialCard>)}
      {!data.plans.length ? <FinancialText>لا توجد خطط متاحة للمقارنة حاليًا.</FinancialText> : null}
      <FinancialLink title="فواتير الاشتراك" href="/merchant/subscription-invoices" />
      <FinancialLink title="مدفوعات الاشتراك" href="/merchant/subscription-payments" />
    </> : null}
  </>;
  return embedded?content:<AccountShell header={null}>{content}</AccountShell>;
}
