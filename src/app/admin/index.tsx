import { formatSypNumber } from "@/lib/money";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { reviewAdminApplication } from "@/lib/admin-applications";

type Role = "driver" | "merchant";
type AdminSection = "overview" | "orders" | "applications" | "drivers" | "stores" | "finance";
type RequestRow = { id: string; user_id: string; full_name?: string; contact_phone: string; vehicle_type?: string; contract_duration_months?: number; available_hours?: { schedule?: string }; store_name?: string; store_address?: string; store_categories?: { name: string } | { name: string }[] | null; plan_name_snapshot?: string; plan_price_snapshot?: number; plan_currency_snapshot?: string; plan_duration_months_snapshot?: number; plan_commission_rate_snapshot?: number | null; plan_product_limit_snapshot?: number | null; plan_features_snapshot?: string[] | null; status: string; submitted_at: string; review_note?: string | null };
type Profile = { id: string; full_name: string; email: string; role: string };
type AdminDriver = { id: string; user_id: string; full_name: string; contact_phone: string; vehicle_type: string; is_available: boolean; status: string };
type AdminMerchant = { id: string; owner_user_id: string; status: string };
type AdminStore = { id: string; merchant_id: string; name: string; phone: string; address: string; status: string };
type AdminDeliveryTask = { id: string; driver_id: string | null; status: string };
type AdminStoreOrder = { id: string; customer_order_id: string; store_id: string; status: string; created_at: string };
type Wallet = { user_id: string; currency: "SYP"; balance: number };
type Plan = { id: string; name: string; duration_months: number; price: number; currency: "SYP"; description: string; is_active: boolean };
type TransactionTarget = { profile: Profile; currency: "SYP"; balance: number };
type DashboardData = { merchantRequests: RequestRow[]; driverRequests: RequestRow[]; profiles: Profile[]; wallets: Wallet[]; plans: Plan[]; drivers: AdminDriver[]; merchants: AdminMerchant[]; stores: AdminStore[]; deliveryTasks: AdminDeliveryTask[]; storeOrders: AdminStoreOrder[] };
type DashboardCache = { userId: string; updatedAt: number; data: DashboardData };
let dashboardCache: DashboardCache | null = null;
const dashboardCacheTtlMs = 15_000;
const statusName: Record<string, string> = { pending: "قيد المراجعة", accepted: "مقبول", rejected: "مرفوض", changes_requested: "معلومات إضافية" };
const deliveryStatusName: Record<string, string> = { pending_stores: "بانتظار المتاجر", available: "متاح للاستلام", accepted: "مقبول من السائق", picked_up: "قيد التوصيل", delivered: "تم التسليم", cancelled: "ملغي" };
const storeOrderStatusName: Record<string, string> = { awaiting_review: "بانتظار مراجعة المتجر", preparing: "قيد التحضير", ready_for_pickup: "جاهز للاستلام", handed_to_driver: "سُلّم للسائق" };
const currencyName = (currency: string) => "ل.س";

