import { getStoreMediaUrl } from "@/lib/merchant-store";
import { assertAccount } from "@/lib/personal-account";
import { supabase } from "@/lib/supabase";
import type { HomeAd } from "@/lib/customer-home-ads";

export type HomeAdTarget = { id: string; name: string; storeId: string; image?: string; unavailable?: boolean };
type Kind = HomeAd["target_kind"];

async function assertAdmin(owner: string, signal: AbortSignal) {
  await assertAccount(owner);
  const { data, error } = await supabase.rpc("is_admin").abortSignal(signal);
  await assertAccount(owner);
  if (signal.aborted || error || data !== true) throw Error("تعذر التحقق من صلاحية الإدارة.");
}

export async function readHomeAdTargets(
  owner: string,
  kind: Kind,
  { storeId, id, search = "" }: { storeId?: string; id?: string; search?: string },
  signal: AbortSignal,
): Promise<HomeAdTarget[]> {
  if (kind !== "store" && !storeId && !id) return [];
  await assertAdmin(owner, signal);
  const pattern = "%" + search.trim().replace(/[\\%_]/g, char => "\\" + char) + "%";
  const rows: HomeAdTarget[] = [];
  if (kind === "store") {
    let query = supabase.from("stores").select("id,name,status");
    query = id ? query.eq("id", id) : query.eq("status", "accepted").ilike("name", pattern);
    const { data, error } = await query.order("name").order("id").limit(20).abortSignal(signal);
    if (error) throw error;
    rows.push(...(data ?? []).map(row => ({ id: row.id, name: row.name, storeId: row.id, unavailable: row.status !== "accepted" })));
  } else if (kind === "product") {
    let query = supabase.from("products").select("id,title,store_id,is_available");
    query = id ? query.eq("id", id) : query.eq("is_available", true).ilike("title", pattern);
    if (storeId) query = query.eq("store_id", storeId);
    const { data, error } = await query.order("title").order("id").limit(20).abortSignal(signal);
    if (error) throw error;
    rows.push(...(data ?? []).map(row => ({ id: row.id, name: row.title, storeId: row.store_id, unavailable: !row.is_available })));
  } else {
    let query = supabase.from("store_offers").select("id,title,store_id,is_active,ends_at");
    query = id ? query.eq("id", id) : query.eq("is_active", true).ilike("title", pattern);
    if (storeId) query = query.eq("store_id", storeId);
    const { data, error } = await query.order("title").order("id").limit(20).abortSignal(signal);
    if (error) throw error;
    rows.push(...(data ?? []).map(row => ({ id: row.id, name: row.title, storeId: row.store_id,
      unavailable: !row.is_active || Boolean(row.ends_at && Date.parse(row.ends_at) <= Date.now()) })));
  }

  if (kind !== "store" && rows.length && !signal.aborted) {
    const offerProducts = kind === "offer"
      ? await supabase.from("store_offer_products").select("offer_id,product_id").in("offer_id", rows.map(row => row.id)).order("id").abortSignal(signal)
      : null;
    const relations = offerProducts?.data ?? [];
    const ids = kind === "product" ? rows.map(row => row.id) : [...new Set(relations.map(row => row.product_id))];
    if (ids.length && !signal.aborted) {
      const media = await supabase.from("product_media").select("product_id,storage_path")
        .eq("media_type", "image").in("product_id", ids).order("display_order").order("id").abortSignal(signal);
      const byProduct = new Map<string, string>();
      for (const item of media.data ?? []) {
        if (!byProduct.has(item.product_id)) byProduct.set(item.product_id, getStoreMediaUrl(item.storage_path));
      }
      for (const row of rows) {
        row.image = kind === "product" ? byProduct.get(row.id)
          : relations.filter(item => item.offer_id === row.id).map(item => byProduct.get(item.product_id)).find(Boolean);
      }
    }
  }
  await assertAccount(owner);
  if (signal.aborted) throw Error("أُلغي البحث.");
  return rows;
}
