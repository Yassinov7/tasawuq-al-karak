import { OnboardingFrame } from "@/components/auth/OnboardingFrame";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import { Fonts, FontSizes, Spacing, Typography, LayoutSpacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { colors } = useTheme();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const resend = async () => {
    if (!email || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      setMessage(error ? "تعذر إرسال رسالة جديدة. حاول بعد قليل." : "إذا كان البريد بانتظار التحقق فستصلك رسالة جديدة.");
    } catch { setMessage("تعذر الاتصال. حاول مرة أخرى."); }
    finally { lock.current = false; setBusy(false); }
  };

  return <OnboardingFrame title="التحقق من البريد"><ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background, flexGrow: 1 }]}>
    <BrandMark size="medium" />
    <Text style={[styles.title, { color: colors.text }]}>تحقق من بريدك الإلكتروني</Text>
    <Text style={[styles.body, { color: colors.textSecondary }]}>أرسلنا رابط تفعيل الحساب إلى {email ?? "بريدك الإلكتروني"}. افتح الرابط ثم سجّل الدخول للمتابعة.</Text>
    <View style={styles.actions}>
      <AppButton design="refined" title="العودة لتسجيل الدخول" onPress={() => router.replace("/login")} />
      <AppButton design="refined" title="إعادة إرسال رسالة التحقق" variant="outline" onPress={() => void resend()} loading={busy} disabled={!email} />
    </View>
    <AppModal design="refined" visible={Boolean(message)} title="حالة رسالة التحقق" message={message} onCancel={() => setMessage("")} />
  </ScrollView></OnboardingFrame>;
}

const styles = StyleSheet.create({ container: { justifyContent: "center", alignItems: "center", padding: LayoutSpacing.pageGutter }, title: { marginTop: Spacing.five, ...Typography.pageTitle, textAlign: "center" }, body: { marginTop: Spacing.three, fontFamily: Fonts.regular, fontSize: FontSizes.md, lineHeight: 27, textAlign: "center" }, actions: { width: "100%", maxWidth: 440, gap: Spacing.three, marginTop: Spacing.six } });
