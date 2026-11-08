import { Pressable, StyleSheet, Text } from "react-native";

import { AppTextField } from "@/components/ui/AppTextField";
import { AppModal } from "@/components/ui/AppModal";
import { Fonts, FontSizes, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type ForgotPasswordSectionProps = {
  email: string;
  error: string;
  onChangeEmail: (value: string) => void;
  busy: boolean;
  message: string;
  visible: boolean;
  onCancel: () => void;
  onCloseMessage: () => void;
  onOpen: () => void;
  onSend: () => void;
};

export function ForgotPasswordSection({
  email, error, onChangeEmail,
  busy,
  message,
  visible,
  onCancel,
  onCloseMessage,
  onOpen,
  onSend,
}: ForgotPasswordSectionProps) {
  const { colors } = useTheme();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="نسيت كلمة المرور"
        onPress={onOpen}
        style={styles.trigger}
      >
        <Text style={[styles.triggerText, { color: colors.primary }]}>
          نسيت كلمة المرور؟
        </Text>
      </Pressable>
      <AppModal design="refined"
        visible={visible}
        title="إعادة تعيين كلمة المرور"
        message={
          "أدخل بريدك الإلكتروني لإرسال رابط استعادة كلمة المرور."
        }
        icon="mail-outline"
        confirmText={
          busy
            ? "جارٍ الإرسال…"
            : message
              ? "إغلاق"
              : "إرسال الرابط"
        }
        cancelText="رجوع"
        busy={busy}
        onCancel={onCancel}
        onConfirm={message ? onCloseMessage : onSend}
      >
        <AppTextField design="refined" label="البريد الإلكتروني للاستعادة" value={email} onChangeText={onChangeEmail} error={error} disabled={busy} keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false} returnKeyType="send" onSubmitEditing={message ? onCloseMessage : onSend} />
        {message ? <Text accessibilityRole="alert" style={[Typography.body, { color: colors.successForeground, backgroundColor: colors.successSurface, padding: 12, borderRadius: 8, marginTop: 8, textAlign: "right" }]}>{message}</Text> : null}
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  triggerText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },
});
