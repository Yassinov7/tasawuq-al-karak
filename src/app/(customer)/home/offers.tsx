import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { CustomerCatalogStatus } from "@/components/marketplace/CustomerCatalogStatus";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { CustomerMarketHeader } from "@/components/navigation/CustomerMarketHeader";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { ControlSizes, FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { categoryFilterIds } from "@/lib/category-tree";
import { matchesAllCustomerSearchTerms, normalizeCustomerSearchText } from "@/lib/customer-search";
import type { CustomerOffer } from "@/lib/customer-offers";

export default function OffersTab() {
  const { user, loading } = useAuth();
  const scope = loading ? "loading" : JSON.stringify([user?.id, user?.role, user?.app_metadata.role, user?.app_metadata.roles]);
  return <OffersContent key={scope} />;
}

function OffersContent() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount, selectedOfferIds } = useCart();
  const { categories, offers, stores, loading, error } = useCustomerCatalog();
  const { width, fontScale } = useWindowDimensions();
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const columns = width < 320 || fontScale > 1.25 ? 1 : 2;
  const cardWidth = Math.floor((Math.min(width, 760) - Spacing.four * 2 - (columns - 1) * Spacing.two) / columns);
  const storeNames = useMemo(() => new Map(stores.map(store => [store.id, store.name])), [stores]);
  const categoryIds = useMemo(() => selectedCategory ? categoryFilterIds(categories, selectedCategory) : null,
    [categories, selectedCategory]);
  const offerCategories = useMemo(() => {
    const ids = new Set(offers.flatMap(offer => offer.items.map(item => item.product.categoryId)));
    return categories.filter(category => ids.has(category.id) || categories.some(child => ids.has(child.id) && child.parentId === category.id));
  }, [categories, offers]);
  const filteredOffers = useMemo(() => {
    const terms = normalizeCustomerSearchText(searchText).split(" ").filter(Boolean);
    return offers.filter(offer => {
      if (categoryIds && !offer.items.some(item => categoryIds.has(item.product.categoryId))) return false;
      if (!terms.length) return true;
      const type = { discount: "خصم", bundle: "باقة", buy_x_get_y: "هدية" }[offer.offer_type];
      const searchable = [offer.title, offer.description, type, storeNames.get(offer.store_id),
        ...offer.items.map(item => item.product.name)].filter(Boolean).join(" ");
      return matchesAllCustomerSearchTerms(searchable, terms);
    });
  }, [categoryIds, offers, searchText, storeNames]);
  const rows = useMemo(() => {
    const result: CustomerOffer[][] = [];
    for (let index = 0; index < filteredOffers.length; index += columns) result.push(filteredOffers.slice(index, index + columns));
    return result;
  }, [columns, filteredOffers]);

  const controls = <View style={styles.controls}>
    <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppIcon name="search-outline" size={20} color={colors.primary} />
      <TextInput accessibilityLabel="ابحث داخل العروض" placeholder="ابحث باسم العرض أو المتجر أو المنتج"
        value={searchText} maxLength={160} onChangeText={setSearchText} onSubmitEditing={Keyboard.dismiss}
        returnKeyType="search" autoCorrect={false} placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text }]} />
      {searchText ? <Pressable accessibilityRole="button" accessibilityLabel="مسح بحث العروض"
        onPress={() => setSearchText("")} style={styles.clear}>
        <AppIcon name="close-circle" size={20} color={colors.textMuted} />
      </Pressable> : null}
    </View>
    {offerCategories.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" contentContainerStyle={styles.categories}>
      <CategoryChip label="كل العروض" icon="pricetags-outline" active={!selectedCategory}
        onPress={() => setSelectedCategory(null)} />
      {offerCategories.map(category => <CategoryChip key={category.id} label={category.name} icon={category.icon}
        active={selectedCategory === category.id}
        onPress={() => setSelectedCategory(current => current === category.id ? null : category.id)} />)}
    </ScrollView> : null}
    <View style={styles.resultHeader}>
      <View style={styles.resultCopy}>
        <Text style={[styles.title, { color: colors.text }]}>العروض المتاحة</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {filteredOffers.length.toLocaleString("ar-SY")} {filteredOffers.length === 1 ? "عرض" : "عروض"}
        </Text>
      </View>
      {(searchText || selectedCategory) ? <Pressable accessibilityRole="button" accessibilityLabel="مسح تصفية العروض"
        onPress={() => { setSearchText(""); setSelectedCategory(null); }} style={styles.reset}>
        <Text style={[styles.resetText, { color: colors.primary }]}>مسح التصفية</Text>
      </Pressable> : null}
    </View>
  </View>;

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <CustomerMarketHeader title="العروض" cartCount={itemCount} mode="customer" />
    <CustomerCatalogStatus />
    <FlatList style={styles.container} contentContainerStyle={styles.content} data={rows}
      keyExtractor={row => row[0].id} ListHeaderComponent={controls} showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      renderItem={({ item }) => <View style={styles.cards}>{item.map(offer => <View key={offer.id} style={{ width: cardWidth }}>
        <OfferCard offer={offer} compact cardWidth={cardWidth} added={selectedOfferIds.includes(offer.id)}
          onPress={() => { Keyboard.dismiss(); router.push({ pathname: "/offer-details", params: { id: offer.id } }); }} />
      </View>)}</View>}
      ListEmptyComponent={loading || error ? null : <AppEmptyState icon="pricetags-outline"
        title={offers.length ? "لم نجد عروضًا مطابقة" : "لا توجد عروض حاليًا"}
        description={offers.length ? "جرّب عبارة أخرى أو اختر تصنيفًا مختلفًا." : "ستظهر عروض المتاجر المؤهلة هنا عند توفرها."}
        buttonText={offers.length ? "عرض كل العروض" : undefined}
        onButtonPress={offers.length ? () => { setSearchText(""); setSelectedCategory(null); } : undefined} />}
    />
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", direction: "rtl",
    paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.six },
  controls: { gap: Spacing.two, paddingBottom: Spacing.three },
  search: { minHeight: ControlSizes.input, flexDirection: "row", alignItems: "center", gap: Spacing.two,
    borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: Spacing.two },
  input: { flex: 1, minWidth: 0, minHeight: ControlSizes.input, fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  clear: { minWidth: ControlSizes.touch, minHeight: ControlSizes.touch, alignItems: "center", justifyContent: "center" },
  categories: { direction: "rtl", flexDirection: "row", gap: Spacing.two },
  resultHeader: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: Spacing.two },
  resultCopy: { flex: 1, minWidth: 0, alignItems: "stretch" },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, ...RtlText },
  subtitle: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, ...RtlText },
  reset: { minHeight: ControlSizes.touch, justifyContent: "center", paddingHorizontal: Spacing.two },
  resetText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.xs, ...RtlText },
  cards: { flexDirection: "row", alignItems: "stretch", gap: Spacing.two, paddingBottom: Spacing.two },
});
