import { LoadingSkeleton, RefreshStatus } from "@/components/ui/LoadingState";
import { useAuth } from "@/context/AuthContext";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { useReadScope } from "@/hooks/useReadScope";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { useCallback, useMemo, useState } from "react";
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppButton } from "@/components/ui/AppButton";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getAdminApplications, getCachedApplications, isCachedApplicationsFresh, type ApplicationRole, type ApplicationStatus, type ApplicationSummary } from "@/lib/admin-applications";

const roles: { id: ApplicationRole; label: string }[] = [{ id: "merchant", label: "التجار" }, { id: "driver", label: "السائقون" }];
const filters: { id: ApplicationStatus | "all"; label: string }[] = [{ id: "pending", label: "المعلقة" }, { id: "changes_requested", label: "تحتاج استكمالًا" }, { id: "accepted", label: "المقبولة" }, { id: "rejected", label: "المرفوضة" }, { id: "all", label: "الكل" }];
const labels: Record<string, string> = { pending: "قيد المراجعة", changes_requested: "تحتاج استكمالًا", accepted: "مقبول", rejected: "مرفوض" };

export default function AdminApplicationsScreen() {
  const {user}=useAuth();
  const {role,status}=useLocalSearchParams<{role?:string;status?:string}>();
  return user?<Applications key={`${user.id}:${role}:${status}`}/>:null;
}
function Applications() {
  const { role: queryRole } = useLocalSearchParams<{ role?: string }>(); const router = useRouter(); const { colors } = useTheme();
  const [role, setRole] = useState<ApplicationRole>(queryRole === "driver" ? "driver" : "merchant");
  const [filter, setFilter] = useState<ApplicationStatus | "all">("pending");
  const reads=useReadScope(`${role}:${filter}`);
  const initial = getCachedApplications(queryRole === "driver" ? "driver" : "merchant", "pending")?.data;
  const [rows, setRows] = useState<ApplicationSummary[]>(initial ?? []); const [loading, setLoading] = useState(!initial); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(""); const [search, setSearch] = useState("");
  const refresh = useCallback(async (manual = false) => {
    const token=reads.begin(),cached=getCachedApplications(role,filter)?.data;
    setRows(cached??[]);
    if (!manual && isCachedApplicationsFresh(role,filter)) { setLoading(false); return; }
    if(cached)setRefreshing(true);else setLoading(true);
    try { const result=await getAdminApplications(role,manual,filter);if(reads.current(token)){setRows(result);setError("");} }
    catch {if(reads.current(token))setError("تعذّر تحميل طلبات الانضمام. احتفظنا بالبيانات السابقة إن كانت متاحة.");}
    finally{if(reads.current(token)){setLoading(false);setRefreshing(false);}}
  }, [role,filter,reads]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const visible = useMemo(() => { const query = search.trim().toLocaleLowerCase("ar-SY"); return rows.filter((row) => (filter === "all" || row.status === filter) && (!query || [row.name, row.publicReference, row.phone].some((value) => value.toLocaleLowerCase("ar-SY").includes(query)))); }, [filter, rows, search]);
  const changeRole = (value: ApplicationRole) => { setRows([]);setLoading(true);setRole(value); setFilter("pending"); setSearch(""); router.setParams({ role: value }); };
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const live=useOrderRealtime({channelName:"admin-applications-applications",enabled:true,subscriptions:[{table:"merchant_applications"},{table:"driver_applications"}],onChange:()=>refresh(true)});
  return <View style={[styles.screen, { backgroundColor: colors.background }]}><LiveStatus state={live}/><FlatList maintainVisibleContentPosition={{minIndexForVisible:0}} data={visible} keyExtractor={(row) => row.id} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.primary} colors={[colors.primary]} />}
    ListHeaderComponent={<View style={styles.head}><View style={styles.tabs}>{roles.map((item) => <Pressable key={item.id} onPress={() => changeRole(item.id)} style={[styles.tab, { backgroundColor: role === item.id ? colors.primary : colors.surface, borderColor: role === item.id ? colors.primary : colors.border }]}><Text style={[styles.tabText, { color: role === item.id ? colors.surface : colors.textSecondary }]}>{item.label}</Text></Pressable>)}</View><View style={[styles.count, { backgroundColor: colors.accentLight }]}><AppIcon name="time-outline" size={18} color={colors.accentText} /><Text style={[styles.countText, { color: colors.accentText }]}>{pendingCount} طلب يحتاج مراجعة ضمن النتائج المحمّلة</Text></View><View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}><AppIcon name="search-outline" size={20} color={colors.textSecondary} /><TextInput value={search} onChangeText={setSearch} placeholder="ابحث بالاسم أو رمز الطلب MAP / DAP" placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.text }]} textAlign="right" /></View><View style={styles.filters}>{filters.map((item) => <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.filter, { backgroundColor: filter === item.id ? colors.primaryLight : colors.surface, borderColor: filter === item.id ? colors.primary : colors.border }]}><Text style={[styles.filterText, { color: filter === item.id ? colors.primary : colors.textSecondary }]}>{item.label}</Text></Pressable>)}</View><RefreshStatus busy={refreshing}/>{error ? <View style={[styles.error, { backgroundColor: colors.surfaceSecondary }]}><Text style={[styles.meta, { color: colors.error }]}>{error}</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={() => void refresh(true)} /></View> : null}</View>}
    renderItem={({ item }) => <Card item={item} onPress={() => router.push(`/admin/application-details?role=${item.role}&applicationId=${encodeURIComponent(item.id)}` as Href)} />}
    ListEmptyComponent={loading ? <LoadingSkeleton label="جارٍ تحميل طلبات الانضمام"/> : <Empty onRetry={() => void refresh(true)} />}
  /></View>;
}
function Card({ item, onPress }: { item: ApplicationSummary; onPress: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: item.status === "pending" ? colors.accent : colors.border, opacity: pressed ? .72 : 1 }]}><View style={styles.cardHead}><View style={styles.grow}><Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text><Text selectable style={[styles.meta, { color: colors.primary, writingDirection: "ltr" }]}>{item.publicReference}</Text><Text style={[styles.meta, { color: colors.textSecondary }]}>{item.role === "merchant" ? "طلب تاجر" : "طلب سائق"} · {new Date(item.submittedAt).toLocaleDateString("ar-SY")}</Text></View><Text style={[styles.badge, { color: item.status === "accepted" ? colors.success : item.status === "rejected" ? colors.error : colors.accentText, backgroundColor: item.status === "accepted" ? colors.primaryLight : colors.surfaceSecondary }]}>{labels[item.status]}</Text></View><Text style={[styles.meta, { color: colors.textSecondary }]}>{item.phone}</Text><AppIcon name="chevron-back-outline" size={19} color={colors.textSecondary} style={styles.chevron} /></Pressable>; }
function Empty({ onRetry }: { onRetry: () => void }) { const { colors } = useTheme(); return <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.name, { color: colors.text }]}>لا توجد طلبات مطابقة</Text><Text style={[styles.meta, { color: colors.textSecondary }]}>غيّر الفلتر أو حدّث القائمة.</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={onRetry} /></View>; }
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flexGrow: 1, width: "100%", maxWidth: 800, alignSelf: "center", padding: Spacing.five, paddingBottom: Spacing.ten, gap: Spacing.three }, head: { gap: Spacing.three }, tabs: { flexDirection: "row-reverse", gap: Spacing.two }, tab: { flex: 1, minHeight: 42, justifyContent: "center", alignItems: "center", borderWidth: 1, borderRadius: Radius.md }, tabText: { fontFamily: Fonts.semiBold, fontSize: FontSizes.sm }, count: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", padding: Spacing.two, borderRadius: Radius.md, gap: Spacing.two }, countText: { fontFamily: Fonts.medium, fontSize: FontSizes.sm }, search: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: Spacing.three, gap: Spacing.two }, searchInput: { flex: 1, minHeight: 44, fontFamily: Fonts.regular, fontSize: FontSizes.sm }, filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two }, filter: { minHeight: 36, paddingHorizontal: Spacing.three, justifyContent: "center", borderWidth: 1, borderRadius: Radius.full }, filterText: { fontFamily: Fonts.medium, fontSize: FontSizes.xs }, refresh: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, textAlign: "right" }, error: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two }, card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two }, cardHead: { flexDirection: "row-reverse", alignItems: "flex-start", gap: Spacing.two }, grow: { flex: 1, gap: Spacing.one }, name: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" }, meta: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right", lineHeight: 22 }, badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.full, fontFamily: Fonts.semiBold, fontSize: FontSizes.xs }, chevron: { alignSelf: "flex-end" }, center: { minHeight: 240, justifyContent: "center" }, empty: { minHeight: 200, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, justifyContent: "center", alignItems: "center", gap: Spacing.two } });
