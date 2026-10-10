import { Href, usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Shadows, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type AppIconName = React.ComponentProps<typeof AppIcon>["name"];

type NavItem = {
  label: string;
  icon: AppIconName;
  activeIcon: AppIconName;
  route: Href;
};

const customerNavItems: NavItem[] = [
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

const merchantNavItems: NavItem[] = [
  {
    label: "الرئيسية",
    icon: "home-outline",
    activeIcon: "home",
    route: "/merchant",
  },
  {
    label: "الكتالوج",
    icon: "pricetags-outline",
    activeIcon: "pricetags",
    route: "/merchant/catalog",
  },
  {
    label: "الطلبات",
    icon: "receipt-outline",
    activeIcon: "receipt",
    route: "/merchant/orders",
  },
  {
    label: "حسابي",
    icon: "person-outline",
    activeIcon: "person",
    route: "/merchant/account",
  },
];

const driverNavItems: NavItem[] = [
  {
    label: "الرئيسية",
    icon: "home-outline",
    activeIcon: "home",
    route: "/driver" as Href,
  },
  {
    label: "توصيلاتي",
    icon: "receipt-outline",
    activeIcon: "receipt",
    route: "/driver/orders" as Href,
  },
  {
    label: "حسابي",
    icon: "person-outline",
    activeIcon: "person",
    route: "/driver/account" as Href,
  },
];

const adminNavItems: NavItem[] = [
  {
    label: "الرئيسية",
    icon: "home-outline",
    activeIcon: "home",
    route: "/admin" as Href,
  },
  {
    label: "الطلبات",
    icon: "receipt-outline",
    activeIcon: "receipt",
    route: "/admin/requests" as Href,
  },
  {
    label: "السائقون",
    icon: "bicycle-outline",
    activeIcon: "bicycle",
    route: "/admin/drivers" as Href,
  },
  {
    label: "المتاجر",
    icon: "storefront-outline",
    activeIcon: "storefront",
    route: "/admin/stores" as Href,
  },
  {
    label: "المالية",
    icon: "wallet-outline",
    activeIcon: "wallet",
    route: "/admin/finance" as Href,
  },
];

function getNavigationMode(pathname: string) {
  if (pathname.startsWith("/admin")) {
    return "admin";
  }

  if (pathname.startsWith("/merchant")) {
    return "merchant";
  }

  if (pathname.startsWith("/driver")) {
    return "driver";
  }

  return "customer";
}

export function AppBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();

  const mode = getNavigationMode(pathname);

  const visibleItems =
    mode === "admin"
      ? adminNavItems
      : mode === "merchant"
      ? merchantNavItems
      : mode === "driver"
        ? driverNavItems
        : customerNavItems;

  const isActive = (route: Href) => {
    if (typeof route === "string") {
      if (route === "/merchant") {
        return pathname === "/merchant";
      }

      if (route === ("/driver" as Href)) {
        return pathname === "/driver";
      }

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
        {visibleItems.map((item) => {
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
