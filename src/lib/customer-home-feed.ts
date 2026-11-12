import { assertCatalogOwner } from "@/lib/public-catalog";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type CustomerHomeAd = Database["public"]["Functions"]["read_customer_home_ads"]["Returns"][number] & { url: string; mediaKey: string; thumbnailUrl?: string; thumbnailKey?: string };

export const homeAdDestinations = {
  store: "/store-details",
  product: "/product-details",
  offer: "/offer-details",
} as const;

export async function readCustomerHomeAds(owner: string | null, signal: AbortSignal) {
  await assertCatalogOwner(owner);
  const { data, error } = await supabase.rpc("read_customer_home_ads").abortSignal(signal);
  if (error) throw error;
  const rows = data ?? [];
  const expiresAt = Date.now() + 115_000;
  if (!rows.length) return { ads: [], expiresAt };
  await assertCatalogOwner(owner);
  if (signal.aborted) throw Error("Ad read cancelled");
  const paths = rows.flatMap(row => row.thumbnail_path ? [row.media_path, row.thumbnail_path] : [row.media_path]);
  const signed = await supabase.storage.from("customer-home-ads").createSignedUrls([...new Set(paths)], 120);
  await assertCatalogOwner(owner);
  if (signed.error) throw signed.error;
  const urls = new Map(signed.data.filter(row => !row.error && row.signedUrl).map(row => [row.path, row.signedUrl]));
  const ads: CustomerHomeAd[] = rows.flatMap(row => {
    const url = urls.get(row.media_path);
    return url && Object.hasOwn(homeAdDestinations, row.target_kind) ? [{
      ...row, url, mediaKey: JSON.stringify([owner, row.media_path]),
      thumbnailUrl: row.thumbnail_path ? urls.get(row.thumbnail_path) ?? undefined : undefined,
      thumbnailKey: row.thumbnail_path ? JSON.stringify([owner, row.thumbnail_path]) : undefined,
    }] : [];
  });
  if (!ads.length) throw Error("Sponsored media unavailable");
  return { ads, expiresAt };
}
