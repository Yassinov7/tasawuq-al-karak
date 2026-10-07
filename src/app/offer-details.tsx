import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CustomerCatalogStatus } from "@/components/marketplace/CustomerCatalogStatus";
import { AppButton } from "@/components/ui/AppButton";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";
import { getOfferPriceSummary } from "@/lib/offer-presentation";

export default function OfferDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const { offers, stores, loading: catalogLoading } = useCustomerCatalog();
  const {
    addOffer,
    itemCount,
    loading: cartLoading,
    selectedOfferIds,
    syncError,
  } = useCart();
  const [addingOffer, setAddingOffer] = useState(false);

  const offer = useMemo(
    () => offers.find((candidate) => candidate.id === id),
    [id, offers],
  );
  const summary = offer ? getOfferPriceSummary(offer) : null;
  const store = offer ? stores.find((candidate) => candidate.id === offer.store_id) : null;
  const isInCart = offer ? selectedOfferIds.includes(offer.id) : false;
  const unavailable = offer?.items.some((item) => !item.product.available) ?? true;
  const offerKind = offer?.offer_type === "discount"
    ? "خصم على المنتجات"
    : offer?.offer_type === "bundle"
      ? "باقة بسعر محدد"
      : "اشترِ واحصل على هدية";
  const endsAt = offer?.ends_at ? new Date(offer.ends_at) : null;
  const endDateLabel =
    endsAt && !Number.isNaN(endsAt.getTime())
      ? new Intl.DateTimeFormat("ar", { day: "numeric", month: "long", year: "numeric" }).format(endsAt)
      : null;

  const handleAddOffer = async () => {
    if (!offer || addingOffer || isInCart || unavailable) return;
    setAddingOffer(true);
    try {
      await addOffer(offer.id);
    } finally {
      setAddingOffer(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <CustomerCatalogStatus />
      <AppHeader title="تفاصيل العرض" showBack cartCount={itemCount} />

      {offer && summary ? (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.heroHeader}>
              <View style={[styles.heroIcon, { backgroundColor: colors.accentLight }]}>
                <AppIcon name="pricetag-outline" size={25} color={colors.accent} />
              </View>
              <View style={styles.heroIdentity}>
                <Text style={[styles.storeName, { color: colors.textMuted }]}>
                  {store?.name ?? "متجر محلي"}
                </Text>
                <Text style={[styles.title, { color: colors.text }]}>{offer.title}</Text>
              </View>
            </View>
            {offer.description ? (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {offer.description}
              </Text>
            ) : null}
            <View style={styles.heroMeta}>
              <View style={[styles.kindBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.kindText, { color: colors.primary }]}>{offerKind}</Text>
              </View>
              {endDateLabel ? (
                <View style={styles.endsAt}>
                  <AppIcon name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={[styles.endsAtText, { color: colors.textMuted }]}>
                    حتى {endDateLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.ruleBox, { backgroundColor: colors.accentLight }]}>
              <AppIcon name="sparkles-outline" size={16} color={colors.accent} />
              <Text style={[styles.rule, { color: colors.accent }]}>{summary.rule}</Text>
            </View>
          </View>

          <View
            style={[
              styles.itemsCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              مكونات العرض
            </Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              الكميات المحددة أدناه هي مكونات الباقة الثابتة.
            </Text>
            {summary.items.map((item) => (
              <View
                key={item.id}
                style={[styles.itemRow, { borderBottomColor: colors.border }]}
              >
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemName, { color: colors.text }]}>
                    {item.product.name}
                  </Text>
                  <Text style={[styles.itemQuantity, { color: colors.textMuted }]}>
                    {item.quantity} {item.product.unit}
                    {item.itemRole === "reward" ? " · هدية" : ""}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.itemPrice,
                    { color: item.itemRole === "reward" ? colors.success : colors.textSecondary },
                  ]}
                >
                  {item.itemRole === "reward" ? (
                    "مجانًا"
                  ) : (
                    <>
                      {item.finalLineTotal.toLocaleString("ar")}{" "}
                      {offer.currency === "USD" ? "$" : "ل.س"}
                    </>
                  )}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <View style={styles.totalLabels}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
                  السعر الإجمالي للعرض
                </Text>
                {summary.savings > 0 ? (
                  <Text style={[styles.originalTotal, { color: colors.textMuted }]}>
                    قبل العرض {summary.originalTotal.toLocaleString("ar")}{" "}
                    {offer.currency === "USD" ? "$" : "ل.س"}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.totalPrice, { color: colors.primary }]}>
                {summary.finalTotal.toLocaleString("ar")} {offer.currency === "USD" ? "$" : "ل.س"}
              </Text>
            </View>
            {summary.savings > 0 ? (
              <Text style={[styles.savings, { color: colors.success }]}>
                التوفير {summary.savings.toLocaleString("ar")}{" "}
                {offer.currency === "USD" ? "$" : "ل.س"}
              </Text>
            ) : null}
          </View>

          <View style={[styles.bundleNotice, { backgroundColor: colors.surfaceSecondary }]}>
            <AppIcon name="information-circle-outline" size={17} color={colors.textSecondary} />
            <Text style={[styles.note, { color: colors.textSecondary }]}>
              يضاف العرض إلى السلة كحزمة واحدة. لا يمكن تعديل عدد مكونات الباقة من هذه الصفحة.
            </Text>
          </View>

          {syncError ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>
              {syncError}
            </Text>
          ) : null}
          </ScrollView>
          <View style={[styles.actions, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            {unavailable ? (
              <Text style={[styles.unavailableMessage, { color: colors.error }]}>
                أحد منتجات العرض غير متوفر، لذلك لا يمكن إضافته للسلة.
              </Text>
            ) : null}
            <AppButton
              title={isInCart ? "تمت إضافة العرض إلى السلة" : "إضافة الحزمة إلى السلة"}
              icon={isInCart ? "checkmark-circle-outline" : "cart-outline"}
              disabled={unavailable || isInCart || cartLoading}
              loading={cartLoading || addingOffer}
              onPress={() => void handleAddOffer()}
            />
            {isInCart ? (
              <Pressable
                onPress={() => router.push("/cart")}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cartLink,
                  { borderColor: colors.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.cartLinkText, { color: colors.primary }]}>
                  الانتقال إلى السلة
                </Text>
                <AppIcon name="arrow-back" size={17} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
        </>
      ) : catalogLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
            جارٍ تحميل بيانات العرض...
          </Text>
        </View>
      ) : (
        <View style={styles.notFound}>
          <View style={[styles.notFoundIcon, { backgroundColor: colors.primaryLight }]}>
            <AppIcon name="pricetags-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.notFoundTitle, { color: colors.text }]}>
            {offers.length === 0 ? "تعذر العثور على العرض" : "العرض غير متاح"}
          </Text>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
            قد يكون العرض انتهى أو لم يعد متاحًا.
          </Text>
          <AppButton
            title="العودة إلى العروض"
            variant="outline"
            onPress={() => router.replace("/home/offers")}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    gap: Spacing.four,
    padding: Spacing.four,
    paddingBottom: Spacing.four,
  },
  hero: {
    gap: Spacing.three,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.five,
  },
  heroHeader: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: Spacing.three,
  },
  heroIcon: {
    alignItems: "center",
    borderRadius: Radius.lg,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  heroIdentity: {
    alignItems: "flex-end",
    flex: 1,
    gap: Spacing.one,
  },
  heroMeta: {
    alignItems: "center",
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  storeName: { fontFamily: Fonts.medium, fontSize: FontSizes.xs },
  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },
  description: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    textAlign: "center",
  },
  kindBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },
  kindText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs },
  endsAt: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.one },
  endsAtText: { fontFamily: Fonts.regular, fontSize: FontSizes.xs },
  ruleBox: {
    alignItems: "center",
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
  },
  rule: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },
  itemsCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.four,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },
  sectionHint: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
    textAlign: "right",
  },
  itemRow: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: Spacing.three,
  },
  itemDetails: { flex: 1, gap: 3 },
  itemName: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" },
  itemQuantity: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  itemPrice: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "left" },
  totalRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingTop: Spacing.three,
  },
  totalLabels: { flex: 1, gap: Spacing.one },
  totalLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.sm },
  originalTotal: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textDecorationLine: "line-through" },
  totalPrice: { fontFamily: Fonts.bold, fontSize: FontSizes.lg },
  savings: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    marginTop: Spacing.one,
    textAlign: "right",
  },
  error: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  note: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },
  bundleNotice: {
    alignItems: "flex-start",
    flexDirection: "row-reverse",
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  actions: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  unavailableMessage: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },
  cartLink: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: Spacing.two,
    justifyContent: "center",
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  cartLinkText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm },
  notFound: {
    flex: 1,
    gap: Spacing.three,
    justifyContent: "center",
    padding: Spacing.six,
  },
  loading: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.three,
    justifyContent: "center",
  },
  notFoundIcon: {
    alignSelf: "center",
    alignItems: "center",
    borderRadius: Radius.full,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  notFoundTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "center",
  },
  notFoundText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },
  pressed: { opacity: 0.72 },
});
