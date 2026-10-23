import { Stack, useGlobalSearchParams, usePathname, useRouter, type Href } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RoleRouteGuard } from "@/components/auth/RoleRouteGuard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppBottomNav } from "@/components/navigation/AppBottomNav";
import { BottomNavHeight, Fonts, Spacing } from "@/constants/theme";
import { MerchantWorkspaceProvider, useMerchantWorkspace } from "@/context/MerchantWorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { merchantNavigation } from "@/lib/merchant-navigation";

export default function MerchantLayout() {
  const { user } = useAuth();
  return (
    <RoleRouteGuard role="merchant">
      <MerchantWorkspaceProvider key={user?.id}><MerchantLayoutContent /></MerchantWorkspaceProvider>
    </RoleRouteGuard>
  );
}

function MerchantLayoutContent() {
  const path = usePathname();
  const { id } = useGlobalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const header = merchantNavigation(path, Boolean(id));
  const { notice, setNotice, setHeaderHeight } = useMerchantWorkspace();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}><AppHeader title={header.title} mode="business" showBack={Boolean(header.parent)} onBack={() => {
      if (router.canGoBack()) router.back();
      else router.replace((header.parent ?? "/merchant") as Href);
    }} />
    {notice ? <Pressable accessibilityRole="button" accessibilityLabel="إغلاق رسالة النجاح" onPress={() => setNotice("")} style={{ padding: Spacing.three, backgroundColor: colors.primaryLight }}><Text accessibilityLiveRegion="polite" style={{ color: colors.primary, textAlign: "right", fontFamily: Fonts.medium }}>{notice} ×</Text></Pressable> : null}
    </View>
    <Stack screenOptions={{ headerShown: false, animation: "fade", animationDuration: 180,
      contentStyle: { backgroundColor: colors.background, paddingBottom: BottomNavHeight + insets.bottom } }} />
    <AppBottomNav />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
