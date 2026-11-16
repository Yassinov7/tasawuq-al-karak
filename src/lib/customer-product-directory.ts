import { getStoreMediaUrl } from "@/lib/merchant-store";
import { assertCatalogOwner } from "@/lib/public-catalog";
import { supabase } from "@/lib/supabase";
import type { ProductSort } from "@/lib/customer-search";
import type { Product } from "@/types/catalog";

const pageSize = 12;
export type ProductCursor = { price: number; rank: string; id: string };
export type ProductDirectoryPage = { products: Product[]; storeNames: Map<string, string>; next: ProductCursor | null };

export async function readProductDirectoryPage(
  owner: string | null, seed: string, query: string, categoryId: string | null,
  sort: ProductSort, cursor: ProductCursor | null, signal: AbortSignal,
): Promise<ProductDirectoryPage> {
  await assertCatalogOwner(owner);
  if (signal.aborted) throw Error("Product directory read cancelled");
  const { data, error } = await supabase.rpc("read_customer_product_directory", {
    seed_value: seed,
    query_value: query,
    sort_value: sort,
    ...(categoryId ? { category_value: categoryId } : {}),
    ...(cursor ? { after_price: cursor.price, after_rank: cursor.rank, after_id: cursor.id } : {}),
  }).abortSignal(signal);
  if (error) throw error;
  await assertCatalogOwner(owner);
  if (signal.aborted || !data) throw Error("Product directory unavailable");
  const rows = data.slice(0, pageSize);
  const last = rows.at(-1);
  return {
    products: rows.map(row => ({
      id: row.id, storeId: row.store_id, categoryId: row.category_id,
      name: row.title, description: row.description, price: row.price,
      unit: row.selling_unit, available: true, minimumQuantity: row.minimum_quantity,
      quantityStep: row.quantity_step,
      media: row.media_id && row.media_path ? [{ id: row.media_id, type: "image", uri: getStoreMediaUrl(row.media_path),
        altText: row.media_alt ?? "", displayOrder: row.media_order ?? 0 }] : [],
    })),
    storeNames: new Map(rows.map(row => [row.store_id, row.store_name])),
    next: data.length > pageSize && last ? { price: last.price, rank: last.rank_key, id: last.id } : null,
  };
}