export default function AdminScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { role: requestedRole } = useLocalSearchParams<{ role?: string }>();
  const { user } = useAuth(); const { colors } = useTheme();
  const section: AdminSection = pathname === "/admin/orders" || pathname === "/admin/requests" ? "orders" : pathname === "/admin/applications" ? "applications" : pathname === "/admin/drivers" ? "drivers" : pathname === "/admin/stores" ? "stores" : pathname === "/admin/finance" ? "finance" : "overview";
  const requestRole: Role = requestedRole === "driver" ? "driver" : "merchant"; const [financeView, setFinanceView] = useState<"wallets" | "plans">("wallets");
  const [requestStatus, setRequestStatus] = useState<"pending" | "all" | "changes_requested" | "rejected" | "accepted">("pending");
  const [merchantRequests, setMerchantRequests] = useState<RequestRow[]>([]); const [driverRequests, setDriverRequests] = useState<RequestRow[]>([]); const [profiles, setProfiles] = useState<Profile[]>([]); const [drivers, setDrivers] = useState<AdminDriver[]>([]); const [merchants, setMerchants] = useState<AdminMerchant[]>([]); const [stores, setStores] = useState<AdminStore[]>([]); const [deliveryTasks, setDeliveryTasks] = useState<AdminDeliveryTask[]>([]); const [storeOrders, setStoreOrders] = useState<AdminStoreOrder[]>([]); const [wallets, setWallets] = useState<Wallet[]>([]); const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false); const [refreshing, setRefreshing] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<{ role: Role; row: RequestRow; decision: "accepted" | "rejected" | "changes_requested" } | null>(null); const [reviewNote, setReviewNote] = useState("");
  const [walletTarget, setWalletTarget] = useState<TransactionTarget | null>(null); const [operation, setOperation] = useState<"funding" | "settlement" | "adjustment">("funding"); const [direction, setDirection] = useState<"credit" | "debit">("credit"); const [amount, setAmount] = useState(""); const [note, setNote] = useState("");
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null); const [planName, setPlanName] = useState(""); const [planDuration, setPlanDuration] = useState("1"); const [planPrice, setPlanPrice] = useState("");  const [planDescription, setPlanDescription] = useState("");
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const applyDashboardData = useCallback((data: DashboardData) => {
    setMerchantRequests(data.merchantRequests); setDriverRequests(data.driverRequests); setProfiles(data.profiles); setWallets(data.wallets); setPlans(data.plans); setDrivers(data.drivers); setMerchants(data.merchants); setStores(data.stores); setDeliveryTasks(data.deliveryTasks); setStoreOrders(data.storeOrders);
  }, []);

  const refresh = useCallback(async (manual = false, force = false) => {
    if (!user) return;
    const cached = dashboardCache?.userId === user.id ? dashboardCache : null;
    if (cached) applyDashboardData(cached.data);
    if (!force && !manual && cached && Date.now() - cached.updatedAt < dashboardCacheTtlMs) {
      setLoading(false);
      return;
    }
    if (cached) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [m, d, p, w, sp, activeDrivers, merchantRows, storeRows, tasks, storeOrderRows] = await Promise.all([
        supabase.from("merchant_applications").select("id,user_id,contact_phone,store_name,store_address,store_categories(name),plan_name_snapshot,plan_price_snapshot,plan_currency_snapshot,plan_duration_months_snapshot,plan_commission_rate_snapshot,plan_product_limit_snapshot,plan_features_snapshot,status,submitted_at,review_note").order("submitted_at", { ascending: false }),
        supabase.from("driver_applications").select("id,user_id,full_name,contact_phone,vehicle_type,contract_duration_months,available_hours,status,submitted_at,review_note").order("submitted_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,email,role").order("created_at", { ascending: false }),
        supabase.from("wallets").select("user_id,balance").order("updated_at", { ascending: false }),
        supabase.from("subscription_plans").select("id,name,duration_months,price,description,is_active").order("duration_months"),
        supabase.from("driver_applications").select("id,user_id,full_name,contact_phone,vehicle_type,is_available,status").eq("status", "accepted").order("updated_at", { ascending: false }),
        supabase.from("merchants").select("id,owner_user_id,status").order("created_at", { ascending: false }),
        supabase.from("stores").select("id,merchant_id,name,phone,address,status").order("created_at", { ascending: false }),
        supabase.from("delivery_tasks").select("id,driver_id,status").in("status", ["accepted", "picked_up"]),
        supabase.from("store_orders").select("id,customer_order_id,store_id,status,created_at").in("status", ["awaiting_review", "preparing", "ready_for_pickup", "handed_to_driver"]),
      ]);
      const anyError = m.error ?? d.error ?? p.error ?? w.error ?? sp.error ?? activeDrivers.error ?? merchantRows.error ?? storeRows.error ?? tasks.error ?? storeOrderRows.error;
      if (anyError) throw anyError;
      const data: DashboardData = { merchantRequests: (m.data ?? []) as RequestRow[], driverRequests: (d.data ?? []) as RequestRow[], profiles: (p.data ?? []) as Profile[], wallets: (w.data ?? []) as Wallet[], plans: (sp.data ?? []) as Plan[], drivers: (activeDrivers.data ?? []) as AdminDriver[], merchants: (merchantRows.data ?? []) as AdminMerchant[], stores: (storeRows.data ?? []) as AdminStore[], deliveryTasks: (tasks.data ?? []) as AdminDeliveryTask[], storeOrders: (storeOrderRows.data ?? []) as AdminStoreOrder[] };
      dashboardCache = { userId: user.id, updatedAt: Date.now(), data };
      applyDashboardData(data);
    } catch {
      setError("تعذر تحميل بيانات الإدارة. تحقق من صلاحيات المسؤول واتصال قاعدة البيانات ثم أعد المحاولة.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyDashboardData, user]);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => void refresh(false), 0);
    return () => clearTimeout(timer);
  }, [refresh, user]);

  const review = async () => {
    if (!selectedRequest || !user) return;
    setBusy(true);
    try {
      await reviewAdminApplication(selectedRequest.role, selectedRequest.row.id, selectedRequest.decision, reviewNote);
      setSelectedRequest(null);
      setReviewNote("");
      setError("");
      setMessage(selectedRequest.decision === "accepted" ? "تمت الموافقة وإنشاء المحفظة المطلوبة." : "تم حفظ قرار المراجعة وملاحظته.");
      await refresh(false, true);
    } catch (reviewError) {
      const databaseReason = reviewError instanceof Error ? reviewError.message : "";
      setError(
        databaseReason.includes("subscription plan")
          ? "لا يمكن الموافقة: الخطة المختارة لم تعد متاحة أو لم تعد مطابقة لشروط الطلب."
          : "تعذر حفظ قرار المراجعة. تحقق من الصلاحيات والاتصال ثم أعد المحاولة."
      );
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
      const { error: rpcError } = await supabase.rpc("record_wallet_transaction", { target_user: walletTarget.profile.id, operation, operation_direction: direction, operation_amount: numericAmount, operation_note: note.trim() || undefined });
      if (rpcError) throw rpcError;
      setWalletTarget(null);
      setAmount("");
      setNote("");
      setError("");
      setMessage("تم تسجيل العملية وتحديث الرصيد وسجل التدقيق.");
      await refresh(false, true);
    } catch (operationError) {
      const message = operationError instanceof Error ? operationError.message : "";
      setError(message.includes("exceeds") ? "المبلغ أكبر من الرصيد المتاح للتسوية." : "تعذر حفظ العملية المالية. تحقق من الصلاحيات والاتصال.");
    } finally {
      setBusy(false);
    }
  };

  const beginPlan = (plan?: Plan) => { setEditingPlan(plan ?? null); setPlanName(plan?.name ?? ""); setPlanDuration(String(plan?.duration_months ?? 1)); setPlanPrice(plan ? String(plan.price) : ""); setPlanDescription(plan?.description ?? ""); setPlanModalOpen(true); };
  const savePlan = async () => {
    const months = Number(planDuration); const cost = Number(planPrice.replace(",", "."));
    if (!planName.trim() || !Number.isInteger(months) || months < 1 || months > 60 || !Number.isFinite(cost) || cost <= 0) { setError("تحقق من اسم الخطة ومدتها وسعرها."); return; }
    setBusy(true);
    try {
      const query = editingPlan ? supabase.from("subscription_plans").update({ name: planName.trim(), duration_months: months, price: cost, description: planDescription.trim() }).eq("id", editingPlan.id) : supabase.from("subscription_plans").insert({ name: planName.trim(), duration_months: months, price: cost, description: planDescription.trim() });
      const { error: planError } = await query;
      if (planError) throw planError;
      setEditingPlan(null);
      setPlanModalOpen(false);
      setError("");
      setMessage("تم حفظ خطة الاشتراك.");
      await refresh(false, true);
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
      await refresh(false, true);
    } catch {
      setError("تعذر تغيير حالة الخطة. تحقق من صلاحيات المسؤول والاتصال.");
    } finally {
      setBusy(false);
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
    const routes: Record<AdminSection, "/admin" | "/admin/orders" | "/admin/applications" | "/admin/drivers" | "/admin/stores" | "/admin/finance"> = {
      overview: "/admin",
      orders: "/admin/orders",
      applications: "/admin/applications",
      drivers: "/admin/drivers",
      stores: "/admin/stores",
      finance: "/admin/finance",
    };
    router.replace(routes[nextSection]);
  };

  const hasCachedData = dashboardCache?.userId === user?.id;
  if (loading && !hasCachedData) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true, true)} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>متابعة المنصة وعملياتها من مكان واحد.</Text>
      {refreshing ? <View style={styles.backgroundRefresh}><ActivityIndicator size="small" color={colors.primary} /><Text style={[styles.refreshText, { color: colors.textSecondary }]}>يتم تحديث البيانات في الخلفية…</Text></View> : null}
      {section === "overview" ? <>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>نظرة عامة</Text>
        <View style={styles.metrics}>
          <Metric label="طلبات تحتاج مراجعة" value={openRequestCount} onPress={() => navigateToSection("applications")} />
          <Metric label="المتاجر المعتمدة" value={activeStoreCount} onPress={() => navigateToSection("stores")} />
        </View>
        <View style={styles.metrics}>
          <Metric label="السائقون المعتمدون" value={drivers.length} onPress={() => navigateToSection("drivers")} />
          <Metric label="توصيلات جارية" value={activeDeliveryCount} onPress={() => navigateToSection("orders")} />
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>يحتاج إلى إجراء</Text>
          <View style={styles.actionRows}>
            <ActionRow label="طلبات التجار المعلقة" value={merchantRequests.filter((row) => row.status === "pending").length} onPress={() => router.replace("/admin/applications?role=merchant")} />
            <ActionRow label="طلبات السائقين المعلقة" value={driverRequests.filter((row) => row.status === "pending").length} onPress={() => router.replace("/admin/applications?role=driver")} />
            <ActionRow label="طلبات المتاجر بانتظار المراجعة" value={storeOrders.filter((row) => row.status === "awaiting_review").length} onPress={() => router.replace("/admin/orders")} />
          </View>
        </View>
      </> : null}
      {section === "overview" ? <AppButton title="إدارة خطط الاشتراك" icon="pricetags-outline" variant="outline" onPress={() => router.push("/admin/plans")} /> : null}
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
      {section === "orders" ? <>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>الطلبات التشغيلية</Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>افتح الطلب لمتابعة حالته العامة وطلبات المتاجر والتوصيل. هذه الشاشة للمتابعة فقط ولا تغيّر حالة الطلب.</Text>
          {!storeOrders.length ? <Text style={[styles.cardMeta, { color: colors.textMuted }]}>لا توجد طلبات مفتوحة تحتاج متابعة.</Text> : [...new Map(storeOrders.map((row) => [row.customer_order_id, row])).values()].map((row) => <Pressable key={row.customer_order_id} onPress={() => router.push(`/admin/order-details?orderId=${row.customer_order_id}`)} style={({ pressed }) => [styles.actionRow, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.72 : 1 }]}>
            <Text style={[styles.actionValue, { color: colors.primary }]}>عرض</Text><View style={{ flex: 1 }}><Text style={[styles.actionLabel, { color: colors.text }]}>طلب تشغيلي</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{storeOrderStatusName[row.status] ?? row.status} · {new Date(row.created_at).toLocaleDateString("ar-SY")}</Text></View>
          </Pressable>)}
        </View>
      </> : null}
      {section === "applications" ? <>
        <View style={styles.metrics}><Metric label="طلبات التجار" value={merchantRequests.filter((r) => r.status === "pending").length} /><Metric label="طلبات السائقين" value={driverRequests.filter((r) => r.status === "pending").length} /></View>
        <View style={styles.subTabs}>{([ ["merchant", "طلبات التجار"], ["driver", "طلبات السائقين"] ] as const).map(([key, label]) => <Pressable key={key} onPress={() => router.replace(`/admin/applications?role=${key}`)} style={[styles.subTab, { borderColor: requestRole === key ? colors.primary : colors.border, backgroundColor: requestRole === key ? colors.primaryLight : colors.surface }]}><Text style={{ color: requestRole === key ? colors.primary : colors.textSecondary, fontFamily: Fonts.semiBold }}>{label}</Text></Pressable>)}</View>
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
        {financeView === "wallets" ? <>{wallets.length ? wallets.map((wallet) => { const profile = getProfile(wallet.user_id); if (!profile) return null; return <View key={`${wallet.user_id}-${wallet.currency}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{profile.full_name}</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{profile.role === "merchant" ? "تاجر" : profile.role === "driver" ? "سائق" : profile.role} · {profile.email}</Text></View><Text style={[styles.walletBalance, { color: colors.primary }]}>{formatSypNumber(Number(wallet.balance))} {currencyName(wallet.currency)}</Text></View><AppButton title="تسجيل عملية مالية" icon="swap-horizontal-outline" onPress={() => { setError(""); setWalletTarget({ profile, currency: wallet.currency, balance: Number(wallet.balance) }); setOperation("funding"); setDirection("credit"); }} /></View>; }) : <Empty text="لا توجد محافظ حتى الآن. تُنشأ محفظة السائق أو التاجر عند الموافقة على الطلب." />}</> : <><AppButton title="إضافة خطة اشتراك" icon="add-outline" onPress={() => beginPlan()} />{plans.length ? plans.map((plan) => <View key={plan.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{plan.name} · {plan.duration_months} شهر</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{formatSypNumber(Number(plan.price))} {currencyName("SYP")} · {plan.is_active ? "متاحة" : "متوقفة"}</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{plan.description || "بدون وصف"}</Text></View></View><View style={styles.actions}><AppButton title="تعديل" variant="outline" onPress={() => beginPlan(plan)} /><AppButton title={plan.is_active ? "إيقاف الخطة" : "تفعيل الخطة"} variant={plan.is_active ? "danger" : "secondary"} onPress={() => void togglePlan(plan)} loading={busy} /></View></View>) : <Empty text="أضف خطة واحدة على الأقل حتى يتمكن التاجر من تقديم طلبه." />}</>}
      </> : null}
      {error ? <><Text style={[styles.error, { color: colors.error }]}>{error}</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={() => void refresh(true, true)} loading={refreshing} /></> : null}
    </ScrollView>

    <AppModal visible={Boolean(selectedRequest)} title={selectedRequest?.decision === "accepted" ? "تأكيد الموافقة" : selectedRequest?.decision === "rejected" ? "رفض الطلب" : "طلب استكمال معلومات"} message={selectedRequest?.decision === "accepted" ? "سيتم اعتماد الحساب وإنشاء المتجر أو محفظة السائق حسب نوع الطلب." : "أضف ملاحظة واضحة لتظهر لصاحب الطلب."} confirmText={selectedRequest?.decision === "accepted" ? "موافقة" : "حفظ القرار"} cancelText="رجوع" busy={busy} onCancel={() => { setSelectedRequest(null); setError(""); }} onConfirm={() => void review()}>{error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}{selectedRequest?.decision === "accepted" && selectedRequest.role === "merchant" ? <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>يتم إنشاء المتجر وتفعيل الاشتراك وإصدار فاتورة مستحقة، ولا يُعتبر المبلغ مدفوعًا.</Text> : null}{selectedRequest?.decision !== "accepted" ? <AppTextField label="ملاحظة للإجابة أو سبب الرفض" value={reviewNote} onChangeText={setReviewNote} multiline placeholder="اكتب ملاحظة مفيدة لصاحب الطلب" /> : null}</AppModal>

    <AppModal visible={Boolean(walletTarget)} title={`عملية ${transactionTitle}`} message={`${walletTarget?.profile.full_name ?? ""} · الرصيد الحالي ${(walletTarget ? formatSypNumber(walletTarget.balance) : "—")} ${walletTarget ? currencyName(walletTarget.currency) : ""}`} confirmText="حفظ العملية" cancelText="إلغاء" busy={busy} onCancel={() => { setWalletTarget(null); setError(""); }} onConfirm={() => void saveWalletOperation()}>
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

      <AppTextField label="وصف الخطة" value={planDescription} onChangeText={setPlanDescription} multiline />
    </AppModal>

    <AppModal visible={Boolean(message)} title="تمت العملية" message={message} onCancel={() => setMessage("")} />
    <AppModal visible={Boolean(error && !selectedRequest && !walletTarget && !planModalOpen)} title="تعذر إكمال العملية" message={error} onCancel={() => setError("")} />
  </View>;
}

function Metric({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) { const { colors } = useTheme(); const content = <><Text style={[styles.metricValue, { color: colors.primary }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text></>; return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [styles.metric, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}>{content}</Pressable> : <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>{content}</View>; }
function ActionRow({ label, value, onPress }: { label: string; value: number; onPress: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.72 : 1 }]}><Text style={[styles.actionValue, { color: value > 0 ? colors.accent : colors.textMuted }]}>{value}</Text><Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text></Pressable>; }
function Empty({ text }: { text: string }) { const { colors } = useTheme(); return <Text style={[styles.empty, { backgroundColor: colors.surfaceSecondary, color: colors.textSecondary }]}>{text}</Text>; }
function RequestCard({ row, role, profile, onDecision }: { row: RequestRow; role: Role; profile?: Profile; onDecision: (decision: "accepted" | "rejected" | "changes_requested") => void }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{role === "merchant" ? row.store_name : row.full_name || profile?.full_name || "طلب سائق"}</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{profile?.email ?? ""} · {row.contact_phone}</Text></View><Text style={[styles.badge, { color: row.status === "accepted" ? colors.success : colors.accent, backgroundColor: colors.surfaceSecondary }]}>{statusName[row.status] ?? row.status}</Text></View>
    {role === "merchant" ? <><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>تصنيف المتجر: {(Array.isArray(row.store_categories) ? row.store_categories[0]?.name : row.store_categories?.name) ?? "غير محدد"} · العنوان: {row.store_address}</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>الخطة: {row.plan_name_snapshot} · {formatSypNumber(Number(row.plan_price_snapshot ?? 0))} {currencyName(row.plan_currency_snapshot ?? "SYP")} · {row.plan_duration_months_snapshot ?? "—"} شهر</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>العمولة: {row.plan_commission_rate_snapshot == null ? "غير مهيأة" : `${row.plan_commission_rate_snapshot}%`} · حد المنتجات: {row.plan_product_limit_snapshot ?? "غير مهيأ"}{row.plan_features_snapshot?.length ? ` · المزايا: ${row.plan_features_snapshot.join("، ")}` : ""}</Text></> : <><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>المركبة: {row.vehicle_type} · العقد: {row.contract_duration_months} أشهر</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>الأوقات المتاحة: {row.available_hours?.schedule ?? "غير محددة"}</Text></>}
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
  backgroundRefresh: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: Spacing.two, minHeight: 24 },
  refreshText: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
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
  actionRows: { gap: Spacing.two },
  actionRow: { minHeight: 46, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, flexDirection: "row-reverse", alignItems: "center", gap: Spacing.three },
  actionValue: { minWidth: 28, fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "center" },
  actionLabel: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "right" },
  actions: { flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" },
  walletBalance: { fontFamily: Fonts.bold, fontSize: FontSizes.md },
  empty: { padding: Spacing.four, borderRadius: Radius.md, textAlign: "right", fontFamily: Fonts.regular, lineHeight: 24 },
  choiceRow: { flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" },
  choice: { flexGrow: 1, minHeight: 40, paddingHorizontal: Spacing.two, borderWidth: 1, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  error: { padding: Spacing.three, borderRadius: Radius.md, textAlign: "right", fontFamily: Fonts.medium },
});
