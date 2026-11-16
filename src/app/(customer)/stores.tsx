import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Keyboard, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, useWindowDimensions, View,
} from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { StoreCard } from "@/components/marketplace/StoreCard";
import { CustomerMarketHeader } from "@/components/navigation/CustomerMarketHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { ControlSizes, Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";
import { useCustomerStoreLogos } from "@/hooks/useCustomerStoreLogos";
import { useStoreDirectory } from "@/hooks/useStoreDirectory";
import { categoryAncestors } from "@/lib/category-tree";
import type { Category, Store } from "@/types/catalog";

const webRtl = Platform.OS === "web" ? { dir: "rtl" as const } : {};

export default function StoresScreen() {
  const { user, loading } = useAuth();
  const owner = user?.id ?? null;
  const scope = loading ? "loading" : JSON.stringify([owner, user?.role, user?.app_metadata.role, user?.app_metadata.roles]);
  return <StoresContent key={scope} owner={owner} enabled={!loading} />;
}

function CategoryRail({ categories, selected, onSelect }: {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return <ScrollView {...webRtl} horizontal showsHorizontalScrollIndicator={false}
    keyboardShouldPersistTaps="handled" contentContainerStyle={styles.rail}>
    {categories.map(category => (
      <CategoryChip key={category.id} label={category.name} icon={category.icon}
        active={selected === category.id} onPress={() => onSelect(category.id)} />
    ))}
  </ScrollView>;
}

function StoresContent({ owner, enabled }: { owner: string | null; enabled: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { storeCategories, categoryRead, refreshCategories } = useCustomerCatalog();
  const [searchText, setSearchText] = useState("");
  const [selection, setSelection] = useState<string | null>(null);
  const selected = storeCategories.find(category => category.id === selection);
  const nodes = useMemo(() => new Map(storeCategories.map(category => [category.id, category])), [storeCategories]);
  const roots = useMemo(() => storeCategories.filter(category => !category.parentId), [storeCategories]);
  const rootId = selected ? categoryAncestors(selected, nodes)[0].id : null;
  const branch = selected && storeCategories.some(category => category.parentId === selected.id) ? selected.id : selected?.parentId;
  const children = branch ? storeCategories.filter(category => category.parentId === branch) : [];
  const directory = useStoreDirectory(owner, enabled, searchText, selected?.id ?? null);
  const listRef = useRef<FlatList<Store[]> | null>(null);
  const offsets = useRef(new Map<string, number>());
  const restored = useRef<string | null>(null);
  const attachList = useCallback((list: FlatList<Store[]> | null) => {
    listRef.current = list;
    if (list) restored.current = null;
  }, []);
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 320 || fontScale > 1.25 ? 1 : 2;
  const cardWidth = Math.floor((Math.min(width, 760) - Spacing.four * 2 - Spacing.two * (columns - 1)) / columns);
  const storeIds = useMemo(() => directory.stores.map(store => store.id), [directory.stores]);
  const { logos } = useCustomerStoreLogos(storeIds, true, true);
  const rows = useMemo(() => {
    const result: Store[][] = [];
    for (let index = 0; index < directory.stores.length; index += columns) {
      result.push(directory.stores.slice(index, index + columns));
    }
    return result;
  }, [columns, directory.stores]);
  const toggleCategory = (id: string) => {
    Keyboard.dismiss();
    setSelection(current => current === id ? nodes.get(id)?.parentId ?? null : id);
  };
  const openStore = (id: string) => {
    Keyboard.dismiss();
    router.push({ pathname: "/store-details", params: { id } });
  };

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <CustomerMarketHeader title="المتاجر" cartCount={itemCount} mode="customer" />
    <View style={[styles.controls, styles.content]}>
      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppIcon name="search-outline" size={20} color={colors.primary} />
        <TextInput accessibilityLabel="ابحث باسم المتجر" placeholder="ابحث باسم المتجر" value={searchText}
          onChangeText={setSearchText} onSubmitEditing={Keyboard.dismiss} returnKeyType="search" maxLength={160}
          placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text }]} />
        {searchText ? <Pressable accessibilityRole="button" accessibilityLabel="مسح بحث المتاجر"
          onPress={() => setSearchText("")} style={styles.iconButton}>
          <AppIcon name="close-circle" size={20} color={colors.textMuted} />
        </Pressable> : null}
      </View>
      {roots.length ? <>
        <ScrollView {...webRtl} horizontal showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" contentContainerStyle={styles.rail}>
          <CategoryChip label="كل المتاجر" active={!selected} onPress={() => { Keyboard.dismiss(); setSelection(null); }} />
          {roots.map(category => (
            <CategoryChip key={category.id} label={category.name} icon={category.icon}
              active={rootId === category.id} onPress={() => {
                Keyboard.dismiss();
                setSelection(current => current === category.id ? null : category.id);
              }} />
          ))}
        </ScrollView>
        {children.length ? <CategoryRail categories={children} selected={selection} onSelect={toggleCategory} /> : null}
      </> : categoryRead === "error" ? (
        <AppButton compact title="إعادة محاولة تحميل التصنيفات" variant="outline" onPress={() => void refreshCategories().catch(() => undefined)} />
      ) : null}
    </View>
    <FlatList key={directory.key} ref={attachList} style={styles.container} contentContainerStyle={[styles.content, styles.list]}
      data={rows} keyExtractor={row => row[0].id}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
      refreshing={directory.refreshing} onRefresh={() => void directory.refresh()}
      onScroll={event => {
        if (restored.current !== directory.key) return;
        offsets.current.set(directory.key, event.nativeEvent.contentOffset.y);
        if (offsets.current.size > 16) offsets.current.delete(offsets.current.keys().next().value ?? "");
      }}
      scrollEventThrottle={32}
      onContentSizeChange={() => {
        if (!rows.length || restored.current === directory.key) return;
        const offset = offsets.current.get(directory.key);
        restored.current = directory.key;
        if (offset) listRef.current?.scrollToOffset({ offset, animated: false });
      }}
      onEndReachedThreshold={0.4}
      onEndReached={() => { if (directory.hasMore && !directory.error) void directory.loadMore(); }}
      renderItem={({ item }) => <View style={styles.cards}>
        {item.map(store => <View key={store.id} style={[styles.cell, { width: cardWidth }]}>
          <StoreCard store={store} logo={logos.get(store.id)} compact searchResult orderable onPress={() => openStore(store.id)} />
        </View>)}
      </View>}
      ListEmptyComponent={directory.loading ? <View accessibilityLiveRegion="polite" style={styles.placeholders}>
        <Text style={[styles.statusText, { color: colors.textMuted }]}>جارٍ تحميل المتاجر…</Text>
        {[0, 1].map(row => <View key={row} style={styles.cards}>
          {Array.from({ length: columns }, (_, index) => <View key={index} accessible={false}
            style={[styles.placeholder, { width: cardWidth, backgroundColor: colors.surfaceSecondary }]} />)}
        </View>)}
      </View> : directory.error ? null : <AppEmptyState icon="storefront-outline" title="لم نجد متاجر"
        description={searchText.trim() ? "جرّب اسمًا آخر أو غيّر التصنيف." : "لا توجد متاجر متاحة ضمن هذا الاختيار."} />}
      ListFooterComponent={directory.error ? <View style={styles.footer} accessibilityLiveRegion="polite">
        <Text style={[styles.statusText, { color: colors.error }]}>
          {directory.error === "more" ? "تعذر تحميل مزيد من المتاجر." : rows.length ? "تعذر التحديث. نعرض آخر نتائج متاحة." : "تعذر تحميل المتاجر."}
        </Text>
        <AppButton compact title="إعادة المحاولة" variant="outline" onPress={() => void directory.retry()} />
      </View> : directory.loadingMore ? <View style={styles.footer} accessibilityLabel="جارٍ تحميل مزيد من المتاجر">
        <ActivityIndicator color={colors.primary} />
      </View> : directory.hasMore ? <View style={styles.footer}>
        <AppButton compact title="تحميل المزيد" variant="outline" onPress={() => void directory.loadMore()} />
      </View> : null}
    />
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: Spacing.four },
  controls: { paddingTop: Spacing.two, paddingBottom: Spacing.two, gap: Spacing.two },
  searchBox: { direction: "rtl", flexDirection: "row", alignItems: "center", minHeight: ControlSizes.input,
    borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: Spacing.two, gap: Spacing.two },
  input: { flex: 1, minWidth: 0, minHeight: ControlSizes.input, fontFamily: Fonts.medium,
    fontSize: FontSizes.sm, textAlign: "right", writingDirection: "rtl" },
  iconButton: { minWidth: ControlSizes.touch, minHeight: ControlSizes.touch, alignItems: "center", justifyContent: "center" },
  rail: { direction: "rtl", flexDirection: "row", gap: Spacing.two },
  list: { paddingBottom: Spacing.six, paddingTop: Spacing.two },
  cards: { direction: "rtl", flexDirection: "row", gap: Spacing.two, paddingBottom: Spacing.two },
  cell: { flexDirection: "row", minWidth: 0 },
  placeholders: { gap: Spacing.two },
  placeholder: { minHeight: 116, borderRadius: Radius.lg },
  footer: { minHeight: ControlSizes.touch, gap: Spacing.two, justifyContent: "center", paddingVertical: Spacing.two },
  statusText: { textAlign: "right", fontFamily: Fonts.medium, fontSize: FontSizes.sm },
});
