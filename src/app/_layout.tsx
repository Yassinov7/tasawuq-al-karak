import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts,
} from "@expo-google-fonts/cairo";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View } from "react-native";

import { AppBottomNav } from "@/components/navigation/AppBottomNav";
import { BottomNavHeight } from "@/constants/theme";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { CustomerCatalogProvider } from "@/context/CustomerCatalogContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";

SplashScreen.preventAutoHideAsync();

const MAIN_ROUTES = [
  "/home",
  "/home/search",
  "/home/offers",
  "/home/account",
  "/merchant",
  "/merchant/catalog",
  "/merchant/orders",
  "/merchant/account",
] as const;

function AppContent() {
  const pathname = usePathname();
  const { colors } = useTheme();

  const showBottomNav = MAIN_ROUTES.includes(
    pathname as (typeof MAIN_ROUTES)[number],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          animationDuration: 180,
          contentStyle: {
            backgroundColor: colors.background,
            paddingBottom: showBottomNav ? BottomNavHeight : 0,
          },
        }}
      />

      {showBottomNav ? <AppBottomNav /> : null}
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <AuthProvider>
      <SettingsProvider>
        <ThemeProvider>
          <NotificationProvider>
            <FavoritesProvider>
              <CustomerCatalogProvider>
                <CartProvider>
                  <AppContent />
                </CartProvider>
              </CustomerCatalogProvider>
            </FavoritesProvider>
          </NotificationProvider>
        </ThemeProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

const styles = {
  container: {
    flex: 1,
  },
} as const;
