import { Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { StoreCard } from "@/components/marketplace/StoreCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { categories, stores } from "@/constants/catalog";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";

export default function StoresScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();

  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredStores = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();

    return stores.filter((store) => {
      const matchesCategory =
        selectedCategory === "all" ||
        store.categoryIds.includes(selectedCategory);

      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const categoryNames = store.categoryIds
        .map(
          (categoryId) =>
            categories.find((category) => category.id === categoryId)?.name ??
            "",
        )
        .join(" ");

      const searchableText = [
        store.name,
        store.description,
        store.location,
        categoryNames,
      ]
        .join(" ")
        .toLocaleLowerCase();

      return searchableText.includes(query);
    });
  }, [searchText, selectedCategory]);

  const featuredStores = useMemo(
    () => filteredStores.filter((store) => store.featured),
    [filteredStores],
  );

  const handleStorePress = (storeId: string) => {
    router.push({
      pathname: "/store-details",
      params: { id: storeId },
    } as Href);
  };

  const clearFilters = () => {
    setSearchText("");
    setSelectedCategory("all");
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="المتاجر" cartCount={itemCount} mode="shared" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <AppIcon name="search-outline" size={21} color={colors.textMuted} />

          <Text
            style={[
              styles.searchPlaceholder,
              {
                color: searchText ? colors.text : colors.textMuted,
              },
            ]}
            numberOfLines={1}
          >
            {searchText || "ابحث عن متجر..."}
          </Text>

          {searchText ? (
            <Pressable
              onPress={() => setSearchText("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="مسح البحث"
            >
              <AppIcon name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              // Text input will be added here when the
              // search field becomes interactive.
            }}
            style={({ pressed }) => [
              styles.searchButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="البحث في المتاجر"
          >
            <AppIcon name="search-outline" size={19} color={colors.surface} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                تصفح المتاجر
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                متاجر من الكرك الشرقي
              </Text>
            </View>

            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.countText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                {filteredStores.length}
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            <CategoryChip
              label="الكل"
              icon="grid-outline"
              active={selectedCategory === "all"}
              onPress={() => setSelectedCategory("all")}
            />

            {categories.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.name}
                icon={category.icon}
                active={selectedCategory === category.id}
                onPress={() => setSelectedCategory(category.id)}
              />
            ))}
          </ScrollView>
        </View>

        {featuredStores.length > 0 &&
        !searchText &&
        selectedCategory === "all" ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  متاجر مميزة
                </Text>

                <Text
                  style={[
                    styles.sectionSubtitle,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  متاجر مختارة من منطقتك
                </Text>
              </View>

              <AppIcon name="star" size={20} color={colors.accent} />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {featuredStores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  compact
                  onPress={() => handleStorePress(store.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {searchText
                  ? "نتائج البحث"
                  : selectedCategory === "all"
                    ? "جميع المتاجر"
                    : "المتاجر حسب التصنيف"}
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                {filteredStores.length} متجر متاح
              </Text>
            </View>
          </View>

          {filteredStores.length > 0 ? (
            <View style={styles.grid}>
              {filteredStores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  compact
                  onPress={() => handleStorePress(store.id)}
                />
              ))}
            </View>
          ) : (
            <AppEmptyState
              icon="storefront-outline"
              title="لم نجد متاجر"
              description={
                searchText
                  ? "جرّب كلمة بحث مختلفة أو غيّر التصنيف."
                  : "لا توجد متاجر ضمن هذا التصنيف حالياً."
              }
              buttonText="إظهار جميع المتاجر"
              onButtonPress={clearFilters}
            />
          )}
        </View>

        <View
          style={[
            styles.note,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <AppIcon
            name="information-circle-outline"
            size={18}
            color={colors.textMuted}
          />

          <Text
            style={[
              styles.noteText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            المتاجر والبيانات المعروضة حالياً تجريبية، وسيتم ربطها لاحقاً
            ببيانات المتاجر الفعلية.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.ten,
  },

  searchBox: {
    minHeight: 52,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    paddingStart: Spacing.three,
    paddingEnd: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  searchPlaceholder: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  searchButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  section: {
    marginTop: Spacing.six,
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  sectionSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  countBadge: {
    minWidth: 34,
    height: 30,
    paddingHorizontal: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  countText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
  },

  categories: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },

  horizontalList: {
    flexDirection: "row-reverse",
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },

  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.three,
  },

  note: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    marginTop: Spacing.six,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  noteText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },
});
