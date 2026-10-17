import { useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/context/AuthContext";
import { Fonts, FontSizes, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import {
  getAccountRoute,
  getAccountRoutingErrorMessage,
} from "@/lib/account-routing";

export default function SplashScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    user,
    loading,
    initializationError,
    retrySession,
  } = useAuth();
  const [routingError, setRoutingError] = useState<{
    userId: string;
    message: string;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    if (initializationError) {
      return () => {
        alive = false;
      };
    }
    if (!user) {
      router.replace("/login");
      return () => {
        alive = false;
      };
    }
    void getAccountRoute(user.id)
      .then((path) => {
        if (alive) router.replace(path as Href);
      })
      .catch((error: unknown) => {
        if (alive) {
          setRoutingError({
            userId: user.id,
            message: getAccountRoutingErrorMessage(error),
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [initializationError, loading, retryCount, router, user]);
  const displayedError = initializationError
    ? "تعذر استعادة جلسة الدخول. حاول مرة أخرى."
    : routingError && routingError.userId === user?.id
      ? routingError.message
      : "";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <BrandMark />
      {loading || !displayedError ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <View style={styles.errorContent}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {displayedError}
          </Text>
          <AppButton
            title="إعادة المحاولة"
            onPress={() => {
              setRoutingError(null);
              if (initializationError) {
                void retrySession();
              } else {
                setRetryCount((count) => count + 1);
              }
            }}
          />
          <AppButton
            title="العودة لتسجيل الدخول"
            variant="outline"
            onPress={() => router.replace("/login")}
          />
        </View>
      )}

      <View style={styles.bottom}>
        <View
          style={[
            styles.line,
            {
              backgroundColor: colors.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.six,
  },

  bottom: {
    position: "absolute",
    bottom: Spacing.seven,
    alignItems: "center",
  },

  loading: { marginTop: Spacing.four },
  errorContent: {
    width: "100%",
    maxWidth: 420,
    gap: Spacing.three,
    marginTop: Spacing.six,
  },
  errorText: {
    textAlign: "center",
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 24,
  },

  line: {
    width: 42,
    height: 4,
    borderRadius: 999,
  },
});
