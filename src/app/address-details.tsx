import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { FontSizes, Fonts, LayoutSpacing, Radius, RtlText, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { useAccountDraftGuard } from "@/hooks/useAccountDraftGuard";
import {
  addressToForm,
  clearAddressDraft,
  emptyAddressForm,
  getAddressDraft,
  readAddressDirectory,
  setAddressDraft,
  setAddressNotice,
  type AddressForm,
} from "@/lib/customer-address-directory";
import { saveCustomerAddress, type DeliveryZone } from "@/lib/customer-orders";
import { formatSypNumber } from "@/lib/money";

type FieldErrors = Partial<Record<"title" | "recipientName" | "contactPhone" | "deliveryAddress" | "deliveryZoneId" | "mapsUrl", string>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function sameForm(left: AddressForm, right: AddressForm) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validate(form: AddressForm) {
  const clean = {
    ...form,
    title: form.title.trim(),
    recipientName: form.recipientName.trim(),
    contactPhone: form.contactPhone.trim(),
    deliveryAddress: form.deliveryAddress.trim(),
    mapsUrl: form.mapsUrl.trim(),
  };
  const errors: FieldErrors = {};
  if (clean.title.length < 2) errors.title = "اكتب تسمية واضحة مثل المنزل أو العمل.";
  if (clean.recipientName.length < 2) errors.recipientName = "اكتب اسم المستلم.";
  if (clean.contactPhone.length < 5) errors.contactPhone = "اكتب رقم هاتف صالحًا للتواصل.";
  if (clean.deliveryAddress.length < 4) errors.deliveryAddress = "اكتب عنوان التوصيل بالتفصيل.";
  if (!clean.deliveryZoneId) errors.deliveryZoneId = "اختر منطقة توصيل.";
  if (clean.mapsUrl && !/^https?:\/\//i.test(clean.mapsUrl)) errors.mapsUrl = "يجب أن يبدأ الرابط بـ https:// أو http://.";
  return { clean, errors };
}

export default function AddressDetailsScreen() {
  const { user } = useAuth();
  return <AddressEditor key={user?.id ?? "guest"} scope={user?.id ?? "guest"} />;
}

function AddressEditor({ scope }: { scope: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; returnTo?: string | string[] }>();
  const addressId = firstParam(params.id) ?? null;
  const returnTo = firstParam(params.returnTo) === "/checkout" ? "/checkout" : "/addresses";
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const [initialDraft] = useState(() => getAddressDraft(scope, addressId));
  const [form, setForm] = useState<AddressForm>(initialDraft?.form ?? emptyAddressForm);
  const [baseline, setBaseline] = useState<AddressForm>(initialDraft?.baseline ?? emptyAddressForm);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const alive = useRef(true);
  const saveLock = useRef(false);
  const savedAddressId = useRef<string | null>(null);
  const dirty = ready && !saved && !sameForm(form, baseline);

  const leave = useCallback(() => {
    if (returnTo === "/checkout" && savedAddressId.current) {
      router.dismissTo({ pathname: "/checkout", params: { addressId: savedAddressId.current } });
    } else {
      router.dismissTo(returnTo);
    }
  }, [returnTo, router]);
  const guard = useAccountDraftGuard(dirty, saving, leave, () => saveLock.current);

  useEffect(() => {
    alive.current = true;
    const timer = setTimeout(() => {
      void readAddressDirectory(scope).then(snapshot => {
        if (!alive.current) return;
        setZones(snapshot.zones);
        if (addressId) {
          const address = snapshot.addresses.find(item => item.id === addressId);
          if (!address) {
            setNotFound(true);
            setError("العنوان غير موجود أو لا تملك صلاحية تعديله.");
            return;
          }
          if (!initialDraft) {
            const value = addressToForm(address);
            setForm(value);
            setBaseline(value);
          }
        } else if (!initialDraft) {
          const value = { ...emptyAddressForm, isDefault: snapshot.addresses.length === 0 };
          setForm(value);
          setBaseline(value);
        }
        setReady(true);
      }).catch(cause => {
        if (alive.current) setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات العنوان.");
      }).finally(() => {
        if (alive.current) setLoading(false);
      });
    }, 0);
    return () => {
      alive.current = false;
      clearTimeout(timer);
    };
  }, [addressId, initialDraft, scope]);

  useEffect(() => {
    if (ready && !saved) setAddressDraft(scope, addressId, form, baseline);
  }, [addressId, baseline, form, ready, saved, scope]);

  const update = useCallback(<K extends keyof AddressForm>(key: K, value: AddressForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => ({ ...current, [key]: undefined }));
    setError("");
  }, []);

  const handleSave = useCallback(async () => {
    if (saveLock.current || !ready || notFound) return;
    const result = validate(form);
    setFieldErrors(result.errors);
    if (Object.keys(result.errors).length > 0) {
      setError("راجع الحقول المعلّمة ثم حاول مجددًا.");
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const savedId = await saveCustomerAddress({ id: addressId, ...result.clean });
      await readAddressDirectory(scope, true);
      if (!alive.current) return;
      clearAddressDraft(scope, addressId);
      setBaseline(result.clean);
      setForm(result.clean);
      setSaved(true);
      setSaving(false);
      savedAddressId.current = savedId;
      if (returnTo === "/addresses") setAddressNotice(scope, addressId ? "تم تحديث العنوان." : "تم حفظ العنوان.");
      setTimeout(guard.leaveNow, 0);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "تعذر حفظ العنوان. احتفظنا بالمدخلات لتعيد المحاولة.");
    } finally {
      saveLock.current = false;
      if (alive.current) setSaving(false);
    }
  }, [addressId, form, guard.leaveNow, notFound, ready, returnTo, scope]);

  const headerTitle = addressId ? "تعديل العنوان" : "إضافة عنوان";
  const saveTitle = addressId ? "حفظ التعديلات" : "حفظ العنوان";
  const availableZones = useMemo(() => zones.filter(zone => zone.is_active), [zones]);

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <AppHeader title={headerTitle} showBack cartCount={itemCount} mode="customer" />
    <KeyboardAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loading ? <View style={styles.loading} accessibilityRole="progressbar">
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>جارٍ تحميل بيانات العنوان…</Text>
      </View> : notFound || !ready ? <View style={styles.failure}>
        <AppIcon name="location-outline" size={36} color={colors.error} />
        <Text accessibilityRole="alert" style={[styles.failureText, { color: colors.error }]}>{error || "تعذر فتح العنوان."}</Text>
        <AppButton title="العودة إلى العناوين" variant="outline" onPress={guard.back} />
      </View> : <>
        {error ? <View accessibilityRole="alert" style={[styles.feedback, { backgroundColor: colors.errorSurface, borderColor: colors.errorBorder }]}>
          <AppIcon name="alert-circle-outline" size={20} color={colors.error} />
          <Text style={[styles.feedbackText, { color: colors.error }]}>{error}</Text>
        </View> : null}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>بيانات المستلم</Text>
        <AppTextField label="اسم العنوان" value={form.title} error={fieldErrors.title}
          onChangeText={value => update("title", value)} placeholder="المنزل أو العمل" maxLength={80} />
        <AppTextField label="اسم المستلم" value={form.recipientName} error={fieldErrors.recipientName}
          onChangeText={value => update("recipientName", value)} maxLength={120} />
        <AppTextField label="رقم الهاتف" value={form.contactPhone} error={fieldErrors.contactPhone}
          onChangeText={value => update("contactPhone", value)} keyboardType="phone-pad" maxLength={32} />

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>عنوان التوصيل</Text>
        <AppTextField label="العنوان بالتفصيل" value={form.deliveryAddress} error={fieldErrors.deliveryAddress}
          onChangeText={value => update("deliveryAddress", value)} placeholder="الحي، الشارع، أقرب علامة مميزة" multiline maxLength={1000} />

        <Text style={[styles.fieldLabel, { color: colors.text }]}>منطقة التوصيل</Text>
        {fieldErrors.deliveryZoneId ? <Text accessibilityRole="alert" style={[styles.fieldError, { color: colors.errorForeground }]}>خطأ: {fieldErrors.deliveryZoneId}</Text> : null}
        {availableZones.length === 0 ? <Text style={[styles.noZones, { color: colors.error }]}>لا توجد مناطق توصيل متاحة حاليًا.</Text> : <View style={styles.zoneOptions}>
          {availableZones.map(zone => {
            const selected = zone.id === form.deliveryZoneId;
            return <Pressable key={zone.id} onPress={() => update("deliveryZoneId", zone.id)} accessibilityRole="radio"
              accessibilityState={{ selected }} style={[styles.zoneOption, {
                backgroundColor: selected ? colors.primaryLight : colors.surface,
                borderColor: selected ? colors.primary : colors.borderStrong,
              }]}>
              <AppIcon name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? colors.primary : colors.textMuted} />
              <View style={styles.zoneInfo}>
                <Text style={[styles.zoneName, { color: colors.text }]}>{zone.name}</Text>
                <Text style={[styles.zoneFee, { color: colors.textSecondary }]}>{formatSypNumber(zone.fixed_fee)} ل.س رسوم توصيل</Text>
              </View>
            </Pressable>;
          })}
        </View>}

        <AppTextField label="رابط الموقع (اختياري)" value={form.mapsUrl} error={fieldErrors.mapsUrl}
          helperText="يمكنك لصق رابط موقع من تطبيق الخرائط."
          onChangeText={value => update("mapsUrl", value)} placeholder="https://maps.google.com/..." keyboardType="url" autoCapitalize="none" maxLength={1000} />

        <Pressable onPress={() => update("isDefault", !form.isDefault)} accessibilityRole="checkbox"
          accessibilityState={{ checked: form.isDefault }} style={styles.defaultToggle}>
          <AppIcon name={form.isDefault ? "checkbox" : "square-outline"} size={22} color={colors.primary} />
          <Text style={[styles.defaultToggleText, { color: colors.text }]}>استخدامه كعنوان افتراضي</Text>
        </Pressable>

        <View style={styles.actions}>
          <AppButton title={saveTitle} icon="checkmark-outline" loading={saving} disabled={availableZones.length === 0} onPress={() => void handleSave()} />
          <AppButton title="إلغاء والعودة" variant="outline" disabled={saving} onPress={guard.back} />
        </View>
      </>}
    </KeyboardAwareScrollView>
    {guard.modal}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { direction: "rtl", flexGrow: 1, gap: LayoutSpacing.formFieldGap, paddingHorizontal: LayoutSpacing.pageGutter, paddingTop: Spacing.four, paddingBottom: Spacing.ten },
  loading: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", gap: Spacing.three },
  loadingText: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "center" },
  failure: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", gap: Spacing.four, paddingHorizontal: Spacing.four },
  failureText: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "center" },
  feedback: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: Spacing.two, padding: Spacing.three, borderWidth: 1, borderRadius: Radius.md },
  feedbackText: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.sm, lineHeight: 21, ...RtlText },
  sectionLabel: { marginTop: Spacing.one, fontFamily: Fonts.bold, fontSize: FontSizes.md, ...RtlText },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
  fieldLabel: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
  fieldError: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, ...RtlText },
  noZones: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  zoneOptions: { gap: Spacing.two },
  zoneOption: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: Spacing.two, padding: Spacing.three, borderWidth: 1, borderRadius: Radius.md },
  zoneInfo: { flex: 1, minWidth: 0 },
  zoneName: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
  zoneFee: { marginTop: 2, fontFamily: Fonts.regular, fontSize: FontSizes.xs, ...RtlText },
  defaultToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: Spacing.two },
  defaultToggleText: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  actions: { gap: LayoutSpacing.actionGap, marginTop: Spacing.two },
});
