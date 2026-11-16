import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";
import { RatingSummary } from "@/components/marketplace/RatingStars";
import { StorePromoVideo } from "@/components/marketplace/StorePromoVideo";
import { AppIcon } from "@/components/ui/AppIcon";
import type { IconName, Store } from "@/types/catalog";
import { FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import type { PublishedStoreVideo } from "@/lib/customer-store-details";

type Props = {
  store: Store;
  category?: string;
  categoryIcon?: IconName;
  logo?: { url: string; key: string };
  acceptsOrders: boolean | null;
  video?: PublishedStoreVideo | null;
  owner: string | null;
  onReviewsPress: () => void;
  followAction?: ReactNode;
};

export function StoreDetailsHero({ store, category, categoryIcon, logo, acceptsOrders, video, owner, onReviewsPress, followAction }: Props) {
  const { colors } = useTheme();
  const { storeRatings } = useCustomerCatalog();
  const rating = storeRatings.get(store.id);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {video ? <StorePromoVideo key={video.id} asset={video} owner={owner} /> : null}
      <View style={styles.identity}>
        <View style={[styles.logo, { backgroundColor: colors.primaryLight }]}>
          <ShoppingCardImage uri={logo?.url} cacheKey={logo?.key} restricted fit="contain"
            icon={categoryIcon ?? "storefront-outline"} />
        </View>
        <View style={styles.info}>
          <Text accessibilityRole="header" style={[styles.name, { color: colors.text }]}>{store.name}</Text>
          {category ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{category}</Text> : null}
          {acceptsOrders !== null ? <Text style={[styles.status, { color: acceptsOrders ? colors.primary : colors.textSecondary }]}>
            {acceptsOrders ? "يستقبل الطلبات" : "لا يستقبل طلبات حاليًا"}
          </Text> : null}
          {followAction}
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="فتح تقييمات ومراجعات المتجر"
        onPress={onReviewsPress} style={({ pressed }) => [styles.reviews, {
          backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.72 : 1,
        }]}>
        <View style={styles.reviewInfo}>
          <Text style={[styles.reviewTitle, { color: colors.primary }]}>التقييمات والمراجعات</Text>
          {rating?.ratingCount ? <RatingSummary averageRating={rating.averageRating} ratingCount={rating.ratingCount} />
            : <Text style={[styles.meta, { color: colors.textMuted }]}>لا توجد تقييمات بعد</Text>}
        </View>
        <AppIcon name="chevron-back-outline" size={18} color={colors.primary} />
      </Pressable>
      {store.description.trim() ? <Text numberOfLines={3} style={[styles.description, { color: colors.text }]}>{store.description}</Text> : null}
      {store.location.trim() ? <Text numberOfLines={2} style={[styles.meta, { color: colors.textSecondary }]}>العنوان · {store.location}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.three },
  identity: { flexDirection: "row-reverse", alignItems: "center", gap: Spacing.three },
  logo: { width: 60, height: 60, borderRadius: Radius.lg, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  info: { flex: 1, minWidth: 0, alignItems: "stretch" },
  name: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, ...RtlText },
  status: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs, ...RtlText },
  reviews: { minHeight: 52, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.two,
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  reviewInfo: { flex: 1, minWidth: 0, alignItems: "flex-end", gap: Spacing.one },
  reviewTitle: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
  description: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, ...RtlText },
  meta: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, ...RtlText },
});
