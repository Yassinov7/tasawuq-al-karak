import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { RtlText, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppDialog } from "@/context/AppDialogContext";
import { useNotifications } from "@/context/NotificationContext";
import { useTheme } from "@/context/ThemeContext";

export function DeviceNotificationStatus() {
  const { colors } = useTheme();
  const { alert } = useAppDialog();
  const { pushStatus, pushMessage, pushBusy, enablePush, retryPush } = useNotifications();
  const action = pushStatus === "permission-needed"
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
      <AppIcon name={pushStatus === "registered" ? "checkmark-circle-outline" : "phone-portrait-outline"}
        size={19} color={pushStatus === "registered" ? colors.successForeground : colors.textSecondary} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>تنبيهات الجهاز</Text>
    </View>
    <Text accessibilityLiveRegion="polite" style={[styles.message, {
      color: pushStatus === "registration-failed" || pushStatus === "permission-check-failed" ? colors.errorForeground : colors.textSecondary,
    }]}>{pushMessage}</Text>
    {action ? <View style={styles.action}>
      <AppButton compact fullWidth={false} title={action.title} variant="outline" loading={pushBusy} onPress={() => void action.run()} />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.three, gap: Spacing.one, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  heading: { flexDirection: "row-reverse", alignItems: "center", gap: Spacing.two },
  title: { ...Typography.bodyStrong, ...RtlText, flexShrink: 1 },
  message: { ...Typography.caption, ...RtlText },
  action: { alignItems: "flex-end" },
});
