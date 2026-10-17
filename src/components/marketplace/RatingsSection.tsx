import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getEligibleStoreOrders, getMyProductReview, getMyStoreReview, getProductRatings, getStoreRatings, saveProductReview, saveStoreReview, type OwnReview, type PublicReview, type RatingSummary } from "@/lib/customer-reviews";
import { RatingSummary as RatingSummaryView } from "./RatingStars";
import { ReviewCard } from "./ReviewCard";
import { ReviewForm } from "./ReviewForm";

type Props = { kind: "store" | "product"; storeId: string; productId?: string };

export function RatingsSection({ kind, storeId, productId }: Props) {
  const { colors } = useTheme();
  const [summary, setSummary] = useState<RatingSummary>({ averageRating: null, ratingCount: 0 });
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [orders, setOrders] = useState<{ id: string; delivered_at: string | null }[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [ownReview, setOwnReview] = useState<OwnReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const ratings = kind === "store" ? await getStoreRatings(storeId) : await getProductRatings(productId!);
      setSummary(ratings.summary); setReviews(ratings.reviews);
      const eligibleOrders = await getEligibleStoreOrders(storeId, kind === "product" ? productId : undefined);
      setOrders(eligibleOrders); setSelectedOrderId((current) => current && eligibleOrders.some((order) => order.id === current) ? current : (eligibleOrders[0]?.id ?? null));
    } catch { setError(true); }
    finally { setLoading(false); }
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
      try { const review = kind === "store" ? await getMyStoreReview(selectedOrderId) : await getMyProductReview(selectedOrderId, productId!); if (active) setOwnReview(review); }
      catch { if (active) setOwnReview(null); }
      finally { clearTimeout(timer); if (active) setReviewLoading(false); }
    };
    void load(); return () => { active = false; clearTimeout(timer); };
  }, [kind, productId, selectedOrderId]);

  const save = async (rating: number, comment: string) => {
    if (!selectedOrderId) return;
    if (kind === "store") await saveStoreReview(selectedOrderId, ownReview, rating, comment);
    else await saveProductReview(selectedOrderId, productId!, ownReview, rating, comment);
    await refresh();
    const updated = kind === "store" ? await getMyStoreReview(selectedOrderId) : await getMyProductReview(selectedOrderId, productId!);
    setOwnReview(updated);
  };

  return <View style={{ gap: Spacing.three, marginTop: Spacing.six }}>
    <View style={{ alignItems: "flex-end", gap: Spacing.two }}><Text style={{ color: colors.text, fontFamily: Fonts.bold, fontSize: FontSizes.lg }}>التقييمات والمراجعات</Text><RatingSummaryView averageRating={summary.averageRating} ratingCount={summary.ratingCount} /></View>
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, textAlign: "right" }}>تعذر تحميل التقييمات الآن.</Text> : reviews.length ? reviews.map((review) => <ReviewCard key={review.id} review={review} />) : <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.three }}><Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, textAlign: "right" }}>لا توجد تقييمات بعد.</Text></View>}
    {orders.length > 1 ? <View style={{ alignItems: "flex-end", gap: Spacing.two }}><Text style={{ color: colors.textSecondary, fontFamily: Fonts.medium, fontSize: FontSizes.sm }}>اختر طلبًا مسلّمًا للتقييم</Text><View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two }}>{orders.map((order, index) => <Pressable key={order.id} onPress={() => setSelectedOrderId(order.id)} style={{ backgroundColor: selectedOrderId === order.id ? colors.primary : colors.surface, borderColor: colors.primary, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }}><Text style={{ color: selectedOrderId === order.id ? colors.surface : colors.primary, fontFamily: Fonts.medium }}>طلب {index + 1}</Text></Pressable>)}</View></View> : null}
    <ReviewForm key={ownReview?.id ?? selectedOrderId ?? "ineligible"} review={ownReview} canReview={Boolean(selectedOrderId)} loading={reviewLoading} onSave={save} />
  </View>;
}
