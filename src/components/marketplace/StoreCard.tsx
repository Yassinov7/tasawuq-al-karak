import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppBadge } from "@/components/ui/AppBadge";
import { AppIcon } from "@/components/ui/AppIcon";
import { stores } from "@/constants/catalog";
import { useCatalog } from "@/context/CatalogContext";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Store = (typeof stores)[number];

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
  const { categories } = useCatalog();

  const category = categories.find((item) =>
    store.categoryIds.includes(item.id),
  );

  const productCount = store.productCount ?? 0;

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
      <View
        style={[
          styles.image,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon
          name={category?.icon ?? "storefront-outline"}
          size={compact ? 32 : 38}
          color={colors.primary}
        />

        {showFeatured && store.featured ? (
          <View style={styles.featuredBadge}>
            <AppBadge text="مميز" variant="accent" icon="star" />
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
        numberOfLines={1}
      >
        {store.name}
      </Text>

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

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <AppIcon name="location-outline" size={13} color={colors.textSecondary} />

          <Text
            style={[
              styles.metaText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {store.location || "منطقتك"}
          </Text>
        </View>

      </View>

      <View
        style={[
          styles.bottom,
          {
            borderTopColor: colors.border,
          },
        ]}
      >
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

        <Text
          style={[
            styles.deliveryFee,
            {
              color: colors.textMuted,
            },
          ]}
        >
          {store.deliveryFee || "أجرة التوصيل حسب المنطقة"}
        </Text>
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

  image: {
    height: 115,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
    position: "relative",
  },

  featuredBadge: {
    position: "absolute",
    top: Spacing.two,
    right: Spacing.two,
  },

  name: {
    marginTop: Spacing.three,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
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
    justifyContent: "flex-start",
    gap: Spacing.three,
    marginTop: Spacing.three,
  },

  metaItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
  },

  metaText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
  },

  bottom: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },

  productCount: {
    fontFamily: Fonts.medium,
    fontSize: 10,
  },

  deliveryFee: {
    fontFamily: Fonts.regular,
    fontSize: 10,
  },
});
