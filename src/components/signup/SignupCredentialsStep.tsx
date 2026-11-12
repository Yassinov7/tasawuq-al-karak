import { Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { BirthDateField } from "@/components/signup/BirthDateField";
import { SignupErrorNotice } from "@/components/signup/SignupErrorNotice";
import { Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { SignupDetails, SignupField, SignupFieldErrors, SignupRole } from "@/lib/signup-data";

export function SignupCredentialsStep({ value, role, errors, error, onChange, onContinue }: {
  value: SignupDetails; role: SignupRole; errors: SignupFieldErrors; error: string;
  onChange: (field: SignupField, value: string) => void; onContinue: () => void;
}) {
  const { colors } = useTheme();
  return <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: 18, paddingVertical: 20 }}>
    <Text style={{ ...Typography.pageTitle, color: colors.text, textAlign: "right" }}>بيانات الحساب</Text>
    <Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>{role === "customer" ? "بيانات الدخول والاسم وتاريخ الميلاد فقط. أدخل عنوان التوصيل عند الطلب." : "أدخل بياناتك الشخصية أولًا، ثم أكمل طلب الانضمام في الخطوة التالية."}</Text>
    <AppTextField design="refined" label="الاسم الكامل" value={value.fullName} onChangeText={text => onChange("fullName", text)} autoComplete="name" maxLength={120} error={errors.fullName}/>
    <AppTextField design="refined" label="البريد الإلكتروني" value={value.email} onChangeText={text => onChange("email", text)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} error={errors.email}/>
    <BirthDateField value={value.birthDate} onChange={text => onChange("birthDate", text)} error={errors.birthDate}/>
    <AppTextField design="refined" label="كلمة المرور" value={value.password} onChangeText={text => onChange("password", text)} secureTextEntry autoComplete="new-password" helperText="8 أحرف على الأقل" passwordToggleMode="icon" error={errors.password}/>
    <AppTextField design="refined" label="تأكيد كلمة المرور" value={value.passwordConfirmation} onChangeText={text => onChange("passwordConfirmation", text)} secureTextEntry autoComplete="new-password" passwordToggleMode="icon" error={errors.passwordConfirmation}/>
    <SignupErrorNotice message={Object.keys(errors).length ? "" : error}/>
    <AppButton design="refined" title={role === "customer" ? "التالي: مراجعة الحساب" : "التالي: طلب الانضمام"} icon="arrow-back" onPress={onContinue}/>
  </View>;
}
