import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type {
  AvailableDeliveryTask,
  DriverAssignedTask,
} from "@/lib/driver-deliveries";
import type { Tables } from "@/types/database";

const storeStatusLabels: Record<
  DriverAssignedTask["customer_orders"]["store_orders"][number]["status"],
  string
> = {
  awaiting_review: "بانتظار المتجر",
  preparing: "قيد التجهيز",
  ready_for_pickup: "جاهز للاستلام",
  handed_to_driver: "تم الاستلام",
  delivered: "تم التسليم",
  rejected: "غير مشمول بالتوصيل",
  cancelled: "ملغى",
};

type DeliveryTaskCardProps = {
  orderNumber: number;
  zoneName: string;
  createdAt: string;
  deliveryAddress?: string;
  storeCount?: number;
  assignedOrder?: DriverAssignedTask["customer_orders"];
  taskStatus?: Tables<"delivery_tasks">["status"];
  statusLabel?: string;
  actionTitle?: string;
  actionIcon?: React.ComponentProps<typeof AppIcon>["name"];
  actionTone?: "primary" | "accent" | "success";
  actionLoading?: boolean;
  onAction?: () => void;
};

export function DeliveryTaskCard({
  orderNumber,
  zoneName,
  createdAt,
  deliveryAddress,
  storeCount,
  assignedOrder,
  taskStatus = "available",
  statusLabel,
  actionTitle,
  actionIcon,
  actionTone = "primary",
  actionLoading = false,
  onAction,
}: DeliveryTaskCardProps) {
  const { colors } = useTheme();
  const statusColor =
    taskStatus === "picked_up"
      ? colors.accent
      : taskStatus === "delivered"
        ? colors.success
        : colors.primary;
  const statusBackground =
    taskStatus === "picked_up"
      ? colors.accentLight
      : taskStatus === "delivered"
        ? colors.surfaceSecondary
        : colors.primaryLight;
  const actionColors =
    actionTone === "accent"
      ? { background: colors.accent, foreground: colors.accentText }
      : actionTone === "success"
        ? { background: colors.success, foreground: colors.successText }
        : { background: colors.primary, foreground: colors.surface };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor:
            taskStatus === "accepted"
              ? colors.primaryLight
              : taskStatus === "picked_up"
                ? colors.accentLight
                : colors.surface,
          borderColor: taskStatus === "available" ? colors.border : statusColor,
        },
      ]}
    >
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text style={[styles.orderNumber, { color: colors.text }]}>
            طلب رقم TW-{orderNumber}
          </Text>
          <Text style={[styles.createdAt, { color: colors.textSecondary }]}>
            {new Date(createdAt).toLocaleString("ar-SY", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </View>
        {statusLabel ? (
          <View style={[styles.status, { backgroundColor: statusBackground }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.detailRow}>
        <AppIcon name="location-outline" size={18} color={colors.primary} />
        <Text style={[styles.detailText, { color: colors.text }]}>
          منطقة التوصيل: {zoneName}
        </Text>
      </View>

      {typeof storeCount === "number" ? (
        <View style={styles.detailRow}>
          <AppIcon name="storefront-outline" size={18} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {storeCount} {storeCount === 1 ? "متجر" : "متاجر"}
          </Text>
        </View>
      ) : null}

      {deliveryAddress ? (
        <View style={styles.detailRow}>
          <AppIcon name="navigate-outline" size={18} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.text }]}>
            عنوان التوصيل: {deliveryAddress}
          </Text>
        </View>
      ) : null}

      {assignedOrder ? (
        <View
          style={[
            styles.customerDetails,
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <Text style={[styles.customerName, { color: colors.text }]}>
            {assignedOrder.recipient_name}
          </Text>
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {assignedOrder.contact_phone}
          </Text>
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            عنوان التوصيل: {assignedOrder.delivery_address}
          </Text>
          {assignedOrder.store_orders.length > 1 ? (
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              يتضمن الطلب {assignedOrder.store_orders.filter((storeOrder) =>
                ["ready_for_pickup", "handed_to_driver", "delivered"].includes(
                  storeOrder.status,
                ),
              ).length} طلبات من متاجر مختلفة
            </Text>
          ) : null}
          {assignedOrder.store_orders
            .filter((storeOrder) =>
              ["ready_for_pickup", "handed_to_driver", "delivered"].includes(
                storeOrder.status,
              ),
            )
            .map((storeOrder) => (
              <View
                key={storeOrder.id}
                style={[
                  styles.storeDetails,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text style={[styles.customerName, { color: colors.text }]}>
                  {storeOrder.stores?.name ?? "متجر"}
                </Text>
                {storeOrder.status === "ready_for_pickup" &&
                storeOrder.stores?.address ? (
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {storeOrder.stores.address}
                  </Text>
                ) : null}
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {storeStatusLabels[storeOrder.status]}
                </Text>
              </View>
            ))}
        </View>
      ) : null}

      {actionTitle && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionTitle}
          accessibilityState={{ disabled: actionLoading, busy: actionLoading }}
          disabled={actionLoading}
          onPress={onAction}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: actionColors.background,
              opacity: actionLoading ? 0.6 : pressed ? 0.78 : 1,
            },
          ]}
        >
          {actionLoading ? (
            <ActivityIndicator color={actionColors.foreground} />
          ) : actionIcon ? (
            <AppIcon name={actionIcon} size={19} color={actionColors.foreground} />
          ) : null}
          <Text style={[styles.actionText, { color: actionColors.foreground }]}>
            {actionTitle}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function toAvailableTaskCard(
  task: AvailableDeliveryTask,
): Pick<
  DeliveryTaskCardProps,
  "orderNumber" | "zoneName" | "createdAt" | "deliveryAddress" | "storeCount"
> {
  return {
    orderNumber: task.order_number,
    zoneName: task.delivery_zone_name_snapshot,
    createdAt: task.created_at,
    deliveryAddress: task.delivery_address,
    storeCount: task.store_count,
  };
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  heading: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  headingText: {
    flex: 1,
    gap: Spacing.one,
  },
  orderNumber: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },
  createdAt: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },
  status: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.full,
  },
  statusText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },
  actionButton: {
    minHeight: 48,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
  },
  actionText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
  detailRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },
  detailText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },
  customerDetails: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  storeDetails: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  customerName: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },
});
