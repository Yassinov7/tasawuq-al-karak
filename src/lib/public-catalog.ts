import type { Tables } from "@/types/database";

import {
    peekLocalCache,
    readLocalCache,
    writeLocalCache,
} from "@/lib/local-cache";
import { supabase } from "@/lib/supabase";

export type PublicStore = Tables<"stores">;
export type ProductCategory = Tables<"product_categories">;
export type PublicProduct = Tables<"products">;
export type PublicOffer = Tables<"store_offers">;

type PublicCatalogCache = {
  stores: PublicStore[];
  productCategories: ProductCategory[];
  products: PublicProduct[];
};

const PUBLIC_CATALOG_CACHE_KEY = "public-catalog:v1";

export type PublicCatalog = PublicCatalogCache & {
  offers: PublicOffer[];
};

async function fetchAcceptedStores(): Promise<PublicStore[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("status", "accepted")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

async function fetchProductCategories(): Promise<ProductCategory[]> {
  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

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

export async function getPublicCatalog(): Promise<PublicCatalog> {
  const cached =
    peekLocalCache<PublicCatalogCache>(PUBLIC_CATALOG_CACHE_KEY) ??
    (await readLocalCache<PublicCatalogCache>(PUBLIC_CATALOG_CACHE_KEY));

  const stores = await fetchAcceptedStores();
  const acceptedStoreIds = stores.map((store) => store.id);

  const [productCategories, products, offers] = await Promise.all([
    fetchProductCategories(),
    fetchAvailableProducts(acceptedStoreIds),
    fetchActiveOffers(acceptedStoreIds),
  ]);

  const catalog: PublicCatalog = {
    stores,
    productCategories,
    products,
    offers,
  };

  await writeLocalCache(PUBLIC_CATALOG_CACHE_KEY, {
    stores,
    productCategories,
    products,
  } satisfies PublicCatalogCache);

  return catalog;
}

export async function getCachedPublicCatalog(): Promise<
  PublicCatalogCache | undefined
> {
  const cached =
    peekLocalCache<PublicCatalogCache>(PUBLIC_CATALOG_CACHE_KEY) ??
    (await readLocalCache<PublicCatalogCache>(PUBLIC_CATALOG_CACHE_KEY));

  return cached;
}
