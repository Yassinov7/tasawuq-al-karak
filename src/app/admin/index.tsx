import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { WorkspaceEmptyState, WorkspaceFrame, WorkspaceMetric, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type Stats = { customers: number; ordersToday: number; stores: number; pending: number; totalSyp: number; totalUsd: number; commissionSyp: number; commissionUsd: number };
type OrderValue = { total: number; currency: "SYP" | "USD"; status: string };
type CommissionValue = { commission_amount: number; currency: "SYP" | "USD" };
type UserRoleRow = { user_id: string; role: string };
type Task = { title: string; detail: string; path: string; icon: React.ComponentProps<typeof AppIcon>["name"]; tone: "green" | "gold" | "neutral" };

const initialStats: Stats = { customers: 0, ordersToday: 0, stores: 0, pending: 0, totalSyp: 0, totalUsd: 0, commissionSyp: 0, commissionUsd: 0 };
const tasks: Task[] = [
  { title: "مراجعة الانضمام", detail: "التجار والمتاجر الجديدة", path: "/admin/merchants", icon: "checkmark-done-outline", tone: "gold" },
  { title: "الطلبات", detail: "متابعة الحالة والتوصيل", path: "/admin/orders", icon: "receipt-outline", tone: "green" },
  { title: "المالية", detail: "التحصيل وفواتير المتاجر", path: "/admin/finance", icon: "wallet-outline", tone: "green" },
  { title: "السائقون", detail: "الإدارة وإسناد الطلبات", path: "/admin/drivers", icon: "bicycle-outline", tone: "neutral" },
  { title: "الاشتراكات", detail: "خطط المتاجر والعمولات", path: "/admin/subscriptions", icon: "card-outline", tone: "neutral" },
  { title: "مناطق التوصيل", detail: "المناطق ورسومها", path: "/admin/zones", icon: "map-outline", tone: "neutral" },
  { title: "سجل الإدارة", detail: "التغييرات على المنصة", path: "/admin/audit", icon: "document-text-outline", tone: "neutral" },
];

export default function AdminHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const today = start.toISOString();
    const [stores, pendingMerchants, pendingStores, dailyOrderCount] = await Promise.all([
      supabase.from("stores").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("merchants").select("id", { count: "exact", head: true }).eq("approval", "pending"),
      supabase.from("stores").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", today),
    ]);
    if (stores.error || pendingMerchants.error || pendingStores.error || dailyOrderCount.error) {
      setLoading(false);
      setFailed(true);
      return;
    }
    const roles: UserRoleRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("user_roles").select("user_id,role").order("user_id").order("role").range(offset, offset + 499);
      if (error) { setLoading(false); setFailed(true); return; }
      roles.push(...(data ?? []) as UserRoleRow[]);
      if (!data || data.length < 500) break;
    }
    const rolesByUser = new Map<string, Set<string>>();
    for (const row of roles) {
      const userRoles = rolesByUser.get(row.user_id) ?? new Set<string>();
      userRoles.add(row.role);
      rolesByUser.set(row.user_id, userRoles);
    }
    const customerCount = [...rolesByUser.values()].filter((userRoles) => userRoles.has("customer") && !userRoles.has("admin") && !userRoles.has("merchant") && !userRoles.has("driver")).length;
    const orderRows: OrderValue[] = [];
    const commissionRows: CommissionValue[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("orders").select("total,currency,status").gte("created_at", today).order("created_at").range(offset, offset + 499);
      if (error) { setLoading(false); setFailed(true); return; }
      orderRows.push(...(data ?? []) as OrderValue[]);
      if (!data || data.length < 500) break;
    }
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("merchant_invoices").select("commission_amount,currency").gte("issued_at", today).in("status", ["payable", "partially_settled", "settled"]).order("issued_at").range(offset, offset + 499);
      if (error) { setLoading(false); setFailed(true); return; }
      commissionRows.push(...(data ?? []) as CommissionValue[]);
      if (!data || data.length < 500) break;
    }
    setLoading(false);
    const totals = orderRows.filter((row) => row.status !== "cancelled").reduce((sum, row) => {
      if (row.currency === "USD") sum.usd += Number(row.total); else sum.syp += Number(row.total);
      return sum;
    }, { syp: 0, usd: 0 });
    const commissions = commissionRows.reduce((sum, row) => {
      if (row.currency === "USD") sum.usd += Number(row.commission_amount); else sum.syp += Number(row.commission_amount);
      return sum;
    }, { syp: 0, usd: 0 });
    setStats({ customers: customerCount, ordersToday: dailyOrderCount.count ?? 0, stores: stores.count ?? 0, pending: (pendingMerchants.count ?? 0) + (pendingStores.count ?? 0), totalSyp: totals.syp, totalUsd: totals.usd, commissionSyp: commissions.syp, commissionUsd: commissions.usd });
  }, []);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  const money = (syp: number, usd: number) => `${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })} $ · ${syp.toLocaleString("en-US", { maximumFractionDigits: 0 })} ل.س`;

  return <WorkspaceFrame title="نظرة عامة">
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.welcome, { backgroundColor: colors.primary }]}>
        <View style={styles.welcomeTop}>
          <View style={styles.welcomeIcon}><AppIcon name="sparkles-outline" size={23} color={colors.surface} /></View>
          <View style={styles.welcomeCopy}>
            <Text style={[styles.eyebrow, { color: colors.surface }]}>مساحة تشغيل المنصة</Text>
            <Text style={[styles.welcomeTitle, { color: colors.surface }]}>أهلًا بك في إدارة تسوق</Text>
          </View>
        </View>
        <Text style={[styles.welcomeDetail, { color: colors.surface }]}>ملخص مباشر يساعدك على معرفة ما يحتاج إلى متابعة اليوم.</Text>
        <Text style={[styles.date, { color: colors.surface }]}>{new Date().toLocaleDateString("ar-SY", { weekday: "long", day: "numeric", month: "long" })}</Text>
      </View>

      <View style={styles.titleRow}>
        <Pressable accessibilityRole="button" onPress={() => void load()} disabled={loading} style={[styles.refresh, { backgroundColor: colors.primaryLight }]}><AppIcon name="refresh-outline" size={18} color={colors.primary} /></Pressable>
        <View style={{ flex: 1 }}><WorkspaceTitle title="مؤشرات اليوم" detail="تُقرأ مباشرة من بيانات المنصة." /></View>
      </View>
      {loading ? <View style={{ paddingVertical: 24 }}><ActivityIndicator color={colors.primary} /></View> : failed ? <WorkspaceEmptyState icon="cloud-offline-outline" title="تعذر تحديث المؤشرات" detail="تحقق من اتصال الإنترنت ثم أعد المحاولة." actionLabel="إعادة المحاولة" onAction={() => void load()} /> : <View style={styles.metricGrid}>
        <WorkspaceMetric label="حسابات العملاء" value={stats.customers.toLocaleString("en-US")} icon="people-outline" detail="دون أدوار التاجر أو السائق أو الإدارة" />
        <WorkspaceMetric label="طلبات اليوم" value={stats.ordersToday.toLocaleString("en-US")} icon="receipt-outline" accent />
        <WorkspaceMetric label="المتاجر المعتمدة" value={stats.stores.toLocaleString("en-US")} icon="storefront-outline" />
        <WorkspaceMetric label="بانتظار المراجعة" value={stats.pending.toLocaleString("en-US")} icon="time-outline" accent detail="حساب تاجر أو متجر" />
        <WorkspaceMetric label="قيمة الطلبات اليوم" value={money(stats.totalSyp, stats.totalUsd)} icon="cash-outline" />
        <WorkspaceMetric label="عمولات الفواتير المكتملة اليوم" value={money(stats.commissionSyp, stats.commissionUsd)} icon="trending-up-outline" accent />
      </View>}

      <View style={styles.tasksHeading}><WorkspaceTitle title="إدارة المنصة" detail="اختر القسم للانتقال مباشرةً إلى عمله." /></View>
      <View style={styles.taskGrid}>{tasks.map((task) => <Pressable key={task.path} onPress={() => router.push(task.path as never)} style={({ pressed }) => [styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.78, transform: [{ scale: 0.985 }] }]}>
        <View style={[styles.taskIcon, { backgroundColor: task.tone === "gold" ? colors.accentLight : task.tone === "green" ? colors.primaryLight : colors.surfaceSecondary }]}><AppIcon name={task.icon} size={21} color={task.tone === "gold" ? colors.accent : colors.primary} /></View>
        <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
        <Text style={[styles.taskDetail, { color: colors.textSecondary }]}>{task.detail}</Text>
        <AppIcon name="arrow-back" size={16} color={colors.textMuted} style={styles.taskArrow} />
      </Pressable>)}</View>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/home")} style={[styles.marketplaceLink, { borderColor: colors.border }]}><AppIcon name="cart-outline" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontFamily: Fonts.semiBold }}>العودة إلى واجهة العميل</Text></Pressable>
    </ScrollView>
  </WorkspaceFrame>;
}

