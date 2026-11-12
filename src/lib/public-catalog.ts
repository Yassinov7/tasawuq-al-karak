import { readSelectableCategories, type SelectableCategory } from "@/lib/catalog-categories";
import type { Tables } from "@/types/database";

import {
    invalidateLocalCache,
    peekLocalCache,
    readLocalCache,
    writeLocalCache,
} from "@/lib/local-cache";
import { supabase } from "@/lib/supabase";

export type PublicStore = Tables<"stores">;
export type PublicProduct = Tables<"products">;
export type PublicOffer = Tables<"store_offers">;
export type PublicOfferItem = Tables<"store_offer_products">;
export type PublicProductMedia = Tables<"product_media">;

type PublicCatalogCache = {
  stores: PublicStore[];
  storeCategories: SelectableCategory[];
  productCategories: SelectableCategory[];
  products: PublicProduct[];
  offers: PublicOffer[];
  offerItems: PublicOfferItem[];
  productMedia: PublicProductMedia[];
};

const cacheKey = (owner: string | null) => `public-catalog:central-v2:${owner ?? "guest"}`;
let lastCacheKey: string | null = null;

let catalogVersion = 0;
export const invalidatePublicCatalog = (owner?: string | null) => {
  catalogVersion += 1;
  const key = owner === undefined ? lastCacheKey : cacheKey(owner);
  return key ? invalidateLocalCache(key) : Promise.resolve();
};

export type PublicCatalog = PublicCatalogCache;

export async function readCatalogCategoryChoices() {
  const [storeCategories, productCategories] = await Promise.all([
    readSelectableCategories("store"), readSelectableCategories("product"),
  ]);
  return { storeCategories, productCategories };
}

