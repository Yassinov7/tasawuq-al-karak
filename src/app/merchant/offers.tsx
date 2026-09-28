import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { WorkspaceButton, WorkspaceCard, WorkspaceConfirmModal, WorkspaceEmptyState, WorkspaceField, WorkspaceFormModal, WorkspaceFrame, WorkspaceStatus, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";

type OfferRow = { id: string; product_id: string; store_id: string; price: number | string; currency: string; is_active: boolean; offer_price: number | string | null; offer_starts_at: string | null; offer_ends_at: string | null; products: { name: string; availability: string } | { name: string; availability: string }[] | null };

export default function MerchantOffers() {
  const { colors } = useTheme();
  const { stores, merchantApproval } = useWorkspace();
  const approvedStores = stores.filter((store) => store.status === "approved");
  const [storeId, setStoreId] = useState("");
  const firstApprovedStoreId = stores.find((store) => store.status === "approved")?.id ?? "";
  const activeStoreId = storeId || firstApprovedStoreId;
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<OfferRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OfferRow | null>(null);
  const [offerPrice, setOfferPrice] = useState("");
  const [startDay, setStartDay] = useState("");
  const [endDay, setEndDay] = useState("");
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    if (!activeStoreId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("store_products").select("id,product_id,store_id,price,currency,is_active,offer_price,offer_starts_at,offer_ends_at,products(name,availability)").eq("store_id", activeStoreId).order("created_at", { ascending: false });
    setLoading(false);
    if (error) { Alert.alert("تعذر تحميل العروض", "تحقق من الاتصال وصلاحيات الفرع."); return; }
    setRows((data ?? []) as unknown as OfferRow[]);
  }, [activeStoreId]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { const timer = setTimeout(() => setNow(Date.now()), 0); const interval = setInterval(() => setNow(Date.now()), 60000); return () => { clearTimeout(timer); clearInterval(interval); }; }, []);

  const openOffer = (row: OfferRow) => {
    setEditing(row); setOfferPrice(row.offer_price == null ? "" : String(row.offer_price));
    setStartDay(row.offer_starts_at ? localDay(row.offer_starts_at) : "");
    setEndDay(row.offer_ends_at ? localDay(row.offer_ends_at) : ""); setFormVisible(true);
  };
  const dateBoundary = (day: string, endOfDay: boolean) => {
    if (!day.trim()) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.trim())) return undefined;
    const [year, month, dateNumber] = day.trim().split("-").map(Number);
    const calendarDate = new Date(year, month - 1, dateNumber);
    if (calendarDate.getFullYear() !== year || calendarDate.getMonth() !== month - 1 || calendarDate.getDate() !== dateNumber) return undefined;
    const date = new Date(`${day.trim()}T${endOfDay ? "23:59:59" : "00:00:00"}`);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };
  const saveOffer = async () => {
    if (!editing) return;
    const price = Number(offerPrice); const startsAt = dateBoundary(startDay, false); const endsAt = dateBoundary(endDay, true);
    if (!offerPrice.trim() || !Number.isFinite(price) || price < 0 || price >= Number(editing.price) || startsAt === undefined || endsAt === undefined || (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt))) {
      Alert.alert("تحقق من بيانات العرض", "أدخل سعرًا أقل من السعر الأساسي، وتواريخ بصيغة YYYY-MM-DD بحيث ينتهي العرض بعد بدايته."); return;
    }
    setSaving(true);
    const { error } = await supabase.from("store_products").update({ offer_price: price, offer_starts_at: startsAt, offer_ends_at: endsAt }).eq("id", editing.id).eq("store_id", activeStoreId);
    setSaving(false);
    if (error) { Alert.alert("تعذر حفظ العرض", "تأكد أن سعر العرض أقل من السعر الأساسي وحاول مرة أخرى."); return; }
    setFormVisible(false); setEditing(null); await load();
  };
  const removeOffer = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const { error } = await supabase.from("store_products").update({ offer_price: null, offer_starts_at: null, offer_ends_at: null }).eq("id", deleteTarget.id).eq("store_id", activeStoreId);
    setSaving(false); setDeleteTarget(null);
    if (error) Alert.alert("تعذر إنهاء العرض", "حاول مرة أخرى."); else await load();
  };

  return <WorkspaceFrame title="العروض"><ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
    <WorkspaceTitle title="عروض الفروع" detail="حدد سعرًا مخفضًا وتاريخ صلاحية اختياريًا لكل منتج. السعر المخفض يُحتسب تلقائيًا عند الطلب." />
    {approvedStores.length > 1 ? <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginHorizontal: 16, marginTop: 10 }}>{approvedStores.map((store) => <Pressable key={store.id} accessibilityRole="radio" accessibilityState={{ selected: store.id === activeStoreId }} onPress={() => setStoreId(store.id)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: store.id === activeStoreId ? colors.primary : colors.surface, borderWidth: 1, borderColor: store.id === activeStoreId ? colors.primary : colors.border }}><Text style={{ color: store.id === activeStoreId ? colors.surface : colors.text }}>{store.name}</Text></Pressable>)}</View> : null}
    {merchantApproval !== "approved" ? <Text style={{ margin: 16, textAlign: "right", color: colors.textSecondary }}>إدارة العروض متاحة بعد اعتماد حساب التاجر.</Text> : null}
    {loading ? <Text style={{ textAlign: "center", padding: 18, color: colors.textSecondary }}>جارٍ تحميل منتجات الفرع…</Text> : null}
    {rows.map((row) => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      const hasOffer = row.offer_price !== null;
      const startTime = row.offer_starts_at ? new Date(row.offer_starts_at).getTime() : 0;
      const endTime = row.offer_ends_at ? new Date(row.offer_ends_at).getTime() : Infinity;
      const offerActive = hasOffer && startTime <= now && endTime > now;
      return <View key={row.id}>
        <WorkspaceCard title={product?.name ?? "منتج"} detail={`السعر الأساسي: ${Number(row.price).toLocaleString("en-US")} ${row.currency} · ${row.is_active ? "السعر منشور" : "السعر متوقف"}`} icon="pricetag-outline" />
        {hasOffer ? <View style={{ alignSelf: "flex-end", marginHorizontal: 20, marginTop: 6 }}><WorkspaceStatus label={offerActive ? "عرض فعال" : startTime > now ? "عرض مجدول" : "انتهت مدة العرض"} color={offerActive ? colors.primary : colors.accent} /></View> : null}
        {hasOffer ? <Text style={{ marginHorizontal: 22, marginTop: 6, textAlign: "right", color: colors.textSecondary }}>سعر العرض: {Number(row.offer_price).toLocaleString("en-US")} {row.currency}{row.offer_ends_at ? ` · حتى ${new Date(row.offer_ends_at).toLocaleDateString("ar-SY")}` : " · دون تاريخ انتهاء"}</Text> : null}
        <View style={{ flexDirection: "row-reverse", gap: 9, marginHorizontal: 16, marginTop: 7 }}>
          <Pressable disabled={!row.is_active || product?.availability !== "available"} onPress={() => openOffer(row)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.primaryLight, opacity: !row.is_active || product?.availability !== "available" ? 0.5 : 1 }}><Text style={{ color: colors.primary }}>{hasOffer ? "تعديل العرض" : "إنشاء عرض"}</Text></Pressable>
          {hasOffer ? <Pressable onPress={() => setDeleteTarget(row)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.error + "18" }}><Text style={{ color: colors.error }}>إنهاء العرض</Text></Pressable> : null}
        </View>
      </View>;
    })}
    {!loading && !rows.length ? <WorkspaceEmptyState icon="pricetag-outline" title="لا توجد منتجات مسعرة" detail="أضف منتجات وأسعارًا للفرع أولًا، ثم أنشئ عروضًا لها." /> : null}
  </ScrollView>
    <WorkspaceFormModal visible={formVisible} title={editing ? "إنشاء أو تعديل عرض" : "عرض"} detail={editing ? `السعر الأساسي ${Number(editing.price).toLocaleString("en-US")} ${editing.currency}. يبدأ العرض فورًا إذا تركت تاريخ البداية فارغًا.` : undefined} onClose={() => { if (!saving) { setFormVisible(false); setEditing(null); } }}>
      <WorkspaceField label="سعر العرض" value={offerPrice} onChangeText={setOfferPrice} keyboardType="numeric" />
      <WorkspaceField label="يبدأ بتاريخ (اختياري · YYYY-MM-DD)" value={startDay} onChangeText={setStartDay} placeholder="يبدأ فورًا" />
      <WorkspaceField label="ينتهي بتاريخ (اختياري · YYYY-MM-DD)" value={endDay} onChangeText={setEndDay} placeholder="دون تاريخ انتهاء" />
      <WorkspaceButton title={saving ? "جارٍ الحفظ…" : "حفظ العرض"} onPress={() => void saveOffer()} disabled={saving} />
    </WorkspaceFormModal>
    <WorkspaceConfirmModal visible={deleteTarget !== null} title="إنهاء العرض" detail={deleteTarget ? `سيعود سعر «${Array.isArray(deleteTarget.products) ? deleteTarget.products[0]?.name : deleteTarget.products?.name}» إلى السعر الأساسي.` : ""} confirmLabel="إنهاء العرض" danger busy={saving} onCancel={() => setDeleteTarget(null)} onConfirm={() => void removeOffer()} />
  </WorkspaceFrame>;
}

function localDay(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
