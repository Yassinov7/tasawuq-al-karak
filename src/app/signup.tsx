import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { SignupCredentialsStep } from "@/components/signup/SignupCredentialsStep";
import { SignupIntroStep } from "@/components/signup/SignupIntroStep";
import { SignupProgress } from "@/components/signup/SignupProgress";
import { SignupRoleStep } from "@/components/signup/SignupRoleStep";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useSignup } from "@/hooks/useSignup";

export default function SignupScreen() {
  const { colors } = useTheme();
  const {
    acceptedTerms,
    accountCreated,
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
    setAgeRange,
    setGender,
    setRole,
    toggleAcceptedTerms,
    updateField,
    validateDetails,
  } = useSignup();

  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [page]);

  const goToPage = (nextPage: 1 | 2 | 3) => {
    clearError();
    setPage(nextPage);
  };

  const continueToRole = () => {
    if (validateDetails()) setPage(3);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView
        edges={["top", "bottom"]}
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <SignupProgress
            step={page}
            onBack={
              page === 1
                ? undefined
                : () => goToPage(page === 3 ? 2 : 1)
            }
          />
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[
              styles.scrollContent,
              page === 1 ? styles.introContent : styles.formContent,
            ]}
          >
            {page === 1 ? (
              <SignupIntroStep onContinue={() => goToPage(2)} />
            ) : page === 2 ? (
              <SignupCredentialsStep
                ageRange={ageRange}
                email={email}
                error={error}
                fieldErrors={fieldErrors}
                fullName={fullName}
                gender={gender}
                passwordValue={password}
                passwordConfirmation={passwordConfirmation}
                onChangeAgeRange={setAgeRange}
                onChangeEmail={(value) => updateField("email", value)}
                onChangeFullName={(value) => updateField("fullName", value)}
                onChangeGender={setGender}
                onChangePassword={(value) => updateField("password", value)}
                onChangePasswordConfirmation={(value) =>
                  updateField("passwordConfirmation", value)
                }
                onContinue={continueToRole}
              />
            ) : (
              <SignupRoleStep
                acceptedTerms={acceptedTerms}
                accountCreated={accountCreated}
                busy={busy}
                error={error}
                role={role}
                onClearError={clearError}
                onContinue={() => void createAccount()}
                onRetryRouting={() => void retryAccountRouting()}
                onSetRole={setRole}
                onToggleTerms={toggleAcceptedTerms}
              />
            )}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.five,
  },
  introContent: {
    paddingHorizontal: 0,
  },
  formContent: {
    paddingBottom: Spacing.four,
  },
  bottomSpacer: {
    height: Spacing.two,
  },
});
