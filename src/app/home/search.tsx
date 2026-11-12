import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { SearchControls } from "@/components/search/SearchControls";
import { ProductRefinements } from "@/components/search/ProductRefinements";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchEmptyState } from "@/components/search/SearchEmptyState";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { CustomerCatalogStatus } from "@/components/marketplace/CustomerCatalogStatus";
import { styles } from "@/components/search/searchStyles";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";

import { getCustomerSearchResults, getVisibleCustomerSearchResults, normalizeCustomerSearchText, type ProductSort, type SearchFilter } from "@/lib/customer-search";

export default function SearchTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { categories, products, stores, storeCategories } =
    useCustomerCatalog();

  const params = useLocalSearchParams<{
    q?: string;
    category?: string;
    categoryId?: string;
  }>();

  const initialText =
    typeof params.q === "string"
      ? params.q
      : typeof params.category === "string"
        ? params.category
        : "";

  const [searchText, setSearchText] = useState(initialText);
  const [filter, setFilter] = useState<SearchFilter>(params.categoryId ? "products" : "all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(params.categoryId ?? null);
  const [productSort, setProductSort] = useState<ProductSort>("relevance");
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [refinementsExpanded, setRefinementsExpanded] = useState(false);

  const query = normalizeCustomerSearchText(searchText);
  const results = useMemo(() => getCustomerSearchResults({ categories, products, stores, storeCategories }, searchText), [categories, products, searchText, storeCategories, stores]);
  const visibleResults = useMemo(() => getVisibleCustomerSearchResults(results, filter, selectedCategoryId, productSort, categories), [categories, filter, productSort, results, selectedCategoryId]);

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
  const productCategories = useMemo(() => {
    const used = new Set(results.products.map(product => product.categoryId));
    const parents = new Set(categories.filter(category => used.has(category.id)).map(category => category.parentId));
    return categories.filter(category => used.has(category.id) || parents.has(category.id));
  }, [categories, results.products]);
  const productResultsForRefinement = query
    ? results.products.length > 0
    : products.some((product) => product.available);
  const activeFilterCount =
    Number(filter !== "all") +
    Number(selectedCategoryId !== null) +
    Number(productSort !== "relevance");
  const totalResults = visibleResults.stores.length +
    visibleResults.products.length + visibleResults.categories.length;
  const quickSearches = [...new Set([
    ...products.filter((product) => product.popular).map((product) => product.name),
    ...categories.slice(0, 4).map((category) => category.name),
  ])].slice(0, 5);
  const filterSummary = [
    selectedCategoryId
      ? productCategories.find((category) => category.id === selectedCategoryId)?.name
      : null,
    productSort === "price-ascending" ? "الأقل سعراً" : productSort === "price-descending" ? "الأعلى سعراً" : null,
  ].filter((item): item is string => Boolean(item));

  const handleSubmit = () => {
    Keyboard.dismiss();
  };

  const handleQueryChange = (value: string) => {
    setSearchText(value);
    setSelectedCategoryId(null);
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

  const handleCategoryPress = (categoryId: string) => {
    setSearchText("");
    setFilter("products");
    setSelectedCategoryId(categoryId);
    setProductSort("relevance");
    Keyboard.dismiss();
  };

  const handleQuickSearch = (value: string) => {
    setSearchText(value);
    setSelectedCategoryId(null);
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
      <AppHeader cartCount={itemCount} mode="customer" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <SearchControls colors={colors} searchText={searchText} filtersVisible={filtersVisible}
          activeFilterCount={activeFilterCount} filter={filter} filterCounts={filterCounts}
          selectedCategoryId={selectedCategoryId} productSort={productSort}
          setSearchText={setSearchText} setFiltersVisible={setFiltersVisible} setFilter={setFilter}
          setSelectedCategoryId={setSelectedCategoryId} setProductSort={setProductSort}
          onQueryChange={handleQueryChange} onSubmit={handleSubmit} />

        {filtersVisible && (filter === "all" || filter === "products") && productResultsForRefinement ? (
          <Pressable
            onPress={() => setRefinementsExpanded((expanded) => !expanded)}
            accessibilityRole="button"
            accessibilityState={{ expanded: refinementsExpanded }}
            style={[styles.refinementsToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.refinementsToggleText}>
              <Text style={[styles.refinementTitle, { color: colors.text }]}>تحسينات المنتجات</Text>
              {filterSummary.length > 0 ? <Text style={[styles.refinementSummary, { color: colors.textMuted }]} numberOfLines={1}>{filterSummary.join(" • ")}</Text> : null}
            </View>
            <AppIcon name={refinementsExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
          </Pressable>
        ) : null}

        {refinementsExpanded ? <ProductRefinements filtersVisible={filtersVisible} filter={filter}
          productResultsForRefinement={productResultsForRefinement} colors={colors}
          selectedCategoryId={selectedCategoryId} productCategories={productCategories}
          productSort={productSort}
          setSelectedCategoryId={setSelectedCategoryId} setProductSort={setProductSort} setFilter={setFilter} /> : null}

        {!query && filter === "all" && selectedCategoryId === null || totalResults === 0 ? (
          <SearchEmptyState isInitial={!query && filter === "all" && selectedCategoryId === null}
            colors={colors} quickSearches={quickSearches} query={query} searchText={searchText}
            filter={filter} selectedCategoryId={selectedCategoryId} onQuickSearch={handleQuickSearch} onResetFilters={() => { setFilter("all"); setSelectedCategoryId(null); setProductSort("relevance"); }} />
        ) : (
          <SearchResults colors={colors} query={query} searchText={searchText} totalResults={totalResults}
            visibleResults={visibleResults}
            onCategoryPress={handleCategoryPress} onStorePress={handleStorePress} onProductPress={handleProductPress} />
        )}
      </ScrollView>
    </View>
  );
}
