import { StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

const FEATURES = [
  {
    title: "اكتشاف المتاجر",
    text: "تصفح المتاجر المحلية والتعرف على المنتجات والخدمات المتاحة.",
    icon: "storefront-outline",
  },
  {
    title: "البحث عن المنتجات",
    text: "ابحث عن المنتجات واستعرض الأسعار والتوفر والعروض.",
    icon: "search-outline",
  },
  {
    title: "الطلبات",
    text: "أنشئ طلبًا من متجر واحد أو عدة متاجر ضمن تجربة طلب موحدة.",
    icon: "receipt-outline",
  },
  {
    title: "التوصيل والاستلام",
    text: "اختر طريقة استلام الطلب بحسب الخيارات المتاحة.",
    icon: "car-outline",
  },
] as const;

export function AboutFeatureList() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.sectionHeading}>
        <View
          style={[styles.headingIcon, { backgroundColor: colors.primaryLight }]}
        >
          <AppIcon name="sparkles-outline" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          ماذا يقدم تسوق؟
        </Text>
      </View>
      {FEATURES.map((feature, index) => (
        <View
          key={feature.title}
          style={[
            styles.feature,
            index < FEATURES.length - 1 && {
              borderBottomColor: colors.border,
              borderBottomWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <View style={styles.featureTitleRow}>
            <AppIcon name={feature.icon} size={18} color={colors.primary} />
            <Text style={[styles.featureTitle, { color: colors.text }]}>
              {feature.title}
            </Text>
          </View>
          <Text style={[styles.featureText, { color: colors.textSecondary }]}>
            {feature.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  sectionHeading: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  headingIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },
  sectionTitle: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },
  feature: {
    paddingVertical: Spacing.three,
  },
  featureTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },
  featureTitle: {
    textAlign: "right",
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
  featureText: {
    marginTop: Spacing.one,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 21,
  },
});
