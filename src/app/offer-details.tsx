import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomerCatalogStatus } from "@/components/marketplace/CustomerCatalogStatus";
import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";
import { CustomerMarketHeader } from "@/components/navigation/CustomerMarketHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";
import { describeCustomerOffer } from "@/lib/customer-offers";
import { useOfferCountdown } from "@/hooks/useOfferCountdown";
import { formatSyp } from "@/lib/money";
import { getOfferPriceSummary } from "@/lib/offer-presentation";
import type { IconName } from "@/types/catalog";

const offerMeta = {
  discount: { icon: "pricetag-outline", label: "خصم", finalLabel: "السعر بعد الخصم" },
  bundle: { icon: "cube-outline", label: "باقة", finalLabel: "سعر الباقة" },
  buy_x_get_y: { icon: "gift-outline", label: "هدية", finalLabel: "السعر بعد الهدية" },
} satisfies Record<string, { icon: IconName; label: string; finalLabel: string }>;

export default function OfferDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, loading } = useAuth();
  const offerId = typeof id === "string" ? id : undefined;
  const scope = loading ? "loading" : JSON.stringify([offerId, user?.id, user?.role, user?.app_metadata.role, user?.app_metadata.roles]);
  return <OfferDetails key={scope} offerId={offerId} />;
}

