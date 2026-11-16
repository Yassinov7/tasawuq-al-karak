import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { readStoreDirectoryPage, type DirectoryPage } from "@/lib/customer-store-directory";
import { normalizeCustomerSearchText } from "@/lib/customer-search";
import { newIdempotencyKey } from "@/lib/request-key";
import type { Store } from "@/types/catalog";

type ReadMode = "ensure" | "refresh" | "more";
type Entry = DirectoryPage & { verifiedAt: number };
type ReadStatus = { key: string; mode?: ReadMode; error?: ReadMode };

const staleAfter = 3 * 60_000;
const empty: Store[] = [];

export function useStoreDirectory(owner: string | null, enabled: boolean, input: string, categoryId: string | null) {
  const query = normalizeCustomerSearchText(input);
  const [debounced, setDebounced] = useState(query);
  const [seed] = useState(newIdempotencyKey);
  const cache = useRef(new Map<string, Entry>());
  const [entries, setEntries] = useState<ReadonlyMap<string, Entry>>(new Map());
  const [status, setStatus] = useState<ReadStatus>();
  const active = useRef<AbortController | null>(null);
  const settledQuery = query === "" ? "" : debounced;
  const key = JSON.stringify([categoryId, settledQuery]);

  useEffect(() => {
    if (query === debounced) return;
    const timer = setTimeout(() => setDebounced(query), query ? 270 : 0);
    return () => clearTimeout(timer);
  }, [query, debounced]);

  const read = useCallback(async (mode: ReadMode) => {
    if (!enabled || active.current) return;
    const previous = cache.current.get(key);
    if (mode === "ensure" && previous && Date.now() - previous.verifiedAt < staleAfter) {
      setStatus(current => current?.key === key && current.mode ? { key } : current);
      return;
    }
    if (mode === "more" && !previous?.next) return;
    const request = new AbortController();
    active.current = request;
    setStatus({ key, mode });

    try {
      let cursor = mode === "more" ? previous?.next ?? null : null;
      const stores = new Map((mode === "more" ? previous?.stores ?? [] : []).map(store => [store.id, store]));
      do {
        const page = await readStoreDirectoryPage(owner, seed, settledQuery, categoryId, cursor, request.signal);
        for (const store of page.stores) stores.set(store.id, store);
        cursor = page.next;
      } while (!request.signal.aborted && mode !== "more" && cursor && stores.size < (previous?.stores.length ?? 0));
      if (request.signal.aborted) return;

      const next = new Map(cache.current);
      next.delete(key);
      next.set(key, { stores: [...stores.values()], next: cursor, verifiedAt: mode === "more" ? previous?.verifiedAt ?? Date.now() : Date.now() });
      // Keep the unsearched listing for the current category when query caches are pruned.
      const browseKey = JSON.stringify([categoryId, ""]);
      while (next.size > 8) {
        const discard = [...next.keys()].find(candidate => candidate !== key && candidate !== browseKey);
        if (!discard) break;
        next.delete(discard);
      }
      cache.current = next;
      setEntries(next);
      setStatus({ key });
    } catch {
      if (!request.signal.aborted) setStatus({ key, error: mode });
    } finally {
      if (active.current === request) active.current = null;
    }
  }, [categoryId, enabled, key, owner, seed, settledQuery]);

  useFocusEffect(useCallback(() => {
    void read("ensure");
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") void read("ensure");
    });
    return () => {
      subscription.remove();
      active.current?.abort();
      active.current = null;
    };
  }, [read]));

  const entry = entries.get(key);
  const current = status?.key === key ? status : undefined;
  return {
    key, stores: entry?.stores ?? empty,
    loading: !entry && !current?.error,
    refreshing: current?.mode === "refresh",
    loadingMore: current?.mode === "more",
    error: current?.error,
    hasMore: Boolean(entry?.next),
    refresh: () => read("refresh"),
    loadMore: () => read("more"),
    retry: () => read(current?.error ?? "ensure"),
  };
}
