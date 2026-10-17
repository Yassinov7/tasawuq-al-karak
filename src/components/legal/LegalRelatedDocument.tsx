import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type LegalRelatedDocumentProps = {
  title: string;
  description: string;
  href: "/privacy" | "/terms";
  linkLabel: string;
};

export function LegalRelatedDocument({
  title,
  description,
  href,
  linkLabel,
}: LegalRelatedDocumentProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.primaryLight,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {description}
      </Text>
      <Link href={href} asChild>
        <Pressable
          accessibilityRole="link"
          hitSlop={6}
          style={styles.linkButton}
        >
          <Text style={[styles.link, { color: colors.primary }]}>
            {linkLabel}
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginTop: Spacing.two,
  },
  title: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },
  description: {
    marginTop: Spacing.two,
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 24,
  },
  linkButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    marginTop: Spacing.two,
  },
  link: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },
});
