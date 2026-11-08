import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { LoginFooter } from "@/components/login/LoginFooter";
import { LoginForm } from "@/components/login/LoginForm";
import { LoginHeader } from "@/components/login/LoginHeader";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useLogin } from "@/hooks/useLogin";

export default function LoginScreen() {
  const { colors } = useTheme();
  const {
    busy,
    fieldErrors,
    clearError,
    email,
    error,
    login,
    openReset,
    password,
    resetEmail, resetError, changeResetEmail,
    resetBusy,
    resetMessage,
    resetVisible,
    sendReset,
    setEmail,
    setPassword,
    closeReset,
    dismissResetMessage,
  } = useLogin();

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
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.page}>
              <LoginHeader />
              <LoginForm
                busy={busy}
                fieldErrors={fieldErrors}
                email={email}
                error={error}
                password={password}
                resetEmail={resetEmail} resetError={resetError} onChangeResetEmail={changeResetEmail}
                resetBusy={resetBusy}
                resetMessage={resetMessage}
                resetVisible={resetVisible}
                onChangeEmail={(value) => {
                  setEmail(value);
                  clearError();
                }}
                onChangePassword={(value) => {
                  setPassword(value);
                  clearError();
                }}
                onCancelReset={closeReset}
                onCloseResetMessage={dismissResetMessage}
                onLogin={() => void login()}
                onOpenReset={openReset}
                onSendReset={() => void sendReset()}
              />
              <LoginFooter />
            </View>
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
    paddingVertical: Spacing.four,
  },
  page: {
    flexGrow: 1,
    justifyContent: "center",
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    paddingVertical: Spacing.two,
  },
});
