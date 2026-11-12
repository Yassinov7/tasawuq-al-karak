import type { ReactNode } from "react";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AccountShell } from "@/components/account/AccountShell";
import { AccountLogout } from "@/components/account/SharedAccountParts";
import { PersonalInfoScreen } from "@/components/account/PersonalInfoScreen";
import { AccountMenuItem } from "@/components/account/AccountMenuItem";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
import { useMerchantWorkspace } from "@/context/MerchantWorkspaceContext";
import { useTheme } from "@/context/ThemeContext";
import { usePersonalAccount } from "@/hooks/usePersonalAccount";

export function MerchantAccountHub() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading, error, reload } = usePersonalAccount();
  const profile = data?.role === "merchant" ? data : null;
  const appName = Constants.expoConfig?.name ?? "تسوق";
  const appVersion = Constants.expoConfig?.version;

  return <AccountShell header={null}>
    <View style={styles.content}>
      <View style={[styles.identity, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceSelected }]}>
          <AppIcon name="person-outline" size={24} color={colors.primary} />
        </View>
        <View style={styles.identityText}>
          <Text accessibilityRole="header" style={[styles.name, { color: colors.text }]}>{profile?.full_name || "حساب التاجر"}</Text>
          {profile?.email ? <Text style={[styles.email, { color: colors.textSecondary }]}>{profile.email}</Text> : null}
        </View>
        {loading && !profile ? <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="جارٍ تحميل بيانات الحساب" /> : null}
      </View>
      {error ? <View style={styles.feedback}>
        <Text accessibilityRole="alert" style={[styles.feedbackText, { color: colors.errorForeground }]}>
          {profile ? "تعذر تحديث بيانات الحساب. تظهر آخر بيانات متاحة." : "تعذر تحميل بيانات الحساب."}
        </Text>
        <AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline" onPress={() => void reload()} />
      </View> : null}

      <MerchantAccountGroup title="المتجر والمالية">
        <AccountMenuItem compact title="بيانات المتجر" icon="storefront-outline" onPress={() => router.push("/merchant/store-info")} />
        <AccountMenuItem compact title="حسابي المالي" icon="wallet-outline" onPress={() => router.push("/merchant/finance")} />
        <AccountMenuItem compact title="فواتير الاشتراك" icon="receipt-outline" isLast onPress={() => router.push({ pathname: "/merchant/finance", params: { search: "SUB-" } })} />
      </MerchantAccountGroup>

      <MerchantAccountGroup title="إدارة الحساب">
        <AccountMenuItem compact title="المعلومات الشخصية" icon="person-outline" onPress={() => router.push("/merchant/personal-info")} />
        <AccountMenuItem compact title="الإشعارات" icon="notifications-outline" onPress={() => router.push("/notifications")} />
        <AccountMenuItem compact title="الإعدادات" icon="settings-outline" isLast onPress={() => router.push("/merchant/settings")} />
      </MerchantAccountGroup>

      <MerchantAccountGroup title="الخصوصية والأمان">
        <AccountMenuItem compact title="الأمان وكلمة المرور" icon="lock-closed-outline" onPress={() => router.push("/merchant/security")} />
        <AccountMenuItem compact title="الخصوصية" icon="shield-checkmark-outline" onPress={() => router.push("/privacy")} />
        <AccountMenuItem compact title="شروط الاستخدام" icon="document-text-outline" isLast onPress={() => router.push("/terms")} />
      </MerchantAccountGroup>

      <MerchantAccountGroup title="حول التطبيق">
        <AccountMenuItem compact title="عن تسوق" icon="information-circle-outline" isLast onPress={() => router.push("/about")} />
      </MerchantAccountGroup>

      <View style={[styles.appInfo, { borderColor: colors.borderSubtle }]}>
        <Text style={[styles.appLabel, { color: colors.textSecondary }]}>{appName}</Text>
        {appVersion ? <View style={styles.versionLabel}>
          <Text style={[styles.appLabel, { color: colors.textSecondary }]}>الإصدار</Text>
          <Text style={[styles.version, { color: colors.textSecondary }]}>{appVersion}</Text>
        </View> : null}
      </View>
      <View style={styles.logout}><AccountLogout compact /></View>
    </View>
  </AccountShell>;
}

function MerchantAccountGroup({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={styles.group}>
    <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.textSecondary }]}>{title}</Text>
    <View style={[styles.groupRows, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>{children}</View>
  </View>;
}

export function MerchantPersonalInfo() {
  const { headerHeight } = useMerchantWorkspace();
  return <PersonalInfoScreen embedded keyboardOffset={headerHeight} />;
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", gap: Spacing.three },
  identity: { flexDirection: "row-reverse", alignItems: "center", borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.three },
  avatar: { width: 44, height: 44, borderRadius: Radius.full, justifyContent: "center", alignItems: "center" },
  identityText: { flex: 1, minWidth: 0, gap: Spacing.half },
  name: { ...Typography.cardTitle, textAlign: "right" },
  email: { ...Typography.caption, textAlign: "right", writingDirection: "ltr" },
  group: { gap: Spacing.one },
  groupTitle: { ...Typography.bodyStrong, textAlign: "right", paddingHorizontal: Spacing.one },
  groupRows: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  feedback: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: Spacing.two },
  feedbackText: { ...Typography.caption, textAlign: "right", flexGrow: 1, flexShrink: 1 },
  appInfo: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
  appLabel: { ...Typography.caption, textAlign: "right", flexShrink: 1 },
  versionLabel: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: Spacing.one },
  version: { ...Typography.caption, writingDirection: "ltr" },
  logout: { alignItems: "flex-end", paddingTop: Spacing.one },
});
