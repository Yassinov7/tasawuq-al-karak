import { StyleSheet, Text, View } from "react-native";
import { Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { arabicTextAlign } from "@/lib/arabic-layout";
import type { DriverAssignedTask } from "@/lib/driver-deliveries";
import { driverItemSummary, driverNumber } from "@/lib/driver-task-presentation";

/** Historical order rows only; no current catalogue lookup or prices. */
export function DriverStoreContents({ store }: {
  store: DriverAssignedTask["customer_orders"]["store_orders"][number];
}) {
  const { colors } = useTheme();
  const summary = store.items ? driverItemSummary(store.items) : null;
  return <View style={styles.section}>
    <Text selectable style={[styles.meta, { color: colors.textSecondary }]}>طلب المتجر · <Text style={styles.code}>{store.reference ?? "المرجع غير متاح"}</Text></Text>
    {summary ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{summary.text}</Text> : null}
    {store.items === undefined ? <Text style={[styles.meta, { color: colors.warningForeground }]}>تعذر قراءة المنتجات. حدّث المهمة لإعادة المحاولة.</Text>
      : store.items.length === 0 ? <Text style={[styles.meta, { color: colors.textSecondary }]}>لا توجد بنود متاحة للعرض.</Text>
      : store.items.map(item => <View key={item.id} style={[styles.item, { borderColor: colors.borderSubtle }]}>
        <Text style={[styles.title, { color: colors.text }]}>{item.product_title_snapshot?.trim() || "اسم المنتج التاريخي غير متاح"}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          الكمية · {Number.isFinite(item.quantity) && item.quantity > 0 ? driverNumber(item.quantity) : "غير متاحة"} {item.selling_unit_snapshot?.trim() || "وحدة غير مسجلة"}
        </Text>
      </View>)}
    {store.customer_note?.trim() ? <Text style={[styles.meta, { color: colors.text }]}>ملاحظة طلب المتجر · {store.customer_note.trim()}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: Spacing.one },
  item: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, paddingBottom: Spacing.one, gap: Spacing.half },
  title: { ...Typography.bodyStrong, textAlign: arabicTextAlign },
  meta: { ...Typography.caption, textAlign: arabicTextAlign },
  code: { writingDirection: "ltr" },
});
