import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppButtonProps = {
  title: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof AppIcon>["name"];
  variant?: "primary" | "secondary" | "outline" | "danger";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
};

export function AppButton({
  title,
  onPress,
  icon,
  variant = "primary",
  disabled = false,
  loading = false,
  fullWidth = true,
}: AppButtonProps) {
  const { colors } = useTheme();

  const isPrimary = variant === "primary" || variant === "danger";

  const backgroundColor =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? colors.error
        : variant === "secondary"
          ? colors.primaryLight
          : colors.surface;

  const textColor = isPrimary ? colors.surface : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.button,
        fullWidth && styles.fullWidth,
        {
          backgroundColor,
          borderColor: variant === "outline" ? colors.border : backgroundColor,
          opacity: disabled || loading ? 0.55 : pressed ? 0.72 : 1,
        },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : icon ? <AppIcon name={icon} size={19} color={textColor} /> : null}

      <Text
        style={[
          styles.text,
          {
            color: textColor,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  fullWidth: {
    width: "100%",
  },

  text: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
});
