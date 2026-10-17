import { useCallback, useState } from "react";
import { useRouter, type Href } from "expo-router";

import {
  getAccountRoute,
  getAccountRoutingErrorMessage,
} from "@/lib/account-routing";
import { supabase } from "@/lib/supabase";

export function useLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const clearError = useCallback(() => setError(""), []);

  const login = useCallback(async () => {
    if (busy) return;
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }
    if (!password) {
      setError("أدخل كلمة المرور.");
      return;
    }

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
      setBusy(false);
    }
  }, [busy, email, password, router]);

  const openReset = useCallback(() => {
    setResetMessage("");
    setResetVisible(true);
  }, []);

  const closeReset = useCallback(() => {
    if (!resetBusy) setResetVisible(false);
  }, [resetBusy]);

  const sendReset = useCallback(async () => {
    if (resetBusy) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setResetMessage("أدخل بريدًا إلكترونيًا صحيحًا في صفحة الدخول أولًا.");
      return;
    }

    setResetBusy(true);
    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(cleanEmail);
      setResetMessage(
        resetError
          ? "تعذر إرسال الرسالة الآن. حاول مجددًا بعد قليل."
          : "إذا كان البريد مسجلًا، ستصلك رسالة لإعادة تعيين كلمة المرور.",
      );
    } catch {
      setResetMessage("تعذر الاتصال بالخدمة الآن. حاول مجددًا بعد قليل.");
    } finally {
      setResetBusy(false);
    }
  }, [email, resetBusy]);

  const dismissResetMessage = useCallback(() => {
    setResetVisible(false);
  }, []);

  return {
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
