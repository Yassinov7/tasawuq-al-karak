import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { WorkspaceButton, WorkspaceConfirmModal, WorkspaceEmptyState, WorkspaceField, WorkspaceFormModal, WorkspaceFrame, WorkspaceStatus, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type Currency = "SYP" | "USD";
type Source = "platform" | "driver";
type Method = "cash" | "bank_transfer" | "other";
type Collection = { id: string; amount: number; currency: Currency; source: Source; driver_id: string | null; note: string; received_at: string };
type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  payment_status: string;
  payment_method: string;
  total: number;
  currency: Currency;
  created_at: string;
  sub_orders: { id: string; status: string; assigned_driver_id: string | null; stores: { name: string } | { name: string }[] | null }[] | null;
  cash_collections: Collection[] | null;
};
type Invoice = {
  id: string;
  invoice_number: number;
  order_number: number;
  merchant_id: string;
  store_id: string;
  currency: Currency;
  items_subtotal: number;
  merchant_delivery_fee: number;
  commission_rate: number;
  commission_amount: number;
  merchant_net_amount: number;
  settled_amount: number;
  status: string;
  cash_collected: boolean;
  issued_at: string | null;
  merchants: { legal_name: string | null; contact_phone: string } | { legal_name: string | null; contact_phone: string }[] | null;
  stores: { name: string } | { name: string }[] | null;
};
type Driver = { id: string; full_name: string; is_active: boolean; approval: string };
type Account = { key: string; merchantId: string; merchantName: string; currency: Currency; outstanding: number; ready: number };
type CollectionHistory = { id: string; amount: number; currency: Currency; source: Source; note: string; received_at: string; orders: { order_number: number } | { order_number: number }[] | null; drivers: { full_name: string } | { full_name: string }[] | null };
type SettlementHistory = { id: string; amount: number; currency: Currency; method: Method; reference: string | null; note: string; paid_at: string; merchants: { legal_name: string | null } | { legal_name: string | null }[] | null };

const invoiceStatusLabels: Record<string, string> = { pending: "بانتظار اكتمال التوصيل", payable: "مستحقة", partially_settled: "مسددة جزئيًا", settled: "مسددة", void: "ملغاة" };
const sourceLabels: Record<Source, string> = { platform: "المنصة", driver: "السائق" };

