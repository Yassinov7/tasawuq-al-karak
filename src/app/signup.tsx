import { Stack } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { SafeAreaView } from "react-native-safe-area-context";
import { SignupCredentialsStep } from "@/components/signup/SignupCredentialsStep";
import { SignupProgress } from "@/components/signup/SignupProgress";
import { SignupRoleStep } from "@/components/signup/SignupRoleStep";
import { SignupReviewStep } from "@/components/signup/SignupReviewStep";
import { ProfessionalApplicationFields } from "@/components/signup/ProfessionalApplicationFields";
import { SignupErrorNotice } from "@/components/signup/SignupErrorNotice";
import { AppButton } from "@/components/ui/AppButton";
import { useTheme } from "@/context/ThemeContext";
import { useSignup } from "@/hooks/useSignup";
import { useOnboardingExit } from "@/hooks/useOnboardingExit";

export default function SignupScreen() {
  const { colors } = useTheme();
  const signup = useSignup();
  const { busy, accountCreated, clearError } = signup;
  const [page, setPage] = useState(1);
  const scrollRef = useRef<ScrollView>(null);
  const professional = signup.role === "merchant" || signup.role === "driver";
  const total = professional ? 4 : 3;
  const onBack = useCallback(() => {
    if (busy || accountCreated) return true;
    if (page > 1) { setPage(p => p - 1); clearError(); return true; }
    return false;
  }, [busy, accountCreated, clearError, page]);
  const exit = useOnboardingExit({ dirty: !!(signup.role || Object.values(signup.details).some(Boolean) || Object.values(signup.application).some(Boolean)), busy: signup.busy, onBack });
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [page]);
  const labels = professional ? ["نوع الحساب", "بيانات الحساب", "طلب الانضمام", "المراجعة"] : ["نوع الحساب", "بيانات الحساب", "المراجعة"];
  return <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ gestureEnabled: false }}/>
      <SignupProgress step={page} labels={labels} onCancel={exit} busy={signup.busy} onBack={page > 1 && !signup.accountCreated ? () => { onBack(); } : undefined}/>
      <KeyboardAwareScrollView ref={scrollRef} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}>
        {page === 1 ? <SignupRoleStep role={signup.role} onSetRole={signup.setRole} onContinue={() => setPage(2)} onExit={exit} error={signup.error}/> : null}
        {page === 2 && signup.role ? <SignupCredentialsStep value={signup.details} role={signup.role} errors={signup.fieldErrors} error={signup.error} onChange={signup.updateField} onContinue={() => { if (signup.validateDetails()) setPage(3); }}/> : null}
        {page === 3 && professional ? <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: 20, paddingVertical: 20 }}>
          <ProfessionalApplicationFields role={signup.role as "merchant" | "driver"} value={signup.application} onChange={signup.updateApplication} errors={signup.applicationErrors}/>
          <SignupErrorNotice message={signup.error}/>
          <AppButton design="refined" title="التالي: المراجعة والإرسال" onPress={() => { if (signup.validateApplication()) setPage(4); }}/>
        </View> : null}
        {page === total && signup.role ? <SignupReviewStep role={signup.role} details={signup.details} application={signup.application} accepted={signup.acceptedTerms} busy={signup.busy} created={signup.accountCreated} error={signup.error} onToggle={signup.toggleAcceptedTerms} onSubmit={() => void signup.createAccount()} onRetry={() => void signup.retryAccountRouting()}/> : null}
      </KeyboardAwareScrollView>
  </SafeAreaView>;
}
