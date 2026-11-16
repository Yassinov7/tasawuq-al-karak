import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { AppButton } from "@/components/ui/AppButton";
import { useTheme } from "@/context/ThemeContext";
import { getEligibleStoreOrders, getMyProductReview, getMyStoreReview, getProductRatings, getStoreRatings, saveProductReview, saveStoreReview, type OwnReview, type PublicReview, type RatingSummary } from "@/lib/customer-reviews";
import { RatingSummary as RatingSummaryView } from "./RatingStars";
import { ReviewCard } from "./ReviewCard";
import { ReviewForm } from "./ReviewForm";

type Props = {
  kind: "store" | "product";
  storeId: string;
  productId?: string;
  showSummary?: boolean;
};

export function RatingsSection({ kind, storeId, productId, showSummary = true }: Props) {
  const { colors } = useTheme();
  const [summary, setSummary] = useState<RatingSummary>({ averageRating: null, ratingCount: 0 });
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [orders, setOrders] = useState<{ id: string; delivered_at: string | null }[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [ownReview, setOwnReview] = useState<OwnReview | null>(null);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const ratings = kind === "store" ? await getStoreRatings(storeId) : await getProductRatings(productId!);
      setSummary(ratings.summary); setReviews(ratings.reviews);
    } catch { setError(true); }
    finally { setLoading(false); }
    try {
      const eligibleOrders = await getEligibleStoreOrders(storeId, kind === "product" ? productId : undefined);
      setOrders(eligibleOrders); setSelectedOrderId((current) => current && eligibleOrders.some((order) => order.id === current) ? current : (eligibleOrders[0]?.id ?? null));
    } catch { setOrders([]); setSelectedOrderId(null); }
  }, [kind, productId, storeId]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    if (!selectedOrderId) return;
    let active = true;
    const timer = setTimeout(() => { if (active) setReviewLoading(true); }, 0);
    const load = async () => {
      try { const review = kind === "store" ? await getMyStoreReview(selectedOrderId) : await getMyProductReview(selectedOrderId, productId!); if (active) { setOwnReview(review); setReviewOrderId(selectedOrderId); } }
      catch { if (active) { setOwnReview(null); setReviewOrderId(selectedOrderId); } }
      finally { clearTimeout(timer); if (active) setReviewLoading(false); }
    };
    void load(); return () => { active = false; clearTimeout(timer); };
  }, [kind, productId, selectedOrderId]);

  const save = async (rating: number, comment: string) => {
    if (!selectedOrderId) return;
    const currentReview = reviewOrderId === selectedOrderId ? ownReview : null;
    if (kind === "store") await saveStoreReview(selectedOrderId, currentReview, rating, comment);
    else await saveProductReview(selectedOrderId, productId!, currentReview, rating, comment);
    await refresh();
    const updated = kind === "store" ? await getMyStoreReview(selectedOrderId) : await getMyProductReview(selectedOrderId, productId!);
    setOwnReview(updated); setReviewOrderId(selectedOrderId);
  };
  return <View style={styles.section}>
    <View style={styles.header}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>التقييمات والمراجعات</Text>{showSummary ? <RatingSummaryView averageRating={summary.averageRating} ratingCount={summary.ratingCount} /> : null}</View>
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <View style={styles.errorRow}>
      <Text style={[styles.body, { color: colors.textMuted }]}>تعذر تحميل التقييمات الآن.</Text>
      <AppButton compact title="إعادة المحاولة" variant="outline" fullWidth={false} onPress={() => void refresh()} />
    </View> : reviews.length ? <>
      {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
    </> : <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.body, { color: colors.textMuted }]}>لا توجد تقييمات بعد.</Text></View>}
    {orders.length > 1 ? <View style={styles.orders}><Text style={[styles.body, { color: colors.textSecondary }]}>اختر طلبًا مسلّمًا للتقييم</Text><View style={styles.orderChoices}>{orders.map((order, index) => <Pressable key={order.id} onPress={() => setSelectedOrderId(order.id)} style={{ backgroundColor: selectedOrderId === order.id ? colors.primary : colors.surface, borderColor: colors.primary, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }}><Text style={[styles.orderText, { color: selectedOrderId === order.id ? colors.onPrimary : colors.primary }]}>طلب {index + 1}</Text></Pressable>)}</View></View> : null}
    <ReviewForm key={ownReview?.id ?? selectedOrderId ?? "ineligible"} review={reviewOrderId === selectedOrderId ? ownReview : null} canReview={Boolean(selectedOrderId)} loading={reviewLoading} onSave={save} />
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three, marginTop: Spacing.six },
  header: { alignItems: "flex-end", gap: Spacing.two },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right", writingDirection: "rtl" },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right", writingDirection: "rtl" },
  empty: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.three },
  errorRow: { alignItems: "flex-end", gap: Spacing.two },
  orders: { alignItems: "flex-end", gap: Spacing.two },
  orderChoices: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two },
  orderText: { fontFamily: Fonts.medium, textAlign: "right", writingDirection: "rtl" },
});
