import { useRef, useState, type Ref } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing, Typography, LayoutSpacing, ControlSizes } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useFormFocus } from "@/components/ui/KeyboardAwareScrollView";

type AppTextFieldProps = Omit<TextInputProps, "style"> & {
  design?: "legacy" | "refined";
  disabled?: boolean;
  label: string;
  error?: string;
  helperText?: string;
  inputRef?: Ref<TextInput>;
  passwordToggleMode?: "label" | "icon";
  multiline?: boolean;
};

export function AppTextField({
  design = "refined",
  disabled = false,
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
  const formFocus = useFormFocus();
  const fieldRef = useRef<View>(null);
  const [focused, setFocused] = useState(false);
  const refined = design === "refined";
  const readOnly = inputProps.readOnly;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View ref={fieldRef} collapsable={false} style={[styles.field, refined && { marginTop: 0, gap: LayoutSpacing.fieldInnerGap }]}>
      <Text style={[styles.label, refined && Typography.bodyStrong, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputShell, { borderColor: error ? colors.error : colors.border, backgroundColor: colors.surface }, multiline && styles.multiline, refined && { minHeight: multiline ? 104 : ControlSizes.input, borderWidth: 2, borderColor: error ? colors.errorBorder : disabled ? colors.disabledBorder : focused && !readOnly ? colors.focusRing : colors.borderStrong, backgroundColor: disabled ? colors.disabledSurface : readOnly ? colors.mutedSurface : colors.surface }]}>
        <TextInput
          {...inputProps}
          ref={inputRef}
          editable={disabled ? false : inputProps.editable}
          onFocus={(event) => { setFocused(true); if (fieldRef.current) formFocus?.focus(fieldRef.current); inputProps.onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); if (fieldRef.current) formFocus?.blur(fieldRef.current); inputProps.onBlur?.(event); }}
          multiline={multiline}
          secureTextEntry={isPassword && !passwordVisible}
          placeholderTextColor={refined ? colors.textSecondary : colors.textMuted}
          textAlign="right"
          style={[styles.input, refined && { ...Typography.input, minHeight: 44 }, { color: refined && disabled ? colors.disabledForeground : colors.text }, multiline && styles.multilineInput]}
          accessibilityLabel={label}
          accessibilityHint={error ?? helperText}
        />
        {isPassword ? (
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={
              passwordVisible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
            }
            accessibilityState={{ expanded: passwordVisible }}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={[refined && { minWidth: 44, minHeight: 44, justifyContent: "center" },
              passwordToggleMode === "icon"
                ? styles.passwordIconToggle
                : styles.passwordToggle
            ]}
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
      {error ? <Text style={[styles.error, refined && Typography.body, { color: refined ? colors.errorForeground : colors.error }]} accessibilityRole="alert">{refined ? `خطأ: ${error}` : error}</Text> : null}
      {!error && helperText ? (
        <Text style={[styles.helper, refined && Typography.body, { color: refined ? colors.textSecondary : colors.textMuted }]}>
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
