import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import {
  WorkspaceButton,
  WorkspaceCard,
  WorkspaceFrame,
  WorkspaceTitle,
} from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";

type SubOrder = {
  id: string;
  status: string;
  subtotal: number;
  order_id: string;
  stores: { name: string } | { name: string }[] | null;
  orders:
    | { order_number: number; currency: string; created_at: string }
    | { order_number: number; currency: string; created_at: string }[]
    | null;
  order_items: {
    id: string;
    product_name: string;
    quantity: number;
    selling_unit: string;
  }[];
};
const labels: Record<string, string> = {
  pending: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  ready: "جاهز",
  out_for_delivery: "مع السائق",
  delivered: "مكتمل",
  cancelled: "ملغى",
};
export default function MerchantOrders() {
  const { colors } = useTheme();
  const { stores } = useWorkspace();
  const [orders, setOrders] = useState<SubOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    const ids = stores.map((store) => store.id);
    if (!ids.length) {
      setOrders([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("sub_orders")
      .select(
        "id,status,subtotal,order_id,stores(name),orders(order_number,currency,created_at),order_items(id,product_name,quantity,selling_unit)",
      )
      .in("store_id", ids)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) Alert.alert("تعذر تحميل الطلبات", "حاول تحديث الشاشة.");
    else setOrders((data ?? []) as unknown as SubOrder[]);
  }, [stores]);
  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  const setStatus = async (
    row: SubOrder,
    next: "confirmed" | "preparing" | "ready",
  ) => {
    const { error } = await supabase.rpc("set_store_sub_order_status", {
      target_sub_order: row.id,
      next_status: next,
      note: null,
    });
    if (error)
      Alert.alert("تعذر تحديث الطلب", "تأكد من حالة الطلب وحاول مرة أخرى.");
    else await refresh();
  };
  const cancel = async (row: SubOrder, reason: "out_of_stock" | "store_unavailable" | "operational_issue", note: string) => {
    const { error } = await supabase.rpc("cancel_store_sub_order", { target_sub_order: row.id, reason, note });
    if (error) Alert.alert("تعذر الإلغاء", reason === "out_of_stock" ? "يمكن إلغاء الطلب لهذا السبب فقط إذا كان أحد المنتجات المطلوبة غير متاح." : "لا يمكن إلغاء هذا الطلب في حالته الحالية.");
    else await refresh();
  };
  const confirmCancel = (row: SubOrder, reason: "out_of_stock" | "store_unavailable" | "operational_issue", note: string) => Alert.alert("تأكيد الإلغاء", `سبب الإلغاء: ${note}`, [{ text: "رجوع", style: "cancel" }, { text: "تأكيد", style: "destructive", onPress: () => { void cancel(row, reason, note); } }]);
  return (
    <WorkspaceFrame title="طلبات المتاجر">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <WorkspaceTitle
          title="طلبات الفروع"
          detail="تغييرات الحالة تسجل تلقائيًا في سجل الطلب."
        />
        {loading ? (
          <Text style={{ textAlign: "center", margin: 20 }}>
            جارٍ تحميل الطلبات…
          </Text>
        ) : null}
        {orders.map((row) => {
          const store = Array.isArray(row.stores) ? row.stores[0] : row.stores;
          const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
          return (
            <View key={row.id}>
              <WorkspaceCard
                title={`طلب #${order?.order_number ?? "—"} · ${store?.name ?? "متجر"}`}
                detail={`${labels[row.status] ?? row.status} · ${Number(row.subtotal).toLocaleString("en-US")} ${order?.currency === "USD" ? "$" : "ل.س"} · ${row.order_items.length} صنف`}
                icon="receipt-outline"
              />
              {row.order_items.map((item) => (
                <Text
                  key={item.id}
                  style={{
                    marginHorizontal: 24,
                    marginTop: 4,
                    textAlign: "right",
                    color: colors.textSecondary,
                  }}
                >
                  {item.product_name} · {item.quantity} {item.selling_unit}
                </Text>
              ))}
              {row.status === "pending" ? (
                <>
                  <WorkspaceButton
                    title="قبول الطلب"
                    onPress={() => void setStatus(row, "confirmed")}
                  />
                  <WorkspaceButton
                    title="إلغاء بسبب نفاد منتج"
                    onPress={() => confirmCancel(row, "out_of_stock", "نفاد منتج")}
                    danger
                  />
                  <WorkspaceButton title="إلغاء لتعذر تشغيل المتجر" onPress={() => confirmCancel(row, "store_unavailable", "تعذر تشغيل المتجر")} danger />
                  <WorkspaceButton title="إلغاء لسبب تشغيلي" onPress={() => confirmCancel(row, "operational_issue", "سبب تشغيلي")} danger />
                </>
              ) : null}
              {row.status === "confirmed" ? (
                <WorkspaceButton
                  title="بدء التجهيز"
                  onPress={() => void setStatus(row, "preparing")}
                />
              ) : null}
              {row.status === "preparing" ? (
                <WorkspaceButton
                  title="جاهز للتوصيل"
                  onPress={() => void setStatus(row, "ready")}
                />
              ) : null}
            </View>
          );
        })}
        {!loading && !orders.length ? (
          <Pressable onPress={() => void refresh()}>
            <Text
              style={{
                padding: 24,
                textAlign: "center",
                color: colors.textSecondary,
              }}
            >
              لا توجد طلبات حاليًا. اضغط للتحديث.
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </WorkspaceFrame>
  );
}
