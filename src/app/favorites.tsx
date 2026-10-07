import { useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { CustomerCatalogStatus } from "@/components/marketplace/CustomerCatalogStatus";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useTheme } from "@/context/ThemeContext";

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { categories, products, stores } = useCustomerCatalog();

  const { favoriteIds, removeFavorite, clearFavorites } = useFavorites();

  const favoriteProducts = products.filter((product) =>
    favoriteIds.includes(product.id),
  );

  const handleClearFavorites = () => {
    Alert.alert("تفريغ المفضلة", "هل تريد إزالة جميع المنتجات من المفضلة؟", [
      {
        text: "إلغاء",
        style: "cancel",
      },
      {
        text: "تفريغ",
        style: "destructive",
        onPress: clearFavorites,
      },
    ]);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="المفضلة" showBack cartCount={itemCount} mode="customer" />

      {favoriteProducts.length === 0 ? (
        <>
        <CustomerCatalogStatus />
        <EmptyFavorites onContinue={() => router.push("/home")} />
        </>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.summaryHeader}>
            <View style={styles.summaryInfo}>
              <Text
                style={[
                  styles.title,
                  {
                    color: colors.text,
                  },
                ]}
              >
                منتجاتك المفضلة
              </Text>

              <Text
                style={[
                  styles.subtitle,
                  {
                    color: colors.textMuted,
                  },
                ]}
              >
                {favoriteProducts.length} منتج محفوظ
              </Text>
            </View>

            <Pressable
              onPress={handleClearFavorites}
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="تفريغ المفضلة"
            >
              <AppIcon name="trash-outline" size={17} color={colors.error} />

              <Text
                style={[
                  styles.clearText,
                  {
                    color: colors.error,
                  },
                ]}
              >
                تفريغ
              </Text>
            </Pressable>
          </View>

          <View style={styles.itemsList}>
            {favoriteProducts.map((product) => {
              const category = categories.find(
                (item) => item.id === product.categoryId,
              );

              const store = stores.find((item) => item.id === product.storeId);

              return (
                <Pressable
                  key={product.id}
                  onPress={() =>
                    router.push({
                      pathname: "/product-details",
                      params: {
                        id: product.id,
                      },
                    })
                  }
                  style={({ pressed }) => [
                    styles.itemCard,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={product.name}
                >
                  <View style={styles.itemTop}>
                    <View
                      style={[
                        styles.itemVisual,
                        {
                          backgroundColor: colors.primaryLight,
                        },
                      ]}
                    >
                      <AppIcon
                        name={category?.icon ?? "cube-outline"}
                        size={30}
                        color={colors.primary}
                      />
                    </View>

                    <View style={styles.itemInfo}>
                      <Text
                        style={[
                          styles.itemName,
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
                          styles.storeName,
                          {
                            color: colors.primary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {store?.name ?? "متجر"}
                      </Text>

                      <Text
                        style={[
                          styles.itemUnit,
                          {
                            color: colors.textMuted,
                          },
                        ]}
                      >
                        {product.unit}
                      </Text>
                    </View>

                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        removeFavorite(product.id);
                      }}
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.pressed,
                      ]}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`إزالة ${product.name} من المفضلة`}
                    >
                      <AppIcon name="heart" size={23} color={colors.error} />
                    </Pressable>
                  </View>

                  <View
                    style={[
                      styles.itemBottom,
                      {
                        borderTopColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.priceContainer}>
                      <Text
                        style={[
                          styles.price,
                          {
                            color: colors.text,
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

                    <View style={styles.openDetails}>
                      <Text
                        style={[
                          styles.openDetailsText,
                          {
                            color: colors.primary,
                          },
                        ]}
                      >
                        عرض التفاصيل
                      </Text>

                      <AppIcon
                        name="chevron-back-outline"
                        size={17}
                        color={colors.primary}
                      />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

type EmptyFavoritesProps = {
  onContinue: () => void;
};

function EmptyFavorites({ onContinue }: EmptyFavoritesProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon name="heart-outline" size={55} color={colors.primary} />
      </View>

      <Text
        style={[
          styles.emptyTitle,
          {
            color: colors.text,
          },
        ]}
      >
        المفضلة فارغة
      </Text>

      <Text
        style={[
          styles.emptyText,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        لم تحفظ أي منتجات بعد. تصفح المتاجر واختر المنتجات التي تريد الرجوع
        إليها لاحقاً.
      </Text>

      <Pressable
        onPress={onContinue}
        style={({ pressed }) => [
          styles.browseButton,
          {
            backgroundColor: colors.primary,
          },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="تصفح المتاجر"
      >
        <AppIcon name="storefront-outline" size={20} color={colors.surface} />

        <Text
          style={[
            styles.browseText,
            {
              color: colors.surface,
            },
          ]}
        >
          تصفح المتاجر
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.ten,
  },

  summaryHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.four,
  },

  summaryInfo: {
    alignItems: "flex-end",
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "right",
  },

  subtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  clearButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },

  clearText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  itemsList: {
    gap: Spacing.three,
  },

  itemCard: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  itemTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
  },

  itemVisual: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  itemInfo: {
    flex: 1,
    marginHorizontal: Spacing.three,
    alignItems: "flex-end",
  },

  itemName: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    lineHeight: 21,
    textAlign: "right",
  },

  storeName: {
    marginTop: 3,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  itemUnit: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  removeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  itemBottom: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },

  priceContainer: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 4,
  },

  price: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  currency: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  openDetails: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
  },

  openDetailsText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.six,
    paddingBottom: Spacing.ten,
  },

  emptyIcon: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  emptyTitle: {
    marginTop: Spacing.five,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
  },

  emptyText: {
    maxWidth: 330,
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    textAlign: "center",
  },

  browseButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    minHeight: 50,
    marginTop: Spacing.five,
    paddingHorizontal: Spacing.six,
    borderRadius: Radius.md,
  },

  browseText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
  },

  pressed: {
    opacity: 0.7,
  },
});
