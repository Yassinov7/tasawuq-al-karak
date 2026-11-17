import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AccountShell } from "@/components/account/AccountShell";
import { AppHeader } from "@/components/navigation/AppHeader";
import { DeviceNotificationStatus } from "@/components/notifications/DeviceNotificationStatus";
import { StoreOfferNotificationSettings } from "@/components/notifications/StoreOfferNotificationControls";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { SyriaFlag } from "@/components/ui/SyriaFlag";
import { ControlSizes, MaxContentWidth, Radius, RtlText, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useSettings, type ThemeMode } from "@/context/SettingsContext";
import { useTheme } from "@/context/ThemeContext";
import { usePersonalAccount } from "@/hooks/usePersonalAccount";
import { arabicRowDirection, arabicTextAlign } from "@/lib/arabic-layout";
import { accountHome } from "@/lib/personal-account-model";

const appearanceOptions = [
  { mode: "system", title: "تلقائي حسب النظام", icon: "phone-portrait-outline" },
  { mode: "light", title: "فاتح", icon: "sunny-outline" },
  { mode: "dark", title: "داكن", icon: "moon-outline" },
] as const;

const transactionDescriptions = {
  customer: "تجد تحديثات طلباتك ومعاملاتك في قائمة الإشعارات.",
  merchant: "تجد تحديثات طلبات المتجر وعملياته في قائمة الإشعارات.",
  driver: "تجد تحديثات مهام التوصيل وإجراءاتك التشغيلية في قائمة الإشعارات.",
  admin: "تجد الأحداث التشغيلية التي تحتاج متابعة في قائمة الإشعارات.",
};

export default function SettingsRoute() {
  const { user, loading, initializationError, retrySession } = useAuth();
  const router = useRouter();
  const { data, error, loading: loadingAccount, reload } = usePersonalAccount();
  const owner = !loading ? user?.id : undefined;
  const role = owner ? data?.role : undefined;
  const back = () => {
    if (role) router.dismissTo(accountHome[role]);
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return <AccountShell header={
    <AppHeader title="الإعدادات" showBack onBack={back} showNotifications={false} />
  }>
    <View style={styles.content}>
      <SettingsGroup title="الإشعارات">
        {owner ? <>
          <DeviceNotificationStatus />
          <SettingsRow icon="notifications-outline" title="إشعارات المعاملات"
            detail={role ? transactionDescriptions[role] : "تظهر تحديثات العمليات المرتبطة بحسابك في قائمة الإشعارات."}
            onPress={() => router.push("/notifications")} />
          {role === "customer" ? <StoreOfferNotificationSettings key={owner} owner={owner} /> : null}
          {error ? <View style={styles.feedback}>
            <SettingsMessage error>{role ? "تعذر تحديث إعدادات الحساب." : "تعذر قراءة إعدادات الدور."}</SettingsMessage>
            <AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline" loading={loadingAccount} onPress={() => void reload()} />
          </View> : !role && loadingAccount ? <SettingsMessage>جارٍ التحقق من إعدادات الدور…</SettingsMessage> : null}
        </> : loading ? <SettingsMessage>جارٍ التحقق من الجلسة…</SettingsMessage> : initializationError ? <>
          <SettingsMessage error>تعذر التحقق من الجلسة.</SettingsMessage>
          <AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline" onPress={() => void retrySession()} />
        </> : <>
          <SettingsMessage>سجّل الدخول لعرض إعدادات التنبيهات.</SettingsMessage>
          <AppButton compact fullWidth={false} title="تسجيل الدخول" onPress={() => router.replace("/login")} />
        </>}
      </SettingsGroup>
      <SettingsGroup title="تفضيلات التطبيق">
        <AppearanceSettings />
        <SettingsRow icon="language" title="اللغة" detail="العربية · اللغة الحالية" />
      </SettingsGroup>
    </View>
  </AccountShell>;
}

function AppearanceSettings() {
  const { colors } = useTheme();
  const { themeMode, settingsReady, themeSaving, settingsError, setThemeMode } = useSettings();
  const disabled = !settingsReady || themeSaving;
  const select = (mode: ThemeMode) => {
    if (mode !== themeMode || settingsError) setThemeMode(mode);
  };

  return <View style={styles.appearance}>
    <Text style={[styles.rowTitle, { color: colors.text }]}>المظهر</Text>
    <View style={styles.options}>
    {appearanceOptions.map(({ mode, title, icon }) => {
      const selected = themeMode === mode;
      return <Pressable key={mode} accessibilityRole="radio" accessibilityLabel={title}
        accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => select(mode)}
        style={({ pressed }) => [styles.option, {
          backgroundColor: pressed ? colors.surfacePressed : selected ? colors.surfaceSelected : colors.surface,
          borderColor: selected ? colors.primary : colors.borderSubtle,
        }]}>
        <AppIcon name={icon} size={20} color={selected ? colors.primary : colors.textSecondary} />
        <Text style={[styles.optionLabel, { color: colors.text }]}>{title}</Text>
        {selected ? <AppIcon name="checkmark-circle" size={16} color={colors.primary} /> : null}
      </Pressable>;
    })}
    </View>
    {settingsError ? <View style={styles.feedback}><SettingsMessage error>{settingsError}</SettingsMessage></View> : null}
  </View>;
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.group, { borderColor: colors.borderSubtle }]}>
    <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.textSecondary }]}>{title}</Text>
    {children}
  </View>;
}

function SettingsRow({ title, detail, icon, onPress }: {
  title: string; detail: string; icon: "language" | "notifications-outline"; onPress?: () => void;
}) {
  const { colors } = useTheme();
  const content = <>
    {icon === "language" ? <SyriaFlag /> : <AppIcon name={icon} size={20} color={colors.primary} />}
    <View style={styles.rowText}>
      <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
      <SettingsMessage>{detail}</SettingsMessage>
    </View>
    {onPress ? <AppIcon name="chevron-back-outline" size={17} color={colors.textSecondary} /> : null}
  </>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}>{content}</Pressable>
    : <View style={styles.row}>{content}</View>;
}

function SettingsMessage({ children, error = false }: { children: string; error?: boolean }) {
  const { colors } = useTheme();
  return <Text accessibilityRole={error ? "alert" : undefined} accessibilityLiveRegion="polite"
    style={[styles.message, { color: error ? colors.errorForeground : colors.textSecondary }]}>{children}</Text>;
}

const settingsText = { ...RtlText, textAlign: arabicTextAlign } as const;
const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", gap: Spacing.four },
  group: { gap: Spacing.two, paddingBottom: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  groupTitle: { ...Typography.bodyStrong, ...settingsText },
  appearance: { gap: Spacing.two },
  options: { flexDirection: arabicRowDirection, flexWrap: "wrap", gap: Spacing.two },
  option: { flexGrow: 1, flexDirection: arabicRowDirection, alignItems: "center", gap: Spacing.one, minHeight: ControlSizes.button,
    maxWidth: "100%", paddingHorizontal: Spacing.two, paddingVertical: Spacing.two, borderRadius: Radius.md, borderWidth: 1 },
  optionLabel: { ...Typography.bodyStrong, ...settingsText, flexShrink: 1 },
  row: { flexDirection: arabicRowDirection, alignItems: "center", gap: Spacing.two, minHeight: ControlSizes.button, paddingVertical: Spacing.two },
  rowText: { flex: 1, minWidth: 0, gap: Spacing.half },
  rowTitle: { ...Typography.bodyStrong, ...settingsText },
  message: { ...Typography.caption, ...settingsText, flexShrink: 1 },
  feedback: { gap: Spacing.one, padding: Spacing.two },
});
