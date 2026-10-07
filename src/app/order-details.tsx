import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { cancelCustomerOrder, formatCurrency, getCustomerOrder, type CustomerOrderView } from "@/lib/customer-orders";
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

export default function OrderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
  }>();

  const { colors } = useTheme();
  const { itemCount } = useCart();

  const orderId = typeof params.id === "string" ? params.id : "";
  const [order, setOrder] = useState<CustomerOrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const refresh = useCallback(async () => {
    if (!orderId) {
      setError("معرّف الطلب غير صالح.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOrder(await getCustomerOrder(orderId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل تفاصيل الطلب.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const displayOrderId = order ? `TW-${order.order_number}` : "";
  const canCancel = Boolean(
    order &&
    order.stores.length > 0 &&
    order.stores.every(({ storeOrder }) =>
      ["awaiting_review", "rejected", "cancelled"].includes(storeOrder.status),
    ),
  );

  const handleCancelOrder = () => {
    Alert.alert("إلغاء الطلب", "هل تريد إلغاء هذا الطلب؟", [
      { text: "العودة", style: "cancel" },
      {
        text: "إلغاء الطلب",
        style: "destructive",
        onPress: () => {
          setCancelling(true);
          void cancelCustomerOrder(orderId)
            .then(refresh)
            .catch((cause: unknown) => {
              setError(cause instanceof Error ? cause.message : "تعذر إلغاء الطلب.");
            })
            .finally(() => setCancelling(false));
        },
      },
    ]);
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
      >
        <AppButton
          title={loading ? "جارٍ تحديث الحالة..." : "تحديث حالة الطلب"}
          icon="refresh-outline"
          variant="outline"
          disabled={loading}
          onPress={() => void refresh()}
        />
        <AppButton
          title="عرض فاتورة الطلب"
          icon="document-text-outline"
          variant="outline"
          onPress={() => router.push({ pathname: "/invoice", params: { id: order.id } })}
        />
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

        <View
          style={[
            styles.timelineCard,
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
            حالة الطلب
          </Text>

          <View style={styles.timeline}>
            <TimelineStep
              title={`الحالة الحالية: ${customerStatusLabels[order.status]}`}
              active
              completed={false}
              last
            />
          </View>
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
            {order.stores.map(({ storeOrder, storeName, items }) => {
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
                        style={[
                          styles.item,
                          {
                            backgroundColor: colors.surfaceSecondary,
                            borderTopColor: colors.border,
                            borderRadius: Radius.md,
                            padding: Spacing.three,
                          },
                        ]}
                      >
                        <View style={{ flex: 1, gap: Spacing.one }}>
                          <Text
                            style={[
                              styles.quantityText,
                              {
                                color: colors.text,
                              },
                            ]}
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

                        <Text
                          style={[
                            styles.itemPrice,
                            {
                              color: colors.textSecondary,
                            },
                          ]}
                        >
                          {formatCurrency(group.finalTotal, group.currency)}
                        </Text>
                        {group.originalTotal > group.finalTotal ? (
                          <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", textDecorationLine: "line-through" }}>
                            قبل العرض {formatCurrency(group.originalTotal, group.currency)}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
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

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>عنوان التوصيل</Text>
          <Text style={{ color: colors.textSecondary, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" }}>
            {order.recipient_name} · {order.contact_phone}
          </Text>
          <Text style={{ color: colors.textSecondary, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" }}>
            {order.delivery_address} · {order.delivery_zone_name_snapshot}
          </Text>
        </View>

        {canCancel ? (
          <AppButton
            title={cancelling ? "جارٍ إلغاء الطلب..." : "إلغاء الطلب"}
            variant="outline"
            disabled={cancelling}
            onPress={handleCancelOrder}
          />
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.error, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center" }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

type TimelineStepProps = {
  title: string;
  active: boolean;
  completed: boolean;
  last?: boolean;
};

function TimelineStep({
  title,
  active,
  completed,
  last = false,
}: TimelineStepProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.timelineStep}>
      <View style={styles.timelineLineContainer}>
        <View
          style={[
            styles.timelineDot,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
            active && {
              borderColor: colors.primary,
              backgroundColor: colors.primary,
            },
          ]}
        >
          {completed ? (
            <AppIcon name="checkmark" size={12} color={colors.surface} />
          ) : null}
        </View>

        {!last ? (
          <View
            style={[
              styles.timelineLine,
              {
                backgroundColor: colors.border,
              },
              active && {
                backgroundColor: colors.primary,
              },
            ]}
          />
        ) : null}
      </View>

      <Text
        style={[
          styles.timelineText,
          {
            color: colors.textMuted,
          },
          active && {
            color: colors.text,
          },
        ]}
      >
        {title}
      </Text>
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
    paddingTop: Spacing.five,
    paddingBottom: Spacing.seven,
  },

  orderHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

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

  storeCard: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  storeHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
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
    alignItems: "center",
    minHeight: 44,
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
  },

  summaryCard: {
    marginTop: Spacing.six,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  summaryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.three,
  },

  summaryLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  summaryValue: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  summaryDivider: {
    height: 1,
    marginTop: Spacing.three,
  },

  invoiceButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 52,
    marginTop: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  invoiceButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
  },

  pressed: {
    opacity: 0.8,
  },
});
