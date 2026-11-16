import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { AppHeader } from "@/components/navigation/AppHeader";
import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppSearchBar } from "@/components/ui/AppSearchBar";
import { DocumentReference } from "@/components/ui/DocumentReference";
import { FinancialFeedback } from "@/components/finance/FinancialParts";
import { LoadingSkeleton, RefreshStatus } from "@/components/ui/LoadingState";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { readCustomerInvoices, type CustomerInvoiceKind, type MerchantInvoiceCursor, type MoneyInvoice } from "@/lib/invoice-finance";
import { invoicePresentation } from "@/lib/invoice-presentation";
import { formatSypExact } from "@/lib/money";
import { userErrorMessage } from "@/lib/user-error-message";

type Snapshot = { rows: MoneyInvoice[]; hasMore: boolean; search: string; query: string; kind: CustomerInvoiceKind; scrollOffset: number; loadedAt: number };
const snapshots = new Map<string, Snapshot>();
const inflight = new Map<string, Promise<Awaited<ReturnType<typeof readCustomerInvoices>>>>();
const freshnessMs = 30_000;
const filters: { kind: CustomerInvoiceKind; label: string }[] = [
  { kind: "ALL", label: "الكل" }, { kind: "INV", label: "الشراء" }, { kind: "COR", label: "التصحيح" }, { kind: "SET", label: "التسوية" },
];
const customerKindLabels: Record<string, string> = { INV: "فاتورة شراء", COR: "مستند تصحيح", SET: "مستند تسوية" };

