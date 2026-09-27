import { Pressable, StyleSheet, Text } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type CategoryChipProps = {
  label: string;
  icon?: React.ComponentProps<typeof AppIcon>["name"];
  active?: boolean;
  onPress: () => void;
};

export function CategoryChip({
  label,
  icon,
  active = false,
  onPress,
}: CategoryChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        selected: active,
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.surface,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      {icon ? (
        <AppIcon
          name={icon}
          size={18}
          color={active ? colors.surface : colors.primary}
        />
      ) : null}

      <Text
        style={[
          styles.text,
          {
            color: active ? colors.surface : colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  text: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },
});
