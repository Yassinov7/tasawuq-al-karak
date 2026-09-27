import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppSearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function AppSearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = "ابحث عن منتج أو متجر...",
  autoFocus = false,
}: AppSearchBarProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        returnKeyType="search"
        textAlign="right"
        style={[
          styles.input,
          {
            color: colors.text,
          },
        ]}
      />

      <Pressable
        onPress={onSubmit}
        disabled={!onSubmit}
        accessibilityRole="button"
        accessibilityLabel="بحث"
        style={({ pressed }) => [
          styles.searchButton,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.72 : 1,
          },
        ]}
      >
        <AppIcon name="search-outline" size={20} color={colors.surface} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingStart: Spacing.three,
    paddingEnd: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: Spacing.two,
    paddingVertical: 0,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  searchButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
});
