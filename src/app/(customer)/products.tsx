import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { ProductCard } from "@/components/marketplace/ProductCard";
import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { CustomerMarketHeader } from "@/components/navigation/CustomerMarketHeader";
import { ProductRefinements, sortLabels } from "@/components/search/ProductRefinements";
import { AppButton } from "@/components/ui/AppButton";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { ControlSizes, FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";
import { useProductDirectory } from "@/hooks/useProductDirectory";
import { categoryAncestors } from "@/lib/category-tree";
import type { ProductSort } from "@/lib/customer-search";
import type { Category, Product } from "@/types/catalog";

const webRtl = Platform.OS === "web" ? { dir: "rtl" as const } : {};

export default function ProductsScreen() {
  const { user, loading } = useAuth();
  const owner = user?.id ?? null;
  const scope = loading ? "loading" : JSON.stringify([owner, user?.role, user?.app_metadata.role, user?.app_metadata.roles]);
  return <ProductsContent key={scope} owner={owner} enabled={!loading} />;
}

function CategoryRail({ categories, selected, onSelect }: { categories: Category[]; selected: string | null; onSelect: (id: string) => void }) {
  return <ScrollView {...webRtl} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
    contentContainerStyle={styles.rail}>
    {categories.map(category => <CategoryChip key={category.id} label={category.name} icon={category.icon}
      active={selected === category.id} onPress={() => onSelect(category.id)} />)}
  </ScrollView>;
}

function ProductsContent({ owner, enabled }: { owner: string | null; enabled: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { categories, categoryRead, refreshCategories } = useCustomerCatalog();
  const [searchText, setSearchText] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<ProductSort>("relevance");
  const [refinementsOpen, setRefinementsOpen] = useState(false);
  const selected = categories.find(category => category.id === categoryId);
  const nodes = useMemo(() => new Map(categories.map(category => [category.id, category])), [categories]);
  const roots = useMemo(() => categories.filter(category => !category.parentId), [categories]);
  const rootId = selected ? categoryAncestors(selected, nodes)[0]?.id ?? null : null;
  const branch = selected && categories.some(category => category.parentId === selected.id) ? selected.id : selected?.parentId;
  const children = branch ? categories.filter(category => category.parentId === branch) : [];
  const directory = useProductDirectory(owner, enabled, searchText, categoryId, sort);
  const listRef = useRef<FlatList<Product[]> | null>(null);
  const offsets = useRef(new Map<string, number>());
  const restored = useRef<string | null>(null);
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 320 || fontScale > 1.25 ? 1 : 2;
  const cardWidth = Math.floor((Math.min(width, 760) - 2 * Spacing.four - (columns - 1) * Spacing.two) / columns);
  const rows = useMemo(() => {
    const result: Product[][] = [];
    for (let index = 0; index < directory.products.length; index += columns) result.push(directory.products.slice(index, index + columns));
    return result;
  }, [columns, directory.products]);
  const attachList = useCallback((list: FlatList<Product[]> | null) => {
    listRef.current = list;
    if (list) restored.current = null;
  }, []);
  const selectCategory = (id: string | null) => { Keyboard.dismiss(); setCategoryId(id); };
  const toggleCategory = (id: string) => selectCategory(categoryId === id ? nodes.get(id)?.parentId ?? null : id);
  const filterCount = Number(categoryId !== null) + Number(sort !== "relevance");

  const controls = <View style={styles.controls}>
    <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppIcon name="search-outline" size={20} color={colors.primary} />
      <TextInput accessibilityLabel="ابحث عن منتج" placeholder="ابحث عن منتج" value={searchText} maxLength={160}
        onChangeText={setSearchText} onSubmitEditing={Keyboard.dismiss} returnKeyType="search" autoCorrect={false}
        placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text }]} />
      {searchText ? <Pressable accessibilityRole="button" accessibilityLabel="مسح بحث المنتجات" style={styles.iconButton}
        onPress={() => setSearchText("")}><AppIcon name="close-circle" size={20} color={colors.textMuted} /></Pressable> : null}
    </View>
    {roots.length ? <>
      <ScrollView {...webRtl} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.rail}>
        <CategoryChip label="كل المنتجات" active={!selected} onPress={() => selectCategory(null)} />
        {roots.map(category => <CategoryChip key={category.id} label={category.name} icon={category.icon}
          active={rootId === category.id} onPress={() => selectCategory(categoryId === category.id ? null : category.id)} />)}
      </ScrollView>
      {children.length ? <CategoryRail categories={children} selected={categoryId} onSelect={toggleCategory} /> : null}
    </> : categoryRead === "error" ? <AppButton compact title="إعادة محاولة تحميل التصنيفات" variant="outline"
      onPress={() => void refreshCategories().catch(() => undefined)} /> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="تصفية وترتيب" onPress={() => { Keyboard.dismiss(); setRefinementsOpen(true); }}
      style={[styles.refine, { backgroundColor: filterCount ? colors.primaryLight : colors.surface,
        borderColor: filterCount ? colors.primary : colors.border }]}>
      <AppIcon name="options-outline" size={18} color={colors.primary} />
      <Text style={[styles.refineText, { color: colors.text }]}>تصفية وترتيب</Text>
      <Text style={[styles.sortText, { color: colors.textSecondary }]}>{sort === "relevance" ? "متنوع" : sortLabels[sort]}</Text>
      {filterCount ? <Text style={[styles.count, { color: colors.primary }]}>{filterCount}</Text> : null}
    </Pressable>
  </View>;

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <CustomerMarketHeader title="المنتجات" cartCount={itemCount} mode="customer" />
    <FlatList key={directory.key} ref={attachList} style={styles.container}
      contentContainerStyle={[styles.content, styles.list]} data={rows} keyExtractor={row => row[0].id}
      ListHeaderComponent={controls} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false} refreshing={directory.refreshing} onRefresh={() => void directory.refresh()}
      onScroll={event => { if (restored.current === directory.key) offsets.current.set(directory.key, event.nativeEvent.contentOffset.y); }}
      scrollEventThrottle={32} onContentSizeChange={() => {
        if (!rows.length || restored.current === directory.key) return;
        restored.current = directory.key;
        const offset = offsets.current.get(directory.key);
        if (offset) listRef.current?.scrollToOffset({ offset, animated: false });
      }}
      onEndReachedThreshold={0.4} onEndReached={() => { if (directory.hasMore && !directory.error) void directory.loadMore(); }}
      renderItem={({ item }) => <View style={styles.cards}>{item.map(product => <ProductCard key={product.id}
        product={product} compact cardWidth={cardWidth} storeName={directory.storeNames.get(product.storeId)} showOffer
        onPress={() => { Keyboard.dismiss(); router.push({ pathname: "/product-details", params: { id: product.id } }); }} />)}</View>}
      ListEmptyComponent={directory.loading ? <View accessibilityLiveRegion="polite" style={styles.placeholders}>
        <Text style={[styles.status, { color: colors.textMuted }]}>جارٍ تحميل المنتجات…</Text>
        {[0, 1].map(row => <View key={row} style={styles.cards}>{Array.from({ length: columns }, (_, index) =>
          <View key={index} accessible={false} style={[styles.placeholder, { width: cardWidth, backgroundColor: colors.surfaceSecondary }]} />)}</View>)}
      </View> : directory.error ? null : <AppEmptyState icon="cube-outline" title="لم نجد منتجات"
        description={searchText.trim() ? "جرّب عبارة أخرى أو غيّر التصنيف." : "لا توجد منتجات متاحة ضمن هذا الاختيار."} />}
      ListFooterComponent={directory.error ? <View style={styles.footer} accessibilityLiveRegion="polite">
        <Text style={[styles.status, { color: colors.error }]}>{directory.error === "more" ? "تعذر تحميل مزيد من المنتجات."
          : rows.length ? "تعذر التحديث. نعرض آخر نتائج متاحة." : "تعذر تحميل المنتجات."}</Text>
        <AppButton compact title="إعادة المحاولة" variant="outline" onPress={() => void directory.retry()} />
      </View> : directory.loadingMore ? <View style={styles.footer}><ActivityIndicator color={colors.primary} /></View>
        : directory.hasMore ? <View style={styles.footer}><AppButton compact title="تحميل المزيد" variant="outline"
          onPress={() => void directory.loadMore()} /></View> : null} />
    {refinementsOpen ? <ProductRefinements categories={categories} categoryId={categoryId} sort={sort} relevanceLabel="متنوع"
      onClose={() => setRefinementsOpen(false)} onApply={(nextCategory, nextSort) => {
        setCategoryId(nextCategory); setSort(nextSort); setRefinementsOpen(false);
      }} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: Spacing.four, direction: "rtl" },
  list: { paddingTop: Spacing.two, paddingBottom: Spacing.six },
  controls: { gap: Spacing.two, paddingBottom: Spacing.three },
  search: { flexDirection: "row", alignItems: "center", minHeight: ControlSizes.input, borderWidth: 1,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.two, gap: Spacing.two },
  input: { flex: 1, minWidth: 0, minHeight: ControlSizes.input, fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  iconButton: { minWidth: ControlSizes.touch, minHeight: ControlSizes.touch, alignItems: "center", justifyContent: "center" },
  rail: { direction: "rtl", flexDirection: "row", gap: Spacing.two },
  refine: { minHeight: ControlSizes.touch, flexDirection: "row", alignItems: "center", gap: Spacing.two,
    borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: Spacing.three },
  refineText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
  sortText: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.xs, ...RtlText },
  count: { fontFamily: Fonts.bold, fontSize: FontSizes.xs },
  cards: { flexDirection: "row", alignItems: "stretch", gap: Spacing.two, paddingBottom: Spacing.two },
  placeholders: { gap: Spacing.two },
  placeholder: { height: 176, borderRadius: Radius.xl },
  status: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  footer: { alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.three },
});
