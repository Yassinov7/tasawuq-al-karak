import { FinanceAccountView } from "@/components/finance/MerchantFinanceView";
import { AppHeader } from "@/components/navigation/AppHeader";
import { LoadingSkeleton } from "@/components/ui/LoadingState";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useDriverTaskRefresh } from "@/hooks/useDriverTaskRefresh";
import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { readDriverMoney, type DriverInvoiceKind, type MerchantInvoiceCursor, type MoneyOverview } from "@/lib/invoice-finance";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

const filters: readonly { kind: DriverInvoiceKind; label: string }[] = [
  { kind: "ALL", label: "الكل" },
  { kind: "DLV", label: "التوصيل" },
  { kind: "SET", label: "التسويات" },
  { kind: "COR", label: "التصحيحات" },
  { kind: "WAG", label: "الأجور الدورية" },
];

export default function DriverFinanceScreen() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title="المالية" showNotifications={false} />
    {loading ? <LoadingSkeleton cards={1} label="جارٍ التحقق من الحساب" /> :
      user ? <DriverFinance key={user.id} owner={user.id} /> : null}
  </View>;
}

function DriverFinance({ owner }: { owner: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<DriverInvoiceKind>("ALL");
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<MerchantInvoiceCursor[]>([]);
  const cursor = page ? cursors[page - 1] : undefined;
  const scope = JSON.stringify([owner, query, kind, cursor]);
  const [snapshot, setSnapshot] = useState<{ scope: string; overview: MoneyOverview; hasMore: boolean } | null>(null);
  const [failure, setFailure] = useState("");
  const [readingScope, setReadingScope] = useState("");
  const data = snapshot?.scope === scope ? snapshot : null;
  const account = snapshot?.overview;
  const reading = readingScope === scope;

  const load = useCallback(async (signal: AbortSignal) => {
    setReadingScope(scope);
    try {
      const next = await readDriverMoney(query, kind, cursor, signal);
      if (signal.aborted) return;
      if (next.overview.admin || next.overview.owner !== owner || next.overview.rows.some(row => row.owner_id !== owner)) {
        setSnapshot(null);
        setFailure(scope);
        return;
      }
      setSnapshot({ ...next, scope });
      setFailure("");
    } catch {
      if (!signal.aborted) setFailure(scope);
    } finally {
      if (!signal.aborted) setReadingScope("");
    }
  }, [cursor, kind, owner, query, scope]);
  const refresh = useDriverTaskRefresh(load, true);
  const live = useOrderRealtime({
    channelName: `money:driver:${owner}`, enabled: true, sdkManagedRecovery: true,
    subscriptions: [{ table: "money_invoices", filter: `owner_id=eq.${owner}` }, { table: "money_allocations" }],
    onChange: () => refresh("change"),
  });

  const firstPage = () => {
    setFailure("");
    setCursors([]);
    setPage(0);
  };
  const searchFor = (value: string) => {
    const normalized = value.trim();
    setSearch(normalized);
    if (page === 0 && query === normalized) { void refresh("manual"); return; }
    firstPage();
    setQuery(normalized);
  };
  const nextPage = () => {
    const last = data?.overview.rows.at(-1);
    if (!last || !data?.hasMore || reading) return;
    setFailure("");
    setCursors(previous => [...previous.slice(0, page), { createdAt: last.created_at, id: last.id }]);
    setPage(page + 1);
  };
  const error = failure === scope ? "تعذر تحميل البيانات المالية. تحقق من الاتصال ثم أعد المحاولة." : "";

  return <FinanceAccountView role="driver" filters={filters}
    account={account ?? null} data={data?.overview ?? null}
    search={search} query={query} kind={kind} page={page} hasNext={Boolean(data?.hasMore)}
    live={live} refreshing={reading} busy={false} error={error} partialError="" message="" pendingReview={null}
    onChangeSearch={setSearch} onSearch={searchFor}
    onRefresh={() => refresh("manual")}
    onKind={value => { if (value !== kind) { firstPage(); setKind(value); } }}
    onPage={next => {
      if (next === page + 1) nextPage();
      else if (next === page - 1 && next >= 0 && !reading) { setFailure(""); setPage(next); }
    }}
    onInvoice={id => router.push({ pathname: "/financial-invoice", params: { id } })} />;
}
