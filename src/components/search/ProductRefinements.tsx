import type { Dispatch, SetStateAction } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { Category } from "@/constants/catalog";
import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { styles } from "@/components/search/searchStyles";
import { AppIcon } from "@/components/ui/AppIcon";

type SearchFilter = "all" | "products" | "stores" | "categories";
type ProductSort = "relevance" | "price-ascending" | "price-descending";
type CurrencyFilter = "all" | "SYP" | "USD";
type Props = { filtersVisible: boolean; filter: SearchFilter; productResultsForRefinement: boolean; colors: { surface: string; border: string; text: string; textSecondary: string; primary: string; primaryLight: string; accentLight: string; accent: string }; selectedCategoryId: string | null; productCategories: Category[]; currencyFilter: CurrencyFilter; productSort: ProductSort; setSelectedCategoryId: Dispatch<SetStateAction<string | null>>; setCurrencyFilter: Dispatch<SetStateAction<CurrencyFilter>>; setProductSort: Dispatch<SetStateAction<ProductSort>>; setFilter: Dispatch<SetStateAction<SearchFilter>>; };

export function ProductRefinements(props: Props) {
  const { filtersVisible, filter, productResultsForRefinement, colors, selectedCategoryId, productCategories, currencyFilter, productSort, setSelectedCategoryId, setCurrencyFilter, setProductSort, setFilter } = props;
  return (<>
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
                      {selected ? <AppIcon name="checkmark" size={14} color={colors.primary} /> : null}
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
                      {selected ? <AppIcon name="checkmark" size={14} color={colors.accent} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

  </>);
}
