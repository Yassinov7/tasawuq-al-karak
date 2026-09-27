import { Href, usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Shadows, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type NavItem = {
  label: string;
  icon: React.ComponentProps<typeof AppIcon>["name"];
  activeIcon: React.ComponentProps<typeof AppIcon>["name"];
  route: Href;
};

const navItems: NavItem[] = [
  {
    label: "الرئيسية",
    icon: "home-outline",
    activeIcon: "home",
    route: "/home",
  },
  {
    label: "البحث",
    icon: "search-outline",
    activeIcon: "search",
    route: "/home/search",
  },
  {
    label: "العروض",
    icon: "pricetags-outline",
    activeIcon: "pricetags",
    route: "/home/offers",
  },
  {
    label: "حسابي",
    icon: "person-outline",
    activeIcon: "person",
    route: "/home/account",
  },
];

export function AppBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();

  const isActive = (route: Href) => {
    if (typeof route === "string") {
      return pathname === route;
    }

    return pathname === route.pathname;
  };

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          Shadows.card,
        ]}
      >
        {navItems.map((item) => {
          const active = isActive(item.route);

          return (
            <Pressable
              key={item.label}
              onPress={() => {
                if (!active) {
                  router.replace(item.route);
                }
              }}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{
                selected: active,
              }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.iconContainer,
                  active && {
                    backgroundColor: colors.primaryLight,
                  },
                ]}
              >
                <AppIcon
                  name={active ? item.activeIcon : item.icon}
                  size={22}
                  color={active ? colors.primary : colors.textMuted}
                />
              </View>

              <Text
                style={[
                  styles.label,
                  {
                    color: active ? colors.primary : colors.textMuted,
                  },
                ]}
              >
                {item.label}
              </Text>

              {active ? (
                <View
                  style={[
                    styles.activeIndicator,
                    {
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.three,
  },

  container: {
    width: "100%",
    maxWidth: 520,
    minHeight: 72,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  item: {
    position: "relative",
    flex: 1,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  iconContainer: {
    width: 40,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  label: {
    marginTop: 2,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    lineHeight: 17,
  },

  activeIndicator: {
    position: "absolute",
    bottom: -2,
    width: 20,
    height: 3,
    borderRadius: Radius.full,
  },

  pressed: {
    opacity: 0.65,
  },
});
