import { formatSypNumber } from "@/lib/money";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { FontSizes, Fonts, Radius, Shadows, Spacing } from "@/constants/theme";
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
  const [formVisible, setFormVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAddressId, setBusyAddressId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerAddress | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [nextAddresses, nextZones] = await Promise.all([
        getCustomerAddresses(),
        getDeliveryZones(),
      ]);
      setAddresses(nextAddresses);
      setZones(nextZones);
      setFormVisible((current) => current || nextAddresses.length === 0);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل عناوينك.");
      return false;
    } finally {
      if (showLoading) setLoading(false);
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
    setFormVisible(false);
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
    setFormVisible(true);
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
      const refreshed = await refresh(false);
      if (refreshed) {
        resetForm();
        setNotice(editingId ? "تم تحديث العنوان." : "تم حفظ العنوان.");
      } else {
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
      const refreshed = await refresh(false);
      if (refreshed) {
        setNotice("تم تعيين العنوان الافتراضي.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تعيين العنوان الافتراضي.");
    } finally {
      setBusyAddressId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || busyAddressId) return;

    setBusyAddressId(deleteTarget.id);
    setDeleteError(null);
    setError(null);
    setNotice(null);
    try {
      await deleteCustomerAddress(deleteTarget.id);
      const refreshed = await refresh(false);
      if (refreshed) {
        setNotice("تم حذف العنوان.");
      }
      setDeleteTarget(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "تعذر حذف العنوان.");
    } finally {
      setBusyAddressId(null);
    }
  };

  const handleDelete = (address: CustomerAddress) => {
    if (busyAddressId) return;
    setDeleteError(null);
    setDeleteTarget(address);
  };

  const closeDeleteModal = () => {
    if (busyAddressId) return;
    setDeleteError(null);
    setDeleteTarget(null);
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
          <View style={styles.introRow}>
            <View style={styles.introCopy}>
              <Text style={[styles.title, { color: colors.text }]}>عناوينك المحفوظة</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>احفظ عنوانك وبيانات المستلم لتسريع إتمام طلباتك القادمة.</Text>
            </View>
            <Pressable
              onPress={() => {
                resetForm();
                setFormVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="إضافة عنوان جديد"
              style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
            >
              <AppIcon name="add" size={20} color={colors.surface} />
              <Text style={[styles.addButtonText, { color: colors.surface }]}>إضافة</Text>
            </Pressable>
          </View>

          {error ? (
            <View accessibilityRole="alert" style={[styles.feedbackCard, { backgroundColor: colors.surface, borderColor: colors.error }]}>
              <AppIcon name="alert-circle-outline" size={20} color={colors.error} />
              <Text style={[styles.feedbackText, { color: colors.error }]}>{error}</Text>
              {!formVisible ? (
                <Pressable onPress={() => void refresh()} accessibilityRole="button" accessibilityLabel="إعادة تحميل العناوين">
                  <Text style={[styles.retryText, { color: colors.primary }]}>إعادة المحاولة</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {notice ? <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: colors.primary }]}>{notice}</Text> : null}

          {loading ? (
            <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.message, { color: colors.textSecondary }]}>جارٍ تحميل العناوين...</Text>
            </View>
          ) : addresses.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                <AppIcon name="location-outline" size={25} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد عناوين محفوظة</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>أضف عنوان التوصيل الأول لاستخدامه عند إتمام طلبك.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {addresses.map((address) => {
                const busy = busyAddressId === address.id;
                const zoneDescription = address.zone
                  ? `${address.zone.name}${address.zone.is_active ? ` · ${formatSypNumber(address.zone.fixed_fee)} ل.س` : " · منطقة غير متاحة"}`
                  : "منطقة التوصيل غير متاحة";

                return (
                  <View key={address.id} style={[styles.card, Shadows.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.addressIcon, { backgroundColor: colors.primaryLight }]}>
                        <AppIcon name="location-outline" size={21} color={colors.primary} />
                      </View>
                      <View style={styles.cardInfo}>
                        <View style={styles.titleLine}>
                          <Text numberOfLines={1} style={[styles.cardTitle, { color: colors.text }]}>{address.title}</Text>
                          {address.is_default ? <Text style={[styles.defaultBadge, { color: colors.primary, backgroundColor: colors.primaryLight }]}>افتراضي</Text> : null}
                        </View>
                        <Text numberOfLines={1} style={[styles.recipient, { color: colors.textSecondary }]}>{address.recipient_name} · {address.contact_phone}</Text>
                        <Text numberOfLines={2} style={[styles.detail, { color: colors.textSecondary }]}>{address.delivery_address}</Text>
                        <Text numberOfLines={1} style={[styles.zone, { color: address.zone?.is_active ? colors.primary : colors.error }]}>{zoneDescription}</Text>
                      </View>
                    </View>

                    <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                      {address.maps_url ? (
                        <Pressable onPress={() => void handleOpenMaps(address.maps_url)} accessibilityRole="button" accessibilityLabel={`فتح موقع ${address.title}`} style={styles.mapAction}>
                          <AppIcon name="map-outline" size={17} color={colors.primary} />
                          <Text style={[styles.compactActionText, { color: colors.primary }]}>الموقع</Text>
                        </Pressable>
                      ) : null}
                      {!address.is_default ? (
                        <Pressable disabled={busy} onPress={() => void handleSetDefault(address.id)} accessibilityRole="button" accessibilityLabel={`تعيين ${address.title} عنوانًا افتراضيًا`} style={({ pressed }) => [styles.compactAction, { borderColor: colors.border }, (busy || pressed) && styles.pressed]}>
                          {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <AppIcon name="checkmark-circle-outline" size={18} color={colors.primary} />}
                          <Text style={[styles.compactActionText, { color: colors.primary }]}>افتراضي</Text>
                        </Pressable>
                      ) : null}
                      <Pressable disabled={busy} onPress={() => startEditing(address)} accessibilityRole="button" accessibilityLabel={`تعديل ${address.title}`} style={({ pressed }) => [styles.iconAction, { borderColor: colors.border }, (busy || pressed) && styles.pressed]}>
                        <AppIcon name="create-outline" size={18} color={colors.primary} />
                      </Pressable>
                      <Pressable disabled={busy} onPress={() => handleDelete(address)} accessibilityRole="button" accessibilityLabel={`حذف ${address.title}`} style={({ pressed }) => [styles.iconAction, { borderColor: colors.border }, (busy || pressed) && styles.pressed]}>
                        <AppIcon name="trash-outline" size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {formVisible ? (
            <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.formHeader}>
                <View style={styles.formTitleArea}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{editingId ? "تعديل العنوان" : "إضافة عنوان جديد"}</Text>
                  <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>الحقول المعلّمة بـ * مطلوبة لإتمام الطلب.</Text>
                </View>
                <Pressable onPress={resetForm} accessibilityRole="button" accessibilityLabel="إلغاء نموذج العنوان" style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.surfaceSecondary }, pressed && styles.pressed]}>
                  <AppIcon name="close" size={19} color={colors.textSecondary} />
                </Pressable>
              </View>
            <AppTextField label="اسم العنوان *" value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="المنزل أو العمل" maxLength={80} />
            <AppTextField label="اسم المستلم *" value={form.recipientName} onChangeText={(recipientName) => setForm((current) => ({ ...current, recipientName }))} maxLength={120} />
            <AppTextField label="رقم الهاتف *" value={form.contactPhone} onChangeText={(contactPhone) => setForm((current) => ({ ...current, contactPhone }))} keyboardType="phone-pad" maxLength={32} />
            <AppTextField label="العنوان بالتفصيل *" value={form.deliveryAddress} onChangeText={(deliveryAddress) => setForm((current) => ({ ...current, deliveryAddress }))} placeholder="الحي، الشارع، أقرب علامة مميزة" multiline maxLength={1000} />
            <AppTextField label="رابط الموقع (اختياري)" value={form.mapsUrl} onChangeText={(mapsUrl) => setForm((current) => ({ ...current, mapsUrl }))} placeholder="https://maps.google.com/..." keyboardType="url" autoCapitalize="none" maxLength={1000} />

            <Text style={[styles.fieldLabel, { color: colors.text }]}>منطقة التوصيل *</Text>
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
                    <Text style={[styles.zoneName, { color: colors.text }]}>{zone.name}</Text>
                    <Text style={[styles.zoneFee, { color: colors.textSecondary }]}>
                      {formatSypNumber(zone.fixed_fee)} ل.س رسوم توصيل
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
              <Text style={[styles.defaultToggleText, { color: colors.text }]}>تعيين هذا العنوان افتراضيًا</Text>
            </Pressable>

              <View style={styles.formActions}>
                <Pressable onPress={resetForm} disabled={saving} accessibilityRole="button" style={({ pressed }) => [styles.cancelButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, (saving || pressed) && styles.pressed]}>
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>إلغاء</Text>
                </Pressable>
                <View style={styles.saveButton}>
                  <AppButton
                    title={editingId ? "حفظ التعديلات" : "حفظ العنوان"}
                    icon="checkmark-outline"
                    loading={saving}
                    disabled={zones.length === 0}
                    onPress={() => void handleSave()}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={Boolean(deleteTarget)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            disabled={Boolean(busyAddressId)}
            onPress={closeDeleteModal}
            accessibilityLabel="إغلاق تأكيد حذف العنوان"
          />
          <View style={[styles.deleteModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.deleteModalIcon, { backgroundColor: colors.accentLight }]}>
              <AppIcon name="trash-outline" size={25} color={colors.error} />
            </View>
            <Text style={[styles.deleteModalTitle, { color: colors.text }]}>حذف العنوان؟</Text>
            <Text style={[styles.deleteModalMessage, { color: colors.textSecondary }]}>
              سيُحذف عنوان «{deleteTarget?.title ?? ""}» نهائيًا، ولا يمكن التراجع عن هذه العملية.
            </Text>
            {deleteError ? (
              <Text accessibilityRole="alert" style={[styles.deleteModalError, { color: colors.error }]}>{deleteError}</Text>
            ) : null}
            <View style={styles.deleteModalActions}>
              <Pressable
                disabled={Boolean(busyAddressId)}
                onPress={closeDeleteModal}
                accessibilityRole="button"
                style={({ pressed }) => [styles.deleteModalButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, (busyAddressId || pressed) && styles.pressed]}
              >
                <Text style={[styles.deleteModalCancelText, { color: colors.textSecondary }]}>إبقاء العنوان</Text>
              </Pressable>
              <Pressable
                disabled={Boolean(busyAddressId)}
                onPress={() => void confirmDelete()}
                accessibilityRole="button"
                accessibilityLabel="تأكيد حذف العنوان"
                style={({ pressed }) => [styles.deleteModalButton, { backgroundColor: colors.error }, (busyAddressId || pressed) && styles.pressed]}
              >
                {busyAddressId ? <ActivityIndicator color={colors.surface} /> : <Text style={[styles.deleteModalConfirmText, { color: colors.surface }]}>حذف العنوان</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  content: { gap: Spacing.four, padding: Spacing.four, paddingBottom: Spacing.eight },
  introRow: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.three },
  introCopy: { alignItems: "flex-end", flex: 1, gap: Spacing.one },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, textAlign: "right" },
  subtitle: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right" },
  addButton: { alignItems: "center", borderRadius: Radius.md, flexDirection: "row-reverse", gap: Spacing.one, minHeight: 44, paddingHorizontal: Spacing.three },
  addButtonText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm },
  feedbackCard: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, flexDirection: "row-reverse", gap: Spacing.two, padding: Spacing.three },
  feedbackText: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 20, textAlign: "right" },
  retryText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm },
  notice: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, lineHeight: 20, textAlign: "right" },
  statusCard: { alignItems: "center", borderRadius: Radius.lg, borderWidth: 1, flexDirection: "row-reverse", gap: Spacing.two, justifyContent: "center", minHeight: 96, padding: Spacing.four },
  message: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center" },
  empty: { alignItems: "center", borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.two, padding: Spacing.five },
  emptyIcon: { alignItems: "center", borderRadius: Radius.full, height: 52, justifyContent: "center", width: 52 },
  emptyTitle: { fontFamily: Fonts.semiBold, fontSize: FontSizes.md, textAlign: "center" },
  emptyText: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 21, textAlign: "center" },
  list: { gap: Spacing.three },
  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden" },
  cardHeader: { alignItems: "flex-start", flexDirection: "row-reverse", gap: Spacing.three, padding: Spacing.three },
  addressIcon: { alignItems: "center", borderRadius: Radius.md, height: 42, justifyContent: "center", width: 42 },
  cardInfo: { flex: 1, gap: Spacing.one },
  titleLine: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two, flexWrap: "wrap" },
  cardTitle: { flexShrink: 1, fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
  defaultBadge: { borderRadius: Radius.full, fontFamily: Fonts.semiBold, fontSize: 11, overflow: "hidden", paddingHorizontal: Spacing.two, paddingVertical: 3 },
  recipient: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  detail: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 21, textAlign: "right" },
  zone: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "right" },
  cardFooter: { alignItems: "center", borderTopWidth: 1, flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, justifyContent: "flex-start", paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  mapAction: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.one, minHeight: 38, paddingHorizontal: Spacing.one },
  compactAction: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, flexDirection: "row-reverse", gap: Spacing.one, minHeight: 38, paddingHorizontal: Spacing.two },
  compactActionText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs },
  iconAction: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  formHeader: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.three, justifyContent: "space-between" },
  formTitleArea: { alignItems: "flex-end", flex: 1 },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" },
  formSubtitle: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, lineHeight: 19, marginTop: 2, textAlign: "right" },
  closeButton: { alignItems: "center", borderRadius: Radius.full, height: 38, justifyContent: "center", width: 38 },
  form: { borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.three, padding: Spacing.three },
  fieldLabel: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  zoneOption: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", minHeight: 56, padding: Spacing.three },
  zoneInfo: { alignItems: "flex-end", flex: 1, gap: Spacing.one },
  zoneName: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  zoneFee: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  defaultToggle: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two, minHeight: 44 },
  defaultToggleText: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" },
  formActions: { flexDirection: "row-reverse", gap: Spacing.two, marginTop: Spacing.one },
  cancelButton: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 50, paddingHorizontal: Spacing.three },
  cancelButtonText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm },
  saveButton: { flex: 1.5 },
  modalOverlay: { alignItems: "center", backgroundColor: "rgba(13, 16, 14, 0.42)", flex: 1, justifyContent: "center", paddingHorizontal: Spacing.four, paddingVertical: Spacing.six },
  deleteModalCard: { borderRadius: Radius.xl, borderWidth: 1, maxWidth: 420, padding: Spacing.five, width: "100%" },
  deleteModalIcon: { alignItems: "center", alignSelf: "center", borderRadius: Radius.full, height: 54, justifyContent: "center", width: 54 },
  deleteModalTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, marginTop: Spacing.three, textAlign: "center" },
  deleteModalMessage: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, marginTop: Spacing.two, textAlign: "center" },
  deleteModalError: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, lineHeight: 19, marginTop: Spacing.two, textAlign: "center" },
  deleteModalActions: { flexDirection: "row-reverse", gap: Spacing.two, marginTop: Spacing.five },
  deleteModalButton: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: Spacing.two },
  deleteModalCancelText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm },
  deleteModalConfirmText: { fontFamily: Fonts.bold, fontSize: FontSizes.sm },
  pressed: { opacity: 0.72 },
});
