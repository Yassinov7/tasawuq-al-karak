import { formatSyp, formatSypNumber } from "@/lib/money";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";
import type { Product } from "@/types/catalog";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { type CartItem, useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";
import { calculateCustomerOffer, describeCustomerOffer } from "@/lib/customer-offers";
import type { CustomerOffer } from "@/lib/customer-offers";
import { useCustomerStoreLogos } from "@/hooks/useCustomerStoreLogos";

type DeleteModal =
  | {
      type: "item";
      productId: string;
      productName: string;
    }
  | {
      type: "offer";
      offerId: string;
      offerTitle: string;
    }
  | {
      type: "clear";
    }
  | null;

export default function CartScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { products, offers, loading: catalogLoading, refreshing: catalogRefreshing, error: catalogError, offerRead, refresh, revalidate: revalidateCatalog } = useCustomerCatalog();

  const {
    scope: cartScope,
    items,
    selectedOfferIds,
    itemCount,
    subtotal,

    loading,
    refreshing: cartRefreshing,
    syncError,
    increaseItem,
    decreaseItem,
    removeItem,
    removeOffer,
    clearCart,
    retrySync,
    revalidate: revalidateCart,
  } = useCart();
  useFocusEffect(useCallback(() => { void Promise.all([revalidateCart(), revalidateCatalog()]); }, [revalidateCart, revalidateCatalog]));

  const [deleteModal, setDeleteModal] = useState<DeleteModal>(null);
  const [priceNotice, setPriceNotice] = useState<{ scope: string | null; text: string } | null>(null);
  const verifiedPrices = useRef<{ scope: string | null; values: Map<string, number> } | null>(null);

  const cartProducts = items
    .map((item) => {
      const product = products.find(
        (productItem) => productItem.id === item.productId,
      );

      if (!product || !product.available) {
        return null;
      }

      return {
        item,
        product,
      };
    })
    .filter(
      (
        value,
      ): value is {
        item: (typeof items)[number];
        product: (typeof products)[number];
      } => Boolean(value),
    );
  const unavailableItems = !catalogLoading && !catalogError ? items.filter(
    (item) => !products.some((product) => product.id === item.productId && product.available),
  ) : [];
  const unresolvedItems = catalogLoading || catalogError ? items.filter(
    (item) => !products.some((product) => product.id === item.productId && product.available),
  ) : [];
  const cartOffers = selectedOfferIds.flatMap((offerId) => {
    const offer = offers.find((candidate) => candidate.id === offerId);
    return offer ? [offer] : [];
  });
  const unavailableOfferIds = offerRead === "ready" ? selectedOfferIds.filter(
    (offerId) => !offers.some((offer) => offer.id === offerId),
  ) : [];
  const unresolvedOfferIds = offerRead !== "ready" ? selectedOfferIds.filter(
    (offerId) => !offers.some((offer) => offer.id === offerId),
  ) : [];

  const storeIds = Array.from(
    new Set([
      ...cartProducts.map(({ product }) => product.storeId),
      ...cartOffers.map((offer) => offer.store_id),
    ]),
  );

  const storeCount = storeIds.length;
  const { logos } = useCustomerStoreLogos(storeIds, true, true);
  const isSharedCart = storeCount > 1;

  const total = subtotal;
  const hasCartRows = items.length > 0 || selectedOfferIds.length > 0;
  const validating = cartRefreshing || catalogRefreshing;
  const checkoutBlocked = loading || catalogLoading || validating || Boolean(syncError) || Boolean(catalogError) ||
    unavailableItems.length > 0 || unavailableOfferIds.length > 0 || unresolvedItems.length > 0 || unresolvedOfferIds.length > 0;
  const cartItemsByStore = cartProducts.reduce<Map<string, typeof cartProducts>>((groups, entry) => {
    const key = entry.product.storeId;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
    return groups;
  }, new Map());
  const cartOffersByStore = cartOffers.reduce<Map<string, CustomerOffer[]>>((groups, offer) => {
    groups.set(offer.store_id, [...(groups.get(offer.store_id) ?? []), offer]);
    return groups;
  }, new Map());
  useEffect(() => {
    if (catalogLoading || catalogRefreshing) return;
    const next = new Map(cartProducts.map(({ product }) => [product.id, product.price]));
    const previous = verifiedPrices.current?.scope === cartScope ? verifiedPrices.current.values : null;
    if (previous) {
      const changed = cartProducts.filter(({ product }) => previous.has(product.id) && previous.get(product.id) !== product.price);
      if (changed.length) setPriceNotice({ scope: cartScope, text: changed.length === 1 ? `تم تحديث سعر «${changed[0].product.name}» وفق السعر الحالي للمتجر.` : `تم تحديث أسعار ${changed.length} منتجات وفق الأسعار الحالية للمتاجر.` });
    }
    verifiedPrices.current = { scope: cartScope, values: next };
  }, [cartProducts, cartScope, catalogLoading, catalogRefreshing]);

  const handleClearCart = () => {
    if (items.length === 0 && selectedOfferIds.length === 0) {
      return;
    }

    setDeleteModal({
      type: "clear",
    });
  };

  const handleRemoveItem = (productId: string, productName: string) => {
    setDeleteModal({
      type: "item",
      productId,
      productName,
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteModal) {
      return;
    }

    if (deleteModal.type === "clear") {
      clearCart();
    } else if (deleteModal.type === "item") {
      removeItem(deleteModal.productId);
    } else {
      removeOffer(deleteModal.offerId);
    }

    setDeleteModal(null);
  };

  const handleDeleteCancel = () => {
    setDeleteModal(null);
  };

  const modalTitle = deleteModal?.type === "clear"
    ? "تفريغ السلة"
    : deleteModal?.type === "offer"
      ? "حذف العرض"
      : "حذف المنتج";

  const modalMessage = deleteModal?.type === "clear"
    ? "هل تريد حذف جميع المنتجات والعروض من السلة؟"
    : deleteModal?.type === "offer"
      ? `هل تريد حذف «${deleteModal.offerTitle}» من السلة؟`
      : `هل تريد حذف ${deleteModal?.productName ?? "هذا المنتج"} من السلة؟`;

  const modalConfirmText = deleteModal?.type === "clear" ? "تفريغ السلة" : "حذف";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="سلة التسوق" showBack cartCount={itemCount} mode="customer" />
      {validating && hasCartRows ? <View accessibilityLiveRegion="polite" style={styles.backgroundStatus}><View style={[styles.backgroundDot, { backgroundColor: colors.primary }]} /><Text style={[styles.backgroundText, { color: colors.textSecondary }]}>جارٍ التحقق من الأسعار والتوفر…</Text></View> : null}
      {catalogError && hasCartRows ? <View accessibilityLiveRegion="polite" style={styles.catalogError}><Text style={[styles.catalogErrorText, { color: colors.error }]}>تعذر التحقق من الأسعار والتوفر. بقيت محتويات السلة محفوظة.</Text><AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline" onPress={() => void refresh()} /></View> : null}
      {priceNotice?.scope === cartScope ? <Pressable accessibilityRole="button" accessibilityLabel="إخفاء إشعار تحديث السعر" onPress={() => setPriceNotice(null)} style={[styles.priceNotice, { backgroundColor: colors.surfaceSelected, borderColor: colors.primary }]}><Text style={[styles.priceNoticeText, { color: colors.text }]}>{priceNotice.text}</Text><AppIcon name="close-outline" size={17} color={colors.textSecondary} /></Pressable> : null}
      {syncError ? (
        <View style={{ alignItems: "center", gap: Spacing.two, padding: Spacing.three }}>
          <Text style={{ color: colors.error, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center" }}>{syncError}</Text>
          <AppButton title="إعادة تحميل السلة" variant="outline" onPress={() => void retrySync()} />
        </View>
      ) : loading ? (
        <Text style={{ color: colors.textSecondary, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center", padding: Spacing.three }}>
          جارٍ تحميل سلتك...
        </Text>
      ) : null}

      {(loading || catalogLoading) && !hasCartRows ? (
        <CartInitialSkeleton />
      ) : !hasCartRows ? (
        <EmptyCart onContinue={() => router.replace("/home")} />
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.summaryHeader}>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {itemCount} عنصر • {storeCount}{" "}
                {storeCount === 1 ? "متجر" : "متاجر"}
            </Text>

            <Pressable
              onPress={handleClearCart}
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="تفريغ السلة"
            >
              <AppIcon name="trash-outline" size={17} color={colors.error} />

              <Text
                style={[
                  styles.clearText,
                  {
                    color: colors.error,
                  },
                ]}
              >
                تفريغ السلة
              </Text>
            </Pressable>
          </View>

          <View style={styles.itemsList}>
            {unresolvedItems.map((item) => (
              <CartReadState key={item.productId} text={`جارٍ التحقق من المنتج والكمية ${item.quantity}…`} retry={refresh} />
            ))}
            {unavailableItems.map((item) => (
              <View
                key={item.productId}
                style={{
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: Spacing.three,
                  justifyContent: "space-between",
                  padding: Spacing.three,
                }}
              >
                <Text style={{ color: colors.textSecondary, flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" }}>
                  منتج غير متاح حاليًا · الكمية {item.quantity}
                </Text>
                <AppButton title="حذف" variant="outline" onPress={() => void removeItem(item.productId)} />
              </View>
            ))}
            {storeIds.map((storeId) => (
              <CartStoreGroup
                key={storeId}
                storeId={storeId}
                entries={cartItemsByStore.get(storeId) ?? []}
                offers={cartOffersByStore.get(storeId) ?? []}
                logo={logos.get(storeId)}
                isSharedCart={isSharedCart}
                onIncrease={increaseItem}
                onDecrease={decreaseItem}
                onRemove={handleRemoveItem}
                onRemoveOffer={(offer) => setDeleteModal({ type: "offer", offerId: offer.id, offerTitle: offer.title })}
              />
            ))}
            {unavailableOfferIds.map((offerId) => (
              <View
                key={offerId}
                style={{
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: Spacing.three,
                  justifyContent: "space-between",
                  padding: Spacing.three,
                }}
              >
                <Text style={{ color: colors.textSecondary, flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" }}>
                  عرض لم يعد متاحًا؛ احذفه من السلة للمتابعة.
                </Text>
                <AppButton
                  title="حذف العرض"
                  variant="outline"
                  onPress={() => setDeleteModal({ type: "offer", offerId, offerTitle: "هذا العرض" })}
                />
              </View>
            ))}
            {unresolvedOfferIds.map((offerId) => (
              <CartReadState key={offerId} text="تعذر التحقق من أهلية هذا العرض بعد. لم نحذفه من سلتك." retry={refresh} />
            ))}
          </View>
          {unavailableItems.length > 0 ? (
            <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: "center" }}>
              احذف المنتجات غير المتاحة قبل متابعة الطلب.
            </Text>
          ) : null}

        </ScrollView>
      )}

      {hasCartRows && !loading ? <View style={[styles.purchaseBar, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
        <View style={styles.purchaseTotal}>
          <Text style={[styles.purchaseLabel, { color: colors.textSecondary }]}>الإجمالي قبل التوصيل</Text>
          <Text style={[styles.purchaseAmount, { color: isSharedCart ? colors.accent : colors.primary }]}>{formatSypNumber(total)} <Text style={styles.purchaseCurrency}>ل.س</Text></Text>
        </View>
        <AppButton title="متابعة لإتمام الطلب" icon="arrow-back" disabled={checkoutBlocked} onPress={() => router.push("/checkout")} />
        {checkoutBlocked ? <Text accessibilityRole="alert" style={[styles.purchaseHint, { color: colors.textSecondary }]}>أكمل التحقق من العناصر والمزامنة قبل المتابعة.</Text> : null}
      </View> : null}

      <AppModal
        visible={deleteModal !== null}
        title={modalTitle}
        message={modalMessage}
        icon="trash-outline"
        confirmText={modalConfirmText}
        cancelText="إلغاء"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </View>
  );
}

type CartTypeCardProps = {
  isSharedCart: boolean;
  storeCount: number;
};

export function CartTypeCard({
  isSharedCart,
  storeCount,
}: CartTypeCardProps) {
  const { colors } = useTheme();

  if (isSharedCart) {
    return (
      <View
        style={[
          styles.sharedCartCard,
          {
            borderColor: colors.accent,
            backgroundColor: colors.accentLight,
          },
        ]}
      >
        <View
          style={[
            styles.sharedCartIcon,
            {
              backgroundColor: colors.surface,
            },
          ]}
        >
          <AppIcon name="git-merge-outline" size={24} color={colors.accent} />
        </View>

        <View style={styles.cartTypeInfo}>
          <View style={styles.cartTypeTitleRow}>
            <Text
              style={[
                styles.sharedCartTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              سلة مشتركة
            </Text>

            <View
              style={[
                styles.sharedBadge,
                {
                  backgroundColor: colors.accent,
                },
              ]}
            >
              <Text
                style={[
                  styles.sharedBadgeText,
                  {
                    color: colors.surface,
                  },
                ]}
              >
                {storeCount} متاجر
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.sharedCartText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            طلب واحد من عدة متاجر؛ يحسب التوصيل حسب المنطقة عند الإتمام.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.singleCartCard,
        {
          borderColor: colors.primary,
          backgroundColor: colors.primaryLight,
        },
      ]}
    >
      <View
        style={[
          styles.singleCartIcon,
          {
            backgroundColor: colors.surface,
          },
        ]}
      >
        <AppIcon name="storefront-outline" size={23} color={colors.primary} />
      </View>

      <View style={styles.cartTypeInfo}>
        <Text
          style={[
            styles.singleCartTitle,
            {
              color: colors.primaryDark,
            },
          ]}
        >
          طلب من متجر واحد
        </Text>

        <Text
          style={[
            styles.singleCartText,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          يحسب التوصيل حسب المنطقة عند إتمام الطلب.
        </Text>
      </View>
    </View>
  );
}

type SharedCartStoresProps = {
  storeIds: string[];
};

export function SharedCartStores({ storeIds }: SharedCartStoresProps) {
  const { colors } = useTheme();
  const { stores } = useCustomerCatalog();

  const sharedStores = storeIds
    .map((storeId) => stores.find((store) => store.id === storeId))
    .filter((store): store is (typeof stores)[number] => Boolean(store));

  return (
    <View
      style={[
        styles.sharedStoresCard,
        {
          borderColor: colors.accent,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={styles.sharedStoresHeader}>
        <Text
          style={[
            styles.sharedStoresTitle,
            {
              color: colors.text,
            },
          ]}
        >
          المتاجر المشاركة
        </Text>

        <AppIcon name="storefront-outline" size={18} color={colors.accent} />
      </View>

      <View style={styles.sharedStoresList}>
        {sharedStores.map((store, index) => (
          <View
            key={store.id}
            style={[
              styles.sharedStoreRow,
              {
                backgroundColor: colors.accentLight,
              },
            ]}
          >
            <View
              style={[
                styles.sharedStoreNumber,
                {
                  backgroundColor: colors.accent,
                },
              ]}
            >
              <Text
                style={[
                  styles.sharedStoreNumberText,
                  {
                    color: colors.surface,
                  },
                ]}
              >
                {index + 1}
              </Text>
            </View>

            <Text
              style={[
                styles.sharedStoreName,
                {
                  color: colors.text,
                },
              ]}
              numberOfLines={1}
            >
              {store.name}
            </Text>

            <View style={styles.sharedStoreMeta}>
              <AppIcon
                name="time-outline"
                size={13}
                color={colors.textSecondary}
              />

              <Text
                style={[
                  styles.sharedStoreMetaText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                {store.deliveryTime ?? "يحدد عند الطلب"}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

type CartItemCardProps = {
  product: Product;
  quantity: number;
  isSharedCart: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  separated?: boolean;
};

type CartStoreGroupProps = {
  storeId: string;
  entries: { item: CartItem; product: Product }[];
  offers: CustomerOffer[];
  logo?: { url: string; key: string };
  isSharedCart: boolean;
  onIncrease: (productId: string) => Promise<void>;
  onDecrease: (productId: string) => Promise<void>;
  onRemove: (productId: string, productName: string) => void;
  onRemoveOffer: (offer: CustomerOffer) => void;
};

function CartStoreGroup({ storeId, entries, offers, logo, isSharedCart, onIncrease, onDecrease, onRemove, onRemoveOffer }: CartStoreGroupProps) {
  const { colors } = useTheme();
  const { stores } = useCustomerCatalog();
  const storeName = stores.find((store) => store.id === storeId)?.name ?? "متجر";
  return (
    <View style={[styles.storeGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.storeGroupHeader}>
        <View style={[styles.storeGroupIcon, { backgroundColor: colors.primaryLight }]}><ShoppingCardImage uri={logo?.url} cacheKey={logo?.key} icon="storefront-outline" fit="contain" /></View>
        <Text style={[styles.storeGroupTitle, { color: colors.text }]} numberOfLines={1}>{storeName}</Text>
        <Text style={[styles.storeGroupCount, { color: colors.textMuted }]}>{entries.length + offers.length} عناصر</Text>
      </View>
      {entries.map(({ item, product }, index) => (
        <CartItemCard
          key={product.id}
          product={product}
          quantity={item.quantity}
          isSharedCart={isSharedCart}
          onIncrease={() => onIncrease(product.id)}
          onDecrease={() => onDecrease(product.id)}
          onRemove={() => onRemove(product.id, product.name)}
          separated={index > 0}
        />
      ))}
      {offers.map((offer, index) => <OfferCartCard key={offer.id} offer={offer} separated={entries.length > 0 || index > 0} onRemove={() => onRemoveOffer(offer)} />)}
    </View>
  );
}

function CartItemCard({
  product,
  quantity,
  isSharedCart,
  onIncrease,
  onDecrease,
  onRemove,
  separated = false,
}: CartItemCardProps) {
  const { colors } = useTheme();
  const [updating, setUpdating] = useState(false);

  const itemTotal = product.price * quantity;
  const image = product.media?.find((media) => media.type === "image")?.uri;
  const runUpdate = async (action: () => void | Promise<void>) => {
    if (updating) return;
    setUpdating(true);
    try {
      await action();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <View
      style={[
        styles.itemCard,
        separated && styles.invoiceSeparator,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={styles.itemTop}>
        <View style={[styles.itemVisual, { backgroundColor: colors.primaryLight }, isSharedCart && { backgroundColor: colors.accentLight }]}>
          <ShoppingCardImage uri={image} cacheKey={product.id} icon="cube-outline" />
        </View>

        <View style={styles.itemInfo}>
          <Text
            style={[
              styles.itemName,
              {
                color: colors.text,
              },
            ]}
            numberOfLines={2}
          >
            {product.name}
          </Text>

          <Text
            style={[
              styles.itemUnit,
              {
                color: colors.textMuted,
              },
            ]}
          >
            {formatSyp(product.price)} لكل {product.unit}
          </Text>
        </View>

        <Pressable
          disabled={updating}
          onPress={() => void runUpdate(onRemove)}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && styles.pressed,
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`حذف ${product.name}`}
        >
          <AppIcon
            name="close-circle-outline"
            size={21}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.itemBottom,
          {
            borderTopColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.quantityControl,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Pressable
            disabled={updating}
            onPress={() => void runUpdate(onIncrease)}
            style={({ pressed }) => [
              styles.quantityButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="زيادة الكمية"
          >
            <AppIcon name="add" size={16} color={colors.primary} />
          </Pressable>

          <View style={styles.quantityValue}>
            <Text style={[styles.quantity, { color: colors.text }]} numberOfLines={1}>{quantity} <Text style={[styles.quantityUnit, { color: colors.textSecondary }]}>{product.unit}</Text></Text>
          </View>

          <Pressable
            disabled={updating}
            onPress={() => quantity <= (product.minimumQuantity ?? 1) ? onRemove() : void runUpdate(onDecrease)}
            style={({ pressed }) => [
              styles.quantityButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="إنقاص الكمية"
          >
            <AppIcon name="remove" size={16} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.itemPrice}>
          <Text
            style={[
              styles.itemTotal,
              {
                color: colors.primary,
              },
              isSharedCart && {
                color: colors.accent,
              },
            ]}
          >
            {formatSypNumber(itemTotal)}
          </Text>

          <Text
            style={[
              styles.itemCurrency,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {"ل.س"}
          </Text>
        </View>
      </View>
    </View>
  );
}

type OfferCartCardProps = {
  offer: CustomerOffer;
  onRemove: () => void;
  separated?: boolean;
};

function OfferCartCard({ offer, onRemove, separated = false }: OfferCartCardProps) {
  const { colors } = useTheme();
  const calculation = calculateCustomerOffer(offer);
  const currencyLabel = "ل.س";
  const offerType = offer.offer_type === "bundle" ? "باقة" : offer.offer_type === "buy_x_get_y" ? "هدية" : "خصم";

  return (
    <View style={[styles.offerInvoiceRow, separated && styles.invoiceSeparator, { borderColor: colors.border }] }>
      <View style={{ alignItems: "flex-start", flexDirection: "row-reverse", gap: Spacing.two }}>
        <View style={{ flex: 1, gap: Spacing.one }}>
          <Text style={{ color: colors.accent, fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "right" }}>{offerType}</Text>
          <Text style={{ color: colors.text, fontFamily: Fonts.bold, fontSize: FontSizes.sm, textAlign: "right" }}>{offer.title}</Text>
          <Text style={{ color: colors.warningForeground, fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "right" }}>
            {describeCustomerOffer(offer)}
          </Text>
        </View>
        <View style={styles.offerActions}>
          <AppIcon name={offer.offer_type === "bundle" ? "layers-outline" : offer.offer_type === "buy_x_get_y" ? "gift-outline" : "pricetag-outline"} size={18} color={colors.accent} />
          <Pressable accessibilityRole="button" accessibilityLabel={`إزالة عرض ${offer.title}`} hitSlop={8} onPress={onRemove} style={styles.offerRemove}><AppIcon name="trash-outline" size={18} color={colors.textMuted} /></Pressable>
        </View>
      </View>

      <View
        style={{
          backgroundColor: colors.surfaceSecondary,
          borderRadius: Radius.md,
          gap: 4,
          padding: Spacing.two,
        }}
      >
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: Fonts.medium,
            fontSize: FontSizes.xs,
            textAlign: "right",
          }}
        >
          المحتويات
        </Text>
        {calculation.items.slice(0, 2).map((item) => (
          <View
            key={item.id}
            style={{
              alignItems: "center",
              flexDirection: "row-reverse",
              gap: Spacing.two,
            }}
          >
            <AppIcon
              name={item.itemRole === "reward" ? "gift-outline" : "checkmark-circle-outline"}
              size={16}
              color={item.itemRole === "reward" ? colors.accent : colors.primary}
            />
            <Text
              style={{
                color: colors.text,
                flex: 1,
                fontFamily: Fonts.regular,
                fontSize: FontSizes.sm,
                textAlign: "right",
              }}
            >
              {item.product.name} · {item.quantity} {item.product.unit}
              {item.itemRole === "reward" ? " (هدية)" : ""}
            </Text>
          </View>
        ))}
        {calculation.items.length > 2 ? <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }}>+ {calculation.items.length - 2} عناصر أخرى</Text> : null}
      </View>

      <View style={{ borderTopColor: colors.border, borderTopWidth: 1, gap: Spacing.one, paddingTop: Spacing.two }}>
        <View style={{ alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }}>
          <Text style={{ color: colors.text, fontFamily: Fonts.semiBold }}>سعر العرض كاملًا</Text>
          <Text style={{ color: colors.primary, fontFamily: Fonts.bold, fontSize: FontSizes.md }}>
            {formatSypNumber(calculation.finalTotal)} {currencyLabel}
          </Text>
        </View>
        {calculation.originalTotal > calculation.finalTotal ? (
          <View style={{ alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }}>
            <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, fontSize: FontSizes.xs }}>وفرت</Text>
            <Text style={{ color: colors.success, fontFamily: Fonts.medium, fontSize: FontSizes.xs }}>
              {formatSypNumber((calculation.originalTotal - calculation.finalTotal))} {currencyLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type DeliveryCardProps = {
  isSharedCart: boolean;
};

export function DeliveryCard({ isSharedCart }: DeliveryCardProps) {
  const { colors } = useTheme();

  const title = isSharedCart ? "توصيل السلة المشتركة" : "توصيل الطلب";

  const text = "تظهر رسوم التوصيل النهائية بعد اختيار عنوان ومنطقة التوصيل.";

  return (
    <View
      style={[
        styles.deliveryCard,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        isSharedCart && {
          borderColor: colors.accent,
          backgroundColor: colors.accentLight,
        },
      ]}
    >
      <View
        style={[
          styles.deliveryIcon,
          {
            backgroundColor: colors.primaryLight,
          },
          isSharedCart && {
            backgroundColor: colors.surface,
          },
        ]}
      >
        <AppIcon
          name={isSharedCart ? "git-merge-outline" : "bicycle-outline"}
          size={23}
          color={isSharedCart ? colors.accent : colors.primary}
        />
      </View>

      <View style={styles.deliveryInfo}>
        <Text
          style={[
            styles.deliveryTitle,
            {
              color: colors.text,
            },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.deliveryText,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          {text}
        </Text>
      </View>

      <Text
        style={[
          styles.deliveryAmount,
          {
            color: colors.primary,
          },
          isSharedCart && {
            color: colors.accent,
          },
        ]}
      >
        حسب المنطقة
      </Text>
    </View>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

export function SummaryRow({ label, value }: SummaryRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          {
            color: colors.textSecondary,
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

function CartReadState({ text, retry }: { text: string; retry: () => Promise<void> }) {
  const { colors } = useTheme();
  return <View style={[styles.readState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text style={[styles.readStateText, { color: colors.textSecondary }]}>{text}</Text>
    <AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline" onPress={() => void retry()} />
  </View>;
}

function CartInitialSkeleton() {
  const { colors } = useTheme();
  return <View accessibilityLabel="جارٍ تحميل سلة التسوق" style={styles.skeletonWrap}>
    {[0, 1].map(group => <View key={group} style={[styles.skeletonGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.skeletonHeader, { backgroundColor: colors.surfaceSecondary }]} />
      {[0, 1].map(row => <View key={row} style={[styles.skeletonRow, row > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
        <View style={[styles.skeletonImage, { backgroundColor: colors.surfaceSecondary }]} />
        <View style={styles.skeletonLines}><View style={[styles.skeletonLineWide, { backgroundColor: colors.surfaceSecondary }]} /><View style={[styles.skeletonLine, { backgroundColor: colors.surfaceSecondary }]} /></View>
      </View>)}
    </View>)}
  </View>;
}

type EmptyCartProps = {
  onContinue: () => void;
};

function EmptyCart({ onContinue }: EmptyCartProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon name="cart-outline" size={55} color={colors.primary} />
      </View>

      <Text
        style={[
          styles.emptyTitle,
          {
            color: colors.text,
          },
        ]}
      >
        السلة فارغة
      </Text>

      <Text
        style={[
          styles.emptyText,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        لم تضف أي منتجات بعد. تصفح المتاجر واختر المنتجات التي تريدها.
      </Text>

      <Pressable
        onPress={onContinue}
        style={({ pressed }) => [
          styles.browseButton,
          {
            backgroundColor: colors.primary,
          },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="تصفح المتاجر"
      >
        <AppIcon name="storefront-outline" size={20} color={colors.surface} />

        <Text
          style={[
            styles.browseText,
            {
              color: colors.surface,
            },
          ]}
        >
          تصفح المتاجر
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: { flex: 1, minHeight: 0 },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
  },

  summaryHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.four,
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
    textAlign: "right",
  },

  subtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  clearButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },

  clearText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  singleCartCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  singleCartIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  cartTypeInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  singleCartTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  singleCartText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    textAlign: "right",
  },

  singleCartDelivery: {
    marginTop: 3,
    fontFamily: Fonts.medium,
    fontSize: 10,
    lineHeight: 18,
    textAlign: "right",
  },

  sharedCartCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.three,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderRadius: Radius.xl,
  },

  sharedCartIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  cartTypeTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  sharedCartTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  sharedBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },

  sharedBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 9,
  },

  sharedCartText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    textAlign: "right",
  },

  sharedCartDelivery: {
    marginTop: 4,
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    lineHeight: 18,
    textAlign: "right",
  },

  sharedStoresCard: {
    marginBottom: Spacing.four,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  sharedStoresHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  sharedStoresTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  sharedStoresList: {
    gap: Spacing.two,
  },

  sharedStoreRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
  },

  sharedStoreNumber: {
    width: 25,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  sharedStoreNumberText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
  },

  sharedStoreName: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  sharedStoreMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
  },

  sharedStoreMetaText: {
    fontFamily: Fonts.regular,
    fontSize: 9,
  },

  itemsList: {
    gap: Spacing.three,
  },

  itemCard: {
    padding: Spacing.three,
    borderWidth: 0,
    borderRadius: 0,
  },
  invoiceSeparator: { borderTopWidth: StyleSheet.hairlineWidth },
  offerInvoiceRow: { borderRadius: 0, borderWidth: 0, gap: Spacing.three, padding: Spacing.three },
  storeGroup: { borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden" },
  storeGroupHeader: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two, padding: Spacing.three },
  storeGroupIcon: { alignItems: "center", borderRadius: Radius.md, height: 38, justifyContent: "center", overflow: "hidden", position: "relative", width: 38 },
  storeGroupTitle: { flex: 1, fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  storeGroupCount: { fontFamily: Fonts.regular, fontSize: FontSizes.xs },

  itemTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
  },

  itemVisual: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },
  itemImage: {
    borderRadius: Radius.md,
    height: "100%",
    width: "100%",
  },

  itemInfo: {
    flex: 1,
    marginHorizontal: Spacing.three,
    alignItems: "flex-end",
  },

  itemName: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    lineHeight: 21,
    textAlign: "right",
  },

  storeName: {
    marginTop: 3,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  itemUnit: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  removeButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  itemBottom: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.one,
    paddingTop: 0,
    borderTopWidth: 0,
  },

  quantityControl: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 36,
    borderWidth: 1,
    borderRadius: Radius.md,
  },

  quantityButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  quantity: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },
  quantityValue: { alignItems: "center", justifyContent: "center", minWidth: 58, paddingHorizontal: Spacing.one },
  quantityUnit: { fontFamily: Fonts.regular, fontSize: FontSizes.xs },

  itemPrice: {
    alignItems: "flex-end",
    flexDirection: "row-reverse",
    gap: 3,
  },

  itemTotal: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  itemCurrency: {
    fontFamily: Fonts.medium,
    fontSize: 9,
  },

  deliveryCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  deliveryIcon: {
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  deliveryInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  deliveryTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  deliveryText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    textAlign: "right",
  },

  deliveryAmount: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  sharedDeliveryAmount: {
    maxWidth: 85,
  },

  totalCard: {
    marginTop: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },

  totalTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
    marginBottom: Spacing.three,
  },

  summaryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.two,
  },

  summaryLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  summaryValue: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  totalDivider: {
    height: 1,
    marginVertical: Spacing.three,
  },

  grandTotalRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  grandTotalLabel: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  grandTotalPrice: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 4,
  },

  grandTotalAmount: {
    fontFamily: Fonts.bold,
    fontSize: 23,
  },

  grandTotalCurrency: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
  },

  checkoutButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 55,
    marginTop: Spacing.four,
    borderRadius: Radius.lg,
  },

  checkoutText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },
  purchaseBar: { borderTopWidth: 1, gap: Spacing.two, paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  purchaseTotal: { alignItems: "center", flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: Spacing.one },
  purchaseLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right" },
  purchaseAmount: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, textAlign: "right" },
  purchaseCurrency: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs },
  purchaseHint: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "center" },
  readState: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, justifyContent: "space-between", padding: Spacing.three },
  readStateText: { flex: 1, flexBasis: 180, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" },

  note: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "center",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.six,
  },

  emptyIcon: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  emptyTitle: {
    marginTop: Spacing.five,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
  },

  emptyText: {
    maxWidth: 320,
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    textAlign: "center",
  },

  browseButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 50,
    marginTop: Spacing.five,
    paddingHorizontal: Spacing.six,
    borderRadius: Radius.lg,
  },

  browseText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  pressed: {
    opacity: 0.72,
  },
  offerActions: { alignItems: "center", gap: Spacing.two },
  offerRemove: { alignItems: "center", height: 32, justifyContent: "center", width: 32 },
  backgroundStatus: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.one, justifyContent: "center", paddingHorizontal: Spacing.four, paddingVertical: Spacing.one },
  backgroundDot: { borderRadius: Radius.full, height: 6, width: 6 },
  backgroundText: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  catalogError: { alignItems: "center", flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, justifyContent: "center", paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  catalogErrorText: { flex: 1, flexBasis: 200, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  priceNotice: { alignItems: "center", borderRadius: Radius.md, borderWidth: 1, flexDirection: "row-reverse", gap: Spacing.two, marginHorizontal: Spacing.four, marginTop: Spacing.two, padding: Spacing.two },
  priceNoticeText: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "right" },
  skeletonWrap: { flex: 1, gap: Spacing.three, padding: Spacing.four },
  skeletonGroup: { borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden" },
  skeletonHeader: { borderRadius: Radius.sm, height: 18, margin: Spacing.three, width: "45%" },
  skeletonRow: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.three, padding: Spacing.three },
  skeletonImage: { borderRadius: Radius.md, height: 54, width: 54 },
  skeletonLines: { flex: 1, gap: Spacing.two },
  skeletonLineWide: { borderRadius: Radius.sm, height: 12, width: "75%" },
  skeletonLine: { borderRadius: Radius.sm, height: 10, width: "45%" },
});
