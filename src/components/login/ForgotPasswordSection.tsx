import { Pressable, StyleSheet, Text } from "react-native";

import { AppModal } from "@/components/ui/AppModal";
import { Fonts, FontSizes } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type ForgotPasswordSectionProps = {
  busy: boolean;
  message: string;
  visible: boolean;
  onCancel: () => void;
  onCloseMessage: () => void;
  onOpen: () => void;
  onSend: () => void;
};

export function ForgotPasswordSection({
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
      <AppModal
        visible={visible}
        title="إعادة تعيين كلمة المرور"
        message={
          message ||
          "سنرسل رابط إعادة التعيين إلى البريد المكتوب في صفحة الدخول."
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
      />
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
