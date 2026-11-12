import type { Category, Product, Store } from "@/types/catalog";
import { ScrollView, Text, View } from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { StoreCard } from "@/components/marketplace/StoreCard";
import { useCustomerStoreLogos } from "@/hooks/useCustomerStoreLogos";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { styles } from "@/components/search/searchStyles";
import { AppIcon } from "@/components/ui/AppIcon";

type Colors = { border: string; text: string; textMuted: string; textSecondary: string; primary: string; primaryLight: string; surface: string; surfaceSecondary: string; accent: string };
type Props = { colors: Colors; query: string; searchText: string; totalResults: number; visibleResults: { categories: Category[]; stores: Store[]; products: Product[] }; onCategoryPress: (name: string) => void; onStorePress: (id: string) => void; onProductPress: (id: string) => void; };

export function SearchResults(props: Props) {
  const { colors, query, searchText, totalResults, visibleResults, onCategoryPress, onStorePress, onProductPress } = props;
  const { logos } = useCustomerStoreLogos(visibleResults.stores.map(store => store.id));
  return (
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
                      onPress={() => onCategoryPress(category.id)}
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
                  {visibleResults.stores.map(store => (
                    <StoreCard key={store.id} store={store} logo={logos.get(store.id)} searchResult
                      onPress={() => onStorePress(store.id)} />
                  ))}
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
                      onPress={() => onProductPress(product.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>  );
}

function SectionHeader({ title, icon, colors }: { title: string; icon: React.ComponentProps<typeof AppIcon>["name"]; colors: Colors }) {
  return <View style={styles.sectionHeader}><View style={[styles.sectionIcon, { backgroundColor: colors.primaryLight }]}><AppIcon name={icon} size={18} color={colors.primary} /></View><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text></View>;
}
