import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AccountMenuItemProps = {
  icon: ComponentProps<typeof AppIcon>["name"];
  title: string;
  subtitle?: string;
  badge?: string;
  disabled?: boolean;
  loading?: boolean;
  isLast?: boolean;
  onPress: () => void;
};

/** A role-agnostic account navigation row. */
export function AccountMenuItem({
  icon,
  title,
  subtitle,
  badge,
  disabled = false,
  loading = false,
  isLast = false,
  onPress,
}: AccountMenuItemProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border },
        isLast && styles.lastRow,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      <View style={[styles.icon, { backgroundColor: colors.primaryLight }]}>
        <AppIcon name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>{badge}</Text>
        </View>
      ) : null}
      {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <AppIcon name="chevron-back-outline" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row-reverse", gap: Spacing.three, minHeight: 68, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  lastRow: { borderBottomWidth: 0 },
  icon: { alignItems: "center", borderRadius: Radius.md, height: 40, justifyContent: "center", width: 40 },
  content: { alignItems: "flex-end", flex: 1, minWidth: 0 },
  title: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  subtitle: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, marginTop: 2, textAlign: "right" },
  badge: { borderRadius: Radius.full, minWidth: 22, paddingHorizontal: Spacing.one, paddingVertical: Spacing.half },
  badgeText: { fontFamily: Fonts.semiBold, fontSize: 10, textAlign: "center" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});
