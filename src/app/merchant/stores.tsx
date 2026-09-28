import { Href, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { WorkspaceButton, WorkspaceCard, WorkspaceConfirmModal, WorkspaceEmptyState, WorkspaceField, WorkspaceFormModal, WorkspaceFrame, WorkspaceStatus, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";

type StoreRow = { id: string; name: string; description: string; phone: string | null; address: string; latitude: number | null; longitude: number | null; status: string };

export default function MerchantStores() {
  const router = useRouter();
  const { colors } = useTheme();
  const { merchantId, merchantApproval, refresh: refreshWorkspace } = useWorkspace();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<StoreRow | null>(null);
  const [deleting, setDeleting] = useState<StoreRow | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const refresh = useCallback(async () => {
    if (!merchantId) { setStores([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("stores").select("id,name,description,phone,address,latitude,longitude,status").eq("merchant_id", merchantId).order("created_at", { ascending: false });
    setLoading(false);
    if (error) { Alert.alert("تعذر تحميل الفروع", "تحقق من الاتصال وحاول تحديث الصفحة."); return; }
    setStores((data ?? []) as StoreRow[]);
  }, [merchantId]);

  useEffect(() => { const timer = setTimeout(() => { void refresh(); }, 0); return () => clearTimeout(timer); }, [refresh]);

  const openCreate = () => { setEditing(null); setName(""); setAddress(""); setPhone(""); setDescription(""); setLatitude(""); setLongitude(""); setFormVisible(true); };
  const openEdit = (store: StoreRow) => { setEditing(store); setName(store.name); setAddress(store.address); setPhone(store.phone ?? ""); setDescription(store.description); setLatitude(store.latitude == null ? "" : String(store.latitude)); setLongitude(store.longitude == null ? "" : String(store.longitude)); setFormVisible(true); };
  const saveStore = async () => {
    const latitudeValue = latitude.trim() ? Number(latitude) : null; const longitudeValue = longitude.trim() ? Number(longitude) : null;
    if (!merchantId || !name.trim() || !address.trim() || ((latitudeValue === null) !== (longitudeValue === null)) || (latitudeValue !== null && (!Number.isFinite(latitudeValue) || latitudeValue < -90 || latitudeValue > 90)) || (longitudeValue !== null && (!Number.isFinite(longitudeValue) || longitudeValue < -180 || longitudeValue > 180))) { Alert.alert("بيانات مطلوبة أو غير صحيحة", "أدخل اسم الفرع وعنوانه، وأدخل الإحداثيين معًا ضمن النطاق الصحيح إذا أردت تحديد الموقع."); return; }
    setSaving(true);
    const values = { name: name.trim(), address: address.trim(), phone: phone.trim() || null, description: description.trim(), latitude: latitudeValue, longitude: longitudeValue };
    const result = editing
      ? await supabase.from("stores").update(values).eq("id", editing.id).eq("merchant_id", merchantId)
      : await supabase.from("stores").insert({ merchant_id: merchantId, ...values });
    setSaving(false);
    if (result.error) { Alert.alert(editing ? "تعذر تعديل الفرع" : "تعذر إضافة الفرع", "تحقق من البيانات وصلاحيات الحساب ثم حاول مرة أخرى."); return; }
    setFormVisible(false); await Promise.all([refresh(), refreshWorkspace()]);
  };
  const deleteStore = async () => {
    if (!deleting || !merchantId) return;
    setSaving(true);
    const { error } = await supabase.from("stores").delete().eq("id", deleting.id).eq("merchant_id", merchantId);
    setSaving(false);
    if (error) { setDeleting(null); Alert.alert("تعذر حذف الفرع", "لا يمكن حذف فرع مرتبط بطلبات أو عناصر محفوظة في سلة. يمكنك إيقاف استقبال طلباته من إعداداته."); return; }
    setDeleting(null); await Promise.all([refresh(), refreshWorkspace()]);
  };

  const statusLabel: Record<string, string> = { pending: "بانتظار موافقة الإدارة", approved: "معتمد", rejected: "مرفوض", suspended: "موقوف", closed: "مغلق", draft: "مسودة" };
  return <WorkspaceFrame title="متاجري">
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <WorkspaceTitle title="الفروع والمتاجر" detail="أضف فروعك وعدّل بياناتها وإعدادات تشغيل كل فرع." />
      {loading ? <Text style={{ textAlign: "center", padding: 20, color: colors.textSecondary }}>جارٍ تحميل الفروع…</Text> : null}
      {stores.map((store) => <View key={store.id}>
        <WorkspaceCard title={store.name} detail={`${statusLabel[store.status] ?? store.status} · ${store.address}`} icon="storefront-outline" />
        {store.phone ? <Text style={{ marginHorizontal: 24, marginTop: 4, color: colors.textMuted, textAlign: "right" }}>{store.phone}</Text> : null}
        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 9, marginHorizontal: 16, marginTop: 8 }}>
          <Pressable onPress={() => openEdit(store)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.primaryLight }}><Text style={{ color: colors.primary }}>تعديل البيانات</Text></Pressable>
          <Pressable onPress={() => router.push((`/merchant/store-settings?storeId=${store.id}`) as Href)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.primaryLight }}><Text style={{ color: colors.primary }}>إعدادات التشغيل</Text></Pressable>
          <Pressable onPress={() => setDeleting(store)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.error + "18" }}><Text style={{ color: colors.error }}>حذف الفرع</Text></Pressable>
        </View>
      </View>)}
      {!loading && !stores.length ? <WorkspaceEmptyState icon="storefront-outline" title="لا توجد فروع بعد" detail="أنشئ فرعك الأول ليبدأ ظهوره للإدارة للمراجعة." /> : null}
      {merchantApproval === "approved" ? <WorkspaceButton title="إضافة فرع جديد" onPress={openCreate} disabled={saving} /> : <Text style={{ textAlign: "right", margin: 16, color: colors.textSecondary }}>إضافة الفروع متاحة بعد اعتماد حساب التاجر.</Text>}
      {stores.some((store) => store.status === "pending") ? <View style={{ margin: 16, padding: 12, borderRadius: 12, backgroundColor: colors.accentLight }}><WorkspaceStatus label="مراجعة الإدارة" color={colors.accent} /><Text style={{ marginTop: 6, textAlign: "right", color: colors.textSecondary }}>تعديل بيانات فرع قيد المراجعة لا يغيّر حالة الموافقة.</Text></View> : null}
    </ScrollView>
    <WorkspaceFormModal visible={formVisible} title={editing ? "تعديل بيانات الفرع" : "إضافة فرع"} detail={editing ? "حالة الاعتماد لا يغيّرها إلا مسؤول الإدارة." : "سيُرسل الفرع الجديد إلى الإدارة للمراجعة."} onClose={() => { if (!saving) setFormVisible(false); }}>
      <WorkspaceField label="اسم الفرع" value={name} onChangeText={setName} />
      <WorkspaceField label="العنوان" value={address} onChangeText={setAddress} />
      <WorkspaceField label="رقم الهاتف (اختياري)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <WorkspaceField label="وصف الفرع (اختياري)" value={description} onChangeText={setDescription} />
      <WorkspaceField label="خط العرض (اختياري)" value={latitude} onChangeText={setLatitude} keyboardType="numeric" />
      <WorkspaceField label="خط الطول (اختياري)" value={longitude} onChangeText={setLongitude} keyboardType="numeric" />
      <WorkspaceButton title={saving ? "جارٍ الحفظ…" : editing ? "حفظ بيانات الفرع" : "إرسال الفرع للمراجعة"} onPress={() => void saveStore()} disabled={saving} />
    </WorkspaceFormModal>
    <WorkspaceConfirmModal visible={deleting !== null} title="حذف الفرع" detail={deleting ? `سيُحذف فرع «${deleting.name}» فقط إذا لم يرتبط بطلبات أو بسلال عملاء.` : ""} confirmLabel="حذف الفرع" danger busy={saving} onCancel={() => setDeleting(null)} onConfirm={() => void deleteStore()} />
  </WorkspaceFrame>;
}
