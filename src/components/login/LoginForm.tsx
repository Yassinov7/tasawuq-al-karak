import { useRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { ForgotPasswordSection } from "@/components/login/ForgotPasswordSection";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type LoginFormProps = {
  busy: boolean;
  fieldErrors: { email?: string; password?: string };
  email: string;
  error: string;
  password: string;
  resetEmail: string;
  resetError: string;
  onChangeResetEmail: (value: string) => void;
  resetBusy: boolean;
  resetMessage: string;
  resetVisible: boolean;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onCancelReset: () => void;
  onCloseResetMessage: () => void;
  onLogin: () => void;
  onOpenReset: () => void;
  onSendReset: () => void;
};

export function LoginForm({
  busy,
  fieldErrors,
  email,
  error,
  password,
  resetEmail, resetError, onChangeResetEmail,
  resetBusy,
  resetMessage,
  resetVisible,
  onChangeEmail,
  onChangePassword,
  onCancelReset,
  onCloseResetMessage,
  onLogin,
  onOpenReset,
  onSendReset,
}: LoginFormProps) {
  const { colors } = useTheme();
  const passwordInputRef = useRef<TextInput>(null);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.fields}>
        <AppTextField design="refined"
          label="البريد الإلكتروني"
          error={fieldErrors.email} disabled={busy}
          value={email}
          onChangeText={onChangeEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          placeholder="name@example.com"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => passwordInputRef.current?.focus()}
        />
        <AppTextField design="refined"
          label="كلمة المرور"
          error={fieldErrors.password} disabled={busy}
          value={password}
          onChangeText={onChangePassword}
          inputRef={passwordInputRef}
          secureTextEntry
          passwordToggleMode="icon"
          autoComplete="current-password"
          placeholder="أدخل كلمة المرور"
          returnKeyType="done"
          onSubmitEditing={onLogin}
        />
      </View>

      <ForgotPasswordSection
        email={resetEmail} error={resetError} onChangeEmail={onChangeResetEmail}
        busy={resetBusy}
        message={resetMessage}
        visible={resetVisible}
        onCancel={onCancelReset}
        onCloseMessage={onCloseResetMessage}
        onOpen={onOpenReset}
        onSend={onSendReset}
      />

      {error ? (
        <View
          accessibilityRole="alert"
          style={[
            styles.errorNotice,
            { backgroundColor: colors.errorSurface },
          ]}
        >
          <AppIcon
            name="alert-circle-outline"
            size={19}
            color={colors.error}
          />
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={styles.submit}>
        <AppButton design="refined"
          title="تسجيل الدخول"
          icon="log-in-outline"
          onPress={onLogin}
          loading={busy}
          disabled={busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: Spacing.four,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },
  fields: {
    gap: Spacing.three,
  },
  errorNotice: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  errorText: {
    flex: 1,
    textAlign: "right",
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    lineHeight: 22,
  },
  submit: {
    marginTop: Spacing.three,
  },
});
