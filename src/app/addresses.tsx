import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, LayoutSpacing, Radius, RtlText, Shadows, Spacing } from "@/constants/theme";
import { useAppDialog } from "@/context/AppDialogContext";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import {
  ADDRESS_REVALIDATE_AFTER_MS,
  getAddressScroll,
  peekAddressDirectory,
  readAddressDirectory,
  setAddressScroll,
  takeAddressNotice,
} from "@/lib/customer-address-directory";
import { deleteCustomerAddress, setDefaultCustomerAddress, type CustomerAddress } from "@/lib/customer-orders";
import { formatSypNumber } from "@/lib/money";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AddressesScreen() {
  const { user } = useAuth();
  return <AddressesContent key={user?.id ?? "guest"} scope={user?.id ?? "guest"} />;
}

function AddressesContent({ scope }: { scope: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = firstParam(params.returnTo) === "/checkout" ? "/checkout" : undefined;
  const { colors } = useTheme();
  const { confirm } = useAppDialog();
  const { itemCount } = useCart();
  const initial = peekAddressDirectory(scope);
  const [addresses, setAddresses] = useState(initial?.addresses ?? []);
  const [loading, setLoading] = useState(!initial);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAddressId, setBusyAddressId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const refresh = useCallback(async (initialRead = false, force = false) => {
    const request = ++requestVersion.current;
    if (initialRead) setLoading(true);
    else setRefreshing(true);
    setError(null);
    setReadFailed(false);
    try {
      const snapshot = await readAddressDirectory(scope, force);
      if (request !== requestVersion.current) return false;
      setAddresses(snapshot.addresses);
      return true;
    } catch (cause) {
      if (request === requestVersion.current) {
        setError(cause instanceof Error ? cause.message : "تعذر تحميل عناوينك.");
        setReadFailed(true);
      }
      return false;
    } finally {
      if (request === requestVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [scope]);

  useEffect(() => {
    const timer = !initial ? setTimeout(() => void refresh(true), 0) : undefined;
    return () => {
      if (timer) clearTimeout(timer);
      requestVersion.current += 1;
    };
  }, [initial, refresh]);

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => {
      const savedNotice = takeAddressNotice(scope);
      if (savedNotice) setNotice(savedNotice);
      const cached = peekAddressDirectory(scope);
      if (!cached || Date.now() - cached.validatedAt >= ADDRESS_REVALIDATE_AFTER_MS) void refresh(!cached);
      else setAddresses(cached.addresses);
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh, scope]));

  const openEditor = useCallback((addressId?: string) => {
    router.push({ pathname: "/address-details", params: {
      ...(addressId ? { id: addressId } : {}),
      ...(returnTo ? { returnTo } : {}),
    } });
  }, [returnTo, router]);

  const handleSetDefault = useCallback(async (addressId: string) => {
    setBusyAddressId(addressId);
    setError(null);
    setReadFailed(false);
    try {
      await setDefaultCustomerAddress(addressId);
      if (await refresh(false, true)) setNotice("تم تعيين العنوان الافتراضي.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تعيين العنوان الافتراضي.");
    } finally {
      setBusyAddressId(null);
    }
  }, [refresh]);

  const handleDelete = useCallback(async (address: CustomerAddress) => {
    if (busyAddressId) return;
    const accepted = await confirm({
      title: "حذف العنوان؟",
      message: `سيُحذف عنوان «${address.title}» نهائيًا، ولا يمكن التراجع عن هذه العملية.`,
      confirmText: "حذف العنوان",
      cancelText: "إبقاء العنوان",
      destructive: true,
    });
    if (!accepted) return;
    setBusyAddressId(address.id);
    setError(null);
    setNotice(null);
    try {
      await deleteCustomerAddress(address.id);
      if (await refresh(false, true)) setNotice("تم حذف العنوان.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حذف العنوان.");
    } finally {
      setBusyAddressId(null);
    }
  }, [busyAddressId, confirm, refresh]);

  const openMaps = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setError("تعذر فتح رابط الموقع. تحقق من صحة الرابط ثم حاول مجددًا.");
    }
  }, []);

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <AppHeader title="العناوين" showBack cartCount={itemCount} mode="customer" />
    <ScrollView showsVerticalScrollIndicator={false}
      contentOffset={{ x: 0, y: getAddressScroll(scope) }}
      onScroll={event => setAddressScroll(scope, event.nativeEvent.contentOffset.y)} scrollEventThrottle={120}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(false)} tintColor={colors.primary} />}
      contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {loading ? "جارٍ تحميل العناوين…" : readFailed && addresses.length === 0 ? "تعذر تحميل العناوين" : `${addresses.length} عنوان محفوظ`}
        </Text>
        <Pressable onPress={() => openEditor()} accessibilityRole="button" accessibilityLabel="إضافة عنوان جديد"
          style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
          <AppIcon name="add" size={20} color={colors.onPrimary} />
          <Text style={[styles.addButtonText, { color: colors.onPrimary }]}>إضافة عنوان</Text>
        </Pressable>
      </View>

      {error ? <View accessibilityRole="alert" style={[styles.feedback, { backgroundColor: colors.errorSurface, borderColor: colors.errorBorder }]}>
        <AppIcon name="alert-circle-outline" size={20} color={colors.error} />
        <Text style={[styles.feedbackText, { color: colors.error }]}>{error}</Text>
        {readFailed && !busyAddressId ? <Pressable onPress={() => void refresh(false)} accessibilityRole="button" style={styles.retryAction}>
          <Text style={[styles.retryText, { color: colors.primary }]}>إعادة المحاولة</Text>
        </Pressable> : null}
      </View> : null}
      {notice ? <View accessibilityLiveRegion="polite" style={[styles.feedback, { backgroundColor: colors.successSurface, borderColor: colors.successBorder }]}>
        <AppIcon name="checkmark-circle-outline" size={20} color={colors.success} />
        <Text style={[styles.feedbackText, { color: colors.success }]}>{notice}</Text>
      </View> : null}

      {loading ? <View style={styles.loading} accessibilityRole="progressbar"><ActivityIndicator color={colors.primary} /></View>
        : addresses.length === 0 && !readFailed ? <AppEmptyState icon="location-outline" title="لا توجد عناوين محفوظة"
          description="أضف عنوان التوصيل الأول لاستخدامه عند إتمام طلبك." />
        : <View style={styles.list}>{addresses.map(address => {
          const busy = busyAddressId === address.id;
          const zoneAvailable = Boolean(address.zone?.is_active);
          return <View key={address.id} style={[styles.addressCard, Shadows.card, {
            backgroundColor: colors.surface, borderColor: address.is_default ? colors.primary : colors.border,
          }]}>
            <View style={styles.addressBody}>
              <View style={[styles.addressIcon, { backgroundColor: colors.primaryLight }]}><AppIcon name="location-outline" size={21} color={colors.primary} /></View>
              <View style={styles.addressInfo}>
                <View style={styles.titleRow}>
                  <Text style={[styles.addressTitle, { color: colors.text }]}>{address.title}</Text>
                  {address.is_default ? <View style={[styles.defaultBadge, { backgroundColor: colors.successSurface }]}>
                    <AppIcon name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={[styles.defaultText, { color: colors.success }]}>الافتراضي</Text>
                  </View> : null}
                </View>
                <Text style={[styles.addressDetail, { color: colors.textSecondary }]}>{address.delivery_address}</Text>
                <Text style={[styles.recipient, { color: colors.textMuted }]}>{address.recipient_name} · {address.contact_phone}</Text>
                <View style={styles.zoneRow}>
                  <AppIcon name={zoneAvailable ? "navigate-outline" : "alert-circle-outline"} size={15} color={zoneAvailable ? colors.primary : colors.error} />
                  <Text style={[styles.zoneText, { color: zoneAvailable ? colors.primary : colors.error }]}>
                    {address.zone ? `${address.zone.name}${zoneAvailable ? ` · ${formatSypNumber(address.zone.fixed_fee)} ل.س` : " · غير متاحة"}` : "منطقة التوصيل غير متاحة"}
                  </Text>
                </View>
              </View>
            </View>
            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              {address.maps_url ? <AddressAction icon="map-outline" label="الموقع" color={colors.primary} onPress={() => void openMaps(address.maps_url)} /> : null}
              {!address.is_default ? <AddressAction icon="checkmark-circle-outline" label="جعله افتراضيًا" color={colors.primary}
                loading={busy} disabled={Boolean(busyAddressId)} onPress={() => void handleSetDefault(address.id)} /> : null}
              <AddressAction icon="create-outline" label="تعديل" color={colors.primary} disabled={Boolean(busyAddressId)} onPress={() => openEditor(address.id)} />
              <AddressAction icon="trash-outline" label="حذف" color={colors.error} disabled={Boolean(busyAddressId)} onPress={() => void handleDelete(address)} />
            </View>
          </View>;
        })}</View>}
    </ScrollView>
  </View>;
}

