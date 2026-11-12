import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type AdminCategory = Tables<"catalog_categories">;
export type CategoryScope = AdminCategory["scope"];
export type CategoryValues = Pick<AdminCategory, "name" | "scope" | "parent_id" | "sort_order" | "is_active">;

class CategoryActionError extends Error {}

export async function listAdminCategories(signal: AbortSignal) {
  const rows: AdminCategory[] = [];
  let cursor: string | undefined;
  for (;;) {
    let query = supabase.from("catalog_categories").select("*").order("id").limit(100);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query.abortSignal(signal);
    if (error) throw error;
    if (!data.length) return rows;
    rows.push(...data);
    if (data.length < 100) return rows;
    cursor = data.at(-1)?.id;
  }
}

export async function categoryRemovalReason(category: AdminCategory, signal: AbortSignal) {
  const children = supabase.from("catalog_categories").select("id").eq("parent_id", category.id).limit(1);
  const checks = category.scope === "store" ? [
    supabase.from("stores").select("id").eq("category_id", category.id).limit(1),
    supabase.from("merchant_applications").select("id").eq("category_id", category.id).limit(1),
  ] : [supabase.from("products").select("id").eq("category_id", category.id).limit(1)];
  const [childResult, ...references] = await Promise.all([children, ...checks].map(query => query.abortSignal(signal)));
  for (const result of [childResult, ...references]) if (result.error) throw result.error;
  if (childResult.data?.length) return "له تصنيفات فرعية. انقلها أو احذفها أولًا.";
  if (references.some(result => result.data?.length)) {
    return category.scope === "store" ? "التصنيف مرتبط بمتجر أو طلب انضمام. يمكنك تعطيله." : "التصنيف مرتبط بمنتج. يمكنك تعطيله.";
  }
  return null;
}

async function checkActor(owner: string, current: () => boolean) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!current() || data.user?.id !== owner) throw new CategoryActionError("تغيرت الجلسة. افتح إدارة التصنيفات من حسابك الحالي.");
}

export async function saveAdminCategory(owner: string, current: () => boolean, id: string, values: CategoryValues, original?: AdminCategory) {
  await checkActor(owner, current);
  if (!original) {
    // A repeated request uses the same ID. Read back the exact values before reporting success.
    const { error } = await supabase.from("catalog_categories").upsert(
      { ...values, id, slug: `category-${id}` }, { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) throw error;
  } else {
    const { error } = await supabase.from("catalog_categories").update(values).eq("id", id).eq("updated_at", original.updated_at);
    if (error) throw error;
  }
  if (!current()) throw new CategoryActionError("تغيرت الجلسة قبل التحقق من نتيجة الحفظ.");
  const { data, error } = await supabase.from("catalog_categories").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || data.name !== values.name || data.parent_id !== values.parent_id || data.scope !== values.scope ||
    data.is_active !== values.is_active || data.sort_order !== values.sort_order) {
    throw new CategoryActionError("تعذر تأكيد الحفظ. حدّث القائمة وراجع التصنيف قبل المحاولة.");
  }
  return data;
}

export async function removeAdminCategory(owner: string, current: () => boolean, row: AdminCategory) {
  await checkActor(owner, current);
  const { data, error } = await supabase.from("catalog_categories").delete().eq("id", row.id)
    .eq("updated_at", row.updated_at).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new CategoryActionError("تغيّر التصنيف أو لم يعد موجودًا. حدّث القائمة أولًا.");
}

export function categoryError(error: unknown) {
  if (error instanceof CategoryActionError) return error.message;
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "23503" || code === "23001") return "التصنيف مرتبط بعناصر أو تصنيفات فرعية. راجع الارتباطات أو عطّله.";
  if (code === "23514") return "راجع الاسم والتصنيف الأب. يجب أن يكون الأب رئيسيًا وفي النطاق نفسه.";
  if (code === "23505") return "يوجد تصنيف بهذا الاسم في النطاق نفسه.";
  if (code === "42501") return "إدارة التصنيفات متاحة لحساب الإدارة المخوّل.";
  return "تعذر تأكيد العملية. تحقق من الاتصال وحدّث القائمة قبل إعادة المحاولة.";
}
