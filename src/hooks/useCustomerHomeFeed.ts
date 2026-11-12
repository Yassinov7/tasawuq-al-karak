import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toCatalogState } from "@/context/CustomerCatalogContext";
import { useDriverTaskRefresh } from "@/hooks/useDriverTaskRefresh";
import { readCustomerHomeAds } from "@/lib/customer-home-feed";
import { readHomeDiscovery, type DiscoveryShelf } from "@/lib/public-catalog";
import { newIdempotencyKey } from "@/lib/request-key";

export function useCustomerHomeFeed() {
  const { user, loading } = useAuth();
  const owner = user?.id ?? null;
  const discoveryFresh = useRef(0);
  const adsFresh = useRef(0);
  const shouldReadDiscovery = useCallback(() => Date.now() >= discoveryFresh.current, []);
  const shouldReadAds = useCallback(() => Date.now() >= adsFresh.current, []);
  const [seed] = useState(newIdempotencyKey);
  type ShelfSnapshot = { owner: string | null; data?: ReturnType<typeof toCatalogState>; failed: boolean };
  const [shelves, setShelves] = useState<Partial<Record<DiscoveryShelf, ShelfSnapshot>>>({});
  const [adSnapshot, setAdSnapshot] = useState<(Awaited<ReturnType<typeof readCustomerHomeAds>> & { owner: string | null })>();
  const loadDiscovery = useCallback(async (signal: AbortSignal) => {
    let incomplete = false;
    const apply = (shelf: DiscoveryShelf, data: Parameters<typeof toCatalogState>[0] | null, mediaPending = false) => {
      if (signal.aborted) return;
      if (!data) incomplete = true;
      const next = data ? toCatalogState(data) : undefined;
      setShelves(previous => {
        const retained = previous[shelf]?.owner === owner ? previous[shelf]?.data : undefined;
        const oldMedia = new Map(retained?.products.map(product => [product.id, product.media]));
        const rows = next && mediaPending ? { ...next, products: next.products.map(product => ({
          ...product, media: oldMedia.get(product.id) ?? product.media,
        })) } : next;
        return { ...previous, [shelf]: { owner, failed: !data, data: rows ?? retained } };
      });
    };
    try {
      await readHomeDiscovery(owner, seed, signal, apply);
      if (!signal.aborted) discoveryFresh.current = incomplete ? 0 : Date.now() + 90_000;
    } catch {
      if (!signal.aborted) discoveryFresh.current = 0;
      apply("stores", null);
      apply("products", null);
    }
  }, [owner, seed]);
  const loadAds = useCallback(async (signal: AbortSignal) => {
    try {
      const next = await readCustomerHomeAds(owner, signal);
      if (!signal.aborted) {
        const ads = next.ads.filter(ad => Date.parse(ad.ends_at) > Date.now());
        adsFresh.current = ads.length
          ? Math.min(next.expiresAt - 15_000, ...ads.map(ad => Date.parse(ad.ends_at)))
          : Date.now() + 30_000;
        setAdSnapshot({ ...next, owner, ads });
      }
    } catch {
      // The last authorized selection remains visible until its scheduled expiry.
    }
  }, [owner]);
  const refreshDiscovery = useDriverTaskRefresh(loadDiscovery, !loading, shouldReadDiscovery);
  const refreshAds = useDriverTaskRefresh(loadAds, !loading, shouldReadAds);
  const currentAds = !loading && adSnapshot?.owner === owner ? adSnapshot : undefined;

  useEffect(() => {
    if (!currentAds?.ads.length) return;
    const now = Date.now();
    const end = Math.min(...currentAds.ads.map(ad => Date.parse(ad.ends_at)));
    const expires = Math.min(end, currentAds.expiresAt);
    const renew = setTimeout(() => void refreshAds("change"), Math.max(0, Math.min(end, currentAds.expiresAt - 15_000) - now));
    const expire = setTimeout(() => setAdSnapshot(previous => {
      if (previous !== currentAds) return previous;
      if (currentAds.expiresAt <= Date.now()) return undefined;
      return { ...currentAds, ads: currentAds.ads.filter(ad => Date.parse(ad.ends_at) > Date.now()) };
    }), Math.max(0, expires - now));
    return () => { clearTimeout(renew); clearTimeout(expire); };
  }, [currentAds, refreshAds]);

  const current = (shelf: DiscoveryShelf) => !loading && shelves[shelf]?.owner === owner ? shelves[shelf] : undefined;
  return {
    ads: currentAds?.ads ?? [],
    storeShelf: current("stores"),
    productShelf: current("products"),
    refreshAds,
    refreshDiscovery,
  };
}
