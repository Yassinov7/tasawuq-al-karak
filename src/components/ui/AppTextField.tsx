import { useState, type Ref } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppTextFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  error?: string;
  helperText?: string;
  inputRef?: Ref<TextInput>;
  passwordToggleMode?: "label" | "icon";
  multiline?: boolean;
};

export function AppTextField({
  label,
  error,
  helperText,
  inputRef,
  passwordToggleMode = "label",
  secureTextEntry,
  multiline,
  ...inputProps
}: AppTextFieldProps) {
  const { colors } = useTheme();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputShell, { borderColor: error ? colors.error : colors.border, backgroundColor: colors.surface }, multiline && styles.multiline]}>
        <TextInput
          {...inputProps}
          ref={inputRef}
          multiline={multiline}
          secureTextEntry={isPassword && !passwordVisible}
          placeholderTextColor={colors.textMuted}
          textAlign="right"
          style={[styles.input, { color: colors.text }, multiline && styles.multilineInput]}
          accessibilityLabel={label}
          accessibilityHint={error ?? helperText}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              passwordVisible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
            }
            accessibilityState={{ expanded: passwordVisible }}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={
              passwordToggleMode === "icon"
                ? styles.passwordIconToggle
                : styles.passwordToggle
            }
          >
            {passwordToggleMode === "icon" ? (
              <AppIcon
                name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                size={21}
                color={colors.textSecondary}
              />
            ) : (
              <Text
                style={{ color: colors.primary, fontFamily: Fonts.semiBold }}
              >
                {passwordVisible ? "إخفاء" : "إظهار"}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      {!error && helperText ? (
        <Text style={[styles.helper, { color: colors.textMuted }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two, marginTop: Spacing.three },
  label: { textAlign: "right", fontFamily: Fonts.semiBold, fontSize: FontSizes.sm },
  inputShell: { minHeight: 52, flexDirection: "row-reverse", alignItems: "center", borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three },
  input: { flex: 1, minHeight: 50, paddingVertical: Spacing.two, fontFamily: Fonts.regular, fontSize: FontSizes.md },
  passwordToggle: { paddingStart: Spacing.two, paddingVertical: Spacing.two },
  passwordIconToggle: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", marginStart: Spacing.one },
  multiline: { minHeight: 108, alignItems: "flex-start" },
  multilineInput: { minHeight: 100, textAlignVertical: "top" },
  error: { textAlign: "right", fontFamily: Fonts.medium, fontSize: FontSizes.xs },
  helper: { textAlign: "right", fontFamily: Fonts.regular, fontSize: FontSizes.xs },
});
