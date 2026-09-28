import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { WorkspaceButton, WorkspaceField, WorkspaceFrame, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";

type Currency = "SYP" | "USD";
type DeliveryMode = "platform" | "store";

export default function StoreSettings() {
  const { colors } = useTheme();
  const { merchantId } = useWorkspace();
  const params = useLocalSearchParams<{ storeId?: string }>();
  const storeId = typeof params.storeId === "string" ? params.storeId : "";
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [currency, setCurrency] = useState<Currency>("SYP");
  const [savedCurrency, setSavedCurrency] = useState<Currency>("SYP");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("platform");
  const [fee, setFee] = useState("0");
  const [acceptsOrders, setAcceptsOrders] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!storeId || !merchantId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: store, error: storeError }, { data: setting, error: settingError }] = await Promise.all([
      supabase.from("stores").select("name,address,phone,description,latitude,longitude").eq("id", storeId).eq("merchant_id", merchantId).maybeSingle(),
      supabase.from("store_settings").select("currency,delivery_mode,store_delivery_fee,accepts_orders").eq("store_id", storeId).maybeSingle(),
    ]);
    setLoading(false);
    if (storeError || settingError || !store || !setting) { Alert.alert("تعذر تحميل إعدادات الفرع", "تأكد من اختيار أحد فروعك المعتمدة أو أعد المحاولة."); return; }
    setStoreName(store.name); setAddress(store.address); setPhone(store.phone ?? ""); setDescription(store.description); setLatitude(store.latitude == null ? "" : String(store.latitude)); setLongitude(store.longitude == null ? "" : String(store.longitude));
    setCurrency(setting.currency as Currency); setSavedCurrency(setting.currency as Currency); setDeliveryMode(setting.delivery_mode as DeliveryMode); setFee(String(setting.store_delivery_fee)); setAcceptsOrders(setting.accepts_orders);
  }, [merchantId, storeId]);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  const save = async () => {
    const latitudeValue = latitude.trim() ? Number(latitude) : null; const longitudeValue = longitude.trim() ? Number(longitude) : null;
    if (!storeId || !merchantId || !storeName.trim() || !address.trim() || !Number.isFinite(Number(fee)) || Number(fee) < 0 || ((latitudeValue === null) !== (longitudeValue === null)) || (latitudeValue !== null && (!Number.isFinite(latitudeValue) || latitudeValue < -90 || latitudeValue > 90)) || (longitudeValue !== null && (!Number.isFinite(longitudeValue) || longitudeValue < -180 || longitudeValue > 180))) {
      Alert.alert("تحقق من البيانات", "أدخل اسم الفرع وعنوانه ورسم توصيل صحيحًا."); return;
    }
    setSaving(true);
    const { error: storeError } = await supabase.from("stores").update({ name: storeName.trim(), address: address.trim(), phone: phone.trim() || null, description: description.trim(), latitude: latitudeValue, longitude: longitudeValue }).eq("id", storeId).eq("merchant_id", merchantId);
    if (storeError) { setSaving(false); Alert.alert("تعذر حفظ بيانات الفرع", "تحقق من بياناتك وصلاحيات الحساب."); return; }
    const { error: settingsError } = await supabase.from("store_settings").update({ currency, delivery_mode: deliveryMode, store_delivery_fee: Number(fee), accepts_orders: acceptsOrders }).eq("store_id", storeId);
    if (settingsError) { setSaving(false); Alert.alert("تعذر حفظ إعدادات التشغيل", "تم حفظ بيانات الفرع، لكن إعدادات التشغيل لم تحفظ. أعد المحاولة."); return; }
    if (currency !== savedCurrency) {
      const { error: pricesError } = await supabase.from("store_products").update({ currency }).eq("store_id", storeId);
      if (pricesError) {
        await supabase.from("store_settings").update({ currency: savedCurrency }).eq("store_id", storeId);
        setSaving(false); Alert.alert("تعذر تحديث عملة الأسعار", "أعدنا العملة السابقة لأن أسعار بعض المنتجات لم تُحدّث."); return;
      }
    }
    setSaving(false);
    setSavedCurrency(currency);
    Alert.alert("تم الحفظ", currency !== savedCurrency ? "تم حفظ بيانات الفرع، وتغيير عملة الأسعار دون تحويل الأرقام. راجع أسعار المنتجات." : "تم حفظ بيانات الفرع وإعدادات تشغيله.");
  };

  const choices = <T extends string>(values: { value: T; label: string }[], current: T, setter: (value: T) => void) => <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", marginHorizontal: 16, marginTop: 10, gap: 8 }}>{values.map((item) => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ selected: current === item.value }} onPress={() => setter(item.value)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: current === item.value ? colors.primary : colors.border, backgroundColor: current === item.value ? colors.primary : colors.surface }}><Text style={{ color: current === item.value ? colors.surface : colors.text }}>{item.label}</Text></Pressable>)}</View>;

  return <WorkspaceFrame title="إعدادات الفرع"><ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
    <WorkspaceTitle title={storeName || "إعداد الفرع"} detail="بيانات هذا الفرع وعملة أسعاره وطريقة التوصيل واستقبال الطلبات." />
    {loading ? <Text style={{ textAlign: "center", padding: 20, color: colors.textSecondary }}>جارٍ تحميل الإعدادات…</Text> : null}
    {!loading ? <>
      <WorkspaceTitle title="بيانات المتجر" />
      <WorkspaceField label="اسم الفرع" value={storeName} onChangeText={setStoreName} />
      <WorkspaceField label="العنوان" value={address} onChangeText={setAddress} />
      <WorkspaceField label="رقم الهاتف (اختياري)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <WorkspaceField label="وصف الفرع" value={description} onChangeText={setDescription} />
      <WorkspaceField label="خط العرض (اختياري)" value={latitude} onChangeText={setLatitude} keyboardType="numeric" />
      <WorkspaceField label="خط الطول (اختياري)" value={longitude} onChangeText={setLongitude} keyboardType="numeric" />
      <WorkspaceTitle title="عملة الأسعار" detail="اختيار عملة جديدة لا يحوّل الأسعار الرقمية؛ راجع كل سعر بعد التغيير." />
      {choices([{ value: "SYP" as const, label: "ليرة سورية · SYP" }, { value: "USD" as const, label: "دولار · USD" }], currency, setCurrency)}
      <WorkspaceTitle title="طريقة التوصيل" detail="اختيار توصيل المتجر يطبق على طلب هذا الفرع المنفرد. الطلبات متعددة المتاجر تتولاها المنصة." />
      {choices([{ value: "platform" as const, label: "توصيل المنصة" }, { value: "store" as const, label: "توصيل المتجر" }], deliveryMode, setDeliveryMode)}
      {deliveryMode === "store" ? <WorkspaceField label={`رسم توصيل الفرع (${currency})`} value={fee} onChangeText={setFee} keyboardType="numeric" /> : null}
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: acceptsOrders }} onPress={() => setAcceptsOrders((value) => !value)} style={{ marginHorizontal: 16, marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: acceptsOrders ? colors.primaryLight : colors.surface, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: acceptsOrders ? colors.primary : colors.textSecondary, textAlign: "right", fontWeight: "600" }}>{acceptsOrders ? "الفرع يستقبل الطلبات" : "الفرع متوقف مؤقتًا عن استقبال الطلبات"} · اضغط للتبديل</Text></Pressable>
      <WorkspaceButton title={saving ? "جارٍ الحفظ…" : "حفظ بيانات وإعدادات الفرع"} onPress={() => void save()} disabled={saving} />
    </> : null}
  </ScrollView></WorkspaceFrame>;
}
