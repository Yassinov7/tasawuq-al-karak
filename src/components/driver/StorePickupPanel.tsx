import { Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { Typography, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { DriverAssignedTask } from "@/lib/driver-deliveries";
import type { PickupWorkflow } from "@/lib/store-pickups";

export function StorePickupPanel({ stores, workflow, busy, disabled, onConfirm }: {
  stores: DriverAssignedTask["customer_orders"]["store_orders"];
  workflow: Extract<PickupWorkflow, { state: "c4" }>;
  busy?: string | null; disabled: boolean; onConfirm?: (id: string) => void;
}) {
  const { colors } = useTheme();
  const required = stores.filter(store => !["rejected", "cancelled"].includes(store.status));
  const done = required.filter(store => workflow.confirmed.includes(store.id)).length;
  return <View style={{ gap: Spacing.three }}>
    <Text style={{ ...Typography.bodyStrong, textAlign: "right", color: colors.text }}>تم استلام {done} من {required.length}</Text>
    {required.map(store => {
      const confirmed = workflow.confirmed.includes(store.id);
      return <View key={store.id} style={{ gap: Spacing.two }}>
        <Text style={{ ...Typography.body, textAlign: "right", color: colors.text }}>{store.stores?.name ?? "متجر"}</Text>
        {store.stores?.address ? <Text style={{ ...Typography.body, textAlign: "right", color: colors.textSecondary }}>{store.stores.address}</Text> : null}
        {confirmed ? <Text style={{ ...Typography.body, textAlign: "right", color: colors.successForeground }}>تم تأكيد الاستلام</Text>
          : <AppButton design="refined" title="تأكيد الاستلام" disabled={disabled || !workflow.canConfirmPickup || !onConfirm || Boolean(busy)}
            loading={busy === store.id} onPress={() => onConfirm?.(store.id)} />}
      </View>;
    })}
    <Text accessibilityRole="alert" style={{ ...Typography.body, textAlign: "right", color: colors.warningForeground }}>
      {workflow.reason === "pricing_review" ? "المهمة متوقفة لمراجعة التسعير." : workflow.canCompleteDelivery ? "راجع مبلغ التحصيل ثم أكد التسليم؛ إذا كان صفرًا فلن يُسجّل قبض نقدي." : "استكمل استلام جميع المتاجر المطلوبة قبل التسليم والتحصيل."}
    </Text>
  </View>;
}
