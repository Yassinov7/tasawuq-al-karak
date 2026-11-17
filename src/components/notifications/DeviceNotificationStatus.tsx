import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { RtlText, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppDialog } from "@/context/AppDialogContext";
import { useNotifications } from "@/context/NotificationContext";
import { useTheme } from "@/context/ThemeContext";
import { arabicRowDirection, arabicStart, arabicTextAlign } from "@/lib/arabic-layout";

export function DeviceNotificationStatus() {
  const { colors } = useTheme();
  const { alert } = useAppDialog();
  const { pushStatus, pushMessage, pushBusy, enablePush, retryPush } = useNotifications();
  if (pushStatus === "registered") return null;
  if (pushStatus === "unsupported" || pushStatus === "checking") {
    return <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.textSecondary }]}>{pushMessage}</Text>;
  }
  const needsPermission = pushStatus === "permission-needed";
  const action = needsPermission
    ? { title: "السماح بالتنبيهات", run: enablePush }
    : pushStatus === "permission-blocked" && (Platform.OS === "android" || Platform.OS === "ios")
      ? { title: "فتح إعدادات التطبيق", run: async () => {
        try {
          await Linking.openSettings();
        } catch {
          void alert("تعذر فتح الإعدادات", "افتح إعدادات الهاتف، ثم اختر تسوق الكرك ← الإشعارات.");
        }
      } }
      : pushStatus === "registration-failed" || pushStatus === "permission-check-failed"
        ? { title: "إعادة المحاولة", run: retryPush }
        : null;

  return <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
    <View style={styles.heading}>
      <AppIcon name="phone-portrait-outline" size={19} color={colors.textSecondary} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>تنبيهات الجهاز</Text>
    </View>
    <Text accessibilityLiveRegion="polite" style={[styles.message, {
      color: pushStatus === "registration-failed" || pushStatus === "permission-check-failed" ? colors.errorForeground : colors.textSecondary,
    }]}>{pushMessage}</Text>
    {action ? <View style={styles.action}>
      <AppButton compact fullWidth={false} title={action.title} variant={needsPermission ? "primary" : "outline"}
        icon={needsPermission ? "notifications-outline" : undefined} loading={pushBusy} onPress={() => void action.run()} />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.two, gap: Spacing.one, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  heading: { flexDirection: arabicRowDirection, alignItems: "center", gap: Spacing.two },
  title: { ...Typography.bodyStrong, ...RtlText, textAlign: arabicTextAlign, flexShrink: 1 },
  message: { ...Typography.caption, ...RtlText, textAlign: arabicTextAlign },
  action: { alignItems: arabicStart },
});
