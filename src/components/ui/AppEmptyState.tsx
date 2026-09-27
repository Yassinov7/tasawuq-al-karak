import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppEmptyStateProps = {
  icon?: React.ComponentProps<typeof AppIcon>["name"];
  title: string;
  description?: string;
  buttonText?: string;
  onButtonPress?: () => void;
};

export function AppEmptyState({
  icon = "file-tray-outline",
  title,
  description,
  buttonText,
  onButtonPress,
}: AppEmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon name={icon} size={38} color={colors.primary} />
      </View>

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

      {description ? (
        <Text
          style={[
            styles.description,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          {description}
        </Text>
      ) : null}

      {buttonText && onButtonPress ? (
        <View style={styles.buttonContainer}>
          <AppButton
            title={buttonText}
            onPress={onButtonPress}
            variant="primary"
            fullWidth={false}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.seven,
  },

  iconContainer: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  title: {
    marginTop: Spacing.four,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "center",
  },

  description: {
    maxWidth: 360,
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    textAlign: "center",
  },

  buttonContainer: {
    marginTop: Spacing.five,
  },
});
