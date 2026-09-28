import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { WorkspaceFrame, WorkspaceStatus, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useTheme } from "@/context/ThemeContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";

type Currency = "SYP" | "USD";
type Invoice = {
  id: string;
  invoice_number: number;
  order_number: number;
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
  stores: { name: string } | { name: string }[] | null;
};
type Settlement = {
  id: string;
  amount: number;
  currency: Currency;
  method: string;
  reference: string | null;
  note: string;
  paid_at: string;
  merchant_settlement_allocations: { id: string; amount: number; merchant_invoices: { invoice_number: number; stores: { name: string } | { name: string }[] | null } | { invoice_number: number; stores: { name: string } | { name: string }[] | null }[] | null }[] | null;
};

const invoiceStatusLabels: Record<string, string> = { pending: "بانتظار اكتمال التوصيل", payable: "مستحقة", partially_settled: "مسددة جزئيًا", settled: "مسددة", void: "ملغاة" };
const methodLabels: Record<string, string> = { cash: "نقدًا", bank_transfer: "تحويل", other: "أخرى" };

export default function MerchantFinance() {
  const { colors } = useTheme();
  const { merchantId, stores } = useWorkspace();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!merchantId) {
      setInvoices([]);
      setSettlements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [invoiceResult, settlementResult] = await Promise.all([
      supabase.from("merchant_invoices").select("id,invoice_number,order_number,store_id,currency,items_subtotal,merchant_delivery_fee,commission_rate,commission_amount,merchant_net_amount,settled_amount,status,cash_collected,issued_at,stores(name)").eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(300),
      supabase.from("merchant_settlements").select("id,amount,currency,method,reference,note,paid_at,merchant_settlement_allocations(id,amount,merchant_invoices(invoice_number,stores(name)))").eq("merchant_id", merchantId).order("paid_at", { ascending: false }).limit(100),
    ]);
    setLoading(false);
    if (invoiceResult.error || settlementResult.error) {
      Alert.alert("تعذر تحميل الحسابات", "تحقق من اتصال الإنترنت وصلاحيات الحساب.");
      return;
    }
    setInvoices((invoiceResult.data ?? []) as unknown as Invoice[]);
    setSettlements((settlementResult.data ?? []) as unknown as Settlement[]);
  }, [merchantId]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const visibleInvoices = useMemo(() => invoices.filter((invoice) => !selectedStoreId || invoice.store_id === selectedStoreId), [invoices, selectedStoreId]);
  const balances = useMemo(() => {
    const result: Record<Currency, { due: number; ready: number; settled: number }> = {
      SYP: { due: 0, ready: 0, settled: 0 },
      USD: { due: 0, ready: 0, settled: 0 },
    };
    for (const invoice of visibleInvoices) {
      const bucket = result[invoice.currency];
      bucket.settled += Number(invoice.settled_amount);
      if (["payable", "partially_settled"].includes(invoice.status)) {
        const remaining = Math.max(0, Number(invoice.merchant_net_amount) - Number(invoice.settled_amount));
        bucket.due += remaining;
        if (invoice.cash_collected) bucket.ready += remaining;
      }
    }
    return result;
  }, [visibleInvoices]);

  const formatMoney = (amount: number, currency: Currency) => `${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency === "USD" ? "$" : "ل.س"}`;

  return (
    <WorkspaceFrame title="حسابات المتجر">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <WorkspaceTitle title="كشف الحساب" detail="تتراكم مستحقات الفواتير، وتظهر الدفعات عند تسجيل تسويتها من الإدارة." />
        {stores.length > 1 ? <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginHorizontal: 16, marginTop: 12 }}>
          <Pressable accessibilityRole="radio" accessibilityState={{ selected: selectedStoreId === null }} onPress={() => setSelectedStoreId(null)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: selectedStoreId === null ? colors.primary : colors.primaryLight }}><Text style={{ color: selectedStoreId === null ? colors.surface : colors.primary }}>كل الفروع</Text></Pressable>
          {stores.map((store) => <Pressable key={store.id} accessibilityRole="radio" accessibilityState={{ selected: selectedStoreId === store.id }} onPress={() => setSelectedStoreId(store.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: selectedStoreId === store.id ? colors.primary : colors.primaryLight }}><Text style={{ color: selectedStoreId === store.id ? colors.surface : colors.primary }}>{store.name}</Text></Pressable>)}
        </View> : null}

        <View style={{ flexDirection: "row-reverse", gap: 8, marginHorizontal: 16, marginTop: 14 }}>
          {(["SYP", "USD"] as const).map((currency) => (
            <View key={currency} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ textAlign: "right", color: colors.text, fontWeight: "700" }}>{currency}</Text>
              <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 7 }}>المتبقي للتاجر</Text>
              <Text style={{ textAlign: "right", color: colors.primary, marginTop: 2, fontWeight: "700" }}>{formatMoney(balances[currency].due, currency)}</Text>
              <Text style={{ textAlign: "right", color: colors.textMuted, marginTop: 7 }}>جاهز للتسوية</Text>
              <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 2 }}>{formatMoney(balances[currency].ready, currency)}</Text>
            </View>
          ))}
        </View>
        <Text style={{ marginHorizontal: 16, marginTop: 8, textAlign: "right", color: colors.textMuted, fontSize: 12 }}>تعرض التسوية بعد تأكيد وصول كامل قيمة الطلب النقدي إلى المنصة.</Text>

        <WorkspaceTitle title="الفواتير" detail="تُصدر فاتورة مستقلة لكل طلب فرعي بعد اكتمال توصيله." />
        {loading ? <Text style={{ textAlign: "center", padding: 18, color: colors.textSecondary }}>جارٍ تحميل الفواتير…</Text> : null}
        {!loading && visibleInvoices.map((invoice) => {
          const store = relationOne(invoice.stores);
          return (
            <View key={invoice.id} style={{ marginHorizontal: 16, marginTop: 9, padding: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10 }}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>فاتورة #{invoice.invoice_number} · طلب #{invoice.order_number}</Text>
                <WorkspaceStatus label={invoiceStatusLabels[invoice.status] ?? invoice.status} color={invoice.status === "void" ? colors.error : invoice.status === "settled" ? colors.primary : colors.accent} />
              </View>
              <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 5 }}>{store?.name ?? "المتجر"} · {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString("ar-SY") : "بانتظار اكتمال الطلب"}</Text>
              <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 5 }}>المبيعات {formatMoney(Number(invoice.items_subtotal), invoice.currency)} · العمولة {Number(invoice.commission_rate).toLocaleString("en-US")}٪ ({formatMoney(Number(invoice.commission_amount), invoice.currency)})</Text>
              {Number(invoice.merchant_delivery_fee) > 0 ? <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 3 }}>رسم توصيل متجرك {formatMoney(Number(invoice.merchant_delivery_fee), invoice.currency)}</Text> : null}
              <Text style={{ textAlign: "right", color: colors.text, marginTop: 5, fontWeight: "700" }}>صافي الفاتورة {formatMoney(Number(invoice.merchant_net_amount), invoice.currency)}</Text>
              <Text style={{ textAlign: "right", color: colors.primary, marginTop: 3 }}>المسدّد {formatMoney(Number(invoice.settled_amount), invoice.currency)} · المتبقي {formatMoney(Math.max(0, Number(invoice.merchant_net_amount) - Number(invoice.settled_amount)), invoice.currency)}</Text>
              {!invoice.cash_collected && invoice.status !== "void" ? <Text style={{ textAlign: "right", color: colors.accent, marginTop: 4 }}>تنتظر الفاتورة تأكيد تحصيل كامل المبلغ النقدي.</Text> : null}
            </View>
          );
        })}
        {!loading && visibleInvoices.length === 0 ? <Text style={{ textAlign: "center", padding: 18, color: colors.textSecondary }}>لا توجد فواتير لهذا المتجر بعد.</Text> : null}

        <WorkspaceTitle title="الدفعات المستلمة" detail="تسجل الإدارة الدفعات المنفذة وتربطها بالفواتير الأقدم أولًا." />
        {settlements.map((settlement) => (
          <View key={settlement.id} style={{ marginHorizontal: 16, marginTop: 9, padding: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10 }}>
            <Text style={{ textAlign: "right", color: colors.text, fontWeight: "700" }}>{formatMoney(Number(settlement.amount), settlement.currency)} · {methodLabels[settlement.method] ?? settlement.method}</Text>
            <Text style={{ textAlign: "right", color: colors.textSecondary, marginTop: 4 }}>{new Date(settlement.paid_at).toLocaleDateString("ar-SY")}{settlement.reference ? ` · مرجع ${settlement.reference}` : ""}</Text>
            {settlement.note ? <Text style={{ textAlign: "right", color: colors.textMuted, marginTop: 3 }}>{settlement.note}</Text> : null}
            {(settlement.merchant_settlement_allocations ?? []).map((allocation) => {
              const invoice = relationOne(allocation.merchant_invoices);
              const store = relationOne(invoice?.stores);
              return <Text key={allocation.id} style={{ textAlign: "right", color: colors.textSecondary, marginTop: 4 }}>فاتورة #{invoice?.invoice_number ?? "—"} · {store?.name ?? "متجر"} · {formatMoney(Number(allocation.amount), settlement.currency)}</Text>;
            })}
          </View>
        ))}
        {!loading && settlements.length === 0 ? <Text style={{ textAlign: "center", padding: 18, color: colors.textSecondary }}>لا توجد دفعات مسجلة بعد.</Text> : null}
      </ScrollView>
    </WorkspaceFrame>
  );
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
