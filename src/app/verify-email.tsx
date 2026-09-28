import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/utils/authError";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { colors } = useTheme();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const email = (emailParam ?? "").trim().toLowerCase();

  const handleResend = async () => {
    setError("");
    setMessage("");
    if (!email) {
      setError("تعذر تحديد البريد الإلكتروني. ابدأ التسجيل من جديد");
      return;
    }

    setIsLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (resendError) throw resendError;
      setMessage("أعدنا إرسال رسالة التأكيد إلى بريدك الإلكتروني");
    } catch (resendError) {
      setError(authErrorMessage(resendError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandMark size="small" showSubtitle={false} />
          <View style={styles.form}>
            <Text style={[styles.title, { color: colors.text }]}>تحقق من بريدك الإلكتروني</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>أرسلنا رابط تأكيد إلى</Text>
            <Text style={[styles.email, { color: colors.primary }]}>{email || "بريدك الإلكتروني"}</Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>افتح الرسالة واضغط رابط التأكيد، ثم ارجع إلى التطبيق وسجّل الدخول. تحقق من مجلد الرسائل غير المرغوب فيها إن لم تجدها.</Text>

            {error ? <Text style={[styles.feedback, { color: colors.error }]}>{error}</Text> : null}
            {message ? <Text style={[styles.feedback, { color: colors.primary }]}>{message}</Text> : null}

            <Pressable
              onPress={() => router.replace("/login")}
              style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, { color: colors.surface }]}>العودة إلى تسجيل الدخول</Text>
            </Pressable>

            <Pressable onPress={handleResend} disabled={isLoading} hitSlop={8}>
              {isLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.resend, { color: colors.primary }]}>إعادة إرسال رسالة التأكيد</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardContainer: { flex: 1 },
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.five, paddingVertical: Spacing.six },
  form: { width: "100%", maxWidth: 440, alignItems: "stretch", gap: Spacing.four },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, textAlign: "center" },
  subtitle: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center" },
  email: { fontFamily: Fonts.semiBold, fontSize: FontSizes.md, textAlign: "center" },
  hint: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 24, textAlign: "center" },
  feedback: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center" },
  button: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: Radius.md },
  buttonText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.md },
  resend: { paddingVertical: Spacing.two, fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "center" },
});
