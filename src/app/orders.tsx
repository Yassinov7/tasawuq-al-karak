import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type Status = "pending" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
type Filter = "all" | "active" | "completed" | "cancelled";
type Order = { id: string; order_number: number; status: Status; total: number; currency: "SYP" | "USD"; created_at: string; sub_orders: { id: string; order_items: { id: string }[] }[] };
const labels: Record<Status, string> = { pending: "بانتظار التأكيد", confirmed: "تم التأكيد", preparing: "قيد التجهيز", ready: "جاهز", out_for_delivery: "في الطريق", delivered: "تم التسليم", cancelled: "ملغى" };
const activeStatuses: Status[] = ["pending", "confirmed", "preparing", "ready", "out_for_delivery"];

export default function OrdersScreen() {
  const router = useRouter(); const { colors } = useTheme(); const { itemCount } = useCart(); const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [filter, setFilter] = useState<Filter>("all");
  const refresh = useCallback(async () => {
    if (!user) { setOrders([]); setLoading(false); return; }
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("orders").select("id,order_number,status,total,currency,created_at,sub_orders(id,order_items(id))").eq("customer_id", user.id).order("created_at", { ascending: false });
    if (queryError) setError("تعذر تحميل الطلبات حالياً."); else setOrders((data ?? []) as unknown as Order[]);
    setLoading(false);
  }, [user]);
  useEffect(() => { const timer = setTimeout(() => { void refresh(); }, 0); return () => clearTimeout(timer); }, [refresh]);
  const visible = useMemo(() => orders.filter((order) => filter === "all" || (filter === "active" && activeStatuses.includes(order.status)) || (filter === "completed" && order.status === "delivered") || (filter === "cancelled" && order.status === "cancelled")), [orders, filter]);
  const statusColor = (status: Status) => status === "cancelled" ? colors.error : status === "delivered" ? colors.primary : colors.accent;
  const money = (amount: number, currency: string) => `${Number(amount).toLocaleString("en-US")} ${currency === "USD" ? "$" : "ل.س"}`;
  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <AppHeader title="طلباتي" showBack cartCount={itemCount} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>طلباتك</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>تابع طلباتك الحالية والسابقة بسهولة</Text>
      <View style={styles.filters}>{(["all", "active", "completed", "cancelled"] as Filter[]).map((key, i) => <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filter, { backgroundColor: filter === key ? colors.primary : colors.surface, borderColor: colors.border }]}><Text style={{ color: filter === key ? colors.surface : colors.text }}>{["الكل", "جارية", "مكتملة", "ملغاة"][i]}</Text></Pressable>)}</View>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.state} /> : error ? <Pressable onPress={() => void refresh()} style={styles.state}><Text style={{ color: colors.error }}>{error} اضغط لإعادة المحاولة</Text></Pressable> : visible.length ? visible.map((order) => <Pressable key={order.id} onPress={() => router.push({ pathname: "/order-details", params: { id: order.id } })} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}><Text style={[styles.orderNo, { color: colors.text }]}>طلب #{order.order_number}</Text><Text style={{ color: statusColor(order.status) }}>{labels[order.status]}</Text></View>
        <Text style={[styles.date, { color: colors.textMuted }]}>{new Date(order.created_at).toLocaleString("ar-SY")}</Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}><Text style={{ color: colors.textSecondary }}>{order.sub_orders?.length ?? 0} متجر · {order.sub_orders?.reduce((sum, sub) => sum + (sub.order_items?.length ?? 0), 0) ?? 0} منتج</Text><Text style={[styles.total, { color: colors.primary }]}>{money(order.total, order.currency)}</Text></View>
      </Pressable>) : <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><AppIcon name="receipt-outline" size={38} color={colors.textMuted} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا توجد طلبات في هذا القسم بعد.</Text></View>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: Spacing.four, paddingBottom: Spacing.ten }, title: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, textAlign: "right" }, subtitle: { marginTop: 4, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" }, filters: { flexDirection: "row-reverse", gap: 8, marginVertical: Spacing.four }, filter: { flex: 1, alignItems: "center", padding: 10, borderWidth: 1, borderRadius: Radius.full }, card: { padding: Spacing.four, marginBottom: Spacing.three, borderWidth: 1, borderRadius: Radius.xl }, row: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, orderNo: { fontFamily: Fonts.bold, fontSize: FontSizes.md }, date: { marginTop: 5, textAlign: "right", fontSize: FontSizes.xs }, divider: { height: 1, marginVertical: Spacing.three }, total: { fontFamily: Fonts.bold, fontSize: FontSizes.md }, state: { padding: Spacing.six, alignItems: "center" }, empty: { alignItems: "center", padding: Spacing.six, borderWidth: 1, borderRadius: Radius.xl }, emptyText: { marginTop: Spacing.three, fontFamily: Fonts.medium } });
