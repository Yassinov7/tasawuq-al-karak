import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { WorkspaceButton, WorkspaceCard, WorkspaceConfirmModal, WorkspaceEmptyState, WorkspaceFrame, WorkspaceStatus, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";

type Delivery = {
  id: string;
  status: string;
  assigned_driver_id: string;
  driver_accepted_at: string | null;
  orders: { order_number: number; customer_note: string; customer_addresses: { recipient_name: string; phone: string; address: string; delivery_zones: { name: string; region_name: string } | { name: string; region_name: string }[] | null } | null } | { order_number: number; customer_note: string; customer_addresses: { recipient_name: string; phone: string; address: string; delivery_zones: { name: string; region_name: string } | { name: string; region_name: string }[] | null } | null }[] | null;
  stores: { name: string } | { name: string }[] | null;
  order_items: { id: string; product_name: string; quantity: number; selling_unit: string }[];
};
type DeliveryOffer = { sub_order_id: string; order_number: number; store_name: string; zone_label: string | null; item_count: number; created_at: string };
type Confirmation = { title: string; detail: string; label: string; run: () => Promise<void> };
const statusNames: Record<string, string> = { ready: "جاهز للاستلام", out_for_delivery: "قيد التوصيل" };

export default function DriverHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { driverApproval, driverActive } = useWorkspace();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [offers, setOffers] = useState<DeliveryOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [assignedResult, offerResult] = await Promise.all([
      supabase.from("sub_orders").select("id,status,assigned_driver_id,driver_accepted_at,stores(name),orders!inner(order_number,customer_note,customer_addresses(recipient_name,phone,address,delivery_zones(name,region_name))),order_items(id,product_name,quantity,selling_unit)").in("status", ["ready", "out_for_delivery"]).not("assigned_driver_id", "is", "null").order("created_at", { ascending: false }),
      supabase.rpc("get_driver_delivery_offers"),
    ]);
    setLoading(false);
    if (assignedResult.error || offerResult.error) {
      Alert.alert("تعذر تحديث قائمة التوصيل", "تحقق من تطبيق الترحيل الجديد واتصال الإنترنت ثم حاول مجددًا.");
      return;
    }
    setDeliveries((assignedResult.data ?? []) as unknown as Delivery[]);
    setOffers((offerResult.data ?? []) as unknown as DeliveryOffer[]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (driverApproval === "approved" && driverActive) void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [driverApproval, driverActive, refresh]);

  const acceptOffer = async (offer: DeliveryOffer) => {
    setSavingId(offer.sub_order_id);
    const { error } = await supabase.rpc("driver_accept_sub_order", { target_sub_order: offer.sub_order_id });
    setSavingId(null);
    if (error) {
      setConfirmation(null);
      Alert.alert("تعذر قبول التوصيلة", "ربما قبلها سائق آخر. حدّث القائمة للاطلاع على المهام المتاحة.");
      return;
    }
    setConfirmation(null);
    await refresh();
  };

  const advanceDelivery = async (delivery: Delivery) => {
    const next = delivery.status === "ready" ? "out_for_delivery" : "delivered";
    setSavingId(delivery.id);
    const { error } = await supabase.rpc("driver_set_sub_order_status", { target_sub_order: delivery.id, next_status: next, status_note: null });
    setSavingId(null);
    if (error) {
      setConfirmation(null);
      Alert.alert("تعذر تحديث حالة التوصيلة", "قد تكون المهمة تغيرت لدى سائق آخر. حدّث القائمة وحاول مجددًا.");
      return;
    }
    setConfirmation(null);
    await refresh();
  };

  if (driverApproval !== "approved" || !driverActive) return <WorkspaceFrame title="مساحة السائق"><WorkspaceEmptyState icon="lock-closed-outline" title="حساب السائق غير مفعل" detail="ستظهر المهام بعد اعتماد حسابك وتفعيله من الإدارة." /></WorkspaceFrame>;

  return <WorkspaceFrame title="مساحة السائق">
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <WorkspaceTitle title="مهام التوصيل" detail="اقبل طلبًا متاحًا مباشرةً أو تابع الطلبات التي قبلتها." />
      <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginHorizontal: 16, marginTop: 14, marginBottom: 4 }}>
        <WorkspaceStatus label={`${offers.length} متاحة`} color={colors.accent} />
        <Pressable accessibilityRole="button" accessibilityLabel="تحديث التوصيلات" onPress={() => void refresh()} disabled={loading} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primaryLight }}><AppIcon name="refresh-outline" size={18} color={colors.primary} /></Pressable>
      </View>

      <WorkspaceTitle title="طلبات متاحة" detail="تظهر لك المنطقة والمتجر قبل قبول المهمة. بيانات الزبون تظهر بعد قبولها." />
      {offers.map((offer) => <View key={offer.sub_order_id} style={{ marginHorizontal: 16, marginTop: 9, padding: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: colors.text, fontWeight: "700", textAlign: "right" }}>طلب #{offer.order_number}</Text><WorkspaceStatus label="متاح" color={colors.accent} /></View>
        <Text style={{ color: colors.textSecondary, textAlign: "right", marginTop: 7 }}>{offer.store_name} · {offer.zone_label ?? "المنطقة غير محددة"}</Text>
        <Text style={{ color: colors.textMuted, textAlign: "right", marginTop: 4 }}>{offer.item_count} منتج · {new Date(offer.created_at).toLocaleDateString("ar-SY")}</Text>
        <WorkspaceButton title={savingId === offer.sub_order_id ? "جارٍ قبول المهمة…" : "قبول التوصيلة"} disabled={savingId !== null || loading} onPress={() => setConfirmation({ title: "قبول التوصيلة", detail: `سيُسند طلب #${offer.order_number} من ${offer.store_name} إليك. بعد القبول ستظهر بيانات الزبون وعنوان التسليم.`, label: "تأكيد القبول", run: () => acceptOffer(offer) })} />
      </View>)}
      {!loading && offers.length === 0 ? <WorkspaceEmptyState icon="file-tray-outline" title="لا توجد طلبات متاحة الآن" detail="ستظهر هنا الطلبات الجاهزة التي لم يقبلها سائق بعد." /> : null}

      <WorkspaceTitle title="التوصيلات المسندة إليك" detail="تنتقل المهمة إلى قيد التوصيل ثم تُغلق عند التسليم." />
      {deliveries.map((delivery) => {
        const order = Array.isArray(delivery.orders) ? delivery.orders[0] : delivery.orders;
        const address = order?.customer_addresses;
        const zone = address ? (Array.isArray(address.delivery_zones) ? address.delivery_zones[0] : address.delivery_zones) : null;
        const store = Array.isArray(delivery.stores) ? delivery.stores[0] : delivery.stores;
        return <View key={delivery.id} style={{ marginTop: 8 }}>
          <WorkspaceCard title={`طلب #${order?.order_number ?? "—"} · ${store?.name ?? "المتجر"}`} detail={`${statusNames[delivery.status] ?? delivery.status} · ${address?.recipient_name ?? "الزبون"} · ${address?.phone ?? ""}`} icon="bicycle-outline" />
          <View style={{ marginHorizontal: 20, marginTop: 6, padding: 12, borderRadius: 14, backgroundColor: colors.surfaceSecondary }}>
            <Text style={{ color: colors.text, textAlign: "right" }}>{address?.address ?? "عنوان غير متاح"}</Text>
            {zone ? <Text style={{ color: colors.textSecondary, textAlign: "right", marginTop: 4 }}>{zone.region_name} · {zone.name}</Text> : null}
            {delivery.driver_accepted_at ? <Text style={{ color: colors.textMuted, textAlign: "right", marginTop: 4 }}>تاريخ قبول المهمة: {new Date(delivery.driver_accepted_at).toLocaleString("ar-SY")}</Text> : null}
            {delivery.order_items.map((item) => <Text key={item.id} style={{ color: colors.textSecondary, marginTop: 4, textAlign: "right" }}>{item.product_name} · {item.quantity} {item.selling_unit}</Text>)}
          </View>
          <WorkspaceButton title={savingId === delivery.id ? "جارٍ التحديث…" : delivery.status === "ready" ? "بدء التوصيل" : "تأكيد تسليم الطلب"} onPress={() => setConfirmation({ title: delivery.status === "ready" ? "بدء التوصيل" : "تأكيد التسليم", detail: delivery.status === "ready" ? `بدأت توصيل طلب #${order?.order_number ?? "—"} إلى ${address?.recipient_name ?? "الزبون"}.` : `هل تم تسليم طلب #${order?.order_number ?? "—"} إلى ${address?.recipient_name ?? "الزبون"}؟`, label: delivery.status === "ready" ? "بدء التوصيل" : "تأكيد التسليم", run: () => advanceDelivery(delivery) })} disabled={savingId !== null || loading} />
        </View>;
      })}
      {!loading && deliveries.length === 0 ? <WorkspaceEmptyState icon="bicycle-outline" title="لا توجد مهام مسندة إليك" detail="اقبل طلبًا من قائمة الطلبات المتاحة لبدء التوصيل." /> : null}
      {loading ? <Text style={{ padding: 14, textAlign: "center", color: colors.textSecondary }}>جارٍ تحديث المهام…</Text> : null}
      <WorkspaceCard title="العودة إلى التسوق" detail="انتقل إلى واجهة العميل بالحساب نفسه" icon="cart-outline" onPress={() => router.replace("/home")} />
    </ScrollView>
    <WorkspaceConfirmModal visible={confirmation !== null} title={confirmation?.title ?? "تأكيد الإجراء"} detail={confirmation?.detail ?? ""} confirmLabel={confirmation?.label} busy={savingId !== null} onConfirm={() => { if (confirmation) void confirmation.run(); }} onCancel={() => setConfirmation(null)} />
  </WorkspaceFrame>;
}
