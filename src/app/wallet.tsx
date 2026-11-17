import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { FinancialAmount, FinancialFeedback, FinancialSection } from "@/components/finance/FinancialParts";
import { InvoiceStatus } from "@/components/finance/InvoiceStatus";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { DocumentReference } from "@/components/ui/DocumentReference";
import { LoadingSkeleton } from "@/components/ui/LoadingState";
import { MaxContentWidth, RtlText, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { getAccountRoute, type AccountRoute } from "@/lib/account-routing";
import { readCustomerInvoices, readDriverMoney, readMerchantMoney, readMoney, type MoneyInvoice, type MoneyOverview } from "@/lib/invoice-finance";
import { financialAccountDestination, financialDocumentTitle } from "@/lib/shared-financial-presentation";

type Snapshot = { account: AccountRoute; overview?: MoneyOverview; rows: MoneyInvoice[]; readAt: number };

export default function WalletRoute() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  if (user && !loading) return <AccountEntry key={user.id} owner={user.id} />;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title="الحساب المالي" showBack showNotifications={false} />
    <View style={{ padding: Spacing.four }}>
      {loading ? <LoadingSkeleton cards={1} /> : <AppButton title="تسجيل الدخول" onPress={() => router.replace("/login")} />}
    </View>
  </View>;
}

function AccountEntry({ owner }: { owner: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (pending.current) return;
    const request = new AbortController();
    pending.current = request;
    const { signal } = request;
    setLoading(true);
    try {
      const account = await getAccountRoute(owner);
      if (signal.aborted) return;
      setSnapshot(previous => previous?.account === account ? previous : undefined);
      const destination = financialAccountDestination(account);
      const overview = account === "/merchant" ? (await readMerchantMoney("", "ALL", undefined, signal)).overview
        : account === "/driver" ? (await readDriverMoney("", "ALL", undefined, signal)).overview
          : account === "/admin" ? await readMoney("", 0, undefined, signal) : undefined;
      const rows = account === "/home" ? (await readCustomerInvoices("", "ALL", undefined, signal)).rows : overview?.rows ?? [];
      if (signal.aborted) return;
      if ((overview && (overview.owner !== owner || overview.admin !== (account === "/admin"))) ||
          (account !== "/admin" && rows.some(row => row.owner_id !== owner))) {
        setSnapshot(undefined);
        throw Error("Account scope changed");
      }
      setSnapshot({ account, overview, rows: destination ? rows.slice(0, 3) : [], readAt: Date.now() });
      setError("");
    } catch {
      if (!signal.aborted) setError("تعذر تحديث الحساب المالي. تحقق من الاتصال وأعد المحاولة.");
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setLoading(false);
      }
    }
  }, [owner]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => {
      const request = pending.current;
      pending.current = null;
      request?.abort();
    };
  }, [load]));
  const admin = snapshot?.account === "/admin";
  const driver = snapshot?.account === "/driver";
  const merchant = snapshot?.account === "/merchant";
  useOrderRealtime({
    channelName: `wallet:${owner}`,
    enabled: !!snapshot && !!financialAccountDestination(snapshot.account),
    subscriptions: [
      { table: "money_invoices", filter: admin ? undefined : `owner_id=eq.${owner}` },
      { table: "money_allocations" },
    ],
    onChange: load,
  });
  const destination = snapshot && financialAccountDestination(snapshot.account);
  const overview = snapshot?.overview;
  const title = admin ? "مالية المنصة" : driver ? "التحصيل والأجر" : merchant ? "مالية المتجر" : "فواتير طلباتي";
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title="الحساب المالي" showBack onBack={() => router.canGoBack() ? router.back() : router.replace(snapshot?.account ?? "/")} showNotifications={false} />
    <ScrollView contentContainerStyle={{ width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: Spacing.four, gap: Spacing.three }}>
      {!snapshot && loading ? <LoadingSkeleton cards={1} label="جارٍ تحميل الحساب المالي" /> : null}
      {error ? <FinancialFeedback error message={snapshot ? `تظهر آخر قراءة ناجحة. ${error}` : error} /> : null}
      {snapshot && !destination ? <FinancialFeedback message="الحساب المالي غير متاح في حالة حسابك الحالية." /> : null}
      {snapshot && destination ? <>
        <FinancialSection title={title}>
          {overview?.account_reference ? <DocumentReference value={overview.account_reference} /> : null}
          {admin && overview?.cash != null ? <FinancialAmount label="نقد الخزينة الفعلي" amount={overview.cash} /> : null}
          {overview ? <>
            <FinancialAmount label={admin ? "مستحق للأطراف" : driver ? "مستحق لك لدى المنصة" : "مستحق لمتجرك"} amount={overview.payable} />
            <FinancialAmount label={admin ? "مطلوب من الأطراف للمنصة" : "عليك للمنصة"} amount={overview.receivable} />
            {driver ? <FinancialAmount label="تحصيل العملاء الواجب تسليمه كاملًا" amount={overview.collection_due} /> : null}
            {merchant ? <FinancialAmount label="اشتراكات غير مسددة" amount={overview.subscription_due} /> : null}
          </> : <Text style={{ ...Typography.body, ...RtlText, color: colors.textSecondary }}>تابع فواتير مشترياتك والمستندات المرتبطة بها.</Text>}
          <AppButton compact title={admin ? "فتح الخزينة والحسابات" : driver ? "فتح التحصيل والفواتير" : merchant ? "فتح مالية المتجر" : "فتح فواتيري"}
            onPress={() => router.push(destination)} />
        </FinancialSection>
        <FinancialSection title="أحدث المستندات">
          {snapshot.rows.map(row => <View key={row.id} style={{ gap: Spacing.one, borderBottomWidth: 1, borderColor: colors.borderSubtle, paddingBottom: Spacing.two }}>
            <DocumentReference value={row.reference} />
            <FinancialAmount label={financialDocumentTitle(row.kind)} amount={row.amount} />
            <InvoiceStatus invoice={row} />
            <AppButton compact fullWidth={false} title="فتح المستند" accessibilityLabel={`فتح المستند ${row.reference}`} variant="outline"
              onPress={() => router.push({ pathname: "/financial-invoice", params: { id: row.id } })} />
          </View>)}
          {!snapshot.rows.length ? <Text style={{ ...Typography.body, ...RtlText, color: colors.textSecondary }}>لا توجد مستندات مالية للعرض.</Text> : null}
        </FinancialSection>
        <Text style={{ ...Typography.caption, ...RtlText, color: colors.textSecondary }}>
          آخر قراءة ناجحة · {new Date(snapshot.readAt).toLocaleString("ar-SY")}
        </Text>
      </> : null}
      {snapshot || error ? <AppButton compact fullWidth={false} title={error ? "إعادة المحاولة" : "تحديث الحساب"} variant="outline" loading={loading} onPress={() => void load()} /> : null}
    </ScrollView>
  </View>;
}
