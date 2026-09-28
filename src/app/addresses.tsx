import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useAddresses } from "@/context/AddressContext";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";

export default function AddressesScreen() {
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { user } = useAuth();
  const { addresses, zones, isLoading, error, refresh, addAddress, setDefault, removeAddress } = useAddresses();
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [recipientName, setRecipientName] = useState(typeof user?.user_metadata.display_name === "string" ? user.user_metadata.display_name : "");
  const [phone, setPhone] = useState(typeof user?.user_metadata.phone === "string" ? user.user_metadata.phone : "");
  const [address, setAddress] = useState("");
  const [zoneId, setZoneId] = useState("");

  const handleSave = async () => {
    if (![label, recipientName, phone, address, zoneId].every((value) => value.trim())) {
      Alert.alert("بيانات ناقصة", "أكمل اسم العنوان واسم المستلم ورقم الهاتف والعنوان ومنطقة التوصيل.");
      return;
    }
    setIsSaving(true);
    try {
      await addAddress({ label, recipientName, phone, address, zoneId });
      setIsAdding(false); setLabel(""); setAddress(""); setZoneId("");
    } catch {
      Alert.alert("تعذر حفظ العنوان", "تحقق من البيانات والاتصال ثم حاول مرة أخرى.");
    } finally { setIsSaving(false); }
  };

  const handleDelete = (id: string) => Alert.alert("حذف العنوان", "هل تريد حذف هذا العنوان؟", [
    { text: "إلغاء", style: "cancel" },
    { text: "حذف", style: "destructive", onPress: () => { void removeAddress(id).catch(() => Alert.alert("تعذر الحذف", "قد يكون العنوان مرتبطاً بطلب سابق.")); } },
  ]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="العناوين" showBack cartCount={itemCount} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>عناوين التوصيل</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>احفظ عناوينك واختر منطقة التوصيل لاحتساب الرسوم المحددة لها.</Text>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Pressable onPress={() => void refresh()}><Text style={[styles.error, { color: colors.error }]}>{error} اضغط لإعادة المحاولة.</Text></Pressable> : null}

        {addresses.map((saved) => (
          <View key={saved.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.addressHeader}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}><AppIcon name="location-outline" size={22} color={colors.primary} /></View>
              <View style={styles.addressInfo}>
                <View style={styles.labelRow}>
                  <Text style={[styles.addressTitle, { color: colors.text }]}>{saved.label}</Text>
                  {saved.isDefault ? <Text style={[styles.defaultTag, { color: colors.primary, backgroundColor: colors.primaryLight }]}>افتراضي</Text> : null}
                </View>
                <Text style={[styles.detail, { color: colors.textSecondary }]}>{saved.address}</Text>
                <Text style={[styles.detail, { color: colors.textMuted }]}>{saved.recipientName} • {saved.phone}</Text>
                <Text style={[styles.detail, { color: colors.textMuted }]}>{saved.zone ? `${saved.zone.regionName} — ${saved.zone.name}` : "منطقة التوصيل غير متاحة"}</Text>
              </View>
            </View>
            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              {!saved.isDefault ? <Pressable onPress={() => void setDefault(saved.id).catch(() => Alert.alert("تعذر التحديث", "حاول مرة أخرى."))} style={styles.action}>
                <AppIcon name="checkmark-circle-outline" size={17} color={colors.primary} /><Text style={[styles.actionText, { color: colors.primary }]}>تعيين افتراضي</Text>
              </Pressable> : <View />}
              <Pressable onPress={() => handleDelete(saved.id)} style={styles.action}>
                <AppIcon name="trash-outline" size={17} color={colors.error} /><Text style={[styles.actionText, { color: colors.error }]}>حذف</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {!isLoading && addresses.length === 0 ? <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppIcon name="location-outline" size={36} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد عناوين محفوظة</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>أضف عنواناً ومنطقة توصيل لإتمام الطلب.</Text>
        </View> : null}

        {isAdding ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>إضافة عنوان جديد</Text>
          <Field label="اسم العنوان، مثل المنزل" value={label} onChangeText={setLabel} colors={colors} />
          <Field label="اسم المستلم" value={recipientName} onChangeText={setRecipientName} colors={colors} />
          <Field label="رقم هاتف المستلم مع مفتاح الدولة" value={phone} onChangeText={setPhone} keyboardType="phone-pad" colors={colors} />
          <Field label="العنوان بالتفصيل" value={address} onChangeText={setAddress} colors={colors} multiline />
          <Text style={[styles.fieldLabel, { color: colors.text }]}>منطقة التوصيل</Text>
          {zones.length ? <View style={styles.zoneList}>{zones.map((zone) => <Pressable key={zone.id} onPress={() => setZoneId(zone.id)} style={[styles.zoneButton, { borderColor: zoneId === zone.id ? colors.primary : colors.border, backgroundColor: zoneId === zone.id ? colors.primaryLight : colors.background }]}>
            <Text style={[styles.zoneName, { color: colors.text }]}>{zone.regionName} — {zone.name}</Text>
            <Text style={[styles.zoneFee, { color: colors.primary }]}>{zone.fixedFee.toLocaleString("en-US")} {zone.currency === "USD" ? "$" : "ل.س"}</Text>
          </Pressable>)}</View> : <Text style={[styles.error, { color: colors.textSecondary }]}>لم تضف الإدارة مناطق التوصيل بعد. ستظهر هنا بعد إضافتها.</Text>}
          <Pressable disabled={isSaving || !zones.length} onPress={() => void handleSave()} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: isSaving || !zones.length ? 0.55 : 1 }]}>
            {isSaving ? <ActivityIndicator color={colors.surface} /> : <Text style={[styles.buttonText, { color: colors.surface }]}>حفظ العنوان</Text>}
          </Pressable>
          <Pressable onPress={() => setIsAdding(false)}><Text style={[styles.cancelText, { color: colors.textMuted }]}>إلغاء</Text></Pressable>
        </View> : null}

        {!isAdding ? <Pressable onPress={() => setIsAdding(true)} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
          <AppIcon name="add" size={20} color={colors.surface} /><Text style={[styles.buttonText, { color: colors.surface }]}>إضافة عنوان</Text>
        </Pressable> : null}
      </ScrollView>
    </View>
  );
}

