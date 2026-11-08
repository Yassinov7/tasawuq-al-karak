import { useCallback, useEffect, useRef, useState } from "react";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getAdminStoreDetails } from "@/lib/admin-stores";

const date = (value: string) => new Date(value).toLocaleDateString("ar-SY");

export default function AdminStoreDetailsScreen() {
  const { storeId } = useLocalSearchParams<{ storeId?: string }>(); const router = useRouter(); const { colors } = useTheme();
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminStoreDetails>> | null>(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(""); const hasLoaded = useRef(false);
  const refresh = useCallback(async (manual = false) => { if (!storeId) { setError("معرّف المتجر غير صالح."); setLoading(false); return; } if (hasLoaded.current || manual) setRefreshing(true); else setLoading(true); setError(""); try { setData(await getAdminStoreDetails(storeId)); hasLoaded.current = true; } catch { setError("تعذر تحميل تفاصيل المتجر."); } finally { setLoading(false); setRefreshing(false); } }, [storeId]);
  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [refresh]);
  if (loading && !data) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  return <View style={[styles.screen, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.primary} colors={[colors.primary]} />}>
    {error ? <View style={[styles.error, { backgroundColor: colors.surfaceSecondary }]}><Text style={[styles.meta, { color: colors.error }]}>{error}</Text><AppButton title="إعادة المحاولة" variant="outline" onPress={() => void refresh(true)} /></View> : null}
    {data ? <><Card title="هوية المتجر"><Text style={[styles.name, { color: colors.text }]}>{data.store.name}</Text><Line label="الحالة التشغيلية" value={data.store.status === "accepted" ? "معتمد" : data.store.status} /><Line label="رقم الهاتف" value={data.store.phone || "غير متاح"} /><Line label="العنوان" value={data.store.address || "غير متاح"} />{data.store.description ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{data.store.description}</Text> : null}</Card>
      <Card title="صاحب المتجر"><Line label="الاسم" value={data.owner?.full_name || "غير متاح"} /><Line label="البريد" value={data.owner?.email || "غير متاح"} /><Line label="هاتف النشاط" value={data.merchant?.contact_phone || "غير متاح"} /></Card>
      <Card title="الاشتراك"><Line label="الخطة" value={data.subscription?.plan_name_snapshot || "لا توجد فترة اشتراك"} />{data.subscription ? <><Line label="البداية" value={date(data.subscription.starts_at)} /><Line label="الانتهاء" value={date(data.subscription.expires_at)} /><Line label="نسبة العمولة المثبتة" value={data.subscription.commission_rate_snapshot == null ? "غير مسواة" : `${data.subscription.commission_rate_snapshot}%`} /></> : null}</Card>
      <Card title="الكتالوج"><Line label="عدد المنتجات" value={String(data.productCount)} /></Card>
      <Card title="الحساب المالي"><Text style={[styles.meta, { color: colors.textSecondary }]}>الفواتير والمدفوعات والعمولات تُعرض في حساب التاجر المالي بالليرة السورية.</Text><AppButton title="فتح الحساب المالي للتاجر" icon="wallet-outline" onPress={() => router.push(`/admin/merchant-finance?merchantId=${encodeURIComponent(data.store.merchant_id)}` as Href)} /></Card></> : null}
  </ScrollView></View>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) { const { colors } = useTheme(); return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.text }]}>{title}</Text>{children}</View>; }
function Line({ label, value }: { label: string; value: string }) { const { colors } = useTheme(); return <View style={styles.line}><Text style={[styles.meta, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.value, { color: colors.text }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, justifyContent: "center" }, content: { width: "100%", maxWidth: 800, alignSelf: "center", padding: Spacing.five, paddingBottom: Spacing.ten, gap: Spacing.three }, card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two }, title: { fontFamily: Fonts.bold, fontSize: FontSizes.md, textAlign: "right" }, name: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, textAlign: "right" }, line: { flexDirection: "row-reverse", justifyContent: "space-between", gap: Spacing.three }, meta: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 22, textAlign: "right", flex: 1 }, value: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, textAlign: "left", flexShrink: 1 }, error: { padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.two } });
