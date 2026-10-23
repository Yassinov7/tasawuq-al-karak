import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getSettlementBatches, getUnsettledEntitlements, type SettlementBatch } from "@/lib/merchant-settlements";

const money = (amount: number, currency: string) => `${amount.toLocaleString("ar-SY", { maximumFractionDigits: 2 })} ${currency}`;

export default function MerchantSettlements() {
  const { colors } = useTheme();
  const router = useRouter();
  const { merchantId } = useLocalSearchParams<{ merchantId?: string }>();
  const [rows, setRows] = useState<SettlementBatch[]>([]);
  const [open, setOpen] = useState(0);
  const [due, setDue] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);

    try {
      const [batches, entitlements] = await Promise.all([
        getSettlementBatches(query),
        getUnsettledEntitlements(),
      ]);
      const scopedBatches = merchantId
        ? batches.filter((batch) => batch.merchant_id === merchantId)
        : batches;
      const scopedEntitlements = merchantId
        ? entitlements.filter((entitlement) => entitlement.merchant_id === merchantId)
        : entitlements;

      setRows(scopedBatches);
      setOpen(scopedBatches.filter((batch) => batch.status === "open").length);
      setDue(scopedEntitlements.reduce<Record<string, number>>((totals, entitlement) => ({
        ...totals,
        [entitlement.currency]: (totals[entitlement.currency] ?? 0) + entitlement.remaining_amount,
      }), {}));
      setError("");
    } catch {
      setError("تعذر تحميل تسويات التجار.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [merchantId, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  if (loading && !rows.length) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>مستحقات غير مسوّاة</Text>
      {Object.keys(due).length
        ? Object.entries(due).map(([currency, amount]) => <Text key={currency} style={[styles.meta, { color: colors.textSecondary }]}>{currency}: {money(amount, currency)}</Text>)
        : <Text style={[styles.meta, { color: colors.textSecondary }]}>لا توجد مستحقات متاحة.</Text>}
      <Text style={[styles.meta, { color: colors.textSecondary }]}>تسويات مفتوحة: {open} · مكتملة: {rows.length - open}</Text>
      <AppButton title="إنشاء تسوية" onPress={() => router.push("/admin/create-merchant-settlement" as Href)} />
    </View>
    <TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالتاجر أو المتجر" placeholderTextColor={colors.textMuted} style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} textAlign="right" />
    {error ? <Text style={[styles.meta, { color: colors.error }]}>{error}</Text> : null}
    {rows.map((batch) => <Pressable key={batch.id} onPress={() => router.push(`/admin/merchant-settlement-details?batchId=${batch.id}` as Href)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{batch.storeName ?? batch.merchantName ?? "تاجر"}</Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>{batch.status === "open" ? "مفتوحة" : "مكتملة"} · {new Date(batch.created_at).toLocaleDateString("ar-SY")}</Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>الإجمالي {money(batch.totalAmount, batch.currency)} · المدفوع {money(batch.paidAmount, batch.currency)} · المتبقي {money(batch.remainingAmount, batch.currency)}</Text>
    </Pressable>)}
    {!rows.length && !error ? <Text style={[styles.meta, { color: colors.textSecondary }]}>لا توجد تسويات مطابقة.</Text> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: "center" },
  content: { padding: Spacing.five, gap: Spacing.three, paddingBottom: Spacing.ten },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" },
  meta: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 },
  search: { borderWidth: 1, borderRadius: Radius.md, minHeight: 48, paddingHorizontal: Spacing.three, fontFamily: Fonts.regular },
});
