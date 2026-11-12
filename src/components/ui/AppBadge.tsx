import { StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppBadgeProps = {
  text: string;
  variant?: "primary" | "accent" | "success" | "danger" | "neutral" | "pending" | "info";
  icon?: React.ComponentProps<typeof AppIcon>["name"];
};

export function AppBadge({ text, variant = "primary", icon }: AppBadgeProps) {
  const { colors } = useTheme();

  const backgroundColor =
    variant === "pending" ? colors.pendingSurface : variant === "info" ? colors.infoSurface : variant === "primary"
      ? colors.primaryLight
      : variant === "accent"
        ? colors.accentLight
        : variant === "success"
          ? colors.successSurface
          : variant === "danger"
            ? colors.errorSurface
            : colors.surfaceSecondary;

  const textColor =
    variant === "pending" ? colors.pendingForeground : variant === "info" ? colors.infoForeground : variant === "primary"
      ? colors.primary
      : variant === "accent"
        ? colors.warningForeground
        : variant === "success"
          ? colors.successForeground
          : variant === "danger"
            ? colors.errorForeground
            : colors.textSecondary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
        },
      ]}
    >
      {icon ? <AppIcon name={icon} size={12} color={textColor} /> : null}

      <Text
        style={[
          styles.text,
          {
            color: textColor,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },

  text: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },
});
