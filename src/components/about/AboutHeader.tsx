import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

const APP_NAME = "تسوق";
const APP_REGION = "الكرك الشرقي";

export function AboutHeader() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <BrandMark size="small" />
      <Text style={[styles.appName, { color: colors.text }]}>{APP_NAME}</Text>
      <Text style={[styles.region, { color: colors.primary }]}>
        {APP_REGION}
      </Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        منصة محلية تجمع المتاجر والمنتجات والعروض وتسهّل على المستخدم اكتشاف
        احتياجاته وطلبها من المتاجر المشاركة في المنطقة.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },
  appName: {
    marginTop: Spacing.two,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
  },
  region: {
    marginTop: Spacing.one,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
  description: {
    maxWidth: 500,
    marginTop: Spacing.three,
    textAlign: "center",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 25,
  },
});
