import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { quoteC3Cart, recoverC3Checkout, retryC3Checkout, type C3CheckoutResult } from "@/lib/c3-orders";
import type { C3Quote } from "@/lib/c3-order-contract";
import { formatSypNumber } from "@/lib/money";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
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
  const routeParams = useLocalSearchParams<{ addressId?: string | string[] }>();
  const returningAddressId = Array.isArray(routeParams.addressId) ? routeParams.addressId[0] : routeParams.addressId;
  const [initialReturningAddressId] = useState(returningAddressId);
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
    refreshing: cartRefreshing,
    syncError,
    flush,
    retrySync,
    revalidate: revalidateCart,
  } = useCart();
  const {
    products,
    stores,
    offers,
    refresh: refreshCatalog,
    revalidate: revalidateCatalog,
    loading: catalogLoading,
    refreshing: catalogRefreshing,
    error: catalogError,
  } = useCustomerCatalog();
  useFocusEffect(useCallback(() => {
    void Promise.all([revalidateCart(), revalidateCatalog()]);
  }, [revalidateCart, revalidateCatalog]));
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
  const [differentRecipient, setDifferentRecipient] = useState(false);
  const [manualAddressMode, setManualAddressMode] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedAddressIdRef = useRef<string | null>(null);
  const differentRecipientRef = useRef(false);
  const hasReceivedInitialFocus = useRef(false);

  const selectedZone = deliveryZones.find((zone) => zone.id === selectedZoneId);
  const selectedAddress = savedAddresses.find((address) => address.id === selectedAddressId) ?? null;
  const deliveryDetailsReady = Boolean(selectedAddress || manualAddressMode) &&
    Boolean(recipientName.trim() && contactPhone.trim() && deliveryAddress.trim() && selectedZone);
  const [quote, setQuote] = useState<{ scope: string; value: C3Quote } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quoteRetry, setQuoteRetry] = useState(0);
  const submissionLock = useRef<string | null>(null);
  const confirmedTotal = useRef<number | null>(null);
  const confirmedCart = useRef<string | null>(null);
  const ownerRef = useRef(user?.id);
  const recoveryCheckedOwnerRef = useRef<string | null>(null);
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
    if (recoveryCheckedOwnerRef.current === owner && recoveryState?.owner === owner) return;
    recoveryCheckedOwnerRef.current = owner;
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
      } catch (cause) {
        recoveryCheckedOwnerRef.current = null;
        if (active) setRecoveryError({ owner, message: cause instanceof Error ? cause.message : "تعذر التحقق من المحاولة السابقة." });
      }
      finally { if (active) setRecovering(false); }
    })();
    return () => { active = false; };
  }, [user?.id, retrySync, recoveryState?.owner]));
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
  const catalogPricingSignature = JSON.stringify([
    items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return [item.productId, product?.price, product?.available];
    }),
    selectedOfferIds.map((id) => {
      const offer = offers.find((candidate) => candidate.id === id);
      return [id, offer?.updated_at, offer?.is_active, offer?.starts_at, offer?.ends_at];
    }),
  ]);
  const quoteScope = JSON.stringify([user?.id, selectedZoneId, items, selectedOfferIds, catalogPricingSignature, quoteRetry]);
  const validating = cartRefreshing || catalogRefreshing;
  const scopedQuote = quote?.scope === quoteScope ? quote.value : null;
  const validQuote = scopedQuote && !cartLoading && !validating && !quoting && !syncError ? scopedQuote : null;
  const total = scopedQuote?.total;
  const deliveryFee = scopedQuote?.delivery_fee;
  const confirmationTotal = total === undefined ? "بانتظار حساب الخادم" : formatCurrency(total, "SYP");
  useEffect(() => {
    let active = true;
    if (!user || !selectedZoneId || cartLoading || validating || syncError || itemCount === 0) return;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setQuoting(true); setQuoteError("");
      try {
        await flush();
        const value = await quoteC3Cart(selectedZoneId, user.id);
        if (active) setQuote({ scope: quoteScope, value });
      } catch { if (active) setQuoteError("تعذر حساب ملخص الطلب من الخادم. أعد المحاولة."); }
      finally { if (active) setQuoting(false); }
    })();
    return () => { active = false; };
  }, [quoteScope, user, selectedZoneId, cartLoading, validating, syncError, itemCount, flush, quoteRetry]);
  const cartPreviewItems = items.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return product ? [{ product, quantity: item.quantity }] : [];
  });
  const cartPreviewOffers = selectedOfferIds.flatMap((id) => {
    const offer = offers.find((candidate) => candidate.id === id);
    return offer ? [offer] : [];
  });
  const cartStoreIds = [...new Set([
    ...cartPreviewItems.map(({ product }) => product.storeId),
    ...cartPreviewOffers.map((offer) => offer.store_id),
  ])];
  const cartStoreNames = cartStoreIds.map((storeId) =>
    stores.find((store) => store.id === storeId)?.name ?? "متجر",
  );

  const clearSavedAddressSelection = useCallback(() => {
    selectedAddressIdRef.current = null;
    setSelectedAddressId(null);
  }, []);

  const setDifferentRecipientMode = useCallback((enabled: boolean) => {
    differentRecipientRef.current = enabled;
    setDifferentRecipient(enabled);
  }, []);

  const applySavedAddress = useCallback((address: CustomerAddress, preserveRecipient = false) => {
    selectedAddressIdRef.current = address.id;
    setSelectedAddressId(address.id);
    if (!preserveRecipient || !differentRecipientRef.current) {
      setRecipientName(address.recipient_name);
      setContactPhone(address.contact_phone);
      setDifferentRecipientMode(false);
    }
    setDeliveryAddress(address.delivery_address);
    setManualAddressMode(false);
    if (address.zone?.is_active) {
      setSelectedZoneId(address.delivery_zone_id);
      setError(null);
    } else {
      setSelectedZoneId("");
      setError("منطقة هذا العنوان لم تعد متاحة. اختر منطقة توصيل فعالة.");
    }
  }, [setDifferentRecipientMode]);

  const refreshSavedAddresses = useCallback(async (isActive: () => boolean) => {
    try {
      const addresses = await getCustomerAddresses();
      if (!isActive()) return;

      setSavedAddresses(addresses);
      const selectedId = returningAddressId ?? selectedAddressIdRef.current;
      if (!selectedId) {
        const defaultAddress = addresses.find((address) => address.is_default && address.zone?.is_active);
        if (defaultAddress) applySavedAddress(defaultAddress);
        return;
      }

      const selectedAddress = addresses.find((address) => address.id === selectedId);
      if (selectedAddress) {
        applySavedAddress(selectedAddress, true);
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
  }, [applySavedAddress, clearSavedAddressSelection, returningAddressId]);

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
        const returnedAddress = initialReturningAddressId ? addresses.find(address => address.id === initialReturningAddressId) : undefined;
        const defaultAddress = returnedAddress ?? addresses.find((address) => address.is_default);
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
  }, [ownerId, initialAccountPhone, initialReturningAddressId]);

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
    if (!deliveryDetailsReady) {
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

      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {(recovering || (recovery && recovery.kind !== "none") || recoveryMessage) ? <Section title="محاولة الطلب السابقة">
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
        <Section title="مراجعة الطلب">
          <View style={[styles.orderOverview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.overviewStats}>
              <OverviewStat icon="bag-handle-outline" value={`${itemCount}`} label="عنصر" />
              <OverviewStat icon="storefront-outline" value={`${cartStoreNames.length}`} label="متجر" />
              <OverviewStat icon="pricetag-outline" value={`${cartPreviewOffers.length}`} label="عرض" />
            </View>
            <View style={[styles.overviewFooter, { borderTopColor: colors.border }]}>
              <Text style={[styles.cartPreviewText, { color: colors.textSecondary }]}>يتحقق الخادم من الأسعار قبل إنشاء الطلب.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push("/cart")} style={styles.reviewCartAction}>
                <AppIcon name="create-outline" size={17} color={colors.primary} />
                <Text style={[styles.selectorActionText, { color: colors.primary }]}>عودة للسلة</Text>
              </Pressable>
            </View>
          </View>
        </Section>

        <Section title="عنوان التوصيل">
          <View style={[styles.addressPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {loadingDetails ? <ActivityIndicator color={colors.primary} /> : selectedAddress ? (
              <>
                <View style={styles.addressPanelHeader}>
                  <View style={[styles.addressIcon, { backgroundColor: colors.primaryLight }]}>
                    <AppIcon name="location-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.addressPanelInfo}>
                    <View style={styles.addressTitleLine}>
                      <Text numberOfLines={1} style={[styles.addressTitle, { color: colors.text }]}>{selectedAddress.title || "عنوان محفوظ"}</Text>
                      <View style={[styles.selectedMark, { backgroundColor: colors.primaryLight }]}>
                        <AppIcon name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={[styles.selectedMarkText, { color: colors.success }]}>إفتراضي </Text>
                      </View>
                    </View>
                    <Text numberOfLines={1} style={[styles.addressZone, { color: colors.textSecondary }]}>{selectedAddress.zone?.name ?? selectedZone?.name ?? "منطقة التوصيل"}</Text>
                    <Text numberOfLines={2} style={[styles.addressDetails, { color: colors.textSecondary }]}>{selectedAddress.delivery_address}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => savedAddresses.length > 1 ? setShowAddressChoices((current) => !current) : router.push({ pathname: "/addresses", params: { returnTo: "/checkout" } })}
                    style={styles.addressChangeAction}
                  >
                    <Text style={[styles.addressChangeText, { color: colors.primary }]}>تغيير العنوان</Text>
                  </Pressable>
                </View>

                {showAddressChoices ? (
                  <View style={[styles.addressChoices, { borderTopColor: colors.border }]}>
                    {savedAddresses.map((address) => {
                      const selected = selectedAddressId === address.id;
                      return (
                        <Pressable
                          key={address.id}
                          onPress={() => { selectSavedAddress(address); setShowAddressChoices(false); }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          style={styles.addressChoiceRow}
                        >
                          <AppIcon name={selected ? "checkmark-circle" : "ellipse-outline"} size={20} color={selected ? colors.primary : colors.textMuted} />
                          <View style={styles.addressPanelInfo}>
                            <Text style={[styles.optionTitle, { color: colors.text }]}>{address.title || "عنوان محفوظ"}</Text>
                            <Text numberOfLines={1} style={[styles.optionText, { color: colors.textSecondary }]}>{address.delivery_address}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/addresses", params: { returnTo: "/checkout" } })} style={styles.manageAddressesAction}>
                      <AppIcon name="settings-outline" size={17} color={colors.primary} />
                      <Text style={[styles.selectorActionText, { color: colors.primary }]}>إدارة العناوين</Text>
                    </Pressable>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: differentRecipient }}
                  onPress={() => {
                    const enabled = !differentRecipient;
                    setDifferentRecipientMode(enabled);
                    if (!enabled) {
                      setRecipientName(selectedAddress.recipient_name);
                      setContactPhone(selectedAddress.contact_phone);
                    }
                  }}
                  style={[styles.recipientToggle, { borderTopColor: colors.border }]}
                >
                  <AppIcon name={differentRecipient ? "checkbox" : "square-outline"} size={20} color={differentRecipient ? colors.primary : colors.textMuted} />
                  <Text style={[styles.recipientToggleText, { color: colors.text }]}>مستلم مختلف لهذا الطلب</Text>
                </Pressable>
                {differentRecipient ? (
                  <View style={styles.recipientFields}>
                    <AppTextField label="اسم المستلم" value={recipientName} onChangeText={setRecipientName} autoCapitalize="words" maxLength={120} />
                    <AppTextField label="رقم الهاتف" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" maxLength={32} />
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.addressEmptyCompact}>
                <View style={[styles.addressIcon, { backgroundColor: colors.primaryLight }]}>
                  <AppIcon name="location-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.addressPanelInfo}>
                  <Text style={[styles.addressTitle, { color: colors.text }]}>لا يوجد عنوان محدد</Text>
                  <Text style={[styles.addressDetails, { color: colors.textSecondary }]}>أضف عنوانًا لاختيار المنطقة وحساب رسوم التوصيل.</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/addresses", params: { returnTo: "/checkout" } })} style={styles.addressChangeAction}>
                  <Text style={[styles.addressChangeText, { color: colors.primary }]}>إضافة عنوان</Text>
                </Pressable>
              </View>
            )}
          </View>

          {!selectedAddress && manualAddressMode ? (
            <View style={styles.manualAddressFields}>
              <AppTextField label="اسم المستلم" value={recipientName} onChangeText={setRecipientName} autoCapitalize="words" maxLength={120} />
              <AppTextField label="رقم الهاتف" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" maxLength={32} />
              <AppTextField label="العنوان بالتفصيل" value={deliveryAddress} onChangeText={setDeliveryAddress} placeholder="الحي، الشارع، أقرب علامة مميزة" multiline maxLength={1000} />
              <Pressable onPress={() => setShowZoneChoices((current) => !current)} style={styles.selectorAction} accessibilityRole="button">
                <AppIcon name={showZoneChoices ? "chevron-up-outline" : "chevron-down-outline"} size={17} color={colors.primary} />
                <Text style={[styles.selectorActionText, { color: colors.primary }]}>{selectedZone?.name ?? "اختيار منطقة التوصيل"}</Text>
              </Pressable>
              {showZoneChoices ? <View style={styles.choiceList}>{deliveryZones.map((zone) => (
                <Pressable key={zone.id} onPress={() => { setSelectedZoneId(zone.id); setShowZoneChoices(false); }} accessibilityRole="radio" accessibilityState={{ selected: selectedZoneId === zone.id }} style={[styles.optionCard, { borderColor: selectedZoneId === zone.id ? colors.primary : colors.border, backgroundColor: colors.surface }]}>
                  <View style={styles.optionInfo}><Text style={[styles.optionTitle, { color: colors.text }]}>{zone.name}</Text><Text style={[styles.optionText, { color: colors.textSecondary }]}>الرسم الأساسي: {formatCurrency(zone.fixed_fee, "SYP")}</Text></View>
                  <AppIcon name={selectedZoneId === zone.id ? "checkmark-circle" : "ellipse-outline"} size={20} color={selectedZoneId === zone.id ? colors.primary : colors.textMuted} />
                </Pressable>
              ))}</View> : null}
            </View>
          ) : null}
          {!selectedAddress && !loadingDetails ? (
            <Pressable accessibilityRole="button" onPress={() => setManualAddressMode((current) => !current)} style={styles.manualAddressAction}>
              <AppIcon name="create-outline" size={17} color={colors.primary} />
              <Text style={[styles.selectorActionText, { color: colors.primary }]}>{manualAddressMode ? "إخفاء الإدخال المؤقت" : "إدخال عنوان لهذا الطلب فقط"}</Text>
            </Pressable>
          ) : null}
          <AppTextField
            label="ملاحظة للطلب (اختياري)"
            value={customerNote}
            onChangeText={setCustomerNote}
            multiline
            maxLength={1500}
          />
        </Section>

        <Section title="ملخص الطلب">
          <View style={[styles.priceSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.summaryIntro}>
              <Text style={[styles.summaryIntroText, { color: colors.textSecondary }]}>ملخص خادمي نهائي بعد الخصومات المعتمدة</Text>
              {(quoting || validating) ? (
                <View style={styles.inlineStatus}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.inlineStatusText, { color: colors.textMuted }]}>جارٍ التحديث…</Text>
                </View>
              ) : null}
            </View>
            <SummaryRow
              label="نطاق الطلب"
              value={`${itemCount} عنصر · ${cartStoreNames.length} متجر`}
            />

            <SummaryRow
              label="المنتجات والعروض"
              value={scopedQuote ? formatCurrency(scopedQuote.items_amount, "SYP") : "بانتظار حساب الخادم"}
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
                      color: colors.text,
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
            <View style={[styles.paymentSummary, { borderTopColor: colors.border }]}>
              <View style={[styles.paymentSummaryIcon, { backgroundColor: colors.primaryLight }]}>
                <AppIcon name="cash-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.paymentSummaryLabel, { color: colors.textSecondary }]}>طريقة الدفع</Text>
              <Text style={[styles.paymentSummaryValue, { color: colors.text }]}>الدفع عند الاستلام</Text>
            </View>
          </View>
        </Section>

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
      </KeyboardAwareScrollView>

      <View style={[styles.checkoutBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(Spacing.three, insets.bottom) }]}>
        <View style={styles.checkoutBarTotal}>
          <Text style={[styles.checkoutBarLabel, { color: colors.textMuted }]}>الإجمالي</Text>
          <Text numberOfLines={1} style={[styles.checkoutBarValue, { color: colors.primary }]}>{confirmationTotal}</Text>
        </View>
        <Pressable
          disabled={!deliveryDetailsReady || !recoveryReady || !validQuote || loadingDetails || submitting || cartLoading || validating || catalogLoading || Boolean(catalogError) || hasUnavailableItems || itemCount === 0 || Boolean(syncError)}
          onPress={handleConfirmOrder}
          style={({ pressed }) => [styles.confirmButton, { backgroundColor: colors.primary }, pressed && styles.pressed, (!deliveryDetailsReady || !recoveryReady || !validQuote || loadingDetails || submitting || cartLoading || validating || catalogLoading || Boolean(catalogError) || hasUnavailableItems || itemCount === 0 || Boolean(syncError)) && { opacity: 0.55 }]}
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

function OverviewStat({
  icon,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof AppIcon>["name"];
  value: string;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.overviewStat}>
      <View style={[styles.overviewIcon, { backgroundColor: colors.primaryLight }]}>
        <AppIcon name={icon} size={19} color={colors.primary} />
      </View>
      <Text style={[styles.overviewValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>{label}</Text>
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
  orderOverview: { borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden", paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  overviewStats: { flexDirection: "row-reverse", gap: Spacing.two, justifyContent: "space-between" },
  overviewStat: { alignItems: "center", flex: 1, gap: Spacing.half, minWidth: 0 },
  overviewIcon: { alignItems: "center", borderRadius: Radius.md, height: 36, justifyContent: "center", width: 36 },
  overviewValue: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "center" },
  overviewLabel: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "center" },
  overviewFooter: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row-reverse", gap: Spacing.two, marginTop: Spacing.three, paddingVertical: Spacing.two },
  reviewCartAction: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.one, minHeight: 40, paddingHorizontal: Spacing.one },
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
  manualAddressAction: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row-reverse", gap: Spacing.one, minHeight: 40, paddingHorizontal: Spacing.one },
  manualAddressFields: { gap: Spacing.two },
  inlineStatus: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two, minHeight: 28 },
  inlineStatusText: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  addressPanel: { borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden", padding: Spacing.three },
  addressPanelHeader: { alignItems: "flex-start", flexDirection: "row-reverse", gap: Spacing.two },
  addressIcon: { alignItems: "center", borderRadius: Radius.md, height: 38, justifyContent: "center", width: 38 },
  addressPanelInfo: { flex: 1, minWidth: 0 },
  addressTitleLine: { alignItems: "center", flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.one },
  addressTitle: { flexShrink: 1, fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
  addressZone: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs, marginTop: Spacing.half, textAlign: "right" },
  addressDetails: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 21, marginTop: Spacing.half, textAlign: "right" },
  selectedMark: { alignItems: "center", borderRadius: Radius.full, flexDirection: "row-reverse", gap: 3, paddingHorizontal: Spacing.one, paddingVertical: 3 },
  selectedMarkText: { fontFamily: Fonts.semiBold, fontSize: 10 },
  addressChangeAction: { alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: Spacing.one },
  addressChangeText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs, textAlign: "center" },
  addressChoices: { borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.one, marginTop: Spacing.three, paddingTop: Spacing.two },
  addressChoiceRow: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two, minHeight: 48, paddingVertical: Spacing.one },
  manageAddressesAction: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row-reverse", gap: Spacing.one, minHeight: 40 },
  recipientToggle: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row-reverse", gap: Spacing.two, marginTop: Spacing.three, minHeight: 44, paddingTop: Spacing.two },
  recipientToggleText: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" },
  recipientFields: { gap: Spacing.two, paddingTop: Spacing.two },
  addressEmptyCompact: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two },

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
  summaryIntro: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two, justifyContent: "space-between", marginBottom: Spacing.one },
  summaryIntroText: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },

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
    fontSize: FontSizes.lg,
  },

  totalCurrency: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
  },
  paymentSummary: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row-reverse", gap: Spacing.two, marginTop: Spacing.one, paddingTop: Spacing.three },
  paymentSummaryIcon: { alignItems: "center", borderRadius: Radius.sm, height: 32, justifyContent: "center", width: 32 },
  paymentSummaryLabel: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" },
  paymentSummaryValue: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "left" },

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
