import { readCategoryLabels } from "@/lib/catalog-categories";
import { supabase } from "@/lib/supabase";

// Financial and subscription migrations are newer than generated app types.
// Keep this isolated bridge until database types are regenerated.
const adminClient = supabase;

type StoreRow = { id: string; merchant_id: string; name: string; phone: string; address: string; status: string; created_at: string; description?: string };
type MerchantRow = { id: string; owner_user_id: string; contact_phone: string; status: string; created_at: string };
type SubscriptionRow = { merchant_id?: string; id: string; plan_name_snapshot: string; starts_at: string | null; expires_at: string | null; commission_rate_snapshot: number | null };

export type StoreFilter = "all" | "accepted" | "pending" | "rejected";
export type AdminStoreSummary = { id: string; merchantId: string; name: string; phone: string; address: string; status: string; createdAt: string; ownerName: string | null; subscription: { planName: string; expiresAt: string | null } | null };
export type AdminStorePage = { rows: AdminStoreSummary[]; hasMore: boolean };

const cache = new Map<string, { updatedAt: number; value: AdminStorePage }>();
const ttl = 15_000;
const cacheKey = (filter: StoreFilter, page: number, search: string) => `${filter}:${page}:${search}`;

export function getCachedAdminStorePage(filter: StoreFilter, page: number, search: string) { return cache.get(cacheKey(filter, page, search)); }
export function isCachedAdminStorePageFresh(filter: StoreFilter, page: number, search: string) { const item = getCachedAdminStorePage(filter, page, search); return Boolean(item && Date.now() - item.updatedAt < ttl); }

export async function getAdminStorePage({ filter, page, search, force = false }: { filter: StoreFilter; page: number; search: string; force?: boolean }): Promise<AdminStorePage> {
  const key = cacheKey(filter, page, search);
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.updatedAt < ttl) return cached.value;
  const pageSize = 20; const from = page * pageSize; const to = from + pageSize;
  let query = adminClient.from("stores").select("id,merchant_id,name,phone,address,status,created_at").order("created_at", { ascending: false }).range(from, to);
  if (filter !== "all") query = query.eq("status", filter);
  if (search) {
    const { data: matchingProfiles } = await adminClient.from("profiles").select("id").ilike("full_name", `%${search}%`);
    const ownerIds = ((matchingProfiles ?? []) as { id: string }[]).map((profile) => profile.id);
    const { data: matchingMerchants, error: merchantSearchError } = ownerIds.length
      ? await adminClient.from("merchants").select("id").in("owner_user_id", ownerIds)
      : { data: [], error: null };
    if (merchantSearchError && __DEV__) console.warn("[admin-stores] owner search unavailable; using store name and ID search.");
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search);
    const merchantIds = ((matchingMerchants ?? []) as { id: string }[]).map((merchant) => merchant.id);
    const conditions = [`name.ilike.%${search}%`];
    if (isUuid) conditions.push(`id.eq.${search}`, `merchant_id.eq.${search}`);
    if (merchantIds.length) conditions.push(`merchant_id.in.(${merchantIds.join(",")})`);
    query = query.or(conditions.join(","));
  }
  const { data: stores, error } = await query;
  if (error) throw error;
  const rows = (stores ?? []) as StoreRow[];
  const merchantIds = rows.map((row) => row.merchant_id);
  const [{ data: merchants, error: merchantError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
    merchantIds.length ? adminClient.from("merchants").select("id,owner_user_id").in("id", merchantIds) : Promise.resolve({ data: [], error: null }),
    merchantIds.length ? adminClient.from("merchant_terms").select("merchant_id,plan_name_snapshot,expires_at").in("merchant_id", merchantIds).order("expires_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  if ((merchantError || subscriptionError) && __DEV__) console.warn("[admin-stores] optional store enrichment unavailable; showing base store rows.");
  const merchantRows = (merchants ?? []) as MerchantRow[];
  const subscriptionRows = (subscriptions ?? []) as SubscriptionRow[];
  const ownerIds = merchantRows.map((merchant) => merchant.owner_user_id);
  const { data: profiles, error: profileError } = ownerIds.length ? await adminClient.from("profiles").select("id,full_name").in("id", ownerIds) : { data: [], error: null };
  if (profileError && __DEV__) console.warn("[admin-stores] owner names unavailable; showing stores without owner names.");
  const merchantsById = new Map(merchantRows.map((merchant) => [merchant.id, merchant]));
  const profilesById = new Map(((profiles ?? []) as { id: string; full_name: string }[]).map((profile) => [profile.id, profile.full_name]));
  const subscriptionByMerchant = new Map<string, { planName: string; expiresAt: string | null }>();
  for (const subscription of subscriptionRows) if (subscription.merchant_id && !subscriptionByMerchant.has(subscription.merchant_id)) subscriptionByMerchant.set(subscription.merchant_id, { planName: subscription.plan_name_snapshot, expiresAt: subscription.expires_at });
  const value = { rows: rows.slice(0, pageSize).map((store) => ({ id: store.id, merchantId: store.merchant_id, name: store.name, phone: store.phone, address: store.address, status: store.status, createdAt: store.created_at, ownerName: profilesById.get(merchantsById.get(store.merchant_id)?.owner_user_id ?? "") ?? null, subscription: subscriptionByMerchant.get(store.merchant_id) ?? null })), hasMore: rows.length > pageSize };
  cache.set(key, { updatedAt: Date.now(), value });
  return value;
}

export async function getAdminStoreDetails(storeId: string) {
  const { data: storeData, error } = await adminClient.from("stores").select("id,merchant_id,name,description,phone,address,status,created_at,category_id").eq("id", storeId).maybeSingle();
  const store = storeData;
  if (error) throw error;
  if (!store) throw new Error("store-not-found");
  const [categoryLabels, { data: merchantData, error: merchantError }, { data: subscriptions, error: subscriptionError }, { count: productCount, error: productsError }] = await Promise.all([
    readCategoryLabels("store", [store.category_id]),
    adminClient.from("merchants").select("id,owner_user_id,contact_phone,status,created_at").eq("id", store.merchant_id).maybeSingle(),
    adminClient.from("merchant_terms").select("id,plan_name_snapshot,starts_at,expires_at,commission_rate_snapshot").eq("merchant_id", store.merchant_id).order("expires_at", { ascending: false }),
    adminClient.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
  ]);
  if (merchantError ?? subscriptionError ?? productsError) throw merchantError ?? subscriptionError ?? productsError;
  const merchant = merchantData as MerchantRow | null;
  const { data: owner, error: ownerError } = merchant?.owner_user_id ? await adminClient.from("profiles").select("full_name,email").eq("id", merchant.owner_user_id).maybeSingle() : { data: null, error: null };
  if (ownerError) throw ownerError;
  return { store, category: categoryLabels.get(store.category_id), merchant, owner: owner as { full_name: string; email: string } | null, subscription: ((subscriptions ?? []) as SubscriptionRow[])[0] ?? null, productCount: productCount ?? 0 };
}
