import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import { Fonts, FontSizes, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const resend = async () => {
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    setMessage(error ? "تعذر إرسال رسالة جديدة. حاول بعد قليل." : "أرسلنا رسالة تحقق جديدة إلى بريدك.");
  };

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <BrandMark size="medium" />
    <Text style={[styles.title, { color: colors.text }]}>تحقق من بريدك الإلكتروني</Text>
    <Text style={[styles.body, { color: colors.textSecondary }]}>أرسلنا رابط تفعيل الحساب إلى {email ?? "بريدك الإلكتروني"}. افتح الرابط ثم سجّل الدخول للمتابعة.</Text>
    <View style={styles.actions}>
      <AppButton title="العودة لتسجيل الدخول" onPress={() => router.replace("/login")} />
      <AppButton title="إعادة إرسال رسالة التحقق" variant="outline" onPress={() => void resend()} loading={busy} disabled={!email} />
    </View>
    <AppModal visible={Boolean(message)} title="حالة رسالة التحقق" message={message} onCancel={() => setMessage("")} />
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.five }, title: { marginTop: Spacing.five, fontFamily: Fonts.bold, fontSize: FontSizes.xl, textAlign: "center" }, body: { marginTop: Spacing.three, fontFamily: Fonts.regular, fontSize: FontSizes.md, lineHeight: 27, textAlign: "center" }, actions: { width: "100%", maxWidth: 440, gap: Spacing.three, marginTop: Spacing.six } });
