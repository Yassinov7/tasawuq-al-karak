import { Pressable, Text, View } from "react-native";

import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { styles } from "@/components/search/searchStyles";

type Props = { isInitial: boolean; colors: { primaryLight: string; border: string; surface: string; primary: string; text: string; textSecondary: string; textMuted: string }; quickSearches: string[]; query: string; searchText: string; filter: string; selectedCategoryId: string | null; onQuickSearch: (value: string) => void; onResetFilters: () => void; };
export function SearchEmptyState(props: Props) {
  const { isInitial, colors, quickSearches, query, searchText, filter, selectedCategoryId, onQuickSearch, onResetFilters } = props;
  return isInitial ? (<>
          <View style={styles.emptyState}>
            <View
              style={[
                styles.heroIcon,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.heroIconInner,
                  {
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <AppIcon
                  name="search-outline"
                  size={36}
                  color={colors.primary}
                />
              </View>
            </View>

            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                },
              ]}
            >
              ماذا تبحث عنه؟
            </Text>

            <Text
              style={[
                styles.description,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              ابحث عن متجر أو منتج أو تصنيف من متاجر الكرك الشرقي.
            </Text>

            <View
              style={[
                styles.quickSearchCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.quickHeader}>
                <View
                  style={[
                    styles.quickIcon,
                    {
                      backgroundColor: colors.primaryLight,
                    },
                  ]}
                >
                  <AppIcon
                    name="sparkles-outline"
                    size={17}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.quickTitleArea}>
                  <Text
                    style={[
                      styles.quickTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    جرّب البحث عن
                  </Text>

                  <Text
                    style={[
                      styles.quickSubtitle,
                      {
                        color: colors.textMuted,
                      },
                    ]}
                  >
                    كلمات شائعة
                  </Text>
                </View>
              </View>

              <View style={styles.quickChips}>
                {quickSearches.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => onQuickSearch(item)}
                    style={({ pressed }) => [
                      styles.quickChip,
                      {
                        backgroundColor: colors.primaryLight,
                        borderColor: colors.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        {
                          color: colors.primary,
                        },
                      ]}
                    >
                      {item}
                    </Text>

                    <AppIcon
                      name="arrow-back"
                      size={12}
                      color={colors.primary}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
  </>) : (<>
          <View style={styles.noResults}>
            <AppEmptyState
              icon="search-outline"
              title="لم نجد نتائج"
              description={
                query
                  ? `لم نجد نتيجة تطابق «${searchText.trim()}» مع الفلاتر المختارة.`
                  : "لا توجد نتائج متاحة ضمن هذه الفلاتر حالياً."
              }
            />

            <Text
              style={[
                styles.emptyHint,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              جرّب كلمة مختلفة أو أزل بعض الفلاتر.
            </Text>
            {filter !== "all" || selectedCategoryId  ? (
              <Pressable
                onPress={onResetFilters}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.resetFilters,
                  {
                    backgroundColor: colors.primaryLight,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon name="options-outline" size={16} color={colors.primary} />
                <Text style={[styles.resetFiltersText, { color: colors.primary }]}>
                  إزالة الفلاتر
                </Text>
              </Pressable>
            ) : null}
          </View>
  </>);
}
