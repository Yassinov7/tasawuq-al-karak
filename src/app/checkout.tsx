import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import {
  FontSizes,
  Fonts,
  Radius,
  Spacing,
} from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";

export default function CheckoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount, subtotal } = useCart();

  const [confirmModalVisible, setConfirmModalVisible] =
    useState(false);

  const deliveryFee = itemCount > 0 ? 15000 : 0;
  const total = subtotal + deliveryFee;

  const handleConfirmOrder = () => {
    setConfirmModalVisible(true);
  };

  const handleConfirm = () => {
    setConfirmModalVisible(false);
    router.push("/orders");
  };

  const handleCancel = () => {
    setConfirmModalVisible(false);
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
      <AppHeader
        title="إتمام الطلب"
        showBack
        cartCount={itemCount}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Section title="عنوان التوصيل">
          <Pressable
            style={[
              styles.optionCard,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <View
              style={[
                styles.optionIcon,
                {
                  backgroundColor:
                    colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name="home-outline"
                size={21}
                color={colors.primary}
              />
            </View>

            <View style={styles.optionInfo}>
              <Text
                style={[
                  styles.optionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                المنزل
              </Text>

              <Text
                style={[
                  styles.optionText,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                الكرك الشرقي
              </Text>
            </View>

            <AppIcon
              name="checkmark-circle"
              size={22}
              color={colors.primary}
            />
          </Pressable>
        </Section>

        <Section title="طريقة الدفع">
          <View
            style={[
              styles.optionCard,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <View
              style={[
                styles.optionIcon,
                {
                  backgroundColor:
                    colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name="cash-outline"
                size={21}
                color={colors.primary}
              />
            </View>

            <View style={styles.optionInfo}>
              <Text
                style={[
                  styles.optionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                الدفع عند الاستلام
              </Text>

              <Text
                style={[
                  styles.optionText,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                ادفع نقداً عند وصول الطلب
              </Text>
            </View>

            <AppIcon
              name="checkmark-circle"
              size={22}
              color={colors.primary}
            />
          </View>
        </Section>

        <Section title="ملخص الطلب">
          <View
            style={[
              styles.summaryCard,
              {
                borderColor: colors.border,
                backgroundColor:
                  colors.surface,
              },
            ]}
          >
            <SummaryRow
              label="عدد المنتجات"
              value={`${itemCount} قطعة`}
            />

            <SummaryRow
              label="المجموع الفرعي"
              value={`${subtotal.toLocaleString(
                "en-US",
              )} ل.س`}
            />

            <SummaryRow
              label="التوصيل"
              value={`${deliveryFee.toLocaleString(
                "en-US",
              )} ل.س`}
            />

            <View
              style={[
                styles.divider,
                {
                  backgroundColor:
                    colors.border,
                },
              ]}
            />

            <View style={styles.totalRow}>
              <Text
                style={[
                  styles.totalLabel,
                  {
                    color: colors.text,
                  },
                ]}
              >
                الإجمالي
              </Text>

              <View style={styles.totalPrice}>
                <Text
                  style={[
                    styles.totalAmount,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  {total.toLocaleString("en-US")}
                </Text>

                <Text
                  style={[
                    styles.totalCurrency,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                >
                  ل.س
                </Text>
              </View>
            </View>
          </View>
        </Section>

        <View
          style={[
            styles.notice,
            {
              backgroundColor:
                colors.primaryLight,
            },
          ]}
        >
          <AppIcon
            name="information-circle-outline"
            size={21}
            color={colors.primary}
          />

          <Text
            style={[
              styles.noticeText,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            الطلب متعدد المتاجر يمكن أن يحتوي
            على أكثر من فاتورة فرعية، وسيتم
            احتساب تفاصيل كل متجر ضمن الطلب.
          </Text>
        </View>

        <Pressable
          onPress={handleConfirmOrder}
          style={({ pressed }) => [
            styles.confirmButton,
            {
              backgroundColor:
                colors.primary,
            },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="تأكيد الطلب"
        >
          <Text
            style={[
              styles.confirmText,
              {
                color: colors.surface,
              },
            ]}
          >
            تأكيد الطلب
          </Text>

          <AppIcon
            name="checkmark-circle-outline"
            size={21}
            color={colors.surface}
          />
        </Pressable>

        <Text
          style={[
            styles.footerNote,
            {
              color: colors.textMuted,
            },
          ]}
        >
          بتأكيد الطلب، أنت توافق على تفاصيل الطلب
          وطريقة الدفع المختارة.
        </Text>
      </ScrollView>

      <AppModal
        visible={confirmModalVisible}
        title="تأكيد الطلب"
        message={`هل تريد تأكيد طلبك بقيمة ${total.toLocaleString(
          "en-US",
        )} ل.س والدفع عند الاستلام؟`}
        icon="checkmark-circle-outline"
        confirmText="تأكيد الطلب"
        cancelText="مراجعة الطلب"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </View>
  );
}

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

function Section({
  title,
  children,
}: SectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: colors.text,
          },
        ]}
      >
        {title}
      </Text>

      {children}
    </View>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({
  label,
  value,
}: SummaryRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          {
            color:
              colors.textSecondary,
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
    paddingBottom: Spacing.ten,
  },

  section: {
    marginBottom: Spacing.five,
  },

  sectionTitle: {
    marginBottom: Spacing.three,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  optionCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  optionIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  optionInfo: {
    flex: 1,
    marginHorizontal: Spacing.three,
    alignItems: "flex-end",
  },

  optionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  optionText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
    textAlign: "right",
  },

  summaryCard: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  summaryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  summaryLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  summaryValue: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  divider: {
    height: 1,
    marginBottom: Spacing.three,
  },

  totalRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  totalLabel: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  totalPrice: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 4,
  },

  totalAmount: {
    fontFamily: Fonts.bold,
    fontSize: 23,
  },

  totalCurrency: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
  },

  notice: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.xl,
  },

  noticeText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  confirmButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 55,
    marginTop: Spacing.five,
    borderRadius: Radius.lg,
  },

  confirmText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  footerNote: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: 10,
    lineHeight: 18,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.72,
  },
});