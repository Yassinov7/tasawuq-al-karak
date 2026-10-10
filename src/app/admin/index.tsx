import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { getAccountRoute } from "@/lib/account-routing";
import { supabase } from "@/lib/supabase";

type Role = "driver" | "merchant";
type AdminSection = "overview" | "requests" | "drivers" | "stores" | "finance";
type RequestRow = { id: string; user_id: string; full_name?: string; contact_phone: string; vehicle_type?: string; contract_duration_months?: number; available_hours?: { schedule?: string }; store_name?: string; store_address?: string; store_categories?: { name: string } | { name: string }[] | null; plan_name_snapshot?: string; plan_price_snapshot?: number; plan_currency_snapshot?: string; status: string; submitted_at: string; review_note?: string | null };
type Profile = { id: string; full_name: string; email: string; role: string };
type AdminDriver = { id: string; user_id: string; full_name: string; contact_phone: string; vehicle_type: string; is_available: boolean; status: string };
type AdminMerchant = { id: string; owner_user_id: string; status: string };
type AdminStore = { id: string; merchant_id: string; name: string; phone: string; address: string; status: string };
type AdminDeliveryTask = { id: string; driver_id: string | null; status: string };
type AdminStoreOrder = { id: string; store_id: string; status: string };
type Wallet = { user_id: string; currency: "SYP" | "USD"; balance: number };
type Plan = { id: string; name: string; duration_months: number; price: number; currency: "SYP" | "USD"; description: string; is_active: boolean };
type TransactionTarget = { profile: Profile; currency: "SYP" | "USD"; balance: number };
const statusName: Record<string, string> = { pending: "قيد المراجعة", accepted: "مقبول", rejected: "مرفوض", changes_requested: "معلومات إضافية" };
const deliveryStatusName: Record<string, string> = { pending_stores: "بانتظار المتاجر", available: "متاح للاستلام", accepted: "مقبول من السائق", picked_up: "قيد التوصيل", delivered: "تم التسليم", cancelled: "ملغي" };
const storeOrderStatusName: Record<string, string> = { awaiting_review: "بانتظار مراجعة المتجر", preparing: "قيد التحضير", ready_for_pickup: "جاهز للاستلام", handed_to_driver: "سُلّم للسائق" };
const currencyName = (currency: string) => currency === "USD" ? "دولار" : "ل.س";

