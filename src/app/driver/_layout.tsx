import { useTheme } from "@/context/ThemeContext";
import { Stack } from "expo-router";

import { RoleRouteGuard } from "@/components/auth/RoleRouteGuard";

export default function DriverLayout() {
  const { colors } = useTheme();
  return (
    <RoleRouteGuard role="driver">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "fade",
          animationDuration: 180,
        }}
      />
    </RoleRouteGuard>
  );
}
