import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { WorkspaceButton, WorkspaceConfirmModal, WorkspaceEmptyState, WorkspaceField, WorkspaceFormModal, WorkspaceFrame, WorkspaceStatus, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type Zone = { id: string; name: string; region_name: string; fixed_fee: number; currency: string; is_active: boolean };
type Currency = "SYP" | "USD";

export default function AdminZones() {
  const { colors } = useTheme();
  const [zones, setZones] = useState<Zone[]>([]);
  const [region, setRegion] = useState("");
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [currency, setCurrency] = useState<Currency>("SYP");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [confirmation, setConfirmation] = useState<{ zone: Zone; nextActive: boolean } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("delivery_zones")
      .select("id,name,region_name,fixed_fee,currency,is_active")
      .order("region_name")
      .order("name");
    setLoading(false);
    if (error) {
      Alert.alert("تعذر تحميل مناطق التوصيل", "تحقق من صلاحيات الإدارة واتصال الإنترنت.");
      return;
    }
    setZones((data ?? []) as Zone[]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const clearForm = () => {
    setEditingId(null);
    setRegion("");
    setName("");
    setFee("");
    setCurrency("SYP");
  };

  const save = async () => {
    const normalizedRegion = region.trim();
    const normalizedName = name.trim();
    const numericFee = Number(fee);
    if (!normalizedRegion || !normalizedName || !fee.trim() || !Number.isFinite(numericFee) || numericFee < 0) {
      Alert.alert("بيانات غير مكتملة", "أدخل المنطقة والاسم ورسمًا صحيحًا لا يقل عن صفر.");
      return;
    }

    setSaving(true);
    const result = editingId
      ? await supabase.from("delivery_zones").update({ region_name: normalizedRegion, name: normalizedName, fixed_fee: numericFee, currency }).eq("id", editingId)
      : await supabase.from("delivery_zones").insert({ region_name: normalizedRegion, name: normalizedName, fixed_fee: numericFee, currency, is_active: true });
    setSaving(false);

    if (result.error) {
      Alert.alert("تعذر حفظ المنطقة", "قد يكون الاسم مستخدمًا في المنطقة نفسها، أو لا تتوفر صلاحية الإدارة.");
      return;
    }

    clearForm();
    setFormVisible(false);
    await refresh();
  };

  const toggle = (zone: Zone) => {
    const nextActive = !zone.is_active;
    setConfirmation({ zone, nextActive });
  };

  const updateActive = async (zone: Zone, isActive: boolean) => {
    setSaving(true);
    const { error } = await supabase.from("delivery_zones").update({ is_active: isActive }).eq("id", zone.id);
    setSaving(false);
    if (error) {
      setConfirmation(null);
      Alert.alert("تعذر تحديث المنطقة", "تحقق من الصلاحيات وحاول مرة أخرى.");
      return;
    }
    setConfirmation(null);
    await refresh();
  };

  return (
    <WorkspaceFrame title="مناطق التوصيل">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <WorkspaceTitle title="مناطق التوصيل" detail="اضبط رسومًا ثابتة لكل منطقة، ثم أوقف أو فعّل استقبال الطلبات عند الحاجة." />
        <WorkspaceButton title="إضافة منطقة توصيل" onPress={() => { clearForm(); setFormVisible(true); }} disabled={saving || loading} />
        <WorkspaceTitle title="المناطق الحالية" />
        {loading ? <Text style={{ padding: 18, textAlign: "center", color: colors.textSecondary }}>جارٍ تحميل المناطق…</Text> : null}
        {!loading && zones.map((zone) => (
          <View key={zone.id} style={{ marginHorizontal: 16, marginTop: 10, padding: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12 }}>
            <Text style={{ color: colors.text, fontWeight: "600", textAlign: "right" }}>{zone.region_name} · {zone.name}</Text>
            <Text style={{ color: colors.textSecondary, textAlign: "right", marginTop: 4 }}>{Number(zone.fixed_fee).toLocaleString("en-US")} {zone.currency}</Text>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <WorkspaceStatus label={zone.is_active ? "فعالة" : "متوقفة"} color={zone.is_active ? colors.primary : colors.textMuted} />
              <View style={{ flexDirection: "row-reverse", gap: 18 }}>
                <Pressable accessibilityRole="button" disabled={saving} onPress={() => toggle(zone)} hitSlop={8}>
                  <Text style={{ color: zone.is_active ? colors.error : colors.primary }}>{zone.is_active ? "إيقاف" : "تفعيل"}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setEditingId(zone.id); setRegion(zone.region_name); setName(zone.name); setFee(String(zone.fixed_fee)); setCurrency(zone.currency as Currency); setFormVisible(true); }} hitSlop={8}>
                  <Text style={{ color: colors.primary }}>تعديل</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
        {!loading && zones.length === 0 ? <WorkspaceEmptyState icon="map-outline" title="لم تُضف مناطق توصيل بعد" detail="أضف مناطق الخدمة ورسومها الثابتة لبدء إعداد التوصيل." /> : null}
      </ScrollView>
      <WorkspaceFormModal visible={formVisible} title={editingId ? "تعديل منطقة التوصيل" : "إضافة منطقة توصيل"} detail="حدد الاسم ورسم التوصيل والعملة." onClose={() => { setFormVisible(false); clearForm(); }}>
        <WorkspaceField label="المحافظة أو المنطقة" value={region} onChangeText={setRegion} />
        <WorkspaceField label="اسم المنطقة" value={name} onChangeText={setName} />
        <WorkspaceField label="رسم التوصيل" value={fee} onChangeText={setFee} keyboardType="numeric" />
        <View style={{ flexDirection: "row-reverse", marginHorizontal: 16, marginTop: 12, gap: 8 }}>
          {(["SYP", "USD"] as const).map((value) => { const selected = currency === value; return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setCurrency(value)} style={{ minWidth: 76, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface }}><Text style={{ color: selected ? colors.surface : colors.text, fontWeight: "600" }}>{value}</Text></Pressable>; })}
        </View>
        <WorkspaceButton title={saving ? "جارٍ الحفظ…" : editingId ? "حفظ التعديلات" : "حفظ المنطقة"} onPress={() => void save()} disabled={saving || loading} />
      </WorkspaceFormModal>
      <WorkspaceConfirmModal visible={confirmation !== null} title={confirmation?.nextActive ? "تفعيل منطقة التوصيل" : "إيقاف منطقة التوصيل"} detail={confirmation ? confirmation.nextActive ? `ستصبح ${confirmation.zone.region_name} · ${confirmation.zone.name} متاحة لاستقبال الطلبات.` : `لن يتمكن العملاء من اختيار ${confirmation.zone.region_name} · ${confirmation.zone.name} للطلبات الجديدة.` : ""} confirmLabel={confirmation?.nextActive ? "تفعيل المنطقة" : "إيقاف المنطقة"} danger={confirmation ? !confirmation.nextActive : false} busy={saving} onCancel={() => setConfirmation(null)} onConfirm={() => { if (confirmation) void updateActive(confirmation.zone, confirmation.nextActive); }} />
    </WorkspaceFrame>
  );
}
