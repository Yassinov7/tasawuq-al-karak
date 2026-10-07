import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { CustomerCatalogStatus } from "@/components/marketplace/CustomerCatalogStatus";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";

export default function OffersTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount, selectedOfferIds } = useCart();
  const { categories, offers } = useCustomerCatalog();

  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredOffers = useMemo(() => {
    if (selectedCategory === "all") {
      return offers;
    }

    return offers.filter(
      (offer) => offer.items.some((item) => item.product.categoryId === selectedCategory),
    );
  }, [offers, selectedCategory]);

  const offerCategories = useMemo(() => {
    const categoryIds = new Set(
      offers.flatMap((offer) => offer.items.map((item) => item.product.categoryId)),
    );

    return categories.filter((category) => categoryIds.has(category.id));
  }, [categories, offers]);

  const handleOfferPress = (offerId: string) => {
    router.push({
      pathname: "/offer-details",
      params: {
        id: offerId,
      },
    });
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
      <CustomerCatalogStatus />
      <AppHeader title="العروض" cartCount={itemCount} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.intro, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.introIcon, { backgroundColor: colors.accentLight }]}>
            <AppIcon name="pricetags-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.introText}>
            <Text style={[styles.introTitle, { color: colors.text }]}>عروض المتاجر</Text>
            <Text style={[styles.introDescription, { color: colors.textSecondary }]}>
              كل عرض حزمة واحدة؛ افتح التفاصيل لمراجعة المكونات والسعر قبل إضافتها للسلة.
            </Text>
          </View>
          <View style={[styles.introCount, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.introCountText, { color: colors.primary }]}>
              {offers.length}
            </Text>
          </View>
        </View>

        <View style={styles.filterSection}>
          <SectionHeader
            title="تصفية حسب التصنيف"
            subtitle={selectedCategory === "all" ? "كل التصنيفات" : "تم اختيار تصنيف"}
            icon="grid-outline"
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
                {selectedCategory === "all" ? "العروض المتاحة" : "العروض في هذا التصنيف"}
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
              {filteredOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  expanded
                  added={selectedOfferIds.includes(offer.id)}
                  onPress={() => handleOfferPress(offer.id)}
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
                title={offers.length === 0 ? "لا توجد عروض حالياً" : "لا توجد عروض في هذا التصنيف"}
                description={offers.length === 0
                  ? "ستظهر العروض الجديدة من المتاجر هنا عند توفرها."
                  : "اختر تصنيفاً آخر لاستعراض العروض المتاحة."}
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
            الأسعار ومكونات العروض مأخوذة من بيانات المتاجر، وتظهر تفاصيل الباقة
            عند فتح العرض.
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

  intro: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  introIcon: {
    alignItems: "center",
    height: 46,
    justifyContent: "center",
    width: 46,
    borderRadius: Radius.lg,
  },

  introText: {
    flex: 1,
    alignItems: "flex-end",
    gap: Spacing.one,
  },

  introTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  introDescription: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 19,
    textAlign: "right",
  },

  introCount: {
    alignItems: "center",
    minWidth: 36,
    height: 36,
    justifyContent: "center",
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
  },

  introCountText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  filterSection: {
    marginTop: Spacing.four,
    padding: Spacing.three,
    backgroundColor: "transparent",
    borderRadius: Radius.xl,
  },

  section: {
    marginTop: Spacing.four,
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
