import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { type Store } from "@/constants/catalog";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type StoreCardProps = {
  store: Store;
  onPress: () => void;
  compact?: boolean;
  showFeatured?: boolean;
};

export function StoreCard({
  store,
  onPress,
  compact = false,
  showFeatured = true,
}: StoreCardProps) {
  const { colors } = useTheme();
  const { storeCategories: categories, products } = useCustomerCatalog();

  const category = categories.find((item) =>
    store.categoryIds.includes(item.id),
  );

  const productCount = products.filter(
    (product) => product.storeId === store.id,
  ).length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={store.name}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compactCard : styles.normalCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.storeIcon,
            compact && styles.compactStoreIcon,
            {
              backgroundColor: colors.primaryLight,
            },
          ]}
        >
          <AppIcon
            name={category?.icon ?? "storefront-outline"}
            size={compact ? 23 : 26}
            color={colors.primary}
          />
        </View>

        <View style={styles.identity}>
          <Text
            style={[
              styles.name,
              {
                color: colors.text,
              },
            ]}
            numberOfLines={2}
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
              numberOfLines={1}
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

      {store.description ? (
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

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <AppIcon name="time-outline" size={13} color={colors.textSecondary} />

          <Text
            style={[
              styles.metaText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {store.deliveryTime ?? "التوصيل عند الطلب"}
          </Text>
        </View>
      </View>

      <View style={[styles.bottom, { borderTopColor: colors.border }]}>
        <Text
          style={[
            styles.productCount,
            {
              color: colors.primary,
            },
          ]}
        >
          {productCount} منتج
        </Text>

        <View style={styles.openAction}>
          <Text style={[styles.openText, { color: colors.primary }]}>عرض المتجر</Text>
          <AppIcon name="chevron-back-outline" size={15} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  normalCard: {
    width: 235,
  },

  compactCard: {
    width: 205,
  },

  header: {
    minHeight: 56,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  storeIcon: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  compactStoreIcon: {
    width: 42,
    height: 42,
  },

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
    textAlign: "right",
  },

  category: {
    marginTop: 3,
    fontFamily: Fonts.medium,
    fontSize: 10,
    textAlign: "right",
  },

  featuredText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
  },

  description: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    textAlign: "right",
  },

  meta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: Spacing.two,
  },

  metaItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
  },

  metaText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
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
  },

  openAction: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.half,
  },

  openText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },
});
