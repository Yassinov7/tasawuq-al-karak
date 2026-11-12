import { Image } from "expo-image";
import { useState, type PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { CustomerOffer } from "@/lib/customer-offers";
import { formatSyp } from "@/lib/money";
import { getOfferPriceSummary } from "@/lib/offer-presentation";
import type { Category, IconName, Product, Store } from "@/types/catalog";

type Open = { onPress: () => void };
type Picture = { uri: string; cacheKey?: string };

function HomeImage({ source, icon, contain = false }: { source?: Picture; icon: IconName; contain?: boolean }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState<string>();
  return source && source.uri !== failed ? (
    <Image source={source} recyclingKey={source.cacheKey ?? source.uri} style={styles.image}
      contentFit={contain ? "contain" : "cover"} cachePolicy={contain ? "memory" : "memory-disk"}
      accessible={false} onError={() => setFailed(source.uri)} />
  ) : <AppIcon name={icon} size={24} color={colors.primary} />;
}

function Card({ children, onPress, label, width }: PropsWithChildren<Open & { label: string; width: number }>) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.card, { width, backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border }]}>
    {children}
  </Pressable>;
}

export function HomeCategoryTile({ category, onPress }: Open & { category: Category }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="link" accessibilityLabel={category.name} onPress={onPress}
    style={({ pressed }) => [styles.category, { backgroundColor: pressed ? colors.surfacePressed : colors.surfaceSecondary }]}>
    <AppIcon name={category.icon} size={20} color={colors.primary} />
    <Text style={[styles.small, { color: colors.text }]}>{category.name}</Text>
  </Pressable>;
}

export function HomeStoreTile({ store, logo, category, width, onPress }: Open & {
  store: Store; logo?: { url: string; key: string }; category?: string; width: number;
}) {
  const { colors } = useTheme();
  return <Card width={width} label={store.name} onPress={onPress}>
    <View style={styles.storeBody}>
      <View style={[styles.logo, { backgroundColor: colors.surfaceSecondary }]}>
        <HomeImage source={logo ? { uri: logo.url, cacheKey: logo.key } : undefined} icon="storefront-outline" contain />
      </View>
      <Text numberOfLines={2} style={[styles.name, styles.center, { color: colors.text }]}>{store.name}</Text>
      {category ? <Text numberOfLines={2} style={[styles.small, styles.center, { color: colors.textSecondary }]}>{category}</Text> : null}
    </View>
  </Card>;
}

export function HomeProductTile({ product, store, width, onPress }: Open & { product: Product; store?: string; width: number }) {
  const { colors } = useTheme();
  const image = product.media?.find(media => media.type === "image");
  const price = formatSyp(product.price);
  return <Card width={width} label={[product.name, store, price, product.unit].filter(Boolean).join("، ")} onPress={onPress}>
    <View style={[styles.photo, { backgroundColor: colors.surfaceSecondary }]}>
      <HomeImage source={image ? { uri: image.uri } : undefined} icon="cube-outline" />
    </View>
    <View style={styles.body}>
      <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>{product.name}</Text>
      {store ? <Text numberOfLines={1} style={[styles.small, { color: colors.textSecondary }]}>{store}</Text> : null}
      <Text style={[styles.price, { color: colors.primary }]}>{price}</Text>
      <Text style={[styles.small, { color: colors.textSecondary }]}>{product.unit}</Text>
    </View>
  </Card>;
}

export function HomeOfferTile({ offer, store, added, width, onPress }: Open & { offer: CustomerOffer; store?: string; added: boolean; width: number }) {
  const { colors } = useTheme();
  const { rule, finalTotal } = getOfferPriceSummary(offer);
  const image = offer.items.flatMap(item => item.product.media ?? []).find(media => media.type === "image");
  const price = formatSyp(finalTotal);
  return <Card width={width} label={[offer.title, store, rule, price, added ? "في السلة" : ""].filter(Boolean).join("، ")} onPress={onPress}>
    <View style={[styles.offerPhoto, { backgroundColor: colors.accentLight }]}>
      <HomeImage source={image ? { uri: image.uri } : undefined} icon="pricetags-outline" />
    </View>
    <View style={styles.body}>
      <Text style={[styles.small, { color: colors.textSecondary }]}>{rule}</Text>
      <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>{offer.title}</Text>
      {store ? <Text numberOfLines={1} style={[styles.small, { color: colors.textSecondary }]}>{store}</Text> : null}
      <Text style={[styles.price, { color: colors.primary }]}>{price}</Text>
      {added ? <Text style={[styles.small, { color: colors.primary }]}>في السلة</Text> : null}
    </View>
  </Card>;
}

const styles = StyleSheet.create({
  image: { width: "100%", height: "100%" },
  card: { borderWidth: 1, borderRadius: Radius.xl, overflow: "hidden" },
  category: { maxWidth: 220, minHeight: 48, flexDirection: "row", alignItems: "center", gap: Spacing.two, borderRadius: Radius.lg, padding: Spacing.two, paddingHorizontal: Spacing.three },
  storeBody: { alignItems: "center", gap: Spacing.one, padding: Spacing.three },
  logo: { width: 68, height: 68, overflow: "hidden", borderRadius: Radius.lg, alignItems: "center", justifyContent: "center" },
  body: { padding: Spacing.three, gap: Spacing.one },
  photo: { aspectRatio: 1.35, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  offerPhoto: { aspectRatio: 2.5, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  name: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, textAlign: "right" },
  small: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", flexShrink: 1 },
  price: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
  center: { textAlign: "center" },
});
