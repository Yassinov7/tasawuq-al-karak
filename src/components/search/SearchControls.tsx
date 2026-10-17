import type { Dispatch, SetStateAction } from "react";
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { styles } from "@/components/search/searchStyles";
import { AppIcon } from "@/components/ui/AppIcon";

type SearchFilter = "all" | "products" | "stores" | "categories";
type ProductSort = "relevance" | "price-ascending" | "price-descending";
type CurrencyFilter = "all" | "SYP" | "USD";

type SearchControlsProps = {
  colors: { surface: string; border: string; text: string; textMuted: string; primary: string; accent: string; surfaceSecondary: string; textSecondary: string };
  searchText: string; filtersVisible: boolean; activeFilterCount: number; filter: SearchFilter;
  filterCounts: Record<SearchFilter, number>; selectedCategoryId: string | null; currencyFilter: CurrencyFilter; productSort: ProductSort;
  setSearchText: Dispatch<SetStateAction<string>>; setFiltersVisible: Dispatch<SetStateAction<boolean>>; setFilter: Dispatch<SetStateAction<SearchFilter>>;
  setSelectedCategoryId: Dispatch<SetStateAction<string | null>>; setCurrencyFilter: Dispatch<SetStateAction<CurrencyFilter>>; setProductSort: Dispatch<SetStateAction<ProductSort>>;
  onQueryChange: (value: string) => void; onSubmit: () => void;
};

const searchFilters: { id: SearchFilter; label: string; icon: React.ComponentProps<typeof AppIcon>["name"] }[] = [
  { id: "all", label: "الكل", icon: "apps-outline" }, { id: "products", label: "المنتجات", icon: "cube-outline" },
  { id: "stores", label: "المتاجر", icon: "storefront-outline" }, { id: "categories", label: "التصنيفات", icon: "grid-outline" },
];

export function SearchControls(props: SearchControlsProps) {
  const { colors, searchText, filtersVisible, activeFilterCount, filter, filterCounts, selectedCategoryId, currencyFilter, productSort, setSearchText, setFiltersVisible, setFilter, setSelectedCategoryId, setCurrencyFilter, setProductSort, onQueryChange, onSubmit } = props;
  return (<>
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
              onChangeText={onQueryChange}
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
              onSubmitEditing={onSubmit}
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
                  {selected ? (
                    <AppIcon name="checkmark" size={14} color={colors.surface} />
                  ) : null}
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

  </>);
}
