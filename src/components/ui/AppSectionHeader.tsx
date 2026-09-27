import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppSectionHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof AppIcon>["name"];
  actionLabel?: string;
  onActionPress?: () => void;
};

export function AppSectionHeader({
  title,
  subtitle,
  icon,
  actionLabel,
  onActionPress,
}: AppSectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.titleArea}>
        <View style={styles.titleRow}>
          {icon ? (
            <AppIcon name={icon} size={20} color={colors.primary} />
          ) : null}

          <Text
            style={[
              styles.title,
              {
                color: colors.text,
              },
            ]}
          >
            {title}
          </Text>
        </View>

        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              {
                color: colors.textMuted,
              },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.action,
            {
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.actionText,
              {
                color: colors.primary,
              },
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  titleArea: {
    flex: 1,
    alignItems: "flex-end",
  },

  titleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  subtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  action: {
    marginStart: Spacing.three,
  },

  actionText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },
});