export default function AdminFinance() {
  const { colors } = useTheme();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [collectionHistory, setCollectionHistory] = useState<CollectionHistory[]>([]);
  const [settlementHistory, setSettlementHistory] = useState<SettlementHistory[]>([]);
  const [selectedAccountKey, setSelectedAccountKey] = useState<string | null>(null);
  const [collectionDrafts, setCollectionDrafts] = useState<Record<string, { amount: string; source: Source; driverId: string }>>({});
  const [settlementAmount, setSettlementAmount] = useState("");
  const [selectedCollectionOrderId, setSelectedCollectionOrderId] = useState<string | null>(null);
  const [settlementReference, setSettlementReference] = useState("");
  const [settlementNote, setSettlementNote] = useState("");
  const [settlementMethod, setSettlementMethod] = useState<Method>("cash");
  const [loading, setLoading] = useState(true);
  const [savingCollectionId, setSavingCollectionId] = useState<string | null>(null);
  const [savingSettlement, setSavingSettlement] = useState(false);
  const [section, setSection] = useState<"collections" | "balances" | "invoices" | "records">("collections");
  const [confirmation, setConfirmation] = useState<{ title: string; detail: string; label: string; onConfirm: () => void } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [orderResult, invoiceResult, driverResult, collectionResult, settlementResult] = await Promise.all([
      supabase.from("orders").select("id,order_number,status,payment_status,payment_method,total,currency,created_at,sub_orders(id,status,assigned_driver_id,stores(name)),cash_collections(id,amount,source,driver_id,note,received_at)").eq("payment_method", "cash").neq("payment_status", "paid").neq("status", "cancelled").order("created_at", { ascending: false }).limit(100),
      supabase.from("merchant_invoices").select("id,invoice_number,order_number,merchant_id,store_id,currency,items_subtotal,merchant_delivery_fee,commission_rate,commission_amount,merchant_net_amount,settled_amount,status,cash_collected,issued_at,merchants(legal_name,contact_phone),stores(name)").order("created_at", { ascending: false }).limit(500),
      supabase.from("drivers").select("id,full_name,is_active,approval").eq("is_active", true).eq("approval", "approved").order("full_name"),
      supabase.from("cash_collections").select("id,amount,currency,source,note,received_at,orders(order_number),drivers(full_name)").order("received_at", { ascending: false }).limit(100),
      supabase.from("merchant_settlements").select("id,amount,currency,method,reference,note,paid_at,merchants(legal_name)").order("paid_at", { ascending: false }).limit(100),
    ]);
    setLoading(false);
    if (orderResult.error || invoiceResult.error || driverResult.error || collectionResult.error || settlementResult.error) {
      Alert.alert("تعذر تحميل الحسابات", "تحقق من تطبيق ترحيل المالية وصلاحيات الإدارة.");
      return;
    }
    setOrders((orderResult.data ?? []) as unknown as OrderRow[]);
    setInvoices((invoiceResult.data ?? []) as unknown as Invoice[]);
    setDrivers((driverResult.data ?? []) as Driver[]);
    setCollectionHistory((collectionResult.data ?? []) as unknown as CollectionHistory[]);
    setSettlementHistory((settlementResult.data ?? []) as unknown as SettlementHistory[]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const accounts = useMemo(() => {
    const grouped = new Map<string, Account>();
    for (const invoice of invoices) {
      if (invoice.status === "void") continue;
      const merchant = relationOne(invoice.merchants);
      const key = `${invoice.merchant_id}:${invoice.currency}`;
      const account = grouped.get(key) ?? { key, merchantId: invoice.merchant_id, merchantName: merchant?.legal_name || "تاجر", currency: invoice.currency, outstanding: 0, ready: 0 };
      if (["payable", "partially_settled"].includes(invoice.status)) {
        const balance = Math.max(0, Number(invoice.merchant_net_amount) - Number(invoice.settled_amount));
        account.outstanding += balance;
        if (invoice.cash_collected) account.ready += balance;
      }
      grouped.set(key, account);
    }
    return [...grouped.values()].sort((a, b) => a.merchantName.localeCompare(b.merchantName, "ar"));
  }, [invoices]);

  const selectedAccount = accounts.find((account) => account.key === selectedAccountKey) ?? null;
  const selectedCollectionOrder = orders.find((order) => order.id === selectedCollectionOrderId) ?? null;
  const formatMoney = (amount: number, currency: Currency) => `${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency === "USD" ? "$" : "ل.س"}`;

  const getDraft = (order: OrderRow) => {
    const received = (order.cash_collections ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    const remaining = Math.max(0, Number(order.total) - received);
    return collectionDrafts[order.id] ?? { amount: remaining.toFixed(2), source: "platform" as Source, driverId: "" };
  };

  const recordCollection = async (order: OrderRow) => {
    const draft = getDraft(order);
    const amount = Number(draft.amount);
    const alreadyReceived = (order.cash_collections ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    const remaining = Number(order.total) - alreadyReceived;
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      Alert.alert("مبلغ غير صالح", `أدخل مبلغًا أكبر من صفر ولا يتجاوز المتبقي ${formatMoney(remaining, order.currency)}.`);
      return;
    }
    if (draft.source === "driver" && !draft.driverId) {
      Alert.alert("اختر السائق", "حدد السائق الذي سلّم المبلغ إلى المنصة.");
      return;
    }
    setSavingCollectionId(order.id);
    const { error } = await supabase.rpc("record_cash_collection", {
      target_order: order.id,
      received_amount: amount,
      collection_source: draft.source,
      collecting_driver: draft.source === "driver" ? draft.driverId : null,
      note: null,
    });
    setSavingCollectionId(null);
    if (error) {
      Alert.alert("تعذر تسجيل المبلغ", "ربما تغير رصيد الطلب أو أن المبلغ يتجاوز المتبقي. حدّث القائمة وحاول مرة أخرى.");
      return;
    }
    setConfirmation(null);
    setCollectionDrafts((current) => { const next = { ...current }; delete next[order.id]; return next; });
    await refresh();
  };

  const createSettlement = async () => {
    if (!selectedAccount) return;
    const amount = Number(settlementAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > selectedAccount.ready) {
      Alert.alert("مبلغ التسوية غير صالح", `أدخل مبلغًا لا يتجاوز المتاح للتسوية: ${formatMoney(selectedAccount.ready, selectedAccount.currency)}.`);
      return;
    }
    setSavingSettlement(true);
    const { error } = await supabase.rpc("record_merchant_settlement", {
      target_merchant: selectedAccount.merchantId,
      target_currency: selectedAccount.currency,
      settlement_amount: amount,
      settlement_method_value: settlementMethod,
      settlement_reference: settlementReference.trim() || null,
      settlement_note: settlementNote.trim() || null,
    });
    setSavingSettlement(false);
    if (error) {
      Alert.alert("تعذر تسجيل التسوية", "تأكد من توفر فواتير مدفوعة نقدًا ولم تُسوَّ بالكامل.");
      return;
    }
    setConfirmation(null);
    setSettlementAmount("");
    setSettlementReference("");
    setSettlementNote("");
    setSelectedAccountKey(null);
    await refresh();
  };

  return (
    <WorkspaceFrame title="المالية والتسويات">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <WorkspaceTitle title="العمليات المالية" detail="سجّل التحصيل والتسويات، ثم راجع الفواتير والسجل." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
          {([{ key: "collections", label: "تحصيل النقد" }, { key: "balances", label: "أرصدة المتاجر" }, { key: "invoices", label: "الفواتير" }, { key: "records", label: "السجلات" }] as const).map((tab) => { const selected = section === tab.key; return <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setSection(tab.key)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: selected ? colors.primary : colors.surface, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}><Text style={{ color: selected ? colors.surface : colors.textSecondary, fontWeight: selected ? "700" : "500" }}>{tab.label}</Text></Pressable>; })}
        </ScrollView>
        {section === "collections" ? <>
        <WorkspaceTitle title="التحصيل النقدي" detail="بعد اكتمال توصيل الطلب، سجّل ما وصل إلى المنصة من السائق أو مباشرةً." />
        {orders.map((order) => {
          const collections = order.cash_collections ?? [];
          const received = collections.reduce((sum, item) => sum + Number(item.amount), 0);
          const remaining = Math.max(0, Number(order.total) - received);
          return (
            <View key={order.id} style={{ marginHorizontal: 16, marginTop: 10, padding: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16 }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ textAlign: "right", color: colors.text, fontWeight: "700" }}>طلب #{order.order_number}</Text>
                <WorkspaceStatus label={order.status === "delivered" ? "جاهز للتسوية" : "بانتظار التوصيل"} color={order.status === "delivered" ? colors.primary : colors.accent} />
              </View>
              <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 7 }}>الإجمالي {formatMoney(Number(order.total), order.currency)} · المستلم {formatMoney(received, order.currency)}</Text>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <Text style={{ color: colors.accent, textAlign: "right", fontWeight: "600" }}>المتبقي {formatMoney(remaining, order.currency)}</Text>
                <Pressable accessibilityRole="button" onPress={() => setSelectedCollectionOrderId(order.id)} disabled={remaining === 0 || order.status !== "delivered"} style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: remaining === 0 || order.status !== "delivered" ? colors.surfaceSecondary : colors.primaryLight }}><Text style={{ color: remaining === 0 || order.status !== "delivered" ? colors.textMuted : colors.primary, fontWeight: "600" }}>{order.status !== "delivered" ? "بانتظار اكتمال الفروع" : "تسجيل التحصيل"}</Text></Pressable>
              </View>
            </View>
          );
        })}
        {loading ? <Text style={{ textAlign: "center", padding: 18, color: colors.textSecondary }}>جارٍ تحميل التحصيلات…</Text> : null}
        {!loading && orders.length === 0 ? <WorkspaceEmptyState icon="cash-outline" title="لا توجد تحصيلات معلقة" detail="ستظهر هنا الطلبات النقدية بعد اكتمال توصيلها." /> : null}
        </> : null}
        {section === "balances" ? <>
        <WorkspaceTitle title="أرصدة المتاجر" detail="المستحق يبقى متراكمًا حتى تسجيل تسوية فعلية." />
        {accounts.map((account) => (
          <Pressable key={account.key} accessibilityRole="button" onPress={() => { setSelectedAccountKey(account.key); setSettlementAmount(account.ready > 0 ? account.ready.toFixed(2) : ""); }} style={{ marginHorizontal: 16, marginTop: 10, padding: 12, backgroundColor: selectedAccountKey === account.key ? colors.primaryLight : colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12 }}>
            <Text style={{ color: colors.text, textAlign: "right", fontWeight: "700" }}>{account.merchantName}</Text>
            <Text style={{ color: colors.textSecondary, textAlign: "right", marginTop: 5 }}>{account.currency} · إجمالي المستحق {formatMoney(account.outstanding, account.currency)}</Text>
            <Text style={{ color: colors.primary, textAlign: "right", marginTop: 3 }}>المتاح للتسوية بعد تحصيل النقد {formatMoney(account.ready, account.currency)}</Text>
          </Pressable>
        ))}
        {!loading && accounts.length === 0 ? <WorkspaceEmptyState icon="wallet-outline" title="لا توجد أرصدة مستحقة" detail="ستظهر أرصدة المتاجر بعد اكتمال طلبات المتاجر." /> : null}

        </> : null}
        {section === "invoices" ? <>
        <WorkspaceTitle title="الفواتير" detail="كل طلب فرعي لمتجر يصدر فاتورة مستقلة بعد إتمام توصيله." />
        {invoices.map((invoice) => {
          const merchant = relationOne(invoice.merchants);
          const store = relationOne(invoice.stores);
          return (
            <View key={invoice.id} style={{ marginHorizontal: 16, marginTop: 9, padding: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10 }}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>فاتورة #{invoice.invoice_number} · طلب #{invoice.order_number}</Text>
                <WorkspaceStatus label={invoiceStatusLabels[invoice.status] ?? invoice.status} color={invoice.status === "void" ? colors.error : invoice.status === "settled" ? colors.primary : colors.accent} />
              </View>
              <Text style={{ color: colors.textSecondary, textAlign: "right", marginTop: 6 }}>{merchant?.legal_name || "تاجر"} · {store?.name ?? "متجر"}</Text>
              <Text style={{ color: colors.textSecondary, textAlign: "right", marginTop: 4 }}>المبيعات {formatMoney(Number(invoice.items_subtotal), invoice.currency)} · عمولة {Number(invoice.commission_rate).toLocaleString("en-US")}٪ ({formatMoney(Number(invoice.commission_amount), invoice.currency)})</Text>
              {Number(invoice.merchant_delivery_fee) > 0 ? <Text style={{ color: colors.textSecondary, textAlign: "right", marginTop: 3 }}>توصيل المتجر {formatMoney(Number(invoice.merchant_delivery_fee), invoice.currency)}</Text> : null}
              <Text style={{ color: colors.text, textAlign: "right", marginTop: 4, fontWeight: "600" }}>صافي التاجر {formatMoney(Number(invoice.merchant_net_amount), invoice.currency)} · المسدد {formatMoney(Number(invoice.settled_amount), invoice.currency)}</Text>
              {!invoice.cash_collected && invoice.status !== "void" ? <Text style={{ color: colors.accent, textAlign: "right", marginTop: 4 }}>التسوية متوقفة حتى استلام كامل نقد الطلب.</Text> : null}
            </View>
          );
        })}
        {!loading && invoices.length === 0 ? <WorkspaceEmptyState icon="document-text-outline" title="لا توجد فواتير حتى الآن" detail="تظهر الفاتورة هنا بعد إنشاء طلب متجر." /> : null}
        </> : null}
        {section === "records" ? <>
        <WorkspaceTitle title="سجل استلام النقد" detail="آخر مبالغ سُلّمت من السائقين أو جُمعت مباشرةً للمنصة." />
        {collectionHistory.map((item) => {
          const order = relationOne(item.orders);
          const driver = relationOne(item.drivers);
          return <View key={item.id} style={{ marginHorizontal: 16, marginTop: 8, padding: 11, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10 }}>
            <Text style={{ textAlign: "right", color: colors.text, fontWeight: "600" }}>طلب #{order?.order_number ?? "—"} · {formatMoney(Number(item.amount), item.currency)}</Text>
            <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 4 }}>{item.source === "driver" ? `استلمه من السائق ${driver?.full_name ?? "غير معروف"}` : "استلام مباشر للمنصة"} · {new Date(item.received_at).toLocaleString("ar-SY")}</Text>
            {item.note ? <Text style={{ textAlign: "right", color: colors.textMuted, marginTop: 3 }}>{item.note}</Text> : null}
          </View>;
        })}
        {!loading && collectionHistory.length === 0 ? <WorkspaceEmptyState icon="cash-outline" title="لا توجد عمليات استلام مسجلة" detail="سيظهر سجل التحصيل هنا فور تسجيل أول مبلغ." /> : null}

        <WorkspaceTitle title="سجل تسويات المتاجر" detail="الدفعات المسجلة فعليًا للتجار." />
        {settlementHistory.map((item) => {
          const merchant = relationOne(item.merchants);
          const methodLabel = item.method === "bank_transfer" ? "تحويل" : item.method === "cash" ? "نقدًا" : "أخرى";
          return <View key={item.id} style={{ marginHorizontal: 16, marginTop: 8, padding: 11, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10 }}>
            <Text style={{ textAlign: "right", color: colors.text, fontWeight: "600" }}>{merchant?.legal_name || "تاجر"} · {formatMoney(Number(item.amount), item.currency)}</Text>
            <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 4 }}>{methodLabel} · {new Date(item.paid_at).toLocaleString("ar-SY")}{item.reference ? ` · مرجع ${item.reference}` : ""}</Text>
            {item.note ? <Text style={{ textAlign: "right", color: colors.textMuted, marginTop: 3 }}>{item.note}</Text> : null}
          </View>;
        })}
        {!loading && settlementHistory.length === 0 ? <WorkspaceEmptyState icon="wallet-outline" title="لا توجد تسويات مسجلة" detail="سيظهر سجل الدفعات هنا بعد تنفيذ أول تسوية." /> : null}
        </> : null}
      </ScrollView>
      <WorkspaceFormModal visible={selectedCollectionOrder !== null} title={selectedCollectionOrder ? `تحصيل طلب #${selectedCollectionOrder.order_number}` : "تسجيل التحصيل"} detail={selectedCollectionOrder ? `المتبقي ${formatMoney(Math.max(0, Number(selectedCollectionOrder.total) - (selectedCollectionOrder.cash_collections ?? []).reduce((sum, item) => sum + Number(item.amount), 0)), selectedCollectionOrder.currency)}.` : undefined} onClose={() => setSelectedCollectionOrderId(null)}>
        {selectedCollectionOrder ? (() => { const order = selectedCollectionOrder; const draft = getDraft(order); const assignedDrivers = drivers.filter((driver) => (order.sub_orders ?? []).some((subOrder) => subOrder.assigned_driver_id === driver.id)); return <>
          <WorkspaceField label="المبلغ المستلم الآن" value={draft.amount} onChangeText={(value) => setCollectionDrafts((current) => ({ ...current, [order.id]: { ...draft, amount: value } }))} keyboardType="numeric" />
          <Text style={{ marginHorizontal: 16, marginTop: 14, textAlign: "right", color: colors.text, fontWeight: "600" }}>مصدر الاستلام</Text>
          <View style={{ flexDirection: "row-reverse", gap: 8, marginHorizontal: 16, marginTop: 8 }}>{(["platform", "driver"] as const).map((source) => { const selected = draft.source === source; return <Pressable key={source} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setCollectionDrafts((current) => ({ ...current, [order.id]: { ...draft, source, driverId: source === "platform" ? "" : draft.driverId } }))} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: selected ? colors.primary : colors.primaryLight }}><Text style={{ color: selected ? colors.surface : colors.primary }}>{sourceLabels[source]}</Text></Pressable>; })}</View>
          {draft.source === "driver" ? assignedDrivers.length ? <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginHorizontal: 16, marginTop: 12 }}>{assignedDrivers.map((driver) => <Pressable key={driver.id} accessibilityRole="radio" accessibilityState={{ selected: draft.driverId === driver.id }} onPress={() => setCollectionDrafts((current) => ({ ...current, [order.id]: { ...draft, driverId: driver.id } }))} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18, backgroundColor: draft.driverId === driver.id ? colors.accentLight : colors.surface, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text }}>{driver.full_name}</Text></Pressable>)}</View> : <WorkspaceEmptyState icon="bicycle-outline" title="لا يوجد سائق مسند" detail="يمكنك تسجيل المبلغ كاستلام مباشر من المنصة." /> : null}
          <WorkspaceButton title={savingCollectionId === order.id ? "جارٍ التسجيل…" : "متابعة لتأكيد الاستلام"} onPress={() => { const amount = Number(draft.amount); setConfirmation({ title: "تأكيد استلام النقد", detail: `${formatMoney(amount, order.currency)} لطلب #${order.order_number} · ${draft.source === "driver" ? `المستلم من ${assignedDrivers.find((driver) => driver.id === draft.driverId)?.full_name ?? "السائق"}` : "استلام مباشر للمنصة"}.`, label: "تسجيل الاستلام", onConfirm: () => void recordCollection(order) }); }} disabled={loading || savingCollectionId !== null} />
        </>; })() : null}
      </WorkspaceFormModal>
      <WorkspaceFormModal visible={selectedAccount !== null} title={selectedAccount ? `تسوية ${selectedAccount.merchantName}` : "تسوية متجر"} detail={selectedAccount ? `المتاح الآن ${formatMoney(selectedAccount.ready, selectedAccount.currency)}. سيُوزع الدفع على أقدم الفواتير المؤهلة.` : undefined} onClose={() => setSelectedAccountKey(null)}>
        {selectedAccount ? <>
          <WorkspaceField label="مبلغ الدفعة للتاجر" value={settlementAmount} onChangeText={setSettlementAmount} keyboardType="numeric" />
          <Text style={{ marginHorizontal: 16, marginTop: 14, textAlign: "right", color: colors.text, fontWeight: "600" }}>طريقة الدفع</Text>
          <View style={{ flexDirection: "row-reverse", gap: 8, marginHorizontal: 16, marginTop: 8 }}>{([{ key: "cash", label: "نقدًا" }, { key: "bank_transfer", label: "تحويل" }, { key: "other", label: "أخرى" }] as const).map((method) => { const selected = settlementMethod === method.key; return <Pressable key={method.key} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setSettlementMethod(method.key)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: selected ? colors.primary : colors.primaryLight }}><Text style={{ color: selected ? colors.surface : colors.primary }}>{method.label}</Text></Pressable>; })}</View>
          <WorkspaceField label="رقم مرجعي (اختياري)" value={settlementReference} onChangeText={setSettlementReference} />
          <WorkspaceField label="ملاحظة (اختياري)" value={settlementNote} onChangeText={setSettlementNote} />
          <WorkspaceButton title={savingSettlement ? "جارٍ تسجيل التسوية…" : "متابعة لتأكيد الدفعة"} onPress={() => setConfirmation({ title: "تأكيد تسوية التاجر", detail: `سيُسجل دفع ${formatMoney(Number(settlementAmount), selectedAccount.currency)} إلى ${selectedAccount.merchantName} بطريقة ${settlementMethod === "bank_transfer" ? "التحويل" : settlementMethod === "cash" ? "النقد" : "أخرى"}، ويُوزع على أقدم الفواتير المستحقة.`, label: "تأكيد تسجيل الدفعة", onConfirm: () => void createSettlement() })} disabled={loading || savingSettlement || selectedAccount.ready <= 0} />
        </> : null}
      </WorkspaceFormModal>
      <WorkspaceConfirmModal visible={confirmation !== null} title={confirmation?.title ?? "تأكيد الإجراء"} detail={confirmation?.detail ?? ""} confirmLabel={confirmation?.label} busy={savingCollectionId !== null || savingSettlement} onConfirm={() => confirmation?.onConfirm()} onCancel={() => setConfirmation(null)} />
    </WorkspaceFrame>
  );
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
