import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import { WorkspaceButton, WorkspaceCard, WorkspaceConfirmModal, WorkspaceEmptyState, WorkspaceField, WorkspaceFormModal, WorkspaceFrame, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; display_name: string; phone: string };
type Driver = { id: string; user_id: string | null; full_name: string; phone: string; approval: string; is_active: boolean; is_platform_driver: boolean };
type ReadyOrder = {
  id: string;
  assigned_driver_id: string | null;
  orders: { order_number: number } | { order_number: number }[] | null;
  stores: { name: string } | { name: string }[] | null;
};

export default function AdminDrivers() {
  const { colors } = useTheme();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchedTerm, setSearchedTerm] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);
  const [profileSearch, setProfileSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingDriverId, setUpdatingDriverId] = useState<string | null>(null);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; detail: string; label: string; danger?: boolean; onConfirm: () => void } | null>(null);
  const [addDriverVisible, setAddDriverVisible] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [driverResult, orderResult] = await Promise.all([
      supabase.from("drivers").select("id,user_id,full_name,phone,approval,is_active,is_platform_driver").order("created_at", { ascending: false }),
      supabase.from("sub_orders").select("id,assigned_driver_id,orders(order_number),stores(name)").eq("status", "ready").order("created_at"),
    ]);
    setLoading(false);

    if (driverResult.error || orderResult.error) {
      Alert.alert("تعذر تحميل بيانات التوزيع", "تحقق من صلاحيات الإدارة واتصال الإنترنت.");
      return;
    }
    setDrivers((driverResult.data ?? []) as Driver[]);
    setReadyOrders((orderResult.data ?? []) as unknown as ReadyOrder[]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const term = profileSearch.trim();
    if (term.length < 2 || selectedUser) {
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        setSearching(true);
        const pattern = `%${term}%`;
        const [byName, byPhone] = await Promise.all([
          supabase.from("profiles").select("id,display_name,phone").ilike("display_name", pattern).limit(8),
          supabase.from("profiles").select("id,display_name,phone").ilike("phone", pattern).limit(8),
        ]);
        if (!active) return;
        setSearching(false);
        if (byName.error || byPhone.error) {
          Alert.alert("تعذر البحث عن الحسابات", "تحقق من اتصال الإنترنت وصلاحيات الإدارة.");
          return;
        }
        const unique = new Map<string, Profile>();
        for (const profile of [...(byName.data ?? []), ...(byPhone.data ?? [])]) unique.set(profile.id, profile as Profile);
        setProfiles([...unique.values()].slice(0, 8));
        setSearchedTerm(term);
      })();
    }, 250);

    return () => { active = false; clearTimeout(timer); };
  }, [profileSearch, selectedUser]);

  const selectProfile = (profile: Profile) => {
    setSelectedUser(profile.id);
    setSelectedProfile(profile);
    setFullName(profile.display_name);
    setPhone(profile.phone);
    setProfileSearch("");
  };

  const clearSelectedProfile = () => {
    setSelectedUser(null);
    setSelectedProfile(null);
    setFullName("");
    setPhone("");
  };

  const register = async () => {
    if (!selectedUser || !selectedProfile) {
      Alert.alert("اختر حسابًا", "يجب البحث عن حساب مسجل واختياره أولًا.");
      return;
    }
    if (drivers.some((driver) => driver.user_id === selectedUser)) {
      Alert.alert("السائق مسجل مسبقًا", "هذا الحساب لديه ملف سائق بالفعل.");
      return;
    }
    const nextName = fullName.trim();
    const nextPhone = phone.trim();
    if (!nextName || !nextPhone) {
      Alert.alert("بيانات ناقصة", "أدخل اسم السائق ورقم هاتفه.");
      return;
    }

    setConfirmation({ title: "تفعيل حساب السائق", detail: `سيُربط الحساب ${selectedProfile.display_name || selectedProfile.phone} كـسائق مستقل، وسيكون مؤهلًا لاستلام الإسنادات.`, label: "تأكيد تفعيل السائق", onConfirm: () => void createDriver(selectedUser, nextName, nextPhone) });
  };

  const createDriver = async (userId: string, nextName: string, nextPhone: string) => {
    setSaving(true);
    const { error: roleError } = await supabase.from("user_roles").upsert({ user_id: userId, role: "driver" }, { onConflict: "user_id,role" });
    if (roleError) {
      setSaving(false);
      setConfirmation(null);
      Alert.alert("تعذر منح صلاحية السائق", "تحقق من صلاحيات الإدارة ثم حاول مرة أخرى.");
      return;
    }
    const { error } = await supabase.from("drivers").insert({ user_id: userId, full_name: nextName, phone: nextPhone, approval: "approved", is_active: true, is_platform_driver: false });
    setSaving(false);
    if (error) {
      setConfirmation(null);
      Alert.alert("تعذر إنشاء ملف السائق", "قد يكون الحساب مرتبطًا بسائق آخر بالفعل.");
      return;
    }
    setConfirmation(null);
    clearSelectedProfile();
    setAddDriverVisible(false);
    await refresh();
  };

  const toggleDriver = (driver: Driver) => {
    const nextActive = !driver.is_active;
    setConfirmation({ title: nextActive ? "إعادة تفعيل السائق" : "إيقاف السائق", detail: nextActive ? `سيعود ${driver.full_name} لاستلام الإسنادات الجديدة.` : `لن يستقبل ${driver.full_name} إسنادات جديدة حتى إعادة تفعيله.`, label: nextActive ? "إعادة التفعيل" : "إيقاف السائق", danger: !nextActive, onConfirm: () => void updateDriver(driver, nextActive) });
  };

  const updateDriver = async (driver: Driver, isActive: boolean) => {
    setUpdatingDriverId(driver.id);
    const { error } = await supabase.from("drivers").update({ is_active: isActive }).eq("id", driver.id);
    setUpdatingDriverId(null);
    if (error) {
      setConfirmation(null);
      Alert.alert("تعذر تحديث السائق", "تحقق من الصلاحيات وحاول مرة أخرى.");
      return;
    }
    setConfirmation(null);
    if (!isActive && selectedDriverId === driver.id) setSelectedDriverId(null);
    await refresh();
  };

  const assign = async (order: ReadyOrder) => {
    const driver = drivers.find((item) => item.id === selectedDriverId);
    if (!driver || driver.approval !== "approved" || !driver.is_active) {
      Alert.alert("اختر سائقًا فعالًا", "لا يمكن إسناد الطلب إلى سائق متوقف أو غير معتمد.");
      return;
    }
    const parent = Array.isArray(order.orders) ? order.orders[0] : order.orders;
    const store = Array.isArray(order.stores) ? order.stores[0] : order.stores;
    setConfirmation({ title: "تأكيد إسناد الطلب", detail: `سيُسند الطلب #${parent?.order_number ?? "—"} · ${store?.name ?? "متجر"} إلى السائق ${driver.full_name}.`, label: "تأكيد الإسناد", onConfirm: () => void performAssign(order, driver) });
  };

  const performAssign = async (order: ReadyOrder, driver: Driver) => {
    setAssigningOrderId(order.id);
    const { error } = await supabase.from("sub_orders").update({ assigned_driver_id: driver.id }).eq("id", order.id).eq("status", "ready");
    setAssigningOrderId(null);
    if (error) {
      setConfirmation(null);
      Alert.alert("تعذر إسناد الطلب", "ربما تغيرت حالة الطلب. حدّث القائمة وحاول مرة أخرى.");
      return;
    }
    setConfirmation(null);
    await refresh();
  };

  const searchTerm = profileSearch.trim();
  const matchingProfiles = searchedTerm === searchTerm
    ? profiles.filter((profile) => !drivers.some((driver) => driver.user_id === profile.id))
    : [];
  const isSearchable = searchTerm.length >= 2 && !selectedUser;

  return (
    <WorkspaceFrame title="إدارة السائقين">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <WorkspaceTitle title="توزيع الطلبات" detail="أدر السائقين وأسند إليهم الطلبات الجاهزة." />
        <WorkspaceButton title="إضافة سائق مستقل" onPress={() => { clearSelectedProfile(); setAddDriverVisible(true); }} disabled={loading || saving} />
        <WorkspaceTitle title="السائقون" detail="حسابات السائقين النشطة والموقوفة." />
        <WorkspaceTitle title="الطلبات الجاهزة للتوزيع" detail="اختر سائقًا ثم راجع الإسناد قبل تأكيده." />
        {readyOrders.map((order) => {
          const parent = Array.isArray(order.orders) ? order.orders[0] : order.orders;
          const store = Array.isArray(order.stores) ? order.stores[0] : order.stores;
          const assignedDriver = drivers.find((driver) => driver.id === order.assigned_driver_id);
          return (
            <View key={order.id} style={{ marginHorizontal: 16, marginTop: 8, padding: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10 }}>
              <Text style={{ textAlign: "right", color: colors.text, fontWeight: "600" }}>طلب #{parent?.order_number ?? "—"} · {store?.name ?? "متجر"}</Text>
              <Text style={{ textAlign: "right", marginTop: 4, color: colors.textSecondary }}>السائق: {assignedDriver?.full_name ?? "غير مسند"}</Text>
              <WorkspaceButton title={assigningOrderId === order.id ? "جارٍ الإسناد…" : order.assigned_driver_id ? "تغيير السائق" : "إسناد للسائق المحدد"} onPress={() => void assign(order)} disabled={!selectedDriverId || assigningOrderId !== null || loading} />
            </View>
          );
        })}
        {!loading && readyOrders.length === 0 ? <WorkspaceEmptyState icon="checkmark-circle-outline" title="لا توجد طلبات جاهزة للتوزيع" detail="ستظهر الطلبات هنا عندما ينتهي المتجر من تجهيزها." /> : null}
        <WorkspaceTitle title="قائمة السائقين" />
        {drivers.map((driver) => {
          const eligible = driver.approval === "approved" && driver.is_active;
          return (
            <View key={driver.id} style={{ marginTop: 8 }}>
              <WorkspaceCard title={driver.full_name} detail={driver.phone} icon="bicycle-outline" />
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginHorizontal: 16, marginTop: 8 }}>
                <Text style={{ color: driver.is_active ? colors.primary : colors.textMuted, textAlign: "right" }}>{driver.is_active ? "فعال" : "متوقف"} · {driver.is_platform_driver ? "تابع للمنصة" : "مستقل"}</Text>
                <Pressable accessibilityRole="button" disabled={updatingDriverId !== null} onPress={() => toggleDriver(driver)} hitSlop={8}><Text style={{ color: driver.is_active ? colors.error : colors.primary }}>{updatingDriverId === driver.id ? "جارٍ الحفظ…" : driver.is_active ? "إيقاف" : "إعادة تفعيل"}</Text></Pressable>
              </View>
              <Pressable accessibilityRole="button" disabled={!eligible} onPress={() => setSelectedDriverId(driver.id)} style={{ alignSelf: "flex-end", marginTop: 8, paddingVertical: 6 }}><Text style={{ color: selectedDriverId === driver.id ? colors.accent : eligible ? colors.primary : colors.textMuted }}>{selectedDriverId === driver.id ? "محدد للإسناد" : eligible ? "اختيار للإسناد" : "غير مؤهل للإسناد"}</Text></Pressable>
            </View>
          );
        })}
        {!loading && drivers.length === 0 ? <WorkspaceEmptyState icon="bicycle-outline" title="لم يُسجل سائق بعد" detail="أضف سائقًا من حساب مستخدم مسجل لبدء توزيع الطلبات." /> : null}
        {loading ? <Text style={{ textAlign: "center", padding: 18, color: colors.textSecondary }}>جارٍ تحميل السائقين والطلبات…</Text> : null}
      </ScrollView>
      <WorkspaceFormModal visible={addDriverVisible} title="إضافة سائق مستقل" detail="ابحث عن حساب مسجل واربطه بملف سائق." onClose={() => { setAddDriverVisible(false); clearSelectedProfile(); }}>
        {selectedProfile ? (
          <View style={{ marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.primaryLight }}>
            <Text style={{ color: colors.text, textAlign: "right", fontWeight: "600" }}>الحساب المختار: {selectedProfile.display_name || selectedProfile.phone}</Text>
            <Pressable accessibilityRole="button" onPress={clearSelectedProfile} style={{ alignSelf: "flex-end", paddingTop: 8 }}>
              <Text style={{ color: colors.primary }}>تغيير الحساب</Text>
            </Pressable>
          </View>
        ) : <>
          <WorkspaceField label="البحث بالاسم أو الهاتف" value={profileSearch} onChangeText={setProfileSearch} />
          {searching && isSearchable ? <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} /> : null}
          {matchingProfiles.map((profile) => (
            <Pressable key={profile.id} accessibilityRole="button" onPress={() => selectProfile(profile)} style={{ marginHorizontal: 16, marginTop: 6, padding: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ textAlign: "right", color: colors.text }}>{profile.display_name || "حساب بلا اسم"} · {profile.phone}</Text>
            </Pressable>
          ))}
          {isSearchable && !searching && searchedTerm === searchTerm && matchingProfiles.length === 0 ? <Text style={{ marginHorizontal: 16, marginTop: 8, textAlign: "right", color: colors.textMuted }}>لم نجد حسابًا جديدًا بهذه البيانات.</Text> : null}
        </>}
        {selectedUser ? <>
          <WorkspaceField label="اسم السائق" value={fullName} onChangeText={setFullName} />
          <WorkspaceField label="رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <WorkspaceButton title={saving ? "جارٍ تفعيل الحساب…" : "تفعيل حساب السائق"} onPress={() => void register()} disabled={saving || loading} />
        </> : null}
      </WorkspaceFormModal>
      <WorkspaceConfirmModal visible={confirmation !== null} title={confirmation?.title ?? "تأكيد الإجراء"} detail={confirmation?.detail ?? ""} confirmLabel={confirmation?.label} danger={confirmation?.danger} busy={updatingDriverId !== null || assigningOrderId !== null || saving} onConfirm={() => confirmation?.onConfirm()} onCancel={() => setConfirmation(null)} />
    </WorkspaceFrame>
  );
}
