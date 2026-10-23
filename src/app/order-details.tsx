import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import { CustomerOrderTimeline, DeliveryTracking, StoreStatusHistory } from "@/components/orders/OrderTracking";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cancelCustomerOrder, formatCurrency, getCustomerOrder, type CustomerOrderView } from "@/lib/customer-orders";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { groupOrderItems } from "@/lib/order-item-groups";

type StoreOrderStatus = NonNullable<CustomerOrderView["stores"][number]["storeOrder"]["status"]>;

const statusIcons: Record<
  StoreOrderStatus,
  React.ComponentProps<typeof AppIcon>["name"]
> = {
  awaiting_review: "time-outline",
  preparing: "time-outline",
  ready_for_pickup: "checkmark-circle-outline",
  handed_to_driver: "bicycle-outline",
  delivered: "checkmark-done-outline",
  rejected: "close-circle-outline",
  cancelled: "close-circle-outline",
};

const statusLabels: Record<StoreOrderStatus, string> = {
  awaiting_review: "بانتظار مراجعة المتجر",
  preparing: "قيد التجهيز",
  ready_for_pickup: "جاهز للاستلام",
  handed_to_driver: "سُلّم إلى السائق",
  delivered: "تم التسليم",
  rejected: "مرفوض",
  cancelled: "ملغى",
};

const customerStatusLabels: Record<CustomerOrderView["status"], string> = {
  submitted: "تم استلام الطلب",
  in_progress: "قيد التجهيز",
  ready_for_delivery: "جاهز للتوصيل",
  out_for_delivery: "في الطريق",
  delivered: "تم التسليم",
  partially_cancelled: "ملغى جزئيًا",
  cancelled: "ملغى",
};

const customerStatusIcons: Record<CustomerOrderView["status"], React.ComponentProps<typeof AppIcon>["name"]> = {
  submitted: "receipt-outline",
  in_progress: "time-outline",
  ready_for_delivery: "checkmark-circle-outline",
  out_for_delivery: "bicycle-outline",
  delivered: "checkmark-done-outline",
  partially_cancelled: "alert-circle-outline",
  cancelled: "close-circle-outline",
};

