import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export function LoginHeader() {
  const { colors } = useTheme();

  return (
    <>
      <View style={styles.brandRow}>
        <View
          style={[
            styles.brandIcon,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <BrandMark size="small" />
        </View>
        <View style={styles.brandCopy}>
          <Text style={[styles.brandName, { color: colors.text }]}>تسوق</Text>
          <Text style={[styles.brandRegion, { color: colors.textMuted }]}>
            الكرك الشرقي
          </Text>
        </View>
      </View>

      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>أهلًا بعودتك</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          سجّل دخولك لمتابعة التسوق وإدارة حسابك.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: Spacing.three,
  },
  brandIcon: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  brandCopy: {
    alignItems: "flex-end",
  },
  brandName: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },
  brandRegion: {
    marginTop: Spacing.one,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },
  heading: {
    marginTop: Spacing.five,
    alignItems: "flex-end",
  },
  title: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
    lineHeight: 39,
  },
  subtitle: {
    marginTop: Spacing.one,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
  },
});
