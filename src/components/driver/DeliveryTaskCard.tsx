import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";
import { FinancialAmount } from "@/components/ui/FinancialAmount";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { arabicRowDirection, arabicTextAlign } from "@/lib/arabic-layout";
import type { DriverAssignedTask } from "@/lib/driver-deliveries";
import { driverCollectionMessage } from "@/lib/driver-collection";
import { driverNextStep, driverTaskLabels, driverTaskSummary } from "@/lib/driver-task-presentation";

/** Actual compact list card. Workflow writes stay in the existing details screen. */
export const DeliveryTaskCard = memo(function DeliveryTaskCard({ task, stale, onOpen }: {
  task: DriverAssignedTask; stale: boolean; onOpen: () => void;
}) {
  const { colors } = useTheme();
  const active = task.status === "accepted" || task.status === "picked_up";
  const tone = task.status === "delivered" ? "success" : task.status === "picked_up" ? "info" : "warning";
  const foreground = colors[`${tone}Foreground`], surface = colors[`${tone}Surface`];
  const next = driverNextStep(task, stale);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${task.reference ?? "مهمة توصيل"}، ${driverTaskLabels[task.status]}`}
    accessibilityHint={next} onPress={onOpen} style={({ pressed }) => [styles.card, {
      backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.borderStrong,
    }]}>
    <View style={styles.row}>
      <View style={styles.identity}>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>مهمة توصيل</Text>
        <Text style={[styles.reference, { color: colors.text }]}>{task.reference ?? "مرجع المهمة غير متاح"}</Text>
      </View>
      <Text style={[styles.badge, { color: foreground, backgroundColor: surface }]}>{driverTaskLabels[task.status]}</Text>
    </View>
    <Text style={[styles.caption, { color: colors.textSecondary }]}>طلب العميل · <Text style={styles.code}>{task.orderReference ?? "المرجع غير متاح"}</Text></Text>
    <Text style={[styles.caption, { color: colors.text }]}>{driverTaskSummary(task)}</Text>
    <View style={styles.row}>
      <AppIcon name="location-outline" size={16} color={colors.textSecondary} />
      <Text numberOfLines={2} style={[styles.caption, styles.flex, { color: colors.textSecondary }]}>
        {task.customer_orders.delivery_zone_name_snapshot?.trim() || "منطقة التسليم غير مسجلة"}
      </Text>
    </View>
    {active && !stale ? task.collection.state === "ready"
      ? <FinancialAmount label="للتحصيل من العميل" amount={task.collection.amount} />
      : <Text style={[styles.caption, { color: colors.warningForeground }]}>{driverCollectionMessage(task.collection)}</Text> : null}
    <View style={[styles.row, styles.footer, { borderColor: colors.borderSubtle }]}>
      <Text style={[styles.action, styles.flex, { color: colors.primary }]}>{next}</Text>
      <AppIcon name="chevron-back-outline" size={17} color={colors.primary} />
    </View>
  </Pressable>;
});

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.one, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md },
  row: { flexDirection: arabicRowDirection, flexWrap: "wrap", alignItems: "center", gap: Spacing.two },
  identity: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0 },
  flex: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  caption: { ...Typography.caption, textAlign: arabicTextAlign },
  reference: { ...Typography.bodyStrong, textAlign: arabicTextAlign, writingDirection: "ltr" },
  code: { writingDirection: "ltr" },
  badge: { ...Typography.caption, textAlign: arabicTextAlign, flexShrink: 1, borderRadius: Radius.full,
    paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, marginTop: Spacing.one, minHeight: 44 },
  action: { ...Typography.bodyStrong, textAlign: arabicTextAlign },
});
