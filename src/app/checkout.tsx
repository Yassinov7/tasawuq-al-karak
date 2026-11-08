import { quoteC3Cart, recoverC3Checkout, retryC3Checkout, type C3CheckoutResult } from "@/lib/c3-orders";
import type { C3Quote } from "@/lib/c3-order-contract";
import { formatSypNumber } from "@/lib/money";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import {
  FontSizes,
  Fonts,
  Radius,
  Spacing,
} from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  createCustomerOrder,
  getCustomerAddresses,
  formatCurrency,
  getDeliveryZones,
  type CustomerAddress,
  type DeliveryZone,
} from "@/lib/customer-orders";
import { supabase } from "@/lib/supabase";

export default function CheckoutScreen() {
  const { user } = useAuth();
  // Account replacement unmounts the entire draft, including failed/stale address loads.
  return <CheckoutContent key={user?.id ?? "guest"} />;
}

function CheckoutContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const ownerId = user?.id;
  const [initialAccountPhone] = useState(() => typeof user?.user_metadata?.phone === "string" ? user.user_metadata.phone : "");
  const {
    items,
    selectedOfferIds,
    itemCount,


    loading: cartLoading,
    syncError,
    flush,
    retrySync,
  } = useCart();
  const { products, stores, offers, refresh: refreshCatalog, loading: catalogLoading, error: catalogError } = useCustomerCatalog();
  useFocusEffect(useCallback(() => { void refreshCatalog(); }, [refreshCatalog]));
  const hasUnavailableItems = items.some((item) => !products.some((product) => product.id === item.productId && product.available))
    || selectedOfferIds.some((id) => !offers.some((offer) => offer.id === id && offer.items.every((item) => item.product.available)));

  const [confirmModalVisible, setConfirmModalVisible] =
    useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [showAddressChoices, setShowAddressChoices] = useState(false);
  const [showZoneChoices, setShowZoneChoices] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedAddressIdRef = useRef<string | null>(null);
  const hasReceivedInitialFocus = useRef(false);

  const selectedZone = deliveryZones.find((zone) => zone.id === selectedZoneId);
  const selectedAddress = savedAddresses.find((address) => address.id === selectedAddressId) ?? null;
  const [quote, setQuote] = useState<{ scope: string; value: C3Quote } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteRetry, setQuoteRetry] = useState(0);
  const submissionLock = useRef<string | null>(null);
  const confirmedTotal = useRef<number | null>(null);
  const confirmedCart = useRef<string | null>(null);
  const ownerRef = useRef(user?.id);
  useLayoutEffect(() => { ownerRef.current = user?.id; return () => { ownerRef.current = undefined; }; }, [user?.id]);
  const [recoveryState, setRecoveryState] = useState<{ owner: string; result: C3CheckoutResult } | null>(null);
  const [recoveryError, setRecoveryError] = useState<{ owner: string; message: string } | null>(null);
  const [recovering, setRecovering] = useState(false);
  const recovery = recoveryState && recoveryState.owner === user?.id ? recoveryState.result : null;
  const recoveryMessage = recoveryError && recoveryError.owner === user?.id ? recoveryError.message : "";
  const recoveryReady = Boolean(recovery) && !recovering && !recoveryMessage && recovery?.kind !== "pending";
  useFocusEffect(useCallback(() => {
    let active = true;
    const owner = user?.id;
    if (!owner) return;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setRecovering(true); setRecoveryError(null);
      try {
        const result = await recoverC3Checkout(owner);
        if (active) {
          setRecoveryState({ owner, result });
          if (result.kind === "recovered") void retrySync().catch(() => undefined);
        }
      } catch (cause) { if (active) setRecoveryError({ owner, message: cause instanceof Error ? cause.message : "تعذر التحقق من المحاولة السابقة." }); }
      finally { if (active) setRecovering(false); }
    })();
    return () => { active = false; };
  }, [user?.id, retrySync]));
  async function checkPrevious(retry: boolean) {
    const owner = user?.id;
    if (!owner || submissionLock.current === owner) return;
    submissionLock.current = owner; setRecovering(true); setRecoveryError(null);
    try {
      const result = await (retry ? retryC3Checkout(owner) : recoverC3Checkout(owner));
      if (ownerRef.current !== owner) return;
      setRecoveryState({ owner, result });
      if (result.kind === "recovered") void retrySync().catch(() => undefined);
    } catch (cause) { if (ownerRef.current === owner) setRecoveryError({ owner, message: cause instanceof Error ? cause.message : "تعذر التحقق من المحاولة السابقة." }); }
    finally { if (submissionLock.current === owner) submissionLock.current = null; if (ownerRef.current === owner) setRecovering(false); }
  }
  const quoteScope = JSON.stringify([user?.id, selectedZoneId, items, selectedOfferIds, quoteRetry]);
  const validQuote = quote?.scope === quoteScope && !cartLoading && !syncError ? quote.value : null;
  const total = validQuote?.total;
  const deliveryFee = validQuote?.delivery_fee;
  const confirmationTotal = total === undefined ? "بانتظار حساب الخادم" : formatCurrency(total, "SYP");
  useEffect(() => {
    let active = true;
    if (!user || !selectedZoneId || cartLoading || syncError || itemCount === 0) return;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setQuote(null); setQuoteError("");
      try {
        await flush();
        const value = await quoteC3Cart(selectedZoneId, user.id);
        if (active) setQuote({ scope: quoteScope, value });
      } catch { if (active) setQuoteError("تعذر حساب ملخص الطلب من الخادم. أعد المحاولة."); }
    })();
    return () => { active = false; };
  }, [quoteScope, user, selectedZoneId, cartLoading, syncError, itemCount, flush, quoteRetry]);
  const cartPreviewItems = items.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return product ? [{ product, quantity: item.quantity }] : [];
  });
  const cartStoreNames = [...new Set(cartPreviewItems.map(({ product }) =>
    stores.find((store) => store.id === product.storeId)?.name ?? "متجر",
  ))];

  const clearSavedAddressSelection = useCallback(() => {
    selectedAddressIdRef.current = null;
    setSelectedAddressId(null);
  }, []);

  const applySavedAddress = useCallback((address: CustomerAddress) => {
    selectedAddressIdRef.current = address.id;
    setSelectedAddressId(address.id);
    setRecipientName(address.recipient_name);
    setContactPhone(address.contact_phone);
    setDeliveryAddress(address.delivery_address);
    if (address.zone?.is_active) {
      setSelectedZoneId(address.delivery_zone_id);
      setError(null);
    } else {
      setSelectedZoneId("");
      setError("منطقة هذا العنوان لم تعد متاحة. اختر منطقة توصيل فعالة.");
    }
  }, []);

  const refreshSavedAddresses = useCallback(async (isActive: () => boolean) => {
    try {
      const addresses = await getCustomerAddresses();
      if (!isActive()) return;

      setSavedAddresses(addresses);
      const selectedId = selectedAddressIdRef.current;
      if (!selectedId) return;

      const selectedAddress = addresses.find((address) => address.id === selectedId);
      if (selectedAddress) {
        applySavedAddress(selectedAddress);
        return;
      }

      const defaultAddress = addresses.find((address) => address.is_default && address.zone?.is_active);
      if (defaultAddress) {
        applySavedAddress(defaultAddress);
        return;
      }

      clearSavedAddressSelection();
    } catch (cause) {
      if (isActive()) {
        setError(cause instanceof Error ? cause.message : "تعذر تحديث العناوين المحفوظة.");
      }
    }
  }, [applySavedAddress, clearSavedAddressSelection]);

  useEffect(() => {
    let alive = true;
    const loadCheckoutDetails = async () => {
      setSubmitting(false);
      setLoadingDetails(true);
      setError(null);
      try {
        const [zones, profileResult, addresses] = await Promise.all([
          getDeliveryZones(),
          ownerId
            ? supabase.from("profiles").select("full_name").eq("id", ownerId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          getCustomerAddresses(),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (!alive) return;
        setDeliveryZones(zones);
        setSavedAddresses(addresses);
        const defaultAddress = addresses.find((address) => address.is_default);
        const defaultZoneIsActive = Boolean(defaultAddress?.zone?.is_active);
        const initialAddressId = defaultAddress && defaultZoneIsActive ? defaultAddress.id : null;
        selectedAddressIdRef.current = initialAddressId;
        setSelectedAddressId(initialAddressId);
        setSelectedZoneId(defaultZoneIsActive
          ? defaultAddress?.delivery_zone_id ?? ""
          : "");
        setRecipientName(defaultAddress?.recipient_name ?? profileResult.data?.full_name ?? "");
        setContactPhone(defaultAddress?.contact_phone ?? initialAccountPhone);
        setDeliveryAddress(defaultAddress?.delivery_address ?? "");
      } catch (cause) {
        if (alive) {
          setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات إتمام الطلب.");
        }
      } finally {
        if (alive) setLoadingDetails(false);
      }
    };
    void loadCheckoutDetails();
    return () => {
      alive = false;
    };
  }, [ownerId, initialAccountPhone]);

  useFocusEffect(
    useCallback(() => {
      if (!hasReceivedInitialFocus.current) {
        hasReceivedInitialFocus.current = true;
        return undefined;
      }

      let active = true;
      void refreshSavedAddresses(() => active);
      return () => {
        active = false;
      };
    }, [refreshSavedAddresses]),
  );

  const selectSavedAddress = (address: CustomerAddress) => {
    applySavedAddress(address);
  };

  const handleConfirmOrder = () => {
    if (submitting || !recoveryReady) return;
    setError(null);
    if (catalogLoading || catalogError || hasUnavailableItems) {
      setError(catalogLoading ? "جارٍ التحقق من توفر المنتجات." : catalogError ? "تعذر التحقق من توفر المنتجات. أعد تحميل السلة." : "يوجد منتج أو عرض لم يعد متاحًا. أزله من السلة قبل المتابعة.");
      return;
    }
    if (cartLoading || itemCount === 0) {
      setError("السلة فارغة أو ما زالت قيد التحميل.");
      return;
    }
    if (!recipientName.trim() || !contactPhone.trim() || !deliveryAddress.trim() || !selectedZone) {
      setError("أكمل بيانات المستلم وعنوان التوصيل واختر منطقة التوصيل.");
      return;
    }
    if (!validQuote) { setError("انتظر حساب المبلغ من الخادم."); return; }
    confirmedTotal.current = validQuote.total;
    confirmedCart.current = validQuote.cart_signature;
    setConfirmModalVisible(true);
  };

  const handleConfirm = async () => {
    if (submissionLock.current === user?.id) return;
    if (confirmedTotal.current === null || !validQuote || confirmedTotal.current !== validQuote.total || confirmedCart.current !== validQuote.cart_signature || !user || !recoveryReady) { setError("تغير الملخص؛ راجعه وأكد المبلغ مجددًا."); setConfirmModalVisible(false); return; }
    if (catalogLoading || catalogError || hasUnavailableItems) {
      setError(catalogLoading ? "جارٍ التحقق من توفر المنتجات." : "يوجد منتج أو عرض غير متاح أو تعذر التحقق منه. عُد إلى السلة قبل المتابعة.");
      return;
    }
    const owner = user.id;
    submissionLock.current = owner;
    setSubmitting(true);
    setError(null);
    try {
      await flush();
      const result = await createCustomerOrder({
        recipientName: recipientName.trim(),
        contactPhone: contactPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        deliveryZoneId: selectedZoneId,
        customerNote: customerNote.trim(),
        expectedTotal: confirmedTotal.current,
        expectedUser: owner, cartSignature: validQuote.cart_signature,
      });
      if (ownerRef.current !== owner) return;
      setConfirmModalVisible(false);
      setRecoveryError(null);
      setRecoveryState({ owner, result });
      if (result.kind === "created") {
        void retrySync().catch(() => undefined);
        router.replace({ pathname: "/order-details", params: { id: result.orderId } });
      } else if (result.kind === "recovered") {
        // A recovered result never clears the current local cart or claims it was submitted.
        void retrySync().catch(() => undefined);
      } else if (result.kind === "rejected") { setError(result.message); setQuoteRetry(value => value + 1); }

    } catch (cause) {
      if (ownerRef.current !== owner) return;
      setRecoveryState({ owner, result: { kind: "pending", recipient: recipientName.trim(), expectedTotal: validQuote.total } });
      setError(cause instanceof Error ? cause.message : "تعذر تأكيد الطلب. تحقّق من المحاولة السابقة.");
      setQuoteRetry(value => value + 1);
      void refreshCatalog();
    } finally {
      if (submissionLock.current === owner) submissionLock.current = null;
      if (ownerRef.current === owner) setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setConfirmModalVisible(false);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader
        title="إتمام الطلب"
        showBack
        cartCount={itemCount}
        mode="customer"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {(recovering || !recovery || recovery.kind !== "none" || recoveryMessage) ? <Section title="محاولة الطلب السابقة">
          {recovering ? <ActivityIndicator color={colors.primary} /> : null}
          {recovery?.kind === "recovered" ? <>
            <Text style={[styles.noticeText, { color: colors.text }]}>تم العثور على طلب سبق تأكيد إنشائه. لم تُؤكد سلتك الحالية ولم تُمسح؛ يمكنك مراجعة الطلب السابق أو تأكيد طلب جديد من السلة الحالية.</Text>
            <AppButton title="عرض الطلب المستعاد" variant="outline" onPress={() => router.push({ pathname: "/order-details", params: { id: recovery.orderId } })} />
          </> : null}
          {recovery?.kind === "pending" ? <>
            <Text style={[styles.noticeText, { color: colors.text }]}>لم تُحسم المحاولة السابقة للمستلم {recovery.recipient} بمبلغ {formatCurrency(recovery.expectedTotal, "SYP")}. إعادة المحاولة تستخدم بياناتها المحفوظة؛ لا ترسل السلة الجديدة.</Text>
            <AppButton title="إعادة محاولة الطلب السابق" disabled={recovering || submitting} onPress={() => void checkPrevious(true)} />
          </> : null}
          {recovery?.kind === "rejected" ? <Text style={[styles.noticeText, { color: colors.error }]}>{recovery.message}</Text> : null}
          {recoveryMessage ? <Text accessibilityRole="alert" style={[styles.noticeText, { color: colors.error }]}>{recoveryMessage}</Text> : null}
          <AppButton title="التحقق من نتيجة المحاولة السابقة" variant="outline" disabled={recovering || submitting} onPress={() => void checkPrevious(false)} />
        </Section> : null}
        <Section title="محتوى السلة">
          <View style={[styles.cartPreview, { borderColor: colors.border }]}>
            {cartPreviewItems.slice(0, 3).map(({ product, quantity }) => (
              <View key={product.id} style={styles.previewItem}>
                <View style={styles.previewItemInfo}>
                  <Text numberOfLines={1} style={[styles.previewItemName, { color: colors.text }]}>{product.name}</Text>
                  <Text style={[styles.previewItemMeta, { color: colors.textMuted }]}>
                    {quantity}{product.unit ? ` ${product.unit}` : ""}
                  </Text>
                </View>
                <Text numberOfLines={1} style={[styles.previewItemPrice, { color: colors.text }]}>
                  {formatCurrency(product.price, "SYP")} للوحدة
                </Text>
              </View>
            ))}
            {cartPreviewItems.length > 3 ? <Text style={[styles.cartPreviewText, { color: colors.textMuted }]}>و{cartPreviewItems.length - 3} عناصر أخرى</Text> : null}
            {cartStoreNames.length > 1 ? <Text style={[styles.cartPreviewText, { color: colors.textSecondary }]}>الطلب يشمل {cartStoreNames.length} متاجر، وتظهر تفاصيل كل متجر في تتبع الطلب.</Text> : null}
            <Text style={[styles.cartPreviewText, { color: colors.textSecondary }]}>ستُراجع الأسعار والتوفر النهائيان عند إرسال الطلب.</Text>
          </View>
        </Section>

        <Section title="عنوان التوصيل">
          {loadingDetails ? <ActivityIndicator color={colors.primary} /> : null}
          {selectedAddress ? (
            <View style={[styles.selectedAddressCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  {selectedAddress.title}{selectedAddress.is_default ? " · افتراضي" : ""}
                </Text>
                <Text numberOfLines={1} style={[styles.optionText, { color: colors.textSecondary }]}>
                  {selectedAddress.recipient_name} · {selectedAddress.contact_phone}
                </Text>
                <Text numberOfLines={2} style={[styles.optionText, { color: colors.textSecondary }]}>
                  {selectedAddress.delivery_address}
                </Text>
              </View>
              <AppIcon name="checkmark-circle" size={22} color={colors.primary} />
            </View>
          ) : (
            <View style={[styles.addressEmpty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.addressEmptyText, { color: colors.textSecondary }]}>
                {savedAddresses.length ? "لم يُحدد عنوان محفوظ لهذا الطلب." : "لا يوجد عنوان محفوظ بعد."}
              </Text>
            </View>
          )}
          {savedAddresses.length > 0 ? (
            <Pressable
              onPress={() => setShowAddressChoices((current) => !current)}
              style={styles.selectorAction}
              accessibilityRole="button"
              accessibilityLabel={showAddressChoices ? "إخفاء العناوين المحفوظة" : "تغيير العنوان المحفوظ"}
            >
              <AppIcon name={showAddressChoices ? "chevron-up-outline" : "chevron-down-outline"} size={17} color={colors.primary} />
              <Text style={[styles.selectorActionText, { color: colors.primary }]}>
                {showAddressChoices ? "إخفاء العناوين" : "تغيير العنوان"}
              </Text>
            </Pressable>
          ) : null}
          {showAddressChoices ? (
            <View style={styles.choiceList}>
              {savedAddresses.map((address) => {
                const selected = selectedAddressId === address.id;
                return (
                  <Pressable
                    key={address.id}
                    onPress={() => {
                      selectSavedAddress(address);
                      setShowAddressChoices(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.optionCard,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <View style={styles.optionInfo}>
                      <Text style={[styles.optionTitle, { color: colors.text }]}>{address.title}</Text>
                      <Text numberOfLines={1} style={[styles.optionText, { color: colors.textSecondary }]}>{address.delivery_address}</Text>
                    </View>
                    <AppIcon name={selected ? "checkmark-circle" : "ellipse-outline"} size={22} color={selected ? colors.primary : colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <AppButton
            title={savedAddresses.length ? "إدارة العناوين" : "إضافة عنوان"}
            icon="location-outline"
            variant="outline"
            onPress={() => router.push("/addresses")}
          />
          <AppTextField
            label="اسم المستلم"
            value={recipientName}
            onChangeText={(value) => {
              clearSavedAddressSelection();
              setRecipientName(value);
            }}
            autoCapitalize="words"
            maxLength={120}
          />
          <AppTextField
            label="رقم الهاتف"
            value={contactPhone}
            onChangeText={(value) => {
              clearSavedAddressSelection();
              setContactPhone(value);
            }}
            keyboardType="phone-pad"
            maxLength={32}
          />
          <AppTextField
            label="العنوان بالتفصيل"
            value={deliveryAddress}
            onChangeText={(value) => {
              clearSavedAddressSelection();
              setDeliveryAddress(value);
            }}
            placeholder="الحي، الشارع، أقرب علامة مميزة"
            multiline
            maxLength={1000}
          />
          {selectedZone ? (
            <View style={[styles.selectedZoneCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.optionIcon, { backgroundColor: colors.primaryLight }]}>
                <AppIcon name="home-outline" size={21} color={colors.primary} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>{selectedZone.name}</Text>
                <Text style={[styles.optionText, { color: colors.textSecondary }]}>رسم المنطقة الأساسي: {formatCurrency(selectedZone.fixed_fee, "SYP")}؛ الرسم النهائي في الملخص</Text>
              </View>
              <AppIcon name="checkmark-circle" size={22} color={colors.primary} />
            </View>
          ) : (
            <View style={[styles.addressEmpty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.addressEmptyText, { color: colors.textSecondary }]}>اختر منطقة التوصيل لإكمال الطلب.</Text>
            </View>
          )}
          {deliveryZones.length > 0 ? (
            <Pressable
              onPress={() => setShowZoneChoices((current) => !current)}
              style={styles.selectorAction}
              accessibilityRole="button"
              accessibilityLabel={showZoneChoices ? "إخفاء مناطق التوصيل" : "تغيير منطقة التوصيل"}
            >
              <AppIcon name={showZoneChoices ? "chevron-up-outline" : "chevron-down-outline"} size={17} color={colors.primary} />
              <Text style={[styles.selectorActionText, { color: colors.primary }]}>{showZoneChoices ? "إخفاء المناطق" : "تغيير المنطقة"}</Text>
            </Pressable>
          ) : null}
          {showZoneChoices ? (
            <View style={styles.choiceList}>
              {deliveryZones.map((zone) => (
                <Pressable
                  key={zone.id}
                  onPress={() => {
                    clearSavedAddressSelection();
                    setSelectedZoneId(zone.id);
                    setShowZoneChoices(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedZoneId === zone.id }}
                  style={[styles.optionCard, { borderColor: selectedZoneId === zone.id ? colors.primary : colors.border, backgroundColor: colors.surface }]}
                >
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>{zone.name}</Text>
                    <Text style={[styles.optionText, { color: colors.textSecondary }]}>الرسم الأساسي: {formatCurrency(zone.fixed_fee, "SYP")}</Text>
                  </View>
                  <AppIcon name={selectedZoneId === zone.id ? "checkmark-circle" : "ellipse-outline"} size={22} color={selectedZoneId === zone.id ? colors.primary : colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : null}
          <AppTextField
            label="ملاحظة للطلب (اختياري)"
            value={customerNote}
            onChangeText={setCustomerNote}
            multiline
            maxLength={1500}
          />
        </Section>

        <Section title="طريقة الدفع">
          <View style={styles.paymentLine}>
            <View
              style={[styles.optionIcon, { backgroundColor: colors.primaryLight }]}
            >
              <AppIcon
                name="cash-outline"
                size={21}
                color={colors.primary}
              />
            </View>

            <View style={styles.optionInfo}>
              <Text
                style={[
                  styles.optionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                الدفع عند الاستلام
              </Text>

              <Text
                style={[
                  styles.optionText,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                ادفع نقداً عند وصول الطلب
              </Text>
            </View>

            <AppIcon
              name="checkmark-circle"
              size={22}
              color={colors.primary}
            />
          </View>
        </Section>

        <Section title="ملخص الطلب">
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>يحسب الخادم رسم المنطقة ورسم كل متجر إضافي، وتُحفظ مبالغ البضائع بدقتها الحالية حتى منزلتين عشريتين؛ رسوم التوصيل أعداد صحيحة بالليرة.</Text>
          <View style={[styles.priceSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SummaryRow
              label="عدد المنتجات"
              value={`${itemCount} قطعة`}
            />

            <SummaryRow
              label="المجموع الفرعي"
              value={validQuote ? formatCurrency(validQuote.items_amount, "SYP") : "بانتظار حساب الخادم"}
            />

            <SummaryRow
              label="التوصيل"
              value={deliveryFee !== undefined ? formatCurrency(deliveryFee, "SYP") : selectedZone ? "جارٍ حساب التوصيل" : "اختر منطقة التوصيل"}
            />

            <View
              style={[
                styles.divider,
                {
                  backgroundColor:
                    colors.border,
                },
              ]}
            />

            <View style={styles.totalRow}>
              <Text
                style={[
                  styles.totalLabel,
                  {
                    color: colors.text,
                  },
                ]}
              >
                الإجمالي
              </Text>

              <View style={styles.totalPrice}>
                <Text
                  style={[
                    styles.totalAmount,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  {total === undefined ? "—" : formatSypNumber(total)}
                </Text>

                <Text
                  style={[
                    styles.totalCurrency,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                >
                  {"ل.س"}
                </Text>
              </View>
            </View>
          </View>
        </Section>

        <View style={styles.multiStoreNote}>
          <AppIcon
            name="information-circle-outline"
            size={21}
            color={colors.primary}
          />

          <Text
            style={[
              styles.noticeText,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            الطلب متعدد المتاجر يمكن أن يحتوي
            على أكثر من فاتورة فرعية، وسيتم
            احتساب تفاصيل كل متجر ضمن الطلب.
          </Text>
        </View>

        {hasUnavailableItems && !catalogLoading ? <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: "right" }}>يوجد منتج أو عرض غير متاح؛ عُد إلى السلة لإزالته.</Text> : null}
        {catalogError ? <AppButton title="إعادة التحقق من توفر المنتجات" variant="outline" onPress={() => void refreshCatalog()} /> : null}
        {quoteError ? <View><Text style={{ color: colors.error }}>{quoteError}</Text><AppButton title="إعادة حساب المبلغ" onPress={() => setQuoteRetry(value => value + 1)} /></View> : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: "right" }}>
            {error}
          </Text>
        ) : null}
        {syncError ? (
          <View style={{ alignItems: "flex-start", gap: Spacing.two }}>
            <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: "right" }}>
              {syncError}
            </Text>
            <AppButton title="إعادة تحميل السلة" variant="outline" onPress={() => void retrySync()} />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.checkoutBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(Spacing.three, insets.bottom) }]}>
        <View style={styles.checkoutBarTotal}>
          <Text style={[styles.checkoutBarLabel, { color: colors.textMuted }]}>الإجمالي</Text>
          <Text numberOfLines={1} style={[styles.checkoutBarValue, { color: colors.primary }]}>{confirmationTotal}</Text>
        </View>
        <Pressable
          disabled={!recoveryReady || !validQuote || loadingDetails || submitting || cartLoading || catalogLoading || Boolean(catalogError) || hasUnavailableItems || itemCount === 0 || Boolean(syncError)}
          onPress={handleConfirmOrder}
          style={({ pressed }) => [styles.confirmButton, { backgroundColor: colors.primary }, pressed && styles.pressed, (loadingDetails || submitting || cartLoading || catalogLoading || Boolean(catalogError) || hasUnavailableItems || itemCount === 0 || Boolean(syncError)) && { opacity: 0.55 }]}
          accessibilityRole="button"
          accessibilityLabel="تأكيد الطلب"
        >
          <Text style={[styles.confirmText, { color: colors.surface }]}>{submitting ? "جارٍ إرسال الطلب..." : recovery?.kind === "recovered" ? "تأكيد طلب جديد" : "تأكيد الطلب"}</Text>
          <AppIcon name="checkmark-circle-outline" size={20} color={colors.surface} />
        </Pressable>
      </View>

      <AppModal
        visible={confirmModalVisible}
        title="تأكيد الطلب"
        message={`هل تريد تأكيد الطلب بقيمة ${confirmationTotal} والدفع عند الاستلام؟`}
        icon="checkmark-circle-outline"
        confirmText={submitting ? "جارٍ إرسال الطلب..." : recovery?.kind === "recovered" ? "تأكيد طلب جديد" : "تأكيد الطلب"}
        cancelText="مراجعة الطلب"
        busy={submitting}
        onConfirm={() => void handleConfirm()}
        onCancel={handleCancel}
      >
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: "center", marginTop: Spacing.three }}>
            {error}
          </Text>
        ) : null}
      </AppModal>
    </View>
  );
}

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

function Section({
  title,
  children,
}: SectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>

      {children}
    </View>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({
  label,
  value,
}: SummaryRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.summaryValue,
          {
            color: colors.text,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.ten + 72,
  },

  section: {
    marginBottom: Spacing.six,
  },

  sectionHeader: { borderBottomWidth: 1, marginBottom: Spacing.two, paddingBottom: Spacing.two },

  cartPreview: { borderTopWidth: 1, gap: Spacing.two, paddingTop: Spacing.two },
  cartPreviewText: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  previewItem: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", gap: Spacing.two },
  previewItemInfo: { flex: 1, gap: Spacing.half },
  previewItemName: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" },
  previewItemMeta: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  previewItemPrice: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "left" },

  selectedAddressCard: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, flexDirection: "row-reverse", paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  selectedZoneCard: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, flexDirection: "row-reverse", paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  addressEmpty: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  addressEmptyText: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" },
  selectorAction: { alignSelf: "flex-start", alignItems: "center", flexDirection: "row-reverse", gap: Spacing.one, minHeight: 38, paddingHorizontal: Spacing.one },
  selectorActionText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  choiceList: { gap: Spacing.two },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  optionCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  optionIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  optionInfo: {
    flex: 1,
    marginHorizontal: Spacing.three,
    alignItems: "flex-end",
  },

  optionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  optionText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  priceSummary: { borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.two, padding: Spacing.three },

  summaryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  summaryLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  summaryValue: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  divider: {
    height: 1,
    marginBottom: Spacing.three,
  },

  totalRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  totalLabel: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  totalPrice: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 4,
  },

  totalAmount: {
    fontFamily: Fonts.bold,
    fontSize: 23,
  },

  totalCurrency: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
  },

  multiStoreNote: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },

  noticeText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  confirmButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    flex: 1,
    minHeight: 50,
    borderRadius: Radius.lg,
  },

  checkoutBar: { alignItems: "center", borderTopWidth: 1, flexDirection: "row-reverse", gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  checkoutBarTotal: { flex: 1, gap: Spacing.half },
  checkoutBarLabel: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  checkoutBarValue: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" },
  paymentLine: { alignItems: "center", flexDirection: "row-reverse", paddingVertical: Spacing.two },

  confirmText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  footerNote: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.72,
  },
});
