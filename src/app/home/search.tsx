import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useCatalog } from "@/context/CatalogContext";
import { useTheme } from "@/context/ThemeContext";

function normalizeText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ar")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ");
}

export default function SearchTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { categories, products, stores } = useCatalog();

  const params = useLocalSearchParams<{
    q?: string;
    category?: string;
  }>();

  const initialText =
    typeof params.q === "string"
      ? params.q
      : typeof params.category === "string"
        ? params.category
        : "";

  const [searchText, setSearchText] = useState(initialText);

  const query = normalizeText(searchText);

  const results = useMemo(() => {
    if (!query) {
      return {
        stores: [],
        products: [],
        categories: [],
      };
    }

    const storeResults = stores
      .map((store) => {
        const storeName = normalizeText(store.name);
        const description = normalizeText(store.description);

        const directMatch = storeName === query;
        const nameMatch = storeName.includes(query);
        const descriptionMatch = description.includes(query);

        const categoryMatch = store.categoryIds.some((categoryId) => {
          const category = categories.find((item) => item.id === categoryId);

          return category
            ? normalizeText(category.name).includes(query)
            : false;
        });

        let score = 0;

        if (directMatch) {
          score += 1000;
        } else if (nameMatch) {
          score += 700;
        } else if (categoryMatch) {
          score += 500;
        } else if (descriptionMatch) {
          score += 200;
        }

        return {
          store,
          score,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => item.store);

    const productResults = products
      .map((product) => {
        const productName = normalizeText(product.name);
        const description = normalizeText(product.description);
        const unit = normalizeText(product.unit);

        const directMatch = productName === query;
        const nameMatch = productName.includes(query);
        const descriptionMatch = description.includes(query);
        const unitMatch = unit.includes(query);

        const categoryMatch = (() => {
          const category = categories.find(
            (item) => item.id === product.categoryId,
          );

          return category
            ? normalizeText(category.name).includes(query)
            : false;
        })();

        let score = 0;

        if (directMatch) {
          score += 1000;
        } else if (nameMatch) {
          score += 700;
        } else if (categoryMatch) {
          score += 500;
        } else if (descriptionMatch) {
          score += 200;
        } else if (unitMatch) {
          score += 100;
        }

        return {
          product,
          score,
        };
      })
      .filter((item) => item.score > 0 && item.product.available)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((item) => item.product);

    const categoryResults = categories
      .map((category) => {
        const categoryName = normalizeText(category.name);

        const directMatch = categoryName === query;
        const partialMatch = categoryName.includes(query);

        return {
          category,
          score: directMatch ? 1000 : partialMatch ? 700 : 0,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.category);

    return {
      stores: storeResults,
      products: productResults,
      categories: categoryResults,
    };
  }, [query, categories, products, stores]);

  const totalResults =
    results.stores.length + results.products.length + results.categories.length;

  const handleSubmit = () => {
    Keyboard.dismiss();
  };

  const handleStorePress = (storeId: string) => {
    router.push({
      pathname: "/store-details",
      params: {
        id: storeId,
      },
    } as Href);
  };

  const handleProductPress = (productId: string) => {
    router.push({
      pathname: "/product-details",
      params: {
        id: productId,
      },
    } as Href);
  };

  const handleCategoryPress = (categoryName: string) => {
    setSearchText(categoryName);
    Keyboard.dismiss();
  };

  const handleQuickSearch = (value: string) => {
    setSearchText(value);
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
      <AppHeader title="البحث" showBack cartCount={itemCount} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.searchLeading,
              {
                backgroundColor: colors.primaryLight,
              },
            ]}
          >
            <AppIcon name="search-outline" size={19} color={colors.primary} />
          </View>

          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="ابحث عن متجر أو منتج أو تصنيف"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                color: colors.text,
              },
            ]}
            textAlign="right"
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            autoFocus={false}
          />

          {searchText.length > 0 ? (
            <Pressable
              onPress={() => setSearchText("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="مسح البحث"
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.searchButton,
              {
                backgroundColor: colors.primary,
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="بحث"
          >
            <AppIcon name="search-outline" size={20} color={colors.surface} />
          </Pressable>
        </View>

        {!query ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.heroIcon,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.heroIconInner,
                  {
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <AppIcon
                  name="search-outline"
                  size={36}
                  color={colors.primary}
                />
              </View>
            </View>

            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                },
              ]}
            >
              ماذا تبحث عنه؟
            </Text>

            <Text
              style={[
                styles.description,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              ابحث عن متجر أو منتج أو تصنيف من متاجر الكرك الشرقي.
            </Text>

            <View
              style={[
                styles.quickSearchCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.quickHeader}>
                <View
                  style={[
                    styles.quickIcon,
                    {
                      backgroundColor: colors.primaryLight,
                    },
                  ]}
                >
                  <AppIcon
                    name="sparkles-outline"
                    size={17}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.quickTitleArea}>
                  <Text
                    style={[
                      styles.quickTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    جرّب البحث عن
                  </Text>

                  <Text
                    style={[
                      styles.quickSubtitle,
                      {
                        color: colors.textMuted,
                      },
                    ]}
                  >
                    كلمات شائعة
                  </Text>
                </View>
              </View>

              <View style={styles.quickChips}>
                {["حليب", "قهوة", "مطاعم", "موبايل", "ملابس"].map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => handleQuickSearch(item)}
                    style={({ pressed }) => [
                      styles.quickChip,
                      {
                        backgroundColor: colors.primaryLight,
                        borderColor: colors.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        {
                          color: colors.primary,
                        },
                      ]}
                    >
                      {item}
                    </Text>

                    <AppIcon
                      name="arrow-back"
                      size={12}
                      color={colors.primary}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : totalResults === 0 ? (
          <View style={styles.noResults}>
            <AppEmptyState
              icon="search-outline"
              title="لم نجد نتائج"
              description={`لم نجد متجراً أو منتجاً يطابق «${searchText.trim()}».`}
            />

            <Text
              style={[
                styles.emptyHint,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              جرّب كلمة مختلفة أو اسم منتج أقصر.
            </Text>
          </View>
        ) : (
          <View style={styles.results}>
            <View
              style={[
                styles.resultsHeader,
                {
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View style={styles.resultsTitleArea}>
                <Text
                  style={[
                    styles.resultsTitle,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  نتائج البحث
                </Text>

                <Text
                  style={[
                    styles.resultsSubtitle,
                    {
                      color: colors.textMuted,
                    },
                  ]}
                >
                  لـ «{searchText.trim()}»
                </Text>
              </View>

              <View
                style={[
                  styles.resultsCountBadge,
                  {
                    backgroundColor: colors.primaryLight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.resultsCount,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  {totalResults}
                </Text>

                <Text
                  style={[
                    styles.resultsCountLabel,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  نتيجة
                </Text>
              </View>
            </View>

            {results.categories.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="التصنيفات"
                  icon="pricetags-outline"
                  colors={colors}
                />

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                >
                  {results.categories.map((category) => (
                    <CategoryChip
                      key={category.id}
                      label={category.name}
                      icon={category.icon}
                      onPress={() => handleCategoryPress(category.name)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {results.stores.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="المتاجر"
                  icon="storefront-outline"
                  colors={colors}
                />

                <View style={styles.storeResults}>
                  {results.stores.map((store) => {
                    const category = categories.find((item) =>
                      store.categoryIds.includes(item.id),
                    );

                    return (
                      <Pressable
                        key={store.id}
                        onPress={() => handleStorePress(store.id)}
                        style={({ pressed }) => [
                          styles.storeResult,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.storeResultIcon,
                            {
                              backgroundColor: colors.primaryLight,
                            },
                          ]}
                        >
                          <AppIcon
                            name={category?.icon ?? "storefront-outline"}
                            size={25}
                            color={colors.primary}
                          />
                        </View>

                        <View style={styles.storeResultInfo}>
                          <Text
                            style={[
                              styles.storeResultName,
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
                              styles.storeResultDescription,
                              {
                                color: colors.textSecondary,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {store.description}
                          </Text>

                          <View style={styles.storeResultMeta}>
                            <View style={styles.storeMetaItem}>
                              <AppIcon name="storefront-outline" size={12} color={colors.primary} />

                              <Text
                                style={[
                                  styles.storeMetaText,
                                  {
                                    color: colors.textMuted,
                                  },
                                ]}
                              >
                                {store.rating ? store.rating.toFixed(1) : "متجر معتمد"}
                              </Text>
                            </View>

                            <View style={styles.storeMetaItem}>
                              <AppIcon name="location-outline" size={12} color={colors.textMuted} />

                              <Text
                                style={[
                                  styles.storeMetaText,
                                  {
                                    color: colors.textMuted,
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
                            styles.storeArrow,
                            {
                              backgroundColor: colors.surfaceSecondary,
                            },
                          ]}
                        >
                          <AppIcon
                            name="chevron-back"
                            size={16}
                            color={colors.textSecondary}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {results.products.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="المنتجات"
                  icon="cube-outline"
                  colors={colors}
                />

                <View style={styles.productGrid}>
                  {results.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      compact
                      showStore
                      showOffer
                      onPress={() => handleProductPress(product.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

type ThemeColors = ReturnType<typeof useTheme>["colors"];

type SectionHeaderProps = {
  title: string;
  icon: React.ComponentProps<typeof AppIcon>["name"];
  colors: ThemeColors;
};

function SectionHeader({ title, icon, colors }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View
        style={[
          styles.sectionIcon,
          {
            backgroundColor: colors.primaryLight,
          },
        ]}
      >
        <AppIcon name={icon} size={18} color={colors.primary} />
      </View>

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

  searchBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 58,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  searchLeading: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  input: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: Spacing.three,
    paddingVertical: 0,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
  },

  clearButton: {
    width: 32,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  searchButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  emptyState: {
    alignItems: "center",
    paddingTop: Spacing.seven,
  },

  heroIcon: {
    width: 112,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  heroIconInner: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  title: {
    marginTop: Spacing.five,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
  },

  description: {
    maxWidth: 330,
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    textAlign: "center",
  },

  quickSearchCard: {
    width: "100%",
    marginTop: Spacing.six,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  quickHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.three,
  },

  quickIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  quickTitleArea: {
    flex: 1,
    alignItems: "flex-end",
  },

  quickTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  quickSubtitle: {
    marginTop: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  quickChips: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: Spacing.three,
  },

  quickChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  quickChipText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  noResults: {
    alignItems: "center",
    paddingTop: Spacing.seven,
  },

  emptyHint: {
    marginTop: Spacing.three,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  results: {
    marginTop: Spacing.five,
  },

  resultsHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },

  resultsTitleArea: {
    flex: 1,
    alignItems: "flex-end",
  },

  resultsTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
  },

  resultsSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  resultsCountBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },

  resultsCount: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  resultsCountLabel: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  section: {
    marginTop: Spacing.five,
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },

  sectionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
  },

  horizontalList: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },

  storeResults: {
    gap: Spacing.two,
  },

  storeResult: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 86,
    padding: Spacing.three,
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  storeResultIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  storeResultInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  storeResultName: {
    width: "100%",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  storeResultDescription: {
    width: "100%",
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  storeResultMeta: {
    flexDirection: "row-reverse",
    gap: Spacing.three,
    marginTop: 4,
  },

  storeMetaItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
  },

  storeMetaText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
  },

  storeArrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  productGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: Spacing.three,
  },

  pressed: {
    opacity: 0.7,
  },
});
