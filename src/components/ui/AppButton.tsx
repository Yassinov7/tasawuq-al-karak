import { useLongWait } from "@/components/ui/LoadingState";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing, Typography, ControlSizes } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppButtonProps = {
  design?: "legacy" | "refined";
  title: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof AppIcon>["name"];
  variant?: "primary" | "secondary" | "outline" | "danger";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
};

export function AppButton({
  design = "refined",
  title,
  onPress,
  icon,
  variant = "primary",
  disabled = false,
  loading = false,
  fullWidth = true,
  compact = false,
  accessibilityLabel = title,
}: AppButtonProps) {
  const { colors } = useTheme();
  const longWait = useLongWait(loading);

  const isPrimary = variant === "primary" || variant === "danger";

  const backgroundColor =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? colors.error
        : variant === "secondary"
          ? colors.primaryLight
          : colors.surface;

  const refined = design === "refined";
  const textColor = refined ? disabled && !loading ? colors.disabledForeground : variant === "danger" ? colors.onError : variant === "primary" ? colors.onPrimary : colors.primary : isPrimary ? colors.surface : colors.primary;
  const label = loading ? `${accessibilityLabel}، ${longWait ? "النتيجة لم تتأكد بعد" : "جارٍ التنفيذ"}` : accessibilityLabel;

  if (compact) {
    const compactIcon = loading ? "time-outline" : icon;
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
        accessibilityLabel={label} accessibilityState={{ disabled: disabled || loading, busy: loading }}
        style={[styles.compactTouch, fullWidth && styles.fullWidth]}>
        {({ pressed }) => (
          <View style={[styles.compactFace, {
            backgroundColor: disabled && !loading ? colors.disabledSurface : pressed
              ? variant === "primary" ? colors.primaryPressed : variant === "danger" ? colors.errorPressed : colors.surfacePressed
              : backgroundColor,
            borderColor: disabled && !loading ? colors.disabledBorder : variant === "outline" ? colors.borderStrong : "transparent",
          }]}>
            {loading && !longWait ? <ActivityIndicator size="small" color={textColor} />
              : compactIcon ? <AppIcon name={compactIcon} size={16} color={textColor} /> : null}
            <Text style={[styles.compactLabel, { color: textColor }]}>{title}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        fullWidth && styles.fullWidth,
        {
          backgroundColor,
          borderColor: variant === "outline" ? colors.border : backgroundColor,
          opacity: refined ? 1 : disabled || loading ? 0.55 : pressed ? 0.72 : 1,
          ...(refined ? { minHeight: ControlSizes.button, minWidth: ControlSizes.touch, backgroundColor: disabled && !loading ? colors.disabledSurface : pressed ? variant === "primary" ? colors.primaryPressed : variant === "danger" ? colors.errorPressed : colors.surfacePressed : backgroundColor, borderColor: disabled && !loading ? colors.disabledBorder : variant === "outline" ? colors.borderStrong : backgroundColor, paddingVertical: Spacing.two } : {}),
        },
      ]}
    >
      <View style={{width:ControlSizes.icon,height:ControlSizes.icon,alignItems:"center",justifyContent:"center"}}>{loading&&!longWait ? <ActivityIndicator size="small" color={textColor} /> : loading ? <AppIcon name="time-outline" size={ControlSizes.icon} color={textColor}/> : icon ? <AppIcon name={icon} size={refined ? ControlSizes.icon : 19} color={textColor} /> : null}</View>

      <Text
        style={[
          styles.text,
          refined && Typography.buttonLabel,
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
  compactTouch: { minHeight: ControlSizes.touch, minWidth: ControlSizes.touch, maxWidth: "100%", justifyContent: "center" },
  compactFace: {
    direction: "ltr", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one,
    borderWidth: 1, borderRadius: Radius.sm,
  },
  compactLabel: { ...Typography.label, flexShrink: 1, textAlign: "center" },
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
