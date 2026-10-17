import { StyleSheet, Text, View } from "react-native";

import { Fonts, FontSizes, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type LegalSectionProps = {
  title: string;
  paragraphs: string[];
};

export function LegalSection({ title, paragraphs }: LegalSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {paragraphs.map((paragraph) => (
        <Text
          key={paragraph}
          style={[styles.paragraph, { color: colors.textSecondary }]}
        >
          {paragraph}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.five,
  },
  title: {
    textAlign: "right",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    marginBottom: Spacing.two,
  },
  paragraph: {
    textAlign: "right",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 25,
    marginBottom: Spacing.two,
  },
});
