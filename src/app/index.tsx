import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export default function SplashScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/login");
    }, 1800);

    return () => clearTimeout(timer);
  }, [router]);

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
