import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { RatingsSection } from "@/components/marketplace/RatingsSection";
import { CustomerMarketHeader } from "@/components/navigation/CustomerMarketHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { FontSizes, Fonts, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { useTheme } from "@/context/ThemeContext";

export default function StoreReviewsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, loading } = useAuth();
  const storeId = typeof id === "string" ? id : undefined;
  const scope = JSON.stringify([storeId, user?.id, user?.role, loading]);
  return <StoreReviews key={scope} storeId={storeId} enabled={!loading} />;
}

function StoreReviews({ storeId, enabled }: { storeId?: string; enabled: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { stores, loading, error, refresh } = useCustomerCatalog();
  const store = enabled ? stores.find(item => item.id === storeId) : undefined;
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else if (storeId) router.replace({ pathname: "/store-details", params: { id: storeId } });
    else router.replace("/stores");
  };

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <CustomerMarketHeader title="المراجعات" screenTitle={store?.name} showBack onBack={goBack}
      cartCount={itemCount} mode="shared" />
    <KeyboardAwareScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {!store ? <View style={styles.state}>
        {!enabled || loading ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.textSecondary }]}>جارٍ تحميل مراجعات المتجر…</Text>
          : error ? <>
            <Text style={[styles.body, { color: colors.error }]}>تعذر تحميل مراجعات المتجر.</Text>
            <AppButton compact title="إعادة المحاولة" variant="outline" fullWidth={false} onPress={() => void refresh()} />
          </> : <AppEmptyState icon="star-outline" title="المتجر غير متاح" buttonText="رجوع" onButtonPress={goBack} />}
      </View> : <>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>تقييمات ومراجعات حقيقية مرتبطة بطلبات مسلّمة من {store.name}.</Text>
        <RatingsSection kind="store" storeId={store.id} />
      </>}
    </KeyboardAwareScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two, paddingBottom: Spacing.six },
  state: { gap: Spacing.three, alignItems: "flex-end", paddingTop: Spacing.four },
  body: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "right", writingDirection: "rtl" },
  intro: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right", writingDirection: "rtl" },
});
