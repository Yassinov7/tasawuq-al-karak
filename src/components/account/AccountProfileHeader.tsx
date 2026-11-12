import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AccountProfileDetail = {
  icon?: ComponentProps<typeof AppIcon>["name"];
  value: string;
};

type AccountProfileHeaderProps = {
  name: string;
  details?: AccountProfileDetail[];
  roleBadge?: string;
  onEdit?: () => void;
  editAccessibilityLabel?: string;
  showStatusIndicator?: boolean;
  compact?: boolean;
  accessory?: ReactNode;
};

/** Presentation-only identity card reusable by every account role. */
export function AccountProfileHeader({
  name,
  details = [],
  roleBadge,
  onEdit,
  editAccessibilityLabel = "تعديل الملف الشخصي",
  showStatusIndicator = false,
  compact = false,
  accessory,
}: AccountProfileHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, compact && styles.compactCard, { backgroundColor: compact ? colors.surfaceSecondary : colors.surface, borderColor: colors.border }]}>
      <View style={[styles.avatar, compact && styles.compactAvatar, { backgroundColor: compact ? colors.surfaceSelected : colors.primaryLight, borderColor: colors.border }]}>
        <AppIcon name="person-outline" size={compact ? 24 : 30} color={colors.primary} />
        {showStatusIndicator ? (
          <View style={[styles.avatarDot, { backgroundColor: colors.primary, borderColor: colors.surface }]} />
        ) : null}
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text accessibilityRole={compact ? "header" : undefined} style={[styles.name, { color: colors.text }]}>{name}</Text>
          {roleBadge ? (
            <View style={[styles.roleBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.roleBadgeText, { color: colors.primary }]}>{roleBadge}</Text>
            </View>
          ) : null}
        </View>
        {details.map((detail, index) => (
          <View key={`${detail.value}-${index}`} style={styles.detailRow}>
            {detail.icon ? <AppIcon name={detail.icon} size={13} color={colors.textMuted} /> : null}
            <Text style={[styles.detail, compact && detail.icon === "mail-outline" && styles.email, { color: colors.textSecondary }]}>{detail.value}</Text>
          </View>
        ))}
        {accessory}
      </View>

      {onEdit ? (
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [
            styles.editButton,
            { backgroundColor: colors.primaryLight, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={editAccessibilityLabel}
        >
          <AppIcon name="create-outline" size={19} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", borderRadius: Radius.xl, borderWidth: 1, flexDirection: "row-reverse", padding: Spacing.four },
  compactCard: { borderRadius: Radius.lg, borderWidth: 0, padding: Spacing.three },
  compactAvatar: { width: 44, height: 44, borderWidth: 0 },
  avatar: { alignItems: "center", borderRadius: Radius.full, borderWidth: 1, height: 62, justifyContent: "center", position: "relative", width: 62 },
  avatarDot: { borderRadius: Radius.full, borderWidth: 2, bottom: 1, height: 12, position: "absolute", right: 1, width: 12 },
  info: { alignItems: "flex-end", flex: 1, marginHorizontal: Spacing.three, minWidth: 0 },
  nameRow: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.one, flexWrap: "wrap", maxWidth: "100%" },
  name: { flexShrink: 1, fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
  roleBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  roleBadgeText: { fontFamily: Fonts.semiBold, fontSize: 12, textAlign: "right" },
  detailRow: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.one, marginTop: Spacing.one, maxWidth: "100%" },
  detail: { flexShrink: 1, fontFamily: Fonts.regular, fontSize: FontSizes.xs, lineHeight: 20, textAlign: "right" },
  email: { writingDirection: "ltr" },
  editButton: { alignItems: "center", borderRadius: Radius.full, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  pressed: { opacity: 0.7 },
});
