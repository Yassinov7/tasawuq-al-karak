import { useRouter } from "expo-router";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Children, useCallback, useRef, useState, type PropsWithChildren } from "react";

import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { StoreCard } from "@/components/marketplace/StoreCard";
import { useAuth } from "@/context/AuthContext";
import { CustomerHomeSponsored } from "@/components/home/CustomerHomeSponsored";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppSectionHeader } from "@/components/ui/AppSectionHeader";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";
import { useCustomerStoreLogos } from "@/hooks/useCustomerStoreLogos";
import { useCustomerHomeFeed } from "@/hooks/useCustomerHomeFeed";
import { supabase } from "@/lib/supabase";
import { useDriverTaskRefresh } from "@/hooks/useDriverTaskRefresh";
import { homeAdDestinations } from "@/lib/customer-home-feed";

const webDirection = Platform.OS === "web" ? { dir: "rtl" as const } : {};

function Shelf({ children, title, onAll, loading, failed, onRetry, reserve, placeholderWidth }: PropsWithChildren<{
  title: string; reserve: number; placeholderWidth: number; onAll?: () => void; loading?: boolean; failed?: boolean; onRetry?: () => void;
}>) {
  const { colors } = useTheme();
  return <View>
    <View style={styles.sectionHeader}>
      <AppSectionHeader title={title} actionLabel={onAll ? "عرض الكل" : undefined} onActionPress={onAll} />
    </View>
    <ScrollView {...webDirection} horizontal showsHorizontalScrollIndicator={false} style={styles.rtl}
      contentContainerStyle={[styles.rail, (loading || Children.count(children) > 0) ? { minHeight: reserve } : undefined]}>
      {loading ? <View accessibilityRole="progressbar" accessibilityLabel={"جارٍ تحميل " + title} style={styles.placeholders}>
        {[0, 1].map(item => <View key={item} style={[styles.placeholder, { width: placeholderWidth, backgroundColor: colors.surfaceSecondary }]} />)}
      </View> : children}
    </ScrollView>
    {failed && onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
      <Text style={[styles.searchLabel, { color: colors.textSecondary }]}>تعذر تحديث هذا القسم. إعادة المحاولة</Text>
    </Pressable> : null}
  </View>;
}

export default function HomeTab() {
  const { user, loading } = useAuth();
  const owner = user?.id;
  const { resetForAccessChange } = useCustomerCatalog();
  const scope = loading ? "loading" : JSON.stringify([owner, user?.role, user?.app_metadata.role, user?.app_metadata.roles]);
  const role = useRef<{ scope: string; value: string | null } | undefined>(undefined);
  const [accessRevision, setAccessRevision] = useState(0);
  const verifyRole = useCallback(async (signal: AbortSignal) => {
    if (!owner) return;
    try {
      const { data, error } = await supabase.from("profiles").select("role").eq("id", owner).abortSignal(signal).maybeSingle();
      if (error || signal.aborted) return;
      const value = data?.role ?? null;
      if (role.current?.scope === scope && role.current.value !== value) {
        resetForAccessChange();
        setAccessRevision(previous => previous + 1);
      }
      role.current = { scope, value };
    } catch {
      // An offline return keeps the last public results until a role change can be confirmed.
    }
  }, [owner, resetForAccessChange, scope]);
  useDriverTaskRefresh(verifyRole, !loading && Boolean(owner));
  return <HomeContent key={scope + ":" + accessRevision} />;
}

