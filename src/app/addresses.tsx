import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import {
  deleteCustomerAddress,
  getCustomerAddresses,
  getDeliveryZones,
  saveCustomerAddress,
  setDefaultCustomerAddress,
  type CustomerAddress,
  type DeliveryZone,
} from "@/lib/customer-orders";

type AddressForm = {
  title: string;
  recipientName: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryZoneId: string;
  mapsUrl: string;
  isDefault: boolean;
};

const emptyForm: AddressForm = {
  title: "",
  recipientName: "",
  contactPhone: "",
  deliveryAddress: "",
  deliveryZoneId: "",
  mapsUrl: "",
  isDefault: false,
};

export default function AddressesScreen() {
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAddressId, setBusyAddressId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextAddresses, nextZones] = await Promise.all([
        getCustomerAddresses(),
        getDeliveryZones(),
      ]);
      setAddresses(nextAddresses);
      setZones(nextZones);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل عناوينك.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setNotice(null);
    setError(null);
  };

  const startEditing = (address: CustomerAddress) => {
    setEditingId(address.id);
    setForm({
      title: address.title,
      recipientName: address.recipient_name,
      contactPhone: address.contact_phone,
      deliveryAddress: address.delivery_address,
      deliveryZoneId: address.zone?.is_active ? address.delivery_zone_id : "",
      mapsUrl: address.maps_url,
      isDefault: address.is_default,
    });
    setNotice(null);
    setError(null);
  };

  const handleSave = async () => {
    const cleanForm = {
      ...form,
      title: form.title.trim(),
      recipientName: form.recipientName.trim(),
      contactPhone: form.contactPhone.trim(),
      deliveryAddress: form.deliveryAddress.trim(),
      mapsUrl: form.mapsUrl.trim(),
    };
    if (
      cleanForm.title.length < 2 ||
      cleanForm.recipientName.length < 2 ||
      cleanForm.contactPhone.length < 5 ||
      cleanForm.deliveryAddress.length < 4 ||
      !cleanForm.deliveryZoneId
    ) {
      setError("أكمل اسم العنوان والمستلم والهاتف والتفاصيل واختر منطقة توصيل.");
      return;
    }
    if (cleanForm.mapsUrl && !/^https?:\/\//i.test(cleanForm.mapsUrl)) {
      setError("رابط الموقع يجب أن يبدأ بـ https:// أو http://.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveCustomerAddress({
        id: editingId,
        ...cleanForm,
      });
      const refreshed = await refresh();
      if (refreshed) {
        resetForm();
        setNotice(editingId ? "تم تحديث العنوان." : "تم حفظ العنوان.");
      } else {
        resetForm();
        setError("تم حفظ العنوان، لكن تعذر تحديث القائمة. أعد فتح الصفحة للتحقق من التغيير.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ العنوان.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    setBusyAddressId(addressId);
    setError(null);
    try {
      await setDefaultCustomerAddress(addressId);
      await refresh();
      setNotice("تم تعيين العنوان الافتراضي.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تعيين العنوان الافتراضي.");
    } finally {
      setBusyAddressId(null);
    }
  };

  const handleDelete = (address: CustomerAddress) => {
    Alert.alert("حذف العنوان", `هل تريد حذف «${address.title}»؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          setBusyAddressId(address.id);
          setError(null);
          void deleteCustomerAddress(address.id)
            .then(refresh)
            .catch((cause: unknown) => {
              setError(cause instanceof Error ? cause.message : "تعذر حذف العنوان.");
            })
            .finally(() => setBusyAddressId(null));
        },
      },
    ]);
  };

  const handleOpenMaps = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setError("تعذر فتح رابط الموقع. تحقق من صحة الرابط ثم حاول مجددًا.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="عناوين التوصيل" showBack cartCount={itemCount} mode="customer" />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.intro}>
            <Text style={[styles.title, { color: colors.text }]}>عناوينك المحفوظة</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              اختر منطقة التوصيل واحفظ بيانات المستلم لتسريع طلباتك القادمة.
            </Text>
          </View>

          {loading ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>جارٍ تحميل العناوين...</Text>
          ) : addresses.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppIcon name="location-outline" size={28} color={colors.primary} />
              <Text style={{ color: colors.text, textAlign: "center" }}>
                لم تحفظ عنوانًا بعد. أضف عنوانك الأول أدناه.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {addresses.map((address) => (
                <View
                  key={address.id}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.addressIcon, { backgroundColor: colors.primaryLight }]}>
                      <AppIcon name="location-outline" size={21} color={colors.primary} />
                    </View>
                    <View style={styles.cardInfo}>
                      <View style={styles.titleLine}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>{address.title}</Text>
                        {address.is_default ? (
                          <Text style={[styles.defaultBadge, { color: colors.primary, backgroundColor: colors.primaryLight }]}>
                            افتراضي
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.detail, { color: colors.textSecondary }]}>
                        {address.recipient_name} · {address.contact_phone}
                      </Text>
                      <Text style={[styles.detail, { color: colors.textSecondary }]}>
                        {address.delivery_address}
                      </Text>
                      <Text style={[styles.zone, { color: address.zone?.is_active ? colors.primary : colors.error }]}>
                        {address.zone
                          ? `${address.zone.name}${address.zone.is_active ? ` · ${address.zone.fixed_fee.toLocaleString("ar")} ل.س` : " · منطقة غير متاحة"}`
                          : "منطقة التوصيل غير متاحة"}
                      </Text>
                    </View>
                  </View>
                  {address.maps_url ? (
                    <Pressable
                      onPress={() => void handleOpenMaps(address.maps_url)}
                      accessibilityRole="button"
                      style={styles.linkButton}
                    >
                      <AppIcon name="map-outline" size={16} color={colors.primary} />
                      <Text style={{ color: colors.primary }}>فتح الموقع</Text>
                    </Pressable>
                  ) : null}
                  <View style={styles.actions}>
                    {!address.is_default ? (
                      <AppButton
                        title="تعيين افتراضي"
                        icon="checkmark-circle-outline"
                        variant="outline"
                        fullWidth={false}
                        disabled={busyAddressId === address.id}
                        onPress={() => void handleSetDefault(address.id)}
                      />
                    ) : null}
                    <AppButton
                      title="تعديل"
                      icon="create-outline"
                      variant="secondary"
                      fullWidth={false}
                      disabled={busyAddressId === address.id}
                      onPress={() => startEditing(address)}
                    />
                    <AppButton
                      title="حذف"
                      icon="trash-outline"
                      variant="danger"
                      fullWidth={false}
                      loading={busyAddressId === address.id}
                      onPress={() => handleDelete(address)}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.formHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {editingId ? "تعديل العنوان" : "إضافة عنوان"}
            </Text>
            {editingId ? (
              <Pressable onPress={resetForm} accessibilityRole="button">
                <Text style={{ color: colors.primary }}>إلغاء التعديل</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppTextField label="اسم العنوان" value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="المنزل أو العمل" maxLength={80} />
            <AppTextField label="اسم المستلم" value={form.recipientName} onChangeText={(recipientName) => setForm((current) => ({ ...current, recipientName }))} maxLength={120} />
            <AppTextField label="رقم الهاتف" value={form.contactPhone} onChangeText={(contactPhone) => setForm((current) => ({ ...current, contactPhone }))} keyboardType="phone-pad" maxLength={32} />
            <AppTextField label="العنوان بالتفصيل" value={form.deliveryAddress} onChangeText={(deliveryAddress) => setForm((current) => ({ ...current, deliveryAddress }))} placeholder="الحي، الشارع، أقرب علامة مميزة" multiline maxLength={1000} />
            <AppTextField label="رابط الموقع (اختياري)" value={form.mapsUrl} onChangeText={(mapsUrl) => setForm((current) => ({ ...current, mapsUrl }))} placeholder="https://maps.google.com/..." keyboardType="url" autoCapitalize="none" maxLength={1000} />

            <Text style={[styles.fieldLabel, { color: colors.text }]}>منطقة التوصيل</Text>
            {zones.length === 0 ? (
              <Text style={{ color: colors.textMuted, textAlign: "right" }}>لا توجد مناطق توصيل متاحة حاليًا.</Text>
            ) : zones.map((zone) => {
              const selected = zone.id === form.deliveryZoneId;
              return (
                <Pressable
                  key={zone.id}
                  onPress={() => setForm((current) => ({ ...current, deliveryZoneId: zone.id }))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.zoneOption,
                    {
                      backgroundColor: colors.background,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={styles.zoneInfo}>
                    <Text style={{ color: colors.text, fontWeight: "600" }}>{zone.name}</Text>
                    <Text style={{ color: colors.textSecondary }}>
                      {zone.fixed_fee.toLocaleString("ar")} ل.س رسوم توصيل
                    </Text>
                  </View>
                  <AppIcon name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? colors.primary : colors.textMuted} />
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setForm((current) => ({ ...current, isDefault: !current.isDefault }))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: form.isDefault }}
              style={styles.defaultToggle}
            >
              <AppIcon name={form.isDefault ? "checkbox" : "square-outline"} size={21} color={colors.primary} />
              <Text style={{ color: colors.text }}>تعيين هذا العنوان افتراضيًا</Text>
            </Pressable>

            {error ? <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.error }]}>{error}</Text> : null}
            {notice ? <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: colors.primary }]}>{notice}</Text> : null}
            <AppButton
              title={editingId ? "حفظ التعديلات" : "حفظ العنوان"}
              icon="checkmark-outline"
              loading={saving}
              disabled={zones.length === 0}
              onPress={() => void handleSave()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  content: { gap: Spacing.four, padding: Spacing.four, paddingBottom: Spacing.eight },
  intro: { gap: Spacing.one },
  title: { fontSize: 22, fontWeight: "700", textAlign: "right" },
  subtitle: { lineHeight: 22, textAlign: "right" },
  message: { paddingVertical: Spacing.three, textAlign: "center" },
  empty: { alignItems: "center", borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.two, padding: Spacing.four },
  list: { gap: Spacing.three },
  card: { borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.three, padding: Spacing.three },
  cardHeader: { alignItems: "flex-start", flexDirection: "row-reverse", gap: Spacing.three },
  addressIcon: { alignItems: "center", borderRadius: Radius.md, height: 42, justifyContent: "center", width: 42 },
  cardInfo: { flex: 1, gap: Spacing.one },
  titleLine: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  defaultBadge: { borderRadius: Radius.full, fontSize: 11, overflow: "hidden", paddingHorizontal: Spacing.two, paddingVertical: 3 },
  detail: { lineHeight: 21, textAlign: "right" },
  zone: { fontSize: 12, textAlign: "right" },
  linkButton: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.one, minHeight: 36 },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two },
  formHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  sectionTitle: { fontSize: 17, fontWeight: "700", textAlign: "right" },
  form: { borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.three, padding: Spacing.three },
  fieldLabel: { fontWeight: "600", textAlign: "right" },
  zoneOption: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", minHeight: 56, padding: Spacing.three },
  zoneInfo: { gap: 4 },
  defaultToggle: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two, minHeight: 44 },
  feedback: { lineHeight: 21, textAlign: "right" },
});
