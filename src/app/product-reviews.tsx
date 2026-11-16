import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { RatingsSection } from "@/components/marketplace/RatingsSection";
import { CustomerMarketHeader } from "@/components/navigation/CustomerMarketHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { FontSizes, Fonts, RtlText, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";

export default function ProductReviewsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, loading } = useAuth();
  const productId = typeof id === "string" ? id : undefined;
  const scope = JSON.stringify([productId, user?.id, user?.role, loading]);
  return <ProductReviews key={scope} productId={productId} enabled={!loading} />;
}

function ProductReviews({ productId, enabled }: { productId?: string; enabled: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { products, loading, error, refresh } = useCustomerCatalog();
  const product = enabled ? products.find(item => item.id === productId) : undefined;
  const goBack = () => router.canGoBack() ? router.back() : productId
    ? router.replace({ pathname: "/product-details", params: { id: productId } }) : router.replace("/products");

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <CustomerMarketHeader title="المراجعات" screenTitle={product?.name} showBack onBack={goBack}
      cartCount={itemCount} mode="shared" />
    <KeyboardAwareScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {!product ? <View style={styles.state}>
        {!enabled || loading ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.textSecondary }]}>جارٍ تحميل مراجعات المنتج…</Text>
          : error ? <><Text style={[styles.body, { color: colors.error }]}>تعذر تحميل مراجعات المنتج.</Text>
            <AppButton compact title="إعادة المحاولة" variant="outline" fullWidth={false} onPress={() => void refresh()} /></>
            : <AppEmptyState icon="star-outline" title="المنتج غير متاح" buttonText="رجوع" onButtonPress={goBack} />}
      </View> : <>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>تقييمات ومراجعات حقيقية مرتبطة بطلبات مسلّمة لهذا المنتج.</Text>
        <RatingsSection kind="product" storeId={product.storeId} productId={product.id} />
      </>}
    </KeyboardAwareScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, width: "100%", maxWidth: 760, alignSelf: "center", direction: "rtl",
    paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.six },
  state: { gap: Spacing.three, alignItems: "flex-end", paddingTop: Spacing.four },
  body: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, ...RtlText },
  intro: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, ...RtlText },
});
