import { formatSyp } from "@/lib/money";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { AppBadge } from "@/components/ui/AppBadge";
import { AppIcon } from "@/components/ui/AppIcon";
import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";
import { RatingStars } from "@/components/marketplace/RatingStars";
import type { Product } from "@/types/catalog";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type ProductCardProps = {
  product: Product;
  onPress: () => void;
  compact?: boolean;
  showStore?: boolean;
  showOffer?: boolean;
  cardWidth?: number;
  storeName?: string;
  favorite?: boolean;
  onFavoritePress?: () => void;
};

export function ProductCard({
  product,
  onPress,
  compact = false,
  showStore = true,
  showOffer = false,
  cardWidth,
  storeName,
  favorite = false,
  onFavoritePress,
}: ProductCardProps) {
  const { colors } = useTheme();
  const { categories, stores, productRatings, offers } = useCustomerCatalog();
  const { width, fontScale } = useWindowDimensions();

  const category = categories.find((item) => item.id === product.categoryId);

  const store = storeName ?? stores.find((item) => item.id === product.storeId)?.name;
  const rating = productRatings.get(product.id);

  const productOffers = showOffer && product.available
    ? offers.filter(offer => offer.items.some(item => item.product.id === product.id))
    : [];
  const offerLabel = productOffers.length ? "ضمن عرض" : undefined;
  const price = formatSyp(product.price);
  const media = product.media?.find((item) => item.type === "image");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[product.name, showStore ? store : undefined, price, product.unit, offerLabel, !product.available ? "غير متوفر" : undefined].filter(Boolean).join("، ")}
      style={({ pressed }) => [
        styles.card,
        compact ? (width < 360 || fontScale > 1.25 ? styles.singleColumnCard : styles.compactCard) : styles.normalCard,
        cardWidth === undefined ? undefined : { width: cardWidth },
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.image,
          { backgroundColor: colors.primaryLight },
        ]}
      >
        <ShoppingCardImage uri={media?.uri} icon={category?.icon ?? "cube-outline"} />

        {onFavoritePress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorite ? `إزالة ${product.name} من المفضلة` : `إضافة ${product.name} إلى المفضلة`}
            accessibilityState={{ selected: favorite }}
            hitSlop={6}
            onPress={(event) => {
              event.stopPropagation();
              onFavoritePress();
            }}
            style={({ pressed }) => [styles.favoriteButton, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.72 : 1,
            }]}
          >
            <AppIcon name={favorite ? "heart" : "heart-outline"} size={20} color={favorite ? colors.error : colors.textSecondary} />
          </Pressable>
        ) : null}

        {productOffers.length ? (
          <View style={styles.offerBadge}>
            <AppBadge text="ضمن عرض" variant="neutral" icon="pricetag-outline" />
          </View>
        ) : null}
      </View>

      <Text
        style={[
          styles.name,
          {
            color: colors.text,
          },
        ]}
        numberOfLines={fontScale <= 1.25 ? 2 : undefined}
      >
        {product.name}
      </Text>

      {!product.available ? (
        <View style={[styles.unavailableBadge, { backgroundColor: colors.error + "18" }]}>
          <Text style={[styles.unavailableText, { color: colors.error }]}>غير متوفر</Text>
        </View>
      ) : null}

      {showStore && store ? (
        <Text
          style={[
            styles.store,
            {
              color: colors.textMuted,
            },
          ]}
          numberOfLines={1}
        >
          {store}
        </Text>
      ) : null}

      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: colors.primary }]}>{price}</Text>
        {product.unit ? <Text style={[styles.unit, { color: colors.textMuted }]}>{product.unit}</Text> : null}
      </View>

      {rating && rating.averageRating !== null && rating.ratingCount > 0 ? (
        <View style={styles.ratingRow}>
          <RatingStars rating={Math.round(rating.averageRating)} size={13} />
          <Text style={[styles.ratingText, { color: colors.textMuted }]}>{rating.averageRating.toFixed(1)} · {rating.ratingCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  normalCard: {
    width: 175,
  },

  compactCard: {
    width: "48.5%",
  },

  singleColumnCard: {
    width: "100%",
  },

  image: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
    overflow: "hidden",
    position: "relative",
    height: 90,
  },

  offerBadge: {
    position: "absolute",
    top: Spacing.two,
    right: Spacing.two,
  },
  favoriteButton: {
    position: "absolute",
    left: Spacing.two,
    top: Spacing.two,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  name: {
    marginTop: Spacing.one,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    ...RtlText,
  },

  store: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    ...RtlText,
  },

  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    flexWrap: "wrap",
    columnGap: Spacing.one,
    marginTop: Spacing.one,
  },

  price: {
    flexShrink: 1,
    ...RtlText,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  unit: {
    flexShrink: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    ...RtlText,
  },

  unavailableBadge: {
    alignSelf: "flex-end",
    borderRadius: Radius.full,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },

  unavailableText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    ...RtlText,
  },

  ratingRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: Spacing.one,
    marginTop: Spacing.two,
  },

  ratingText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "auto",
    writingDirection: "ltr",
  },
});
