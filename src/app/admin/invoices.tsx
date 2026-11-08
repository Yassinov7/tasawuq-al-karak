import { formatSyp } from "@/lib/money";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Href, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getAdminInvoicePage, getCachedAdminInvoicePage, isCachedAdminInvoicePageFresh, type AdminInvoiceListFilter, type AdminInvoiceSummary } from "@/lib/admin-finance";

const pageSize = 20;
const filters: { id: AdminInvoiceListFilter; label: string }[] = [
  { id: "all", label: "الكل" }, { id: "open", label: "مفتوحة" }, { id: "partially_paid", label: "جزئية" }, { id: "paid", label: "مسددة" }, { id: "void", label: "ملغاة" },
];
const labels: Record<string, string> = { open: "مفتوحة", partially_paid: "مسددة جزئيًا", paid: "مسددة", void: "ملغاة" };
const money = (value: number, currency: string) => formatSyp(Number(value), currency);
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("ar-SY") : "—";

export default function AdminInvoicesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<AdminInvoiceListFilter>("all");
  const initial = getCachedAdminInvoicePage("all", 0, pageSize)?.data;
  const [invoices, setInvoices] = useState<AdminInvoiceSummary[]>(initial?.invoices ?? []);
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? false);
  const [loading, setLoading] = useState(!initial);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const nextPage = useRef(1);

  useEffect(() => { const timer = setTimeout(() => setActiveSearch(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const refresh = useCallback(async (manual = false) => {
    const cached = getCachedAdminInvoicePage(filter, 0, pageSize, activeSearch)?.data;
    if (cached) { setInvoices(cached.invoices); setHasMore(cached.hasMore); }
    nextPage.current = 1;
    if (!manual && isCachedAdminInvoicePageFresh(filter, 0, pageSize, activeSearch)) { setLoading(false); return; }
    if (cached) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const result = await getAdminInvoicePage({ filter, page: 0, pageSize, search: activeSearch, force: manual });
      setInvoices(result.invoices); setHasMore(result.hasMore);
    } catch {
      setError("تعذّر تحميل الفواتير. احتفظنا بالبيانات السابقة إن كانت متاحة.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [activeSearch, filter]);
  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [refresh]);
  const loadMore = useCallback(async () => {
    if (!hasMore || loading || refreshing || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await getAdminInvoicePage({ filter, page: nextPage.current, pageSize, search: activeSearch });
      setInvoices((current) => [...current, ...result.invoices.filter((invoice) => !current.some((saved) => saved.id === invoice.id))]);
      setHasMore(result.hasMore); nextPage.current += 1;
    } catch { setError("تعذّر تحميل المزيد من الفواتير."); }
    finally { setLoadingMore(false); }
  }, [activeSearch, filter, hasMore, loading, loadingMore, refreshing]);

  return <View style={[styles.screen, { backgroundColor: colors.background }]}><FlatList
    data={invoices} keyExtractor={(invoice) => invoice.id} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.primary} colors={[colors.primary]} />}
    ListHeaderComponent={<View style={styles.head}><View style={[styles.count, { backgroundColor: colors.primaryLight }]}><AppIcon name="receipt-outline" size={18} color={colors.primary} /><Text style={[styles.countText, { color: colors.primary }]}>{invoices.length} فاتورة ضمن النتائج</Text></View><View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}><AppIcon name="search-outline" size={20} color={colors.textSecondary} /><TextInput value={search} onChangeText={setSearch} placeholder="ابحث برقم الفاتورة أو التاجر أو المتجر" placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.text }]} textAlign="right" /></View><View style={styles.filters}>{filters.map((item) => <Pressable key={item.id} onPress={() => setFilter(item.id)} style={({ pressed }) => [styles.filter, { backgroundColor: filter === item.id ? colors.primaryLight : colors.surface, borderColor: filter === item.id ? colors.primary : colors.border, opacity: pressed ? .72 : 1 }]}><Text style={[styles.filterText, { color: filter === item.id ? colors.primary : colors.textSecondary }]}>{item.label}</Text></Pressable>)}</View>{refreshing ? <Text style={[styles.refresh, { color: colors.textSecondary }]}>يتم التحديث في الخلفية…</Text> : null}{error ? <View style={[styles.error, { backgroundColor: colors.surfaceSecondary }]}><Text style={[styles.errorText, { color: colors.error }]}>{error}</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={() => void refresh(true)} /></View> : null}</View>}
    renderItem={({ item }) => <InvoiceCard invoice={item} onPress={() => router.push(`/admin/invoice-details?invoiceId=${encodeURIComponent(item.id)}` as Href)} />}
    ListEmptyComponent={loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : <Empty hasSearch={Boolean(activeSearch)} onRetry={() => void refresh(true)} />}
    ListFooterComponent={hasMore ? <View style={styles.footer}>{loadingMore ? <ActivityIndicator color={colors.primary} /> : <AppButton title="تحميل المزيد" variant="outline" fullWidth={false} onPress={() => void loadMore()} />}</View> : null}
  /></View>;
}

