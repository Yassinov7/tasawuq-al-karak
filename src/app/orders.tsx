import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { formatCurrency, getCustomerOrders, type CustomerOrderView } from "@/lib/customer-orders";
import { groupOrderItems } from "@/lib/order-item-groups";

type OrderStatus = CustomerOrderView["status"];

type OrderFilter = "all" | "active" | "completed" | "cancelled";

type Order = {
  id: string;
  displayId: string;
  storeNames: string;
  itemCount: number;
  total: string;
  date: string;
  status: OrderStatus;
};

const statusIcons: Record<OrderStatus, React.ComponentProps<typeof AppIcon>["name"]> = {
  submitted: "time-outline",
  in_progress: "time-outline",
  ready_for_delivery: "checkmark-circle-outline",
  out_for_delivery: "bicycle-outline",
  delivered: "checkmark-done-outline",
  partially_cancelled: "alert-circle-outline",
  cancelled: "close-circle-outline",
};

const statusLabels: Record<OrderStatus, string> = {
  submitted: "تم استلام الطلب",
  in_progress: "قيد التجهيز",
  ready_for_delivery: "جاهز للتوصيل",
  out_for_delivery: "في الطريق",
  delivered: "تم التسليم",
  partially_cancelled: "ملغى جزئيًا",
  cancelled: "ملغى",
};

