import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export function LoginFooter() {
  const { colors } = useTheme();

  return (
    <>
      <View style={styles.signupRow}>
        <Text style={[styles.signupText, { color: colors.textSecondary }]}>
          ليس لديك حساب؟
        </Text>
        <Link href="/signup" asChild>
          <Pressable accessibilityRole="button" style={styles.signupButton}>
            <Text style={[styles.signupLink, { color: colors.primary }]}>
              إنشاء حساب
            </Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.infoLinks}>
        <Link href="/terms" asChild>
          <Pressable accessibilityRole="link" style={styles.infoLinkButton}>
            <Text style={[styles.infoLink, { color: colors.textMuted }]}>
              شروط الاستخدام
            </Text>
          </Pressable>
        </Link>
        <View
          style={[styles.separator, { backgroundColor: colors.border }]}
        />
        <Link href="/privacy" asChild>
          <Pressable accessibilityRole="link" style={styles.infoLinkButton}>
            <Text style={[styles.infoLink, { color: colors.textMuted }]}>
              سياسة الخصوصية
            </Text>
          </Pressable>
        </Link>
        <View
          style={[styles.separator, { backgroundColor: colors.border }]}
        />
        <Link href="/about" asChild>
          <Pressable accessibilityRole="link" style={styles.infoLinkButton}>
            <Text style={[styles.infoLink, { color: colors.textMuted }]}>
              معلومات البرنامج
            </Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  signupRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.four,
  },
  signupText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },
  signupButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  signupLink: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },
  infoLinks: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  infoLinkButton: {
    minHeight: 40,
    justifyContent: "center",
  },
  infoLink: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },
  separator: {
    width: 3,
    height: 3,
    borderRadius: Radius.full,
  },
});
