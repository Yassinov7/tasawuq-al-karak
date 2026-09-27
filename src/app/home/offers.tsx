import { Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { categories, products } from "@/constants/catalog";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";

export default function OffersTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();

  const [selectedCategory, setSelectedCategory] = useState("all");

  const offerProducts = useMemo(
    () => products.filter((product) => product.available && product.offer),
    [],
  );

  const filteredOffers = useMemo(() => {
    if (selectedCategory === "all") {
      return offerProducts;
    }

    return offerProducts.filter(
      (product) => product.categoryId === selectedCategory,
    );
  }, [offerProducts, selectedCategory]);

  const offerCategories = useMemo(() => {
    const categoryIds = new Set(
      offerProducts.map((product) => product.categoryId),
    );

    return categories.filter((category) => categoryIds.has(category.id));
  }, [offerProducts]);

  const featuredOffers = filteredOffers.slice(0, 4);

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
      <AppHeader title="العروض" cartCount={itemCount} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.hero,
            {
              backgroundColor: colors.primary,
            },
          ]}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroText}>
              <View
                style={[
                  styles.heroBadge,
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
                    styles.heroBadgeText,
                    {
                      color: colors.surface,
                    },
                  ]}
                >
                  عروض محلية
                </Text>
              </View>

              <Text
                style={[
                  styles.heroTitle,
                  {
                    color: colors.surface,
                  },
                ]}
              >
                وفر أكثر
                {"\n"}
                وتسوق بذكاء
              </Text>

              <Text
                style={[
                  styles.heroDescription,
                  {
                    color: colors.primaryLight,
                  },
                ]}
              >
                اكتشف المنتجات التي عليها عروض من متاجر منطقتك.
              </Text>
            </View>

            <View
              style={[
                styles.heroIcon,
                {
                  backgroundColor: colors.primaryDark,
                  borderColor: colors.primary,
                },
              ]}
            >
              <View
                style={[
                  styles.heroIconInner,
                  {
                    backgroundColor: colors.primary,
                  },
                ]}
              >
                <AppIcon name="pricetags" size={48} color={colors.accent} />
              </View>

              <View
                style={[
                  styles.heroDot,
                  {
                    backgroundColor: colors.surface,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="تصفح حسب التصنيف"
            subtitle="اختر نوع المنتجات التي تريدها"
            icon="options-outline"
            colors={colors}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          >
            <CategoryChip
              label="الكل"
              icon="grid-outline"
              active={selectedCategory === "all"}
              onPress={() => setSelectedCategory("all")}
            />

            {offerCategories.map((category) => (
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

        {featuredOffers.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="عروض مميزة"
              subtitle="اخترنا لك مجموعة من العروض"
              icon="flame-outline"
              colors={colors}
              iconBackground={colors.accentLight}
              iconColor={colors.accent}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
            >
              {featuredOffers.map((product) => (
                <OfferCard
                  key={product.id}
                  product={product}
                  featured
                  onPress={() => handleProductPress(product.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.allOffersHeader}>
            <View style={styles.allOffersTitleArea}>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {selectedCategory === "all" ? "كل العروض" : "العروض المتاحة"}
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  {
                    color: colors.textMuted,
                  },
                ]}
              >
                {filteredOffers.length} عرض متاح
              </Text>
            </View>

            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.border,
                },
              ]}
            >
              <AppIcon
                name="pricetags-outline"
                size={14}
                color={colors.primary}
              />

              <Text
                style={[
                  styles.countText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                {filteredOffers.length}
              </Text>
            </View>
          </View>

          {filteredOffers.length > 0 ? (
            <View style={styles.grid}>
              {filteredOffers.map((product) => (
                <OfferCard
                  key={product.id}
                  product={product}
                  onPress={() => handleProductPress(product.id)}
                />
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <AppEmptyState
                icon="pricetags-outline"
                title="لا توجد عروض حالياً"
                description="لا توجد منتجات عليها عروض ضمن هذا التصنيف حالياً."
                buttonText="عرض جميع العروض"
                onButtonPress={() => setSelectedCategory("all")}
              />
            </View>
          )}
        </View>

        <View
          style={[
            styles.bottomNote,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.noteIcon,
              {
                backgroundColor: colors.surface,
              },
            ]}
          >
            <AppIcon
              name="information-circle-outline"
              size={17}
              color={colors.primary}
            />
          </View>

          <Text
            style={[
              styles.bottomNoteText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            الأسعار والعروض المعروضة حالياً تجريبية ضمن بيانات التطبيق، وسيتم
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
  icon: React.ComponentProps<typeof AppIcon>["name"];
  colors: ThemeColors;
  iconBackground?: string;
  iconColor?: string;
};

function SectionHeader({
  title,
  subtitle,
  icon,
  colors,
  iconBackground,
  iconColor,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleArea}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.sectionIcon,
              {
                backgroundColor: iconBackground ?? colors.primaryLight,
              },
            ]}
          >
            <AppIcon
              name={icon}
              size={18}
              color={iconColor ?? colors.primary}
            />
          </View>

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

  hero: {
    minHeight: 190,
    borderRadius: Radius.xl,
    overflow: "hidden",
  },

  heroContent: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: Spacing.five,
  },

  heroText: {
    flex: 1,
    alignItems: "flex-end",
  },

  heroBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },

  heroBadgeText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  heroTitle: {
    marginTop: Spacing.two,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
    lineHeight: 35,
    textAlign: "right",
  },

  heroDescription: {
    maxWidth: 235,
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  heroIcon: {
    width: 102,
    height: 102,
    marginStart: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.full,
    position: "relative",
  },

  heroIconInner: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  heroDot: {
    position: "absolute",
    width: 12,
    height: 12,
    top: 14,
    right: 12,
    borderRadius: Radius.full,
  },

  section: {
    marginTop: Spacing.six,
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
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

  sectionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
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

  categoriesList: {
    flexDirection: "row-reverse",
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },

  featuredList: {
    flexDirection: "row-reverse",
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },

  allOffersHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },

  allOffersTitleArea: {
    flex: 1,
    alignItems: "flex-end",
  },

  countBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
    minHeight: 34,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.full,
  },

  countText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
  },

  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.three,
  },

  emptyCard: {
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  bottomNote: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.two,
    marginTop: Spacing.six,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  noteIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  bottomNoteText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },
});
