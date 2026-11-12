import { readCategoryLabels } from "@/lib/catalog-categories";
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import { setMerchantProductAvailability } from '@/lib/merchant-store';
import type { CatalogKind, CatalogScope, CatalogCursor, CatalogRow } from '@/lib/merchant-catalog';

export type CatalogStore = { id: string; approved: boolean };
export const catalogPageSize = 20;
const escapedSearch = (value: string) => value.trim().replace(/[\\%_]/g, '\\$&');
export async function readCatalogStore(ownerId: string): Promise<CatalogStore | null> {
  const merchant = await supabase.from('merchants').select('id,status').eq('owner_user_id', ownerId).maybeSingle();
  if (merchant.error) throw merchant.error;
  if (!merchant.data) return null;
  const store = await supabase.from('stores').select('id,status').eq('merchant_id', merchant.data.id).maybeSingle();
  if (store.error) throw store.error;
  return store.data ? { id: store.data.id, approved: merchant.data.status === 'accepted' && store.data.status === 'accepted' } : null;
}
export type CatalogProduct = Pick<Tables<'products'>, 'id' | 'store_id' | 'title' | 'price' | 'selling_unit' | 'category_id' | 'is_available' | 'created_at'> & {
  kind: 'products'; image: string | null; category: { name: string; is_active: boolean } | null;
};
export type CatalogOfferItem = Pick<Tables<'store_offer_products'>, 'id' | 'product_id' | 'item_role' | 'quantity'> & {
  product: { title: string; selling_unit: string; is_available: boolean } | null;
};
export type CatalogOffer = Pick<Tables<'store_offers'>, 'id' | 'store_id' | 'title' | 'offer_type' | 'discount_method' | 'discount_value' | 'bundle_price' | 'is_active' | 'starts_at' | 'ends_at' | 'created_at'> & { kind: 'offers'; items: CatalogOfferItem[] };

async function productPage(storeId: string, scope: CatalogScope, cursor: CatalogCursor | null, limit: number): Promise<CatalogProduct[]> {
  let query = supabase.from('products').select('id,store_id,title,price,selling_unit,category_id,is_available,created_at,product_media(id,storage_path,display_order)')
    .eq('store_id', storeId).eq('product_media.media_type', 'image')
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .order('display_order', { referencedTable: 'product_media', ascending: true }).order('id', { referencedTable: 'product_media', ascending: true })
    .limit(1, { referencedTable: 'product_media' }).limit(limit);
  if (scope.query) query = query.ilike('title', `%${escapedSearch(scope.query)}%`);
  if (scope.filter !== 'all') query = query.eq('is_available', scope.filter === 'available');
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const result = await query;
  if (result.error) throw result.error;
  const rows = result.data ?? [];
  const labels = await readCategoryLabels('product', rows.map(row => row.category_id));
  return rows.map(({ product_media, ...row }) => ({ ...row, kind: 'products', category: labels.get(row.category_id) ?? null, image: product_media[0]?.storage_path ?? null }));
}
async function offerPage(storeId: string, scope: CatalogScope, cursor: CatalogCursor | null, at: string, limit: number): Promise<CatalogOffer[]> {
  let query = supabase.from('store_offers').select('id,store_id,title,offer_type,discount_method,discount_value,bundle_price,is_active,starts_at,ends_at,created_at')
    .eq('store_id', storeId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
  if (scope.query) query = query.ilike('title', `%${escapedSearch(scope.query)}%`);
  if (scope.filter === 'paused') query = query.eq('is_active', false);
  if (scope.filter === 'expired') query = query.eq('is_active', true).lte('ends_at', at);
  if (scope.filter === 'scheduled') query = query.eq('is_active', true).gt('starts_at', at);
  if (scope.filter === 'current') query = query.eq('is_active', true).lte('starts_at', at);
  const window = scope.filter === 'scheduled' || scope.filter === 'current' ? `ends_at.is.null,ends_at.gt.${at}` : null;
  const continuation = cursor ? `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})` : null;
  // Use a single logical parameter so the time window and continuation are both mandatory.
  if (window && continuation) query = query.or(`and(or(${window}),or(${continuation}))`);
  else if (window) query = query.or(window);
  else if (continuation) query = query.or(continuation);
  const result = await query;
  if (result.error) throw result.error;
  const offers = result.data ?? [];
  const byOffer = new Map<string, CatalogOfferItem[]>();
  if (offers.length) {
    // Child rows can exceed the response cap even when the parent page has 20 rows.
    let after: string | null = null;
    for (;;) {
      let itemsQuery = supabase.from('store_offer_products').select('id,offer_id,product_id,item_role,quantity,products(title,selling_unit,is_available)')
        .eq('store_id', storeId).in('offer_id', offers.map(row => row.id)).order('id').limit(100);
      if (after) itemsQuery = itemsQuery.gt('id', after);
      const items = await itemsQuery;
      if (items.error) throw items.error;
      if (!items.data?.length) break;
      for (const { offer_id, products, ...item } of items.data) {
        const list = byOffer.get(offer_id) ?? [];
        list.push({ ...item, product: products }); byOffer.set(offer_id, list);
      }
      after = items.data[items.data.length - 1].id;
    }
  }
  return offers.map(row => ({ ...row, kind: 'offers', items: byOffer.get(row.id) ?? [] }));
}
export const catalogApi = {
  store: readCatalogStore,
  async nextOfferBoundary(storeId: string, search: string, at: string) {
    const nearest = async (column: 'starts_at' | 'ends_at') => {
      let query = supabase.from('store_offers').select('starts_at,ends_at')
        .eq('store_id', storeId).eq('is_active', true).gt(column, at).order(column).limit(1);
      if (search) query = query.ilike('title', `%${escapedSearch(search)}%`);
      const { data, error } = await query;
      if (error) throw error;
      const value = data?.[0]?.[column];
      return value ? Date.parse(value) : Infinity;
    };
    const boundary = Math.min(...await Promise.all([nearest('starts_at'), nearest('ends_at')]));
    return Number.isFinite(boundary) ? boundary : null;
  },
  page: (kind: CatalogKind, storeId: string, scope: CatalogScope, cursor: CatalogCursor | null, at: string, limit = catalogPageSize): Promise<CatalogRow[]> => kind === 'products' ? productPage(storeId, scope, cursor, limit) : offerPage(storeId, scope, cursor, at, limit),
  availability: setMerchantProductAvailability,
  async remove(id: string) { const result = await supabase.rpc('delete_store_offer', { target_offer: id }); if (result.error) throw result.error; },
  async exists(id: string, storeId: string) { const result = await supabase.from('store_offers').select('id').eq('id', id).eq('store_id', storeId).maybeSingle(); if (result.error) throw result.error; return Boolean(result.data); },
};
