import { formatSyp } from "@/lib/money";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";
import type { CustomerOffer } from "@/lib/customer-offers";
import { getOfferPriceSummary } from "@/lib/offer-presentation";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

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
  added?: boolean;
  cardWidth?: number;
};

export function OfferCard({ offer, onPress, featured, expanded, added, cardWidth }: OfferCardProps) {
  const { colors } = useTheme();
  const { stores } = useCustomerCatalog();
  const summary = getOfferPriceSummary(offer);
  const store = stores.find(item => item.id === offer.store_id);
  const price = formatSyp(summary.finalTotal);
  const rule = offer.offer_type === "bundle" ? "باقة منتجات" : summary.rule;
  const icon = offerIcons[offer.offer_type];
  const items = offer.items.slice(0, 2);
  const remaining = offer.items.length - items.length;
  const labels = items.map(item => item.product.name + " × " + item.quantity + " " + item.product.unit);
  const preview = offer.items.flatMap(item => item.product.media ?? []).find(media => media.type === "image");
  const endTime = offer.ends_at ? Date.parse(offer.ends_at) : NaN;
  const [currentTime, setCurrentTime] = useState(Date.now);
  const expiry = Number.isFinite(endTime) ? endTime <= currentTime
    ? "انتهى العرض" : "ينتهي " + new Date(endTime).toLocaleDateString("ar") : "";

  useEffect(() => {
    const delay = endTime - Date.now();
    if (!Number.isFinite(delay) || delay > 2_147_483_647) return;
    const timeout = setTimeout(() => setCurrentTime(Date.now()), Math.max(0, delay));
    return () => clearTimeout(timeout);
  }, [endTime]);

  return <Pressable onPress={onPress} accessibilityRole="link"
    accessibilityLabel={[offer.title, store?.name, rule, price, ...labels, remaining ? "منتجات أخرى: " + remaining : "", expiry,
      added ? "في السلة" : ""].filter(Boolean).join("، ")}
    style={({ pressed }) => [styles.card, {
      width: cardWidth ?? (expanded ? "100%" : featured ? 232 : 208),
      backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border,
    }]}>
    <View style={styles.identity}>
      <View style={[styles.media, { backgroundColor: colors.accentLight }]}>
        <ShoppingCardImage uri={preview?.uri} icon={icon} />
      </View>
      <View style={styles.names}>
        <Text style={[styles.title, { color: colors.text }]}>{offer.title}</Text>
        {store ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{store.name}</Text> : null}
      </View>
    </View>
    <View style={styles.identity}>
      <AppIcon name={icon} size={15} color={colors.primary} />
      <Text style={[styles.meta, styles.names, { color: colors.textSecondary }]}>{rule}</Text>
    </View>
    {expanded && offer.description ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{offer.description}</Text> : null}
    {items.map((item, index) => <Text key={item.id} style={[styles.meta, { color: colors.text }]}>{labels[index]}</Text>)}
    {remaining > 0 ? <Text style={[styles.meta, { color: colors.textSecondary }]}>+ {remaining} من المنتجات الأخرى</Text> : null}
    <Text style={[styles.price, { color: colors.primary }]}>{price}</Text>
    {expiry || added ? <Text style={[styles.meta, { color: colors.textSecondary }]}>
      {[expiry, added ? "في السلة" : ""].filter(Boolean).join(" · ")}
    </Text> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.two, gap: Spacing.one, minHeight: 48 },
  identity: { direction: "rtl", flexDirection: "row", alignItems: "center", gap: Spacing.two },
  names: { flex: 1, minWidth: 0 },
  media: { width: 36, height: 36, borderRadius: Radius.sm, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, textAlign: "right" },
  meta: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  price: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
});
