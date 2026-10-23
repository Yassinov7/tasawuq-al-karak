import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import { AppTextField } from "@/components/ui/AppTextField";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getSettlementDetails, recordSettlementPayment, type SettlementDetails } from "@/lib/merchant-settlements";

const money = (value: number, currency: string) => `${value.toLocaleString("ar-SY", { maximumFractionDigits: 2 })} ${currency}`;

export default function MerchantSettlementDetails() {
  const { batchId } = useLocalSearchParams<{ batchId?: string }>();
  const { colors } = useTheme();
  const [data, setData] = useState<SettlementDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestId = useRef(0); const hasData = useRef(false);

  const load = useCallback(async (manual = false) => {
    if (!batchId) { setError("معرّف التسوية غير صالح."); setLoading(false); return; }
    const currentRequest = ++requestId.current;
    if (manual) setRefreshing(true); else setLoading(!hasData.current);
    try {
      const next = await getSettlementDetails(batchId);
      if (currentRequest !== requestId.current) return;
      setData(next); hasData.current = Boolean(next);
      setError(next ? "" : "لم يُعثر على التسوية.");
    } catch {
      if (currentRequest === requestId.current) setError("تعذّر تحميل تفاصيل التسوية. احتفظنا بالبيانات السابقة إن وُجدت.");
    } finally {
      if (currentRequest === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [batchId]);

  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => { clearTimeout(timer); requestId.current += 1; }; }, [load]);

  const openPayment = () => { setAmount(""); setReference(""); setNote(""); setError(""); setPaymentOpen(true); };
  const submitPayment = async () => {
    if (!data || !batchId || submitting) return;
    const paymentAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > data.remainingAmount || Math.round(paymentAmount * 100) !== paymentAmount) { setError("أدخل مبلغًا موجبًا لا يتجاوز المتبقي وبدقة منزلتين عشريتين."); return; }
    let unallocated = paymentAmount;
    const allocations = data.entitlements.filter((item) => item.remaining_amount > 0).map((item) => { const value = Math.min(unallocated, item.remaining_amount); unallocated -= value; return { batch_entitlement_id: item.batch_entitlement_id!, amount: value }; }).filter((item) => item.amount > 0);
    setSubmitting(true);
    try { await recordSettlementPayment({ batchId, amount: paymentAmount, allocations, reference, note }); setPaymentOpen(false); await load(true); }
    catch { setError("تعذّر تأكيد الدفع. لم تسجل أي دفعة جديدة."); }
    finally { setSubmitting(false); }
  };

  if (loading && !data) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  return <View style={[styles.screen, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    {error && !paymentOpen ? <Text style={[styles.meta, { color: colors.error }]}>{error}</Text> : null}
    {data ? <><Card title="بيانات التسوية"><Text style={[styles.name, { color: colors.text }]}>{data.storeName ?? data.merchantName ?? "تاجر"}</Text><Line label="التاجر" value={data.merchantName ?? "غير متاح"} /><Line label="الحالة" value={data.status === "open" ? "مفتوحة" : "مكتملة"} /><Line label="العملة" value={data.currency} /><Line label="تاريخ الإنشاء" value={new Date(data.created_at).toLocaleString("ar-SY")} /><Line label="الإجمالي" value={money(data.totalAmount, data.currency)} /><Line label="المدفوع" value={money(data.paidAmount, data.currency)} /><Line label="المتبقي" value={money(data.remainingAmount, data.currency)} strong />{data.note ? <Line label="ملاحظة التسوية" value={data.note} /> : null}{data.status === "open" && data.remainingAmount > 0 ? <AppButton title="تسجيل دفع فعلي" onPress={openPayment} /> : null}</Card><Card title="الطلبات المشمولة">{data.entitlements.map((item) => <View key={item.batch_entitlement_id} style={[styles.item, { borderTopColor: colors.border }]}><Text style={[styles.meta, { color: colors.text }]}>طلب {item.store_order_id.slice(0, 8)} · {new Date(item.delivered_at).toLocaleDateString("ar-SY")}</Text><Line label="صافي المستحق" value={money(item.current_entitlement_amount, data.currency)} /><Line label="المدفوع" value={money(item.paid_amount, data.currency)} /><Line label="المتبقي" value={money(item.remaining_amount, data.currency)} /></View>)}</Card><Card title="سجل المدفوعات">{data.payments.length ? data.payments.map((payment) => <View key={payment.id} style={[styles.item, { borderTopColor: colors.border }]}><Line label="المبلغ" value={money(payment.amount, data.currency)} /><Line label="التاريخ" value={new Date(payment.paid_at).toLocaleString("ar-SY")} />{payment.external_reference ? <Line label="المرجع" value={payment.external_reference} /> : null}{payment.note ? <Line label="ملاحظات" value={payment.note} /> : null}</View>) : <Text style={[styles.meta, { color: colors.textSecondary }]}>لم تسجل دفعات فعلية بعد.</Text>}</Card></> : null}
  </ScrollView><AppModal visible={paymentOpen} title="تأكيد دفع للتاجر" message="إنشاء التسوية لا يعني الدفع. سيُسجل هذا المبلغ كدفع فعلي ويُخصص على المستحقات المتبقية." confirmText="تأكيد الدفع" cancelText="إلغاء" busy={submitting} onConfirm={() => void submitPayment()} onCancel={() => { if (!submitting) setPaymentOpen(false); }}><AppTextField label="المبلغ" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /><AppTextField label="مرجع اختياري" value={reference} onChangeText={setReference} /><AppTextField label="ملاحظات اختيارية" value={note} onChangeText={setNote} multiline />{error ? <Text style={[styles.meta, { color: colors.error }]}>{error}</Text> : null}</AppModal></View>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) { const { colors } = useTheme(); return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.text }]}>{title}</Text>{children}</View>; }
function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) { const { colors } = useTheme(); return <View style={styles.line}><Text style={[styles.meta, { color: colors.textSecondary }]}>{label}</Text><Text style={[strong ? styles.strong : styles.value, { color: colors.text }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, justifyContent: "center" }, content: { padding: Spacing.five, paddingBottom: Spacing.ten, gap: Spacing.three }, card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two }, title: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" }, name: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" }, meta: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22, flex: 1 }, value: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "left", flex: 1 }, strong: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, textAlign: "left", flex: 1 }, line: { flexDirection: "row-reverse", justifyContent: "space-between", gap: Spacing.three }, item: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, gap: Spacing.one } });
