import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDriverTaskRefresh } from "@/hooks/useDriverTaskRefresh";
import { readCustomerStoreLogos } from "@/lib/customer-store-logos";

const empty = new Map<string, { url: string; key: string }>();

export function useCustomerStoreLogos(storeIds: string[], reuseOnFocus = false) {
  const { user, loading } = useAuth();
  const owner = user?.id ?? null;
  const ids = [...new Set(storeIds)].sort().join(",");
  const scope = JSON.stringify([owner, ids]);
  const [snapshot, setSnapshot] = useState<(Awaited<ReturnType<typeof readCustomerStoreLogos>> & { scope: string }) | null>(null);
  const freshness = useRef<{ scope: string; until: number } | undefined>(undefined);
  const shouldRead = useCallback(() => !reuseOnFocus || freshness.current?.scope !== scope
    || Date.now() >= freshness.current.until, [reuseOnFocus, scope]);
  const current = snapshot?.scope === scope ? snapshot : null;
  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const next = await readCustomerStoreLogos(ids.split(","), owner, signal);
      if (!signal.aborted) {
        freshness.current = { scope, until: next.expiresAt - 10_000 };
        setSnapshot({ ...next, scope });
      }
    } catch {
      // The catalog remains usable. Previously verified links expire independently.
    }
  }, [ids, owner, scope]);
  const refresh = useDriverTaskRefresh(load, !loading && Boolean(ids), shouldRead);
  useEffect(() => {
    if (!current?.logos.size || loading) return;
    const remaining = current.expiresAt - Date.now();
    const renew = setTimeout(() => void refresh("change"), Math.max(0, remaining - 10_000));
    const expire = setTimeout(() => setSnapshot(previous => previous === current ? null : previous), Math.max(0, remaining));
    return () => { clearTimeout(renew); clearTimeout(expire); };
  }, [current, loading, refresh]);

  return { logos: !loading && current ? current.logos : empty, refresh };
}
