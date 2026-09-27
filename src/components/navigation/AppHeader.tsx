import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, Radius, Spacing } from "@/constants/theme";
import { useNotifications } from "@/context/NotificationContext";
import { useTheme } from "@/context/ThemeContext";

type AppHeaderProps = {
  title?: string;
  showBack?: boolean;
  cartCount?: number;
};

export function AppHeader({
  title = "تسوق",
  showBack = false,
  cartCount = 0,
}: AppHeaderProps) {
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const { colors, isDark } = useTheme();

  const logoSource = isDark
    ? require("../../../assets/images/branding/taswoq-logo-dark.png")
    : require("../../../assets/images/branding/taswoq-logo-light.png");

  const handleOrdersPress = () => {
    router.push("/orders");
  };

  const handleNotificationsPress = () => {
    router.push("/notifications");
  };

  const handleCartPress = () => {
    router.push("/cart");
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.safeTop} />

      <View style={styles.header}>
        <View style={styles.side}>
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && {
                  backgroundColor: colors.primaryLight,
                },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="رجوع"
            >
              <AppIcon name="arrow-forward" size={23} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.logoContainer}>
              <Image
                source={logoSource}
                resizeMode="contain"
                accessibilityLabel="شعار تسوق"
                style={styles.logo}
              />
            </View>
          )}
        </View>

        <View style={styles.titleContainer}>
          <Text
            style={[
              styles.title,
              {
                color: colors.primary,
              },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleNotificationsPress}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && {
                backgroundColor: colors.primaryLight,
              },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="الإشعارات"
          >
            <AppIcon
              name="notifications-outline"
              size={22}
              color={colors.text}
            />

            {unreadCount > 0 ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.error,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: colors.surface,
                    },
                  ]}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={handleOrdersPress}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && {
                backgroundColor: colors.primaryLight,
              },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="طلباتي"
          >
            <AppIcon name="receipt-outline" size={22} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={handleCartPress}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && {
                backgroundColor: colors.primaryLight,
              },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="السلة"
          >
            <AppIcon name="cart-outline" size={23} color={colors.text} />

            {cartCount > 0 ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.error,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: colors.surface,
                    },
                  ]}
                >
                  {cartCount > 9 ? "9+" : cartCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },

  safeTop: {
    height: 28,
  },

  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
  },

  side: {
    width: 78,
    height: "100%",
    alignItems: "flex-start",
    justifyContent: "center",
  },

  logoContainer: {
    width: 70,
    height: 52,
    alignItems: "flex-start",
    justifyContent: "center",
    overflow: "hidden",
  },

  logo: {
    width: 70,
    height: 52,
  },

  titleContainer: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: 19,
    textAlign: "center",
  },

  actions: {
    width: 124,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },

  iconButton: {
    width: 38,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  badge: {
    position: "absolute",
    top: 1,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  badgeText: {
    fontFamily: Fonts.bold,
    fontSize: 9,
  },
});
