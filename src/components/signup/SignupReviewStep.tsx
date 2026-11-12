import { MerchantPlanChoice } from "@/components/signup/MerchantPlanChoice";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { SignupErrorNotice } from "@/components/signup/SignupErrorNotice";
import { Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { normalizeBirthDate, signupRoleLabels, type SignupRole, type SignupDetails, type ProfessionalApplication } from "@/lib/signup-data";
export function SignupReviewStep({ role, details, application, accepted, busy, created, error, onToggle, onSubmit, onRetry }: {
  role: SignupRole; details: SignupDetails; application: ProfessionalApplication; accepted: boolean; busy: boolean;
  created: boolean; error: string; onToggle: () => void; onSubmit: () => void; onRetry: () => void;
}) {
  const { colors } = useTheme();
  const rows = [["نوع الحساب", signupRoleLabels[role]], ["الاسم", details.fullName.trim()], ["البريد الإلكتروني", details.email.trim()], ["تاريخ الميلاد", normalizeBirthDate(details.birthDate) ?? details.birthDate]];
  if (role !== "customer") rows.push(["هاتف العمل", application.phone]);
  if (role === "merchant") rows.push(["المتجر", application.storeName], ["عنوان الاستلام", application.address]);
  if (role === "driver") rows.push(["المركبة", application.vehicle]);
  return <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: 18, paddingVertical: 20 }}>
    <Text style={{ ...Typography.pageTitle, color: colors.text, textAlign: "right" }}>مراجعة وإرسال</Text>
    {rows.map(([label, value]) => <View key={label} style={{ gap: 4 }}><Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>{label}</Text><Text selectable style={{ ...Typography.bodyStrong, color: colors.text, textAlign: "right" }}>{value}</Text></View>)}
    {role === "merchant" ? <MerchantPlanChoice value={application.planId} readOnly/> : null}
    {role !== "customer" ? <Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>سيُنشأ حسابك ويُرسل طلب انضمامك للمراجعة. لا تعني هذه الخطوة اعتمادك أو دفع اشتراك أو تحديد عقد عمل.</Text> : null}
    <Pressable accessibilityRole="checkbox" accessibilityLabel="أوافق على شروط الاستخدام وسياسة الخصوصية" accessibilityState={{ checked: accepted, disabled: busy || created }} disabled={busy || created} onPress={onToggle} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, minHeight: 48 }}>
      <AppIcon name={accepted ? "checkbox" : "square-outline"} size={26} color={colors.primary}/><Text style={{ ...Typography.body, color: colors.text, textAlign: "right", flex: 1 }}>أوافق على شروط الاستخدام وسياسة الخصوصية.</Text>
    </Pressable>
    <View style={{ flexDirection: "row-reverse", gap: 20, flexWrap: "wrap" }}>{([{ href: "/terms", title: "شروط الاستخدام" }, { href: "/privacy", title: "سياسة الخصوصية" }] as const).map(item => <Link key={item.href} href={item.href} asChild><Pressable disabled={busy} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...Typography.bodyStrong, color: colors.primary }}>{item.title}</Text></Pressable></Link>)}</View>
    <SignupErrorNotice message={error}/>
    <AppButton design="refined" title={created ? "متابعة الحساب المنشأ" : role === "customer" ? "إنشاء الحساب" : "إنشاء الحساب وإرسال الطلب"} disabled={!created && !accepted} loading={busy} onPress={created ? onRetry : onSubmit}/>
  </View>;
}
