import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { AccountSection } from "@/components/account/AccountSection";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { c3Rpc } from "@/lib/c3-orders";
import { c3Number, c3Object, decodeC3Exception, type C3PricingException } from "@/lib/c3-order-contract";
import { formatSyp } from "@/lib/money";
import { Fonts } from "@/constants/theme";

type Zone = { id: string; name: string; fixed_fee: number; additional_store_fee: number; pricing_version: number; is_active: boolean };
function decodeZone(value: unknown): Zone {
  const row = c3Object(value);
  if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.is_active !== "boolean") throw Error("بيانات المنطقة غير مكتملة.");
  return { id: row.id, name: row.name, is_active: row.is_active, fixed_fee: c3Number(row.fixed_fee), additional_store_fee: c3Number(row.additional_store_fee), pricing_version: c3Number(row.pricing_version) };
}
/** Operational configuration only; no approval or repricing of an existing order. */
export function C3DeliverySettings() {
  const { user } = useAuth(), { colors } = useTheme(), router = useRouter();
  const [open, setOpen] = useState(false), [zones, setZones] = useState<Zone[]>([]);
  const [editing, setEditing] = useState<Zone | null>(null), [form, setForm] = useState(false);
  const [name, setName] = useState(""), [base, setBase] = useState(""), [uplift, setUplift] = useState(""), [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [exceptions, setExceptions] = useState<C3PricingException[]>([]), [page, setPage] = useState(0);
  const epoch = useRef(0), lock = useRef(false);
  const reload = useCallback(async (version: number) => {
    const [zoneRows, exceptionRows] = await Promise.all([c3Rpc("get_c3_delivery_zones"), c3Rpc("get_c3_pricing_exceptions", { page_number: page })]);
    if (!Array.isArray(zoneRows) || !Array.isArray(exceptionRows)) throw Error("تعذر قراءة الإعدادات.");
    if (epoch.current === version) { setZones(zoneRows.map(decodeZone)); setExceptions(exceptionRows.map(decodeC3Exception)); }
  }, [page]);
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current;
    setZones([]); setExceptions([]); setForm(false); setMessage(""); setBusy(false);
    if (open && user) { setBusy(true); void reload(version).catch(() => { if (epoch.current === version) setMessage("تعذر تحميل مناطق التوصيل أو حالات المراجعة."); }).finally(() => { if (epoch.current === version) setBusy(false); }); }
    return () => { epoch.current++; };
  }, [open, user, reload]));
  function edit(zone: Zone | null) {
    setEditing(zone); setName(zone?.name ?? ""); setBase(zone ? String(zone.fixed_fee) : ""); setUplift(zone ? String(zone.additional_store_fee) : ""); setEnabled(zone?.is_active ?? true); setForm(true); setMessage("");
  }
  async function save() {
    if (lock.current || !user) return;
    if (name.trim().length < 2 || name.trim().length > 100 || !/^\d+$/.test(base) || !/^\d+$/.test(uplift) || Number(base) > 999999999999 || Number(uplift) > 999999999999) { setMessage("أدخل اسم المنطقة ورسمين صحيحين غير سالبين بالليرة السورية."); return; }
    lock.current = true; setBusy(true); setMessage(""); const version = epoch.current;
    try {
      await c3Rpc("save_c3_delivery_zone", { target_zone: editing?.id ?? null, zone_name: name.trim(), base_fee: Number(base), uplift_fee: Number(uplift), active: enabled, expected_version: editing?.pricing_version ?? null });
      if (epoch.current !== version) return;
      setForm(false); setMessage("تم حفظ المنطقة. الطلبات السابقة تحتفظ بلقطة تسعيرها.");
      try { await reload(version); } catch { if (epoch.current === version) setMessage("تم الحفظ، وتعذر تحديث القائمة؛ أعد تحميلها قبل تعديل آخر."); }
    } catch { if (epoch.current === version) setMessage("تعذر تأكيد الحفظ. حدّث المناطق وتحقق من النتيجة قبل إعادة المحاولة."); }
    finally { lock.current = false; if (epoch.current === version) setBusy(false); }
  }
  const auditMoney = (value: string) => Math.abs(Number(value)) <= 999999999999.99 ? formatSyp(Number(value)) : `${value} ل.س`;
  const auditTime = (value: string) => new Date(value).toLocaleString("ar-SY");
  const text = { fontFamily: Fonts.regular, color: colors.text, textAlign: "right" as const };
  return <AccountSection title="مناطق التوصيل والتسعير" subtitle="الرسم الأساسي + رسم كل متجر إضافي. لا إعادة تسعير للطلبات المؤكدة.">
    <View style={{ padding: 16, gap: 12 }}>
      <AppButton title={open ? "إغلاق الإعدادات" : "إدارة مناطق التوصيل"} variant="outline" disabled={busy} onPress={() => setOpen(value => !value)} />
      {open ? <>
        <AppButton title={busy ? "جارٍ التحميل…" : "تحديث المناطق والمراجعات"} variant="outline" disabled={busy} onPress={() => { const version = ++epoch.current; setBusy(true); void reload(version).catch(() => setMessage("تعذر التحديث.")).finally(() => { if (epoch.current === version) setBusy(false); }); }} />
        {!busy && zones.length === 0 ? <Text style={text}>لا توجد مناطق للعرض.</Text> : null}
        {zones.map(zone => <AppButton key={zone.id} variant="outline" disabled={busy} title={`${zone.name} — ${zone.is_active ? "فعالة" : "موقوفة"} — ${formatSyp(zone.fixed_fee)} + ${formatSyp(zone.additional_store_fee)} لكل متجر إضافي`} onPress={() => edit(zone)} />)}
        <AppButton title="إضافة منطقة توصيل" disabled={busy} onPress={() => edit(null)} />
        {form ? <View style={{ gap: 12 }}>
          <AppTextField design="refined" disabled={busy} label="اسم المنطقة" value={name} onChangeText={setName} maxLength={100} />
          <AppTextField design="refined" disabled={busy} label="الرسم الأساسي (ل.س)" value={base} onChangeText={setBase} keyboardType="number-pad" />
          <AppTextField design="refined" disabled={busy} label="رسم المتجر الإضافي (ل.س)" value={uplift} onChangeText={setUplift} keyboardType="number-pad" />
          <AppButton variant="outline" disabled={busy} title={enabled ? "المنطقة فعالة — اضغط لإيقافها" : "المنطقة موقوفة — اضغط لتفعيلها"} onPress={() => setEnabled(value => !value)} />
          <AppButton title="حفظ المنطقة" disabled={busy} onPress={() => void save()} />
          <AppButton title="إلغاء" variant="outline" disabled={busy} onPress={() => setForm(false)} />
        </View> : null}
        <Text style={text}>استثناءات التسعير — قراءة فقط، لا تحصيل زيادة ولا فتح للإرسال هنا.</Text>
        {!exceptions.length && !busy ? <Text style={text}>لا توجد حالات في هذه الصفحة.</Text> : null}
        {exceptions.map(row => <View key={row.customer_order_id} style={{ gap: 8 }}>
          <Text style={text}>{row.public_reference}</Text>
          <Text style={text}>المبلغ المعتمد الأصلي: {auditMoney(row.approved_total)}</Text>
          <Text style={text}>المبلغ الجاري: {auditMoney(row.current_amount)}</Text>
          <Text style={text}>المبلغ المقترح غير المطبق: {auditMoney(row.proposed_total)}</Text>
          <Text style={text}>الفرق عن الجاري: {auditMoney(row.difference)}</Text>
          <Text style={text}>السبب: {row.reason}</Text>
          <Text style={text}>اعتماد الأصل: {auditTime(row.decided_at)}</Text>
          <Text style={text}>تسجيل الاستثناء: {auditTime(row.recorded_at)}</Text>
          <Text style={text}>آخر تحديث: {auditTime(row.updated_at)}</Text>
          <AppButton title="عرض الطلب" variant="outline" onPress={() => router.push({ pathname: "/admin/order-details", params: { orderId: row.customer_order_id } })} />
        </View>)}
        {page > 0 ? <AppButton title="الصفحة السابقة" disabled={busy} variant="outline" onPress={() => setPage(value => value - 1)} /> : null}
        {exceptions.length === 20 ? <AppButton title="مراجعات أخرى" disabled={busy} variant="outline" onPress={() => setPage(value => value + 1)} /> : null}
      </> : null}
      {message ? <Text accessibilityRole="alert" style={text}>{message}</Text> : null}
    </View>
  </AccountSection>;
}
