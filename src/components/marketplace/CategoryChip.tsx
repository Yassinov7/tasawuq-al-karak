import { Pressable, StyleSheet, Text } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type CategoryChipProps = {
  label: string;
  icon?: React.ComponentProps<typeof AppIcon>["name"];
  active?: boolean;
  tile?: boolean;
  onPress: () => void;
};

export function CategoryChip({
  label,
  icon,
  active = false,
  tile = false,
  onPress,
}: CategoryChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={tile ? "link" : "button"}
      accessibilityLabel={label}
      accessibilityState={{
        selected: active,
      }}
      style={({ pressed }) => [
        styles.chip,
        tile && styles.tile,
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

  tile: { minHeight: 48, maxWidth: 220, borderRadius: Radius.lg },
  text: {
    flexShrink: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },
});
