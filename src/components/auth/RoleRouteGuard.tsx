import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { Fonts, FontSizes, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  getAccountRoute,
  getAccountRoutingErrorMessage,
} from "@/lib/account-routing";

type ProtectedRole = "merchant" | "driver" | "admin";

type RoleRouteGuardProps = PropsWithChildren<{
  role: ProtectedRole;
}>;

export function RoleRouteGuard({ role, children }: RoleRouteGuardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    user,
    loading: authLoading,
    initializationError,
    retrySession,
  } = useAuth();
  const [authorizedUserId, setAuthorizedUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    if (authLoading) return () => { active = false; };
    if (initializationError) {
      return () => { active = false; };
    }
    if (!user) {
      router.replace("/login");
      return () => { active = false; };
    }

    void getAccountRoute(user.id)
      .then((destination) => {
        if (!active) return;
        if (destination === `/${role}`) {
          setError("");
          setAuthorizedUserId(user.id);
        } else {
          router.replace(destination);
        }
      })
      .catch((routingError: unknown) => {
        if (active) setError(getAccountRoutingErrorMessage(routingError));
      });

    return () => {
      active = false;
    };
  }, [
    authLoading,
    initializationError,
    retryCount,
    role,
    router,
    user,
  ]);

  if (
    authorizedUserId === user?.id &&
    !authLoading &&
    !initializationError
  ) {
    return children;
  }

  const displayError = initializationError
    ? "تعذر التحقق من جلسة الدخول. حاول مرة أخرى."
    : error;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {displayError ? (
        <>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {displayError}
          </Text>
          <AppButton
            title="إعادة المحاولة"
            onPress={() => {
              setError("");
              if (initializationError) {
                void retrySession();
              } else {
                setRetryCount((count) => count + 1);
              }
            }}
          />
        </>
      ) : (
        <ActivityIndicator size="large" color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.five,
  },
  message: {
    marginBottom: Spacing.four,
    textAlign: "center",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 24,
  },
});
