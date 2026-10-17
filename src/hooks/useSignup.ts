import { useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";

import {
  getAccountRoute,
  getAccountRoutingErrorMessage,
} from "@/lib/account-routing";
import { supabase } from "@/lib/supabase";
import type {
  ProfileAgeRange,
  ProfileGender,
} from "@/types/profile-demographics";

export type SignupRole = "customer" | "merchant" | "driver";
export type SignupField =
  | "fullName"
  | "email"
  | "password"
  | "passwordConfirmation";

type SignupFieldErrors = Partial<Record<SignupField, string>>;

export function useSignup() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [ageRange, setAgeRange] = useState<ProfileAgeRange | null>(null);
  const [gender, setGender] = useState<ProfileGender | null>(null);
  const [role, setRole] = useState<SignupRole | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError("");
    setFieldErrors({});
  }, []);

  const validateDetails = useCallback(() => {
    setError("");
    setFieldErrors({});

    if (fullName.trim().length < 2) {
      const message = "أدخل اسمك الكامل.";
      setError(message);
      setFieldErrors({ fullName: message });
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const message = "أدخل بريدًا إلكترونيًا صحيحًا.";
      setError(message);
      setFieldErrors({ email: message });
      return false;
    }

    if (password.length < 8) {
      const message = "كلمة المرور يجب ألا تقل عن 8 أحرف.";
      setError(message);
      setFieldErrors({ password: message });
      return false;
    }

    if (password !== passwordConfirmation) {
      const message = "كلمتا المرور غير متطابقتين.";
      setError(message);
      setFieldErrors({ passwordConfirmation: message });
      return false;
    }

    return true;
  }, [email, fullName, password, passwordConfirmation]);

  const createAccount = useCallback(async () => {
    if (busy || createdAccountId) return;
    setError("");

    if (!role) {
      setError("اختر دورًا واحدًا للمتابعة.");
      return;
    }

    if (!acceptedTerms) {
      setError(
        "يجب الموافقة على شروط الاستخدام وسياسة الخصوصية قبل إنشاء الحساب.",
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    setBusy(true);

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            signup_role: role,
            signup_age_range: ageRange,
            signup_gender: gender,
          },
        },
      });

      if (signupError) {
        setError(
          signupError.message.includes("already registered")
            ? "تعذر إنشاء الحساب بهذا البريد. إن كان لديك حساب، جرّب تسجيل الدخول أو استعادة كلمة المرور."
            : "تعذر إنشاء الحساب. تحقق من الاتصال وإعداد البريد ثم أعد المحاولة.",
        );
        return;
      }

      if (!data.session || !data.user) {
        router.replace({
          pathname: "/verify-email",
          params: {
            email: cleanEmail,
            role,
          },
        } as unknown as Href);
        return;
      }

      try {
        const destination = await getAccountRoute(data.user.id);
        router.replace(destination as Href);
      } catch (routingError) {
        setCreatedAccountId(data.user.id);
        setError(
          `تم إنشاء الحساب، لكن تعذر توجيهك الآن. ${getAccountRoutingErrorMessage(routingError)}`,
        );
      }
    } catch {
      setError("تعذر الاتصال بالخدمة. تحقق من الإنترنت ثم حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }, [
    acceptedTerms,
    ageRange,
    busy,
    createdAccountId,
    email,
    fullName,
    gender,
    password,
    role,
    router,
  ]);

  const retryAccountRouting = useCallback(async () => {
    if (!createdAccountId || busy) return;
    setError("");
    setBusy(true);

    try {
      const destination = await getAccountRoute(createdAccountId);
      router.replace(destination as Href);
    } catch (routingError) {
      setError(getAccountRoutingErrorMessage(routingError));
    } finally {
      setBusy(false);
    }
  }, [busy, createdAccountId, router]);

  const toggleAcceptedTerms = useCallback(() => {
    setAcceptedTerms((current) => !current);
    setError("");
  }, []);

  const updateField = useCallback(
    (field: SignupField, value: string) => {
      const setters: Record<SignupField, (next: string) => void> = {
        fullName: setFullName,
        email: setEmail,
        password: setPassword,
        passwordConfirmation: setPasswordConfirmation,
      };
      setters[field](value);
      setError("");
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[field];
        if (field === "password") delete next.passwordConfirmation;
        return next;
      });
    },
    [],
  );

  return {
    acceptedTerms,
    accountCreated: createdAccountId !== null,
    ageRange,
    busy,
    clearError,
    createAccount,
    email,
    error,
    fieldErrors,
    fullName,
    gender,
    password,
    passwordConfirmation,
    role,
    retryAccountRouting,
    setEmail,
    setAgeRange,
    setFullName,
    setGender,
    setPassword,
    setPasswordConfirmation,
    setRole,
    updateField,
    toggleAcceptedTerms,
    validateDetails,
  };
}