const styles = StyleSheet.create({ content: { paddingTop: 16, paddingBottom: 50 }, welcome: { marginHorizontal: 16, padding: 18, borderRadius: Radius.xl }, welcomeTop: { flexDirection: "row-reverse", alignItems: "center", gap: 12 }, welcomeIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(255,255,255,0.17)" }, welcomeCopy: { flex: 1, alignItems: "flex-end" }, eyebrow: { opacity: 0.8, fontFamily: Fonts.medium, fontSize: 11 }, welcomeTitle: { marginTop: 4, fontFamily: Fonts.bold, fontSize: 19, textAlign: "right" }, welcomeDetail: { marginTop: 13, lineHeight: 21, textAlign: "right", fontFamily: Fonts.regular, fontSize: 13, opacity: 0.92 }, date: { marginTop: 12, textAlign: "right", fontFamily: Fonts.medium, fontSize: 11, opacity: 0.78 }, titleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 4, marginTop: 2 }, refresh: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, marginStart: 16 }, metricGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginHorizontal: 16, marginTop: 10 }, tasksHeading: { marginTop: 4 }, taskGrid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", marginHorizontal: 16, marginTop: 10, rowGap: 10 }, taskCard: { width: "48.5%", minHeight: 132, padding: 13, borderWidth: 1, borderRadius: 17 }, taskIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13 }, taskTitle: { marginTop: 10, textAlign: "right", fontFamily: Fonts.bold, fontSize: 14 }, taskDetail: { marginTop: 4, textAlign: "right", fontFamily: Fonts.regular, fontSize: 11, lineHeight: 17 }, taskArrow: { position: "absolute", left: 12, bottom: 13 }, marketplaceLink: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginTop: 22, padding: 13, borderWidth: 1, borderRadius: 14 } });