export default function OrdersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getCustomerOrders();
      setOrders(rows.map((order) => ({
        id: order.id,
        displayId: `TW-${order.order_number}`,
        storeNames: order.stores.map((store) => store.storeName).join("، "),
        itemCount: order.stores.reduce((count, store) => count + groupOrderItems(store.items).length, 0),
        total: order.totals.map((total) => formatCurrency(total.total, total.currency)).join(" + "),
        date: new Date(order.created_at).toLocaleString("ar"),
        status: order.status,
      })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل طلباتك.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (activeFilter === "all") {
        return true;
      }

      if (activeFilter === "active") {
        return !["delivered", "cancelled"].includes(order.status);
      }

      if (activeFilter === "completed") {
        return order.status === "delivered";
      }

      return order.status === "cancelled";
    });
  }, [activeFilter, orders]);

  const getStatusColors = (status: OrderStatus) => {
    switch (status) {
      case "submitted":
      case "in_progress":
      case "out_for_delivery":
        return {
          color: colors.accent,
          background: colors.accentLight,
        };

      case "ready_for_delivery":
      case "delivered":
        return {
          color: colors.primary,
          background: colors.primaryLight,
        };

      case "partially_cancelled":
      case "cancelled":
        return {
          color: colors.error,
          background: colors.error + "18",
        };
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="طلباتي" showBack cartCount={itemCount} mode="customer" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.intro}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
              },
            ]}
          >
            طلباتك
          </Text>

          <Text
            style={[
              styles.subtitle,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            تابع طلباتك الحالية والسابقة بسهولة
          </Text>
        </View>

        <View style={styles.filters}>
          <FilterButton
            label="الكل"
            active={activeFilter === "all"}
            onPress={() => setActiveFilter("all")}
          />

          <FilterButton
            label="جارية"
            active={activeFilter === "active"}
            onPress={() => setActiveFilter("active")}
          />

          <FilterButton
            label="مكتملة"
            active={activeFilter === "completed"}
            onPress={() => setActiveFilter("completed")}
          />

          <FilterButton
            label="ملغاة"
            active={activeFilter === "cancelled"}
            onPress={() => setActiveFilter("cancelled")}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.six }} />
        ) : error ? (
          <View style={{ gap: Spacing.three, padding: Spacing.four, alignItems: "center" }}>
            <Text style={{ color: colors.error, textAlign: "center" }}>{error}</Text>
            <AppButton title="إعادة المحاولة" variant="outline" onPress={() => void refresh()} />
          </View>
        ) : filteredOrders.length > 0 ? (
          <View style={styles.orders}>
            {filteredOrders.map((order) => {
              const statusColors = getStatusColors(order.status);

              return (
                <Pressable
                  key={order.id}
                  onPress={() =>
                    router.push({
                      pathname: "/order-details",
                      params: {
                        id: order.id,
                      },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`تفاصيل الطلب ${order.id}`}
                  style={({ pressed }) => [
                    styles.orderCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.orderTop}>
                    <View style={styles.orderInfo}>
                      <Text
                        style={[
                          styles.orderId,
                          {
                            color: colors.text,
                          },
                        ]}
                      >
                        {order.displayId}
                      </Text>

                      <Text
                        style={[
                          styles.orderDate,
                          {
                            color: colors.textMuted,
                          },
                        ]}
                      >
                        {order.date}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusColors.background,
                        },
                      ]}
                    >
                      <AppIcon
                        name={statusIcons[order.status]}
                        size={14}
                        color={statusColors.color}
                      />

                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: statusColors.color,
                          },
                        ]}
                      >
                        {statusLabels[order.status]}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.orderDivider,
                      {
                        backgroundColor: colors.border,
                      },
                    ]}
                  />

                  <View style={styles.orderDetails}>
                    <View style={styles.detailItem}>
                      <AppIcon
                        name="storefront-outline"
                        size={18}
                        color={colors.textMuted}
                      />

                      <Text
                        style={[
                          styles.detailText,
                          {
                            color: colors.textSecondary,
                          },
                        ]}
                      >
                        {order.storeNames}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <AppIcon
                        name="cube-outline"
                        size={18}
                        color={colors.textMuted}
                      />

                      <Text
                        style={[
                          styles.detailText,
                          {
                            color: colors.textSecondary,
                          },
                        ]}
                      >
                        {order.itemCount} عناصر
                      </Text>
                    </View>
                  </View>

                  <View style={styles.orderBottom}>
                    <View style={styles.totalContainer}>
                      <Text
                        style={[
                          styles.totalLabel,
                          {
                            color: colors.textMuted,
                          },
                        ]}
                      >
                        الإجمالي
                      </Text>

                      <Text
                        style={[
                          styles.totalValue,
                          {
                            color: colors.primary,
                          },
                        ]}
                      >
                        {order.total}
                      </Text>
                    </View>

                    <View style={styles.detailsButton}>
                      <Text
                        style={[
                          styles.detailsButtonText,
                          {
                            color: colors.primary,
                          },
                        ]}
                      >
                        التفاصيل
                      </Text>

                      <AppIcon
                        name="arrow-back"
                        size={16}
                        color={colors.primary}
                      />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name="receipt-outline"
                size={36}
                color={colors.primary}
              />
            </View>

            <Text
              style={[
                styles.emptyTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              لا توجد طلبات
            </Text>

            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              لا توجد طلبات ضمن هذا التصنيف حالياً.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

type FilterButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function FilterButton({ label, active, onPress }: FilterButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`تصفية الطلبات: ${label}`}
      accessibilityState={{
        selected: active,
      }}
      style={({ pressed }) => [
        styles.filterButton,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary : colors.surface,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.filterText,
          {
            color: active ? colors.surface : colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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

  intro: {
    alignItems: "flex-end",
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "right",
  },

  subtitle: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  filters: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: Spacing.four,
    marginBottom: Spacing.four,
  },

  filterButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  filterText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  orders: {
    gap: Spacing.three,
  },

  orderCard: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  orderTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  orderInfo: {
    alignItems: "flex-end",
  },

  orderId: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  orderDate: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  statusBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },

  statusText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  orderDivider: {
    height: 1,
    marginVertical: Spacing.three,
  },

  orderDetails: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    gap: Spacing.five,
  },

  detailItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
  },

  detailText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  orderBottom: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: Spacing.four,
  },

  totalContainer: {
    alignItems: "flex-end",
  },

  totalLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  totalValue: {
    marginTop: Spacing.one,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  detailsButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
  },

  detailsButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.five,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.ten,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  emptyTitle: {
    marginTop: Spacing.four,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  emptyText: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.7,
  },
});
