import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { sellingUnitOptions } from "@/constants/selling-units";
import { Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export function SellingUnitSelect({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { colors } = useTheme();
  return <View style={{ gap: Spacing.two }}>
    <Text style={{ color: colors.text, fontFamily: Fonts.medium, textAlign: "right" }}>وحدة البيع</Text>
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`وحدة البيع: ${value}`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 48, justifyContent: "center", padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontFamily: Fonts.regular, textAlign: "right" }}>{value} ▾</Text></Pressable>
    {expanded ? <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two }}>
      {sellingUnitOptions(value).map((option) => <Pressable key={option.value} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: value === option.value }} onPress={() => { onChange(option.value); setExpanded(false); }} style={{ minHeight: 44, justifyContent: "center", borderWidth: 1, borderColor: value === option.value ? colors.primary : colors.border, borderRadius: Radius.md, padding: Spacing.two }}><Text style={{ color: value === option.value ? colors.primary : colors.text, fontFamily: Fonts.regular }}>{option.label}</Text></Pressable>)}
    </View> : null}
  </View>;
}
