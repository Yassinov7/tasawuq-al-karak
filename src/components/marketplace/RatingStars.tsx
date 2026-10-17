import { Pressable, Text, View } from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export function RatingStars({ rating, onChange, size = 18 }: { rating: number; onChange?: (rating: number) => void; size?: number }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: Spacing.half }}>
    {[1, 2, 3, 4, 5].map((value) => (
      <Pressable key={value} onPress={() => onChange?.(value)} disabled={!onChange} accessibilityRole={onChange ? "button" : undefined} accessibilityLabel={`${value} نجوم`} hitSlop={onChange ? 8 : undefined}>
        <AppIcon name={value <= rating ? "star" : "star-outline"} size={size} color={value <= rating ? colors.accent : colors.textMuted} />
      </Pressable>
    ))}
  </View>;
}

export function RatingSummary({ averageRating, ratingCount }: { averageRating: number | null; ratingCount: number }) {
  const { colors } = useTheme();
  if (averageRating === null || ratingCount === 0) return <Text style={{ color: colors.textMuted, textAlign: "right" }}>لا توجد تقييمات بعد</Text>;
  return <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: Spacing.two }}><RatingStars rating={Math.round(averageRating)} /><Text style={{ color: colors.text, fontVariant: ["tabular-nums"] }}>{averageRating.toFixed(1)} · {ratingCount} تقييم</Text></View>;
}
