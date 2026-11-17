import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { arabicRowDirection, arabicTextAlign } from "@/lib/arabic-layout";

type AccountSectionProps = {
  title: string;
  subtitle?: string;
  icon?: ComponentProps<typeof AppIcon>["name"];
  compact?: boolean;
  headerLayout?: "rtl";
  children: ReactNode;
};

/** Shared titled container for a role's account actions. */
export function AccountSection({ title, subtitle, icon, compact = false, headerLayout, children }: AccountSectionProps) {
  const { colors } = useTheme();
  const rtlHeader = headerLayout === "rtl";

  return (
    <View style={[styles.section, compact && styles.compactSection]}>
      {icon || subtitle ? (
        <View style={[styles.headerWithDetails, rtlHeader && styles.rtlHeader, { borderBottomColor: colors.border }]}>
          {icon ? (
            <View style={[styles.headerIcon, { backgroundColor: colors.primaryLight }]}>
              <AppIcon name={icon} size={18} color={colors.primary} />
            </View>
          ) : null}
          <View style={[styles.headerText, rtlHeader && styles.rtlHeaderText]}>
            <Text style={[styles.title, rtlHeader && styles.rtlTitle, { color: colors.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, rtlHeader && styles.rtlTitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
          </View>
        </View>
      ) : (
        <Text accessibilityRole={compact ? "header" : undefined} style={[compact ? styles.compactTitle : styles.title, rtlHeader && styles.rtlTitle, { color: compact ? colors.textSecondary : colors.text }]}>{title}</Text>
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
  rtlHeader: { flexDirection: arabicRowDirection },
  rtlHeaderText: { alignItems: "stretch", minWidth: 0 },
  rtlTitle: { textAlign: arabicTextAlign },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" },
  subtitle: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, marginTop: 2, textAlign: "right" },
  card: { borderRadius: Radius.xl, borderWidth: 1, overflow: "hidden" },
});
