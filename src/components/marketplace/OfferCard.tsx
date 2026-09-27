import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppBadge } from "@/components/ui/AppBadge";
import { AppIcon } from "@/components/ui/AppIcon";
import { categories, products, stores } from "@/constants/catalog";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Product = (typeof products)[number];

type OfferCardProps = {
  product: Product;
  onPress: () => void;
  featured?: boolean;
};

export function OfferCard({
  product,
  onPress,
  featured = false,
}: OfferCardProps) {
  const { colors } = useTheme();

  const category = categories.find((item) => item.id === product.categoryId);

  const store = stores.find((item) => item.id === product.storeId);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={({ pressed }) => [
        styles.card,
        featured ? styles.featuredCard : styles.normalCard,
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
          featured ? styles.featuredImage : styles.normalImage,
          {
            backgroundColor: colors.accentLight,
          },
        ]}
      >
        <AppIcon
          name={category?.icon ?? "cube-outline"}
          size={featured ? 40 : 32}
          color={colors.primary}
        />

        <View style={styles.badge}>
          <AppBadge text="عرض" variant="accent" icon="pricetag-outline" />
        </View>
      </View>

      <Text
        style={[
          styles.name,
          featured && styles.featuredName,
          {
            color: colors.text,
          },
        ]}
        numberOfLines={2}
      >
        {product.name}
      </Text>

      <Text
        style={[
          styles.store,
          {
            color: colors.textMuted,
          },
        ]}
        numberOfLines={1}
      >
        {store?.name ?? "متجر محلي"}
      </Text>

      <View style={styles.priceRow}>
        <Text
          style={[
            styles.price,
            featured && styles.featuredPrice,
            {
              color: colors.primary,
            },
          ]}
        >
          {product.price.toLocaleString("en-US")}
        </Text>

        <Text
          style={[
            styles.currency,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          ل.س
        </Text>
      </View>

      <Text
        style={[
          styles.unit,
          {
            color: colors.textMuted,
          },
        ]}
      >
        {product.unit}
      </Text>
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
    width: 175,
  },

  featuredCard: {
    width: 215,
  },

  image: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
    position: "relative",
  },

  normalImage: {
    height: 110,
  },

  featuredImage: {
    height: 125,
  },

  badge: {
    position: "absolute",
    top: Spacing.two,
    right: Spacing.two,
  },

  name: {
    marginTop: Spacing.three,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    lineHeight: 19,
    textAlign: "right",
  },

  featuredName: {
    fontSize: FontSizes.md,
  },

  store: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: 10,
    textAlign: "right",
  },

  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 3,
    marginTop: Spacing.three,
  },

  price: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  featuredPrice: {
    fontSize: FontSizes.lg,
  },

  currency: {
    fontFamily: Fonts.medium,
    fontSize: 9,
  },

  unit: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
    textAlign: "right",
  },
});
