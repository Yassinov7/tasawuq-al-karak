import { useCallback, useEffect, useState } from "react";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getAdminInvoiceDetails, getCachedAdminInvoice, isCachedAdminInvoiceFresh, type AdminInvoiceDetails, type LedgerEntry } from "@/lib/admin-finance";

const labels: Record<string, string> = { open: "مفتوحة", partially_paid: "مسددة جزئيًا", paid: "مسددة", void: "ملغاة", initial: "فاتورة أولى", renewal: "تجديد", adjustment: "تعديل" };
const money = (value: number, currency: string) => `${Number(value).toLocaleString("ar-SY", { maximumFractionDigits: 2 })} ${currency === "USD" ? "دولار" : "ل.س"}`;
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("ar-SY") : "غير متاح";
const short = (value: string) => value.length > 13 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;

export default function AdminInvoiceDetailsScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const cached = invoiceId ? getCachedAdminInvoice(invoiceId)?.data ?? null : null;
  const [data, setData] = useState<AdminInvoiceDetails | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (manual = false) => {
    if (!invoiceId) { setError("معرّف الفاتورة غير صالح."); setLoading(false); return; }
    const saved = getCachedAdminInvoice(invoiceId)?.data ?? null;
    if (saved) setData(saved);
    if (!manual && isCachedAdminInvoiceFresh(invoiceId)) { setLoading(false); return; }
    if (saved) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const next = await getAdminInvoiceDetails(invoiceId, manual);
      if (!next) setError("لم يُعثر على هذه الفاتورة.");
      setData(next);
    } catch {
      setError("تعذّر تحميل تفاصيل الفاتورة. احتفظنا بالبيانات السابقة إن كانت متاحة.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [invoiceId]);
  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [refresh]);
  if (loading && !data) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;

  return <View style={[styles.screen, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.primary} colors={[colors.primary]} />}>
    {refreshing ? <Text style={[styles.refresh, { color: colors.textSecondary }]}>يتم التحديث في الخلفية…</Text> : null}
    {error ? <View style={[styles.error, { backgroundColor: colors.surfaceSecondary }]}><Text style={[styles.meta, { color: colors.error }]}>{error}</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={() => void refresh(true)} /></View> : null}
    {data ? <><Card title="ملخص الفاتورة"><View style={styles.header}><View style={styles.grow}><Text style={[styles.name, { color: colors.text }]}>{data.invoice_number}</Text><Text style={[styles.meta, { color: colors.textSecondary }]}>{labels[data.kind] ?? data.kind} · صدرت {date(data.created_at)}</Text></View><Text style={[styles.badge, { color: colors.primary, backgroundColor: colors.primaryLight }]}>{labels[data.status] ?? data.status}</Text></View><Line label="المبلغ الأصلي" value={money(data.total_amount, data.currency)} /><Line label="المبلغ المخصص" value={money(data.paidAmount, data.currency)} /><Line label="المبلغ المتبقي" value={money(data.outstandingAmount, data.currency)} strong /></Card><Card title="التاجر والاشتراك"><Line label="المتجر" value={data.storeName ?? "غير متاح"} /><Line label="التاجر" value={data.merchantName ?? "غير متاح"} />{data.merchantPhone ? <Line label="الهاتف" value={data.merchantPhone} /> : null}<Line label="الخطة" value={data.planName ?? "غير متاحة"} /><Line label="بداية الفترة" value={date(data.subscriptionStartsAt)} /><Line label="نهاية الفترة" value={date(data.subscriptionExpiresAt)} /><Line label="تاريخ الاستحقاق" value={date(data.due_at)} /><Pressable onPress={() => router.push(`/admin/merchant-finance?merchantId=${encodeURIComponent(data.merchant_id)}` as Href)} style={({ pressed }) => [styles.link, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? .72 : 1 }]}><Text style={[styles.linkText, { color: colors.primary }]}>فتح الحساب المالي للتاجر</Text><AppIcon name="chevron-back-outline" size={20} color={colors.primary} /></Pressable></Card><Card title="المدفوعات المخصصة"><Allocations data={data} /></Card><Card title="القيود المرتبطة"><Ledger entries={data.ledgerEntries} currency={data.currency} /></Card></> : null}
  </ScrollView></View>;
}

function Allocations({ data }: { data: AdminInvoiceDetails }) { const { colors } = useTheme(); if (!data.allocations.length) return <Text style={[styles.meta, { color: colors.textSecondary }]}>لا توجد مدفوعات مخصصة لهذه الفاتورة.</Text>; return <View style={styles.list}>{data.allocations.map((allocation) => <View key={`${allocation.invoice_id}-${allocation.payment_id}`} style={[styles.record, { borderColor: colors.border }]}><Text style={[styles.value, { color: colors.text }]}>{money(allocation.amount, data.currency)}</Text><Text style={[styles.meta, { color: colors.textSecondary }]}>{allocation.payment ? `${allocation.payment.method === "cash" ? "نقدي" : "حوالة خارجية"} · ${date(allocation.payment.received_at)}` : "بيانات الدفعة غير متاحة"}</Text>{allocation.payment?.external_reference ? <Text style={[styles.caption, { color: colors.textSecondary }]}>المرجع: {allocation.payment.external_reference}</Text> : null}</View>)}</View>; }
function Ledger({ entries, currency }: { entries: LedgerEntry[]; currency: string }) { const { colors } = useTheme(); if (!entries.length) return <Text style={[styles.meta, { color: colors.textSecondary }]}>لا توجد قيود مرتبطة مباشرة بهذه الفاتورة.</Text>; return <View style={styles.list}>{entries.map((entry) => <View key={entry.id} style={[styles.record, { borderColor: colors.border }]}><Text style={[styles.value, { color: colors.text }]}>{entry.effect === "increase_exposure" ? "زيادة التزام" : "تخفيض التزام"} · {money(entry.amount, currency)}</Text><Text style={[styles.caption, { color: colors.textSecondary }]}>المرجع: {entry.source_type} · {short(entry.source_id)} · {date(entry.created_at)}</Text></View>)}</View>; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { const { colors } = useTheme(); return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.text }]}>{title}</Text>{children}</View>; }
function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { const { colors } = useTheme(); return <View style={styles.line}><Text style={[styles.meta, { color: colors.textSecondary }]}>{label}</Text><Text style={[strong ? styles.value : styles.meta, { color: strong ? colors.primary : colors.text }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, justifyContent: "center" }, content: { width: "100%", maxWidth: 800, alignSelf: "center", padding: Spacing.five, paddingBottom: Spacing.ten, gap: Spacing.three }, refresh: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }, error: { padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.two }, card: { padding: Spacing.four, borderWidth: 1, borderRadius: Radius.lg, gap: Spacing.three }, title: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" }, header: { flexDirection: "row-reverse", alignItems: "flex-start", gap: Spacing.two }, grow: { flex: 1, gap: Spacing.one }, name: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" }, badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.full, fontFamily: Fonts.semiBold, fontSize: FontSizes.xs }, meta: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 }, caption: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", lineHeight: 20 }, value: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, textAlign: "left" }, line: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: Spacing.three }, link: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }, linkText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm }, list: { gap: Spacing.two }, record: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, gap: Spacing.one } });
