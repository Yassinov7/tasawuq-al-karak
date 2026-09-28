import { Href, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { StoreCard } from "@/components/marketplace/StoreCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useCatalog } from "@/context/CatalogContext";
import { useTheme } from "@/context/ThemeContext";

export default function HomeTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { categories, products, stores, isLoading, error, refresh } = useCatalog();

  const [searchText, setSearchText] = useState("");

  const featuredStores = stores.slice(0, 6);

  const popularProducts = products.filter((product) => product.available).slice(0, 8);

  const offerProducts = products.filter((product) => product.available && product.offer).slice(0, 8);

  const visibleStores =
    featuredStores.length > 0 ? featuredStores : stores.slice(0, 6);

  const handleSearch = () => {
    const query = searchText.trim();

    Keyboard.dismiss();

    router.push({
      pathname: "/home/search",
      params: query ? { q: query } : undefined,
    });
  };

  const handleStorePress = (storeId: string) => {
    router.push({
      pathname: "/store-details",
      params: {
        id: storeId,
      },
    } as Href);
  };

  const handleProductPress = (productId: string) => {
    router.push({
      pathname: "/product-details",
      params: {
        id: productId,
      },
    } as Href);
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
      <AppHeader cartCount={itemCount} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : error ? (
          <Pressable onPress={() => void refresh()} style={styles.loadError}>
            <Text style={[styles.bottomNoteText, { color: colors.error }]}>{error} — اضغط لإعادة المحاولة</Text>
          </Pressable>
        ) : null}
        <View style={styles.topArea}>
          <View style={styles.greeting}>
            <Text
              style={[
                styles.greetingTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              أهلاً بك 👋
            </Text>

            <View style={styles.locationRow}>
              <AppIcon
                name="location-outline"
                size={15}
                color={colors.primary}
              />

              <Text
                style={[
                  styles.location,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                الكرك الشرقي
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.searchIcon,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon name="search-outline" size={19} color={colors.primary} />
            </View>

            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              placeholder="ابحث عن منتج أو متجر"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={[
                styles.searchInput,
                {
                  color: colors.text,
                },
              ]}
              textAlign="right"
            />

            <Pressable
              onPress={handleSearch}
              style={({ pressed }) => [
                styles.searchButton,
                {
                  backgroundColor: colors.primary,
                },
                pressed && styles.pressed,
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="بحث"
            >
              <AppIcon name="arrow-back" size={19} color={colors.surface} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="التصنيفات"
            action="عرض الكل"
            onAction={() => router.push("/home/search")}
            colors={colors}
          />

          {visibleStores.length ? <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {categories.slice(0, 12).map((category) => (
              <CategoryChip
                key={category.id}
                label={category.name}
                icon={category.icon}
                onPress={() =>
                  router.push({
                    pathname: "/home/search",
                    params: {
                      category: category.name,
                    },
                  })
                }
              />
            ))}
          </ScrollView> : <Text style={[styles.bottomNoteText, { color: colors.textSecondary, textAlign: "right" }]}>لا توجد متاجر معتمدة في منطقتك بعد.</Text>}
        </View>

        <Pressable
          onPress={() => router.push("/home/offers")}
          style={({ pressed }) => [
            styles.promoCard,
            {
              backgroundColor: colors.primary,
            },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="اكتشف العروض"
        >
          <View style={styles.promoText}>
            <View
              style={[
                styles.promoBadge,
                {
                  backgroundColor: colors.primaryDark,
                },
              ]}
            >
              <AppIcon
                name="sparkles-outline"
                size={13}
                color={colors.accent}
              />

              <Text
                style={[
                  styles.promoBadgeText,
                  {
                    color: colors.surface,
                  },
                ]}
              >
                تسوق محلي
              </Text>
            </View>

            <Text
              style={[
                styles.promoTitle,
                {
                  color: colors.surface,
                },
              ]}
            >
              عروض ومتاجر
              {"\n"}
              قريبة منك
            </Text>

            <View
              style={[
                styles.promoAction,
                {
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.promoActionText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                اكتشف العروض
              </Text>

              <AppIcon name="arrow-back" size={15} color={colors.primary} />
            </View>
          </View>

          <View
            style={[
              styles.promoVisual,
              {
                backgroundColor: colors.primaryDark,
              },
            ]}
          >
            <AppIcon name="pricetags-outline" size={58} color={colors.accent} />

            <View
              style={[
                styles.promoDot,
                {
                  backgroundColor: colors.surface,
                },
              ]}
            />
          </View>
        </Pressable>

        <View style={styles.section}>
          <SectionHeader
            title="المتاجر القريبة"
            subtitle="متاجر من الكرك الشرقي"
            action="عرض الكل"
            onAction={() => router.push("/stores")}
            colors={colors}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {visibleStores.map((store) => (
              <StoreCard
                key={store.id}
                store={store}
                onPress={() => handleStorePress(store.id)}
              />
            ))}
          </ScrollView>
        </View>

        {popularProducts.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="الأكثر طلباً"
              subtitle="منتجات يطلبها أهل المنطقة"
              colors={colors}
              icon="trending-up-outline"
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {popularProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onPress={() => handleProductPress(product.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {offerProducts.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="عروض اليوم"
              subtitle="فرص مميزة من متاجر منطقتك"
              action="كل العروض"
              onAction={() => router.push("/home/offers")}
              colors={colors}
              icon="pricetags-outline"
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {offerProducts.map((product) => (
                <OfferCard
                  key={product.id}
                  product={product}
                  onPress={() => handleProductPress(product.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View
          style={[
            styles.bottomNote,
            {
              borderTopColor: colors.border,
            },
          ]}
        >
          <AppIcon
            name="information-circle-outline"
            size={16}
            color={colors.textMuted}
          />

          <Text
            style={[
              styles.bottomNoteText,
              {
                color: colors.textMuted,
              },
            ]}
          >
            بيانات المتاجر والمنتجات والأسعار المعروضة تُحمّل الآن من قاعدة البيانات.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

type ThemeColors = ReturnType<typeof useTheme>["colors"];

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  icon?: React.ComponentProps<typeof AppIcon>["name"];
  colors: ThemeColors;
};

function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
  icon,
  colors,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleArea}>
        <View style={styles.titleRow}>
          {icon ? (
            <View
              style={[
                styles.sectionIcon,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon name={icon} size={18} color={colors.primary} />
            </View>
          ) : null}

          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            {title}
          </Text>
        </View>

        {subtitle ? (
          <Text
            style={[
              styles.sectionSubtitle,
              {
                color: colors.textMuted,
              },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text
            style={[
              styles.seeAll,
              {
                color: colors.primary,
              },
            ]}
          >
            {action}
          </Text>
        </Pressable>
      ) : null}
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

  loading: { marginTop: Spacing.three },
  loadError: { marginTop: Spacing.three, padding: Spacing.three, borderRadius: Radius.md, backgroundColor: "transparent" },

  topArea: {
    marginBottom: Spacing.two,
  },

  greeting: {
    alignItems: "flex-end",
  },

  greetingTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
    lineHeight: 36,
  },

  locationRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.one,
  },

  location: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
  },

  searchContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 56,
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  searchIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },

  searchInput: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: 0,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
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
    minHeight: 40,
    marginBottom: Spacing.three,
  },

  sectionTitleArea: {
    flex: 1,
    alignItems: "flex-end",
  },

  titleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    lineHeight: 26,
    textAlign: "right",
  },

  sectionSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  sectionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  seeAll: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },

  categories: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },

  promoCard: {
    flexDirection: "row-reverse",
    minHeight: 174,
    marginTop: Spacing.six,
    borderRadius: Radius.xl,
    overflow: "hidden",
  },

  promoText: {
    flex: 1,
    alignItems: "flex-end",
    padding: Spacing.five,
  },

  promoBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },

  promoBadgeText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  promoTitle: {
    marginTop: Spacing.two,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    lineHeight: 30,
    textAlign: "right",
  },

  promoAction: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },

  promoActionText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
  },

  promoVisual: {
    width: 104,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  promoDot: {
    position: "absolute",
    width: 12,
    height: 12,
    top: 34,
    right: 24,
    borderRadius: Radius.full,
    opacity: 0.75,
  },

  horizontalList: {
    flexDirection: "row-reverse",
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },

  bottomNote: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    marginTop: Spacing.six,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.two,
    borderTopWidth: 1,
  },

  bottomNoteText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  pressed: {
    opacity: 0.72,
  },
});
