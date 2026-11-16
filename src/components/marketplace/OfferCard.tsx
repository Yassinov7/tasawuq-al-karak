import { formatSyp } from "@/lib/money";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";
import type { CustomerOffer } from "@/lib/customer-offers";
import { getOfferPriceSummary } from "@/lib/offer-presentation";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useOfferCountdown } from "@/hooks/useOfferCountdown";

const offerIcons = {
  discount: "pricetag-outline",
  bundle: "cube-outline",
  buy_x_get_y: "gift-outline",
} as const;

type OfferCardProps = {
  offer: CustomerOffer;
  onPress: () => void;
  featured?: boolean;
  expanded?: boolean;
  compact?: boolean;
  added?: boolean;
  cardWidth?: number;
};

export function OfferCard({ offer, onPress, featured, expanded, compact, added, cardWidth }: OfferCardProps) {
  const { colors } = useTheme();
  const { stores } = useCustomerCatalog();
  const summary = getOfferPriceSummary(offer);
  const store = stores.find(item => item.id === offer.store_id);
  const price = formatSyp(summary.finalTotal);
  const reference = summary.originalTotal > 0 && Number.isFinite(summary.originalTotal) ? formatSyp(summary.originalTotal) : null;
  const savings = summary.savings > 0 ? formatSyp(summary.savings) : null;
  const priceLabel = offer.offer_type === "bundle" ? "سعر الباقة" : offer.offer_type === "discount" ? "بعد الخصم" : "بعد الهدية";
  const rule = offer.offer_type === "bundle" ? "باقة منتجات" : summary.rule;
  const icon = offerIcons[offer.offer_type];
  const items = offer.items.slice(0, 2);
  const remaining = offer.items.length - items.length;
  const labels = items.map(item => item.product.name + " × " + item.quantity + " " + item.product.unit);
  const preview = offer.items.flatMap(item => item.product.media ?? []).find(media => media.type === "image");
  const countdown = useOfferCountdown(offer.ends_at, true, offer.id);

  const media = preview ? (
    <View style={[styles.media, { backgroundColor: colors.accentLight }]}>
      <ShoppingCardImage uri={preview.uri} icon={icon} />
    </View>
  ) : null;
  const names = <View style={compact ? undefined : styles.names}>
    <Text style={[styles.title, { color: colors.text }]}>{offer.title}</Text>
    {store ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{store.name}</Text> : null}
  </View>;

  return <Pressable onPress={onPress} accessibilityRole="link"
    accessibilityLabel={[offer.title, store?.name, rule, price, ...labels, remaining ? "منتجات أخرى: " + remaining : "", countdown.label,
      added ? "في السلة" : ""].filter(Boolean).join("، ")}
    style={({ pressed }) => [styles.card, compact && styles.compact, {
      width: cardWidth ?? (expanded ? "100%" : featured ? 232 : 208),
      backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border,
    }]}>
    <View style={styles.identity}>
      <View style={[styles.typeIcon, { backgroundColor: colors.primaryLight }]}>
        <AppIcon name={icon} size={18} color={colors.primary} />
      </View>
      {compact ? media : names}
      {compact ? null : media}
    </View>
    {compact ? names : null}
    <Text style={[styles.meta, { color: colors.textSecondary }]}>{rule}</Text>
    {expanded && offer.description ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{offer.description}</Text> : null}
    {items.map((item, index) => <Text key={item.id} style={[styles.meta, { color: colors.text }]}>{labels[index]}</Text>)}
    {remaining > 0 ? <Text style={[styles.meta, { color: colors.textSecondary }]}>+ {remaining} من المنتجات الأخرى</Text> : null}
    {countdown.label ? <Text style={[styles.countdown, { color: countdown.expired ? colors.error : colors.textSecondary }]}>{countdown.label}</Text> : null}
    {added ? <Text style={[styles.meta, { color: colors.textSecondary }]}>في السلة</Text> : null}
    {reference && savings ? <Text style={[styles.reference, { color: colors.textMuted }]}>القيمة منفردة {reference} · وفّر {savings}</Text> : null}
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>{priceLabel}</Text>
      <Text style={[styles.price, { color: colors.primary }]}>{price}</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.two, gap: Spacing.one, minHeight: 48, alignSelf: "stretch" },
  compact: { flex: 1 },
  identity: { flexDirection: "row-reverse", alignItems: "flex-start", gap: Spacing.two },
  typeIcon: { width: 36, height: 36, borderRadius: Radius.full, alignItems: "center", justifyContent: "center" },
  names: { flex: 1, minWidth: 0, alignItems: "stretch" },
  media: { width: 36, height: 36, borderRadius: Radius.sm, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, ...RtlText },
  meta: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, ...RtlText },
  countdown: { minHeight: 18, fontFamily: Fonts.medium, fontSize: FontSizes.xs, ...RtlText },
  reference: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, ...RtlText },
  priceRow: { marginTop: "auto", paddingTop: Spacing.one, flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: Spacing.one },
  priceLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, ...RtlText },
  price: { fontFamily: Fonts.bold, fontSize: FontSizes.md, ...RtlText },
});
