import { Text, View } from "react-native";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PublicReview } from "@/lib/customer-reviews";
import { RatingStars } from "./RatingStars";

export function ReviewCard({ review }: { review: PublicReview }) {
  const { colors } = useTheme();
  return <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.two, padding: Spacing.three }}>
    <RatingStars rating={review.rating} size={16} />
    {review.comment ? <Text style={{ color: colors.textSecondary, fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right" }}>{review.comment}</Text> : null}
    <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }}>{new Date(review.createdAt).toLocaleDateString("ar")}</Text>
  </View>;
}
