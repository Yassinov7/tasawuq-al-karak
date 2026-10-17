import { Stack } from "expo-router";

import { RoleRouteGuard } from "@/components/auth/RoleRouteGuard";

export default function MerchantLayout() {
  return (
    <RoleRouteGuard role="merchant">
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          animationDuration: 180,
        }}
      />
    </RoleRouteGuard>
  );
}
