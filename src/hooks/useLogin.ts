import { useCallback, useRef, useState } from "react";
import * as Linking from "expo-linking";
import { useRouter, type Href } from "expo-router";

import {
  getAccountRoute,
  getAccountRoutingErrorMessage,
} from "@/lib/account-routing";
import { supabase } from "@/lib/supabase";

export function useLogin() {
  const router = useRouter();
  const loginLock = useRef(false);
  const resetLock = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  const clearError = useCallback(() => { setError(""); setFieldErrors({}); }, []);

  const login = useCallback(async () => {
    if (loginLock.current) return;
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setFieldErrors({ email: "أدخل بريدًا إلكترونيًا صحيحًا." });
      return;
    }
    if (!password) {
      setFieldErrors({ password: "أدخل كلمة المرور." });
      return;
    }

    loginLock.current = true;
    setFieldErrors({});
    setBusy(true);
    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError || !data.user) {
        setError(
          loginError?.message.includes("Email not confirmed")
            ? "أكد بريدك الإلكتروني من الرسالة التي وصلتك، ثم سجّل الدخول."
            : "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.",
        );
        return;
      }

      try {
        const destination = await getAccountRoute(data.user.id);
        router.replace(destination as Href);
      } catch (routingError) {
        setError(getAccountRoutingErrorMessage(routingError));
      }
    } catch {
      setError("تعذر الاتصال بالخدمة. تحقق من الإنترنت ثم حاول مجددًا.");
    } finally {
      loginLock.current = false;
      setBusy(false);
    }
  }, [email, password, router]);

  const openReset = useCallback(() => {
    setResetEmail(email); setResetError("");
    setResetMessage("");
    setResetVisible(true);
  }, [email]);

  const closeReset = useCallback(() => {
    if (!resetBusy) setResetVisible(false);
  }, [resetBusy]);

  const sendReset = useCallback(async () => {
    if (resetLock.current) return;

    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setResetError("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }

    setResetError(""); setResetMessage("");
    resetLock.current = true;
    setResetBusy(true);
    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: Linking.createURL("reset-password") });
      if (resetError) setResetError("تعذر إرسال الرسالة الآن. حاول مجددًا بعد قليل.");
      else setResetMessage("إذا كان البريد مسجلًا، ستصلك رسالة لإعادة تعيين كلمة المرور.");
    } catch {
      setResetError("تعذر الاتصال بالخدمة الآن. حاول مجددًا بعد قليل.");
    } finally {
      resetLock.current = false;
      setResetBusy(false);
    }
  }, [resetEmail]);

  const changeResetEmail = useCallback((value: string) => { if (resetLock.current) return; setResetEmail(value); setResetError(""); setResetMessage(""); }, []);
  const dismissResetMessage = useCallback(() => {
    setResetVisible(false);
  }, []);

  return {
    fieldErrors,
    resetEmail, resetError, changeResetEmail,
    busy,
    clearError,
    email,
    error,
    login,
    openReset,
    password,
    resetBusy,
    resetMessage,
    resetVisible,
    sendReset,
    setEmail,
    setPassword,
    closeReset,
    dismissResetMessage,
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
