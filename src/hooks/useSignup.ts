import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { getAccountRoute, getAccountRoutingErrorMessage } from "@/lib/account-routing";
import { supabase } from "@/lib/supabase";
import { emptyProfessionalApplication, signupMetadata, validateSignupDetails, validateProfessionalApplication, type SignupRole, type SignupField, type SignupFieldErrors, type SignupDetails, type ProfessionalApplication, type ApplicationFieldErrors } from "@/lib/signup-data";
export type { SignupRole, SignupField } from "@/lib/signup-data";

export function useSignup() {
  const router = useRouter();
  const lock = useRef(false);
  const [details, setDetails] = useState<SignupDetails>({ fullName: "", email: "", password: "", passwordConfirmation: "", birthDate: "" });
  const [application, setApplication] = useState<ProfessionalApplication>(emptyProfessionalApplication);
  const [role, updateRole] = useState<SignupRole | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [applicationErrors, setApplicationErrors] = useState<ApplicationFieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);
  const clearError = useCallback(() => { setError(""); setFieldErrors({}); setApplicationErrors({}); }, []);
  const setRole = (next: SignupRole) => { if (createdAccountId || busy || lock.current) return; if (next !== role) { setApplication(emptyProfessionalApplication); setAcceptedTerms(false); } updateRole(next); clearError(); };
  const updateField = (field: SignupField, value: string) => { setDetails(old => ({ ...old, [field]: value })); clearError(); setAcceptedTerms(false); };
  const updateApplication = (field: keyof ProfessionalApplication, value: string) => { setApplication(old => ({ ...old, [field]: value })); clearError(); setAcceptedTerms(false); };
  const validateDetails = () => { const errors = validateSignupDetails(details); setFieldErrors(errors); setError(""); return Object.keys(errors).length === 0; };
  const validateApplication = () => { if (!role) return false; const errors = validateProfessionalApplication(role, application); setApplicationErrors(errors); return Object.keys(errors).length === 0; };
  const retryAccountRouting = async () => {
    if (!createdAccountId || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { router.replace(await getAccountRoute(createdAccountId)); } catch (cause) { setError(getAccountRoutingErrorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  const createAccount = async () => {
    if (lock.current || busy || createdAccountId) return;
    if (!role) { setError("اختر نوع الحساب أولًا."); return; }
    if (!validateDetails() || !validateApplication()) { setError("راجع البيانات المطلوبة قبل إنشاء الحساب."); return; }
    if (!acceptedTerms) { setError("وافق على الشروط وسياسة الخصوصية بعد مراجعة بياناتك."); return; }
    const selectedRole = role;
    const email = details.email.trim().toLowerCase();
    const metadata = signupMetadata(selectedRole, details, application);
    lock.current = true; setBusy(true); setError("");
    try {
      // Do not create a partial professional account against an older server.
      const capability = await supabase.rpc("get_signup_capabilities");
      if (capability.error || capability.data !== 3) { setError("التسجيل المحدّث غير جاهز في الخادم بعد. حاول لاحقًا أو تواصل مع الدعم؛ لم نرسل بيانات إنشاء الحساب."); return; }
      const { data, error: signupError } = await supabase.auth.signUp({ email, password: details.password, options: { data: metadata } });
      if (signupError) { setError(signupError.message.includes("already registered") ? "تعذر إنشاء الحساب بهذا البريد. جرّب تسجيل الدخول أو استعادة كلمة المرور." : "تعذر تأكيد إنشاء الحساب. تحقق من البريد وحالة الدخول قبل إعادة المحاولة؛ قد تكون بيانات الطلب أو الخدمة غير متاحة."); return; }
      // Existing-account responses may be obfuscated: only promise verification, not submission success.
      if (!data.session) { setDetails(old => ({ ...old, password: "", passwordConfirmation: "" })); router.replace({ pathname: "/verify-email", params: { email, role: selectedRole } }); return; }
      if (!data.user) throw Error("missing-user");
      setCreatedAccountId(data.user.id);
      setDetails(old => ({ ...old, password: "", passwordConfirmation: "" }));
      try { router.replace(await getAccountRoute(data.user.id)); }
      catch (cause) { setError(`تم إنشاء الحساب وحفظ البيانات، لكن تعذر فتحه الآن. ${getAccountRoutingErrorMessage(cause)}`); }
    } catch { setError("انقطع الاتصال وتعذر تأكيد النتيجة. تحقق من رسالة البريد وحاول تسجيل الدخول قبل إعادة إنشاء الحساب."); }
    finally { lock.current = false; setBusy(false); }
  };
  return { role, setRole, details, application, updateField, updateApplication, acceptedTerms, toggleAcceptedTerms: () => setAcceptedTerms(old => !old), busy, error, clearError, fieldErrors, applicationErrors, validateDetails, validateApplication, createAccount, retryAccountRouting, accountCreated: createdAccountId !== null };
}
