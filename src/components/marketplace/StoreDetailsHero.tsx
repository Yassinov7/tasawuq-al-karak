import { StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { RatingSummary } from "@/components/marketplace/RatingStars";
import type { IconName, Store } from "@/constants/catalog";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";

type StoreDetailsHeroProps = {
  store: Store;
  categoryIcon?: IconName;
};

export function StoreDetailsHero({ store, categoryIcon }: StoreDetailsHeroProps) {
  const { colors } = useTheme();
  const { storeRatings } = useCustomerCatalog();
  const rating = storeRatings.get(store.id);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: colors.primaryLight }]}>
        <AppIcon name={categoryIcon ?? "storefront-outline"} size={58} color={colors.primary} />
      </View>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {store.name}
          </Text>
          {store.featured ? (
            <View style={[styles.featuredBadge, { backgroundColor: colors.accent }]}>
              <AppIcon name="star" size={11} color={colors.surface} />
              <Text style={[styles.featuredText, { color: colors.surface }]}>مميز</Text>
            </View>
          ) : null}
        </View>

        {store.description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{store.description}</Text> : null}

        {rating ? <View style={styles.rating}><RatingSummary averageRating={rating.averageRating} ratingCount={rating.ratingCount} /></View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: Radius.xl,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: Spacing.three,
    padding: Spacing.four,
  },
  icon: {
    alignItems: "center",
    borderRadius: Radius.lg,
    height: 86,
    justifyContent: "center",
    width: 86,
  },
  info: { alignItems: "flex-end", flex: 1 },
  titleRow: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two },
  name: { flexShrink: 1, fontFamily: Fonts.bold, fontSize: FontSizes.xl, textAlign: "right" },
  featuredBadge: {
    alignItems: "center",
    borderRadius: Radius.full,
    flexDirection: "row-reverse",
    gap: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  featuredText: { fontFamily: Fonts.bold, fontSize: 10 },
  description: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 21, marginTop: Spacing.one, textAlign: "right" },
  rating: { alignSelf: "flex-end", marginTop: Spacing.two },
});
