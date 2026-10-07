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
export type PublicOfferItem = Tables<"store_offer_products">;
export type PublicProductMedia = Tables<"product_media">;

type PublicCatalogCache = {
  stores: PublicStore[];
  storeCategories: Tables<"store_categories">[];
  productCategories: ProductCategory[];
  products: PublicProduct[];
  offers: PublicOffer[];
  offerItems: PublicOfferItem[];
  productMedia: PublicProductMedia[];
};

const PUBLIC_CATALOG_CACHE_KEY = "public-catalog:v3";

export type PublicCatalog = PublicCatalogCache;

async function fetchStoreCategories(): Promise<Tables<"store_categories">[]> {
  const { data, error } = await supabase
    .from("store_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return data ?? [];
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

async function fetchProductMedia(products: PublicProduct[]): Promise<PublicProductMedia[]> {
  if (products.length === 0) return [];

  const { data, error } = await supabase
    .from("product_media")
    .select("*")
    .in("product_id", products.map((product) => product.id))
    .order("display_order", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

export async function getPublicCatalog(): Promise<PublicCatalog> {
  const stores = await fetchAcceptedStores();
  const acceptedStoreIds = stores.map((store) => store.id);

  const [storeCategories, productCategories, products, offers] = await Promise.all([
    fetchStoreCategories(),
    fetchProductCategories(),
    fetchAvailableProducts(acceptedStoreIds),
    fetchActiveOffers(acceptedStoreIds),
  ]);
  const [offerItems, productMedia] = await Promise.all([
    fetchOfferItems(offers),
    fetchProductMedia(products),
  ]);

  const catalog: PublicCatalog = {
    stores,
    storeCategories,
    productCategories,
    products,
    offerItems,
    productMedia,
    offers,
  };

  await writeLocalCache(PUBLIC_CATALOG_CACHE_KEY, {
    stores,
    storeCategories,
    productCategories,
    products,
    offerItems,
    productMedia,
    offers,
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
