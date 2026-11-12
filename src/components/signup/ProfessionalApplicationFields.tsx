import { MerchantPlanChoice } from "@/components/signup/MerchantPlanChoice";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { MerchantCategorySelect } from "@/components/merchant/MerchantCategorySelect";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { readSelectableCategories, type SelectableCategory } from "@/lib/catalog-categories";
import type { ApplicationFieldErrors, ProfessionalApplication, SignupRole } from "@/lib/signup-data";

export function ProfessionalApplicationFields({ role, value, onChange, errors = {}, disabled = false, historicalCategoryName }: {
  role: Exclude<SignupRole, "customer">; value: ProfessionalApplication;
  onChange: (field: keyof ProfessionalApplication, value: string) => void; errors?: ApplicationFieldErrors; disabled?: boolean; historicalCategoryName?: string;
}) {
  const { colors } = useTheme();
  const [categories, setCategories] = useState<SelectableCategory[]>([]);
  const [loading, setLoading] = useState(role === "merchant");
  const [loadError, setLoadError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (role !== "merchant") return;
    request.current?.abort();
    const next = new AbortController();
    request.current = next;
    try {
      const options = await readSelectableCategories("store", next.signal);
      if (!next.signal.aborted) { setCategories(options); setLoadError(false); }
    } catch {
      if (!next.signal.aborted) setLoadError(true);
    } finally {
      if (!next.signal.aborted) setLoading(false);
    }
  }, [role]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => { clearTimeout(timer); request.current?.abort(); };
  }, [load]);
  useOrderRealtime({ channelName: "signup-categories", enabled: role === "merchant",
    subscriptions: [{ table: "catalog_category_revision" }], onChange: load });
  const field = (name: keyof ProfessionalApplication, label: string, maxLength: number, multiline = false) => <AppTextField design="refined" label={label} value={value[name]} onChangeText={text => onChange(name, text)} error={errors[name]} maxLength={maxLength} disabled={disabled} multiline={multiline} />;
  return <View style={{ gap: 16 }}>
    <Text style={{ ...Typography.cardTitle, color: colors.text, textAlign: "right" }}>{role === "merchant" ? "طلب الانضمام كتاجر" : "طلب الانضمام كسائق"}</Text>
    <AppTextField design="refined" label="هاتف التواصل للعمل" value={value.phone} onChangeText={text => onChange("phone", text)} keyboardType="phone-pad" autoComplete="tel" maxLength={32} error={errors.phone} disabled={disabled} helperText="للتواصل حول طلب الانضمام، ثم تنفيذ الطلبات بعد الاعتماد."/>
    {role === "merchant" ? <>
      {field("storeName", "اسم المتجر", 120)}
      {loading ? <ActivityIndicator color={colors.primary}/> : loadError ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ ...Typography.body, color: colors.errorForeground, textAlign: "right" }}>تعذر توفير تصنيفات المتاجر. أعد المحاولة قبل إرسال الطلب.</Text><AppButton title="إعادة تحميل التصنيفات" variant="outline" disabled={disabled} onPress={() => void load()}/></View> : <MerchantCategorySelect categories={categories} historicalName={historicalCategoryName} value={value.categoryId} onChange={id => onChange("categoryId", id)} disabled={disabled}/>}
      {errors.categoryId ? <Text accessibilityRole="alert" style={{ ...Typography.body, color: colors.errorForeground, textAlign: "right" }}>{errors.categoryId}</Text> : null}
      {field("address", "عنوان المتجر ونقطة الاستلام", 300, true)}
      <MerchantPlanChoice value={value.planId} onChange={id => onChange("planId", id)} error={errors.planId} disabled={disabled}/>
    </> : field("vehicle", "نوع المركبة المستخدمة للتوصيل", 80)}
    <Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>يُرسل الطلب للمراجعة مع إنشاء الحساب. لا يتفعّل العمل قبل موافقة الإدارة. لا نطلب مدة عقد أو راتبًا أو بيانات دفع أثناء التسجيل.</Text>
  </View>;
}
