import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { readProductDirectoryPage, type ProductDirectoryPage } from "@/lib/customer-product-directory";
import { normalizeCustomerSearchText, type ProductSort } from "@/lib/customer-search";
import { newIdempotencyKey } from "@/lib/request-key";
import type { Product } from "@/types/catalog";

type Mode = "ensure" | "refresh" | "more";
type Entry = ProductDirectoryPage & { verifiedAt: number };
type Status = { key: string; mode?: Mode; error?: Mode };
const empty: Product[] = [];
const staleAfter = 3 * 60_000;

export function useProductDirectory(owner: string | null, enabled: boolean, input: string, categoryId: string | null, sort: ProductSort) {
  const query = normalizeCustomerSearchText(input);
  const [debounced, setDebounced] = useState(query);
  const [seed] = useState(newIdempotencyKey);
  const cache = useRef(new Map<string, Entry>());
  const [entries, setEntries] = useState<ReadonlyMap<string, Entry>>(new Map());
  const [status, setStatus] = useState<Status>();
  const active = useRef<AbortController | null>(null);
  const settled = query === "" ? "" : debounced;
  const key = JSON.stringify([categoryId, sort, settled]);

  useEffect(() => {
    if (query === debounced) return;
    const timer = setTimeout(() => setDebounced(query), query ? 270 : 0);
    return () => clearTimeout(timer);
  }, [debounced, query]);

  const read = useCallback(async (mode: Mode) => {
    if (!enabled || active.current) return;
    const previous = cache.current.get(key);
    if (mode === "ensure" && previous && Date.now() - previous.verifiedAt < staleAfter) return;
    if (mode === "more" && !previous?.next) return;
    const request = new AbortController();
    active.current = request;
    setStatus({ key, mode });
    try {
      const page = await readProductDirectoryPage(owner, seed, settled, categoryId, sort,
        mode === "more" ? previous?.next ?? null : null, request.signal);
      if (request.signal.aborted) return;
      const products = new Map((mode === "more" ? previous?.products ?? [] : []).map(product => [product.id, product]));
      page.products.forEach(product => products.set(product.id, product));
      const storeNames = new Map(mode === "more" ? previous?.storeNames ?? [] : []);
      page.storeNames.forEach((name, id) => storeNames.set(id, name));
      const next = new Map(cache.current);
      next.delete(key);
      next.set(key, { products: [...products.values()], storeNames, next: page.next,
        verifiedAt: mode === "more" ? previous?.verifiedAt ?? Date.now() : Date.now() });
      while (next.size > 8) next.delete(next.keys().next().value ?? "");
      cache.current = next;
      setEntries(next);
      setStatus({ key });
    } catch {
      if (!request.signal.aborted) setStatus({ key, error: mode });
    } finally {
      if (active.current === request) active.current = null;
    }
  }, [categoryId, enabled, key, owner, seed, settled, sort]);

  useFocusEffect(useCallback(() => {
    void read("ensure");
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void read("ensure"); });
    return () => { subscription.remove(); active.current?.abort(); active.current = null; };
  }, [read]));

  const entry = entries.get(key);
  const current = status?.key === key ? status : undefined;
  return { key, products: entry?.products ?? empty, storeNames: entry?.storeNames ?? new Map<string, string>(),
    loading: !entry && !current?.error, refreshing: current?.mode === "refresh", loadingMore: current?.mode === "more",
    error: current?.error, hasMore: Boolean(entry?.next), refresh: () => read("refresh"), loadMore: () => read("more"),
    retry: () => read(current?.error ?? "ensure") };
}
