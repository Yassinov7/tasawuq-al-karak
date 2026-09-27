import { Image, StyleSheet, View } from "react-native";

import { useTheme } from "@/context/ThemeContext";

type BrandMarkProps = {
  showSubtitle?: boolean;
  size?: "small" | "medium" | "large";
};

export function BrandMark({ size = "large" }: BrandMarkProps) {
  const { isDark } = useTheme();

  const isLarge = size === "large";
  const isMedium = size === "medium";

  const logoSource = isDark
    ? require("../../../assets/images/branding/taswoq-logo-dark.png")
    : require("../../../assets/images/branding/taswoq-logo-light.png");

  return (
    <View style={styles.container}>
      <Image
        source={logoSource}
        resizeMode="contain"
        accessibilityLabel="شعار تسوق"
        style={[
          styles.logo,
          isLarge
            ? styles.largeLogo
            : isMedium
              ? styles.mediumLogo
              : styles.smallLogo,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    height: undefined,
  },

  largeLogo: {
    width: 230,
    aspectRatio: 1,
  },

  mediumLogo: {
    width: 170,
    aspectRatio: 1,
  },

  smallLogo: {
    width: 76,
    aspectRatio: 1,
  },
});
