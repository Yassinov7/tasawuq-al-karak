import { readCategoryLabels } from "@/lib/catalog-categories";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Text } from "react-native";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { OnboardingFrame } from "@/components/auth/OnboardingFrame";
import { BirthDateField } from "@/components/signup/BirthDateField";
import { ProfessionalApplicationFields } from "@/components/signup/ProfessionalApplicationFields";
import { AppButton } from "@/components/ui/AppButton";
import { Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useOnboardingExit } from "@/hooks/useOnboardingExit";
import { emptyProfessionalApplication, normalizeBirthDate, normalizeContactPhone, validateProfessionalApplication, type SignupRole, type ApplicationFieldErrors, type ProfessionalApplication } from "@/lib/signup-data";
import { getAccountRoute } from "@/lib/account-routing";
import { supabase } from "@/lib/supabase";

export function ProfessionalApplicationScreen({ role }: { role: Exclude<SignupRole, "customer"> }) {
  const { user } = useAuth();
  return <ApplicationOwner key={user?.id ?? "guest"} role={role}/>;
}
function ApplicationOwner({ role }: { role: Exclude<SignupRole, "customer"> }) {
  const { user } = useAuth(), { colors } = useTheme(), router = useRouter();
  const [value, setValue] = useState<ProfessionalApplication>(emptyProfessionalApplication);
  const [birthDate, setBirthDate] = useState("");
  const [savedCategory, setSavedCategory] = useState<{ id: string; name: string }>();
  const [base, setBase] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [errors, setErrors] = useState<ApplicationFieldErrors>({});
  const [birthError, setBirthError] = useState("");
  const [retry, setRetry] = useState(0);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const cancel = useOnboardingExit({ dirty: !loading && JSON.stringify([value, birthDate]) !== base, busy });
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true); setError("");
      try {
        if (!user) { router.replace("/login"); return; }
        const profile = await supabase.from("profiles").select("role,birth_date").eq("id", user.id).single();
        if (profile.error) throw profile.error;
        if (profile.data.role !== role) { router.replace(await getAccountRoute(user.id)); return; }
        let next = { ...emptyProfessionalApplication };
        if (role === "merchant") {
          const result = await supabase.from("merchant_applications").select("status,store_name,category_id,contact_phone,store_address,plan_id").eq("user_id", user.id).maybeSingle();
          if (result.error) throw result.error;
          if (result.data && (result.data.status === "accepted" || (result.data.status === "pending" && result.data.plan_id))) { router.replace(await getAccountRoute(user.id)); return; }
          if (result.data) {
            next = { ...next, phone: result.data.contact_phone, storeName: result.data.store_name, address: result.data.store_address, categoryId: result.data.category_id, planId: result.data.plan_id ?? "" };
            const label = (await readCategoryLabels("store", [next.categoryId])).get(next.categoryId);
            if (active) setSavedCategory(label ? { id: next.categoryId, name: label.name } : undefined);
          }
        } else {
          const result = await supabase.from("driver_applications").select("status,contact_phone,vehicle_type").eq("user_id", user.id).maybeSingle();
          if (result.error) throw result.error;
          if (result.data && ["pending", "accepted"].includes(result.data.status)) { router.replace(await getAccountRoute(user.id)); return; }
          if (result.data) next = { ...next, phone: result.data.contact_phone, vehicle: result.data.vehicle_type };
        }
        if (active) { const date = profile.data.birth_date ?? ""; setValue(next); setBirthDate(date); setBase(JSON.stringify([next, date])); }
      } catch { if (active) setError("تعذر تحميل طلب الانضمام. أعد المحاولة؛ لم نغير بياناتك."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [role, user, router, retry]);
  const change = useCallback((field: keyof ProfessionalApplication, next: string) => { setValue(old => ({ ...old, [field]: next })); setErrors({}); }, []);
  const submit = async () => {
    if (!user || lock.current) return;
    const nextErrors = validateProfessionalApplication(role, value), date = normalizeBirthDate(birthDate);
    setErrors(nextErrors); setBirthError(date ? "" : "أدخل تاريخ ميلاد صحيحًا سابقًا لليوم.");
    if (Object.keys(nextErrors).length || !date) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const identity = await supabase.auth.getUser();
      if (identity.error || identity.data.user?.id !== user.id) throw Error("changed-account");
      const payload = role === "merchant" ? { plan_id: value.planId, contact_phone: normalizeContactPhone(value.phone), store_name: value.storeName.trim(), category_id: value.categoryId, store_address: value.address.trim() } : { contact_phone: normalizeContactPhone(value.phone), vehicle_type: value.vehicle.trim() };
      const result = await supabase.rpc("submit_professional_onboarding", { input_application: payload, input_birth_date: date });
      const after = await supabase.auth.getUser();
      if (after.error || after.data.user?.id !== user.id) throw Error("changed-account");
      if (result.error) throw result.error;
      if (alive.current) router.replace("/application-status");
    } catch { if (alive.current) setError("تعذر تأكيد الإرسال. احتفظنا بتعديلاتك؛ تحقق من حالة الطلب قبل إعادة المحاولة."); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return <OnboardingFrame title={role === "merchant" ? "طلب انضمام التاجر" : "طلب انضمام السائق"} busy={busy} onCancel={cancel}>
    <KeyboardAwareScrollView contentContainerStyle={{ padding: 20, width: "100%", maxWidth: 560, alignSelf: "center", gap: 20 }}>
      {loading ? <ActivityIndicator color={colors.primary}/> : <>
        <BirthDateField value={birthDate} onChange={setBirthDate} error={birthError} disabled={busy}/>
        <ProfessionalApplicationFields role={role} value={value} onChange={change} errors={errors} disabled={busy} historicalCategoryName={savedCategory?.id === value.categoryId ? savedCategory.name : undefined}/>
        {error ? <Text accessibilityRole="alert" style={{ ...Typography.body, color: colors.errorForeground, textAlign: "right" }}>{error}</Text> : null}
        {base ? <AppButton title="إرسال الطلب للمراجعة" onPress={() => void submit()} loading={busy}/> : <AppButton title="إعادة التحميل" onPress={() => setRetry(n => n + 1)}/>}
      </>}
    </KeyboardAwareScrollView>
  </OnboardingFrame>;
}