function OfferDetails({ offerId }: { offerId?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { offers, stores, loading } = useCustomerCatalog();
  const { addOffer, itemCount, loading: cartLoading, selectedOfferIds, syncError } = useCart();
  const [adding, setAdding] = useState(false);
  const offer = offers.find(candidate => candidate.id === offerId);
  const store = offer ? stores.find(candidate => candidate.id === offer.store_id) : undefined;
  const summary = offer ? getOfferPriceSummary(offer) : undefined;
  const meta = offer ? offerMeta[offer.offer_type] : offerMeta.bundle;
  const inCart = offer ? selectedOfferIds.includes(offer.id) : false;
  const unavailable = offer?.items.some(item => !item.product.available) ?? false;
  const reliableReference = Boolean(summary && summary.originalTotal > 0 && summary.items.every(item =>
    Number.isFinite(item.product.price) && Number.isFinite(item.quantity) && item.quantity > 0));
  const countdown = useOfferCountdown(offer?.ends_at, false, offer?.id);
  const expired = countdown.expired;
  const goBack = () => router.canGoBack() ? router.back() : router.replace("/home/offers");

  const add = async () => {
    if (!offer || adding || inCart || unavailable || expired) return;
    setAdding(true);
    try { await addOffer(offer.id); }
    finally { setAdding(false); }
  };

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <CustomerMarketHeader title="تفاصيل العرض" screenTitle={offer?.title} showBack onBack={goBack}
      cartCount={itemCount} mode="shared" />
    <CustomerCatalogStatus />
    {!offer || !summary ? loading ? null : <View style={styles.empty}>
      <AppEmptyState icon="pricetags-outline" title="العرض غير متاح"
        description="قد يكون العرض انتهى أو لم يعد منشورًا." buttonText="العودة إلى العروض" onButtonPress={goBack} />
    </View> : <>
      <ScrollView style={styles.scroller} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.typeIcon, { backgroundColor: colors.accentLight }]}>
            <AppIcon name={meta.icon} size={25} color={colors.accent} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.type, { color: colors.accent }]}>{meta.label}</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{offer.title}</Text>
            {store ? <Pressable accessibilityRole="link" accessibilityLabel={`فتح متجر ${store.name}`}
              onPress={() => router.push({ pathname: "/store-details", params: { id: store.id } })} style={styles.storeLink}>
              <AppIcon name="storefront-outline" size={15} color={colors.primary} />
              <Text style={[styles.storeName, { color: colors.primary }]}>{store.name}</Text>
            </Pressable> : null}
          </View>
        </View>

        {offer.description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{offer.description}</Text> : null}

        <View style={[styles.explainer, { backgroundColor: colors.surfaceSecondary }]}>
          <AppIcon name={meta.icon} size={18} color={colors.primary} />
          <View style={styles.explainerCopy}>
            <Text style={[styles.explainerTitle, { color: colors.text }]}>كيف يعمل هذا العرض؟</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{describeCustomerOffer(offer)}</Text>
            {offer.offer_type === "bundle" ? <Text style={[styles.hint, { color: colors.textMuted }]}>تضاف المنتجات والكميات أدناه معًا بسعر باقة ثابت.</Text> : null}
            {offer.offer_type === "discount" ? <Text style={[styles.hint, { color: colors.textMuted }]}>يطبق الخصم على المنتجات والكميات المحددة أدناه فقط.</Text> : null}
            {offer.offer_type === "buy_x_get_y" ? <Text style={[styles.hint, { color: colors.textMuted }]}>الهدية هي البنود الموسومة «هدية» فقط بعد استيفاء بنود الشراء.</Text> : null}
          </View>
        </View>

        <View style={[styles.pricePanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {reliableReference ? <PriceLine label="قيمة المنتجات منفردة" value={formatSyp(summary.originalTotal)} muted /> : null}
          <PriceLine label={meta.finalLabel} value={formatSyp(summary.finalTotal)} prominent />
          {reliableReference && summary.savings > 0 ? <PriceLine label="التوفير الحقيقي" value={formatSyp(summary.savings)} saving /> : null}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>محتويات العرض</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>القيمة المنفردة تحسب من سعر كل منتج مضروبًا في كميته داخل العرض.</Text>
          <View style={[styles.items, { borderColor: colors.border }]}>
            {summary.items.map((item, index) => {
              const image = item.product.media?.find(media => media.type === "image");
              const isReward = offer.offer_type === "buy_x_get_y" && item.itemRole === "reward";
              const lineSaving = item.originalLineTotal - item.finalLineTotal;
              return <Pressable key={item.id} accessibilityRole="link" accessibilityLabel={`فتح المنتج ${item.product.name}`}
                onPress={() => router.push({ pathname: "/product-details", params: { id: item.product.id } })}
                style={[styles.item, index < summary.items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.itemImage, { backgroundColor: colors.primaryLight }]}>
                  <ShoppingCardImage uri={image?.uri} icon={isReward ? "gift-outline" : "cube-outline"} />
                </View>
                <View style={styles.itemCopy}>
                  <View style={styles.itemTitleRow}>
                    <Text style={[styles.itemName, { color: colors.text }]}>{item.product.name}</Text>
                    {isReward ? <Text style={[styles.reward, { color: colors.accent }]}>هدية</Text> : null}
                  </View>
                  <Text style={[styles.quantity, { color: colors.textSecondary }]}>{item.quantity.toLocaleString("ar-SY", { maximumFractionDigits: 3 })} {item.product.unit}</Text>
                  {offer.offer_type === "bundle" ? <Text style={[styles.lineMeta, { color: colors.textMuted }]}>قيمتها منفردة {formatSyp(item.originalLineTotal)}</Text>
                    : isReward ? <Text style={[styles.lineMeta, { color: colors.success }]}>مجانًا · قيمتها {formatSyp(item.originalLineTotal)}</Text>
                      : offer.offer_type === "discount" && lineSaving > 0 ? <Text style={[styles.lineMeta, { color: colors.textMuted }]}>
                        منفردًا {formatSyp(item.originalLineTotal)} · بعد الخصم {formatSyp(item.finalLineTotal)}</Text>
                        : <Text style={[styles.lineMeta, { color: colors.textMuted }]}>{formatSyp(item.finalLineTotal)}</Text>}
                </View>
                <AppIcon name="chevron-back" size={17} color={colors.textMuted} />
              </Pressable>;
            })}
          </View>
        </View>

      </ScrollView>

      <View style={[styles.actions, { backgroundColor: colors.surface, borderTopColor: colors.border,
        paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
        {syncError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{syncError}</Text> : null}
        {unavailable ? <Text style={[styles.error, { color: colors.error }]}>أحد منتجات العرض غير متوفر حاليًا.</Text> : null}
        <View style={styles.purchaseStack}>
          {countdown.label ? <View style={styles.expiry}>
            <AppIcon name="time-outline" size={18} color={expired ? colors.error : colors.primary} />
            <Text style={[styles.expiryText, { color: expired ? colors.error : colors.textSecondary }]}>
              {countdown.label}
            </Text>
          </View> : null}
          <View style={styles.addAction}>
            <AppButton title={expired ? "انتهى العرض" : inCart ? "العرض موجود في السلة" : "إضافة العرض إلى السلة"}
              icon={expired ? "time-outline" : inCart ? "checkmark-circle-outline" : "cart-outline"} loading={adding}
              disabled={expired || inCart || unavailable || adding || cartLoading} onPress={() => void add()} />
          </View>
        </View>
        {inCart ? <Pressable accessibilityRole="link" onPress={() => router.push("/cart")} style={styles.cartLink}>
          <Text style={[styles.cartText, { color: colors.primary }]}>فتح السلة</Text>
          <AppIcon name="chevron-back" size={17} color={colors.primary} />
        </Pressable> : null}
      </View>
    </>}
  </View>;
}

function PriceLine({ label, value, muted, prominent, saving }: { label: string; value: string; muted?: boolean; prominent?: boolean; saving?: boolean }) {
  const { colors } = useTheme();
  return <View style={styles.priceLine}>
    <Text style={[styles.priceLabel, { color: muted ? colors.textMuted : colors.textSecondary }]}>{label}</Text>
    <Text style={[prominent ? styles.finalPrice : styles.priceValue,
      { color: saving ? colors.success : prominent ? colors.primary : colors.text }]}>{value}</Text>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroller: { flex: 1, minHeight: 0 },
  empty: { flex: 1, justifyContent: "center", padding: Spacing.four },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", direction: "rtl",
    paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.six, gap: Spacing.four },
  hero: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  typeIcon: { width: 52, height: 52, borderRadius: Radius.lg, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1, minWidth: 0, alignItems: "stretch", gap: Spacing.half },
  type: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs, ...RtlText },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, lineHeight: 34, ...RtlText },
  storeLink: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: Spacing.one, alignSelf: "flex-start" },
  storeName: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  description: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 23, ...RtlText },
  explainer: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.two, borderRadius: Radius.lg, padding: Spacing.three },
  explainerCopy: { flex: 1, minWidth: 0, alignItems: "stretch", gap: Spacing.one },
  explainerTitle: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
  body: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, ...RtlText },
  hint: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, lineHeight: 20, ...RtlText },
  pricePanel: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.three, gap: Spacing.two },
  priceLine: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: Spacing.two },
  priceLabel: { flex: 1, minWidth: 135, fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  priceValue: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
  finalPrice: { fontFamily: Fonts.bold, fontSize: FontSizes.xl, ...RtlText },
  section: { gap: Spacing.two },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, ...RtlText },
  items: { borderWidth: 1, borderRadius: Radius.xl, overflow: "hidden" },
  item: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: Spacing.two, padding: Spacing.two },
  itemImage: { width: 62, height: 62, borderRadius: Radius.md, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  itemCopy: { flex: 1, minWidth: 0, alignItems: "stretch", gap: 3 },
  itemTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Spacing.one },
  itemName: { flex: 1, minWidth: 100, fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
  reward: { fontFamily: Fonts.bold, fontSize: FontSizes.xs, ...RtlText },
  quantity: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, ...RtlText },
  lineMeta: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, ...RtlText },
  actions: { borderTopWidth: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: Spacing.two },
  purchaseStack: { flexDirection: "column", alignItems: "stretch", gap: Spacing.two },
  expiry: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: Spacing.two },
  expiryText: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  addAction: { width: "100%" },
  error: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "center", writingDirection: "rtl" },
  cartLink: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.one },
  cartText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
});
