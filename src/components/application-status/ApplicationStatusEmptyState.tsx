import { View, Text } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { useTheme } from "@/context/ThemeContext";
import { styles } from "@/components/application-status/styles";

type ApplicationStatusEmptyStateProps = {
  error: string;
  onRetry: () => void;
  onLogout: () => void;
};

export function ApplicationStatusEmptyState({
  error,
  onRetry,
  onLogout,
}: ApplicationStatusEmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: colors.surfaceSecondary },
        ]}
      >
        <AppIcon
          name="document-text-outline"
          size={28}
          color={colors.textSecondary}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {error ? "تعذر عرض حالة الطلب" : "لا يوجد طلب مسجل"}
      </Text>
      <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
        {error
          ? "تحقق من الاتصال ثم أعد المحاولة."
          : "لا يوجد طلب انتساب مرتبط بهذا الحساب حالياً."}
      </Text>
      {error ? (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      ) : null}
      <AppButton design="refined" title="إعادة المحاولة" onPress={onRetry} />
      <AppButton design="refined" title="تسجيل الخروج" variant="outline" onPress={onLogout} />
    </View>
  );
}
