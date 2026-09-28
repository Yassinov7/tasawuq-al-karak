import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { WorkspaceButton, WorkspaceCard, WorkspaceConfirmModal, WorkspaceEmptyState, WorkspaceFrame, WorkspaceStatus, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type Merchant = {
  id: string;
  legal_name: string | null;
  contact_phone: string;
  approval: string;
  stores: { id: string; name: string; address: string; status: string }[];
};

type Decision = "approved" | "rejected";

const approvalLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  suspended: "موقوف",
};

const storeLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  suspended: "موقوف",
  draft: "مسودة",
  closed: "مغلق",
};

export default function AdminMerchants() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [rows, setRows] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; detail: string; label: string; danger: boolean; onConfirm: () => void } | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"pending" | "all">("pending");

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("merchants")
      .select("id,legal_name,contact_phone,approval,stores(id,name,address,status)")
      .order("created_at", { ascending: false });
    setLoading(false);

    if (error) {
      setConfirmation(null);
      Alert.alert("تعذر تحميل طلبات التجار", "تحقق من صلاحيات الإدارة واتصال الإنترنت.");
      return;
    }

    setRows((data ?? []) as unknown as Merchant[]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const updateMerchant = async (id: string, approval: Decision) => {
    if (!user) return;
    setSavingId(id);
    const { error } = await supabase
      .from("merchants")
      .update({
        approval,
        approved_by: approval === "approved" ? user.id : null,
        approved_at: approval === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    setSavingId(null);

    if (error) {
      setConfirmation(null);
      Alert.alert("تعذر تحديث طلب التاجر", "تحقق من الصلاحيات وحاول مرة أخرى.");
      return;
    }
    setConfirmation(null);
    await refresh();
  };

  const updateStore = async (id: string, status: Decision) => {
    if (!user) return;
    setSavingId(id);
    const { error } = await supabase
      .from("stores")
      .update({
        status,
        approved_by: status === "approved" ? user.id : null,
        approved_at: status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    setSavingId(null);

    if (error) {
      setConfirmation(null);
      Alert.alert("تعذر تحديث المتجر", "تحقق من الصلاحيات وحاول مرة أخرى.");
      return;
    }
    setConfirmation(null);
    await refresh();
  };

  const confirmDecision = (kind: "merchant" | "store", id: string, name: string, decision: Decision) => {
    const approving = decision === "approved";
    const subject = kind === "merchant" ? "حساب التاجر" : "المتجر";
    setConfirmation({ title: approving ? `اعتماد ${subject}` : `رفض ${subject}`, detail: approving ? `سيُعتمد ${name}. اعتماد حساب التاجر لا يعتمد فروعه تلقائيًا.` : `سيُرفض ${name}. يمكنك مراجعة بياناته قبل تنفيذ هذا القرار.`, label: approving ? "تأكيد الاعتماد" : "تأكيد الرفض", danger: !approving, onConfirm: () => void (kind === "merchant" ? updateMerchant(id, decision) : updateStore(id, decision)) });
  };

  return (
    <WorkspaceFrame title="مراجعة التجار">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <WorkspaceTitle title="مراجعة الانضمام" detail="راجع حساب التاجر وكل فرع على حدة قبل الاعتماد." />
        <View style={{ flexDirection: "row-reverse", gap: 8, marginHorizontal: 16, marginTop: 12 }}>
          {([{ key: "pending", label: "بانتظار المراجعة" }, { key: "all", label: "جميع الحسابات" }] as const).map((item) => { const active = reviewFilter === item.key; return <Pressable key={item.key} onPress={() => setReviewFilter(item.key)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primary : colors.border }}><Text style={{ color: active ? colors.surface : colors.textSecondary, fontWeight: "600" }}>{item.label}</Text></Pressable>; })}
          <Pressable accessibilityRole="button" accessibilityLabel="تحديث القائمة" onPress={() => void refresh()} disabled={loading || savingId !== null} style={{ marginStart: "auto", width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primaryLight }}><AppIcon name="refresh-outline" size={18} color={colors.primary} /></Pressable>
        </View>

        {loading && rows.length === 0 ? <Text style={{ padding: 20, textAlign: "center", color: colors.textSecondary }}>جارٍ تحميل الطلبات…</Text> : null}
        {!loading && rows.filter((merchant) => reviewFilter === "all" || merchant.approval === "pending" || merchant.stores?.some((store) => store.status === "pending")).map((merchant) => {
          const merchantBusy = savingId === merchant.id;
          const visibleStores = reviewFilter === "pending" ? merchant.stores?.filter((store) => store.status === "pending") : merchant.stores;
          return (
            <View key={merchant.id}>
              <WorkspaceCard title={merchant.legal_name || "تاجر جديد"} detail={merchant.contact_phone} icon="person-circle-outline" />
              <View style={{ flexDirection: "row-reverse", gap: 10, marginHorizontal: 16, marginTop: 8 }}>
                <WorkspaceStatus
                  label={approvalLabels[merchant.approval] ?? merchant.approval}
                  color={merchant.approval === "approved" ? colors.primary : merchant.approval === "rejected" ? colors.error : colors.accent}
                />
              </View>
              {merchant.approval === "pending" ? <>
                <WorkspaceButton title={merchantBusy ? "جارٍ الحفظ…" : "قبول حساب التاجر"} disabled={savingId !== null} onPress={() => confirmDecision("merchant", merchant.id, merchant.legal_name || "التاجر", "approved")} />
                <WorkspaceButton title="رفض الطلب" disabled={savingId !== null} onPress={() => confirmDecision("merchant", merchant.id, merchant.legal_name || "التاجر", "rejected")} danger />
              </> : null}

              {visibleStores?.map((store) => {
                const storeBusy = savingId === store.id;
                return (
                  <View key={store.id}>
                    <WorkspaceCard title={store.name} detail={`${store.address} · ${storeLabels[store.status] ?? store.status}`} icon="storefront-outline" />
                    {store.status === "pending" ? <>
                      <WorkspaceButton title={storeBusy ? "جارٍ الحفظ…" : "اعتماد هذا المتجر"} disabled={savingId !== null} onPress={() => confirmDecision("store", store.id, store.name, "approved")} />
                      <WorkspaceButton title="رفض هذا المتجر" disabled={savingId !== null} onPress={() => confirmDecision("store", store.id, store.name, "rejected")} danger />
                    </> : null}
                  </View>
                );
              })}
            </View>
          );
        })}
        {!loading && rows.filter((merchant) => reviewFilter === "all" || merchant.approval === "pending" || merchant.stores?.some((store) => store.status === "pending")).length === 0 ? <WorkspaceEmptyState icon="checkmark-circle-outline" title={reviewFilter === "pending" ? "لا توجد طلبات بانتظار المراجعة" : "لا توجد حسابات تجار بعد"} detail={reviewFilter === "pending" ? "كل طلبات الانضمام الحالية تمت مراجعتها." : "ستظهر هنا بيانات التجار فور تسجيلهم."} /> : null}
      </ScrollView>
      <WorkspaceConfirmModal visible={confirmation !== null} title={confirmation?.title ?? "تأكيد الإجراء"} detail={confirmation?.detail ?? ""} confirmLabel={confirmation?.label} danger={confirmation?.danger} busy={savingId !== null} onConfirm={() => confirmation?.onConfirm()} onCancel={() => setConfirmation(null)} />
    </WorkspaceFrame>
  );
}