type ThemeColors = ReturnType<typeof useTheme>["colors"];
function Field({ label, value, onChangeText, colors, keyboardType = "default", multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; colors: ThemeColors; keyboardType?: "default" | "phone-pad"; multiline?: boolean }) {
  return <View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={label} placeholderTextColor={colors.textMuted} keyboardType={keyboardType} multiline={multiline} style={[styles.input, multiline && styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} textAlign="right" /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: Spacing.four, paddingBottom: Spacing.ten, gap: Spacing.three },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, textAlign: "right" }, subtitle: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right" },
  card: { padding: Spacing.four, borderWidth: 1, borderRadius: Radius.xl }, addressHeader: { flexDirection: "row-reverse", alignItems: "flex-start", gap: Spacing.three }, iconBox: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: Radius.md }, addressInfo: { flex: 1, alignItems: "flex-end", gap: Spacing.one }, labelRow: { flexDirection: "row-reverse", alignItems: "center", gap: Spacing.two }, addressTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md }, defaultTag: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, borderRadius: Radius.full, paddingHorizontal: Spacing.two, paddingVertical: 3 }, detail: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }, actions: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: Spacing.three, paddingTop: Spacing.three, borderTopWidth: 1 }, action: { flexDirection: "row-reverse", alignItems: "center", gap: Spacing.one }, actionText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs }, emptyCard: { alignItems: "center", gap: Spacing.three, padding: Spacing.five, borderWidth: 1, borderRadius: Radius.xl }, emptyTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md },
  formTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" }, field: { marginTop: Spacing.three }, fieldLabel: { marginBottom: Spacing.two, fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" }, input: { minHeight: 50, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontFamily: Fonts.regular, fontSize: FontSizes.sm }, multiline: { minHeight: 84, textAlignVertical: "top" }, zoneList: { gap: Spacing.two }, zoneButton: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three }, zoneName: { fontFamily: Fonts.medium, fontSize: FontSizes.xs }, zoneFee: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs }, primaryButton: { minHeight: 50, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: Spacing.two, borderRadius: Radius.md, paddingHorizontal: Spacing.three }, buttonText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm }, cancelText: { marginTop: Spacing.three, textAlign: "center", fontFamily: Fonts.medium, fontSize: FontSizes.sm }, error: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right" },
});
