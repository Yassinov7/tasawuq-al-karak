import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";

type InvoiceItem = {
  name: string;
  quantity: number;
  unitPrice: string;
  total: string;
};

type InvoiceStore = {
  name: string;
  items: InvoiceItem[];
  subtotal: string;
};

const invoiceStores: InvoiceStore[] = [
  {
    name: "متجر المواد الغذائية",
    items: [
      {
        name: "حليب كامل الدسم",
        quantity: 2,
        unitPrice: "9,000 ل.س",
        total: "18,000 ل.س",
      },
      {
        name: "سكر 1 كغ",
        quantity: 1,
        unitPrice: "12,000 ل.س",
        total: "12,000 ل.س",
      },
      {
        name: "أرز 1 كغ",
        quantity: 2,
        unitPrice: "12,000 ل.س",
        total: "24,000 ل.س",
      },
    ],
    subtotal: "54,000 ل.س",
  },
  {
    name: "محامص الكرك",
    items: [
      {
        name: "قهوة عربية",
        quantity: 1,
        unitPrice: "35,000 ل.س",
        total: "35,000 ل.س",
      },
    ],
    subtotal: "35,000 ل.س",
  },
];

export default function InvoiceScreen() {
  const params = useLocalSearchParams<{
    id?: string;
  }>();

  const { colors } = useTheme();
  const { itemCount } = useCart();

  const orderId = typeof params.id === "string" ? params.id : "TW-1001";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="الفاتورة" showBack cartCount={itemCount} mode="customer" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.invoiceHeader}>
          <View
            style={[
              styles.invoiceIcon,
              {
                backgroundColor: colors.primaryLight,
              },
            ]}
          >
            <AppIcon
              name="document-text-outline"
              size={28}
              color={colors.primary}
            />
          </View>

          <Text
            style={[
              styles.invoiceTitle,
              {
                color: colors.text,
              },
            ]}
          >
            فاتورة الطلب
          </Text>

          <Text
            style={[
              styles.invoiceNumber,
              {
                color: colors.primary,
              },
            ]}
          >
            رقم الطلب: {orderId}
          </Text>

          <Text
            style={[
              styles.invoiceDate,
              {
                color: colors.textMuted,
              },
            ]}
          >
            اليوم، 4:30 م
          </Text>
        </View>

        {invoiceStores.map((store) => (
          <View
            key={store.name}
            style={[
              styles.storeCard,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
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
                  size={21}
                  color={colors.primary}
                />
              </View>

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
            </View>

            <View
              style={[
                styles.tableHeader,
                {
                  backgroundColor: colors.surfaceSecondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.headerTotal,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                الإجمالي
              </Text>

              <Text
                style={[
                  styles.headerQuantity,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                الكمية
              </Text>

              <Text
                style={[
                  styles.headerPrice,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                السعر
              </Text>

              <Text
                style={[
                  styles.headerProduct,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                المنتج
              </Text>
            </View>

            {store.items.map((item) => (
              <View
                key={item.name}
                style={[
                  styles.itemRow,
                  {
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.itemTotal,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  {item.total}
                </Text>

                <Text
                  style={[
                    styles.itemQuantity,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  {item.quantity}
                </Text>

                <Text
                  style={[
                    styles.itemPrice,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  {item.unitPrice}
                </Text>

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
              </View>
            ))}

            <View
              style={[
                styles.storeSubtotal,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.subtotalLabel,
                  {
                    color: colors.text,
                  },
                ]}
              >
                مجموع المتجر
              </Text>

              <Text
                style={[
                  styles.subtotalValue,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                {store.subtotal}
              </Text>
            </View>
          </View>
        ))}

        <View
          style={[
            styles.summaryCard,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
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
            ملخص الفاتورة
          </Text>

          <SummaryRow label="إجمالي المنتجات" value="89,000 ل.س" />

          <SummaryRow label="رسوم التوصيل" value="10,000 ل.س" />

          <SummaryRow label="الخصم" value="0 ل.س" />

          <View
            style={[
              styles.divider,
              {
                backgroundColor: colors.border,
              },
            ]}
          />

          <SummaryRow label="الإجمالي النهائي" value="99,000 ل.س" total />
        </View>

        <View
          style={[
            styles.paymentCard,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <View
            style={[
              styles.paymentIcon,
              {
                backgroundColor: colors.primaryLight,
              },
            ]}
          >
            <AppIcon name="cash-outline" size={22} color={colors.primary} />
          </View>

          <View style={styles.paymentInfo}>
            <Text
              style={[
                styles.paymentTitle,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              طريقة الدفع
            </Text>

            <Text
              style={[
                styles.paymentValue,
                {
                  color: colors.text,
                },
              ]}
            >
              الدفع عند الاستلام
            </Text>
          </View>
        </View>

        <View style={styles.note}>
          <AppIcon
            name="information-circle-outline"
            size={18}
            color={colors.textSecondary}
          />

          <Text
            style={[
              styles.noteText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            هذه الفاتورة توضح تفاصيل الطلب والمبالغ المرتبطة به.
          </Text>
        </View>
      </ScrollView>
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
          },
          total && styles.summaryTotalLabel,
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
          },
          total && styles.summaryTotalValue,
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

  invoiceHeader: {
    alignItems: "center",
    paddingVertical: Spacing.three,
  },

  invoiceIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  invoiceTitle: {
    marginTop: Spacing.three,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
  },

  invoiceNumber: {
    marginTop: Spacing.one,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  invoiceDate: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  storeCard: {
    marginTop: Spacing.four,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  storeHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: Spacing.four,
  },

  storeIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  storeName: {
    flex: 1,
    marginRight: Spacing.three,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  tableHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  headerProduct: {
    flex: 1.4,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  headerPrice: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "center",
  },

  headerQuantity: {
    width: 42,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "center",
  },

  headerTotal: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "left",
  },

  itemRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    borderTopWidth: 1,
  },

  itemName: {
    flex: 1.4,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  itemPrice: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "center",
  },

  itemQuantity: {
    width: 42,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "center",
  },

  itemTotal: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "left",
  },

  storeSubtotal: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  subtotalLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  subtotalValue: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  summaryCard: {
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
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

  summaryTotalLabel: {
    fontFamily: Fonts.bold,
  },

  summaryTotalValue: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  divider: {
    height: 1,
    marginTop: Spacing.three,
  },

  paymentCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: Spacing.four,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  paymentIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  paymentInfo: {
    flex: 1,
    marginRight: Spacing.three,
    alignItems: "flex-end",
  },

  paymentTitle: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  paymentValue: {
    marginTop: Spacing.one,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  note: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.two,
  },

  noteText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },
});
