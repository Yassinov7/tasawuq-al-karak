import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { formatSyp } from "@/lib/money";
import { supabase } from "@/lib/supabase";

type Plan = { id: string; name: string; description: string; price: number; duration_months: number; commission_rate: number | null; product_limit: number | null; features: unknown };

export function MerchantPlanChoice({ value, onChange, error, disabled = false, readOnly = false }: {
  value: string; onChange?: (id: string) => void; error?: string; disabled?: boolean; readOnly?: boolean;
}) {
  const { colors } = useTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await supabase.from("subscription_plans").select("id,name,description,price,duration_months,commission_rate,product_limit,features").eq("is_active", true).order("duration_months");
        if (result.error) throw result.error;
        if (active) setPlans((result.data ?? []).filter(p => p.commission_rate !== null && p.product_limit !== null && Array.isArray(p.features)));
      } catch { if (active) setFailed(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [retry]);
  const visible = readOnly ? plans.filter(p => p.id === value) : plans;
  const unavailable = !loading && !failed && (!plans.length || (!!value && !plans.some(p => p.id === value)));
  return <View style={{ gap: 12 }}>
    <Text style={{ ...Typography.cardTitle, color: colors.text, textAlign: "right" }}>خطة الاشتراك {readOnly ? "المختارة" : "— مطلوبة"}</Text>
    {loading ? <ActivityIndicator color={colors.primary}/> : failed || unavailable ? <>
      <Text accessibilityRole="alert" style={{ ...Typography.body, color: colors.errorForeground, textAlign: "right" }}>{failed ? "تعذر تحميل خطط الاشتراك. أعد المحاولة." : !plans.length ? "لا توجد خطط اشتراك متاحة حاليًا. تواصل مع الإدارة لتوفير خطة قبل إرسال الطلب." : "الخطة المختارة لم تعد متاحة. عد لاختيار خطة متاحة قبل الإرسال."}</Text>
      <AppButton title="تحديث الخطط" variant="outline" disabled={disabled} onPress={() => { setLoading(true); setFailed(false); setRetry(n => n + 1); }}/>
    </> : null}
    {!loading && !failed ? visible.map(plan => <Pressable key={plan.id} accessibilityRole="radio" accessibilityLabel={`خطة ${plan.name}`} accessibilityState={{ selected: plan.id === value, disabled: disabled || readOnly }} disabled={disabled || readOnly} onPress={() => onChange?.(plan.id)} style={{ gap: 8, padding: 16, borderWidth: plan.id === value ? 2 : 1, borderRadius: 16, borderColor: plan.id === value ? colors.primary : colors.border, backgroundColor: colors.surface }}>
      <Text style={{ ...Typography.bodyStrong, color: colors.text, textAlign: "right" }}>{plan.id === value ? "✓ " : ""}{plan.name}</Text>
      <Text style={{ ...Typography.bodyStrong, color: colors.primary, textAlign: "right" }}>{formatSyp(plan.price)} / {plan.duration_months} شهر</Text>
      {plan.description ? <Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>{plan.description}</Text> : null}
      <Text style={{ ...Typography.body, color: colors.text, textAlign: "right" }}>العمولة: {plan.commission_rate}٪ · حد المنتجات: {plan.product_limit}</Text>
      {Array.isArray(plan.features) ? plan.features.filter((f): f is string => typeof f === "string").map((feature, i) => <Text key={i} style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>• {feature}</Text>) : null}
    </Pressable>) : null}
    {error ? <Text accessibilityRole="alert" style={{ ...Typography.body, color: colors.errorForeground, textAlign: "right" }}>{error}</Text> : null}
    <Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>اختيار الخطة لا يعني الدفع أو تفعيل المتجر. يُرسل اختيارك للإدارة مع طلب الانضمام.</Text>
  </View>;
}
