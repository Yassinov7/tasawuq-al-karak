import { formatSyp } from "@/lib/money";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Href, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { AppButton } from "@/components/ui/AppButton";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getAdminOrderPage, getCachedAdminOrderPage, isCachedAdminOrderPageFresh, type AdminOrderListFilter, type AdminOrderSummary } from "@/lib/admin-orders";

const pageSize = 20;
const filters: { id: AdminOrderListFilter; label: string }[] = [
  { id: "all", label: "الكل" }, { id: "new", label: "الجديدة" }, { id: "in_progress", label: "قيد التنفيذ" },
  { id: "awaiting_delivery", label: "بانتظار التوصيل" }, { id: "completed", label: "المكتملة" }, { id: "cancelled", label: "الملغاة" },
];
const statusLabels: Record<string, string> = { submitted: "تم إرسال الطلب", in_progress: "قيد المعالجة", ready_for_delivery: "جاهز للتوصيل", out_for_delivery: "قيد التوصيل", delivered: "مكتمل", partially_cancelled: "أُلغي جزء من الطلب", cancelled: "ملغى" };
const formatDate = (value: string) => new Date(value).toLocaleDateString("ar-SY");
const formatAmount = (value: number, currency: string) => formatSyp(Number(value), currency);

export default function AdminOrdersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<AdminOrderListFilter>("all");
  const initialCache = getCachedAdminOrderPage("all", 0, pageSize)?.data;
  const [orders, setOrders] = useState<AdminOrderSummary[]>(initialCache?.orders ?? []);
  const [hasMore, setHasMore] = useState(initialCache?.hasMore ?? false);
  const [loading, setLoading] = useState(!initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const nextPage = useRef(1);

  useEffect(() => {
    const timer = setTimeout(() => setActiveSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const refresh = useCallback(async (manual = false) => {
    const cached = getCachedAdminOrderPage(filter, 0, pageSize, activeSearch)?.data;
    if (cached) { setOrders(cached.orders); setHasMore(cached.hasMore); }
    nextPage.current = 1;
    if (!manual && isCachedAdminOrderPageFresh(filter, 0, pageSize, activeSearch)) { setLoading(false); return; }
    if (cached) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const result = await getAdminOrderPage({ filter, page: 0, pageSize, force: manual, search: activeSearch });
      setOrders(result.orders); setHasMore(result.hasMore);
    } catch { setError("تعذّر تحميل الطلبات. احتفظنا بالبيانات السابقة إن كانت متاحة؛ حاول التحديث لاحقًا."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [activeSearch, filter]);

  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || refreshing) return;
    setLoadingMore(true);
    try {
      const result = await getAdminOrderPage({ filter, page: nextPage.current, pageSize, search: activeSearch });
      setOrders((current) => [...current, ...result.orders.filter((order) => !current.some((saved) => saved.id === order.id))]);
      setHasMore(result.hasMore); nextPage.current += 1;
    } catch { setError("تعذّر تحميل المزيد من الطلبات."); }
    finally { setLoadingMore(false); }
  }, [activeSearch, filter, hasMore, loading, loadingMore, refreshing]);
  const attentionCount = orders.filter((order) => order.status === "submitted" || order.status === "in_progress").length;

  return <View style={[styles.screen, { backgroundColor: colors.background }]}><FlatList data={orders} keyExtractor={(order) => order.id} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.primary} colors={[colors.primary]} />}
    ListHeaderComponent={<View style={styles.head}><View style={[styles.count, { backgroundColor: colors.accentLight }]}><AppIcon name="time-outline" size={18} color={colors.accentText} /><Text style={[styles.countText, { color: colors.accentText }]}>{attentionCount} طلب يحتاج متابعة</Text></View><View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}><AppIcon name="search-outline" size={20} color={colors.textSecondary} /><TextInput value={search} onChangeText={setSearch} placeholder="ابحث برقم الطلب أو العميل" placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.text }]} textAlign="right" /></View><View style={styles.filters}>{filters.map((item) => <Pressable key={item.id} onPress={() => setFilter(item.id)} style={({ pressed }) => [styles.filter, { backgroundColor: filter === item.id ? colors.primaryLight : colors.surface, borderColor: filter === item.id ? colors.primary : colors.border, opacity: pressed ? 0.72 : 1 }]}><Text style={[styles.filterText, { color: filter === item.id ? colors.primary : colors.textSecondary }]}>{item.label}</Text></Pressable>)}</View>{refreshing ? <Text style={[styles.refresh, { color: colors.textSecondary }]}>يتم التحديث في الخلفية…</Text> : null}{error ? <View style={[styles.error, { backgroundColor: colors.surfaceSecondary }]}><Text style={[styles.errorText, { color: colors.error }]}>{error}</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={() => void refresh(true)} /></View> : null}</View>}
    renderItem={({ item }) => <OrderCard order={item} onPress={() => router.push(`/admin/order-details?orderId=${encodeURIComponent(item.id)}` as Href)} />}
    ListEmptyComponent={loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : <EmptyState hasSearch={Boolean(activeSearch)} onRetry={() => void refresh(true)} />}
    ListFooterComponent={hasMore ? <View style={styles.footer}>{loadingMore ? <ActivityIndicator color={colors.primary} /> : <AppButton title="تحميل المزيد" variant="outline" fullWidth={false} onPress={() => void loadMore()} />}</View> : null}
  /></View>;
}

