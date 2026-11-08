import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { createMerchantOrdersController, initialOrdersState, orderFilters, orderTotal, rejectionError, type MerchantOrder, type OrderFilter, type OrdersState, type OrderStatus } from "@/lib/merchant-orders";
import { groupOrderItems } from "@/lib/order-item-groups";
import { formatSyp } from "@/lib/money";

const filterLabels: Record<OrderFilter, string> = { all: "الكل", awaiting_review: "جديدة", preparing: "قيد التحضير", ready_for_pickup: "جاهزة للاستلام" };
const statusLabels: Record<OrderStatus, string> = { awaiting_review: "بانتظار المراجعة", preparing: "قيد التحضير", ready_for_pickup: "جاهز للاستلام", handed_to_driver: "استلمه السائق", delivered: "تم التسليم", rejected: "معتذر عنه", cancelled: "ملغى" };
const date = (value: string) => new Date(value).toLocaleString("ar-SY", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function MerchantOrdersScreen() {
  const { user } = useAuth();
  return user ? <MerchantOrders key={user.id} ownerId={user.id} /> : null;
}
function MerchantOrders({ ownerId }: { ownerId: string }) {
  const { colors } = useTheme();
  const [state, setState] = useState<OrdersState>(initialOrdersState);
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [target, setTarget] = useState<MerchantOrder | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const controller = useMemo(() => createMerchantOrdersController(ownerId, setState), [ownerId]);
  useFocusEffect(useCallback(() => {
    controller.activate(); setFocused(true); void controller.focus();
    return () => { controller.deactivate(); setFocused(false); setTarget(null); };
  }, [controller]));
  const subscriptions = useMemo(() => state.storeId ? [{ table: "store_orders" as const, filter: `store_id=eq.${state.storeId}` }] : [], [state.storeId]);
  const realtime = useCallback(() => controller.realtime(), [controller]);
  useOrderRealtime({ channelName: `merchant-orders:${state.storeId ?? "none"}`, enabled: focused && Boolean(state.storeId), subscriptions, onChange: realtime });
  const reject = async () => {
    const error = rejectionError(reason); setReasonError(error);
    if (error || !target) return;
    if (await controller.action(target, "rejected", reason)) { setTarget(null); setReason(""); }
  };
  const refresh = () => { void controller.refresh(); };
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <FlatList
      key={`${ownerId}:${state.storeId}:${state.filter}`}
      data={state.rows} keyExtractor={item => item.id}
      contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      initialNumToRender={5} onEndReachedThreshold={0.4} onEndReached={() => { void controller.more(); }}
      refreshing={state.loading} onRefresh={refresh}
      ListHeaderComponent={<View style={styles.header}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {orderFilters.map(filter => <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: state.filter === filter }}
            onPress={() => { setExpanded([]); setTarget(null); void controller.select(filter); }}
            style={({ pressed }) => [styles.filter, { borderColor: state.filter === filter ? colors.primary : colors.borderStrong, backgroundColor: pressed ? colors.surfacePressed : state.filter === filter ? colors.surfaceSelected : colors.surface }]}>
            <Text style={[styles.strong, { color: state.filter === filter ? colors.primary : colors.text }]}>{filterLabels[filter]} · {state.counts?.[filter]?.toLocaleString("ar-SY") ?? "—"}</Text>
          </Pressable>)}
        </ScrollView>
        {state.notice ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.infoForeground, backgroundColor: colors.infoSurface }]}>{state.notice}</Text> : null}
        {state.error ? <View style={[styles.message, { backgroundColor: colors.errorSurface }]}>
          <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.errorForeground }]}>{state.error}</Text>
          <AppButton design="refined" title="إعادة المحاولة" variant="outline" onPress={refresh} disabled={state.loading} />
        </View> : null}
      </View>}
      ListEmptyComponent={<View style={styles.empty}>
        {state.loading ? <><ActivityIndicator color={colors.primary} /><Text style={[styles.body, { color: colors.textSecondary }]}>جارٍ تحميل الطلبات…</Text></> : !state.error ? <>
          <Text style={[styles.strong, { color: colors.text }]}>{state.filter === "all" ? "لا توجد طلبات بعد" : `لا توجد طلبات ${filterLabels[state.filter]}`}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{state.filter === "all" ? "ستظهر طلبات متجرك هنا عند وصولها." : "يمكنك متابعة بقية الحالات من «الكل»."}</Text>
        </> : null}
      </View>}
      ListFooterComponent={<View style={styles.footer}>
        {state.moreLoading ? <ActivityIndicator color={colors.primary} /> : state.moreError ? <>
          <Text style={[styles.body, { color: colors.errorForeground }]}>تعذر تحميل المزيد. الطلبات المعروضة محفوظة.</Text>
          <AppButton design="refined" title="إعادة تحميل المزيد" variant="outline" onPress={() => { controller.retryMore(); void controller.more(); }} />
        </> : state.hasMore ? <AppButton design="refined" title="تحميل المزيد" variant="outline" disabled={state.loading} onPress={() => { void controller.more(); }} /> : null}
      </View>}
      renderItem={({ item }) => <OrderCard order={item} expanded={expanded.includes(item.id)}
        toggle={() => setExpanded(ids => ids.includes(item.id) ? ids.filter(id => id !== item.id) : [...ids, item.id])}
        busy={state.busyIds.includes(item.id)}
        onStart={() => { void controller.action(item, "preparing"); }} onReady={() => { void controller.action(item, "ready_for_pickup"); }}
        onReject={() => { setTarget(item); setReason(""); setReasonError(""); }} />}
    />
    <AppModal design="refined" visible={Boolean(target)} title="الاعتذار عن الطلب" message="اكتب سببًا واضحًا ليصل للزبون ويُحفظ في سجل الطلب."
      destructive confirmText="إرسال الاعتذار" cancelText="رجوع" busy={Boolean(target && state.busyIds.includes(target.id))}
      onCancel={() => setTarget(null)} onConfirm={() => { void reject(); }}>
      <AppTextField label="سبب الاعتذار" value={reason} onChangeText={value => { setReason(value); setReasonError(""); }} multiline maxLength={500} placeholder="مثال: أحد المنتجات غير متوفر" />
      {reasonError ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.errorForeground }]}>{reasonError}</Text> : null}
      {state.notice && target ? <Text style={[styles.body, { color: colors.infoForeground }]}>{state.notice}</Text> : null}
    </AppModal>
  </View>;
}
function OrderCard({ order, expanded, toggle, busy, onStart, onReady, onReject }: {
  order: MerchantOrder; expanded: boolean; toggle: () => void; busy: boolean; onStart: () => void; onReady: () => void; onReject: () => void;
}) {
  const { colors } = useTheme();
  const total = orderTotal(order.store_order_totals);
  const parent = order.customer_orders;
  const tone = order.status === "awaiting_review" ? "warning" : order.status === "rejected" || order.status === "cancelled" ? "error" : order.status === "preparing" ? "info" : "success";
  const foreground = colors[`${tone}Foreground`], surface = colors[`${tone}Surface`];
  const groups = expanded ? groupOrderItems(order.store_order_items) : [];
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.text }]}>{order.reference ?? `طلب #${parent.order_number}`}</Text>
      <Text style={[styles.badge, { color: foreground, backgroundColor: surface }]}>{statusLabels[order.status]}</Text>
    </View>
    <Text style={[styles.body, { color: colors.textSecondary }]}>{date(order.created_at)}</Text>
    <View style={styles.row}>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{order.store_order_items.length.toLocaleString("ar-SY")} بنود منتجات</Text>
      <Text style={[styles.strong, { color: total ? colors.primary : colors.errorForeground }]}>{total ?? "إجمالي المتجر غير متاح"}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${expanded ? "إخفاء" : "عرض"} محتوى الطلب ${parent.order_number}`}
      onPress={toggle} style={({ pressed }) => [styles.expand, { backgroundColor: pressed ? colors.surfacePressed : colors.surfaceSecondary }]}>
      <Text style={[styles.strong, { color: colors.primary }]}>{expanded ? "إخفاء المحتوى والتوصيل −" : "عرض المحتوى والتوصيل +"}{!expanded && order.customer_note ? " · توجد ملاحظة" : ""}</Text>
    </Pressable>
    {expanded ? <View style={styles.details}>
      {groups.map(group => <View key={group.id} style={[styles.detail, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.strong, { color: colors.text }]}>{group.offerTitle ?? group.items[0].product_title_snapshot}</Text>
        {group.offerDescription ? <Text style={[styles.body, { color: colors.warningForeground }]}>{group.offerDescription}</Text> : null}
        {group.items.map(item => <Text key={item.id} style={[styles.body, { color: colors.textSecondary }]}>{item.product_title_snapshot} · {item.quantity} {item.selling_unit_snapshot} × {formatSyp(item.unit_price_snapshot, item.currency)}</Text>)}
        {group.originalTotal > group.finalTotal ? <Text style={[styles.body, { color: colors.textSecondary, textDecorationLine: "line-through" }]}>قبل العرض {formatSyp(group.originalTotal, group.currency)}</Text> : null}
        <Text style={[styles.strong, { color: colors.primary }]}>{formatSyp(group.finalTotal, group.currency)}</Text>
      </View>)}
      <View style={[styles.detail, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.strong, { color: colors.text }]}>معلومات التوصيل</Text>
        <Text style={[styles.body, { color: colors.text }]}>{parent.recipient_name}</Text>
        <Text selectable style={[styles.body, { color: colors.textSecondary }]}>{parent.contact_phone}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{parent.delivery_address}</Text>
      </View>
      {order.customer_note ? <Text style={[styles.body, { color: colors.text }]}>ملاحظة الزبون: {order.customer_note}</Text> : null}
      {order.rejection_reason ? <Text style={[styles.message, { color: colors.errorForeground, backgroundColor: colors.errorSurface }]}>سبب الاعتذار: {order.rejection_reason}</Text> : null}
    </View> : null}
    {order.status === "awaiting_review" ? <View style={styles.details}>
      <AppButton design="refined" title="قبول وبدء التجهيز" onPress={onStart} loading={busy} />
      <AppButton design="refined" title="الاعتذار عن الطلب" variant="outline" onPress={onReject} disabled={busy} />
    </View> : order.status === "preparing" ? <AppButton design="refined" title="الطلب جاهز للاستلام" onPress={onReady} loading={busy} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six, maxWidth: MaxContentWidth, width: "100%", alignSelf: "center", gap: Spacing.three, flexGrow: 1 },
  header: { gap: Spacing.three }, filters: { flexDirection: "row-reverse", gap: Spacing.two, paddingVertical: Spacing.one },
  filter: { minHeight: 48, minWidth: 64, justifyContent: "center", borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two },
  row: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: Spacing.two },
  title: { ...Typography.cardTitle, textAlign: "right", flexShrink: 1 },
  body: { ...Typography.body, textAlign: "right" }, strong: { ...Typography.bodyStrong, textAlign: "right" },
  badge: { ...Typography.label, textAlign: "right", paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.sm, flexShrink: 1 },
  expand: { minHeight: 48, justifyContent: "center", padding: Spacing.two, borderRadius: Radius.md },
  details: { gap: Spacing.two }, detail: { padding: Spacing.three, gap: Spacing.one, borderRadius: Radius.md },
  message: { ...Typography.body, textAlign: "right", padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.two },
  empty: { paddingVertical: Spacing.eight, gap: Spacing.three, alignItems: "center" }, footer: { gap: Spacing.two, paddingVertical: Spacing.three },
});
