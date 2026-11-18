import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { formatCurrency, type CustomerDeliveryTask, type CustomerOrderView } from "@/lib/customer-orders";
import { groupOrderItems } from "@/lib/order-item-groups";
import { customerDeliveryCompleted, storeStepCompleted } from "@/lib/order-progress";

type StoreOrder = CustomerOrderView["stores"][number];

const storeStatusLabels: Record<StoreOrder["storeOrder"]["status"], string> = {
  awaiting_review: "بانتظار مراجعة المتجر",
  preparing: "قيد التجهيز",
  ready_for_pickup: "جاهز لاستلام السائق",
  handed_to_driver: "استلمه السائق",
  delivered: "تم التسليم للعميل",
  rejected: "اعتذر المتجر عن التنفيذ",
  cancelled: "أُلغي طلب المتجر",
};

const deliveryLabels: Record<CustomerDeliveryTask["status"], string> = {
  pending_stores: "بانتظار تجهيز المتاجر",
  available: "بانتظار سائق",
  accepted: "بانتظار استلام المتاجر",
  picked_up: "قيد التوصيل",
  delivered: "تم التسليم",
  cancelled: "أُلغيت المهمة",
};

const progressSteps = ["awaiting_review", "preparing", "ready_for_pickup", "handed_to_driver", "delivered"] as const;

function statusTone(status: StoreOrder["storeOrder"]["status"], colors: ReturnType<typeof useTheme>["colors"]) {
  if (["rejected", "cancelled"].includes(status)) return { foreground: colors.error, background: `${colors.error}18` };
  if (["ready_for_pickup", "handed_to_driver", "delivered"].includes(status)) return { foreground: colors.primary, background: colors.primaryLight };
  return { foreground: colors.accent, background: colors.accentLight };
}

export function OrderSuborderTracking({
  stores,
  selectedId,
  onSelect,
  logos,
  refreshing,
  onRefresh,
}: {
  stores: StoreOrder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  logos: Map<string, { url: string; key: string }>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.trackingSection}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>طلبات المتاجر</Text>
        <AppButton title="تحديث" accessibilityLabel="تحديث الطلب" icon="refresh-outline" variant="outline" compact fullWidth={false} loading={refreshing} disabled={refreshing} onPress={onRefresh} />
      </View>
      <View style={styles.suborderList}>
        {stores.map((store) => {
          const expanded = stores.length === 1 || store.storeOrder.id === selectedId;
          return <SuborderCard key={store.storeOrder.id} store={store} logo={logos.get(store.storeOrder.store_id)} expanded={expanded} collapsible={stores.length > 1}
            onPress={() => stores.length > 1 && onSelect(expanded ? null : store.storeOrder.id)} />;
        })}
      </View>
    </View>
  );
}