export default function AdminScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth(); const { colors } = useTheme();
  const section: AdminSection = pathname === "/admin/requests" ? "requests" : pathname === "/admin/drivers" ? "drivers" : pathname === "/admin/stores" ? "stores" : pathname === "/admin/finance" ? "finance" : "overview";
  const [requestRole, setRequestRole] = useState<Role>("merchant"); const [financeView, setFinanceView] = useState<"wallets" | "plans">("wallets");
  const [requestStatus, setRequestStatus] = useState<"pending" | "all" | "changes_requested" | "rejected" | "accepted">("pending");
  const [merchantRequests, setMerchantRequests] = useState<RequestRow[]>([]); const [driverRequests, setDriverRequests] = useState<RequestRow[]>([]); const [profiles, setProfiles] = useState<Profile[]>([]); const [drivers, setDrivers] = useState<AdminDriver[]>([]); const [merchants, setMerchants] = useState<AdminMerchant[]>([]); const [stores, setStores] = useState<AdminStore[]>([]); const [deliveryTasks, setDeliveryTasks] = useState<AdminDeliveryTask[]>([]); const [storeOrders, setStoreOrders] = useState<AdminStoreOrder[]>([]); const [wallets, setWallets] = useState<Wallet[]>([]); const [plans, setPlans] = useState<Plan[]>([]);
  const [authorizedUserId, setAuthorizedUserId] = useState<string | null>(null);
  const authorized = authorizedUserId === user?.id;
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [busy, setBusy] = useState(false); const [signingOut, setSigningOut] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<{ role: Role; row: RequestRow; decision: "accepted" | "rejected" | "changes_requested" } | null>(null); const [reviewNote, setReviewNote] = useState("");
  const [walletTarget, setWalletTarget] = useState<TransactionTarget | null>(null); const [operation, setOperation] = useState<"funding" | "settlement" | "adjustment">("funding"); const [direction, setDirection] = useState<"credit" | "debit">("credit"); const [amount, setAmount] = useState(""); const [note, setNote] = useState("");
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null); const [planName, setPlanName] = useState(""); const [planDuration, setPlanDuration] = useState("1"); const [planPrice, setPlanPrice] = useState(""); const [planCurrency, setPlanCurrency] = useState<"SYP" | "USD">("SYP"); const [planDescription, setPlanDescription] = useState("");
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const refresh = useCallback(async (showLoading = true) => {
    if (!authorized || !user) return;
    if (showLoading) setRefreshing(true);
    setError("");
    try {
      const [m, d, p, w, sp, activeDrivers, merchantRows, storeRows, tasks, storeOrderRows] = await Promise.all([
        supabase.from("merchant_applications").select("id,user_id,contact_phone,store_name,store_address,store_categories(name),plan_name_snapshot,plan_price_snapshot,plan_currency_snapshot,status,submitted_at,review_note").order("submitted_at", { ascending: false }),
        supabase.from("driver_applications").select("id,user_id,full_name,contact_phone,vehicle_type,contract_duration_months,available_hours,status,submitted_at,review_note").order("submitted_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,email,role").order("created_at", { ascending: false }),
        supabase.from("wallets").select("user_id,currency,balance").order("updated_at", { ascending: false }),
        supabase.from("subscription_plans").select("id,name,duration_months,price,currency,description,is_active").order("duration_months"),
        supabase.from("driver_applications").select("id,user_id,full_name,contact_phone,vehicle_type,is_available,status").eq("status", "accepted").order("updated_at", { ascending: false }),
        supabase.from("merchants").select("id,owner_user_id,status").order("created_at", { ascending: false }),
        supabase.from("stores").select("id,merchant_id,name,phone,address,status").order("created_at", { ascending: false }),
        supabase.from("delivery_tasks").select("id,driver_id,status").in("status", ["accepted", "picked_up"]),
        supabase.from("store_orders").select("id,store_id,status").in("status", ["awaiting_review", "preparing", "ready_for_pickup", "handed_to_driver"]),
      ]);
      const anyError = m.error ?? d.error ?? p.error ?? w.error ?? sp.error ?? activeDrivers.error ?? merchantRows.error ?? storeRows.error ?? tasks.error ?? storeOrderRows.error;
      if (anyError) throw anyError;
      setMerchantRequests((m.data ?? []) as RequestRow[]);
      setDriverRequests((d.data ?? []) as RequestRow[]);
      setProfiles((p.data ?? []) as Profile[]);
      setWallets((w.data ?? []) as Wallet[]);
      setPlans((sp.data ?? []) as Plan[]);
      setDrivers((activeDrivers.data ?? []) as AdminDriver[]);
      setMerchants((merchantRows.data ?? []) as AdminMerchant[]);
      setStores((storeRows.data ?? []) as AdminStore[]);
      setDeliveryTasks((tasks.data ?? []) as AdminDeliveryTask[]);
      setStoreOrders((storeOrderRows.data ?? []) as AdminStoreOrder[]);
    } catch {
      setError("تعذر تحميل بيانات الإدارة. تحقق من صلاحيات المسؤول واتصال قاعدة البيانات ثم أعد المحاولة.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authorized, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let active = true;
    void getAccountRoute(user.id).then((destination) => {
      if (!active) return;
      if (destination !== "/admin") {
        router.replace(destination);
        setLoading(false);
        return;
      }
      setAuthorizedUserId(user.id);
    }).catch(() => {
      if (!active) return;
      setError("تعذر التحقق من صلاحيات الحساب. أعد تسجيل الدخول وحاول مجددًا.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!authorized) return;
    const timer = setTimeout(() => void refresh(false), 0);
    return () => clearTimeout(timer);
  }, [authorized, refresh]);

  const review = async () => {
    if (!selectedRequest || !user) return;
    setBusy(true);
    const rpc = selectedRequest.role === "merchant" ? "review_merchant_application" : "review_driver_application";
    try {
      const { error: rpcError } = await supabase.rpc(rpc, { target_application: selectedRequest.row.id, decision: selectedRequest.decision, decision_note: reviewNote.trim() || undefined });
      if (rpcError) throw rpcError;
      setSelectedRequest(null);
      setReviewNote("");
      setError("");
      setMessage(selectedRequest.decision === "accepted" ? "تمت الموافقة وإنشاء المحفظة المطلوبة." : "تم حفظ قرار المراجعة وملاحظته.");
      await refresh(false);
    } catch {
      setError("تعذر حفظ قرار المراجعة. تحقق من الصلاحيات والاتصال ثم أعد المحاولة.");
    } finally {
      setBusy(false);
    }
  };

  const saveWalletOperation = async () => {
    if (!walletTarget || !amount.trim()) { setError("أدخل قيمة العملية."); return; }
    const numericAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || Math.round(numericAmount * 100) !== numericAmount * 100) { setError("أدخل مبلغًا صحيحًا حتى منزلتين عشريتين."); return; }
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("record_wallet_transaction", { target_user: walletTarget.profile.id, target_currency: walletTarget.currency, operation, operation_direction: direction, operation_amount: numericAmount, operation_note: note.trim() || undefined });
      if (rpcError) throw rpcError;
      setWalletTarget(null);
      setAmount("");
      setNote("");
      setError("");
      setMessage("تم تسجيل العملية وتحديث الرصيد وسجل التدقيق.");
      await refresh(false);
    } catch (operationError) {
      const message = operationError instanceof Error ? operationError.message : "";
      setError(message.includes("exceeds") ? "المبلغ أكبر من الرصيد المتاح للتسوية." : "تعذر حفظ العملية المالية. تحقق من الصلاحيات والاتصال.");
    } finally {
      setBusy(false);
    }
  };

  const beginPlan = (plan?: Plan) => { setEditingPlan(plan ?? null); setPlanName(plan?.name ?? ""); setPlanDuration(String(plan?.duration_months ?? 1)); setPlanPrice(plan ? String(plan.price) : ""); setPlanCurrency(plan?.currency ?? "SYP"); setPlanDescription(plan?.description ?? ""); setPlanModalOpen(true); };
  const savePlan = async () => {
    const months = Number(planDuration); const cost = Number(planPrice.replace(",", "."));
    if (!planName.trim() || !Number.isInteger(months) || months < 1 || months > 60 || !Number.isFinite(cost) || cost <= 0) { setError("تحقق من اسم الخطة ومدتها وسعرها."); return; }
    setBusy(true);
    try {
      const query = editingPlan ? supabase.from("subscription_plans").update({ name: planName.trim(), duration_months: months, price: cost, currency: planCurrency, description: planDescription.trim() }).eq("id", editingPlan.id) : supabase.from("subscription_plans").insert({ name: planName.trim(), duration_months: months, price: cost, currency: planCurrency, description: planDescription.trim() });
      const { error: planError } = await query;
      if (planError) throw planError;
      setEditingPlan(null);
      setPlanModalOpen(false);
      setError("");
      setMessage("تم حفظ خطة الاشتراك.");
      await refresh(false);
    } catch {
      setError("تعذر حفظ الخطة. تحقق من صلاحيات المسؤول والاتصال ثم أعد المحاولة.");
    } finally {
      setBusy(false);
    }
  };
  const togglePlan = async (plan: Plan) => {
    setBusy(true);
    try {
      const { error: planError } = await supabase.from("subscription_plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
      if (planError) throw planError;
      setMessage(plan.is_active ? "تم إيقاف الخطة." : "تم تفعيل الخطة.");
      await refresh(false);
    } catch {
      setError("تعذر تغيير حالة الخطة. تحقق من صلاحيات المسؤول والاتصال.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
    } catch {
      setError("تعذر تسجيل الخروج. تحقق من الاتصال وحاول مجددًا.");
    } finally {
      setSigningOut(false);
    }
  };

  const getProfile = (id: string) => profiles.find((profile) => profile.id === id);
  const allRequestRows = requestRole === "merchant" ? merchantRequests : driverRequests;
  const requestRows = useMemo(
    () => requestStatus === "all" ? allRequestRows : allRequestRows.filter((row) => row.status === requestStatus),
    [allRequestRows, requestStatus],
  );
  const openRequestCount = merchantRequests.filter((row) => row.status === "pending").length + driverRequests.filter((row) => row.status === "pending").length;
  const availableDriverCount = drivers.filter((driver) => driver.is_available).length;
  const activeStoreCount = stores.filter((store) => store.status === "accepted").length;
  const activeDeliveryCount = deliveryTasks.length;
  const transactionTitle = operation === "funding" ? "تمويل" : operation === "settlement" ? "تسوية" : "تعديل";
  const navigateToSection = (nextSection: AdminSection) => {
    const routes: Record<AdminSection, "/admin" | "/admin/requests" | "/admin/drivers" | "/admin/stores" | "/admin/finance"> = {
      overview: "/admin",
      requests: "/admin/requests",
      drivers: "/admin/drivers",
      stores: "/admin/stores",
      finance: "/admin/finance",
    };
    router.replace(routes[nextSection]);
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!authorized) return <View style={[styles.screen, { backgroundColor: colors.background }]}><AppHeader title="صلاحيات الإدارة" mode="business" /><View style={styles.accessMessage}><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{error || "جارٍ التحقق من صلاحيات الحساب…"}</Text>{user ? <AppButton title="تسجيل الخروج" variant="outline" onPress={() => void signOut()} loading={signingOut} /> : null}</View></View>;
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader title="إدارة المنصة" mode="business" />
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>متابعة المنصة وعملياتها من مكان واحد.</Text>
      {section === "overview" ? <>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>ملخص المنصة</Text>
        <View style={styles.metrics}>
          <Metric label="طلبات تنتظر المراجعة" value={openRequestCount} />
          <Metric label="المتاجر المعتمدة" value={activeStoreCount} />
        </View>
        <View style={styles.metrics}>
          <Metric label="السائقون المعتمدون" value={drivers.length} />
          <Metric label="السائقون المتاحون" value={availableDriverCount} />
        </View>
        <View style={styles.metrics}>
          <Metric label="توصيلات جارية" value={activeDeliveryCount} />
          <Metric label="خطط اشتراك فعالة" value={plans.filter((plan) => plan.is_active).length} />
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>متابعة سريعة</Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>افتح تبويبي السائقين والمتاجر لمتابعة التوفر والطلبات التشغيلية الحالية.</Text>
          <View style={styles.actions}>
            <AppButton title="متابعة السائقين" variant="secondary" onPress={() => navigateToSection("drivers")} />
            <AppButton title="متابعة المتاجر" variant="outline" onPress={() => navigateToSection("stores")} />
            <AppButton title="إدارة الطلبات" variant="outline" onPress={() => navigateToSection("requests")} />
          </View>
        </View>
      </> : null}
      {section === "drivers" ? <>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>السائقون المعتمدون</Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{availableDriverCount} متاح · {drivers.length - availableDriverCount} غير متاح</Text>
        </View>
        {!drivers.length ? <Empty text="لا يوجد سائقون معتمدون حتى الآن." /> : drivers.map((driver) => {
          const profile = getProfile(driver.user_id);
          const currentTasks = deliveryTasks.filter((task) => task.driver_id === driver.user_id);
          return <View key={driver.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{driver.full_name || profile?.full_name || "سائق"}</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{driver.vehicle_type} · {driver.contact_phone}</Text>
                {profile?.email ? <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{profile.email}</Text> : null}
              </View>
              <Text style={[styles.badge, { color: driver.is_available ? colors.success : colors.textMuted, backgroundColor: colors.surfaceSecondary }]}>{driver.is_available ? "متاح" : "غير متاح"}</Text>
            </View>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>التوصيلات النشطة: {currentTasks.length}</Text>
            {currentTasks.map((task) => <Text key={task.id} style={[styles.cardMeta, { color: colors.primary }]}>{deliveryStatusName[task.status] ?? task.status}</Text>)}
          </View>;
        })}
      </> : null}
      {section === "stores" ? <>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>المتاجر</Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{activeStoreCount} متجر معتمد من أصل {stores.length}</Text>
        </View>
        {!stores.length ? <Empty text="لا توجد متاجر مسجلة حتى الآن." /> : stores.map((store) => {
          const merchant = merchants.find((row) => row.id === store.merchant_id);
          const owner = merchant ? getProfile(merchant.owner_user_id) : undefined;
          const currentOrders = storeOrders.filter((order) => order.store_id === store.id);
          return <View key={store.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{store.name}</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{owner?.full_name ?? "صاحب المتجر"} · {store.phone}</Text>
              </View>
              <Text style={[styles.badge, { color: store.status === "accepted" ? colors.success : colors.accent, backgroundColor: colors.surfaceSecondary }]}>{statusName[store.status] ?? store.status}</Text>
            </View>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>العنوان: {store.address}</Text>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>الطلبات المفتوحة: {currentOrders.length}</Text>
            {currentOrders.map((order) => <Text key={order.id} style={[styles.cardMeta, { color: colors.primary }]}>{storeOrderStatusName[order.status] ?? order.status}</Text>)}
          </View>;
        })}
      </> : null}
      {section === "requests" ? <>
        <View style={styles.metrics}><Metric label="طلبات التجار" value={merchantRequests.filter((r) => r.status === "pending").length} /><Metric label="طلبات السائقين" value={driverRequests.filter((r) => r.status === "pending").length} /></View>
        <View style={styles.subTabs}>{([ ["merchant", "طلبات التجار"], ["driver", "طلبات السائقين"] ] as const).map(([key, label]) => <Pressable key={key} onPress={() => setRequestRole(key)} style={[styles.subTab, { borderColor: requestRole === key ? colors.primary : colors.border, backgroundColor: requestRole === key ? colors.primaryLight : colors.surface }]}><Text style={{ color: requestRole === key ? colors.primary : colors.textSecondary, fontFamily: Fonts.semiBold }}>{label}</Text></Pressable>)}</View>
        <View style={styles.statusFilters}>{([
          ["pending", "قيد المراجعة"],
          ["changes_requested", "استكمال"],
          ["rejected", "مرفوض"],
          ["accepted", "مقبول"],
          ["all", "الكل"],
        ] as const).map(([key, label]) => {
          const count = key === "all" ? allRequestRows.length : allRequestRows.filter((row) => row.status === key).length;
          return <Pressable key={key} onPress={() => setRequestStatus(key)} style={[styles.statusFilter, { borderColor: requestStatus === key ? colors.primary : colors.border, backgroundColor: requestStatus === key ? colors.primaryLight : colors.surface }]}><Text style={{ color: requestStatus === key ? colors.primary : colors.textSecondary, fontFamily: Fonts.semiBold, fontSize: FontSizes.xs }}>{label} ({count})</Text></Pressable>;
        })}</View>
        {!requestRows.length ? <Empty text="لا توجد طلبات بهذه الحالة." /> : requestRows.map((row) => <RequestCard key={row.id} row={row} role={requestRole} profile={getProfile(row.user_id)} onDecision={(decision) => { setSelectedRequest({ role: requestRole, row, decision }); setReviewNote(""); setError(""); }} />)}
      </> : section === "finance" ? <>
        <View style={styles.metrics}><Metric label="المحافظ" value={wallets.length} /><Metric label="خطط الاشتراك" value={plans.filter((plan) => plan.is_active).length} /></View>
        <View style={styles.subTabs}>{([ ["wallets", "المحافظ والعمليات"], ["plans", "خطط المتاجر"] ] as const).map(([key, label]) => <Pressable key={key} onPress={() => setFinanceView(key)} style={[styles.subTab, { borderColor: financeView === key ? colors.primary : colors.border, backgroundColor: financeView === key ? colors.primaryLight : colors.surface }]}><Text style={{ color: financeView === key ? colors.primary : colors.textSecondary, fontFamily: Fonts.semiBold }}>{label}</Text></Pressable>)}</View>
        {financeView === "wallets" ? <>{wallets.length ? wallets.map((wallet) => { const profile = getProfile(wallet.user_id); if (!profile) return null; return <View key={`${wallet.user_id}-${wallet.currency}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{profile.full_name}</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{profile.role === "merchant" ? "تاجر" : profile.role === "driver" ? "سائق" : profile.role} · {profile.email}</Text></View><Text style={[styles.walletBalance, { color: colors.primary }]}>{Number(wallet.balance).toLocaleString("ar-SY")} {currencyName(wallet.currency)}</Text></View><AppButton title="تسجيل عملية مالية" icon="swap-horizontal-outline" onPress={() => { setError(""); setWalletTarget({ profile, currency: wallet.currency, balance: Number(wallet.balance) }); setOperation("funding"); setDirection("credit"); }} /></View>; }) : <Empty text="لا توجد محافظ حتى الآن. تُنشأ محفظة السائق أو التاجر عند الموافقة على الطلب." />}</> : <><AppButton title="إضافة خطة اشتراك" icon="add-outline" onPress={() => beginPlan()} />{plans.length ? plans.map((plan) => <View key={plan.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{plan.name} · {plan.duration_months} شهر</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{Number(plan.price).toLocaleString("ar-SY")} {currencyName(plan.currency)} · {plan.is_active ? "متاحة" : "متوقفة"}</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{plan.description || "بدون وصف"}</Text></View></View><View style={styles.actions}><AppButton title="تعديل" variant="outline" onPress={() => beginPlan(plan)} /><AppButton title={plan.is_active ? "إيقاف الخطة" : "تفعيل الخطة"} variant={plan.is_active ? "danger" : "secondary"} onPress={() => void togglePlan(plan)} loading={busy} /></View></View>) : <Empty text="أضف خطة واحدة على الأقل حتى يتمكن التاجر من تقديم طلبه." />}</>}
      </> : null}
      {error ? <><Text style={[styles.error, { color: colors.error }]}>{error}</Text>{authorized ? <AppButton title="إعادة المحاولة" variant="outline" onPress={() => void refresh()} loading={refreshing} /> : null}</> : null}
      <AppButton title="تسجيل الخروج" variant="outline" onPress={() => void signOut()} loading={signingOut} />
    </ScrollView>

    <AppModal visible={Boolean(selectedRequest)} title={selectedRequest?.decision === "accepted" ? "تأكيد الموافقة" : selectedRequest?.decision === "rejected" ? "رفض الطلب" : "طلب استكمال معلومات"} message={selectedRequest?.decision === "accepted" ? "سيتم اعتماد الحساب وإنشاء المتجر أو محفظة السائق حسب نوع الطلب." : "أضف ملاحظة واضحة لتظهر لصاحب الطلب."} confirmText={selectedRequest?.decision === "accepted" ? "موافقة" : "حفظ القرار"} cancelText="رجوع" busy={busy} onCancel={() => { setSelectedRequest(null); setError(""); }} onConfirm={() => void review()}>{error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}{selectedRequest?.decision !== "accepted" ? <AppTextField label="ملاحظة للإجابة أو سبب الرفض" value={reviewNote} onChangeText={setReviewNote} multiline placeholder="اكتب ملاحظة مفيدة لصاحب الطلب" /> : null}</AppModal>

    <AppModal visible={Boolean(walletTarget)} title={`عملية ${transactionTitle}`} message={`${walletTarget?.profile.full_name ?? ""} · الرصيد الحالي ${walletTarget?.balance.toLocaleString("ar-SY")} ${walletTarget ? currencyName(walletTarget.currency) : ""}`} confirmText="حفظ العملية" cancelText="إلغاء" busy={busy} onCancel={() => { setWalletTarget(null); setError(""); }} onConfirm={() => void saveWalletOperation()}>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      <Choice label="نوع العملية" values={[["funding", "تمويل"], ["settlement", "تسوية"], ["adjustment", "تعديل"]]} value={operation} onChange={(value) => { const next = value as typeof operation; setOperation(next); setDirection(next === "settlement" ? "debit" : "credit"); }} />
      <Choice label="اتجاه القيد" values={[["credit", "إضافة إلى المحفظة"], ["debit", "خصم من المحفظة"]]} value={direction} onChange={(value) => setDirection(value as typeof direction)} />
      <AppTextField label="المبلغ" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
      <AppTextField label="ملاحظة وتفاصيل العملية" value={note} onChangeText={setNote} multiline placeholder="سبب التمويل أو تفاصيل التسوية" />
    </AppModal>

    <AppModal visible={planModalOpen} title={editingPlan ? "تعديل خطة" : "خطة اشتراك جديدة"} confirmText="حفظ الخطة" cancelText="إلغاء" busy={busy} onCancel={() => { setEditingPlan(null); setPlanModalOpen(false); setError(""); }} onConfirm={() => void savePlan()}>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      <AppTextField label="اسم الخطة" value={planName} onChangeText={setPlanName} />
      <AppTextField label="مدة الخطة بالأشهر" value={planDuration} onChangeText={setPlanDuration} keyboardType="number-pad" />
      <AppTextField label="السعر" value={planPrice} onChangeText={setPlanPrice} keyboardType="decimal-pad" />
      <Choice label="العملة" values={[["SYP", "ليرة سورية"], ["USD", "دولار"]]} value={planCurrency} onChange={(value) => setPlanCurrency(value as typeof planCurrency)} />
      <AppTextField label="وصف الخطة" value={planDescription} onChangeText={setPlanDescription} multiline />
    </AppModal>

    <AppModal visible={Boolean(message)} title="تمت العملية" message={message} onCancel={() => setMessage("")} />
    <AppModal visible={Boolean(error && !selectedRequest && !walletTarget && !planModalOpen)} title="تعذر إكمال العملية" message={error} onCancel={() => setError("")} />
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: "center" },
  accessMessage: { flex: 1, justifyContent: "center", gap: Spacing.four, padding: Spacing.five },
  container: { padding: Spacing.five, paddingBottom: Spacing.ten, maxWidth: 900, width: "100%", alignSelf: "center", gap: Spacing.three },
  subtitle: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 23 },
  sectionHeading: { gap: Spacing.one, alignItems: "flex-end" },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" },
  metrics: { flexDirection: "row-reverse", gap: Spacing.three },
  metric: { flex: 1, borderWidth: 1, padding: Spacing.three, borderRadius: Radius.lg, alignItems: "center", gap: Spacing.one },
  metricValue: { fontFamily: Fonts.bold, fontSize: FontSizes.xl },
  metricLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.xs },
  subTabs: { flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" },
  subTab: { minHeight: 40, paddingHorizontal: Spacing.three, justifyContent: "center", borderRadius: Radius.full, borderWidth: 1 },
  statusFilters: { flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" },
  statusFilter: { minHeight: 38, paddingHorizontal: Spacing.three, justifyContent: "center", borderRadius: Radius.full, borderWidth: 1 },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: Spacing.three },
  cardTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
  cardMeta: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", lineHeight: 21 },
  badge: { fontFamily: Fonts.bold, fontSize: FontSizes.xs, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.full },
  cardNote: { textAlign: "right", padding: Spacing.two, borderRadius: Radius.sm, fontFamily: Fonts.regular, lineHeight: 21 },
  actions: { flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" },
  walletBalance: { fontFamily: Fonts.bold, fontSize: FontSizes.md },
  empty: { padding: Spacing.four, borderRadius: Radius.md, textAlign: "right", fontFamily: Fonts.regular, lineHeight: 24 },
  choiceRow: { flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" },
  choice: { flexGrow: 1, minHeight: 40, paddingHorizontal: Spacing.two, borderWidth: 1, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  error: { padding: Spacing.three, borderRadius: Radius.md, textAlign: "right", fontFamily: Fonts.medium },
});
