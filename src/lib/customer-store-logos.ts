import { supabase } from "@/lib/supabase";

export async function readCustomerStoreLogos(storeIds: string[], owner: string | null, signal: AbortSignal) {
  const verifySession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (signal.aborted || error || (data.session?.user.id ?? null) !== owner) throw Error("Store logo scope changed");
  };
  await verifySession();
  const expiresAt = Date.now() + 55_000;
  const logos = new Map<string, { url: string; key: string }>();
  let hasAssets = false;
  for (let start = 0; start < storeIds.length; start += 100) {
    const { data, error } = await supabase.from("store_branding_assets")
      .select("id,store_id,storage_path").eq("kind", "logo").eq("is_current", true)
      .eq("state", "current").in("store_id", storeIds.slice(start, start + 100)).abortSignal(signal);
    if (error) throw error;
    await verifySession();
    const assets = data ?? [];
    if (!assets.length) continue;
    hasAssets = true;
    const bucket = supabase.storage.from("store-logos");
    const signed = await bucket.createSignedUrls(assets.map(asset => asset.storage_path), 60);
    await verifySession();
    const urls = new Map((signed.data ?? []).filter(row => !row.error && row.signedUrl).map(row => [row.path, row.signedUrl]));
    await Promise.allSettled(assets.filter(asset => !urls.has(asset.storage_path)).map(async asset => {
      const result = await bucket.createSignedUrl(asset.storage_path, 60);
      if (result.data?.signedUrl) urls.set(asset.storage_path, result.data.signedUrl);
    }));
    await verifySession();
    for (const asset of assets) {
      const url = urls.get(asset.storage_path);
      if (url) logos.set(asset.store_id, { url, key: "store-logo:" + (owner ?? "guest") + ":" + asset.id });
    }
  }
  if (hasAssets && !logos.size) throw Error("Published logo URLs unavailable");
  return { logos, expiresAt };
}
