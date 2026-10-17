import { type Href, useRouter } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { CustomerHomeHero } from "@/components/home/CustomerHomeHero";
import { CustomerHomePromo } from "@/components/home/CustomerHomePromo";
import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { CustomerCatalogStatus } from "@/components/marketplace/CustomerCatalogStatus";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { StoreCard } from "@/components/marketplace/StoreCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppSectionHeader } from "@/components/ui/AppSectionHeader";
import { FontSizes, Fonts, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";

function getFirstName(fullName: unknown): string | undefined {
  if (typeof fullName !== "string") return undefined;

  return fullName.trim().split(/\s+/)[0] || undefined;
}

export default function HomeTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { itemCount, selectedOfferIds } = useCart();
  const { categories, error, loading, offers, products, refresh, stores } =
    useCustomerCatalog();

  const featuredStores = stores.slice(0, 6);
  const popularProducts = products.filter((product) => product.available).slice(0, 8);
  const featuredOffers = offers.slice(0, 8);
  const hasStores = stores.length > 0;
  const isCatalogEmpty = !loading && !error && !hasStores;
  const firstName = getFirstName(user?.user_metadata?.full_name);

  const openStore = (storeId: string) =>
    router.push({ pathname: "/store-details", params: { id: storeId } } as Href);
  const openProduct = (productId: string) =>
    router.push({ pathname: "/product-details", params: { id: productId } } as Href);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader cartCount={itemCount} mode="customer" />
      <CustomerCatalogStatus />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
          />
        }
      >
        <CustomerHomeHero
          firstName={firstName}
          onSearchPress={() => router.push("/home/search")}
        />

        {isCatalogEmpty ? (
          <AppEmptyState
            icon="storefront-outline"
            title="لا توجد متاجر متاحة حاليًا"
            description="سنضيف متاجر محلية جديدة هنا بمجرد توفرها."
          />
        ) : (
          <>
            {categories.length > 0 ? (
              <View style={styles.section}>
                <AppSectionHeader
                  title="التصنيفات"
                  actionLabel="عرض الكل"
                  onActionPress={() => router.push("/home/search")}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                >
                  {categories.slice(0, 12).map((category) => (
                    <CategoryChip
                      key={category.id}
                      label={category.name}
                      icon={category.icon}
                      onPress={() =>
                        router.push({
                          pathname: "/home/search",
                          params: { category: category.name },
                        })
                      }
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {hasStores ? <CustomerHomePromo onPress={() => router.push("/home/offers")} /> : null}

            {hasStores ? (
              <View style={styles.section}>
                <AppSectionHeader
                  title="اكتشف المتاجر"
                  subtitle="متاجر من الكرك الشرقي"
                  actionLabel="عرض الكل"
                  onActionPress={() => router.push("/stores")}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                >
                  {featuredStores.map((store) => (
                    <StoreCard key={store.id} store={store} onPress={() => openStore(store.id)} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {popularProducts.length > 0 ? (
              <HomeProductSection products={popularProducts} onPress={openProduct} />
            ) : null}

            {featuredOffers.length > 0 ? (
              <View style={styles.section}>
                <AppSectionHeader
                  title="عروض اليوم"
                  subtitle="فرص مميزة من متاجر منطقتك"
                  icon="pricetags-outline"
                  actionLabel="كل العروض"
                  onActionPress={() => router.push("/home/offers")}
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
                      onPress={() => router.push({ pathname: "/offer-details", params: { id: offer.id } })}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        )}

        <View style={[styles.bottomNote, { borderTopColor: colors.border }]}>
          <AppIcon name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.bottomNoteText, { color: colors.textMuted }]}>
            تظهر الأسعار والعروض بحسب بيانات المتاجر المتاحة في التطبيق.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

type HomeProductSectionProps = {
  products: ReturnType<typeof useCustomerCatalog>["products"];
  onPress: (productId: string) => void;
};

function HomeProductSection({ products, onPress }: HomeProductSectionProps) {
  return (
    <View style={styles.section}>
      <AppSectionHeader
        title="الأكثر طلبًا"
        subtitle="منتجات يطلبها أهل المنطقة"
        icon="trending-up-outline"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onPress={() => onPress(product.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, paddingBottom: Spacing.ten },
  section: { marginTop: Spacing.six },
  horizontalList: { flexDirection: "row-reverse", gap: Spacing.three, paddingBottom: Spacing.one },
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
});
