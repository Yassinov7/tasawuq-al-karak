import { Linking, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { DriverAssignedTask, DriverDestination } from "@/lib/driver-deliveries";
import { normalizeContactPhone } from "@/lib/signup-data";

type Destination = DriverDestination & { customer_note?: string };

export function DriverTaskDestination({ destination, active, stale, expanded, contact = false, showRecipient = true, onCallError }: {
  destination: Destination;
  active: boolean;
  stale: boolean;
  expanded?: boolean;
  contact?: boolean;
  showRecipient?: boolean;
  onCallError?: () => void;
}) {
  const { colors } = useTheme();
  const zone = destination.delivery_zone_name_snapshot?.trim();
  const showDetails = active && !stale;
  const address = showDetails ? destination.delivery_address?.trim() : undefined;
  const recipient = showDetails ? destination.recipient_name?.trim() : undefined;
  const note = showDetails && expanded ? destination.customer_note?.trim() : undefined;
  const phone = showDetails && contact ? normalizeContactPhone(destination.contact_phone ?? "") : "";
  const dialable = /^\+?[0-9]{7,15}$/.test(phone);
  const location = showDetails
    ? [...new Set([zone, address].filter(Boolean))].join(" · ")
    : zone;

  return <View style={styles.stack}>
    <View style={styles.row}>
      <AppIcon name="location-outline" size={16} color={colors.textSecondary} />
      <Text numberOfLines={expanded ? undefined : 2} style={[styles.meta, styles.flex, { color: colors.text }]}>
        {location ? `التسليم · ${location}` : stale ? "تعذر تأكيد منطقة التسليم" : "منطقة التسليم غير مسجلة"}
      </Text>
    </View>
    {showDetails && !address ? <Text style={[styles.meta, { color: colors.textSecondary }]}>العنوان التفصيلي غير مسجل</Text> : null}
    {showDetails && showRecipient ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{recipient || "اسم المستلم غير مسجل"}</Text> : null}
    {active && stale ? <Text style={[styles.meta, { color: colors.warningForeground }]}>تعذر تأكيد بيانات المستلم والعنوان.</Text> : null}
    {note ? <Text style={[styles.meta, { color: colors.text }]}>ملاحظة العميل · {note}</Text> : null}
    {showDetails && contact ? dialable ? <View style={styles.row}>
      <AppButton design="refined" compact fullWidth={false} variant="outline" icon="call-outline" title="اتصال بالمستلم"
        onPress={() => void Linking.openURL(`tel:${phone}`).catch(() => onCallError?.())} />
      {expanded ? <Text selectable style={[styles.meta, { color: colors.textSecondary, writingDirection: "ltr" }]}>{phone}</Text> : null}
    </View> : <Text style={[styles.meta, { color: colors.textSecondary }]}>
      {phone ? "رقم الهاتف غير صالح للاتصال" : "رقم هاتف المستلم غير مسجل"}
    </Text> : null}
  </View>;
}

export function DriverPickupPreview({ stores }: { stores: DriverAssignedTask["customer_orders"]["store_orders"] }) {
  const { colors } = useTheme();
  const remaining = stores.filter(store => !["rejected", "cancelled", "handed_to_driver", "delivered"].includes(store.status));
  const store = remaining.length === 1 ? remaining[0].stores : null;
  const title = remaining.length > 1
    ? `استلام من ${remaining.length.toLocaleString("ar-SY")} متاجر`
    : store?.name?.trim() || "راجع نقاط الاستلام";
  return <View style={styles.row}>
    <AppIcon name="storefront-outline" size={16} color={colors.infoForeground} />
    <View style={[styles.stack, styles.flex]}>
      <Text style={[styles.meta, { color: colors.infoForeground }]}>الاستلام · {title}</Text>
      {remaining.length === 1 ? <Text numberOfLines={2} style={[styles.meta, { color: colors.textSecondary }]}>
        {store?.address?.trim() || "عنوان نقطة الاستلام غير متاح"}
      </Text> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.one },
  row: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: Spacing.two },
  flex: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  meta: { ...Typography.caption, textAlign: "right" },
});
