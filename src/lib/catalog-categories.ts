import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type SelectableCategory = Tables<"selectable_catalog_categories">;
type Scope = SelectableCategory["scope"];
const categoryPageSize = 100;

export async function readSelectableCategories(scope: Scope, signal?: AbortSignal) {
  const rows: SelectableCategory[] = [];
  let after: string | undefined;
  for (;;) {
    let query = supabase.from("selectable_catalog_categories").select("*").eq("scope", scope).order("id").limit(categoryPageSize);
    if (after) query = query.gt("id", after);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < categoryPageSize) break;
    after = data.at(-1)?.id;
  }
  return rows.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ar") || a.id.localeCompare(b.id));
}

export async function isSelectableCategory(scope: Scope, id: string) {
  const { data, error } = await supabase.from("selectable_catalog_categories").select("id").eq("scope", scope).eq("id", id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function readCategoryLabels(scope: Scope, ids: string[], signal?: AbortSignal) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, { name: string; is_active: boolean }>();
  let labels = supabase.from("catalog_categories").select("id,name").eq("scope", scope).in("id", unique);
  let choices = supabase.from("selectable_catalog_categories").select("id").eq("scope", scope).in("id", unique);
  if (signal) { labels = labels.abortSignal(signal); choices = choices.abortSignal(signal); }
  const [known, active] = await Promise.all([labels, choices]);
  if (known.error) throw known.error;
  if (active.error) throw active.error;
  const selectable = new Set(active.data.map(row => row.id));
  return new Map(known.data.map(row => [row.id, { name: row.name, is_active: selectable.has(row.id) }]));
}