function requestPage(owner: string, query: string, kind: CustomerInvoiceKind, cursor?: MerchantInvoiceCursor) {
  const key = JSON.stringify([owner, query, kind, cursor?.createdAt ?? null, cursor?.id ?? null]);
  const existing = inflight.get(key);
  if (existing) return existing;
  const request = readCustomerInvoices(query, kind, cursor).finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

export function CustomerInvoicesScreen() {
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  if (authLoading) return <View style={[styles.center, { backgroundColor: colors.background }]}><LoadingSkeleton cards={2} label="جارٍ التحقق من الحساب"/></View>;
  if (!user) return <View style={[styles.screen, { backgroundColor: colors.background }]}><AppHeader title="فواتيري" showBack showNotifications={false}/><View style={styles.guest}><FinancialFeedback message="سجّل الدخول لعرض فواتيرك."/><AppButton title="تسجيل الدخول" onPress={() => router.replace("/login")}/></View></View>;
  return <CustomerInvoicesContent key={user.id} owner={user.id}/>;
}

function CustomerInvoicesContent({ owner }: { owner: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const cached = snapshots.get(owner);
  const [rows, setRows] = useState(cached?.rows ?? []);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? false);
  const [search, setSearch] = useState(cached?.search ?? "");
  const [query, setQuery] = useState(cached?.query ?? "");
  const [kind, setKind] = useState<CustomerInvoiceKind>(cached?.kind ?? "ALL");
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(false), generation = useRef(0), listRef = useRef<FlatList<MoneyInvoice>>(null);
  const scrollOffset = useRef(cached?.scrollOffset ?? 0), restored = useRef(false);
  const current = useRef({ rows, hasMore, loadingMore, search });
  useEffect(() => { current.current = { rows, hasMore, loadingMore, search }; }, [hasMore, loadingMore, rows, search]);

  const load = useCallback(async (mode: "initial" | "refresh" | "more") => {
    const before = current.current;
    if (mode === "more" && (!before.hasMore || before.loadingMore)) return;
    const token = ++generation.current;
    if (mode === "initial") setLoading(true); else if (mode === "more") setLoadingMore(true); else setRefreshing(true);
    try {
      const cursor = mode === "more" && before.rows.length ? { createdAt: before.rows.at(-1)!.created_at, id: before.rows.at(-1)!.id } : undefined;
      const page = await requestPage(owner, query, kind, cursor);
      if (!alive.current || token !== generation.current) return;
      const nextRows = mode === "more" ? [...before.rows, ...page.rows.filter(row => !before.rows.some(existing => existing.id === row.id))] :
        mode === "refresh" && before.rows.length ? [...page.rows, ...before.rows.filter(row => !page.rows.some(existing => existing.id === row.id))] : page.rows;
      setRows(nextRows); setHasMore(page.hasMore); setError("");
      snapshots.set(owner, { rows: nextRows, hasMore: page.hasMore, search: current.current.search, query, kind, scrollOffset: scrollOffset.current, loadedAt: Date.now() });
    } catch (cause) {
      if (alive.current && token === generation.current) setError(userErrorMessage(cause, "تعذر تحميل الفواتير."));
    } finally {
      if (alive.current && token === generation.current) { setLoading(false); setRefreshing(false); setLoadingMore(false); }
    }
  }, [kind, owner, query]);

  useFocusEffect(useCallback(() => {
    alive.current = true;
    const current = snapshots.get(owner);
    if (!current || current.query !== query || current.kind !== kind) void load("initial");
    else if (Date.now() - current.loadedAt >= freshnessMs) void load("refresh");
    return () => { alive.current = false; generation.current++; };
  }, [kind, load, owner, query]));

  const refreshLive = useCallback(() => load("refresh"), [load]);
  useOrderRealtime({ channelName: `customer-invoices:${owner}`, enabled: true,
    subscriptions: [{ table: "money_invoices", filter: `owner_id=eq.${owner}` }, { table: "money_allocations" }], onChange: refreshLive });

  const applyScope = (nextQuery: string, nextKind: CustomerInvoiceKind, nextSearch = search) => {
    setSearch(nextSearch);
    current.current.search = nextSearch;
    if (nextQuery === query && nextKind === kind) { void load("refresh"); return; }
    generation.current++; setError(""); setRows([]); setHasMore(false); setQuery(nextQuery); setKind(nextKind); setLoading(true); scrollOffset.current = 0; restored.current = true;
    snapshots.set(owner, { rows: [], hasMore: false, search: nextSearch, query: nextQuery, kind: nextKind, scrollOffset: 0, loadedAt: 0 });
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };
  const submitSearch = () => applyScope(search.trim(), kind, search.trim());

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader title="فواتيري" showBack showNotifications={false}/>
    <FlatList ref={listRef} data={rows} keyExtractor={item => item.id} renderItem={({ item }) => <CustomerInvoiceCard invoice={item} onPress={() => router.push({ pathname: "/financial-invoice", params: { id: item.id } })}/>} contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={colors.primary}/>} 
      onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; const current = snapshots.get(owner); if (current) current.scrollOffset = scrollOffset.current; }} scrollEventThrottle={32}
      onContentSizeChange={() => { if (restored.current || scrollOffset.current <= 0) return; restored.current = true; listRef.current?.scrollToOffset({ offset: scrollOffset.current, animated: false }); }}
      ListHeaderComponent={<View style={styles.headerContent}>
        <AppSearchBar value={search} onChangeText={setSearch} onSubmit={submitSearch} placeholder="ابحث بمرجع INV أو ORD"/>
        {search || query ? <View style={styles.searchActions}><AppButton title="بحث" compact fullWidth={false} onPress={submitSearch}/><AppButton title="مسح" compact fullWidth={false} variant="outline" onPress={() => applyScope("", kind, "")}/></View> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map(filter => <CategoryChip key={filter.kind} label={filter.label} active={kind === filter.kind} onPress={() => { if (filter.kind !== kind) applyScope(query, filter.kind); }}/>) }
        </ScrollView>
        <RefreshStatus busy={refreshing && rows.length > 0}/>
        {error ? <FinancialFeedback message={`${rows.length ? "المعروض آخر بيانات سليمة؛ " : ""}${error}`} error/> : null}
        {loading && !rows.length ? <LoadingSkeleton cards={3} label="جارٍ تحميل الفواتير"/> : null}
      </View>}
      ItemSeparatorComponent={() => <View style={styles.separator}/>} 
      ListEmptyComponent={!loading ? <View style={styles.empty}><AppIcon name="receipt-outline" size={28} color={colors.textMuted}/><Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد مستندات مطابقة</Text><Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>غيّر البحث أو نوع المستند، أو أعد المحاولة.</Text>{error ? <AppButton title="إعادة المحاولة" variant="outline" onPress={() => void load("initial")}/> : null}</View> : null}
      ListFooterComponent={rows.length ? <View style={styles.footer}>{hasMore ? <AppButton title="تحميل المزيد" variant="outline" loading={loadingMore} disabled={loadingMore} onPress={() => void load("more")}/> : <Text style={[styles.endText, { color: colors.textMuted }]}>ظهرت كل المستندات المطابقة</Text>}</View> : null}/>
  </View>;
}

