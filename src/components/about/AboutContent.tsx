import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { AboutFeatureList } from "@/components/about/AboutFeatureList";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export function AboutContent() {
  const { colors } = useTheme();

  return (
    <>
      <View style={styles.factsRow}>
        <View
          style={[
            styles.factCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppIcon name="location-outline" size={20} color={colors.primary} />
          <Text style={[styles.factLabel, { color: colors.textMuted }]}>
            المنطقة
          </Text>
          <Text style={[styles.factValue, { color: colors.text }]}>
            الكرك الشرقي
          </Text>
        </View>
        <View
          style={[
            styles.factCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppIcon
            name="phone-portrait-outline"
            size={20}
            color={colors.primary}
          />
          <Text style={[styles.factLabel, { color: colors.textMuted }]}>
            المنصة
          </Text>
          <Text style={[styles.factValue, { color: colors.text }]}>
            تطبيق الهاتف المحمول
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeading}>
          <View
            style={[
              styles.headingIcon,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <AppIcon
              name="information-circle-outline"
              size={20}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            عن المشروع
          </Text>
        </View>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          تسوق مشروع محلي يهدف إلى بناء تجربة رقمية تجمع احتياجات العملاء
          والمتاجر وخدمات التوصيل ضمن منصة واحدة.
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          يتم تطوير المنصة على مراحل، وقد تختلف الميزات والخدمات المتاحة بحسب
          الإصدار والمنطقة والإعدادات التشغيلية.
        </Text>
      </View>

      <AboutFeatureList />

      <View
        style={[
          styles.linksCard,
          {
            backgroundColor: colors.primaryLight,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          معلومات قانونية
        </Text>
        <Link href="/terms" asChild>
          <Pressable
            accessibilityRole="link"
            hitSlop={6}
            style={styles.linkButton}
          >
            <Text style={[styles.link, { color: colors.primary }]}>
              شروط الاستخدام
            </Text>
            <AppIcon
              name="arrow-back"
              size={18}
              color={colors.primary}
            />
          </Pressable>
        </Link>
        <Link href="/privacy" asChild>
          <Pressable
            accessibilityRole="link"
            hitSlop={6}
            style={styles.linkButton}
          >
            <Text style={[styles.link, { color: colors.primary }]}>
              سياسة الخصوصية
            </Text>
            <AppIcon
              name="arrow-back"
              size={18}
              color={colors.primary}
            />
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  factsRow: {
    flexDirection: "row",
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  factCard: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 112,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  factLabel: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },
  factValue: {
    marginTop: Spacing.one,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
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
  paragraph: {
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 25,
    marginBottom: Spacing.three,
  },
  linksCard: {
    marginTop: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  linkButton: {
    minHeight: 44,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "transparent",
  },
  link: {
    textAlign: "right",
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
});
