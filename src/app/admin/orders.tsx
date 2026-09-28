import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { WorkspaceEmptyState, WorkspaceFrame, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type SubOrder = { id: string; status: string; stores: { name: string } | { name: string }[] | null };
type Order = {
  id: string;
  order_number: number;
  status: string;
  currency: string;
  total: number;
  created_at: string;
  payment_method: string;
  payment_status: string;
  sub_orders: SubOrder[] | null;
};
type Filter = "all" | "active" | "delivered" | "cancelled";

const statusLabels: Record<string, string> = {
  pending: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  ready: "جاهز",
  out_for_delivery: "في الطريق",
  delivered: "مكتمل",
  cancelled: "ملغى",
};
const paymentLabels: Record<string, string> = {
  pending: "معلق",
  paid: "مدفوع",
  failed: "فشل",
  refunded: "مسترد",
  partially_refunded: "مسترد جزئيًا",
};
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "قيد التنفيذ" },
  { key: "delivered", label: "مكتملة" },
  { key: "cancelled", label: "ملغاة" },
];

export default function AdminOrders() {
  const router = useRouter();
  const { colors } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from("orders")
      .select("id,order_number,status,currency,total,created_at,payment_method,payment_status,sub_orders(id,status,stores(name))")
      .order("created_at", { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) {
      setLoadError(true);
      Alert.alert("تعذر تحميل الطلبات", "تحقق من صلاحيات الإدارة واتصال الإنترنت.");
      return;
    }
    setOrders((data ?? []) as unknown as Order[]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const visibleOrders = useMemo(() => orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "delivered" || filter === "cancelled") return order.status === filter;
    return !["delivered", "cancelled"].includes(order.status);
  }), [filter, orders]);

  return (
    <WorkspaceFrame title="مراقبة الطلبات">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginEnd: 16 }}>
          <View style={{ flex: 1 }}>
            <WorkspaceTitle title="متابعة الطلبات" detail="راقب حالة الطلب وحالة كل متجر ووسيلة الدفع." />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="تحديث الطلبات" disabled={loading} onPress={() => void refresh()} hitSlop={8} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: colors.primaryLight, opacity: loading ? 0.5 : 1 }}>
            <AppIcon name="refresh-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <View accessibilityRole="radiogroup" style={{ flexDirection: "row-reverse", gap: 8, marginHorizontal: 16, marginTop: 12 }}>
          {filters.map((item) => {
            const selected = filter === item.key;
            return (
              <Pressable key={item.key} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setFilter(item.key)} style={{ flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, borderRadius: 20, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface }}>
                <Text style={{ color: selected ? colors.surface : colors.textSecondary, fontSize: 12, fontWeight: selected ? "700" : "500" }}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? <Text style={{ padding: 20, textAlign: "center", color: colors.textSecondary }}>جارٍ تحميل الطلبات…</Text> : null}
        {!loading && loadError ? <View style={{ marginHorizontal: 16, marginTop: 16 }}><Text style={{ textAlign: "center", color: colors.error }}>تعذر تحميل الطلبات.</Text><Pressable accessibilityRole="button" onPress={() => void refresh()} style={{ padding: 14 }}><Text style={{ textAlign: "center", color: colors.primary, fontWeight: "600" }}>إعادة المحاولة</Text></Pressable></View> : null}

        {!loading && !loadError && visibleOrders.map((order) => {
          const subOrders = order.sub_orders ?? [];
          return (
            <Pressable
              key={order.id}
              accessibilityRole="button"
              accessibilityLabel={`تفاصيل الطلب رقم ${order.order_number}`}
              onPress={() => router.push({ pathname: "/order-details", params: { id: order.id } })}
              style={{ marginHorizontal: 16, marginTop: 10, padding: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12 }}
            >
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>طلب #{order.order_number}</Text>
                <Text style={{ color: order.status === "cancelled" ? colors.error : colors.primary }}>{statusLabels[order.status] ?? order.status}</Text>
              </View>
              <Text style={{ color: colors.textSecondary, textAlign: "right", marginTop: 5 }}>{Number(order.total).toLocaleString("en-US")} {order.currency === "USD" ? "$" : "ل.س"} · الدفع {paymentLabels[order.payment_status] ?? order.payment_status} · {order.payment_method === "cash" ? "نقدًا" : order.payment_method}</Text>
              <Text style={{ color: colors.textMuted, textAlign: "right", marginTop: 4 }}>{new Date(order.created_at).toLocaleString("ar-SY")} · {subOrders.length} متجر</Text>
              {subOrders.map((subOrder) => {
                const store = Array.isArray(subOrder.stores) ? subOrder.stores[0] : subOrder.stores;
                return <Text key={subOrder.id} style={{ color: colors.textSecondary, textAlign: "right", marginTop: 5 }}>{store?.name ?? "متجر"} · {statusLabels[subOrder.status] ?? subOrder.status}</Text>;
              })}
              <Text style={{ color: colors.primary, textAlign: "right", marginTop: 9, fontWeight: "600" }}>عرض التفاصيل</Text>
            </Pressable>
          );
        })}
        {!loading && !loadError && visibleOrders.length === 0 ? <WorkspaceEmptyState icon="receipt-outline" title="لا توجد طلبات في هذا التصنيف" detail={filter === "all" ? "ستظهر الطلبات الجديدة هنا عند تسجيل أول عملية شراء." : "لا توجد طلبات بهذه الحالة حاليًا. اختر تصنيفًا آخر لمتابعة الطلبات."} /> : null}
        {!loading && !loadError && orders.length === 100 ? <Text style={{ marginHorizontal: 16, marginTop: 12, textAlign: "center", color: colors.textMuted, fontSize: 12 }}>يعرض النظام أحدث 100 طلب.</Text> : null}
      </ScrollView>
    </WorkspaceFrame>
  );
}
