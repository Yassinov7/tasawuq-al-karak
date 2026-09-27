import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppBadge } from "@/components/ui/AppBadge";
import { AppIcon } from "@/components/ui/AppIcon";
import { categories, products, stores } from "@/constants/catalog";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Product = (typeof products)[number];

type ProductCardProps = {
  product: Product;
  onPress: () => void;
  compact?: boolean;
  showStore?: boolean;
  showOffer?: boolean;
};

export function ProductCard({
  product,
  onPress,
  compact = false,
  showStore = true,
  showOffer = false,
}: ProductCardProps) {
  const { colors } = useTheme();

  const category = categories.find((item) => item.id === product.categoryId);

  const store = stores.find((item) => item.id === product.storeId);

  const iconSize = compact ? 30 : 34;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={product.name}
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
          compact ? styles.compactImage : styles.normalImage,
          {
            backgroundColor: product.offer
              ? colors.accentLight
              : colors.primaryLight,
          },
        ]}
      >
        <AppIcon
          name={category?.icon ?? "cube-outline"}
          size={iconSize}
          color={colors.primary}
        />

        {showOffer && product.offer ? (
          <View style={styles.offerBadge}>
            <AppBadge text="عرض" variant="accent" icon="pricetag-outline" />
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
        numberOfLines={2}
      >
        {product.name}
      </Text>

      {showStore ? (
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
      ) : null}

      <View style={styles.priceRow}>
        <Text
          style={[
            styles.price,
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

  compactCard: {
    width: "48.5%",
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

  compactImage: {
    height: 105,
  },

  offerBadge: {
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
