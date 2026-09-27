import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { categories, products, stores } from "@/constants/catalog";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";

export default function StoreDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{
    id?: string;
  }>();

  const { colors } = useTheme();
  const { itemCount } = useCart();

  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const store = useMemo(() => stores.find((item) => item.id === id), [id]);

  const storeProducts = useMemo(
    () => products.filter((product) => product.storeId === store?.id),
    [store?.id],
  );

  const storeCategories = useMemo(() => {
    const categoryIds = new Set(
      storeProducts.map((product) => product.categoryId),
    );

    return categories.filter((category) => categoryIds.has(category.id));
  }, [storeProducts]);

  const filteredProducts = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase("ar");

    return storeProducts.filter((product) => {
      const matchesCategory =
        selectedCategory === "all" || product.categoryId === selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const productName = product.name.toLocaleLowerCase("ar");

      const description = product.description.toLocaleLowerCase("ar");

      return productName.includes(query) || description.includes(query);
    });
  }, [searchText, selectedCategory, storeProducts]);

  const popularProducts = useMemo(
    () => filteredProducts.filter((product) => product.popular).slice(0, 6),
    [filteredProducts],
  );

  const offerProducts = useMemo(
    () => filteredProducts.filter((product) => product.offer).slice(0, 6),
    [filteredProducts],
  );

  const primaryCategory = useMemo(
    () =>
      store
        ? categories.find((category) => store.categoryIds.includes(category.id))
        : undefined,
    [store],
  );

  const handleProductPress = (productId: string) => {
    router.push({
      pathname: "/product-details",
      params: {
        id: productId,
      },
    } as Href);
  };

  const resetFilters = () => {
    setSearchText("");
    setSelectedCategory("all");
  };

  if (!store) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <AppHeader title="المتجر" showBack cartCount={itemCount} />

        <View style={styles.notFound}>
          <View
            style={[
              styles.notFoundIcon,
              {
                backgroundColor: colors.primaryLight,
              },
            ]}
          >
            <AppIcon
              name="storefront-outline"
              size={42}
              color={colors.primary}
            />
          </View>

          <Text
            style={[
              styles.notFoundTitle,
              {
                color: colors.text,
              },
            ]}
          >
            المتجر غير موجود
          </Text>

          <Text
            style={[
              styles.notFoundText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            يبدو أن هذا المتجر لم يعد متاحاً.
          </Text>

          <Pressable
            onPress={() => router.push("/stores")}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.primary,
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="العودة إلى المتاجر"
          >
            <Text
              style={[
                styles.backButtonText,
                {
                  color: colors.surface,
                },
              ]}
            >
              العودة إلى المتاجر
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const showHighlights = !searchText.trim() && selectedCategory === "all";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title={store.name} showBack cartCount={itemCount} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.storeHero,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.storeHeroIcon,
              {
                backgroundColor: colors.primaryLight,
              },
            ]}
          >
            <AppIcon
              name={primaryCategory?.icon ?? "storefront-outline"}
              size={58}
              color={colors.primary}
            />
          </View>

          <View style={styles.storeHeroInfo}>
            <View style={styles.storeTitleRow}>
              <Text
                style={[
                  styles.storeName,
                  {
                    color: colors.text,
                  },
                ]}
                numberOfLines={2}
              >
                {store.name}
              </Text>

              {store.featured ? (
                <View
                  style={[
                    styles.featuredBadge,
                    {
                      backgroundColor: colors.accent,
                    },
                  ]}
                >
                  <AppIcon name="star" size={11} color={colors.surface} />

                  <Text
                    style={[
                      styles.featuredText,
                      {
                        color: colors.surface,
                      },
                    ]}
                  >
                    مميز
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              style={[
                styles.storeDescription,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {store.description}
            </Text>

            <View style={styles.locationRow}>
              <AppIcon
                name="location-outline"
                size={15}
                color={colors.textSecondary}
              />

              <Text
                style={[
                  styles.locationText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                {store.location}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.statsCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <StoreStat
            icon="star"
            label="التقييم"
            value={store.rating.toFixed(1)}
            iconColor={colors.accent}
          />

          <View
            style={[
              styles.statDivider,
              {
                backgroundColor: colors.border,
              },
            ]}
          />

          <StoreStat
            icon="time-outline"
            label="التوصيل"
            value={store.deliveryTime}
            iconColor={colors.primary}
          />

          <View
            style={[
              styles.statDivider,
              {
                backgroundColor: colors.border,
              },
            ]}
          />

          <StoreStat
            icon="cube-outline"
            label="المنتجات"
            value={String(storeProducts.length)}
            iconColor={colors.primary}
          />
        </View>

        <View
          style={[
            styles.deliveryCard,
            {
              backgroundColor: colors.primaryLight,
            },
          ]}
        >
          <View
            style={[
              styles.deliveryIcon,
              {
                backgroundColor: colors.surface,
              },
            ]}
          >
            <AppIcon name="bicycle-outline" size={22} color={colors.primary} />
          </View>

          <View style={styles.deliveryInfo}>
            <Text
              style={[
                styles.deliveryTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              التوصيل إلى منطقتك
            </Text>

            <Text
              style={[
                styles.deliveryText,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {store.deliveryTime} • {store.deliveryFee}
            </Text>
          </View>

          <AppIcon name="checkmark-circle" size={21} color={colors.success} />
        </View>

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <AppIcon name="search-outline" size={19} color={colors.textMuted} />

          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="ابحث داخل المتجر..."
            placeholderTextColor={colors.textMuted}
            style={[
              styles.searchInput,
              {
                color: colors.text,
              },
            ]}
            textAlign="right"
            returnKeyType="search"
            accessibilityLabel="البحث داخل المتجر"
          />
        </View>

        {storeCategories.length > 0 ? (
          <View style={styles.categorySection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            >
              <CategoryChip
                label="الكل"
                icon="grid-outline"
                active={selectedCategory === "all"}
                onPress={() => setSelectedCategory("all")}
              />

              {storeCategories.map((category) => (
                <CategoryChip
                  key={category.id}
                  label={category.name}
                  icon={category.icon}
                  active={selectedCategory === category.id}
                  onPress={() => setSelectedCategory(category.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {showHighlights && popularProducts.length > 0 ? (
          <ProductSection
            title="الأكثر طلباً"
            subtitle="منتجات يطلبها الزبائن بكثرة"
            icon="trending-up-outline"
            products={popularProducts}
            onProductPress={handleProductPress}
          />
        ) : null}

        {showHighlights && offerProducts.length > 0 ? (
          <OfferSection
            products={offerProducts}
            onProductPress={handleProductPress}
          />
        ) : null}

        <View style={styles.allProductsSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {searchText.trim()
                  ? "نتائج البحث"
                  : selectedCategory === "all"
                    ? "كل المنتجات"
                    : "منتجات التصنيف"}
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  {
                    color: colors.textMuted,
                  },
                ]}
              >
                {filteredProducts.length} منتج
              </Text>
            </View>

            <View
              style={[
                styles.sectionIcon,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon name="grid-outline" size={20} color={colors.primary} />
            </View>
          </View>

          {filteredProducts.length > 0 ? (
            <View style={styles.productGrid}>
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  compact
                  showStore={false}
                  showOffer
                  onPress={() => handleProductPress(product.id)}
                />
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.emptyProducts,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor: colors.primaryLight,
                  },
                ]}
              >
                <AppIcon
                  name="search-outline"
                  size={34}
                  color={colors.primary}
                />
              </View>

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                لا توجد منتجات
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                لم نجد منتجات مطابقة للبحث أو التصنيف المحدد.
              </Text>

              <Pressable
                onPress={resetFilters}
                style={({ pressed }) => [
                  styles.resetButton,
                  {
                    backgroundColor: colors.primary,
                  },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="عرض جميع المنتجات"
              >
                <Text
                  style={[
                    styles.resetButtonText,
                    {
                      color: colors.surface,
                    },
                  ]}
                >
                  عرض جميع المنتجات
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

type StoreStatProps = {
  icon: React.ComponentProps<typeof AppIcon>["name"];
  label: string;
  value: string;
  iconColor?: string;
};

function StoreStat({ icon, label, value, iconColor }: StoreStatProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.stat}>
      <AppIcon name={icon} size={18} color={iconColor ?? colors.primary} />

      <Text
        style={[
          styles.statValue,
          {
            color: colors.text,
          },
        ]}
      >
        {value}
      </Text>

      <Text
        style={[
          styles.statLabel,
          {
            color: colors.textMuted,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

type ProductSectionProps = {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof AppIcon>["name"];
  products: (typeof products)[number][];
  onProductPress: (productId: string) => void;
};

function ProductSection({
  title,
  subtitle,
  icon,
  products: sectionProducts,
  onProductPress,
}: ProductSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            {title}
          </Text>

          <Text
            style={[
              styles.sectionSubtitle,
              {
                color: colors.textMuted,
              },
            ]}
          >
            {subtitle}
          </Text>
        </View>

        <View
          style={[
            styles.sectionIcon,
            {
              backgroundColor: colors.primaryLight,
            },
          ]}
        >
          <AppIcon name={icon} size={19} color={colors.primary} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      >
        {sectionProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            showStore={false}
            showOffer
            onPress={() => onProductPress(product.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

type OfferSectionProps = {
  products: (typeof products)[number][];
  onProductPress: (productId: string) => void;
};

function OfferSection({
  products: sectionProducts,
  onProductPress,
}: OfferSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            عروض المتجر
          </Text>

          <Text
            style={[
              styles.sectionSubtitle,
              {
                color: colors.textMuted,
              },
            ]}
          >
            منتجات مميزة بأسعار العرض
          </Text>
        </View>

        <View
          style={[
            styles.sectionIcon,
            {
              backgroundColor: colors.accentLight,
            },
          ]}
        >
          <AppIcon name="pricetags-outline" size={19} color={colors.accent} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      >
        {sectionProducts.map((product) => (
          <OfferCard
            key={product.id}
            product={product}
            onPress={() => onProductPress(product.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.ten,
  },

  storeHero: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.four,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  storeHeroIcon: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.xl,
  },

  storeHeroInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  storeTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  storeName: {
    flexShrink: 1,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "right",
  },

  featuredBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },

  featuredText: {
    fontFamily: Fonts.bold,
    fontSize: 9,
  },

  storeDescription: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 21,
    textAlign: "right",
  },

  locationRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.two,
  },

  locationText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  statsCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  stat: {
    minWidth: 75,
    alignItems: "center",
    gap: 2,
  },

  statValue: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  statLabel: {
    fontFamily: Fonts.regular,
    fontSize: 9,
  },

  statDivider: {
    width: 1,
    height: 38,
  },

  deliveryCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },

  deliveryIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  deliveryInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  deliveryTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  deliveryText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
  },

  searchContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 50,
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  searchInput: {
    flex: 1,
    minHeight: 48,
    marginStart: Spacing.two,
    paddingVertical: 0,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  categorySection: {
    marginTop: Spacing.three,
  },

  categoryList: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },

  section: {
    marginTop: Spacing.six,
  },

  allProductsSection: {
    marginTop: Spacing.six,
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  sectionSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  sectionIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  horizontalList: {
    flexDirection: "row-reverse",
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },

  productGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: Spacing.three,
  },

  emptyProducts: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 230,
    padding: Spacing.five,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  emptyIcon: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  emptyTitle: {
    marginTop: Spacing.four,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  emptyText: {
    maxWidth: 280,
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    textAlign: "center",
  },

  resetButton: {
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Radius.full,
  },

  resetButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.six,
  },

  notFoundIcon: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  notFoundTitle: {
    marginTop: Spacing.four,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
  },

  notFoundText: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },

  backButton: {
    marginTop: Spacing.five,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Radius.full,
  },

  backButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
  },

  pressed: {
    opacity: 0.72,
  },
});
