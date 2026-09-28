import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts,
} from "@expo-google-fonts/cairo";
import { Href, Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View } from "react-native";

import { AppBottomNav } from "@/components/navigation/AppBottomNav";
import { BottomNavHeight } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { AddressProvider } from "@/context/AddressContext";
import { CatalogProvider } from "@/context/CatalogContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { useWorkspace, WorkspaceProvider } from "@/context/WorkspaceContext";
import { WorkspaceLoading } from "@/components/workspace/WorkspaceUI";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";

SplashScreen.preventAutoHideAsync();

const MAIN_ROUTES = [
  "/home",
  "/home/search",
  "/home/offers",
  "/home/account",
] as const;

function AppContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isLoading } = useAuth();
  const workspace = useWorkspace();
  const { colors } = useTheme();

  useEffect(() => {
    if (isLoading || pathname === "/") return;

    const isAuthRoute = ["/login", "/signup", "/verify-email"].includes(
      pathname,
    );

    if (session && isAuthRoute) {
      void (async () => {
        const { getDashboardPath } = await import("@/context/WorkspaceContext");
        router.replace((await getDashboardPath(session.user.id)) as Href);
      })();
    }
    else if (!session && !isAuthRoute) router.replace("/login");
  }, [isLoading, pathname, router, session]);

  useEffect(() => {
    if (!session || workspace.loading) return;
    const requiredRole = pathname === "/admin" || pathname.startsWith("/admin/") ? "admin" : pathname === "/driver" || pathname.startsWith("/driver/") ? "driver" : pathname === "/merchant" || pathname.startsWith("/merchant/") ? "merchant" : null;
    if (!requiredRole) return;
    const allowed = workspace.roles.includes(requiredRole) && (requiredRole !== "merchant" || !!workspace.merchantId) && (requiredRole !== "driver" || (workspace.driverApproval === "approved" && workspace.driverActive));
    if (!allowed) void import("@/context/WorkspaceContext").then(({ getDashboardPath }) => getDashboardPath(session.user.id).then((path) => router.replace(path as Href)));
  }, [pathname, router, session, workspace]);

  const isWorkspaceRoute = ["/admin", "/merchant", "/driver"].some((base) => pathname === base || pathname.startsWith(`${base}/`));
  if (isWorkspaceRoute && workspace.loading) return <WorkspaceLoading />;

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
              <WorkspaceProvider>
                <CatalogProvider>
                  <AddressProvider>
                    <CartProvider>
                      <AppContent />
                    </CartProvider>
                  </AddressProvider>
                </CatalogProvider>
              </WorkspaceProvider>
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
