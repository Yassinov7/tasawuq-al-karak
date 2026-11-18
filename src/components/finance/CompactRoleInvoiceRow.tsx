import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";
import { DocumentReference } from "@/components/ui/DocumentReference";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { arabicRowDirection, arabicTextAlign } from "@/lib/arabic-layout";
import { invoiceKindLabels, type MoneyInvoice } from "@/lib/invoice-finance";
import { formatSypExact } from "@/lib/money";
import { compactInvoiceState } from "@/lib/role-card-presentation";

const dateFormat = new Intl.DateTimeFormat("ar-SY", { day: "numeric", month: "short", year: "numeric" });
export function CompactRoleInvoiceRow({ invoice, role, onOpen }: {
  invoice: MoneyInvoice; role: "merchant" | "driver"; onOpen: () => void;
}) {
  const { colors } = useTheme();
  const state = compactInvoiceState(invoice, role);
  const title = invoice.kind === "COR" ? "مستند تصحيح" : invoice.kind === "SET" ? "مستند تسوية"
    : invoiceKindLabels[invoice.kind] ?? "مستند مالي";
  const foreground = state.tone === "warning" ? colors.warningForeground : state.tone === "info" ? colors.infoForeground : colors.textSecondary;
  const surface = state.tone === "warning" ? colors.warningSurface : state.tone === "info" ? colors.infoSurface : colors.mutedSurface;
  const created = new Date(invoice.created_at);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}، ${invoice.reference}، ${state.document}`}
    accessibilityHint="يفتح تفاصيل المستند" onPress={onOpen} style={({ pressed }) => [styles.document, {
      backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.borderSubtle,
    }]}>
    <View style={styles.row}>
      <View style={styles.identity}>
        <DocumentReference value={invoice.reference} />
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{title}</Text>
      </View>
      <View style={styles.state}>
        <Text style={[styles.badge, { color: foreground, backgroundColor: surface }]}>{state.document}</Text>
        {Number.isFinite(created.getTime()) ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{dateFormat.format(created)}</Text> : null}
      </View>
    </View>
    {state.payment ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{state.payment}</Text> : null}
    <View style={[styles.row, styles.bottom]}>
      <Text style={[styles.meta, styles.flex, { color: colors.textSecondary }]}>قيمة المستند · <Text style={[styles.amount, { color: colors.text }]}>{formatSypExact(invoice.amount)}</Text></Text>
      <View style={styles.link}><Text style={[styles.meta, { color: colors.primary }]}>التفاصيل</Text>
        <AppIcon name="chevron-back-outline" size={16} color={colors.primary} /></View>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  document: { minHeight: 44, padding: Spacing.three, gap: Spacing.one, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md },
  row: { flexDirection: arabicRowDirection, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  identity: { flexGrow: 1, flexShrink: 1, minWidth: 0, flexBasis: 130 },
  state: { flexShrink: 1, minWidth: 0, gap: Spacing.half, alignItems: "center" },
  flex: { flexGrow: 1, flexShrink: 1, minWidth: 0, flexBasis: 110 },
  meta: { ...Typography.caption, textAlign: arabicTextAlign, flexShrink: 1 },
  amount: { ...Typography.bodyStrong, textAlign: arabicTextAlign },
  badge: { ...Typography.caption, textAlign: arabicTextAlign, flexShrink: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  bottom: { paddingTop: Spacing.one },
  link: { flexDirection: arabicRowDirection, alignItems: "center", gap: Spacing.one },
});
