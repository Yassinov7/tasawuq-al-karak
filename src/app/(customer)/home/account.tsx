import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AccountMenuItem } from "@/components/account/AccountMenuItem";
import { AccountProfileHeader } from "@/components/account/AccountProfileHeader";
import { AccountSection } from "@/components/account/AccountSection";
import { AccountShell } from "@/components/account/AccountShell";
import { AccountLogout } from "@/components/account/SharedAccountParts";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { MaxContentWidth, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { usePersonalAccount } from "@/hooks/usePersonalAccount";

export default function AccountTab() {
  const { user } = useAuth();
  return <CustomerAccount key={user?.id ?? "guest"} />;
}

function CustomerAccount() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { data, loading, error, reload } = usePersonalAccount();
  const profile = data?.role === "customer" ? data : null;
  const appName = Constants.expoConfig?.name ?? "تسوق";
  const appVersion = Constants.expoConfig?.version;

  return (
    <AccountShell header={<AppHeader title="حسابي" cartCount={itemCount} mode="customer" />}>
      <View style={styles.content}>
        <AccountProfileHeader
          compact
          name={profile?.full_name || "حساب العميل"}
          roleBadge="عميل"
          details={profile?.email ? [{ icon: "mail-outline", value: profile.email }] : []}
          onEdit={() => router.push("/personal-info")}
        />

        {loading && !profile ? (
          <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="جارٍ تحميل بيانات الحساب" />
        ) : null}
        {error ? (
          <View style={styles.feedback}>
            <Text accessibilityRole="alert" style={[styles.caption, { color: colors.errorForeground }]}>
              {profile ? "تعذر تحديث الحساب. تظهر آخر بيانات متاحة." : "تعذر تحميل بيانات الحساب."}
            </Text>
            <AppButton compact fullWidth={false} variant="outline" title="إعادة المحاولة" onPress={() => void reload()} />
          </View>
        ) : null}

        <AccountSection compact title="مشترياتي">
          <AccountMenuItem compact title="طلباتي" icon="receipt-outline" onPress={() => router.push("/orders")} />
          <AccountMenuItem compact title="فواتيري" icon="document-text-outline" onPress={() => router.push("/invoice")} />
          <AccountMenuItem compact title="العناوين" icon="location-outline" onPress={() => router.push("/addresses")} />
          <AccountMenuItem compact title="المفضلة" icon="heart-outline" isLast onPress={() => router.push("/favorites")} />
        </AccountSection>

        <AccountSection compact title="إدارة الحساب">
          <AccountMenuItem compact title="المعلومات الشخصية" icon="person-outline" onPress={() => router.push("/personal-info")} />
          <AccountMenuItem compact title="الإشعارات" icon="notifications-outline" onPress={() => router.push("/notifications")} />
          <AccountMenuItem compact title="الإعدادات" icon="settings-outline" isLast onPress={() => router.push("/settings")} />
        </AccountSection>

        <AccountSection compact title="الخصوصية والأمان">
          <AccountMenuItem compact title="الأمان وكلمة المرور" icon="lock-closed-outline" onPress={() => router.push("/security")} />
          <AccountMenuItem compact title="الخصوصية" icon="shield-checkmark-outline" onPress={() => router.push("/privacy")} />
          <AccountMenuItem compact title="شروط الاستخدام" icon="document-text-outline" isLast onPress={() => router.push("/terms")} />
        </AccountSection>

        <AccountSection compact title="حول التطبيق">
          <AccountMenuItem compact title="عن تسوق" icon="information-circle-outline" isLast onPress={() => router.push("/about")} />
        </AccountSection>

        <View style={[styles.appInfo, { borderColor: colors.borderSubtle }]}>
          <Text style={[styles.appLabel, { color: colors.textSecondary }]}>{appName}</Text>
          {appVersion ? (
            <View style={styles.versionLabel}>
              <Text style={[styles.appLabel, { color: colors.textSecondary }]}>الإصدار</Text>
              <Text style={[styles.version, { color: colors.textSecondary }]}>{appVersion}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.logout}><AccountLogout compact /></View>
      </View>
    </AccountShell>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", gap: Spacing.three },
  feedback: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: Spacing.two },
  caption: { ...Typography.caption, textAlign: "right", flexGrow: 1, flexShrink: 1 },
  appInfo: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
  appLabel: { ...Typography.caption, textAlign: "right", flexShrink: 1 },
  versionLabel: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: Spacing.one },
  version: { ...Typography.caption, writingDirection: "ltr" },
  logout: { alignItems: "flex-end", paddingTop: Spacing.one },
});