function HomeContent() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { itemCount, selectedOfferIds } = useCart();
  const { categories, categoryRead, offerRead, offers, refresh, stores } = useCustomerCatalog();
  const { ads, storeShelf, productShelf, refreshAds, refreshDiscovery } = useCustomerHomeFeed();
  const [pulling, setPulling] = useState(false);

  const featuredStores = storeShelf?.data?.stores ?? [];
  const { logos, refresh: refreshLogos } = useCustomerStoreLogos(featuredStores.map(store => store.id), true);
  const featuredProducts = productShelf?.data?.products ?? [];
  const featuredOffers = offers.slice(0, 8);
  const featuredCategories = categories.filter(category => !category.parentId).slice(0, 12);
  const storeNames = new Map([...stores, ...featuredStores].map(store => [store.id, store.name]));
  const hasCatalog = Boolean(featuredStores.length || featuredProducts.length || featuredOffers.length);
  const cardWidth = Math.min(width - Spacing.four * 2, fontScale > 1.25 ? 215 : Math.max(136, Math.min(178, width * 0.43)));
  const availableWidth = Math.max(0, Math.min(width, 760) - Spacing.four * 2);
  const twoAcross = (availableWidth - Spacing.two) / 2;
  const offerWidth = Math.min(availableWidth, fontScale <= 1.25 && twoAcross >= 150 ? Math.min(200, twoAcross) : 220);
  const reserve = (height: number) => Math.round(height * Math.max(1, fontScale));

  const reload = async () => {
    setPulling(true);
    try {
      await Promise.all([refresh(), refreshAds("manual"), refreshDiscovery("manual"), refreshLogos("manual")]);
    } finally {
      setPulling(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader cartCount={itemCount} mode="customer" />
      <ScrollView showsVerticalScrollIndicator={false}
        maintainVisibleContentPosition={Platform.OS === "web" ? undefined : { minIndexForVisible: 0, autoscrollToTopThreshold: 0 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void reload()} tintColor={colors.primary} />}>
        <View style={[styles.searchArea, { backgroundColor: colors.primaryLight }]}>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>تسوّق من الكرك الشرقي</Text>
          <Pressable {...webDirection} accessibilityRole="link" accessibilityLabel="ابحث في السوق" onPress={() => router.push("/home/search")}
            style={({ pressed }) => [styles.search, { backgroundColor: pressed ? colors.surfacePressed : colors.surface }]}>
            <Text style={[styles.searchLabel, { color: colors.primary }]}>ابحث</Text>
            <AppIcon name="search-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <CustomerHomeSponsored ads={ads} onOpen={ad => router.push({ pathname: homeAdDestinations[ad.target_kind], params: { id: ad.target_id } })} />

        {featuredCategories.length || categoryRead !== "ready" ? <Shelf title="تسوّق حسب التصنيف" reserve={reserve(48)} placeholderWidth={110} loading={categoryRead === "loading" && !featuredCategories.length} failed={categoryRead === "error"} onRetry={() => void refresh()} onAll={() => router.push("/home/search")}>
          {featuredCategories.map(category => <CategoryChip key={category.id} tile label={category.name} icon={category.icon}
            onPress={() => router.push({ pathname: "/home/search", params: { categoryId: category.id } })} />)}
        </Shelf> : null}

        {featuredStores.length || !storeShelf || storeShelf.failed ? <Shelf title="متاجر الكرك" reserve={reserve(113)} placeholderWidth={cardWidth} loading={!storeShelf} failed={storeShelf?.failed} onRetry={() => void refreshDiscovery("manual")} onAll={() => router.push("/stores")}>
          {featuredStores.map(store => <StoreCard key={store.id} store={store} shelfWidth={cardWidth} logo={logos.get(store.id)}
            onPress={() => router.push({ pathname: "/store-details", params: { id: store.id } })} />)}
        </Shelf> : null}

        {featuredOffers.length || offerRead !== "ready" ? <Shelf title="عروض متاحة" reserve={reserve(172)} placeholderWidth={offerWidth} loading={offerRead === "loading" && !featuredOffers.length} failed={offerRead === "error"} onRetry={() => void refresh()} onAll={() => router.push("/home/offers")}>
          {featuredOffers.map(offer => <OfferCard key={offer.id} offer={offer} cardWidth={offerWidth}
            added={selectedOfferIds.includes(offer.id)}
            onPress={() => router.push({ pathname: "/offer-details", params: { id: offer.id } })} />)}
        </Shelf> : null}

        {featuredProducts.length || !productShelf || productShelf.failed ? <Shelf title="منتجات من السوق" reserve={reserve(188)} placeholderWidth={cardWidth} loading={!productShelf} failed={productShelf?.failed} onRetry={() => void refreshDiscovery("manual")} onAll={() => router.push("/home/search")}>
          {featuredProducts.map(product => <ProductCard key={product.id} product={product} cardWidth={cardWidth}
            storeName={storeNames.get(product.storeId)}
            onPress={() => router.push({ pathname: "/product-details", params: { id: product.id } })} />)}
        </Shelf> : null}

        {!hasCatalog && storeShelf && productShelf && offerRead === "ready" && !storeShelf.failed && !productShelf.failed ? <View style={styles.sectionHeader}>
          <AppEmptyState icon="storefront-outline" title="لا توجد متاجر أو منتجات متاحة حاليًا" />
        </View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.five, paddingBottom: Spacing.six, width: "100%", maxWidth: 760, alignSelf: "center" },
  searchArea: { gap: Spacing.two, padding: Spacing.four, marginHorizontal: Spacing.four, marginTop: Spacing.two, borderRadius: Radius.xl },
  heading: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" },
  search: { direction: "rtl", flexDirection: "row", alignSelf: "flex-end", gap: Spacing.two, minHeight: 48, alignItems: "center", paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.lg },
  searchLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, flexShrink: 1, textAlign: "right" },
  rtl: Platform.OS === "web" ? {} : { direction: "rtl" },
  rail: { flexDirection: "row", gap: Spacing.two, paddingHorizontal: Spacing.four, paddingBottom: Spacing.one },
  placeholders: { flexDirection: "row", gap: Spacing.two },
  placeholder: { borderRadius: Radius.lg },
  sectionHeader: { paddingHorizontal: Spacing.four },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: Spacing.four },
});
