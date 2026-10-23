import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type RatingSummary = { averageRating: number | null; ratingCount: number };
export type PublicReview = { id: string; rating: number; comment: string | null; createdAt: string };
export type OwnReview = { id: string; rating: number; comment: string | null };
export type EligibleStoreOrder = Pick<Tables<"store_orders">, "id" | "delivered_at">;

export async function getRatingSummaries() {
  const [storesResult, productsResult] = await Promise.all([
    supabase.from("store_rating_summaries").select("store_id,average_rating,rating_count"),
    supabase.from("product_rating_summaries").select("product_id,average_rating,rating_count"),
  ]);
  if (storesResult.error) throw storesResult.error;
  if (productsResult.error) throw productsResult.error;
  return {
    stores: new Map((storesResult.data ?? []).map((item) => [item.store_id, { averageRating: item.average_rating, ratingCount: item.rating_count }])),
    products: new Map((productsResult.data ?? []).map((item) => [item.product_id, { averageRating: item.average_rating, ratingCount: item.rating_count }])),
  };
}

export async function getStoreRatings(storeId: string) {
  const [summaryResult, reviewsResult] = await Promise.all([
    supabase.from("store_rating_summaries").select("average_rating,rating_count").eq("store_id", storeId).maybeSingle(),
    supabase.from("store_public_reviews").select("id,rating,comment,created_at").eq("store_id", storeId).order("created_at", { ascending: false }),
  ]);
  if (summaryResult.error) throw summaryResult.error;
  if (reviewsResult.error) throw reviewsResult.error;
  return {
    summary: { averageRating: summaryResult.data?.average_rating ?? null, ratingCount: summaryResult.data?.rating_count ?? 0 },
    reviews: (reviewsResult.data ?? []).map((review) => ({ id: review.id, rating: review.rating, comment: review.comment, createdAt: review.created_at })),
  };
}

export async function getProductRatings(productId: string) {
  const [summaryResult, reviewsResult] = await Promise.all([
    supabase.from("product_rating_summaries").select("average_rating,rating_count").eq("product_id", productId).maybeSingle(),
    supabase.from("product_public_reviews").select("id,rating,comment,created_at").eq("product_id", productId).order("created_at", { ascending: false }),
  ]);
  if (summaryResult.error) throw summaryResult.error;
  if (reviewsResult.error) throw reviewsResult.error;
  return {
    summary: { averageRating: summaryResult.data?.average_rating ?? null, ratingCount: summaryResult.data?.rating_count ?? 0 },
    reviews: (reviewsResult.data ?? []).map((review) => ({ id: review.id, rating: review.rating, comment: review.comment, createdAt: review.created_at })),
  };
}

export async function getEligibleStoreOrders(storeId: string, productId?: string): Promise<EligibleStoreOrder[]> {
  const { data: orders, error } = await supabase
    .from("store_orders")
    .select("id,delivered_at")
    .eq("store_id", storeId)
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false });
  if (error) throw error;
  if (!productId || !orders?.length) return orders ?? [];
  const { data: items, error: itemsError } = await supabase
    .from("store_order_items")
    .select("store_order_id")
    .eq("product_id", productId)
    .in("store_order_id", orders.map((order) => order.id));
  if (itemsError) throw itemsError;
  const matchingIds = new Set((items ?? []).map((item) => item.store_order_id));
  return orders.filter((order) => matchingIds.has(order.id));
}

export async function getMyStoreReview(storeOrderId: string): Promise<OwnReview | null> {
  const { data, error } = await supabase.rpc("get_my_store_review", { target_store_order: storeOrderId });
  if (error) throw error;
  return data[0] ?? null;
}

export async function getMyProductReview(storeOrderId: string, productId: string): Promise<OwnReview | null> {
  const { data, error } = await supabase.rpc("get_my_product_review", { target_store_order: storeOrderId, target_product: productId });
  if (error) throw error;
  return data[0] ?? null;
}

export async function saveStoreReview(storeOrderId: string, review: OwnReview | null, rating: number, comment: string) {
  const input_comment = comment.trim() || null;
  const { error } = review
    ? await supabase.rpc("update_store_review", { target_review: review.id, input_rating: rating, input_comment })
    : await supabase.rpc("create_store_review", { target_store_order: storeOrderId, input_rating: rating, input_comment });
  if (error) throw error;
}

export async function saveProductReview(storeOrderId: string, productId: string, review: OwnReview | null, rating: number, comment: string) {
  const input_comment = comment.trim() || null;
  const { error } = review
    ? await supabase.rpc("update_product_review", { target_review: review.id, input_rating: rating, input_comment })
    : await supabase.rpc("create_product_review", { target_store_order: storeOrderId, target_product: productId, input_rating: rating, input_comment });
  if (error) throw error;
}
