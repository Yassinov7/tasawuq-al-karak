import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { StoreDetailsHero } from "@/components/marketplace/StoreDetailsHero";
import { CustomerMarketHeader } from "@/components/navigation/CustomerMarketHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { ControlSizes, FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";
import { useCustomerStoreLogos } from "@/hooks/useCustomerStoreLogos";
import { useDriverTaskRefresh } from "@/hooks/useDriverTaskRefresh";
import { categoryAncestors, categoryFilterIds, categoryPath } from "@/lib/category-tree";
import { matchesAllCustomerSearchTerms, normalizeCustomerSearchText } from "@/lib/customer-search";
import { readCustomerStoreIdentity } from "@/lib/customer-store-details";
import type { Product } from "@/types/catalog";

const webRtl = Platform.OS === "web" ? { dir: "rtl" as const } : {};
const PRODUCT_PAGE_SIZE = 12;

export default function StoreDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, loading } = useAuth();
  const owner = user?.id ?? null;
  const storeId = typeof id === "string" ? id : undefined;
  const scope = JSON.stringify([storeId, owner, user?.role, user?.app_metadata.role, user?.app_metadata.roles, loading]);
  return <StoreDetails key={scope} id={storeId} owner={owner} enabled={!loading} />;
}

function StoreDetails({ id, owner, enabled }: { id?: string; owner: string | null; enabled: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { itemCount, selectedOfferIds } = useCart();
  const { categories, error, loading, offers, products, stores, storeCategories, refresh } = useCustomerCatalog();
  const store = enabled ? stores.find(item => item.id === id) : undefined;
  const category = storeCategories.find(item => store?.categoryIds.includes(item.id));
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [visibleProductCount, setVisibleProductCount] = useState(PRODUCT_PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const [identity, setIdentity] = useState<Awaited<ReturnType<typeof readCustomerStoreIdentity>>>();
  const identityAt = useRef(0);
  const catalogAt = useRef(0);
  const refreshLock = useRef(false);
  const storeId = store?.id;

  const loadIdentity = useCallback(async (signal: AbortSignal) => {
    if (!storeId) return;
    try {
      const next = await readCustomerStoreIdentity(storeId, owner, signal);
      if (!signal.aborted) {
        setIdentity(next);
        identityAt.current = Date.now();
      }
    } catch {
      if (!signal.aborted) setIdentity({ acceptsOrders: null, video: null, failed: true });
    }
  }, [owner, storeId]);
  const identityNeedsRefresh = useCallback(() => Date.now() - identityAt.current > 60_000, []);
  const refreshIdentity = useDriverTaskRefresh(loadIdentity, Boolean(storeId), identityNeedsRefresh);
  const { logos, refresh: refreshLogos } = useCustomerStoreLogos(storeId ? [storeId] : [], true);
  const logo = storeId ? logos.get(storeId) : undefined;

  useEffect(() => {
    if (enabled && !loading && !error) catalogAt.current = Date.now();
  }, [enabled, error, loading, stores]);
  const catalogNeedsRefresh = useCallback(() => catalogAt.current > 0 && Date.now() - catalogAt.current > 180_000, []);
  const refreshCatalog = useCallback(async () => { await refresh(); }, [refresh]);
  useDriverTaskRefresh(refreshCatalog, enabled, catalogNeedsRefresh);

  const reload = async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try { await Promise.allSettled([refresh(), refreshIdentity("manual"), refreshLogos("manual")]); }
    finally { refreshLock.current = false; setRefreshing(false); }
  };

  const catalog = useMemo(() => {
    const localProducts = products.filter(product => product.storeId === storeId);
    const nodes = new Map(categories.map(item => [item.id, item]));
    const used = new Set(localProducts.flatMap(product => {
      const item = nodes.get(product.categoryId);
      return item ? categoryAncestors(item, nodes).map(node => node.id) : [];
    }));
    const selectedIds = selectedCategory ? categoryFilterIds(categories, selectedCategory) : null;
    const terms = normalizeCustomerSearchText(searchText).split(" ").filter(Boolean);
    return {
      hasProducts: localProducts.length > 0,
      categoryOptions: categories.filter(item => used.has(item.id)).map(item => ({ id: item.id, label: categoryPath(item, nodes), icon: item.icon })),
      filtered: localProducts.filter(product => (!selectedIds || selectedIds.has(product.categoryId)) &&
        matchesAllCustomerSearchTerms([product.name, product.description, product.unit].join(" "), terms)),
    };
  }, [categories, products, searchText, selectedCategory, storeId]);

  const storeOffers = useMemo(() => offers.filter(offer => offer.store_id === storeId), [offers, storeId]);
  const activeOffers = storeOffers; // Eligibility is centralized in CustomerCatalogContext.

  const columns = width < 320 || fontScale > 1.25 ? 1 : 2;
  const cardWidth = Math.floor((Math.min(width, 760) - 2 * Spacing.four - (columns - 1) * Spacing.two) / columns);
  const visibleProducts = useMemo(
    () => catalog.filtered.slice(0, visibleProductCount),
    [catalog.filtered, visibleProductCount],
  );
  const hasMoreProducts = visibleProducts.length < catalog.filtered.length;
  const rows = useMemo(() => {
    const grouped: Product[][] = [];
    for (let start = 0; start < visibleProducts.length; start += columns) grouped.push(visibleProducts.slice(start, start + columns));
    return grouped;
  }, [visibleProducts, columns]);
  const loadMoreProducts = useCallback(() => {
    if (hasMoreProducts) setVisibleProductCount(count => Math.min(count + PRODUCT_PAGE_SIZE, catalog.filtered.length));
  }, [catalog.filtered.length, hasMoreProducts]);
  const goBack = () => {
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace("/stores");
  };
  const open = (pathname: "/product-details" | "/offer-details", detailId: string) => {
    Keyboard.dismiss();
    router.push({ pathname, params: { id: detailId } });
  };
  const headline = (title: string) => <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>{title}</Text>;

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <CustomerMarketHeader title="المتجر" screenTitle={store?.name} showBack onBack={goBack} cartCount={itemCount} mode="shared" />
    {!store ? <View style={[styles.content, styles.stack]}>
      {!enabled || loading ? <Text accessibilityLiveRegion="polite" style={[styles.meta, { color: colors.textSecondary }]}>جارٍ تحميل المتجر…</Text>
        : error ? <>
          <Text style={[styles.meta, { color: colors.error }]}>تعذر تحميل المتجر.</Text>
          <AppButton compact title="إعادة المحاولة" variant="outline" onPress={() => void reload()} />
        </> : <AppEmptyState icon="storefront-outline" title="المتجر غير متاح" buttonText="رجوع" onButtonPress={goBack} />}
    </View> : (
      <FlatList style={styles.container} contentContainerStyle={[styles.content, styles.list]}
        data={rows} keyExtractor={row => row[0].id} keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        refreshing={refreshing} onRefresh={() => void reload()}
        onEndReached={loadMoreProducts} onEndReachedThreshold={0.35}
        ListHeaderComponent={<View style={styles.stack}>
          <StoreDetailsHero store={store} category={category?.name} categoryIcon={category?.icon}
            logo={logo} acceptsOrders={identity?.acceptsOrders ?? null} video={identity?.video} owner={owner}
            onReviewsPress={() => router.push({ pathname: "/store-reviews", params: { id: store.id } })} />
          {error || identity?.failed ? <View style={styles.notice}>
            <Text accessibilityLiveRegion="polite" style={[styles.meta, { color: colors.error }]}>تعذر تحديث بعض معلومات المتجر.</Text>
            <AppButton compact title="إعادة المحاولة" variant="outline" fullWidth={false} onPress={() => void reload()} />
          </View> : null}
          {activeOffers.length ? <View style={styles.group}>
            {headline("عروض المتجر")}
            <FlatList {...webRtl} horizontal data={activeOffers} keyExtractor={offer => offer.id}
              showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}
              renderItem={({ item }) => <OfferCard offer={item} cardWidth={Math.min(222, cardWidth * columns)}
                added={selectedOfferIds.includes(item.id)} onPress={() => open("/offer-details", item.id)} />} />
          </View> : null}
          <View style={styles.group}>
            {headline("المنتجات")}
            {catalog.hasProducts ? <>
              <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <AppIcon name="search-outline" size={20} color={colors.primary} />
                <TextInput value={searchText} onChangeText={value => { setSearchText(value); setVisibleProductCount(PRODUCT_PAGE_SIZE); }} placeholder="ابحث في منتجات المتجر"
                  accessibilityLabel="ابحث في منتجات المتجر" placeholderTextColor={colors.textMuted}
                  returnKeyType="search" onSubmitEditing={Keyboard.dismiss} style={[styles.input, { color: colors.text }]} />
                {searchText ? <Pressable accessibilityRole="button" accessibilityLabel="مسح بحث المنتجات"
                  style={styles.clear} onPress={() => { setSearchText(""); setVisibleProductCount(PRODUCT_PAGE_SIZE); }}>
                  <AppIcon name="close-circle" size={20} color={colors.textMuted} />
                </Pressable> : null}
              </View>
              {catalog.categoryOptions.length > 1 ? <ScrollView {...webRtl} horizontal showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled" contentContainerStyle={styles.rail}>
                <CategoryChip label="كل المنتجات" active={selectedCategory === null}
                  onPress={() => { setSelectedCategory(null); setVisibleProductCount(PRODUCT_PAGE_SIZE); }} />
                {catalog.categoryOptions.map(item => (
                  <CategoryChip key={item.id} label={item.label} icon={item.icon} active={item.id === selectedCategory}
                    onPress={() => { Keyboard.dismiss(); setVisibleProductCount(PRODUCT_PAGE_SIZE);
                      setSelectedCategory(current => current === item.id ? null : item.id); }} />
                ))}
              </ScrollView> : null}
            </> : null}
          </View>
        </View>}
        renderItem={({ item }) => <View style={styles.cards}>
          {item.map(product => <ProductCard key={product.id} product={product} cardWidth={cardWidth}
            compact showStore={false} showOffer onPress={() => open("/product-details", product.id)} />)}
        </View>}
        ListEmptyComponent={loading ? <Text style={[styles.meta, { color: colors.textSecondary }]}>جارٍ تحميل المنتجات…</Text>
          : error && !catalog.hasProducts ? null : <AppEmptyState icon="cube-outline"
            title={catalog.hasProducts ? "لم نجد منتجات مطابقة" : "لا توجد منتجات متاحة حاليًا"}
            buttonText={catalog.hasProducts ? "إزالة الفلاتر" : undefined}
            onButtonPress={() => { setSearchText(""); setSelectedCategory(null); setVisibleProductCount(PRODUCT_PAGE_SIZE); }} />}
        ListFooterComponent={hasMoreProducts ? <View style={styles.footer}>
          <AppButton compact title="عرض المزيد من المنتجات" variant="outline" fullWidth={false} onPress={loadMoreProducts} />
        </View> : visibleProducts.length ? <Text accessibilityLiveRegion="polite"
          style={[styles.end, { color: colors.textMuted }]}>تم عرض جميع المنتجات المطابقة</Text> : null}
      />
    )}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: Spacing.four, direction: "rtl" },
  list: { paddingVertical: Spacing.two, paddingBottom: Spacing.six },
  stack: { gap: Spacing.four, paddingBottom: Spacing.two },
  group: { gap: Spacing.two },
  heading: { fontFamily: Fonts.bold, fontSize: FontSizes.md, ...RtlText },
  rail: { flexDirection: "row", gap: Spacing.two },
  search: { flexDirection: "row", alignItems: "center", minHeight: ControlSizes.input,
    borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: Spacing.two, gap: Spacing.two },
  input: { flex: 1, minWidth: 0, minHeight: ControlSizes.input, ...RtlText,
    fontFamily: Fonts.medium, fontSize: FontSizes.sm },
  clear: { minWidth: ControlSizes.touch, minHeight: ControlSizes.touch, alignItems: "center", justifyContent: "center" },
  cards: { flexDirection: "row", alignItems: "stretch", gap: Spacing.two, paddingBottom: Spacing.two },
  notice: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing.two },
  meta: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  footer: { alignItems: "center", paddingTop: Spacing.two },
  end: { paddingTop: Spacing.two, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "center", writingDirection: "rtl" },
});