type AddressActionProps = { icon: React.ComponentProps<typeof AppIcon>["name"]; label: string; color: string; onPress: () => void; disabled?: boolean; loading?: boolean };
function AddressAction({ icon, label, color, onPress, disabled = false, loading = false }: AddressActionProps) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
    style={({ pressed }) => [styles.addressAction, (pressed || disabled) && styles.pressed]}>
    {loading ? <ActivityIndicator size="small" color={color} /> : <AppIcon name={icon} size={18} color={color} />}
    <Text style={[styles.actionText, { color }]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { direction: "rtl", flexGrow: 1, gap: LayoutSpacing.sectionGap, paddingHorizontal: LayoutSpacing.pageGutter, paddingTop: Spacing.three, paddingBottom: Spacing.ten },
  toolbar: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.three },
  count: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  addButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Radius.md },
  addButtonText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
  feedback: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: Spacing.two, padding: Spacing.three, borderWidth: 1, borderRadius: Radius.md },
  feedbackText: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.sm, lineHeight: 21, ...RtlText },
  retryAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: Spacing.one },
  retryText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs, ...RtlText },
  loading: { minHeight: 160, alignItems: "center", justifyContent: "center" },
  list: { gap: LayoutSpacing.cardGap },
  addressCard: { borderWidth: 1, borderRadius: Radius.lg, overflow: "hidden" },
  addressBody: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.three, padding: LayoutSpacing.compactCardPadding },
  addressIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.md },
  addressInfo: { flex: 1, minWidth: 0, gap: Spacing.one },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Spacing.two },
  addressTitle: { flexShrink: 1, fontFamily: Fonts.bold, fontSize: FontSizes.md, ...RtlText },
  defaultBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: Radius.full },
  defaultText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs, ...RtlText },
  addressDetail: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 21, ...RtlText },
  recipient: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, ...RtlText },
  zoneRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  zoneText: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.xs, ...RtlText },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderTopWidth: StyleSheet.hairlineWidth },
  addressAction: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.one, paddingHorizontal: Spacing.two },
  actionText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs, ...RtlText },
  pressed: { opacity: 0.68 },
});
