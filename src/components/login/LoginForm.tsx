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
  email: string;
  error: string;
  password: string;
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
  email,
  error,
  password,
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
        <AppTextField
          label="البريد الإلكتروني"
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
        <AppTextField
          label="كلمة المرور"
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
            { backgroundColor: colors.primaryLight },
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
        <AppButton
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
    gap: Spacing.two,
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
