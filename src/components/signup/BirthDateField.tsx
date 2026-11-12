import { View, Text } from "react-native";
import { AppTextField } from "@/components/ui/AppTextField";
import { Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { latinDigits } from "@/lib/signup-data";

export function BirthDateField({ value, onChange, error, disabled = false }: { value: string; onChange: (value: string) => void; error?: string; disabled?: boolean }) {
  const { colors } = useTheme();
  const [year = "", month = "", day = ""] = value.split("-");
  const change = (index: number, text: string) => {
    const parts = [year, month, day];
    parts[index] = latinDigits(text).replace(/[^0-9]/g, "").slice(0, index === 0 ? 4 : 2);
    onChange(parts.join("-"));
  };
  return <View style={{ gap: 8 }}>
    <Text style={{ ...Typography.bodyStrong, color: colors.text, textAlign: "right" }}>تاريخ الميلاد</Text>
    <View style={{ flexDirection: "row-reverse", gap: 10 }}>
      {([{ label: "اليوم", value: day, index: 2, length: 2 }, { label: "الشهر", value: month, index: 1, length: 2 }, { label: "السنة", value: year, index: 0, length: 4 }]).map(part => <View key={part.label} style={{ flex: 1 }}><AppTextField design="refined" label={part.label} value={part.value} onChangeText={text => change(part.index, text)} onBlur={() => { if (part.index !== 0 && part.value.length === 1) change(part.index, part.value.padStart(2, "0")); }} keyboardType="number-pad" maxLength={part.length} placeholder={part.index === 0 ? "1995" : part.index === 1 ? "06" : "15"} disabled={disabled}/></View>)}
    </View>
    {error ? <Text accessibilityRole="alert" style={{ ...Typography.body, color: colors.errorForeground, textAlign: "right" }}>{error}</Text> : null}
    <Text style={{ ...Typography.body, color: colors.textSecondary, textAlign: "right" }}>معلومة شخصية لا تظهر للعملاء أو المتاجر الأخرى، ولا تُعد إثباتًا للهوية.</Text>
  </View>;
}
