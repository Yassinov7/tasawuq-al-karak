import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type CustomerHomeHeroProps = {
  firstName?: string;
  onSearchPress: () => void;
};

export function CustomerHomeHero({ firstName, onSearchPress }: CustomerHomeHeroProps) {
  const { colors } = useTheme();
  const greeting = firstName ? `أهلًا، ${firstName}` : "أهلًا بك في تسوق";

  return (
    <View style={styles.container}>
      <View style={styles.greeting}>
        <Text style={[styles.title, { color: colors.text }]}>{greeting}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          اكتشف متاجر منطقتك وتسوّق احتياجاتك بسهولة
        </Text>
      </View>
      <Pressable
        accessibilityLabel="ابحث عن منتج أو متجر"
        accessibilityRole="button"
        onPress={onSearchPress}
        style={({ pressed }) => [styles.searchButton, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
      >
        <View style={[styles.searchIcon, { backgroundColor: colors.primaryLight }]}>
          <AppIcon name="search-outline" size={19} color={colors.primary} />
        </View>
        <Text style={[styles.searchLabel, { color: colors.textMuted }]}>ابحث عن منتج أو متجر</Text>
        <AppIcon name="arrow-back" size={19} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.two },
  greeting: { alignItems: "flex-end" },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, lineHeight: 30, textAlign: "right" },
  subtitle: { marginTop: Spacing.one, fontFamily: Fonts.regular, fontSize: FontSizes.xs, lineHeight: 19, textAlign: "right" },
  searchButton: { flexDirection: "row-reverse", alignItems: "center", minHeight: 52, marginTop: Spacing.three, paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Radius.xl },
  searchIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.md },
  searchLabel: { flex: 1, paddingHorizontal: Spacing.three, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" },
});
