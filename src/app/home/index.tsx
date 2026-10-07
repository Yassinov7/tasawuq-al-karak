import { Href, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { StoreCard } from "@/components/marketplace/StoreCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { CustomerCatalogStatus } from "@/components/marketplace/CustomerCatalogStatus";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";

export default function HomeTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount, selectedOfferIds } = useCart();
  const { categories, offers, products, stores } = useCustomerCatalog();

  const featuredStores = stores.slice(0, 6);

  const popularProducts = products.filter((product) => product.available).slice(0, 8);

  const featuredOffers = offers.slice(0, 8);

  const visibleStores = featuredStores;

  const handleSearch = () => {
    router.push("/home/search");
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
      <AppHeader cartCount={itemCount} mode="customer" />
      <CustomerCatalogStatus />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
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
              أهلاً بك في تسوق
            </Text>

            <Text
              style={[
                styles.greetingSubtitle,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              اكتشف متاجر منطقتك وتسوق احتياجاتك بسهولة
            </Text>
          </View>

          <Pressable
            onPress={handleSearch}
            accessibilityRole="button"
            accessibilityLabel="ابحث عن منتج أو متجر"
            style={({ pressed }) => [
              styles.searchButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              pressed && styles.pressed,
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

            <Text
              style={[
                styles.searchLabel,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              ابحث عن منتج أو متجر
            </Text>

            <AppIcon name="arrow-back" size={19} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="التصنيفات"
            action="عرض الكل"
            onAction={() => router.push("/home/search")}
            colors={colors}
          />

          <ScrollView
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
          </ScrollView>
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
          <View style={styles.promoContent}>
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
              عروض مميزة
              {"\n"}
              من متاجر منطقتك
            </Text>

            <View style={styles.promoFooter}>
              <Text
                style={[
                  styles.promoDescription,
                  {
                    color: colors.primaryLight,
                  },
                ]}
              >
                باقات وعروض من متاجر منطقتك
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

        {featuredOffers.length > 0 ? (
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
              {featuredOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  added={selectedOfferIds.includes(offer.id)}
                  onPress={() =>
                    router.push({
                      pathname: "/offer-details",
                      params: { id: offer.id },
                    })
                  }
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
            المنتجات والأسعار والعروض الحالية تجريبية ضمن بيانات التطبيق، وسيتم
            ربطها لاحقاً ببيانات المتاجر الفعلية.
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

  topArea: {
    marginBottom: Spacing.two,
  },

  greeting: {
    alignItems: "flex-end",
  },

  greetingTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    lineHeight: 30,
  },

  greetingSubtitle: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  searchButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 52,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
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

  searchLabel: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "right",
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
    minHeight: 150,
    marginTop: Spacing.six,
    borderRadius: Radius.xl,
    overflow: "hidden",
  },

  promoContent: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    padding: Spacing.four,
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
    fontSize: FontSizes.lg,
    lineHeight: 27,
    textAlign: "right",
  },

  promoFooter: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    marginTop: Spacing.three,
  },

  promoDescription: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  promoAction: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    minHeight: 36,
    borderRadius: Radius.full,
  },

  promoActionText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.xs,
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
