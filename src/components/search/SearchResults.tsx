import type { Category, Product, Store } from "@/constants/catalog";
import { Pressable, ScrollView, Text, View } from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { styles } from "@/components/search/searchStyles";
import { AppIcon } from "@/components/ui/AppIcon";

type Colors = { border: string; text: string; textMuted: string; textSecondary: string; primary: string; primaryLight: string; surface: string; surfaceSecondary: string; accent: string };
type Props = { colors: Colors; query: string; searchText: string; totalResults: number; visibleResults: { categories: Category[]; stores: Store[]; products: Product[] }; storeCategories: Category[]; onCategoryPress: (name: string) => void; onStorePress: (id: string) => void; onProductPress: (id: string) => void; };

export function SearchResults(props: Props) {
  const { colors, query, searchText, totalResults, visibleResults, storeCategories, onCategoryPress, onStorePress, onProductPress } = props;
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
                      onPress={() => onCategoryPress(category.name)}
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
                  {visibleResults.stores.map((store) => {
                    const category = storeCategories.find((item) =>
                      store.categoryIds.includes(item.id),
                    );

                    return (
                      <Pressable
                        key={store.id}
                        onPress={() => onStorePress(store.id)}
                        style={({ pressed }) => [
                          styles.storeResult,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.storeResultIcon,
                            {
                              backgroundColor: colors.primaryLight,
                            },
                          ]}
                        >
                          <AppIcon
                            name={category?.icon ?? "storefront-outline"}
                            size={25}
                            color={colors.primary}
                          />
                        </View>

                        <View style={styles.storeResultInfo}>
                          <Text
                            style={[
                              styles.storeResultName,
                              {
                                color: colors.text,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {store.name}
                          </Text>

                          <Text
                            style={[
                              styles.storeResultDescription,
                              {
                                color: colors.textSecondary,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {store.description}
                          </Text>

                          <View style={styles.storeResultMeta}>
                            <View style={styles.storeMetaItem}>
                              <AppIcon
                                name="star"
                                size={12}
                                color={colors.accent}
                              />

                              <Text
                                style={[
                                  styles.storeMetaText,
                                  {
                                    color: colors.textMuted,
                                  },
                                ]}
                              >
                                {store.rating === undefined ? "—" : store.rating.toFixed(1)}
                              </Text>
                            </View>

                            <View style={styles.storeMetaItem}>
                              <AppIcon
                                name="time-outline"
                                size={12}
                                color={colors.textMuted}
                              />

                              <Text
                                style={[
                                  styles.storeMetaText,
                                  {
                                    color: colors.textMuted,
                                  },
                                ]}
                              >
                                {store.deliveryTime}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.storeArrow,
                            {
                              backgroundColor: colors.surfaceSecondary,
                            },
                          ]}
                        >
                          <AppIcon
                            name="chevron-back"
                            size={16}
                            color={colors.textSecondary}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
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
