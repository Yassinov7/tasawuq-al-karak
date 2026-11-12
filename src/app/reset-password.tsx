import { logoutPersonalAccount } from "@/lib/personal-account";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Keyboard, Text } from "react-native";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { useAppDialog } from "@/context/AppDialogContext";
import { OnboardingFrame } from "@/components/auth/OnboardingFrame";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { parseRecoveryLink } from "@/lib/password-recovery";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { confirm } = useAppDialog();
  const url = Linking.useURL();
  const { colors } = useTheme();
  const [checking, setChecking] = useState(true);
  const [authorizedUser, setAuthorizedUser] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const verification = useRef<{ url: string; request: Promise<string> } | null>(null);
  useEffect(() => {
    let active = true;
    if (!url) { void Linking.getInitialURL().then((initial) => { if (active && !initial) { setChecking(false); setError("افتح رابط استعادة كلمة المرور من بريدك الإلكتروني."); } }).catch(() => { if (active) { setChecking(false); setError("تعذر قراءة رابط الاستعادة. افتحه من البريد مرة أخرى."); } }); return () => { active = false; }; }
    void Promise.resolve().then(() => { if (active) { setChecking(true); setAuthorizedUser(null); setError(""); setSaved(false); } });
    if (verification.current?.url !== url) {
      verification.current = { url, request: (async () => {
        const credentials = parseRecoveryLink(url);
        if (!credentials) throw new Error("invalid-recovery");
        const result = "token_hash" in credentials
          ? await supabase.auth.verifyOtp({ token_hash: credentials.token_hash, type: "recovery" })
          : await supabase.auth.setSession(credentials);
        if (result.error || !result.data.session) throw new Error("expired-recovery");
        const identity = await supabase.auth.getUser();
        if (identity.error || !identity.data.user) throw new Error("invalid-session");
        return identity.data.user.id;
      })() };
    }
    void verification.current.request.then((id) => { if (active) setAuthorizedUser(id); }).catch(() => { if (active) setError("رابط الاستعادة غير صالح أو منتهٍ. عد للدخول واطلب رسالة جديدة."); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [url]);
  const leave = useCallback(() => {
    if (busy || checking || lock.current) return;
    lock.current = true;
    const finish = async () => {
      setBusy(true);
      try {
        if (authorizedUser) {
          if(!await logoutPersonalAccount(authorizedUser))throw Error("تغيرت جلسة الدخول.");
        } else if (saved) {
          const result = await supabase.auth.signOut({ scope: "local" });
          if (result.error) throw result.error;
        }
        router.replace("/login");
      } catch { setError("تعذر إنهاء الجلسة والعودة للدخول. حاول مرة أخرى."); }
      finally { lock.current = false; setBusy(false); }
    };
    if (!saved && (password || confirmation)) {
      Keyboard.dismiss();
      void confirm({ title: "العودة دون حفظ؟", message: "ستُهمل كلمة المرور المدخلة دون حفظها.", confirmText: "تجاهل والعودة", cancelText: "متابعة التعديل", destructive: true }).then(accepted => { if (accepted) void finish(); else lock.current = false; });
    }
    else void finish();
  }, [authorizedUser, busy, checking, confirmation, password, router, saved, confirm]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => { leave(); return true; });
    return () => listener.remove();
  }, [leave]));
  const submit = async () => {
    if (lock.current || !authorizedUser || saved) return;
    if (password.length < 8) { setFieldError("كلمة المرور يجب ألا تقل عن 8 أحرف."); return; }
    if (password !== confirmation) { setFieldError("كلمتا المرور غير متطابقتين."); return; }
    lock.current = true; setBusy(true); setFieldError(""); setError("");
    try {
      const identity = await supabase.auth.getUser();
      if (identity.error || identity.data.user?.id !== authorizedUser) { setAuthorizedUser(null); throw new Error("session-changed"); }
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      setSaved(true); setPassword(""); setConfirmation("");
    } catch { setError("تعذر تأكيد تغيير كلمة المرور. تحقق من الاتصال وصلاحية الرابط ثم حاول مجددًا."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <OnboardingFrame title="كلمة مرور جديدة">
    <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {checking ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text accessibilityRole="alert" style={[Typography.body, { color: colors.errorForeground, textAlign: "right" }]}>{error}</Text> : null}
      {saved ? <Text accessibilityRole="alert" style={[Typography.bodyStrong, { color: colors.successForeground, textAlign: "right" }]}>تم تغيير كلمة المرور بنجاح. سجّل الدخول بكلمة المرور الجديدة.</Text> : authorizedUser ? <>
        <AppTextField design="refined" label="كلمة المرور الجديدة" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} disabled={busy} error={password.length > 0 && password.length < 8 ? fieldError : undefined} />
        <AppTextField design="refined" label="تأكيد كلمة المرور" secureTextEntry autoComplete="new-password" value={confirmation} onChangeText={setConfirmation} disabled={busy} error={fieldError} />
        <AppButton design="refined" title="حفظ كلمة المرور" loading={busy} onPress={() => void submit()} />
      </> : null}
      <AppButton design="refined" title="العودة لتسجيل الدخول" variant="outline" disabled={busy || checking} onPress={leave} />
    </KeyboardAwareScrollView>
  </OnboardingFrame>;
}
