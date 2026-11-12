import { Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { SignupErrorNotice } from "@/components/signup/SignupErrorNotice";
import { Typography, Radius } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { SignupRole } from "@/lib/signup-data";

const roles = [
  { value: "customer", title: "عميل", detail: "تصفح المتاجر واطلب ما تحتاجه.", icon: "cart-outline" },
  { value: "merchant", title: "تاجر أو صاحب متجر", detail: "أنشئ الحساب وأكمل طلب انضمام متجرك.", icon: "storefront-outline" },
  { value: "driver", title: "سائق", detail: "أنشئ الحساب وأكمل طلب العمل بالتوصيل.", icon: "bicycle-outline" },
] as const;
export function SignupRoleStep({ role, onSetRole, onContinue, onExit, error }: {
  role: SignupRole | null; onSetRole: (value: SignupRole) => void; onContinue: () => void; onExit: () => void; error: string;
}) {
  const { colors } = useTheme();
  return <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: 18, paddingVertical: 24 }}>
    <Text style={{ ...Typography.pageTitle, color: colors.text, textAlign: "right" }}>كيف تريد الانضمام إلى تسوق؟</Text>
    <Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>اختر نوع الحساب أولًا، لنعرض البيانات المطلوبة له فقط.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="نوع الحساب" style={{ gap: 12 }}>
      {roles.map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: role === item.value }} onPress={() => onSetRole(item.value)} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, minHeight: 88, padding: 16, borderWidth: 2, borderRadius: Radius.lg, borderColor: role === item.value ? colors.primary : colors.borderStrong, backgroundColor: role === item.value ? colors.surfaceSelected : colors.surface }}>
        <AppIcon name={item.icon} size={24} color={colors.primary}/>
        <View style={{ flex: 1, gap: 5 }}><Text style={{ ...Typography.bodyStrong, color: colors.text, textAlign: "right" }}>{item.title}</Text><Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>{item.detail}</Text></View>
        <AppIcon name={role === item.value ? "checkmark-circle" : "ellipse-outline"} size={22} color={colors.primary}/>
      </Pressable>)}
    </View>
    <SignupErrorNotice message={error}/>
    <AppButton design="refined" title="التالي: بيانات الحساب" onPress={onContinue} disabled={!role}/>
    <AppButton design="refined" title="لدي حساب — تسجيل الدخول" variant="outline" onPress={onExit}/>
  </View>;
}
