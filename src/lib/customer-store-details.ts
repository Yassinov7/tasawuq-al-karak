import { assertCatalogOwner } from "@/lib/public-catalog";
import { supabase } from "@/lib/supabase";

export type PublishedStoreVideo = { id: string; path: string };

export async function readCustomerStoreIdentity(storeId: string, owner: string | null, signal: AbortSignal) {
  await assertCatalogOwner(owner);
  if (signal.aborted) throw Error("Store read cancelled");
  const [availability, branding] = await Promise.all([
    supabase.rpc("store_accepts_new_orders", { target_store: storeId }).abortSignal(signal),
    supabase.from("store_branding_assets").select("id,storage_path")
      .eq("store_id", storeId).eq("kind", "promo_video").eq("state", "current")
      .eq("is_current", true).abortSignal(signal).maybeSingle(),
  ]);
  await assertCatalogOwner(owner);
  if (signal.aborted) throw Error("Store read cancelled");
  const acceptsOrders = availability.error ? null : availability.data;
  const video = !branding.error && branding.data
    ? { id: branding.data.id, path: branding.data.storage_path } : null;
  return { acceptsOrders, video, failed: Boolean(availability.error || branding.error) };
}

export async function signPublishedStoreVideo(asset: PublishedStoreVideo, owner: string | null, signal: AbortSignal) {
  await assertCatalogOwner(owner);
  if (signal.aborted) throw Error("Video request cancelled");
  const { data, error } = await supabase.storage.from("store-videos").createSignedUrl(asset.path, 600);
  await assertCatalogOwner(owner);
  if (signal.aborted || error || !data?.signedUrl) throw Error("Video unavailable");
  return data.signedUrl;
}
