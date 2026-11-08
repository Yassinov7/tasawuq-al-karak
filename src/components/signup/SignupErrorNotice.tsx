import { StyleSheet, Text } from "react-native";

import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type SignupErrorNoticeProps = {
  message: string;
};

export function SignupErrorNotice({ message }: SignupErrorNoticeProps) {
  const { colors } = useTheme();

  if (!message) return null;

  return (
    <Text
      accessibilityRole="alert"
      style={[
        styles.error,
        {
          color: colors.errorForeground,
          backgroundColor: colors.errorSurface,
        },
      ]}
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    textAlign: "right",
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },
});