async function fetchAcceptedStores(): Promise<PublicStore[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("status", "accepted")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

async function fetchAvailableProducts(
  acceptedStoreIds: string[],
): Promise<PublicProduct[]> {
  if (acceptedStoreIds.length === 0) return [];

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_available", true)
    .in("store_id", acceptedStoreIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

async function fetchActiveOffers(
  acceptedStoreIds: string[],
): Promise<PublicOffer[]> {
  if (acceptedStoreIds.length === 0) return [];

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("store_offers")
    .select("*")
    .eq("is_active", true)
    .in("store_id", acceptedStoreIds)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("starts_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

async function fetchOfferItems(offers: PublicOffer[]): Promise<PublicOfferItem[]> {
  if (offers.length === 0) return [];

  const { data, error } = await supabase
    .from("store_offer_products")
    .select("*")
    .in("offer_id", offers.map((offer) => offer.id))
    .order("id", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

async function fetchProductMedia(products: PublicProduct[], signal?: AbortSignal): Promise<PublicProductMedia[]> {
  if (products.length === 0) return [];

  const query = supabase
    .from("product_media")
    .select("*")
    .in("product_id", products.map((product) => product.id))
    .order("display_order", { ascending: true });
  const { data, error } = await (signal ? query.abortSignal(signal) : query);

  if (error) throw error;

  return data ?? [];
}

export async function assertCatalogOwner(owner: string | null) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if ((data.session?.user.id ?? null) !== owner) throw new Error("تغير الحساب أثناء تحديث السوق.");
}

export type DiscoveryShelf = "stores" | "products";

export async function readHomeDiscovery(
  owner: string | null, seed: string, signal: AbortSignal,
  onShelf?: (shelf: DiscoveryShelf, catalog: PublicCatalog | null, mediaPending?: boolean) => void,
): Promise<PublicCatalog> {
  await assertCatalogOwner(owner);
  const result = await supabase.rpc("read_customer_home_discovery", { seed_value: seed }).abortSignal(signal);
  if (result.error) throw result.error;
  const payload = result.data;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw Error("Invalid discovery response");
  const ids = (value: unknown) => {
    if (!Array.isArray(value) || !value.every(id => typeof id === "string")) throw Error("Invalid discovery identifiers");
    return [...new Set<string>(value)];
  };
  const storeIds = ids(payload.store_ids);
  const productIds = ids(payload.product_ids);
  const order = <T extends { id: string }>(keys: string[], rows: T[]) => {
    const byId = new Map(rows.map(row => [row.id, row]));
    return keys.flatMap(id => byId.get(id) ?? []);
  };
  const empty: PublicCatalog = { stores: [], products: [], productMedia: [],
    storeCategories: [], productCategories: [], offers: [], offerItems: [] };

  async function publish(shelf: DiscoveryShelf, read: () => Promise<Partial<PublicCatalog>>) {
    try {
      const catalog = { ...empty, ...await read() };
      await assertCatalogOwner(owner);
      if (signal.aborted) throw Error("Discovery cancelled");
      onShelf?.(shelf, catalog);
      return catalog;
    } catch (cause) {
      if (!signal.aborted) onShelf?.(shelf, null);
      throw cause;
    }
  }

  const [stores, products] = await Promise.allSettled([
    publish("stores", async () => {
      if (!storeIds.length) return {};
      const result = await supabase.from("stores").select("*").eq("status", "accepted")
        .in("id", storeIds).abortSignal(signal);
      if (result.error) throw result.error;
      return { stores: order(storeIds, result.data ?? []) };
    }),
    publish("products", async () => {
      if (!productIds.length) return {};
      const result = await supabase.from("products").select("*").eq("is_available", true)
        .in("id", productIds).abortSignal(signal);
      if (result.error) throw result.error;
      const products = order(productIds, result.data ?? []);
      await assertCatalogOwner(owner);
      if (signal.aborted) throw Error("Discovery cancelled");
      onShelf?.("products", { ...empty, products }, true);
      const productMedia = await fetchProductMedia(products, signal);
      return { products, productMedia };
    }),
  ]);
  if (stores.status === "rejected" && !onShelf) throw stores.reason;
  if (products.status === "rejected" && !onShelf) throw products.reason;
  return { ...empty, stores: stores.status === "fulfilled" ? stores.value.stores : [],
    products: products.status === "fulfilled" ? products.value.products : [],
    productMedia: products.status === "fulfilled" ? products.value.productMedia : [] };
}

type CatalogCallbacks = {
  categories?: (choices: Awaited<ReturnType<typeof readCatalogCategoryChoices>> | null) => void;
  offers?: (market: PublicCatalog | null) => void;
};

export async function getPublicCatalog(owner: string | null, callbacks: CatalogCallbacks = {}): Promise<PublicCatalog> {
  await assertCatalogOwner(owner);
  const version = ++catalogVersion;
  const categoriesTask = readCatalogCategoryChoices();
  const storesTask = fetchAcceptedStores();
  const productsTask = storesTask.then(stores => fetchAvailableProducts(stores.map(store => store.id)));
  const offersTask = storesTask.then(stores => fetchActiveOffers(stores.map(store => store.id)));
  const itemsTask = offersTask.then(fetchOfferItems);
  const mediaTask = productsTask.then(products => fetchProductMedia(products));

  async function report<T>(task: Promise<T>, callback?: (result: T | null) => void) {
    if (!callback) return;
    try {
      const result = await task;
      await assertCatalogOwner(owner);
      callback(result);
    } catch {
      callback(null);
    }
  }

  const offerRows = Promise.all([storesTask, productsTask, offersTask, itemsTask])
    .then(([stores, products, offers, offerItems]): PublicCatalog => ({
      stores, products, offers, offerItems, productMedia: [], storeCategories: [], productCategories: [],
    }));
  const [categories, market, productMedia] = await Promise.allSettled([
    categoriesTask, offerRows, mediaTask,
    report(categoriesTask, callbacks.categories), report(offerRows, callbacks.offers),
  ]);
  if (categories.status === "rejected") throw categories.reason;
  if (market.status === "rejected") throw market.reason;
  if (productMedia.status === "rejected") throw productMedia.reason;

  const catalog: PublicCatalog = {
    ...market.value,
    ...categories.value,
    productMedia: productMedia.value,
  };

  await assertCatalogOwner(owner);
  if (version === catalogVersion) {
    lastCacheKey = cacheKey(owner);
    await writeLocalCache(lastCacheKey, catalog);
  }

  return catalog;
}

export async function getCachedPublicCatalog(owner: string | null): Promise<
  PublicCatalogCache | undefined
> {
  const cached =
    peekLocalCache<PublicCatalogCache>(cacheKey(owner)) ??
    (await readLocalCache<PublicCatalogCache>(cacheKey(owner)));

  return cached;
}
