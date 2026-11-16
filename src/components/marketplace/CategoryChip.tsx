import { Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type CategoryChipProps = {
  label: string;
  icon?: React.ComponentProps<typeof AppIcon>["name"];
  active?: boolean;
  tile?: boolean;
  grid?: boolean;
  onPress: () => void;
};

export function CategoryChip({
  label,
  icon,
  active = false,
  tile = false,
  grid = false,
  onPress,
}: CategoryChipProps) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();

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
        grid && styles.grid,
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
          size={tile ? 22 : 18}
          color={active ? colors.surface : colors.primary}
        />
      ) : null}

      <Text
        numberOfLines={tile && fontScale <= 1.15 ? 1 : undefined}
        style={[
          styles.text,
          tile && styles.tileText,
          grid && styles.gridText,
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
    minHeight: 44,
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  tile: { minHeight: 56, maxWidth: 230, gap: Spacing.two, paddingHorizontal: Spacing.four, borderRadius: Radius.full },
  grid: { flex: 1, flexDirection: "column", justifyContent: "center", paddingHorizontal: Spacing.two, borderRadius: Radius.lg },
  gridText: { textAlign: "center" },
  tileText: { fontSize: FontSizes.sm, ...RtlText },
  text: {
    flexShrink: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    ...RtlText,
  },
});
