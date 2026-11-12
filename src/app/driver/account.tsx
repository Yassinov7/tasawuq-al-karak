import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AccountMenuItem } from "@/components/account/AccountMenuItem";
import { AccountProfileHeader } from "@/components/account/AccountProfileHeader";
import { AccountSection } from "@/components/account/AccountSection";
import { AccountShell } from "@/components/account/AccountShell";
import { DriverProfessionalInfo } from "@/components/account/DriverProfessionalInfo";
import { AccountLogout } from "@/components/account/SharedAccountParts";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { MaxContentWidth, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { usePersonalAccount } from "@/hooks/usePersonalAccount";

export default function DriverAccountScreen() {
  const { user } = useAuth();
  return <DriverAccount key={user?.id ?? "guest"} />;
}

function DriverAccount() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading, error, reload } = usePersonalAccount();
  const profile = data?.role === "driver" ? data : null;
  const appName = Constants.expoConfig?.name ?? "تسوق";
  const appVersion = Constants.expoConfig?.version;

  return <AccountShell header={<AppHeader title="حسابي" mode="business" showNotifications={false} />}>
      <View style={styles.content}>
        <AccountProfileHeader compact name={profile?.full_name || "حساب السائق"}
          details={profile?.email ? [{ icon: "mail-outline", value: profile.email }] : []}
          accessory={<DriverProfessionalInfo summary />} />
        {loading && !profile ? <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="جارٍ تحميل بيانات الحساب" /> : null}
        {error ? <View style={styles.feedback}>
          <Text accessibilityRole="alert" style={[styles.caption, { color: colors.errorForeground }]}>
            {profile ? "تعذر تحديث الحساب. تظهر آخر بيانات متاحة." : "تعذر تحميل بيانات الحساب."}
          </Text>
          <AppButton compact fullWidth={false} variant="outline" title="إعادة المحاولة" onPress={() => void reload()} />
        </View> : null}

        <AccountSection compact title="التوصيل والمالية">
          <AccountMenuItem compact title="بيانات الاعتماد" icon="shield-checkmark-outline"
            onPress={() => router.push("/driver/credentials")} />
          <AccountMenuItem compact title="المالية والفواتير" icon="wallet-outline" isLast
            onPress={() => router.push("/driver/cash-account")} />
        </AccountSection>

        <AccountSection compact title="إدارة الحساب">
          <AccountMenuItem compact title="المعلومات الشخصية" icon="person-outline" onPress={() => router.push("/personal-info")} />
          <AccountMenuItem compact title="الإشعارات" icon="notifications-outline" onPress={() => router.push("/notifications")} />
          <AccountMenuItem compact title="الإعدادات" icon="settings-outline" isLast onPress={() => router.push("/driver/settings")} />
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
          {appVersion ? <View style={styles.versionLabel}>
            <Text style={[styles.appLabel, { color: colors.textSecondary }]}>الإصدار</Text>
            <Text style={[styles.version, { color: colors.textSecondary }]}>{appVersion}</Text>
          </View> : null}
        </View>
        <View style={styles.logout}><AccountLogout compact /></View>
      </View>
    </AccountShell>;
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
