import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { CustomerDeliveryTask, CustomerOrderView } from "@/lib/customer-orders";

type StoreOrder = CustomerOrderView["stores"][number];

const storeStatusLabels: Record<StoreOrder["storeOrder"]["status"], string> = {
  awaiting_review: "بانتظار مراجعة المتجر",
  preparing: "قيد التجهيز",
  ready_for_pickup: "جاهز للاستلام",
  handed_to_driver: "سُلّم إلى السائق",
  delivered: "تم التسليم",
  rejected: "مرفوض",
  cancelled: "ملغى",
};

const deliveryLabels: Record<CustomerDeliveryTask["status"], string> = {
  pending_stores: "بانتظار جاهزية المتاجر",
  available: "بانتظار قبول سائق",
  accepted: "قبل السائق مهمة التوصيل",
  picked_up: "استلم السائق الطلب",
  delivered: "تم تسليم الطلب",
  cancelled: "أُلغيت مهمة التوصيل",
};

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
  submitted: "تم استلام الطلب",
  in_progress: "تجهيز الطلب",
  ready_for_delivery: "جاهز للتوصيل",
  out_for_delivery: "في الطريق إليك",
  delivered: "تم التسليم",
};

export function CustomerOrderTimeline({ order }: { order: CustomerOrderView }) {
  const { colors } = useTheme();
  const currentIndex = customerSteps.indexOf(order.status as (typeof customerSteps)[number]);
  if (currentIndex < 0) return null;
  const storeEvents = new Set(order.stores.flatMap((store) => store.statusHistory.map((event) => event.to_status)));
  const hasEvidence = (step: (typeof customerSteps)[number]) => {
    if (step === "submitted") return true;
    if (step === "in_progress") return storeEvents.has("preparing");
    if (step === "ready_for_delivery") return storeEvents.has("ready_for_pickup");
    if (step === "out_for_delivery") return Boolean(order.deliveryTask && ["accepted", "picked_up", "delivered"].includes(order.deliveryTask.status));
    return order.status === "delivered";
  };
  return (
    <View style={[styles.timeline, { borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>مسار الطلب</Text>
      {customerSteps.map((step, index) => {
        const current = index === currentIndex;
        const complete = index < currentIndex && hasEvidence(step);
        const future = index > currentIndex || (index < currentIndex && !complete);
        return <View key={step} style={styles.timelineRow}>
          <View style={styles.timelineMark}>
            <View style={[styles.timelineDot, { borderColor: current || complete ? colors.primary : colors.border, backgroundColor: complete ? colors.primary : colors.surface }]}>
              {complete ? <AppIcon name="checkmark" size={11} color={colors.surface} /> : null}
            </View>
            {index < customerSteps.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: complete ? colors.primary : colors.border }]} /> : null}
          </View>
          <Text style={[styles.timelineLabel, { color: future ? colors.textMuted : colors.text }, current && { fontFamily: Fonts.bold, color: colors.primary }]}>{customerLabels[step]}</Text>
          {current ? <Text style={[styles.currentLabel, { color: colors.primary }]}>الحالة الحالية</Text> : null}
        </View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
