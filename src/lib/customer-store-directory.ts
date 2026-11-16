import { assertCatalogOwner } from "@/lib/public-catalog";
import { supabase } from "@/lib/supabase";
import type { Store } from "@/types/catalog";

const pageSize = 12;
export type StoreCursor = { rank: string; id: string };
export type DirectoryPage = { stores: Store[]; next: StoreCursor | null };

export async function readStoreDirectoryPage(
  owner: string | null, seed: string, query: string, categoryId: string | null,
  cursor: StoreCursor | null, signal: AbortSignal,
): Promise<DirectoryPage> {
  await assertCatalogOwner(owner);
  if (signal.aborted) throw Error("Directory read cancelled");
  const { data, error } = await supabase.rpc("read_customer_store_directory", {
    seed_value: seed, query_value: query,
    ...(categoryId ? { category_value: categoryId } : {}),
    ...(cursor ? { after_rank: cursor.rank, after_id: cursor.id } : {}),
  }).abortSignal(signal);
  if (error) throw error;
  await assertCatalogOwner(owner);
  if (signal.aborted || !data) throw Error("Directory read unavailable");

  const rows = data.slice(0, pageSize);
  const last = rows.at(-1);
  return {
    stores: rows.map(row => ({ id: row.id, name: row.name, categoryIds: [row.category_id], description: "", location: "" })),
    next: data.length > pageSize && last ? { rank: last.rank_key, id: last.id } : null,
  };
}
