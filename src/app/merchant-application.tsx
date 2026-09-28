import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/utils/authError";

type MerchantRequest = {
  id: string;
  legal_name: string | null;
  approval: "pending" | "approved" | "rejected" | "suspended";
  stores: { id: string; name: string; status: string; address: string }[];
};

export default function MerchantApplicationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { user } = useAuth();
  const userId = user?.id;
  const [request, setRequest] = useState<MerchantRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState(typeof user?.user_metadata.phone === "string" ? user.user_metadata.phone : "");
  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");

  const loadRequest = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const { data, error: loadError } = await supabase
      .from("merchants")
      .select("id,legal_name,approval,stores(id,name,status,address)")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (loadError) setError("تعذر تحميل حالة طلب المتجر. حاول مرة أخرى.");
    else setRequest((data as MerchantRequest | null) ?? null);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadRequest(); }, 0);
    return () => clearTimeout(timer);
  }, [loadRequest]);

  const submit = async () => {
    setError("");
    if (!user) return;
    if ([legalName, phone, storeName, address].some((value) => !value.trim())) {
      setError("أكمل الاسم التجاري ورقم التواصل واسم المتجر وعنوانه.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: submitError } = await supabase.rpc("apply_merchant_with_initial_store", {
        input_legal_name: legalName.trim(),
        input_contact_phone: phone.trim(),
        input_store_name: storeName.trim(),
        input_store_description: description.trim(),
        input_store_address: address.trim(),
      });
      if (submitError) throw submitError;
      await loadRequest();
      Alert.alert("وصل طلبك", "سيظهر متجرك بعد مراجعة الإدارة واعتماده.");
    } catch (submitError) {
      setError(authErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusLabel = request?.approval === "approved" ? "تم اعتماد حساب التاجر" : request?.approval === "rejected" ? "لم تتم الموافقة على الطلب" : request?.approval === "suspended" ? "حساب المتجر موقوف" : "طلبك قيد مراجعة الإدارة";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="البيع عبر تسوق" showBack cartCount={itemCount} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {isLoading ? <ActivityIndicator color={colors.primary} /> : request ? (
            <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppIcon name={request.approval === "approved" ? "checkmark-circle" : "time-outline"} size={42} color={request.approval === "approved" ? colors.success : colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>{statusLabel}</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>{request.legal_name || "حساب التاجر"}</Text>
              {request.stores.map((store) => (
                <View key={store.id} style={[styles.storeRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.storeName, { color: colors.text }]}>{store.name}</Text>
                  <Text style={[styles.body, { color: colors.textSecondary }]}>{store.status === "approved" ? "معتمد" : store.status === "rejected" ? "مرفوض" : "بانتظار اعتماد المتجر"}</Text>
                </View>
              ))}
              <Text style={[styles.body, { color: colors.textMuted }]}>سيبقى حسابك صالحاً للتسوق أثناء مراجعة طلب المتجر.</Text>
            </View>
          ) : (
            <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>ابدأ البيع عبر تسوق</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>يُنشأ طلب التاجر والمتجر الأول تحت حسابك الحالي. ستراجعه الإدارة قبل ظهوره للزبائن.</Text>
              <FormField label="الاسم التجاري أو القانوني" value={legalName} onChangeText={setLegalName} colors={colors} />
              <FormField label="رقم التواصل مع مفتاح الدولة" value={phone} onChangeText={setPhone} keyboardType="phone-pad" colors={colors} />
              <FormField label="اسم المتجر الأول" value={storeName} onChangeText={setStoreName} colors={colors} />
              <FormField label="وصف المتجر (اختياري)" value={description} onChangeText={setDescription} colors={colors} />
              <FormField label="عنوان المتجر" value={address} onChangeText={setAddress} colors={colors} />
              {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
              <AppButton title={isSubmitting ? "جارٍ إرسال الطلب" : "إرسال طلب المراجعة"} onPress={() => void submit()} disabled={isSubmitting} />
            </View>
          )}
          {error && request ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
          <Pressable onPress={() => router.replace("/home")} style={styles.backLink}>
            <Text style={[styles.linkText, { color: colors.primary }]}>العودة إلى التسوق</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type ThemeColors = ReturnType<typeof useTheme>["colors"];
function FormField({ label, value, onChangeText, colors, keyboardType = "default" }: { label: string; value: string; onChangeText: (value: string) => void; colors: ThemeColors; keyboardType?: "default" | "phone-pad" }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} editable keyboardType={keyboardType} placeholder={label} placeholderTextColor={colors.textMuted} multiline={label === "وصف المتجر (اختياري)" || label === "عنوان المتجر"} style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} textAlign="right" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing.four, gap: Spacing.four },
  form: { padding: Spacing.four, borderWidth: 1, borderRadius: Radius.xl },
  statusCard: { alignItems: "center", gap: Spacing.three, padding: Spacing.five, borderWidth: 1, borderRadius: Radius.xl },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, textAlign: "center" },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 23, textAlign: "center" },
  field: { marginTop: Spacing.four },
  label: { marginBottom: Spacing.two, fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  input: { minHeight: 50, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderWidth: 1, borderRadius: Radius.md, fontFamily: Fonts.regular, fontSize: FontSizes.sm },
  error: { marginTop: Spacing.three, fontFamily: Fonts.medium, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right" },
  storeRow: { width: "100%", alignItems: "center", gap: Spacing.one, paddingTop: Spacing.three, borderTopWidth: 1 },
  storeName: { fontFamily: Fonts.semiBold, fontSize: FontSizes.md },
  backLink: { alignItems: "center", padding: Spacing.three },
  linkText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm },
});
