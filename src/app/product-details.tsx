import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomerCatalogStatus } from "@/components/marketplace/CustomerCatalogStatus";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { ProductMediaGallery } from "@/components/marketplace/ProductMediaGallery";
import { RatingSummary } from "@/components/marketplace/RatingStars";
import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";
import { CustomerMarketHeader } from "@/components/navigation/CustomerMarketHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { ControlSizes, FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useTheme } from "@/context/ThemeContext";
import { useCustomerStoreLogos } from "@/hooks/useCustomerStoreLogos";
import { normalizeCatalogQuantity, snapCatalogQuantity } from "@/lib/catalog-quantity";
import { formatSyp } from "@/lib/money";

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, loading } = useAuth();
  const productId = typeof id === "string" ? id : undefined;
  const scope = JSON.stringify([productId, user?.id, user?.role, user?.app_metadata.role, user?.app_metadata.roles, loading]);
  return <ProductDetails key={scope} id={productId} />;
}

function ProductDetails({ id }: { id?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { categories, error, loading, products, stores, offers, productRatings } = useCustomerCatalog();
  const { itemCount, addItem, addOffer, getQuantity, selectedOfferIds, syncError } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [quantity, setQuantity] = useState(1);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addingOffer, setAddingOffer] = useState<string>();

  const product = products.find(item => item.id === id);
  const category = categories.find(item => item.id === product?.categoryId);
  const store = stores.find(item => item.id === product?.storeId);
  const productRating = product ? productRatings.get(product.id) : undefined;
  const matchingOffers = product ? offers.filter(offer => offer.items.some(item => item.product.id === product.id)) : [];
  const relatedProducts = product ? products.filter(item => item.id !== product.id && item.storeId === product.storeId &&
    item.categoryId === product.categoryId && item.available).slice(0, 6) : [];
  const { logos } = useCustomerStoreLogos(store ? [store.id] : [], true);
  const logo = store ? logos.get(store.id) : undefined;

  const goBack = () => router.canGoBack() ? router.back() : router.replace("/products");
  if (loading || error) return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <CustomerMarketHeader title="المنتج" showBack onBack={goBack} cartCount={itemCount} mode="shared" />
    <CustomerCatalogStatus />
  </View>;
  if (!product) return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <CustomerMarketHeader title="المنتج" showBack onBack={goBack} cartCount={itemCount} mode="shared" />
    <View style={styles.empty}><AppEmptyState icon="cube-outline" title="المنتج غير متاح"
      description="ربما أزيل المنتج أو لم يعد منشورًا." buttonText="رجوع" onButtonPress={goBack} /></View>
  </View>;

  const minimum = product.minimumQuantity ?? 1;
  const step = product.quantityStep ?? 1;
  const selectedQuantity = snapCatalogQuantity(quantity, minimum, step);
  const lineTotal = Math.round(product.price * selectedQuantity * 100) / 100;
  const cartQuantity = getQuantity(product.id);
  const mediaWidth = Math.min(760, width) - Spacing.four * 2;
  const mediaHeight = Math.max(210, Math.min(300, Math.round(mediaWidth * 0.68)));

  const addProduct = async () => {
    if (!product.available || adding) return;
    setAdding(true);
    try { await addItem(product, selectedQuantity); }
    finally { setAdding(false); }
  };
  const addSelectedOffer = async (offerId: string) => {
    if (addingOffer) return;
    setAddingOffer(offerId);
    try { await addOffer(offerId); }
    finally { setAddingOffer(undefined); }
  };

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <CustomerMarketHeader title="تفاصيل المنتج" screenTitle={product.name} showBack onBack={goBack}
      cartCount={itemCount} mode="shared" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ProductMediaGallery activeMediaIndex={activeMediaIndex} categoryIcon={category?.icon}
        categoryLabel={category?.name}
        favorite={isFavorite(product.id)} onSelectMedia={setActiveMediaIndex}
        onToggleFavorite={() => toggleFavorite(product.id)} product={product} width={mediaWidth} height={mediaHeight} />

      <View style={styles.summary}>
        <View style={styles.chips}>
          {!product.available ? <View style={[styles.chip, { backgroundColor: colors.errorSurface }]}>
            <AppIcon name="alert-circle-outline" size={15} color={colors.errorForeground} />
            <Text style={[styles.chipText, { color: colors.errorForeground }]}>غير متوفر</Text>
          </View> : null}
        </View>
        <Text accessibilityRole="header" style={[styles.name, { color: colors.text }]}>{product.name}</Text>
        <View style={[styles.priceBlock, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.price, { color: colors.primary }]}>{formatSyp(product.price)}</Text>
          {product.unit ? <Text style={[styles.unit, { color: colors.textSecondary }]}>لكل {product.unit}</Text> : null}
        </View>

        {store ? <Pressable accessibilityRole="link" accessibilityLabel={`فتح متجر ${store.name}`}
          onPress={() => router.push({ pathname: "/store-details", params: { id: store.id } })}
          style={({ pressed }) => [styles.store, { opacity: pressed ? 0.72 : 1 }]}>
          <View style={[styles.storeLogo, { backgroundColor: colors.primaryLight }]}>
            <ShoppingCardImage uri={logo?.url} cacheKey={logo?.key} restricted fit="contain" icon="storefront-outline" />
          </View>
          <View style={styles.storeCopy}><Text style={[styles.eyebrow, { color: colors.textMuted }]}>يباع لدى</Text>
            <Text style={[styles.storeName, { color: colors.text }]}>{store.name}</Text></View>
          <AppIcon name="chevron-back" size={18} color={colors.textMuted} />
        </Pressable> : null}

        {product.description.trim() ? <View style={styles.descriptionBlock}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>عن المنتج</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{product.description}</Text>
        </View> : null}

        <View style={[styles.facts, { borderColor: colors.border }]}>
          <View style={styles.factPair}>
            <Fact icon="cube-outline" label="وحدة البيع" value={product.unit || "غير محددة"} />
            <Fact icon="analytics-outline" label="أقل كمية" value={`${minimum.toLocaleString("ar-SY", { maximumFractionDigits: 3 })} ${product.unit}`} />
          </View>
          <View style={[styles.stepHint, { backgroundColor: colors.surfaceSecondary }]}>
            <AppIcon name="git-compare-outline" size={18} color={colors.primary} />
            <Text style={[styles.helper, { color: colors.textSecondary }]}>كل ضغطة: ±{step.toLocaleString("ar-SY", { maximumFractionDigits: 3 })} {product.unit}</Text>
          </View>
        </View>

        <Pressable accessibilityRole="link" accessibilityLabel="فتح تقييمات ومراجعات المنتج"
          onPress={() => router.push({ pathname: "/product-reviews", params: { id: product.id } })}
          style={({ pressed }) => [styles.reviewsLink, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}>
          <View style={styles.reviewsCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>التقييمات والمراجعات</Text>
            {productRating?.averageRating !== null && productRating?.ratingCount ? <RatingSummary
              averageRating={productRating.averageRating} ratingCount={productRating.ratingCount} />
              : <Text style={[styles.helper, { color: colors.textMuted }]}>لا توجد تقييمات بعد</Text>}
          </View>
          <AppIcon name="chevron-back" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {matchingOffers.length ? <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>عروض مرتبطة بالمنتج</Text>
        <Text style={[styles.helper, { color: colors.textMuted }]}>العرض لا يطبق تلقائيًا على المنتج؛ اختره لإضافته بسعره وشروطه.</Text>
        {matchingOffers.map(offer => {
          const added = selectedOfferIds.includes(offer.id);
          return <View key={offer.id} style={styles.offerItem}>
            <OfferCard offer={offer} expanded onPress={() => router.push({ pathname: "/offer-details", params: { id: offer.id } })} />
            <AppButton compact title={added ? "العرض في السلة" : "إضافة العرض إلى السلة"}
              icon={added ? "checkmark-circle-outline" : "cart-outline"} variant={added ? "secondary" : "outline"}
              disabled={added || Boolean(addingOffer)} loading={addingOffer === offer.id}
              onPress={() => void addSelectedOffer(offer.id)} />
          </View>;
        })}
      </View> : null}

      {relatedProducts.length ? <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>منتجات مشابهة</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.related}>
          {relatedProducts.map(item => <ProductCard key={item.id} product={item} showOffer
            onPress={() => router.push({ pathname: "/product-details", params: { id: item.id } })} />)}
        </ScrollView>
      </View> : null}

    </ScrollView>

    <View style={[styles.purchase, { backgroundColor: colors.surface, borderTopColor: colors.border,
      paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
      {syncError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{syncError}</Text> : null}
      {product.available ? <>
        <View style={styles.purchaseRow}>
          <View style={[styles.quantity, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <Pressable disabled={selectedQuantity <= minimum || adding} accessibilityRole="button" accessibilityLabel="تقليل الكمية"
              accessibilityState={{ disabled: selectedQuantity <= minimum || adding }} onPress={() => setQuantity(Math.max(minimum,
                normalizeCatalogQuantity(selectedQuantity - step)))} style={styles.quantityButton}>
              <AppIcon name="remove" size={20} color={selectedQuantity <= minimum ? colors.disabledForeground : colors.primary} />
            </Pressable>
            <View style={styles.quantityValue}><Text style={[styles.quantityNumber, { color: colors.text }]}>
              {selectedQuantity.toLocaleString("ar-SY", { maximumFractionDigits: 3 })}</Text>
              <Text style={[styles.quantityUnit, { color: colors.textMuted }]}>{product.unit}</Text></View>
            <Pressable disabled={adding} accessibilityRole="button" accessibilityLabel="زيادة الكمية"
              onPress={() => setQuantity(snapCatalogQuantity(selectedQuantity + step, minimum, step))} style={styles.quantityButton}>
              <AppIcon name="add" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.total}><Text style={[styles.eyebrow, { color: colors.textMuted }]}>الإجمالي</Text>
            <Text style={[styles.totalPrice, { color: colors.primary }]}>{formatSyp(lineTotal)}</Text></View>
        </View>
        <AppButton title="إضافة إلى السلة" icon="cart-outline" loading={adding} disabled={adding}
          onPress={() => void addProduct()} />
        {cartQuantity > 0 ? <Pressable accessibilityRole="link" accessibilityLabel="فتح السلة"
          onPress={() => router.push("/cart")} style={styles.cartStatus}>
          <Text style={[styles.cartStatusText, { color: colors.primary }]}>في السلة: {cartQuantity.toLocaleString("ar-SY", { maximumFractionDigits: 3 })}</Text>
          <AppIcon name="chevron-back" size={17} color={colors.primary} />
        </Pressable> : null}
      </> : <View style={styles.unavailable}>
        <AppIcon name="alert-circle-outline" size={22} color={colors.error} />
        <Text style={[styles.unavailableText, { color: colors.textSecondary }]}>هذا المنتج غير متوفر حاليًا ولا يمكن إضافته إلى السلة.</Text>
      </View>}
    </View>
  </View>;
}

function Fact({ icon, label, value }: { icon: React.ComponentProps<typeof AppIcon>["name"]; label: string; value: string }) {
  const { colors } = useTheme();
  return <View style={styles.fact}><AppIcon name={icon} size={18} color={colors.primary} />
    <View style={styles.factCopy}><Text style={[styles.eyebrow, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: colors.text }]}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, justifyContent: "center", padding: Spacing.four },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", direction: "rtl",
    paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.six, gap: Spacing.four },
  summary: { gap: Spacing.three },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: Spacing.one,
    borderRadius: Radius.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  chipText: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, ...RtlText },
  name: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, lineHeight: 34, ...RtlText },
  priceBlock: { borderRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: Spacing.two },
  price: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, ...RtlText },
  unit: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  store: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.one },
  storeLogo: { width: 40, height: 40, borderRadius: Radius.md, overflow: "hidden",
    alignItems: "center", justifyContent: "center" },
  storeCopy: { flex: 1, minWidth: 0, alignItems: "stretch" },
  eyebrow: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, ...RtlText },
  storeName: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
  descriptionBlock: { gap: Spacing.one },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md, ...RtlText },
  description: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 24, ...RtlText },
  facts: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: Spacing.two, gap: Spacing.two },
  factPair: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  fact: { minHeight: 42, flex: 1, minWidth: 130, flexDirection: "row", alignItems: "center", gap: Spacing.two },
  factCopy: { flex: 1, minWidth: 0, alignItems: "stretch" },
  factValue: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  stepHint: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: Spacing.two,
    borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  reviewsLink: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: Spacing.two,
    borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: Spacing.two },
  reviewsCopy: { flex: 1, minWidth: 0, alignItems: "stretch", gap: Spacing.one },
  section: { gap: Spacing.two },
  helper: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, lineHeight: 20, ...RtlText },
  offerItem: { gap: Spacing.one },
  related: { direction: "rtl", flexDirection: "row", gap: Spacing.two, paddingBottom: Spacing.one },
  purchase: { borderTopWidth: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: Spacing.two },
  purchaseRow: { direction: "rtl", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Spacing.three },
  quantity: { minHeight: ControlSizes.touch, flexDirection: "row", alignItems: "center", borderWidth: 1,
    borderRadius: Radius.lg, overflow: "hidden" },
  quantityButton: { width: ControlSizes.touch, minHeight: ControlSizes.touch, alignItems: "center", justifyContent: "center" },
  quantityValue: { minWidth: 70, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.one },
  quantityNumber: { fontFamily: Fonts.bold, fontSize: FontSizes.md, writingDirection: "ltr" },
  quantityUnit: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, ...RtlText },
  total: { flex: 1, minWidth: 0, alignItems: "stretch" },
  totalPrice: { fontFamily: Fonts.bold, fontSize: FontSizes.md, ...RtlText },
  error: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "center", writingDirection: "rtl" },
  cartStatus: { minHeight: ControlSizes.touch, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.one },
  cartStatusText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
  unavailable: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: Spacing.two },
  unavailableText: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
});
