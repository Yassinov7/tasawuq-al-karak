import { readReviewOrderIds } from "@/lib/operational-home";
import { latinDigits } from "@/lib/signup-data";
import { getC3Contexts } from "@/lib/c3-orders";
import type { C3Context } from "@/lib/c3-order-contract";
import { supabase } from "@/lib/supabase";
import { assertSypDocuments } from "@/lib/money";
import type { Tables } from "@/types/database";

export type AdminOrderDetail = {
  c3?: C3Context;
  order: Tables<"customer_orders">;
  customer: Pick<Tables<"profiles">, "id" | "full_name" | "email"> | null;
  totals: Tables<"customer_order_totals">[];
  deliveryTask: Tables<"delivery_tasks"> | null;
  driver: Pick<Tables<"profiles">, "id" | "full_name" | "email"> | null;
  stores: {
    storeOrder: Tables<"store_orders">;
    storeName: string;
    items: Tables<"store_order_items">[];
    totals: Tables<"store_order_totals">[];
    statusHistory: (Tables<"store_order_status_history"> & {
      actor: Pick<Tables<"profiles">, "id" | "full_name"> | null;
    })[];
  }[];
};

type CachedOrder = { data: AdminOrderDetail | null; updatedAt: number };

export type AdminOrderListFilter =
  | "pricing_review"
  | "all"
  | "new"
  | "in_progress"
  | "awaiting_delivery"
  | "completed"
  | "cancelled";

export type AdminOrderSummary = {
  reference?: string;
  id: string;
  orderNumber: number;
  status: Tables<"customer_orders">["status"];
  createdAt: string;
  customerName: string | null;
  recipientName: string;
  storeCount: number;
  totals: Pick<Tables<"customer_order_totals">, "currency" | "total">[];
};

export type AdminOrderPage = {
  orders: AdminOrderSummary[];
  hasMore: boolean;
};

type CachedOrderPage = { data: AdminOrderPage; updatedAt: number };

const detailCache = new Map<string, CachedOrder>();
const orderPageCache = new Map<string, CachedOrderPage>();
const cacheTtlMs = 15_000;

const orderPageKey = (filter: AdminOrderListFilter, page: number, pageSize: number, search = "") =>
  `${filter}:${page}:${pageSize}:${search.trim().toLocaleLowerCase("ar-SY")}`;

export function getCachedAdminOrder(orderId: string) {
  return detailCache.get(orderId) ?? null;
}

export function isCachedAdminOrderFresh(orderId: string) {
  const cached = getCachedAdminOrder(orderId);
  return Boolean(cached && Date.now() - cached.updatedAt < cacheTtlMs);
}

export function getCachedAdminOrderPage(
  filter: AdminOrderListFilter,
  page: number,
  pageSize: number,
  search = "",
) {
  return orderPageCache.get(orderPageKey(filter, page, pageSize, search)) ?? null;
}

export function isCachedAdminOrderPageFresh(
  filter: AdminOrderListFilter,
  page: number,
  pageSize: number,
  search = "",
) {
  const cached = getCachedAdminOrderPage(filter, page, pageSize, search);
  return Boolean(cached && Date.now() - cached.updatedAt < cacheTtlMs);
}