function CustomerInvoiceCard({ invoice, onPress }: { invoice: MoneyInvoice; onPress: () => void }) {
  const { colors } = useTheme();
  const state = customerInvoiceCardState(invoice);
  const statusColors = state.tone === "success" ? { foreground: colors.successForeground, surface: colors.successSurface, border: colors.successBorder } :
    state.tone === "warning" ? { foreground: colors.warningForeground, surface: colors.warningSurface, border: colors.warningBorder } :
    state.tone === "info" ? { foreground: colors.infoForeground, surface: colors.infoSurface, border: colors.infoBorder } :
    state.tone === "error" ? { foreground: colors.errorForeground, surface: colors.errorSurface, border: colors.errorBorder } :
    { foreground: colors.textSecondary, surface: colors.mutedSurface, border: colors.borderStrong };
  const kindAccent = invoice.kind === "COR" ? colors.warningForeground : invoice.kind === "SET" ? colors.infoForeground : colors.primary;
  const kindIcon: ComponentProps<typeof AppIcon>["name"] = invoice.kind === "COR" ? "return-down-back-outline" : invoice.kind === "SET" ? "swap-horizontal-outline" : "receipt-outline";
  return <Pressable accessibilityRole="button" accessibilityLabel={`فتح ${customerKindLabels[invoice.kind] ?? "المستند"} ${invoice.reference}، ${state.label}`} onPress={onPress}
    style={({ pressed }) => [styles.card, { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border, borderStartColor: statusColors.border }]}>
    <View style={styles.cardHead}><View style={[styles.kindIcon, { backgroundColor: colors.surfaceSelected }]}><AppIcon name={kindIcon} size={19} color={kindAccent}/></View><View style={styles.cardIdentity}><Text style={[styles.kindLabel, { color: colors.text }]}>{customerKindLabels[invoice.kind] ?? "مستند مالي"}</Text><DocumentReference value={invoice.reference}/><Text style={[styles.date, { color: colors.textMuted }]}>{new Date(invoice.created_at).toLocaleString("ar-SY")}</Text></View><AppIcon name="chevron-back-outline" size={18} color={colors.textMuted}/></View>
    <View style={[styles.cardBottom, { borderTopColor: colors.borderSubtle }]}><View style={styles.amountBlock}><Text style={[styles.amountLabel, { color: colors.textSecondary }]}>قيمة المستند</Text><Text selectable style={[styles.amount, { color: colors.text }]}>{formatSypExact(invoice.amount)}</Text></View><View style={[styles.statusBadge, { backgroundColor: statusColors.surface, borderColor: statusColors.border }]}><AppIcon name={state.icon} size={15} color={statusColors.foreground}/><Text style={[styles.statusText, { color: statusColors.foreground }]}>{state.label}</Text></View></View>
  </Pressable>;
}

type CustomerCardTone = "success" | "warning" | "info" | "error" | "muted";
function customerInvoiceCardState(invoice: MoneyInvoice): { label: string; tone: CustomerCardTone; icon: ComponentProps<typeof AppIcon>["name"] } {
  const presentation = invoicePresentation(invoice);
  if (invoice.kind === "INV" && presentation.payment === "مسددة بالكامل") return { label: presentation.payment, tone: "success", icon: "checkmark-circle-outline" };
  if (invoice.kind === "INV" && presentation.payment === "بانتظار السداد") return { label: presentation.payment, tone: "warning", icon: "time-outline" };
  if (invoice.kind === "INV" && presentation.payment === "مسددة جزئيًا") return { label: presentation.payment, tone: "info", icon: "contrast-outline" };
  if (invoice.voided_by || invoice.status === "cancelled") return { label: presentation.document, tone: "error", icon: "close-circle-outline" };
  if (invoice.status === "pending") return { label: presentation.document, tone: "warning", icon: "time-outline" };
  if (invoice.status === "confirmed") return { label: presentation.document, tone: "info", icon: "checkmark-done-outline" };
  return { label: presentation.document, tone: "muted", icon: "help-circle-outline" };
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, justifyContent: "center" }, guest: { padding: Spacing.four },
  content: { alignSelf: "center", flexGrow: 1, maxWidth: 800, paddingBottom: Spacing.eight, paddingHorizontal: Spacing.four, width: "100%" },
  headerContent: { gap: Spacing.two, paddingBottom: Spacing.three, paddingTop: Spacing.two },
  searchActions: { alignItems: "center", flexDirection: "row-reverse", gap: Spacing.two },
  filters: { flexDirection: "row-reverse", gap: Spacing.two }, separator: { height: Spacing.two },
  card: { borderRadius: Radius.lg, borderStartWidth: 3, borderWidth: 1, gap: Spacing.two, minHeight: 120, padding: Spacing.three },
  cardHead: { alignItems: "flex-start", flexDirection: "row-reverse", gap: Spacing.two },
  kindIcon: { alignItems: "center", borderRadius: Radius.md, height: 38, justifyContent: "center", width: 38 },
  cardIdentity: { alignItems: "flex-end", flex: 1, gap: Spacing.half, minWidth: 0 },
  kindLabel: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm, textAlign: "right" }, date: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" },
  cardBottom: { alignItems: "flex-start", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, justifyContent: "space-between", paddingTop: Spacing.two },
  amountBlock: { alignItems: "flex-end", gap: Spacing.half }, amountLabel: { fontFamily: Fonts.regular, fontSize: FontSizes.xs }, amount: { fontFamily: Fonts.bold, fontSize: FontSizes.md, writingDirection: "ltr" },
  statusBadge: { alignItems: "center", borderRadius: Radius.full, borderWidth: 1, flexDirection: "row-reverse", flexShrink: 1, gap: Spacing.one, minHeight: 32, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  statusText: { flexShrink: 1, fontFamily: Fonts.semiBold, fontSize: FontSizes.xs, textAlign: "right" },
  empty: { alignItems: "center", flex: 1, gap: Spacing.two, justifyContent: "center", minHeight: 260, padding: Spacing.four }, emptyTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "center" }, emptyCopy: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "center" },
  footer: { alignItems: "center", paddingVertical: Spacing.four }, endText: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "center" },
});
