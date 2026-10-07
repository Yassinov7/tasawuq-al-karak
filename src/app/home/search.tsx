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
import { CustomerCatalogStatus } from "@/components/marketplace/CustomerCatalogStatus";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";

function normalizeText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

function matchesAllTerms(value: string, terms: string[]) {
  const normalized = normalizeText(value);
  return terms.every((term) => normalized.includes(term));
}

type SearchFilter = "all" | "products" | "stores" | "categories";
type ProductSort = "relevance" | "price-ascending" | "price-descending";
type CurrencyFilter = "all" | "SYP" | "USD";

const searchFilters: { id: SearchFilter; label: string; icon: React.ComponentProps<typeof AppIcon>["name"] }[] = [
  { id: "all", label: "الكل", icon: "apps-outline" },
  { id: "products", label: "المنتجات", icon: "cube-outline" },
  { id: "stores", label: "المتاجر", icon: "storefront-outline" },
  { id: "categories", label: "التصنيفات", icon: "grid-outline" },
];

export default function SearchTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { categories, products, stores, storeCategories } =
    useCustomerCatalog();

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
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("all");
  const [productSort, setProductSort] = useState<ProductSort>("relevance");
  const [filtersVisible, setFiltersVisible] = useState(false);

  const query = normalizeText(searchText);
  const terms = useMemo(() => query.split(" ").filter(Boolean), [query]);

  const results = useMemo(() => {
    if (!query) {
      return {
        stores,
        products: products.filter((product) => product.available),
        categories,
      };
    }

    const storeResults = stores
      .map((store) => {
        const storeName = normalizeText(store.name);

        const directMatch = storeName === query;
        const nameMatch = matchesAllTerms(store.name, terms);
        const descriptionMatch = matchesAllTerms(store.description, terms);

        const categoryMatch = store.categoryIds.some((categoryId) => {
          const category = storeCategories.find((item) => item.id === categoryId);

          return category
            ? matchesAllTerms(category.name, terms)
            : false;
        });

        let score = 0;

        if (directMatch) {
          score += 1000;
        } else if (storeName.startsWith(query)) {
          score += 700;
        } else if (nameMatch) {
          score += 600;
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
      .map((item) => item.store);

    const productResults = products
      .map((product) => {
        const productName = normalizeText(product.name);
        const directMatch = productName === query;
        const nameMatch = matchesAllTerms(product.name, terms);
        const descriptionMatch = matchesAllTerms(product.description, terms);
        const unitMatch = matchesAllTerms(product.unit, terms);

        const categoryMatch = (() => {
          const category = categories.find(
            (item) => item.id === product.categoryId,
          );

          return category
            ? matchesAllTerms(category.name, terms)
            : false;
        })();

        let score = 0;

        if (directMatch) {
          score += 1000;
        } else if (productName.startsWith(query)) {
          score += 700;
        } else if (nameMatch) {
          score += 600;
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
      .map((item) => item.product);

    const categoryResults = categories
      .map((category) => {
        const categoryName = normalizeText(category.name);

        const directMatch = categoryName === query;
        const partialMatch = matchesAllTerms(category.name, terms);

        return {
          category,
          score: directMatch ? 1000 : partialMatch ? 700 : 0,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.category);

    return {
      stores: storeResults,
      products: productResults,
      categories: categoryResults,
    };
  }, [query, terms, categories, products, storeCategories, stores]);

  const visibleResults = useMemo(() => {
    const filteredProducts = results.products.filter((product) => {
      const matchesCategory =
        selectedCategoryId === null || product.categoryId === selectedCategoryId;
      const matchesCurrency =
        currencyFilter === "all" || (product.currency ?? "SYP") === currencyFilter;
      return matchesCategory && matchesCurrency;
    });
    const sortedProducts = [...filteredProducts];

    if (currencyFilter !== "all" && productSort === "price-ascending") {
      sortedProducts.sort((a, b) => a.price - b.price);
    } else if (currencyFilter !== "all" && productSort === "price-descending") {
      sortedProducts.sort((a, b) => b.price - a.price);
    }

    if (filter === "products") {
      return { stores: [], products: sortedProducts, categories: [] };
    }
    if (filter === "stores") {
      return { stores: results.stores, products: [], categories: [] };
    }
    if (filter === "categories") {
      return { stores: [], products: [], categories: results.categories };
    }
    return { ...results, products: sortedProducts };
  }, [currencyFilter, filter, productSort, results, selectedCategoryId]);

  const filterCounts: Record<SearchFilter, number> = query
    ? {
        all: results.stores.length + results.products.length + results.categories.length,
        products: results.products.length,
        stores: results.stores.length,
        categories: results.categories.length,
      }
    : {
        all: stores.length + products.filter((product) => product.available).length + categories.length,
        products: products.filter((product) => product.available).length,
        stores: stores.length,
        categories: categories.length,
      };
  const productCategories = query
    ? categories.filter((category) =>
        results.products.some((product) => product.categoryId === category.id),
      )
    : categories.filter((category) =>
        products.some((product) => product.available && product.categoryId === category.id),
      );
  const productResultsForRefinement = query
    ? results.products.length > 0
    : products.some((product) => product.available);
  const activeFilterCount =
    Number(filter !== "all") +
    Number(selectedCategoryId !== null) +
    Number(currencyFilter !== "all") +
    Number(productSort !== "relevance");
  const totalResults = visibleResults.stores.length +
    visibleResults.products.length + visibleResults.categories.length;
  const quickSearches = [...new Set([
    ...products.filter((product) => product.popular).map((product) => product.name),
    ...categories.slice(0, 4).map((category) => category.name),
  ])].slice(0, 5);

  const handleSubmit = () => {
    Keyboard.dismiss();
  };

  const handleQueryChange = (value: string) => {
    setSearchText(value);
    setSelectedCategoryId(null);
    setCurrencyFilter("all");
    setProductSort("relevance");
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
    setFilter("products");
    setSelectedCategoryId(null);
    setCurrencyFilter("all");
    setProductSort("relevance");
    Keyboard.dismiss();
  };

  const handleQuickSearch = (value: string) => {
    setSearchText(value);
    setSelectedCategoryId(null);
    setCurrencyFilter("all");
    setProductSort("relevance");
    setFilter("all");
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
      <CustomerCatalogStatus />
      <AppHeader title="البحث" showBack cartCount={itemCount} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <AppIcon name="search-outline" size={19} color={colors.textMuted} />

            <TextInput
              value={searchText}
              onChangeText={handleQueryChange}
              placeholder="ابحث عن منتج أو متجر"
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
                onPress={() => {
                  setSearchText("");
                  setSelectedCategoryId(null);
                  setCurrencyFilter("all");
                  setProductSort("relevance");
                  setFilter("all");
                }}
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
          </View>

          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setFiltersVisible((visible) => !visible);
            }}
            accessibilityRole="button"
            accessibilityLabel={filtersVisible ? "إخفاء الفلاتر" : "إظهار الفلاتر"}
            accessibilityState={{ expanded: filtersVisible }}
            style={({ pressed }) => [
              styles.filterToggle,
              {
                backgroundColor: filtersVisible || activeFilterCount > 0
                  ? colors.primary
                  : colors.surface,
                borderColor: filtersVisible || activeFilterCount > 0
                  ? colors.primary
                  : colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon
              name="options-outline"
              size={19}
              color={filtersVisible || activeFilterCount > 0 ? colors.surface : colors.primary}
            />
            {activeFilterCount > 0 ? (
              <View
                style={[
                  styles.activeFilterBadge,
                  {
                    backgroundColor: colors.accent,
                    borderColor: colors.surface,
                  },
                ]}
              >
                <Text style={[styles.activeFilterCount, { color: colors.surface }]}>
                  {activeFilterCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {filtersVisible ? (
          <View
            style={[
              styles.filterPanel,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
          <View style={styles.filterPanelHeader}>
            <Text style={[styles.filterPanelTitle, { color: colors.text }]}>
              تصفية البحث
            </Text>
            {filter !== "all" || selectedCategoryId || currencyFilter !== "all" ||
            productSort !== "relevance" ? (
              <Pressable
                onPress={() => {
                  setFilter("all");
                  setSelectedCategoryId(null);
                  setCurrencyFilter("all");
                  setProductSort("relevance");
                }}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={[styles.resetInlineText, { color: colors.primary }]}>
                  مسح الفلاتر
                </Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {searchFilters.map((item) => {
              const selected = filter === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setFilter(item.id);
                    if (item.id !== "products") {
                      setSelectedCategoryId(null);
                      setCurrencyFilter("all");
                      setProductSort("relevance");
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <AppIcon
                    name={item.icon}
                    size={15}
                    color={selected ? colors.surface : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterText,
                      { color: selected ? colors.surface : colors.textSecondary },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.filterCount,
                      {
                        color: selected ? colors.primary : colors.textMuted,
                        backgroundColor: selected ? colors.surface : colors.surfaceSecondary,
                      },
                    ]}
                  >
                    {filterCounts[item.id]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[styles.filterHint, { color: colors.textMuted }]}>
            اختر نوع النتائج، أو اكتب كلمة للبحث داخلها
          </Text>
          </View>
        ) : null}

        {filtersVisible && (filter === "all" || filter === "products") &&
        productResultsForRefinement ? (
          <View
            style={[
              styles.refinements,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.refinementsHeader}>
              <Text style={[styles.refinementTitle, { color: colors.text }]}>
                تصفية المنتجات
              </Text>
              <Pressable
                onPress={() => {
                  setSelectedCategoryId(null);
                  setCurrencyFilter("all");
                  setProductSort("relevance");
                }}
                accessibilityRole="button"
                accessibilityLabel="إعادة ضبط فلاتر المنتجات"
                hitSlop={8}
              >
                <Text style={[styles.resetInlineText, { color: colors.primary }]}>
                  إعادة ضبط
                </Text>
              </Pressable>
            </View>
            {productCategories.length > 0 ? (
              <>
                <Text style={[styles.refinementLabel, { color: colors.textSecondary }]}>
                  تصنيف المنتجات
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filters}
                >
                  <Pressable
                    onPress={() => setSelectedCategoryId(null)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedCategoryId === null }}
                    style={[
                      styles.categoryFilter,
                      {
                        backgroundColor: selectedCategoryId === null ? colors.primary : colors.surface,
                        borderColor: selectedCategoryId === null ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryFilterText,
                        { color: selectedCategoryId === null ? colors.surface : colors.textSecondary },
                      ]}
                    >
                      كل التصنيفات
                    </Text>
                  </Pressable>
                  {productCategories.map((category) => {
                    const selected = selectedCategoryId === category.id;
                    return (
                      <CategoryChip
                        key={category.id}
                        label={category.name}
                        icon={category.icon}
                        active={selected}
                        onPress={() => {
                          setFilter("products");
                          setCurrencyFilter("all");
                          setProductSort("relevance");
                          setSelectedCategoryId(selected ? null : category.id);
                        }}
                      />
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <View>
              <Text style={[styles.refinementLabel, { color: colors.textSecondary }]}>
                العملة
              </Text>
              <View style={styles.sortOptions}>
                {([
                  { id: "all", label: "الكل" },
                  { id: "SYP", label: "ل.س" },
                  { id: "USD", label: "$" },
                ] as const).map((option) => {
                  const selected = currencyFilter === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => {
                        setCurrencyFilter(option.id);
                        setProductSort("relevance");
                        if (option.id !== "all") {
                          setFilter("products");
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[
                        styles.sortChip,
                        {
                          backgroundColor: selected ? colors.primaryLight : colors.surface,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sortText,
                          { color: selected ? colors.primary : colors.textSecondary },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {currencyFilter !== "all" ? (
              <View>
                <Text style={[styles.refinementLabel, { color: colors.textSecondary }]}>
                  ترتيب السعر
                </Text>
                <View style={styles.sortOptions}>
                  {([
                    { id: "relevance", label: "الأقرب" },
                    { id: "price-ascending", label: "الأقل سعراً" },
                    { id: "price-descending", label: "الأعلى سعراً" },
                  ] as const).map((option) => {
                    const selected = productSort === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => setProductSort(option.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[
                          styles.sortChip,
                          {
                            backgroundColor: selected ? colors.accentLight : colors.surface,
                            borderColor: selected ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sortText,
                            { color: selected ? colors.accent : colors.textSecondary },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {!query && filter === "all" && selectedCategoryId === null ? (
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
                {quickSearches.map((item) => (
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
              description={
                query
                  ? `لم نجد نتيجة تطابق «${searchText.trim()}» مع الفلاتر المختارة.`
                  : "لا توجد نتائج متاحة ضمن هذه الفلاتر حالياً."
              }
            />

            <Text
              style={[
                styles.emptyHint,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              جرّب كلمة مختلفة أو أزل بعض الفلاتر.
            </Text>
            {filter !== "all" || selectedCategoryId || currencyFilter !== "all" ? (
              <Pressable
                onPress={() => {
                  setFilter("all");
                  setSelectedCategoryId(null);
                  setCurrencyFilter("all");
                  setProductSort("relevance");
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.resetFilters,
                  {
                    backgroundColor: colors.primaryLight,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon name="options-outline" size={16} color={colors.primary} />
                <Text style={[styles.resetFiltersText, { color: colors.primary }]}>
                  إزالة الفلاتر
                </Text>
              </Pressable>
            ) : null}
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
                  {query ? "نتائج البحث" : "تصفح النتائج"}
                </Text>

                <Text
                  style={[
                    styles.resultsSubtitle,
                    {
                      color: colors.textMuted,
                    },
                  ]}
                >
                  {query ? `لـ «${searchText.trim()}»` : "حسب الفلاتر المختارة"}
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

            {visibleResults.categories.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="التصنيفات"
                  icon="grid-outline"
                  colors={colors}
                />

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                >
                  {visibleResults.categories.map((category) => (
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

            {visibleResults.stores.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="المتاجر"
                  icon="storefront-outline"
                  colors={colors}
                />

                <View style={styles.storeResults}>
                  {visibleResults.stores.map((store) => {
                    const category = storeCategories.find((item) =>
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
                              <AppIcon
                                name="star"
                                size={12}
                                color={colors.accent}
                              />

                              <Text
                                style={[
                                  styles.storeMetaText,
                                  {
                                    color: colors.textMuted,
                                  },
                                ]}
                              >
                                {store.rating === undefined ? "—" : store.rating.toFixed(1)}
                              </Text>
                            </View>

                            <View style={styles.storeMetaItem}>
                              <AppIcon
                                name="time-outline"
                                size={12}
                                color={colors.textMuted}
                              />

                              <Text
                                style={[
                                  styles.storeMetaText,
                                  {
                                    color: colors.textMuted,
                                  },
                                ]}
                              >
                                {store.deliveryTime}
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

            {visibleResults.products.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="المنتجات"
                  icon="cube-outline"
                  colors={colors}
                />

                <View style={styles.productGrid}>
                  {visibleResults.products.map((product) => (
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

  searchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  searchBox: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: Spacing.two,
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

  filterToggle: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    position: "relative",
  },

  activeFilterBadge: {
    position: "absolute",
    top: -4,
    end: -4,
    minWidth: 19,
    height: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  activeFilterCount: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    textAlign: "center",
  },

  filterPanel: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  filterPanelHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  filterPanelTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  filterHint: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  filters: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },

  filterChip: {
    flexDirection: "row-reverse",
    gap: Spacing.one,
    alignItems: "center",
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },

  filterText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  filterCount: {
    minWidth: 20,
    textAlign: "center",
    overflow: "hidden",
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontFamily: Fonts.bold,
    fontSize: 10,
  },

  refinements: {
    gap: Spacing.three,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  refinementsHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  refinementTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  resetInlineText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  refinementLabel: {
    marginBottom: Spacing.two,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  categoryFilter: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  categoryFilterText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  sortOptions: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: Spacing.two,
  },

  sortChip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  sortText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
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

  resetFilters: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    minHeight: 42,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.full,
  },

  resetFiltersText: {
    fontFamily: Fonts.semiBold,
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
