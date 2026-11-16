import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { CustomerCatalogStatus } from "@/components/marketplace/CustomerCatalogStatus";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, LayoutSpacing, Radius, RtlText, Spacing } from "@/constants/theme";
import { useAppDialog } from "@/context/AppDialogContext";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useTheme } from "@/context/ThemeContext";

const scrollOffsets = new Map<string, number>();

export default function FavoritesScreen() {
  const router = useRouter();
  const { confirm } = useAppDialog();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { width, fontScale } = useWindowDimensions();
  const { itemCount } = useCart();
  const { error, loading, products, refreshing, refresh, revalidate } = useCustomerCatalog();
  const { favoriteIds, persistenceError, ready, removeFavorite, clearFavorites } = useFavorites();
  const scope = user?.id ?? "guest";
  const columns = width < 340 || fontScale > 1.3 ? 1 : 2;
  const cardWidth = columns === 1
    ? width - LayoutSpacing.pageGutter * 2
    : (width - LayoutSpacing.pageGutter * 2 - LayoutSpacing.cardGap) / 2;
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const favoriteProducts = useMemo(
    () => products.filter((product) => favoriteSet.has(product.id)),
    [favoriteSet, products],
  );

  useFocusEffect(useCallback(() => {
    void revalidate();
  }, [revalidate]));

  const handleClearFavorites = useCallback(() => {
    void confirm({
      title: "تفريغ المفضلة",
      message: "هل تريد إزالة جميع المنتجات من المفضلة؟",
      confirmText: "تفريغ",
      cancelText: "إلغاء",
      destructive: true,
    }).then((accepted) => {
      if (accepted) clearFavorites();
    });
  }, [clearFavorites, confirm]);

  const openProduct = useCallback((id: string) => {
    router.push({ pathname: "/product-details", params: { id } });
  }, [router]);

  const hasUnavailableFavorites = ready && favoriteIds.length > favoriteProducts.length;
  const showInitialLoading = !ready || (loading && favoriteIds.length > 0 && products.length === 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="المفضلة" showBack cartCount={itemCount} mode="customer" />

      {showInitialLoading ? (
        <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="جارٍ تحميل المفضلة">
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>جارٍ تجهيز منتجاتك المحفوظة…</Text>
        </View>
      ) : favoriteIds.length === 0 ? (
        <AppEmptyState icon="heart-outline" title="المفضلة فارغة"
          description="احفظ المنتجات التي تهمك لتجدها هنا بسهولة."
          buttonText="تصفح المنتجات" onButtonPress={() => router.push("/products")} />
      ) : favoriteProducts.length === 0 ? (
        <View style={styles.emptyArea}>
          <CustomerCatalogStatus />
          {!error ? <AppEmptyState icon="heart-dislike-outline" title="المنتجات المحفوظة غير متاحة"
            description="قد تكون المنتجات أوقفت مؤقتًا أو لم تعد منشورة. يمكنك إبقاء القائمة أو تفريغها."
            buttonText="تصفح المنتجات" onButtonPress={() => router.push("/products")} /> : null}
        </View>
      ) : (
        <FlatList
          key={columns}
          data={favoriteProducts}
          keyExtractor={(product) => product.id}
          numColumns={columns}
          initialNumToRender={8}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          contentOffset={{ x: 0, y: scrollOffsets.get(scope) ?? 0 }}
          onScroll={(event) => scrollOffsets.set(scope, event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={120}
          contentContainerStyle={styles.content}
          columnWrapperStyle={columns === 2 ? styles.row : undefined}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
          ListHeaderComponent={<View style={styles.headerArea}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summary, { color: colors.textSecondary }]}>
                {favoriteProducts.length} منتج محفوظ
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="تفريغ المفضلة" onPress={handleClearFavorites}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
                <AppIcon name="trash-outline" size={18} color={colors.error} />
                <Text style={[styles.clearText, { color: colors.error }]}>تفريغ</Text>
              </Pressable>
            </View>
            {hasUnavailableFavorites ? <Text style={[styles.notice, {
              color: colors.warningForeground, backgroundColor: colors.warningSurface,
            }]}>بعض المنتجات المحفوظة غير متاحة حاليًا.</Text> : null}
            {persistenceError ? <Text accessibilityLiveRegion="polite" style={[styles.notice, {
              color: colors.error, backgroundColor: colors.errorSurface,
            }]}>{persistenceError}</Text> : null}
            {error ? <CustomerCatalogStatus /> : null}
          </View>}
          renderItem={({ item }) => <ProductCard product={item} compact cardWidth={cardWidth} showOffer
            favorite onFavoritePress={() => removeFavorite(item.id)} onPress={() => openProduct(item.id)} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    direction: "rtl",
    paddingHorizontal: LayoutSpacing.pageGutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.ten,
    gap: LayoutSpacing.cardGap,
  },
  row: { direction: "rtl", gap: LayoutSpacing.cardGap },
  headerArea: { marginBottom: Spacing.four, gap: Spacing.two },
  summaryRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  summary: { flex: 1, fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  clearButton: {
    minWidth: 72,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },
  clearText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, ...RtlText },
  notice: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    ...RtlText,
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.three, padding: Spacing.six },
  loadingText: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "center" },
  emptyArea: { flex: 1, justifyContent: "center" },
  pressed: { opacity: 0.7 },
});
