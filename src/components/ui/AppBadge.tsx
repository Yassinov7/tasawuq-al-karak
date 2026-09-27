import { StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppBadgeProps = {
  text: string;
  variant?: "primary" | "accent" | "success" | "danger" | "neutral";
  icon?: React.ComponentProps<typeof AppIcon>["name"];
};

export function AppBadge({ text, variant = "primary", icon }: AppBadgeProps) {
  const { colors } = useTheme();

  const backgroundColor =
    variant === "primary"
      ? colors.primaryLight
      : variant === "accent"
        ? colors.accentLight
        : variant === "success"
          ? colors.primaryLight
          : variant === "danger"
            ? `${colors.error}20`
            : colors.surfaceSecondary;

  const textColor =
    variant === "primary"
      ? colors.primary
      : variant === "accent"
        ? colors.accent
        : variant === "success"
          ? colors.success
          : variant === "danger"
            ? colors.error
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
