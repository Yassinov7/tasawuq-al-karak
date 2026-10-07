import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import type { CustomerOffer } from "@/lib/customer-offers";
import { getOfferPriceSummary } from "@/lib/offer-presentation";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type OfferCardProps = {
  offer: CustomerOffer;
  onPress: () => void;
  featured?: boolean;
  expanded?: boolean;
  added?: boolean;
};

export function OfferCard({
  offer,
  onPress,
  featured = false,
  expanded = false,
  added = false,
}: OfferCardProps) {
  const { colors } = useTheme();
  const { stores } = useCustomerCatalog();
  const summary = getOfferPriceSummary(offer);
  const store = stores.find((item) => item.id === offer.store_id);
  const bundleDescription = offer.items
    .map((item) => `${item.product.name} × ${item.quantity}`)
    .join("، ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`تفاصيل العرض ${offer.title}`}
      style={({ pressed }) => [
        styles.card,
        featured ? styles.featuredCard : styles.normalCard,
        expanded && styles.expandedCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.offerIcon, { backgroundColor: colors.accentLight }]}>
          <AppIcon name="pricetag-outline" size={featured ? 24 : 21} color={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.rule, { color: colors.accent }]} numberOfLines={1}>
            {summary.rule}
          </Text>
          <Text style={[styles.store, { color: colors.textMuted }]} numberOfLines={1}>
            {store?.name ?? "متجر محلي"}
          </Text>
        </View>
        {added ? (
          <View style={[styles.addedBadge, { backgroundColor: colors.primaryLight }]}>
            <AppIcon name="checkmark-circle" size={14} color={colors.primary} />
            <Text style={[styles.addedText, { color: colors.primary }]}>في السلة</Text>
          </View>
        ) : null}
      </View>

      <Text
        style={[styles.title, featured && styles.featuredTitle, { color: colors.text }]}
        numberOfLines={2}
      >
        {offer.title}
      </Text>
      {offer.description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {offer.description}
        </Text>
      ) : null}

      <View style={[styles.bundle, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.bundleLabel, { color: colors.textMuted }]}>يشمل</Text>
        <Text style={[styles.bundleContents, { color: colors.textSecondary }]} numberOfLines={2}>
          {bundleDescription}
        </Text>
      </View>

      <View style={styles.footer}>
        <View>
          {summary.savings > 0 ? (
            <Text style={[styles.savings, { color: colors.success }]}>
              وفّر {summary.savings.toLocaleString("ar")} {offer.currency === "USD" ? "$" : "ل.س"}
            </Text>
          ) : null}
          <Text style={[styles.priceLabel, { color: colors.textMuted }]}>سعر العرض</Text>
          <Text style={[styles.price, { color: colors.primary }]}>
            {summary.finalTotal.toLocaleString("ar")} {offer.currency === "USD" ? "$" : "ل.س"}
          </Text>
        </View>
        <View style={[styles.detailsAction, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.detailsText, { color: colors.primary }]}>التفاصيل</Text>
          <AppIcon name="chevron-back-outline" size={16} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderWidth: 1, gap: Spacing.three, padding: Spacing.three },
  normalCard: { width: 250 },
  featuredCard: { width: 285 },
  expandedCard: { width: "100%" },
  header: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two },
  offerIcon: { alignItems: "center", borderRadius: Radius.md, height: 42, justifyContent: "center", width: 42 },
  headerText: { flex: 1, gap: 2 },
  addedBadge: { alignItems: "center", borderRadius: Radius.full, flexDirection: "row-reverse", gap: 3, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  addedText: { fontFamily: Fonts.medium, fontSize: 10 },
  rule: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, textAlign: "right" },
  store: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  title: { fontFamily: Fonts.semiBold, fontSize: FontSizes.md, lineHeight: 23, textAlign: "right" },
  featuredTitle: { fontSize: FontSizes.lg },
  description: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, lineHeight: 19, textAlign: "right" },
  bundle: { borderRadius: Radius.md, gap: Spacing.one, minHeight: 62, padding: Spacing.two },
  bundleLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "right" },
  bundleContents: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, lineHeight: 18, textAlign: "right" },
  footer: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  savings: { fontFamily: Fonts.medium, fontSize: FontSizes.xs },
  priceLabel: { fontFamily: Fonts.regular, fontSize: FontSizes.xs },
  price: { fontFamily: Fonts.bold, fontSize: FontSizes.md },
  detailsAction: { alignItems: "center", borderRadius: Radius.full, flexDirection: "row-reverse", gap: Spacing.one, minHeight: 36, paddingHorizontal: Spacing.two },
  detailsText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs },
});
