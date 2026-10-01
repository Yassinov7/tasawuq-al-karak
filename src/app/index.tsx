import { useRouter, type Href } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { useAuth } from "@/context/AuthContext";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getAccountRoute } from "@/lib/account-routing";
import { supabase } from "@/lib/supabase";

export default function SplashScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    let alive = true;
    if (!user) {
      router.replace("/login");
      return () => { alive = false; };
    }
    void getAccountRoute(user.id).then((path) => {
      if (alive) router.replace(path as Href);
    }).catch(async () => {
      await supabase.auth.signOut();
      if (alive) router.replace("/login");
    });
    return () => { alive = false; };
  }, [loading, router, user]);

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
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}

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

  line: {
    width: 42,
    height: 4,
    borderRadius: 999,
  },
});
