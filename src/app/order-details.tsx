import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";

type OrderStatus = "confirmed" | "preparing" | "ready" | "completed";

type OrderItem = {
  name: string;
  quantity: number;
  price: string;
};

type StoreOrder = {
  name: string;
  status: OrderStatus;
  items: OrderItem[];
};

const storeOrders: StoreOrder[] = [
  {
    name: "متجر المواد الغذائية",
    status: "preparing",
    items: [
      {
        name: "حليب كامل الدسم",
        quantity: 2,
        price: "18,000 ل.س",
      },
      {
        name: "سكر 1 كغ",
        quantity: 1,
        price: "12,000 ل.س",
      },
      {
        name: "أرز 1 كغ",
        quantity: 2,
        price: "24,000 ل.س",
      },
    ],
  },
  {
    name: "محامص الكرك",
    status: "confirmed",
    items: [
      {
        name: "قهوة عربية",
        quantity: 1,
        price: "35,000 ل.س",
      },
    ],
  },
];

const statusIcons: Record<
  OrderStatus,
  React.ComponentProps<typeof AppIcon>["name"]
> = {
  confirmed: "checkmark-circle-outline",
  preparing: "time-outline",
  ready: "checkmark-circle-outline",
  completed: "checkmark-done-outline",
};

const statusLabels: Record<OrderStatus, string> = {
  confirmed: "تم التأكيد",
  preparing: "قيد التجهيز",
  ready: "جاهز",
  completed: "مكتمل",
};

export default function OrderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
  }>();

  const { colors } = useTheme();
  const { itemCount } = useCart();

  const orderId = typeof params.id === "string" ? params.id : "TW-1001";

  const getStatusColors = (status: OrderStatus) => {
    switch (status) {
      case "preparing":
        return {
          color: colors.accent,
          background: colors.accentLight,
        };

      case "confirmed":
      case "ready":
      case "completed":
        return {
          color: colors.primary,
          background: colors.primaryLight,
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
      <AppHeader title="تفاصيل الطلب" showBack cartCount={itemCount} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
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
              {orderId}
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
              اليوم، 4:30 م
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
            <TimelineStep title="تم إنشاء الطلب" active completed />

            <TimelineStep title="تم التأكيد" active completed />

            <TimelineStep title="قيد التجهيز" active completed={false} />

            <TimelineStep
              title="جاهز للاستلام"
              active={false}
              completed={false}
            />

            <TimelineStep
              title="تم التسليم"
              active={false}
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
            {storeOrders.map((store) => {
              const statusColors = getStatusColors(store.status);

              return (
                <View
                  key={store.name}
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
                        {store.name}
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
                          name={statusIcons[store.status]}
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
                          {statusLabels[store.status]}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.items}>
                    {store.items.map((item) => (
                      <View
                        key={item.name}
                        style={[
                          styles.item,
                          {
                            borderTopColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.itemQuantity}>
                          <Text
                            style={[
                              styles.quantityText,
                              {
                                color: colors.primary,
                              },
                            ]}
                          >
                            {item.quantity}×
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.itemName,
                            {
                              color: colors.text,
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {item.name}
                        </Text>

                        <Text
                          style={[
                            styles.itemPrice,
                            {
                              color: colors.textSecondary,
                            },
                          ]}
                        >
                          {item.price}
                        </Text>
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

          <SummaryRow label="إجمالي المنتجات" value="89,000 ل.س" />

          <SummaryRow label="التوصيل" value="10,000 ل.س" />

          <View
            style={[
              styles.summaryDivider,
              {
                backgroundColor: colors.border,
              },
            ]}
          />

          <SummaryRow label="الإجمالي" value="99,000 ل.س" total />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.invoiceButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
            },
            pressed && styles.pressed,
          ]}
          onPress={() =>
            router.push({
              pathname: "/invoice",
              params: {
                id: orderId,
              },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="عرض الفاتورة"
        >
          <AppIcon
            name="document-text-outline"
            size={20}
            color={colors.primary}
          />

          <Text
            style={[
              styles.invoiceButtonText,
              {
                color: colors.primary,
              },
            ]}
          >
            عرض الفاتورة
          </Text>
        </Pressable>
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