function SuborderCard({ store, logo, expanded, collapsible, onPress }: {
  store: StoreOrder;
  logo?: { url: string; key: string };
  expanded: boolean;
  collapsible: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const status = store.storeOrder.status;
  const tone = statusTone(status, colors);
  const groups = groupOrderItems(store.items);
  const terminal = status === "rejected" || status === "cancelled";
  const eventsByStatus = new Map(store.statusHistory.map((event) => [event.to_status, event]));
  const visibleSteps = progressSteps.filter((step) => eventsByStatus.has(step) || step === status);
  const terminalEvent = terminal ? eventsByStatus.get(status) : null;

  return (
    <View style={[styles.suborder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable disabled={!collapsible} onPress={onPress} accessibilityRole={collapsible ? "button" : undefined} accessibilityState={collapsible ? { expanded } : undefined}
        accessibilityLabel={`${store.storeName}، ${storeStatusLabels[status]}`} style={({ pressed }) => [styles.identityRow, pressed && styles.pressed]}>
        <View style={[styles.logo, { backgroundColor: colors.primaryLight }]}>
          <ShoppingCardImage uri={logo?.url} cacheKey={logo?.key} restricted fit="contain" icon="storefront-outline" />
        </View>
        <View style={styles.identityCopy}>
          <Text style={[styles.storeName, { color: colors.text }]}>{store.storeName}</Text>
          <View style={styles.headerMeta}>
            <View style={[styles.currentStatus, { backgroundColor: tone.background }]}>
              <Text style={[styles.currentStatusText, { color: tone.foreground }]}>{storeStatusLabels[status]}</Text>
            </View>
            <Text style={[styles.itemCount, { color: colors.textMuted }]}>{groups.length} بنود</Text>
          </View>
        </View>
        {collapsible ? <AppIcon name={expanded ? "chevron-up" : "chevron-down"} size={19} color={colors.textMuted} /> : null}
      </Pressable>

      <View style={[styles.items, { borderTopColor: colors.border }]}>
        {groups.map((group) => (
          <View key={group.id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
            <View style={styles.itemCopy}>
              <Text numberOfLines={2} style={[styles.itemTitle, { color: colors.text }]}>{group.offerTitle ?? group.items[0].product_title_snapshot}</Text>
              <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                {group.offerDescription ?? `${group.items[0].quantity} ${group.items[0].selling_unit_snapshot}`}
              </Text>
              {group.offerTitle ? group.items.map((item) => (
                <Text key={item.id} style={[styles.offerLine, { color: colors.textSecondary }]}>{item.product_title_snapshot} · {item.quantity} {item.selling_unit_snapshot}</Text>
              )) : null}
            </View>
            <View style={styles.itemPriceColumn}>
              <Text style={[styles.itemPrice, { color: colors.text }]}>{formatCurrency(group.finalTotal, group.currency)}</Text>
              {group.originalTotal > group.finalTotal ? <Text style={[styles.originalPrice, { color: colors.textMuted }]}>{formatCurrency(group.originalTotal, group.currency)}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      {expanded ? <View style={[styles.progress, { borderTopColor: colors.border }]}>
        <Text style={[styles.progressTitle, { color: colors.text }]}>متابعة حالة الطلب</Text>
        {visibleSteps.map((step, index) => {
          const event = eventsByStatus.get(step);
          const current = step === status;
          const complete = storeStepCompleted(step, status, Boolean(event));
          const muted = !event && !current;
          return (
            <View key={step} style={styles.progressRow}>
              <View style={styles.progressMark}>
                <View style={[styles.progressDot, { borderColor: current || complete ? colors.primary : colors.border, backgroundColor: complete ? colors.primary : colors.surface }]}>
                  {complete ? <AppIcon name="checkmark" size={11} color={colors.onPrimary} /> : null}
                </View>
                {index < visibleSteps.length - 1 ? <View style={[styles.progressLine, { backgroundColor: complete ? colors.primary : colors.border }]} /> : null}
              </View>
              <View style={styles.progressCopy}>
                <Text style={[styles.progressLabel, { color: muted ? colors.textMuted : colors.text }, current && { color: colors.primary, fontFamily: Fonts.bold }]}>{storeStatusLabels[step]}</Text>
                {event ? <Text style={[styles.eventDate, { color: colors.textMuted }]}>{new Date(event.created_at).toLocaleString("ar-SY")}</Text> : current && step === "awaiting_review" ? <Text style={[styles.eventDate, { color: colors.textMuted }]}>{new Date(store.storeOrder.created_at).toLocaleString("ar-SY")}</Text> : null}
              </View>
              {current ? <Text style={[styles.stepCurrentLabel, { color: colors.primary }]}>{step === "delivered" ? "مكتملة" : "الحالية"}</Text> : null}
            </View>
          );
        })}
        {terminal ? (
          <View style={[styles.terminal, { backgroundColor: tone.background }]}>
            <AppIcon name="alert-circle-outline" size={18} color={tone.foreground} />
            <View style={styles.progressCopy}>
              <Text style={[styles.progressLabel, { color: tone.foreground }]}>{storeStatusLabels[status]}</Text>
              {terminalEvent ? <Text style={[styles.eventDate, { color: colors.textSecondary }]}>{new Date(terminalEvent.created_at).toLocaleString("ar-SY")}</Text> : null}
              {store.storeOrder.rejection_reason ? <Text style={[styles.note, { color: colors.textSecondary }]}>{store.storeOrder.rejection_reason}</Text> : null}
            </View>
          </View>
        ) : null}
        {!visibleSteps.length && !terminal ? <Text style={[styles.empty, { color: colors.textMuted }]}>الحالة الحالية: {storeStatusLabels[status]}</Text> : null}
      </View> : null}
    </View>
  );
}

export function StoreStatusHistory({ store }: { store: StoreOrder }) {
  const { colors } = useTheme();
  const events = store.statusHistory;
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <Pressable onPress={() => setExpanded((value) => !value)} style={styles.historyHeader} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View style={{ flex: 1, gap: Spacing.half }}>
          <View style={styles.historyTitleRow}>
            <Text style={[styles.title, { color: colors.text }]}>سجل تحديثات المتجر</Text>
            <Text style={[styles.eventDate, { color: colors.textMuted }]}>{events.length ? `${events.length} تحديثات` : "لا توجد تحديثات"}</Text>
          </View>
        </View>
        <AppIcon name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </Pressable>
      {expanded && (events.length ? events.map((event, index) => (
        <View key={event.id} style={styles.event}>
          <View style={[styles.dot, { backgroundColor: index === events.length - 1 ? colors.primary : colors.border }]} />
          <View style={styles.eventContent}>
            <Text style={[styles.eventTitle, { color: colors.text }]}>{storeStatusLabels[event.to_status]}</Text>
            <Text style={[styles.eventDate, { color: colors.textMuted }]}>{new Date(event.created_at).toLocaleString("ar")}</Text>
            {event.note ? <Text style={[styles.note, { color: colors.textSecondary }]}>{event.note}</Text> : null}
          </View>
        </View>
      )) : (
        <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد تحديثات مسجلة من المتجر بعد.</Text>
      ))}
    </View>
  );
}

export function DeliveryTracking({ task }: { task: CustomerDeliveryTask | null }) {
  const { colors } = useTheme();
  if (!task) return null;
  return (
    <View style={[styles.delivery, { borderColor: colors.border }]}>
      <AppIcon name="bicycle-outline" size={22} color={colors.primary} />
      <View style={{ flex: 1, gap: Spacing.half }}>
        <Text style={[styles.title, { color: colors.text }]}>حالة التوصيل</Text>
        <Text style={[styles.eventTitle, { color: colors.primary }]}>{deliveryLabels[task.status]}</Text>
        <Text style={[styles.eventDate, { color: colors.textSecondary }]}>آخر تحديث: {new Date(task.updated_at).toLocaleString("ar")}</Text>
      </View>
    </View>
  );
}

const customerSteps = ["submitted", "in_progress", "ready_for_delivery", "out_for_delivery", "delivered"] as const;
const customerLabels: Record<(typeof customerSteps)[number], string> = {
  submitted: "أُرسل الطلب للمتاجر",
  in_progress: "قيد التجهيز",
  ready_for_delivery: "جاهز لاستلام السائق",
  out_for_delivery: "قيد التوصيل",
  delivered: "تم التسليم",
};

export function CustomerOrderTimeline({ order }: { order: CustomerOrderView }) {
  const { colors } = useTheme();
  const delivered = customerDeliveryCompleted(order);
  const currentIndex = delivered ? customerSteps.length - 1 : order.status === "delivered" ? -1 : customerSteps.indexOf(order.status as (typeof customerSteps)[number]);
  if (currentIndex < 0) return null;
  const storeEvents = new Set(order.stores.flatMap((store) => store.statusHistory.map((event) => event.to_status)));
  const hasEvidence = (step: (typeof customerSteps)[number]) => {
    if (step === "submitted") return true;
    if (step === "in_progress") return storeEvents.has("preparing");
    if (step === "ready_for_delivery") return storeEvents.has("ready_for_pickup");
    if (step === "out_for_delivery") return Boolean(order.deliveryTask && ["picked_up", "delivered"].includes(order.deliveryTask.status));
    return delivered;
  };
  return (
    <View style={[styles.timeline, { borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>مسار الطلب</Text>
      {customerSteps.map((step, index) => {
        const current = index === currentIndex;
        const complete = (index < currentIndex || step === "delivered" && delivered) && hasEvidence(step);
        const future = index > currentIndex || (index < currentIndex && !complete);
        return <View key={step} style={styles.timelineRow}>
          <View style={styles.timelineMark}>
            <View style={[styles.timelineDot, { borderColor: current || complete ? colors.primary : colors.border, backgroundColor: complete ? colors.primary : colors.surface }]}>
              {complete ? <AppIcon name="checkmark" size={11} color={colors.onPrimary} /> : null}
            </View>
            {index < customerSteps.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: complete ? colors.primary : colors.border }]} /> : null}
          </View>
          <Text style={[styles.timelineLabel, { color: future ? colors.textMuted : colors.text }, current && { fontFamily: Fonts.bold, color: colors.primary }]}>{customerLabels[step]}</Text>
          {current ? <Text style={[styles.currentLabel, { color: colors.primary }]}>{step === "delivered" && delivered ? "مكتملة" : "الحالة الحالية"}</Text> : null}
        </View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  trackingSection: { gap: Spacing.three },
  sectionHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" },
  suborderList: { gap: Spacing.two },
  suborder: { borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden" },
  identityRow: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two, minHeight: 68, padding: Spacing.three },
  logo: { alignItems: "center", borderRadius: Radius.md, height: 48, justifyContent: "center", overflow: "hidden", width: 48 },
  identityCopy: { alignItems: "flex-end", flex: 1, gap: Spacing.one, minWidth: 0 },
  storeName: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
  headerMeta: { alignItems: "center", flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two },
  currentStatus: { borderRadius: Radius.full, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  currentStatusText: { fontFamily: Fonts.medium, fontSize: FontSizes.xs },
  itemCount: { fontFamily: Fonts.regular, fontSize: FontSizes.xs },
  items: { borderTopWidth: StyleSheet.hairlineWidth },
  itemRow: { alignItems: "flex-start", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row-reverse", gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  itemCopy: { alignItems: "flex-end", flex: 1, gap: Spacing.half, minWidth: 0 },
  itemTitle: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  itemMeta: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  offerLine: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  itemPriceColumn: { alignItems: "flex-start", flexShrink: 0 },
  itemPrice: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "left" },
  originalPrice: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "left", textDecorationLine: "line-through" },
  progress: { borderTopWidth: StyleSheet.hairlineWidth, padding: Spacing.three },
  progressTitle: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, marginBottom: Spacing.two, textAlign: "right" },
  progressRow: { alignItems: "flex-start", flexDirection: "row-reverse", gap: Spacing.two, minHeight: 46 },
  progressMark: { alignItems: "center", alignSelf: "stretch", width: 18 },
  progressDot: { alignItems: "center", borderRadius: Radius.full, borderWidth: 2, height: 16, justifyContent: "center", width: 16 },
  progressLine: { flex: 1, marginVertical: 2, width: 2 },
  progressCopy: { alignItems: "flex-end", flex: 1, minWidth: 0 },
  progressLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" },
  stepCurrentLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.xs },
  terminal: { alignItems: "flex-start", borderRadius: Radius.md, flexDirection: "row-reverse", gap: Spacing.two, marginTop: Spacing.one, padding: Spacing.two },
  pressed: { opacity: 0.72 },
  card: { borderTopWidth: 1, gap: Spacing.three, marginTop: Spacing.three, paddingTop: Spacing.three },
  historyHeader: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two },
  historyTitleRow: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two },
  delivery: { alignItems: "flex-start", borderTopWidth: 1, flexDirection: "row-reverse", gap: Spacing.two, marginTop: Spacing.three, paddingTop: Spacing.three },
  title: { fontFamily: Fonts.semiBold, fontSize: FontSizes.md, textAlign: "right" },
  event: { alignItems: "flex-start", flexDirection: "row-reverse", gap: Spacing.two },
  dot: { borderRadius: 99, height: 9, marginTop: 5, width: 9 },
  eventContent: { flex: 1, gap: Spacing.half },
  eventTitle: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" },
  eventDate: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  note: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  empty: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" },
  timeline: { borderTopWidth: 1, gap: Spacing.one, marginTop: Spacing.three, paddingTop: Spacing.three },
  timelineRow: { alignItems: "flex-start", flexDirection: "row-reverse", gap: Spacing.two, minHeight: 29 },
  timelineMark: { alignItems: "center", width: 18 },
  timelineDot: { alignItems: "center", borderRadius: Radius.full, borderWidth: 2, height: 16, justifyContent: "center", width: 16 },
  timelineLine: { flex: 1, marginVertical: 2, width: 2 },
  timelineLabel: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" },
  currentLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.xs },
});