function InvoiceCard({ invoice, onPress }: { invoice: AdminInvoiceSummary; onPress: () => void }) {
  const { colors } = useTheme();
  const isOpen = ["open", "partially_paid"].includes(invoice.status);
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: isOpen ? colors.accent : colors.border, opacity: pressed ? .72 : 1 }]}><View style={styles.cardHead}><View style={styles.grow}><Text style={[styles.name, { color: colors.text }]}>{invoice.invoice_number}</Text><Text style={[styles.meta, { color: colors.textSecondary }]}>{date(invoice.created_at)}</Text></View><Text style={[styles.badge, { color: isOpen ? colors.accentText : colors.primary, backgroundColor: isOpen ? colors.accentLight : colors.primaryLight }]}>{labels[invoice.status] ?? invoice.status}</Text></View><Text style={[styles.meta, { color: colors.textSecondary }]}>{invoice.storeName ?? invoice.merchantName ?? "تاجر بلا متجر مرتبط"}</Text>{invoice.subscriptionExpiresAt ? <Text style={[styles.caption, { color: colors.textSecondary }]}>فترة الاشتراك حتى {date(invoice.subscriptionExpiresAt)}</Text> : null}<View style={[styles.amounts, { borderTopColor: colors.border }]}><Text style={[styles.amount, { color: colors.text }]}>الأصلي: {money(invoice.total_amount, invoice.currency)}</Text><Text style={[styles.amount, { color: colors.textSecondary }]}>المسدد: {money(invoice.paidAmount, invoice.currency)}</Text><Text style={[styles.amount, { color: colors.primary }]}>المتبقي: {money(invoice.outstandingAmount, invoice.currency)}</Text></View><AppIcon name="chevron-back-outline" size={19} color={colors.textSecondary} style={styles.chevron} /></Pressable>;
}

function Empty({ hasSearch, onRetry }: { hasSearch: boolean; onRetry: () => void }) { const { colors } = useTheme(); return <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><AppIcon name={hasSearch ? "search-outline" : "receipt-outline"} size={27} color={colors.textMuted} /><Text style={[styles.emptyTitle, { color: colors.text }]}>{hasSearch ? "لا توجد نتائج مطابقة" : "لا توجد فواتير ضمن هذا الفلتر"}</Text><Text style={[styles.emptyText, { color: colors.textSecondary }]}>{hasSearch ? "جرّب رقم فاتورة أو اسم تاجر أو متجر آخر." : "اسحب للتحديث أو أعد المحاولة للتحقق من أحدث البيانات."}</Text>{!hasSearch ? <AppButton title="إعادة المحاولة" variant="outline" onPress={onRetry} /> : null}</View>; }
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { width: "100%", maxWidth: 800, alignSelf: "center", padding: Spacing.five, paddingBottom: Spacing.ten, gap: Spacing.three, flexGrow: 1 }, head: { gap: Spacing.three }, count: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", padding: Spacing.two, borderRadius: Radius.md, gap: Spacing.two }, countText: { fontFamily: Fonts.medium, fontSize: FontSizes.sm }, search: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: Spacing.three, gap: Spacing.two }, searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.sm, minHeight: 44 }, filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two }, filter: { borderWidth: 1, borderRadius: Radius.full, minHeight: 36, justifyContent: "center", paddingHorizontal: Spacing.three }, filterText: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "center" }, refresh: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }, error: { padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.two }, errorText: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 }, card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two }, cardHead: { flexDirection: "row-reverse", alignItems: "flex-start", gap: Spacing.two }, grow: { flex: 1, gap: Spacing.one }, name: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" }, badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.full, fontFamily: Fonts.semiBold, fontSize: FontSizes.xs }, meta: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 }, caption: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right", lineHeight: 20 }, amounts: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, gap: Spacing.one }, amount: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, textAlign: "right" }, chevron: { alignSelf: "flex-end" }, center: { minHeight: 240, justifyContent: "center" }, empty: { minHeight: 220, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, alignItems: "center", justifyContent: "center", gap: Spacing.two }, emptyTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "center" }, emptyText: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center", lineHeight: 22 }, footer: { alignItems: "center", paddingVertical: Spacing.two } });
