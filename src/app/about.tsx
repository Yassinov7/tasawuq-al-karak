import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

const APP_NAME = "تسوق";
const APP_REGION = "الكرك الشرقي";
const APP_VERSION = "0.1.0";
const APP_BUILD = "1";

export default function AboutScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backButton}
        >
          <AppIcon name="arrow-forward" size={22} color={colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          معلومات البرنامج
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandSection}>
          <BrandMark size="medium" />

          <Text style={[styles.appName, { color: colors.text }]}>
            {APP_NAME}
          </Text>

          <Text style={[styles.region, { color: colors.accent }]}>
            {APP_REGION}
          </Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            منصة محلية تجمع المتاجر والمنتجات والعروض وتسهّل على المستخدم اكتشاف
            احتياجاته وطلبها من المتاجر المشاركة في المنطقة.
          </Text>
        </View>

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <InfoRow label="اسم البرنامج" value={APP_NAME} colors={colors} />

          <InfoRow label="المنطقة" value={APP_REGION} colors={colors} />

          <InfoRow label="الإصدار" value={APP_VERSION} colors={colors} />

          <InfoRow label="رقم البناء" value={APP_BUILD} colors={colors} />

          <InfoRow
            label="المنصة"
            value="تطبيق الهاتف المحمول"
            colors={colors}
            last
          />
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            ماذا يقدم تسوق؟
          </Text>

          <FeatureRow
            title="اكتشاف المتاجر"
            text="تصفح المتاجر المحلية والتعرف على المنتجات والخدمات المتاحة."
            colors={colors}
          />

          <FeatureRow
            title="البحث عن المنتجات"
            text="ابحث عن المنتجات واستعرض الأسعار والتوفر والعروض."
            colors={colors}
          />

          <FeatureRow
            title="الطلبات"
            text="أنشئ طلبًا من متجر واحد أو عدة متاجر ضمن تجربة طلب موحدة."
            colors={colors}
          />

          <FeatureRow
            title="التوصيل والاستلام"
            text="اختر طريقة استلام الطلب بحسب الخيارات المتاحة."
            colors={colors}
            last
          />
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            عن المشروع
          </Text>

          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            تسوق مشروع محلي يهدف إلى بناء تجربة رقمية تجمع احتياجات العملاء
            والمتاجر وخدمات التوصيل ضمن منصة واحدة.
          </Text>

          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            يتم تطوير المنصة على مراحل، وقد تختلف الميزات والخدمات المتاحة بحسب
            الإصدار والمنطقة والإعدادات التشغيلية.
          </Text>
        </View>

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
            <Pressable hitSlop={6}>
              <Text style={[styles.link, { color: colors.primary }]}>
                شروط الاستخدام
              </Text>
            </Pressable>
          </Link>

          <Link href="/privacy" asChild>
            <Pressable hitSlop={6}>
              <Text style={[styles.link, { color: colors.primary }]}>
                سياسة الخصوصية
              </Text>
            </Pressable>
          </Link>
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          {APP_NAME} · {APP_REGION}
        </Text>
      </ScrollView>
    </View>
  );
}

type ThemeColors = ReturnType<typeof useTheme>["colors"];

function InfoRow({
  label,
  value,
  colors,
  last = false,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !last && {
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>

      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function FeatureRow({
  title,
  text,
  colors,
  last = false,
}: {
  title: string;
  text: string;
  colors: ThemeColors;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.featureRow,
        !last && {
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text>

      <Text style={[styles.featureText, { color: colors.textSecondary }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.five,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  headerSpacer: {
    width: 40,
  },

  content: {
    padding: Spacing.five,
    paddingBottom: Spacing.nine,
  },

  brandSection: {
    alignItems: "center",
    paddingVertical: Spacing.four,
  },

  appName: {
    marginTop: Spacing.three,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
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

  infoCard: {
    marginTop: Spacing.five,
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },

  infoRow: {
    minHeight: 58,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },

  infoLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  infoValue: {
    flex: 1,
    textAlign: "left",
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  sectionCard: {
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  sectionTitle: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    marginBottom: Spacing.three,
  },

  featureRow: {
    paddingVertical: Spacing.three,
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

  paragraph: {
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 25,
    marginBottom: Spacing.three,
  },

  linksCard: {
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  link: {
    textAlign: "right",
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    marginTop: Spacing.two,
  },

  footer: {
    marginTop: Spacing.six,
    textAlign: "center",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },
});
