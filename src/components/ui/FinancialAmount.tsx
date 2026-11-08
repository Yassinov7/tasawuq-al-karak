import { Text } from "react-native";
import { Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { financialAmountText } from "@/lib/money";

/** Presentation only: no data access, conversion, rounding policy or role permissions. */
export function FinancialAmount({ amount, label }: { amount: number | string; label?: string }) {
  const { colors } = useTheme();
  const formatted=financialAmountText(amount);
  return <Text accessibilityRole={formatted===null?'alert':undefined} style={{ ...Typography.bodyStrong, color: formatted===null?colors.errorForeground:colors.primary, textAlign: "right" }}>
    {label ? `${label}: ` : ""}{formatted??'تعذر عرض المبلغ'}
  </Text>;
}
