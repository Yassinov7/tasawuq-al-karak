import { Href, useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { getDashboardPath } from "@/context/WorkspaceContext";

export default function SplashScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!session) router.replace("/login");
      else void getDashboardPath(session.user.id).then((path) => router.replace(path as Href));
    }
  }, [isLoading, router, session]);

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

  line: {
    width: 42,
    height: 4,
    borderRadius: 999,
  },
});
