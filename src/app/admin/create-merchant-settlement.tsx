import { useEffect, useMemo, useState } from "react";
import { useRouter, type Href } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { useTheme } from "@/context/ThemeContext";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { createSettlement, getUnsettledEntitlements, type SettlementEntitlement } from "@/lib/merchant-settlements";

export default function CreateMerchantSettlement() {
  const { colors } = useTheme();
  const router = useRouter();
  const [rows, setRows] = useState<SettlementEntitlement[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getUnsettledEntitlements().then(setRows).catch(() => setError("تعذر تحميل المستحقات."));
  }, []);

  const chosen = useMemo(() => rows.filter((item) => selected.includes(item.merchant_order_entitlement_id)), [rows, selected]);
  const total = chosen.reduce((sum, item) => sum + item.remaining_amount, 0);
  const toggle = (item: SettlementEntitlement) => setSelected((current) => {
    const compatible = chosen.length === 0 || chosen.every((choice) => choice.merchant_id === item.merchant_id && choice.currency === item.currency);
    if (!compatible) return [item.merchant_order_entitlement_id];
    return current.includes(item.merchant_order_entitlement_id)
      ? current.filter((id) => id !== item.merchant_order_entitlement_id)
      : [...current, item.merchant_order_entitlement_id];
  });

  const submit = async () => {
    if (!chosen.length) return;
    setBusy(true);
    try {
      const batchId = await createSettlement({ merchantId: chosen[0].merchant_id, currency: chosen[0].currency, ids: selected });
      if (!batchId) throw new Error("missing-settlement-id");
      router.replace(`/admin/merchant-settlement-details?batchId=${batchId}` as Href);
    } catch {
      setError("تعذر إنشاء التسوية. تحقق من أن المستحقات ما زالت متاحة.");
    } finally {
      setBusy(false);
    }
  };

  if (!rows.length && !error) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
    {error ? <Text style={[styles.meta, { color: colors.error }]}>{error}</Text> : null}
    <Text style={[styles.meta, { color: colors.textSecondary }]}>اختر مستحقات تاجر واحد وعملة واحدة. إنشاء التسوية لا يسجل دفعًا.</Text>
    {rows.map((item) => <Pressable key={item.merchant_order_entitlement_id} onPress={() => toggle(item)} style={[styles.card, { backgroundColor: selected.includes(item.merchant_order_entitlement_id) ? colors.primaryLight : colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>طلب {item.store_order_id.slice(0, 8)} · {item.currency}</Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>التسليم {new Date(item.delivered_at).toLocaleDateString("ar-SY")} · المتبقي {item.remaining_amount.toLocaleString("ar-SY")}</Text>
    </Pressable>)}
    <AppButton title={`إنشاء تسوية بمجموع ${total.toLocaleString("ar-SY")}`} loading={busy} disabled={!chosen.length} onPress={() => void submit()} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: "center" },
  content: { padding: Spacing.five, gap: Spacing.three, paddingBottom: Spacing.ten },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.one },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
  meta: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 },
});
