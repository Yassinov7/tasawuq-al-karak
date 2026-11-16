import { useMemo, type ReactElement } from "react";
import { RefreshControl, SectionList, Text, useWindowDimensions, View } from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { StoreCard } from "@/components/marketplace/StoreCard";
import { styles } from "@/components/search/searchStyles";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useCustomerStoreLogos } from "@/hooks/useCustomerStoreLogos";
import { categoryAncestors } from "@/lib/category-tree";
import type { CustomerOffer } from "@/lib/customer-offers";
import type { CustomerSearchResults } from "@/lib/customer-search";
import type { Category, Product, Store } from "@/types/catalog";

type Cell =
  | { kind: "category"; category: Category; label: string }
  | { kind: "store"; store: Store }
  | { kind: "offer"; offer: CustomerOffer }
  | { kind: "product"; product: Product };

type Row = { key: string; cells: Cell[]; columns: number };

function cellKey(cell: Cell) {
  switch (cell.kind) {
    case "category": return "category:" + cell.category.id;
    case "store": return "store:" + cell.store.id;
    case "offer": return "offer:" + cell.offer.id;
    case "product": return "product:" + cell.product.id;
  }
}

function gridRows(cells: Cell[], columns: number): Row[] {
  const rows: Row[] = [];
  for (let start = 0; start < cells.length; start += columns) {
    const row = cells.slice(start, start + columns);
    rows.push({ key: row.map(cellKey).join(","), cells: row, columns });
  }
  return rows;
}

type Props = {
  results: CustomerSearchResults;
  categories: Category[];
  header: ReactElement;
  empty: ReactElement | null;
  refreshing: boolean;
  onRefresh: () => void;
  onCategory: (id: string) => void;
  onStore: (id: string) => void;
  onProduct: (id: string) => void;
  onOffer: (id: string) => void;
};

export function SearchResults({
  results, categories, header, empty, refreshing, onRefresh, onCategory, onStore, onProduct, onOffer,
}: Props) {
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 320 || fontScale > 1.25 ? 1 : 2;
  const categoryColumns = columns === 2 && width >= 360 && fontScale <= 1.15 ? 3 : columns;
  const availableWidth = Math.min(width, 760) - 2 * Spacing.four;
  const storeIds = useMemo(() => results.stores.map(store => store.id), [results.stores]);
  const { logos } = useCustomerStoreLogos(storeIds, true);
  const sections = useMemo(() => {
    const sections = [
      { key: "products", title: "المنتجات", data: gridRows(results.products.map(product => ({ kind: "product", product })), columns) },
      { key: "stores", title: "المتاجر", data: gridRows(results.stores.map(store => ({ kind: "store", store })), columns) },
      { key: "offers", title: "العروض", data: gridRows(results.offers.map(offer => ({ kind: "offer", offer })), columns) },
    ];
    const nodes = new Map(categories.map(category => [category.id, category]));
    const groups = new Map<string, { key: string; title: string; data: Cell[] }>();
    const roots: Cell[] = [];
    for (const category of results.categories) {
      const ancestors = categoryAncestors(category, nodes);
      const root = ancestors[0];
      if (root.id === category.id) {
        roots.push({ kind: "category", category, label: category.name });
        continue;
      }
      const group = groups.get(root.id) ?? { key: "category:" + root.id, title: root.name, data: [] };
      group.data.push({ kind: "category", category, label: ancestors.slice(1).map(node => node.name).join(" ← ") });
      groups.set(root.id, group);
    }
    const categorySections = [{ key: "categories", title: "التصنيفات", data: roots }, ...groups.values()];
    return [...sections, ...categorySections.map(section => ({ ...section, data: gridRows(section.data, categoryColumns) }))]
      .filter(section => section.data.length);
  }, [categories, categoryColumns, columns, results]);

  return <SectionList<Row>
    style={styles.container}
    contentContainerStyle={styles.content}
    sections={sections}
    keyExtractor={row => row.key}
    ListHeaderComponent={header}
    ListEmptyComponent={empty}
    stickySectionHeadersEnabled={false}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="on-drag"
    showsVerticalScrollIndicator={false}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    renderSectionHeader={({ section }) => (
      <Text accessibilityRole="header" style={[styles.section, styles.heading, { color: colors.text }]}>{section.title}</Text>
    )}
    renderItem={({ item }) => {
      const cellWidth = Math.floor((availableWidth - (item.columns - 1) * Spacing.two) / item.columns);
      return <View style={[styles.item, styles.resultRow]}>
        {item.cells.map(cell => (
          <View key={cellKey(cell)} style={[styles.resultCell, { width: cellWidth }]}>
            {cell.kind === "category" ? (
              <CategoryChip grid label={cell.label} icon={cell.category.icon} onPress={() => onCategory(cell.category.id)} />
            ) : cell.kind === "store" ? (
              <StoreCard store={cell.store} logo={logos.get(cell.store.id)} compact searchResult onPress={() => onStore(cell.store.id)} />
            ) : cell.kind === "offer" ? (
              <OfferCard offer={cell.offer} compact cardWidth={cellWidth} onPress={() => onOffer(cell.offer.id)} />
            ) : (
              <ProductCard product={cell.product} compact cardWidth={cellWidth} showOffer onPress={() => onProduct(cell.product.id)} />
            )}
          </View>
        ))}
      </View>;
    }}
  />;
}