export default function OrderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
  }>();

  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { user } = useAuth();

  const orderId = typeof params.id === "string" ? params.id : "";
  const [order, setOrder] = useState<CustomerOrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (background = false) => {
    if (!orderId) {
      setError("معرّف الطلب غير صالح.");
      setLoading(false);
      return;
    }
    if (!background) setLoading(true);
    setError(null);
    try {
      setOrder(await getCustomerOrder(orderId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل تفاصيل الطلب.");
    } finally {
      if (!background) setLoading(false);
    }
  }, [orderId]);

  const handlePullRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh(true);
    setRefreshing(false);
  }, [refresh]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const realtimeSubscriptions = useMemo(
    () => orderId ? [
      { table: "customer_orders" as const, filter: `id=eq.${orderId}` },
      { table: "store_orders" as const, filter: `customer_order_id=eq.${orderId}` },
      { table: "delivery_tasks" as const, filter: `customer_order_id=eq.${orderId}` },
    ] : [],
    [orderId],
  );
  const refreshFromRealtime = useCallback(() => {
    void refresh(true);
  }, [refresh]);
  useOrderRealtime({
    channelName: `customer-order:${orderId}`,
    enabled: Boolean(user && orderId),
    subscriptions: realtimeSubscriptions,
    onChange: refreshFromRealtime,
  });

  const displayOrderId = order ? `TW-${order.order_number}` : "";
  const canCancel = Boolean(
    order &&
    order.stores.length > 0 &&
    order.stores.every(({ storeOrder }) =>
      ["awaiting_review", "rejected", "cancelled"].includes(storeOrder.status),
    ),
  );
  const shouldShowDeliveryStatus = Boolean(
    order?.deliveryTask && !["out_for_delivery", "delivered"].includes(order.status),
  );

  const handleCancelOrder = async () => {
    if (cancelling) return;

    setCancelling(true);
    setError(null);
    try {
      await cancelCustomerOrder(orderId);
      setCancelModalVisible(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إلغاء الطلب.");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusColors = (status: StoreOrderStatus) => {
    switch (status) {
      case "preparing":
      case "awaiting_review":
        return {
          color: colors.accent,
          background: colors.accentLight,
        };

      case "ready_for_pickup":
      case "handed_to_driver":
      case "delivered":
        return {
          color: colors.primary,
          background: colors.primaryLight,
        };
      case "rejected":
      case "cancelled":
        return {
          color: colors.error,
          background: colors.error + "18",
        };
    }
  };

  if (loading && !order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="تفاصيل الطلب" showBack cartCount={itemCount} mode="customer" />
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.six }} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="تفاصيل الطلب" showBack cartCount={itemCount} mode="customer" />
        <View style={{ padding: Spacing.four, gap: Spacing.three }}>
          <Text style={{ color: colors.error, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center" }}>
            {error ?? "لم يتم العثور على الطلب أو لا تملك صلاحية عرضه."}
          </Text>
          {error ? <AppButton title="إعادة المحاولة" variant="outline" onPress={() => void refresh()} /> : null}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="تفاصيل الطلب" showBack cartCount={itemCount} mode="customer" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handlePullRefresh()} tintColor={colors.primary} />}
      >
        <View style={[styles.orderHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.orderHeader}>
          <View style={styles.orderNumber}>
            <Text
              style={[
                styles.orderLabel,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              رقم الطلب
            </Text>

            <Text
              style={[
                styles.orderId,
                {
                  color: colors.text,
                },
              ]}
            >
              {displayOrderId}
            </Text>
          </View>

          <View style={styles.dateContainer}>
            <Text
              style={[
                styles.orderLabel,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              تاريخ الطلب
            </Text>

            <Text
              style={[
                styles.date,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {new Date(order.created_at).toLocaleString("ar")}
            </Text>
          </View>
        </View>
        <View style={styles.heroFooter}>
        <View style={[styles.orderHeroStatus, { backgroundColor: colors.primaryLight }]}>
          <AppIcon name={customerStatusIcons[order.status]} size={17} color={colors.primary} />
          <Text style={[styles.orderHeroStatusText, { color: colors.primary }]}>{customerStatusLabels[order.status]}</Text>
        </View>
        <View style={styles.heroActions}>
          <Pressable disabled={loading} onPress={() => void refresh()} style={({ pressed }) => [styles.iconAction, { backgroundColor: colors.surfaceSecondary }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="تحديث حالة الطلب">
            <AppIcon name="refresh-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: "/invoice", params: { id: order.id } })} style={({ pressed }) => [styles.iconAction, { backgroundColor: colors.surfaceSecondary }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="عرض فاتورة الطلب">
            <AppIcon name="document-text-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          {canCancel ? (
            <Pressable
              disabled={cancelling}
              onPress={() => setCancelModalVisible(true)}
              style={({ pressed }) => [
                styles.iconAction,
                { backgroundColor: `${colors.error}12` },
                pressed && styles.pressed,
                cancelling && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="إلغاء الطلب"
            >
              <AppIcon name="close-circle-outline" size={18} color={colors.error} />
            </Pressable>
          ) : null}
        </View>
        </View>
        </View>

        <View style={[styles.statusSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>متابعة الحالة</Text>
          <Text style={[styles.statusSummaryText, { color: colors.textSecondary }]}>{["cancelled", "partially_cancelled"].includes(order.status) ? "تظهر حالة الإلغاء منفصلة، وتبقى تحديثات كل متجر في القسم التالي." : "يعتمد المسار على حالة الطلب وسجل تحديثات المتاجر المتاحين."}</Text>
          <CustomerOrderTimeline order={order} />
          {shouldShowDeliveryStatus ? <DeliveryTracking task={order.deliveryTask} /> : null}
        </View>

        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            المتاجر والمنتجات
          </Text>

          <View style={styles.stores}>
            {order.stores.map((store) => {
              const { storeOrder, storeName, items } = store;
              const statusColors = getStatusColors(storeOrder.status);
              const itemGroups = groupOrderItems(items);

              return (
                <View
                  key={storeOrder.id}
                  style={[
                    styles.storeCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.storeHeader}>
                    <View
                      style={[
                        styles.storeIcon,
                        {
                          backgroundColor: colors.primaryLight,
                        },
                      ]}
                    >
                      <AppIcon
                        name="storefront-outline"
                        size={23}
                        color={colors.primary}
                      />
                    </View>

                    <View style={styles.storeInfo}>
                      <Text
                        style={[
                          styles.storeName,
                          {
                            color: colors.text,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {storeName}
                      </Text>

                      <View
                        style={[
                          styles.storeStatus,
                          {
                            backgroundColor: statusColors.background,
                          },
                        ]}
                      >
                        <AppIcon
                          name={statusIcons[storeOrder.status]}
                          size={13}
                          color={statusColors.color}
                        />

                        <Text
                          style={[
                            styles.storeStatusText,
                            {
                              color: statusColors.color,
                            },
                          ]}
                        >
                          {statusLabels[storeOrder.status]}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.items}>
                    {itemGroups.map((group) => (
                      <View
                        key={group.id}
                        style={[styles.item, { borderTopColor: colors.border }]}
                      >
                        <View style={{ flex: 1, gap: Spacing.one }}>
                          <Text
                            style={[
                              styles.quantityText,
                              {
                                color: colors.text,
                              },
                            ]}
                            numberOfLines={2}
                          >
                            {group.offerTitle ?? group.items[0].product_title_snapshot}
                          </Text>
                          {group.offerDescription ? (
                            <Text style={{ color: colors.accent, fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "right" }}>
                              {group.offerDescription}
                            </Text>
                          ) : (
                            <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }}>
                              {group.items[0].quantity} {group.items[0].selling_unit_snapshot}
                            </Text>
                          )}
                          {group.offerTitle ? (
                            <View style={{ gap: Spacing.one, marginTop: Spacing.one }}>
                              {group.items.map((item) => (
                                <Text
                                  key={item.id}
                                  style={{ color: colors.textSecondary, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }}
                                >
                                  {item.product_title_snapshot} · {item.quantity} {item.selling_unit_snapshot}
                                </Text>
                              ))}
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.itemPriceColumn}>
                          <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
                            {formatCurrency(group.finalTotal, group.currency)}
                          </Text>
                          {group.originalTotal > group.finalTotal ? (
                            <Text style={[styles.itemOriginalPrice, { color: colors.textMuted }]}>
                              قبل العرض {formatCurrency(group.originalTotal, group.currency)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                  <StoreStatusHistory store={store} />
                </View>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            ملخص الطلب
          </Text>

          {order.totals.map((total) => (
            <SummaryRow
              key={total.currency}
              label={`المنتجات (${total.currency})`}
              value={formatCurrency(total.items_subtotal, total.currency)}
            />
          ))}
          <SummaryRow
            label="التوصيل"
            value={formatCurrency(order.delivery_fee, order.delivery_currency)}
          />

          <View
            style={[
              styles.summaryDivider,
              {
                backgroundColor: colors.border,
              },
            ]}
          />

          {order.totals.map((total) => (
            <SummaryRow
              key={`total-${total.currency}`}
              label={`الإجمالي (${total.currency})`}
              value={formatCurrency(total.total, total.currency)}
              total
            />
          ))}
        </View>

        <View style={[styles.deliveryAddressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.deliveryAddressHeader}>
            <View style={[styles.deliveryAddressIcon, { backgroundColor: colors.primaryLight }]}>
              <AppIcon name="location-outline" size={19} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>عنوان التوصيل</Text>
          </View>
          {(order.recipient_name || order.contact_phone) ? (
            <Text style={[styles.addressPrimary, { color: colors.text }]}>
              {[order.recipient_name, order.contact_phone].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
          {order.delivery_zone_name_snapshot ? <Text style={[styles.addressSecondary, { color: colors.textSecondary }]}>{order.delivery_zone_name_snapshot}</Text> : null}
          {order.delivery_address ? <Text style={[styles.addressSecondary, { color: colors.textSecondary }]}>{order.delivery_address}</Text> : null}
        </View>

        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.error, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center" }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <AppModal
        visible={cancelModalVisible}
        title="إلغاء الطلب؟"
        message="سيُلغى الطلب إذا كانت حالته الحالية تسمح بذلك."
        icon="close-circle-outline"
        confirmText="تأكيد الإلغاء"
        cancelText="العودة"
        destructive
        busy={cancelling}
        onConfirm={() => void handleCancelOrder()}
        onCancel={() => setCancelModalVisible(false)}
      />
    </View>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
  total?: boolean;
};

function SummaryRow({ label, value, total = false }: SummaryRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          {
            color: colors.textSecondary,
          },
          total && {
            color: colors.text,
            fontFamily: Fonts.bold,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.summaryValue,
          {
            color: colors.text,
          },
          total && {
            color: colors.primary,
            fontFamily: Fonts.bold,
            fontSize: FontSizes.lg,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.eight,
  },

  orderHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  orderHero: { borderRadius: Radius.xl, borderWidth: 1, gap: Spacing.two, padding: Spacing.four },

  orderHeroStatus: { alignSelf: "flex-end", alignItems: "center", borderRadius: Radius.full, flexDirection: "row-reverse", gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  orderHeroStatusText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs },
  heroFooter: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  heroActions: { flexDirection: "row-reverse", gap: Spacing.one },
  iconAction: { alignItems: "center", borderRadius: Radius.md, height: 36, justifyContent: "center", width: 36 },

  orderNumber: {
    alignItems: "flex-end",
  },

  dateContainer: {
    alignItems: "flex-start",
  },

  orderLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  orderId: {
    marginTop: Spacing.one,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  date: {
    marginTop: Spacing.one,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  statusSummary: { borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.one, marginTop: Spacing.five, padding: Spacing.three },

  statusSummaryText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  timelineCard: {
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  section: {
    marginTop: Spacing.six,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  timeline: {
    marginTop: Spacing.four,
  },

  timelineStep: {
    flexDirection: "row-reverse",
    minHeight: 42,
  },

  timelineLineContainer: {
    width: 24,
    alignItems: "center",
  },

  timelineDot: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: Radius.full,
  },

  timelineLine: {
    flex: 1,
    width: 2,
    marginVertical: 2,
  },

  timelineText: {
    flex: 1,
    marginRight: Spacing.three,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  stores: {
    marginTop: Spacing.three,
    gap: Spacing.three,
  },

  storeCard: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.four },

  storeHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
  },

  storeIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  storeInfo: {
    flex: 1,
    marginRight: Spacing.three,
    alignItems: "flex-end",
  },

  storeName: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
  },

  storeStatus: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },

  storeStatusText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  items: {
    marginTop: Spacing.three,
  },

  item: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
  },

  itemQuantity: {
    width: 34,
    alignItems: "center",
  },

  quantityText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },

  itemName: {
    flex: 1,
    marginHorizontal: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  itemPrice: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "left",
  },
  itemPriceColumn: { alignItems: "flex-start", flexShrink: 0, marginStart: Spacing.three },
  itemOriginalPrice: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "left", textDecorationLine: "line-through" },

  summaryCard: { borderRadius: Radius.xl, borderWidth: 1, marginTop: Spacing.five, padding: Spacing.four },

  summaryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.three,
  },

  summaryLabel: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  summaryValue: {
    marginStart: Spacing.three,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "left",
  },

  summaryDivider: {
    height: 1,
    marginTop: Spacing.three,
  },

  deliveryAddressCard: { borderRadius: Radius.xl, borderWidth: 1, gap: Spacing.one, marginTop: Spacing.six, padding: Spacing.four },
  deliveryAddressHeader: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two, marginBottom: Spacing.one },
  deliveryAddressIcon: { alignItems: "center", borderRadius: Radius.md, height: 36, justifyContent: "center", width: 36 },
  addressPrimary: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  addressSecondary: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right" },

  pressed: {
    opacity: 0.8,
  },
});
