import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type CustomerHomePromoProps = { onPress: () => void };

export function CustomerHomePromo({ onPress }: CustomerHomePromoProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityLabel="اكتشف العروض"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.primary, opacity: pressed ? 0.72 : 1 }]}
    >
      <View style={styles.content}>
        <View style={[styles.badge, { backgroundColor: colors.primaryDark }]}>
          <AppIcon name="sparkles-outline" size={13} color={colors.accent} />
          <Text style={[styles.badgeText, { color: colors.surface }]}>تسوّق محلي</Text>
        </View>
        <Text style={[styles.title, { color: colors.surface }]}>عروض مميزة{"\n"}من متاجر منطقتك</Text>
        <View style={styles.footer}>
          <Text style={[styles.description, { color: colors.primaryLight }]}>باقات وعروض من متاجر منطقتك</Text>
          <View style={[styles.action, { backgroundColor: colors.surface }]}>
            <Text style={[styles.actionText, { color: colors.primary }]}>اكتشف العروض</Text>
            <AppIcon name="arrow-back" size={15} color={colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 150, marginTop: Spacing.six, borderRadius: Radius.xl, overflow: "hidden" },
  content: { flex: 1, alignItems: "flex-end", justifyContent: "center", padding: Spacing.four },
  badge: { flexDirection: "row-reverse", alignItems: "center", gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: 5, borderRadius: Radius.full },
  badgeText: { fontFamily: Fonts.medium, fontSize: FontSizes.xs },
  title: { marginTop: Spacing.two, fontFamily: Fonts.bold, fontSize: FontSizes.lg, lineHeight: 27, textAlign: "right" },
  footer: { width: "100%", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: Spacing.two, marginTop: Spacing.three },
  description: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  action: { flexDirection: "row-reverse", alignItems: "center", gap: Spacing.one, minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: Radius.full },
  actionText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs },
});