export async function getAdminOrderPage({
  filter,
  page,
  pageSize = 20,
  force = false,
  search = "",
}: {
  filter: AdminOrderListFilter;
  page: number;
  pageSize?: number;
  force?: boolean;
  search?: string;
}): Promise<AdminOrderPage> {
  const normalizedSearch = latinDigits(search.trim());
  const cached = getCachedAdminOrderPage(filter, page, pageSize, normalizedSearch);
  if (!force && cached && Date.now() - cached.updatedAt < cacheTtlMs) {
    return cached.data;
  }

  let query = supabase
    .from("customer_orders")
    .select("id,order_number,status,created_at,customer_id,recipient_name")
    .order("created_at", { ascending: false });

  const reviewIds = filter === "pricing_review" ? await readReviewOrderIds(page,pageSize,normalizedSearch) : null;
  if(reviewIds){
    if(!reviewIds.length)return {orders:[],hasMore:false};
    query=query.in("id",reviewIds.slice(0,pageSize)).order("id",{ascending:false});
  }
  if (filter === "new") query = query.eq("status", "submitted");
  if (filter === "in_progress") query = query.eq("status", "in_progress");
  if (filter === "awaiting_delivery") {
    query = query.in("status", ["ready_for_delivery", "out_for_delivery"]);
  }
  if (filter === "completed") query = query.eq("status", "delivered");
  if (filter === "cancelled") query = query.eq("status", "cancelled");

  if (normalizedSearch && filter !== "pricing_review") {
    const numberQuery = normalizedSearch.replace(/^#/, "");
    const isOrderNumber = /^\d+$/.test(numberQuery);
    const isOrderId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedSearch);
    const { data: matchingProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("full_name", `%${normalizedSearch}%`)
      .limit(100);
    if (profilesError) throw profilesError;
    const referenceResult = /^(?:(?:ORD|SOR|TSK)-)?[0-9]+$/i.test(numberQuery) ? await (supabase as unknown as {rpc(name:"find_order_reference",args:{reference_value:string}):PromiseLike<{data:string|null;error:{message:string}|null}>}).rpc("find_order_reference",{reference_value:numberQuery}) : {data:null,error:null};
    if(referenceResult.error) throw Error("تعذر البحث بمرجع الطلب.");
    const clauses = [
      referenceResult.data ? `id.eq.${referenceResult.data}` : "",
      isOrderNumber ? `order_number.eq.${numberQuery}` : "",
      isOrderId ? `id.eq.${normalizedSearch}` : "",
      ...(matchingProfiles ?? []).map((profile) => `customer_id.eq.${profile.id}`),
    ].filter(Boolean);
    if (!clauses.length) {
      const empty: AdminOrderPage = { orders: [], hasMore: false };
      orderPageCache.set(orderPageKey(filter, page, pageSize, normalizedSearch), { data: empty, updatedAt: Date.now() });
      return empty;
    }
    query = query.or(clauses.join(","));
  }

  const { data: orderRows, error: orderError } = await query.range(
    reviewIds ? 0 : page * pageSize,
    reviewIds ? pageSize - 1 : (page + 1) * pageSize - 1,
  );
  if (orderError) throw orderError;

  const orders = orderRows ?? [];
  const orderIds = orders.map((order) => order.id);
  const customerIds = [...new Set(orders.map((order) => order.customer_id))];
  const [customersResult, storesResult, totalsResult] = await Promise.all([
    customerIds.length
      ? supabase.from("profiles").select("id,full_name").in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase.from("store_orders").select("customer_order_id").in("customer_order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase.from("customer_order_totals").select("customer_order_id,currency,total").in("customer_order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedError = customersResult.error ?? storesResult.error ?? totalsResult.error;
  if (relatedError) throw relatedError;

  const customerNames = new Map((customersResult.data ?? []).map((customer) => [customer.id, customer.full_name]));
  const storeCounts = new Map<string, number>();
  for (const storeOrder of storesResult.data ?? []) {
    storeCounts.set(storeOrder.customer_order_id, (storeCounts.get(storeOrder.customer_order_id) ?? 0) + 1);
  }
  const totalsByOrder = new Map<string, AdminOrderSummary["totals"]>();
  for (const total of totalsResult.data ?? []) {
    totalsByOrder.set(total.customer_order_id, [
      ...(totalsByOrder.get(total.customer_order_id) ?? []),
      { currency: total.currency, total: total.total },
    ]);
  }

  const contexts = await getC3Contexts(orderIds);
  const result: AdminOrderPage = {
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      reference: contexts[order.id]?.references[`ORD:${order.id}`],
      status: order.status,
      createdAt: order.created_at,
      customerName: customerNames.get(order.customer_id) ?? null,
      recipientName: order.recipient_name,
      storeCount: storeCounts.get(order.id) ?? 0,
      totals: (totalsByOrder.get(order.id) ?? []).map(total => contexts[order.id]?.pricing ? { ...total, total: contexts[order.id].pricing!.current.total } : total),
    })),
    hasMore: reviewIds ? reviewIds.length>pageSize : orders.length === pageSize,
  };
  assertSypDocuments(result);
  orderPageCache.set(orderPageKey(filter, page, pageSize, normalizedSearch), { data: result, updatedAt: Date.now() });
  return result;
}

export async function getAdminOrderDetail(
  orderId: string,
  force = false,
): Promise<AdminOrderDetail | null> {
  const cached = getCachedAdminOrder(orderId);
  if (!force && cached && Date.now() - cached.updatedAt < cacheTtlMs) {
    return cached.data;
  }

  const orderResult = await supabase
    .from("customer_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (orderResult.error) throw orderResult.error;
  if (!orderResult.data) {
    detailCache.set(orderId, { data: null, updatedAt: Date.now() });
    return null;
  }

  const order = orderResult.data;
  const [customerResult, totalsResult, storeOrdersResult, deliveryResult] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email").eq("id", order.customer_id).maybeSingle(),
    supabase.from("customer_order_totals").select("*").eq("customer_order_id", order.id),
    supabase.from("store_orders").select("*").eq("customer_order_id", order.id).order("created_at"),
    supabase.from("delivery_tasks").select("*").eq("customer_order_id", order.id).maybeSingle(),
  ]);
  const topLevelError = customerResult.error ?? totalsResult.error ?? storeOrdersResult.error ?? deliveryResult.error;
  if (topLevelError) throw topLevelError;

  const storeOrders = storeOrdersResult.data ?? [];
  const storeIds = [...new Set(storeOrders.map((storeOrder) => storeOrder.store_id))];
  const storeOrderIds = storeOrders.map((storeOrder) => storeOrder.id);
  const deliveryTask = deliveryResult.data ?? null;
  const [storesResult, itemsResult, storeTotalsResult, historyResult, driverResult] = await Promise.all([
    storeIds.length > 0
      ? supabase.from("stores").select("id,name").in("id", storeIds)
      : Promise.resolve({ data: [], error: null }),
    storeOrderIds.length > 0
      ? supabase.from("store_order_items").select("*").in("store_order_id", storeOrderIds).order("created_at")
      : Promise.resolve({ data: [], error: null }),
    storeOrderIds.length > 0
      ? supabase.from("store_order_totals").select("*").in("store_order_id", storeOrderIds)
      : Promise.resolve({ data: [], error: null }),
    storeOrderIds.length > 0
      ? supabase.from("store_order_status_history").select("*").in("store_order_id", storeOrderIds).order("created_at")
      : Promise.resolve({ data: [], error: null }),
    deliveryTask?.driver_id
      ? supabase.from("profiles").select("id,full_name,email").eq("id", deliveryTask.driver_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const relatedError = storesResult.error ?? itemsResult.error ?? storeTotalsResult.error ?? historyResult.error ?? driverResult.error;
  if (relatedError) throw relatedError;

  const actorIds = [...new Set((historyResult.data ?? []).flatMap((entry) => entry.actor_id ? [entry.actor_id] : []))];
  const actorsResult = actorIds.length > 0
    ? await supabase.from("profiles").select("id,full_name").in("id", actorIds)
    : { data: [], error: null };
  if (actorsResult.error) throw actorsResult.error;

  const storeNames = new Map((storesResult.data ?? []).map((store) => [store.id, store.name]));
  const itemsByStoreOrder = new Map<string, Tables<"store_order_items">[]>();
  for (const item of itemsResult.data ?? []) {
    itemsByStoreOrder.set(item.store_order_id, [...(itemsByStoreOrder.get(item.store_order_id) ?? []), item]);
  }
  const totalsByStoreOrder = new Map<string, Tables<"store_order_totals">[]>();
  for (const total of storeTotalsResult.data ?? []) {
    totalsByStoreOrder.set(total.store_order_id, [...(totalsByStoreOrder.get(total.store_order_id) ?? []), total]);
  }
  const actorsById = new Map((actorsResult.data ?? []).map((actor) => [actor.id, actor]));
  const historyByStoreOrder = new Map<string, AdminOrderDetail["stores"][number]["statusHistory"]>();
  for (const entry of historyResult.data ?? []) {
    historyByStoreOrder.set(entry.store_order_id, [
      ...(historyByStoreOrder.get(entry.store_order_id) ?? []),
      { ...entry, actor: entry.actor_id ? actorsById.get(entry.actor_id) ?? null : null },
    ]);
  }

  const context = (await getC3Contexts([orderId]))[orderId];
  const detail: AdminOrderDetail = {
    c3: context,
    order: context?.pricing ? { ...order, delivery_fee: context.pricing.current.delivery_fee } : order,
    customer: customerResult.data ?? null,
    totals: (totalsResult.data ?? []).map(total => context?.pricing ? { ...total, items_subtotal: context.pricing.current.items_amount, delivery_fee: context.pricing.current.delivery_fee, total: context.pricing.current.total } : total),
    deliveryTask,
    driver: driverResult.data ?? null,
    stores: storeOrders.map((storeOrder) => ({
      storeOrder,
      storeName: storeNames.get(storeOrder.store_id) ?? "متجر غير متاح",
      items: itemsByStoreOrder.get(storeOrder.id) ?? [],
      totals: totalsByStoreOrder.get(storeOrder.id) ?? [],
      statusHistory: historyByStoreOrder.get(storeOrder.id) ?? [],
    })),
  };
  assertSypDocuments(detail);
  detailCache.set(orderId, { data: detail, updatedAt: Date.now() });
  return detail;
}