function OrderCard({ order, onPress }: { order: AdminOrderSummary; onPress: () => void }) {
  const { colors } = useTheme();
  const needsAttention = order.status === "submitted" || order.status === "in_progress";
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: needsAttention ? colors.accent : colors.border, opacity: pressed ? 0.72 : 1 }]}><View style={styles.cardHead}><View style={styles.grow}><Text style={[styles.name, { color: colors.text }]}>{order.reference ?? `طلب #${order.orderNumber}`}</Text><Text style={[styles.meta, { color: colors.textSecondary }]}>{formatDate(order.createdAt)}</Text></View><Text style={[styles.badge, { color: needsAttention ? colors.accentText : colors.primary, backgroundColor: needsAttention ? colors.accentLight : colors.primaryLight }]}>{statusLabels[order.status] ?? order.status}</Text></View><Text style={[styles.meta, { color: colors.textSecondary }]}>{order.customerName ?? order.recipientName}</Text><View style={[styles.amounts, { borderTopColor: colors.border }]}><Text style={[styles.meta, { color: colors.textSecondary }]}>{order.storeCount} {order.storeCount === 1 ? "متجر" : "متاجر"}</Text>{order.totals.length ? order.totals.map((total) => <Text key={total.currency} style={[styles.amount, { color: colors.text }]}>{formatAmount(total.total, total.currency)}</Text>) : <Text style={[styles.meta, { color: colors.textMuted }]}>لا يوجد إجمالي موثوق محفوظ</Text>}</View><AppIcon name="chevron-back-outline" size={19} color={colors.textSecondary} style={styles.chevron} /></Pressable>;
}

function EmptyState({ hasSearch, onRetry }: { hasSearch: boolean; onRetry: () => void }) {
  const { colors } = useTheme();
  return <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><AppIcon name={hasSearch ? "search-outline" : "receipt-outline"} size={27} color={colors.textMuted} /><Text style={[styles.emptyTitle, { color: colors.text }]}>{hasSearch ? "لا توجد نتائج مطابقة" : "لا توجد طلبات ضمن هذا الفلتر"}</Text><Text style={[styles.emptyText, { color: colors.textSecondary }]}>{hasSearch ? "جرّب رقم طلب أو اسم عميل آخر." : "اسحب للتحديث أو أعد المحاولة للتحقق من أحدث البيانات."}</Text>{!hasSearch ? <AppButton title="إعادة المحاولة" variant="outline" onPress={onRetry} /> : null}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { width: "100%", maxWidth: 800, alignSelf: "center", padding: Spacing.five, paddingBottom: Spacing.ten, gap: Spacing.three, flexGrow: 1 }, head: { gap: Spacing.three }, count: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", padding: Spacing.two, borderRadius: Radius.md, gap: Spacing.two }, countText: { fontFamily: Fonts.medium, fontSize: FontSizes.sm }, search: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: Spacing.three, gap: Spacing.two }, searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.sm, minHeight: 44 }, filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two }, filter: { borderWidth: 1, borderRadius: Radius.full, minHeight: 36, justifyContent: "center", paddingHorizontal: Spacing.three }, filterText: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, textAlign: "center" }, refresh: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }, error: { padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.two }, errorText: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 }, card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two }, cardHead: { flexDirection: "row-reverse", alignItems: "flex-start", gap: Spacing.two }, grow: { flex: 1, gap: Spacing.one }, name: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" }, badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.full, fontFamily: Fonts.semiBold, fontSize: FontSizes.xs }, meta: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 }, amounts: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, flexDirection: "row-reverse", alignItems: "center", gap: Spacing.two, flexWrap: "wrap" }, amount: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, textAlign: "right" }, chevron: { alignSelf: "flex-end" }, center: { minHeight: 240, justifyContent: "center" }, empty: { minHeight: 220, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, alignItems: "center", justifyContent: "center", gap: Spacing.two }, emptyTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "center" }, emptyText: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center", lineHeight: 22 }, footer: { alignItems: "center", paddingVertical: Spacing.two },
});
