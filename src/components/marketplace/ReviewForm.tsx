import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { OwnReview } from "@/lib/customer-reviews";
import { RatingStars } from "./RatingStars";

type Props = {
  review: OwnReview | null;
  canReview: boolean;
  loading?: boolean;
  onSave: (rating: number, comment: string) => Promise<void>;
};

export function ReviewForm({ review, canReview, loading = false, onSave }: Props) {
  const { colors } = useTheme();
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (loading) return <ActivityIndicator color={colors.primary} />;
  if (!canReview) return <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right" }}>يتاح التقييم بعد تسليم طلب مرتبط بهذا العنصر.</Text>;
  const save = async () => {
    if (!rating) { setMessage("اختر عدد النجوم أولاً."); return; }
    setSaving(true); setMessage(null);
    try { await onSave(rating, comment); setMessage("تم حفظ تقييمك."); }
    catch { setMessage("تعذر حفظ التقييم. حاول مجددًا."); }
    finally { setSaving(false); }
  };
  return <View style={{ backgroundColor: colors.primaryLight, borderRadius: Radius.lg, gap: Spacing.three, padding: Spacing.three }}>
    <Text style={{ color: colors.text, fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" }}>{review ? "تعديل تقييمك" : "أضف تقييمك"}</Text>
    <RatingStars rating={rating} onChange={setRating} size={26} />
    <TextInput value={comment} onChangeText={setComment} maxLength={1500} multiline placeholder="اكتب ملاحظتك (اختياري)" placeholderTextColor={colors.textMuted} textAlign="right" style={{ minHeight: 84, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: Radius.md, borderWidth: 1, fontFamily: Fonts.regular, padding: Spacing.three, textAlignVertical: "top" }} accessibilityLabel="تعليق التقييم" />
    <Pressable onPress={() => void save()} disabled={saving} accessibilityRole="button" accessibilityLabel="حفظ التقييم" style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: Radius.md, opacity: saving ? 0.65 : 1, paddingVertical: Spacing.three }}>
      <Text style={{ color: colors.surface, fontFamily: Fonts.bold }}>{saving ? "جارٍ الحفظ..." : "حفظ التقييم"}</Text>
    </Pressable>
    {message ? <Text accessibilityRole="alert" style={{ color: message.startsWith("تم") ? colors.success : colors.error, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" }}>{message}</Text> : null}
  </View>;
}
