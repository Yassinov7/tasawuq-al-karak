import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";

import { AppIcon } from "@/components/ui/AppIcon";
import { RatingStars } from "@/components/marketplace/RatingStars";
import { type Store } from "@/types/catalog";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type StoreCardProps = {
  store: Store;
  onPress: () => void;
  compact?: boolean;
  grid?: boolean;
  showFeatured?: boolean;
  shelfWidth?: number;
  searchResult?: boolean;
  orderable?: boolean;
  logo?: { url: string; key: string };
};

export function StoreCard({
  store,
  onPress,
  compact = false,
  grid = false,
  showFeatured = true,
  logo,
  shelfWidth,
  searchResult = false,
  orderable,
}: StoreCardProps) {
  const { colors } = useTheme();
  const searchCompact = compact && searchResult;
  const { width, fontScale } = useWindowDimensions();
  const { storeCategories: categories, products, storeRatings } = useCustomerCatalog();

  const category = categories.find((item) =>
    store.categoryIds.includes(item.id),
  );

  const productCount = shelfWidth === undefined && !searchResult ? products.filter(
    (product) => product.storeId === store.id,
  ).length : null;
  const rating = storeRatings.get(store.id);
  const average = rating?.averageRating ?? store.rating;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={orderable === undefined ? store.name : [store.name, category?.name, orderable ? "متاح للطلب" : "غير متاح للطلب"].filter(Boolean).join("، ")}
      style={({ pressed }) => [
        styles.card,
        searchCompact && styles.searchCompactCard,
        grid ? (width < 360 || fontScale > 1.25 ? styles.singleColumnCard : styles.gridCard) : (compact ? styles.compactCard : styles.normalCard),
        searchResult && styles.singleColumnCard,
        shelfWidth === undefined ? undefined : { width: shelfWidth },
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <View style={[styles.header, (shelfWidth !== undefined || searchCompact) && styles.shelfHeader]}>
        <View
          style={[
            styles.storeIcon,
            compact && styles.compactStoreIcon,
            {
              backgroundColor: colors.primaryLight,
            },
          ]}
        >
          <ShoppingCardImage uri={logo?.url} cacheKey={logo?.key} restricted fit="contain"
            icon={category?.icon ?? "storefront-outline"} />
        </View>

        <View style={[styles.identity, (shelfWidth !== undefined || searchCompact) && styles.shelfIdentity]}>
          <Text
            style={[
              styles.name,
              {
                color: colors.text,
              },
            ]}
            numberOfLines={searchCompact ? undefined : 2}
          >
            {store.name}
          </Text>
          {category ? (
            <Text
              style={[
                styles.category,
                {
                  color: colors.textMuted,
                },
              ]}
              numberOfLines={searchCompact ? undefined : 1}
            >
              {category.name}
            </Text>
          ) : null}
        </View>

        {showFeatured && store.featured ? (
          <View style={[styles.featuredBadge, { backgroundColor: colors.accentLight }]}>
            <AppIcon name="star" size={11} color={colors.accent} />
            <Text style={[styles.featuredText, { color: colors.accent }]}>مميز</Text>
          </View>
        ) : null}
      </View>

      {!searchCompact && shelfWidth === undefined && store.description ? (
        <Text
          style={[
            styles.description,
            {
              color: colors.textSecondary,
            },
          ]}
          numberOfLines={2}
        >
          {store.description}
        </Text>
      ) : null}

      {orderable !== undefined ? (
        <Text style={[styles.category, styles.searchDelivery, { color: colors.textSecondary }]}>
          {orderable ? "متاح للطلب" : "غير متاح للطلب"}
        </Text>
      ) : null}
      {average != null ? (
        <View style={styles.ratingRow}>
          <RatingStars rating={Math.round(average)} size={14} />
          <Text style={[styles.ratingText, { color: colors.textSecondary }]}>{average.toFixed(1)}{rating?.ratingCount ? " · " + rating.ratingCount : ""}</Text>
        </View>
      ) : null}

      {searchCompact ? (store.deliveryTime ? <Text style={[styles.category, styles.searchDelivery, { color: colors.textSecondary }]}>{store.deliveryTime}</Text> : null) : shelfWidth === undefined ? <View style={[styles.bottom, { borderTopColor: colors.border }]}>
        {productCount !== null ? <Text style={[styles.productCount, { color: colors.primary }]}>
          {productCount} منتج
        </Text> : null}
        {searchResult && store.deliveryTime ? <Text style={[styles.category, { color: colors.textSecondary }]}>{store.deliveryTime}</Text> : null}

        <View style={styles.openAction}>
          <Text style={[styles.openText, { color: colors.primary }]}>عرض المتجر</Text>
          <AppIcon name="chevron-back-outline" size={15} color={colors.primary} />
        </View>
      </View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  searchCompactCard: { flex: 1, padding: Spacing.two },
  searchDelivery: { textAlign: "center", marginTop: Spacing.one },

  normalCard: {
    width: 235,
  },

  compactCard: {
    width: 205,
  },

  gridCard: {
    width: "48.5%",
  },

  singleColumnCard: {
    width: "100%",
  },

  header: {
    minHeight: 56,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  storeIcon: {
    width: 50,
    overflow: "hidden",
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  compactStoreIcon: {
    width: 42,
    height: 42,
  },
  shelfHeader: { flexDirection: "column" },
  shelfIdentity: { flex: 0, alignItems: "center", alignSelf: "stretch" },

  identity: {
    flex: 1,
    alignItems: "flex-end",
  },

  featuredBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.full,
  },

  name: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    ...RtlText,
  },

  category: {
    marginTop: 3,
    fontFamily: Fonts.medium,
    fontSize: 10,
    ...RtlText,
  },

  featuredText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    ...RtlText,
  },

  description: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    ...RtlText,
  },

  ratingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: Spacing.two,
  },

  ratingText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    writingDirection: "ltr",
  },

  bottom: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },

  productCount: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    ...RtlText,
  },

  openAction: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.half,
  },

  openText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    ...RtlText,
  },
});
