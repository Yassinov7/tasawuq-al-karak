import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AccountSectionProps = {
  title: string;
  subtitle?: string;
  icon?: ComponentProps<typeof AppIcon>["name"];
  compact?: boolean;
  children: ReactNode;
};

/** Shared titled container for a role's account actions. */
export function AccountSection({ title, subtitle, icon, compact = false, children }: AccountSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.section, compact && styles.compactSection]}>
      {icon || subtitle ? (
        <View style={[styles.headerWithDetails, { borderBottomColor: colors.border }]}>
          {icon ? (
            <View style={[styles.headerIcon, { backgroundColor: colors.primaryLight }]}>
              <AppIcon name={icon} size={18} color={colors.primary} />
            </View>
          ) : null}
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
          </View>
        </View>
      ) : (
        <Text accessibilityRole={compact ? "header" : undefined} style={[compact ? styles.compactTitle : styles.title, { color: compact ? colors.textSecondary : colors.text }]}>{title}</Text>
      )}
      <View style={[styles.card, compact && styles.compactCard, { backgroundColor: colors.surface, borderColor: compact ? colors.borderSubtle : colors.border }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two, marginTop: Spacing.four },
  compactSection: { gap: Spacing.one, marginTop: 0 },
  compactTitle: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right", paddingHorizontal: Spacing.one },
  compactCard: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  headerWithDetails: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row-reverse", gap: Spacing.two, paddingBottom: Spacing.two },
  headerIcon: { alignItems: "center", borderRadius: Radius.md, height: 36, justifyContent: "center", width: 36 },
  headerText: { alignItems: "flex-end", flex: 1 },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" },
  subtitle: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, marginTop: 2, textAlign: "right" },
  card: { borderRadius: Radius.xl, borderWidth: 1, overflow: "hidden" },
});
