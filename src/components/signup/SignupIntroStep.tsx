import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type SignupIntroStepProps = {
  onContinue: () => void;
};

export function SignupIntroStep({ onContinue }: SignupIntroStepProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.content}>
      <View
        style={[
          styles.brandCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <BrandMark size="medium" />
        <View style={[styles.localIcon, { backgroundColor: colors.primaryLight }]}>
          <AppIcon name="storefront-outline" size={28} color={colors.primary} />
        </View>
      </View>

      <Text style={[styles.eyebrow, { color: colors.accent }]}>
        الكرك الشرقي
      </Text>
      <Text style={[styles.title, { color: colors.text }]}>
        مرحبًا بك في تسوق الكرك
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        تسوّق من متاجر منطقتك، أو انضم إلينا كتاجر أو سائق.
      </Text>

      <View style={styles.action}>
        <AppButton
          title="ابدأ إنشاء حسابك"
          icon="arrow-back"
          onPress={onContinue}
        />
      </View>

      <View style={styles.loginRow}>
        <Text style={[styles.loginText, { color: colors.textSecondary }]}>
          لديك حساب بالفعل؟
        </Text>
        <Link href="/login" asChild>
          <Pressable accessibilityRole="button" style={styles.loginButton}>
            <Text style={[styles.loginLink, { color: colors.primary }]}>
              تسجيل الدخول
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },
  brandCard: {
    width: "100%",
    minHeight: 250,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.xl,
  },
  localIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    marginTop: Spacing.two,
  },
  eyebrow: {
    marginTop: Spacing.five,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
  title: {
    marginTop: Spacing.one,
    textAlign: "center",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    lineHeight: 34,
  },
  subtitle: {
    maxWidth: 340,
    marginTop: Spacing.two,
    textAlign: "center",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 25,
  },
  action: {
    width: "100%",
    marginTop: Spacing.six,
  },
  loginRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.four,
  },
  loginText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },
  loginButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  loginLink: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },
});
