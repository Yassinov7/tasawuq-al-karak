import { type Href, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { Typography, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
export const financialDate = (value: unknown) => typeof value === "string" && value ? new Date(value).toLocaleString("ar-SY") : "—";
export function FinancialText({ children, title = false }: { children: React.ReactNode; title?: boolean }) {
  const { colors } = useTheme(); return <Text selectable style={[title ? styles.title : styles.text, { color: title ? colors.text : colors.textSecondary }]}>{children}</Text>;
}
export function FinancialCard({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors } = useTheme(); return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{title ? <FinancialText title>{title}</FinancialText> : null}{children}</View>;
}
export function FinancialLink({ title, href }: { title: string; href: string }) {
  const router = useRouter(); return <AppButton design="refined" title={title} variant="outline" onPress={() => router.push(href as Href)} />;
}
const styles = StyleSheet.create({card:{borderWidth:1,borderRadius:Radius.lg,padding:Spacing.four,gap:Spacing.two},title:{...Typography.cardTitle,textAlign:"right"},text:{...Typography.body,textAlign:"right"}});
