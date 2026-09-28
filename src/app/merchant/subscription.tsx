import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { WorkspaceEmptyState, WorkspaceFrame, WorkspaceStatus, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";

type SubscriptionRow = { id: string; status: string; starts_at: string | null; expires_at: string | null; price_snapshot: number | string; currency_snapshot: string; duration_months_snapshot: number; commission_rate_override: number | string | null; commission_rate_snapshot: number | string; created_at: string; subscription_plans: { name: string } | { name: string }[] | null };
const labels: Record<string, string> = { pending: "بانتظار تأكيد التفعيل", active: "فعال", expired: "منتهي", cancelled: "ملغى", suspended: "موقوف" };

export default function MerchantSubscription() {
  const { colors } = useTheme();
  const { merchantId, stores } = useWorkspace();
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const refresh = useCallback(async () => {
    if (!merchantId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("merchant_subscriptions").select("id,status,starts_at,expires_at,price_snapshot,currency_snapshot,duration_months_snapshot,commission_rate_override,commission_rate_snapshot,created_at,subscription_plans(name)").eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(30);
    setLoading(false);
    if (error) { Alert.alert("تعذر تحميل الاشتراك", "تحقق من اتصال الإنترنت وحاول مرة أخرى."); return; }
    setRows((data ?? []) as unknown as SubscriptionRow[]);
  }, [merchantId]);
  useEffect(() => { const timer = setTimeout(() => { void refresh(); }, 0); return () => clearTimeout(timer); }, [refresh]);
  useEffect(() => { const timer = setTimeout(() => setNow(Date.now()), 0); return () => clearTimeout(timer); }, []);
  const active = rows.find((row) => row.status === "active" && (!row.expires_at || new Date(row.expires_at).getTime() > now));
  const statusColor = (status: string) => status === "active" ? colors.primary : ["expired", "cancelled", "suspended"].includes(status) ? colors.textMuted : colors.accent;
  return <WorkspaceFrame title="اشتراك المتجر"><ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
    <WorkspaceTitle title="خطة التاجر" detail="الاشتراك يرتبط بحساب التاجر ويغطي كل فروعه المعتمدة." />
    {active ? <View style={{ marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: colors.text, fontWeight: "700" }}>{relationOne(active.subscription_plans)?.name ?? "خطة المتجر"}</Text><WorkspaceStatus label="فعال" color={colors.primary} /></View>
      <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 8 }}>{active.duration_months_snapshot} شهر · {Number(active.price_snapshot).toLocaleString("en-US")} {active.currency_snapshot}</Text>
      <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 4 }}>عمولة المنصة: {Number(active.commission_rate_override ?? active.commission_rate_snapshot).toLocaleString("en-US")}٪</Text>
      <Text style={{ textAlign: "right", color: colors.textMuted, marginTop: 4 }}>يبدأ {active.starts_at ? new Date(active.starts_at).toLocaleDateString("ar-SY") : "—"} · ينتهي {active.expires_at ? new Date(active.expires_at).toLocaleDateString("ar-SY") : "—"}</Text>
      <Text style={{ textAlign: "right", color: colors.primary, marginTop: 8 }}>يشمل {stores.filter((store) => store.status === "approved").length} فرعًا معتمدًا.</Text>
    </View> : !loading && !rows.length ? <WorkspaceEmptyState icon="card-outline" title="لا يوجد اشتراك مسجل" detail="تتولى الإدارة تسجيل خطة التاجر وتأكيد تفعيلها. تواصل مع الإدارة لإضافة اشتراك." /> : null}
    {loading ? <Text style={{ textAlign: "center", padding: 18, color: colors.textSecondary }}>جارٍ تحميل بيانات الاشتراك…</Text> : null}
    <WorkspaceTitle title="سجل الاشتراكات" detail="الأسعار والعمولات محفوظة كما كانت عند تسجيل كل اشتراك." />
    {rows.map((row) => <View key={row.id} style={{ marginHorizontal: 16, marginTop: 9, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: colors.text, fontWeight: "600" }}>{relationOne(row.subscription_plans)?.name ?? "خطة محفوظة"}</Text><WorkspaceStatus label={labels[row.status] ?? row.status} color={statusColor(row.status)} /></View>
      <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 6 }}>{row.duration_months_snapshot} شهر · {Number(row.price_snapshot).toLocaleString("en-US")} {row.currency_snapshot} · عمولة {Number(row.commission_rate_override ?? row.commission_rate_snapshot).toLocaleString("en-US")}٪</Text>
      <Text style={{ textAlign: "right", color: colors.textMuted, marginTop: 4 }}>{row.starts_at ? new Date(row.starts_at).toLocaleDateString("ar-SY") : "لم يبدأ بعد"}{row.expires_at ? ` · حتى ${new Date(row.expires_at).toLocaleDateString("ar-SY")}` : ""}</Text>
    </View>)}
    {!loading && rows.length > 0 && !active ? <Text style={{ margin: 16, textAlign: "right", color: colors.accent }}>لا يوجد اشتراك فعال حاليًا. تواصل مع الإدارة لمتابعة حالة اشتراكك.</Text> : null}
  </ScrollView></WorkspaceFrame>;
}

function relationOne<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
