import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { Keyboard, Text, View } from "react-native";

import Head from "expo-router/head";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductRefinements } from "@/components/search/ProductRefinements";
import { SearchControls } from "@/components/search/SearchControls";
import { SearchEmptyState } from "@/components/search/SearchEmptyState";
import { SearchResults } from "@/components/search/SearchResults";
import { styles } from "@/components/search/searchStyles";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/context/AuthContext";
import { categoryFilterIds } from "@/lib/category-tree";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";
import { getCustomerSearchResults, getVisibleCustomerSearchResults, initialSearchFilter, normalizeCustomerSearchText,
  type ProductSort, type SearchFilter } from "@/lib/customer-search";

type SearchParams = { mode?: string; q?: string; category?: string; categoryId?: string; focus?: string; type?: string };

export default function SearchTab() {
  const { user, loading } = useAuth();
  const params = useLocalSearchParams<SearchParams>();
  const scope = loading ? "loading" : [user?.id, user?.role, user?.app_metadata.role, user?.app_metadata.roles];
  return <SearchContent key={JSON.stringify([scope, params.mode, params.q, params.category, params.categoryId, params.focus, params.type])} params={params} />;
}

function SearchContent({ params }: { params: SearchParams }) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { categories, products, stores, storeCategories, offers, loading, error, refresh } = useCustomerCatalog();
  const initialQuery = typeof params.q === "string" ? params.q : typeof params.category === "string" ? params.category : "";
  const initialCategory = typeof params.categoryId === "string" && params.categoryId ? params.categoryId : null;
  const [searchText, setSearchText] = useState(initialQuery);
  const [filter, setFilter] = useState<SearchFilter>(() => initialSearchFilter(params.type, params.mode, initialCategory));
  const [categoryId, setCategoryId] = useState<string | null>(initialCategory);
  const [storeCategoryId, setStoreCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<ProductSort>("relevance");
  const [refinementsOpen, setRefinementsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const deferredText = useDeferredValue(searchText);
  const query = normalizeCustomerSearchText(deferredText);
  const forStores = filter === "stores";
  const activeCategory = forStores ? storeCategoryId : filter === "products" ? categoryId : null;
  const availableCategories = forStores ? storeCategories : categories;
  const filterCount = Number(activeCategory !== null) + Number(filter === "products" && sort !== "relevance");

  const results = useMemo(() => getCustomerSearchResults({ categories, products, stores, storeCategories, offers }, deferredText),
    [categories, deferredText, offers, products, storeCategories, stores]);
  const visibleResults = useMemo(() => {
    const visible = getVisibleCustomerSearchResults(results, filter,
      filter === "products" ? categoryId : null, filter === "products" ? sort : "relevance", categories);
    if (!query) visible.categories = visible.categories.filter(category => !category.parentId);
    if (filter !== "stores" || !storeCategoryId) return visible;
    const selected = categoryFilterIds(storeCategories, storeCategoryId);
    return { ...visible, stores: visible.stores.filter(store => store.categoryIds.some(id => selected.has(id))) };
  }, [categories, categoryId, filter, query, results, sort, storeCategories, storeCategoryId]);
  const hasMatches = Boolean(visibleResults.products.length || visibleResults.stores.length || visibleResults.offers.length || visibleResults.categories.length);
  const refreshSearch = async () => {
    if (refreshLock.current || loading) return;
    refreshLock.current = true;
    setRefreshing(true);
    try { await refresh(); }
    finally { refreshLock.current = false; setRefreshing(false); }
  };
  const resetRefinements = () => {
    if (forStores) setStoreCategoryId(null);
    else { setCategoryId(null); setSort("relevance"); }
  };
  const chooseCategory = (id: string) => {
    Keyboard.dismiss();
    setSearchText("");
    setFilter("products");
    setCategoryId(id);
  };
  const goBack = () => {
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace("/home");
  };
  const openDetail = (pathname: "/store-details" | "/product-details" | "/offer-details", id: string) => {
    Keyboard.dismiss();
    router.push({ pathname, params: { id } });
  };
  const header = <>
    <SearchControls value={searchText} onChange={setSearchText} filter={filter} onFilter={setFilter}
      focusOnEntry={params.focus === "1" && params.mode !== "products"} onBack={goBack}
      onOpenRefinements={() => setRefinementsOpen(true)} filterCount={filterCount} />
    {error ? <View style={styles.notice} accessibilityLiveRegion="polite">
      <Text style={[styles.text, { color: colors.error }]}>{hasMatches ? "تعذر تحديث النتائج. نعرض آخر بيانات متاحة." : "تعذر تحميل بيانات السوق."}</Text>
      <AppButton compact title="إعادة المحاولة" variant="outline" onPress={() => void refreshSearch()} />
    </View> : null}
  </>;
  const empty = loading ? <View accessibilityLiveRegion="polite">
    <Text style={[styles.notice, styles.text, { color: colors.textMuted }]}>جارٍ تحميل بيانات السوق…</Text>
    {[0, 1, 2].map(key => <View key={key} accessible={false} style={[styles.placeholder, { backgroundColor: colors.surfaceSecondary }]} />)}
  </View> : error ? null : (
    <SearchEmptyState searchText={deferredText}
      onReset={filterCount ? resetRefinements : undefined} />
  );

  const title = params.mode === "products" && filter === "products" ? "جميع المنتجات" : "البحث";
  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <Stack.Screen options={{ title }} />
    <Head><title>{title}</title></Head>
    <SearchResults categories={categories} results={visibleResults} header={header} empty={empty} refreshing={refreshing} onRefresh={() => void refreshSearch()}
      onCategory={chooseCategory} onStore={id => openDetail("/store-details", id)}
      onProduct={id => openDetail("/product-details", id)} onOffer={id => openDetail("/offer-details", id)} />
    {refinementsOpen ? <ProductRefinements categories={availableCategories} categoryId={activeCategory}
      sort={forStores ? undefined : sort} onClose={() => setRefinementsOpen(false)}
      onApply={(id, nextSort) => {
        if (forStores) setStoreCategoryId(id);
        else { setCategoryId(id); setSort(nextSort); }
        setRefinementsOpen(false);
      }} /> : null}
  </View>;
}
