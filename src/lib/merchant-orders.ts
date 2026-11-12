import { getC3Contexts } from "@/lib/c3-orders";
import type { QueryData } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { formatSyp } from "@/lib/money";
import type { Tables } from "@/types/database";

export type OrderStatus = Tables<"store_orders">["status"];
export type OrderFilter = "all" | "awaiting_review" | "preparing" | "ready_for_pickup";
export const orderFilters: readonly OrderFilter[] = ["all", "awaiting_review", "preparing", "ready_for_pickup"];
export const pageSize = 20;
export const ordersFreshnessMs = 30_000;
function orderQuery(storeId: string) {
  return supabase.from("store_orders").select("id,customer_order_id,status,customer_note,rejection_reason,created_at,customer_orders!inner(order_number,recipient_name,contact_phone,delivery_address),store_order_items(id,product_title_snapshot,selling_unit_snapshot,quantity,unit_price_snapshot,currency,line_total,offer_snapshot),store_order_totals(currency,items_subtotal)").eq("store_id", storeId);
}
export type MerchantOrder = QueryData<ReturnType<typeof orderQuery>>[number] & { reference?: string; parentReference?: string };
export function normalizeOrderSearch(value: string) {
  return value.trim().replace(/^#/, "").replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).toUpperCase();
}
export function orderSearchError(value: string) {
  return !value || /^(?:(?:SOR|ORD)-\d{7,18}|\d{1,18})$/.test(normalizeOrderSearch(value)) ? "" : "أدخل رمز SOR أو ORD كاملًا، أو رقم الطلب.";
}
export function orderTotal(total: MerchantOrder["store_order_totals"]): string | null {
  return total && total.currency === "SYP" && typeof total.items_subtotal === "number" && Number.isFinite(total.items_subtotal) && total.items_subtotal >= 0
    ? formatSyp(total.items_subtotal, total.currency) : null;
}
export function mergeOrders(previous: MerchantOrder[], incoming: MerchantOrder[]) {
  return [...new Map([...previous, ...incoming].map(row => [row.id, row])).values()];
}
export function rejectionError(reason: string) {
  return reason.trim().length < 2 ? "اكتب سببًا واضحًا من حرفين على الأقل." : reason.trim().length > 500 ? "الحد الأقصى للسبب 500 حرف." : "";
}
type Cursor = Pick<MerchantOrder, "created_at" | "id">;
async function readPage(storeId: string, filter: OrderFilter, cursor: Cursor | null, signal: AbortSignal, targetId?:string, search = ""): Promise<MerchantOrder[]> {
  if(signal.aborted)throw Error("Read aborted");
  let matchedId: string | undefined;
  if (search && !targetId) {
    if (orderSearchError(search)) throw Error("Invalid search");
    const client = supabase as unknown as {rpc(name:"find_merchant_store_order",args:{search_value:string;target_store:string}):PromiseLike<{data:unknown;error:unknown}> & {abortSignal?:(signal:AbortSignal)=>PromiseLike<{data:unknown;error:unknown}>}};
    const request = client.rpc("find_merchant_store_order", {search_value:normalizeOrderSearch(search),target_store:storeId});
    const result = await (request.abortSignal ? request.abortSignal(signal) : request);
    if (signal.aborted || result.error) throw Error("Search unavailable");
    if (result.data === null) return [];
    if (typeof result.data !== "string" || !/^[0-9a-f-]{36}$/i.test(result.data)) throw Error("Invalid search result");
    matchedId=result.data;
  }
  let query = orderQuery(storeId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(pageSize);
  const recordId=targetId ?? matchedId;
  if (recordId) query=query.eq("id",recordId);
  if (!targetId && filter !== "all") query = query.eq("status", filter);
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const result = await query.abortSignal(signal);
  if (result.error) throw result.error;
  const rows = result.data ?? [];
  if (signal.aborted) throw Error("Read aborted");
  const contexts = await getC3Contexts(rows.map(row => row.customer_order_id),signal);
  return rows.map(row => ({ ...row, reference: contexts[row.customer_order_id]?.references[`SOR:${row.id}`], parentReference:contexts[row.customer_order_id]?.references[`ORD:${row.customer_order_id}`] }));
}
async function readCounts(storeId: string, signal: AbortSignal) {
  const results = await Promise.all(orderFilters.map(filter => {
    let query = supabase.from("store_orders").select("id", { count: "exact", head: true }).eq("store_id", storeId);
    if (filter !== "all") query = query.eq("status", filter);
    return query.abortSignal(signal);
  }));
  return Object.fromEntries(results.map((result, index) => {
    if (result.error || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error("Unavailable count");
    return [orderFilters[index], result.count];
  })) as Record<OrderFilter, number>;
}
export const merchantOrdersApi = {
  store: async (ownerId: string, signal: AbortSignal) => {
    const merchant = await supabase.from("merchants").select("id").eq("owner_user_id", ownerId).abortSignal(signal).maybeSingle();
    if (merchant.error) throw merchant.error;
    if (!merchant.data) return null;
    const store = await supabase.from("stores").select("id").eq("merchant_id", merchant.data.id).abortSignal(signal).maybeSingle();
    if (store.error) throw store.error;
    return store.data?.id ?? null;
  },
  page: readPage, counts: readCounts,
  update: async (id: string, next: "preparing" | "ready_for_pickup" | "rejected", reason?: string) => {
    const result = await supabase.rpc("update_store_order_status", { target_store_order: id, next_status: next, reason });
    if (result.error) throw result.error;
  },
};
export type OrdersState = {
  storeId: string | null; filter: OrderFilter; rows: MerchantOrder[];
  counts: Record<OrderFilter, number> | null; loading: boolean; moreLoading: boolean;
  hasMore: boolean; error: string; moreError: boolean; busyIds: string[]; notice: string; loadedAt: number;
  search: string;
};
export const initialOrdersState: OrdersState = { storeId: null, filter: "all", search:"", rows: [], counts: null, loading: true, moreLoading: false, hasMore: false, error: "", moreError: false, busyIds: [], notice: "", loadedAt: 0 };
/** Screen-owned, in-memory state only. Every async result is fenced by scope/revision. */
export function createMerchantOrdersController(ownerId: string, publish: (state: OrdersState) => void, api = merchantOrdersApi, targetId?:string, initialFilter: OrderFilter = "all") {
  let state = { ...initialOrdersState, filter: initialFilter };
  let active = false, suspended = false, revision = 0, lifecycle = 0;
  let realtimePending = false;
  let request: AbortController | null = null;
  let refreshing: Promise<boolean> | null = null;
  let cursor: Cursor | null = null;
  const locks = new Set<string>();
  const emit = (patch: Partial<OrdersState>) => { state = { ...state, ...patch }; if (active) publish(state); };
  const current = (version: number) => active && !suspended && revision === version;
  function cancel() { revision++; request?.abort(); request = null; refreshing = null; }
  async function refresh(parentSignal?: AbortSignal): Promise<boolean> {
    if (!active || suspended) return false;
    if (refreshing) return refreshing;
    // Replacing the first page invalidates any in-flight continuation.
    cancel(); const version = revision;
    request = new AbortController(); const signal = request.signal;
    const stop = () => { if(current(version)){ cancel(); emit({loading:false,moreLoading:false}); } };
    parentSignal?.addEventListener("abort",stop,{once:true});
    if(parentSignal?.aborted){stop();parentSignal.removeEventListener("abort",stop);return false;}
    emit({ loading: true, moreLoading: false, moreError: false });
    const work = (async () => {
      try {
        const storeId = await api.store(ownerId, signal);
        if (!current(version)) return false;
        if (storeId !== state.storeId) {
          cursor = null;
          emit({ storeId, rows: [], counts: null, hasMore: false, notice: "", loadedAt: 0 });
        }
        if (!storeId) throw new Error("No store");
        const retainedSize = state.rows.length;
        const [pageResult, countResult] = await Promise.allSettled([api.page(storeId, state.filter, null, signal,targetId,state.search), api.counts(storeId, signal)]);
        if (!current(version)) return false;
        if (countResult.status === "fulfilled") emit({ counts: countResult.value });
        else emit({ counts: null });
        if (pageResult.status === "fulfilled") {
          let rows = pageResult.value, tail = rows.at(-1) ?? null;
          // Revalidate the window the user actually loaded; refreshing must not
          // discard later pages under their current scroll/expanded detail.
          const expected = Math.min(retainedSize,countResult.status==="fulfilled"?countResult.value[state.filter]:retainedSize);
          while(!targetId && !state.search && rows.length < expected && tail) {
            const next = await api.page(storeId,state.filter,tail,signal);
            if(!current(version))return false;
            const merged=mergeOrders(rows,next), nextTail=next.at(-1);
            if(!nextTail || merged.length===rows.length)break;
            rows=merged;tail=nextTail;
          }
          cursor = tail;
          emit({ rows: mergeOrders([], rows), hasMore: !targetId && !state.search && rows.length > 0 && (countResult.status !== "fulfilled" || rows.length < countResult.value[state.filter]) });
        }
        if (pageResult.status === "rejected" || countResult.status === "rejected") throw new Error("Refresh failed");
        emit({ error: "", loadedAt: Date.now() }); return true;
      } catch {
        if (current(version)) emit({ error: state.search ? "تعذر البحث عن الطلب. تحقق من الاتصال ثم أعد المحاولة." : "تعذر تحديث الطلبات أو أعدادها. القيم السابقة، إن ظهرت، لم تُحدّث بالكامل." });
        return false;
      } finally {
        parentSignal?.removeEventListener("abort",stop);
        if (current(version)) {
          refreshing = null; emit({ loading: false });
          if (realtimePending) { realtimePending = false; void refresh(); }
        }
      }
    })();
    refreshing = work; return work;
  }
  return {
    activate() { active = true; suspended=false; publish(state); },
    suspend() { suspended=true;realtimePending=false;cancel();emit({loading:false,moreLoading:false}); },
    resume() { suspended=false; },
    deactivate() { active = false; lifecycle++; realtimePending = false; cancel(); state = { ...state, loading: false, moreLoading: false }; },
    refresh,
    async search(value: string) {
      const normalized=normalizeOrderSearch(value);
      if(orderSearchError(normalized)){emit({notice:orderSearchError(normalized)});return;}
      if(normalized===state.search){emit({notice:""});if(state.error)await refresh();return;}
      cancel();cursor=null;
      emit({search:normalized,rows:[],hasMore:false,error:"",loadedAt:0,notice:""});
      await refresh();
    },
    async focus() { if (!state.loadedAt || state.error || Date.now() - state.loadedAt >= ordersFreshnessMs) await refresh(); },
    async select(filter: OrderFilter) {
      if (filter === state.filter) return;
      cancel(); cursor = null;
      emit({ filter, rows: [], hasMore: false, error: "", loadedAt: 0, notice: "" });
      await refresh();
    },
    async more() {
      if (!active || suspended || state.loading || state.moreLoading || state.moreError || !state.hasMore || !state.storeId || !cursor) return;
      const version = revision, storeId = state.storeId;
      request = new AbortController(); const signal = request.signal;
      emit({ moreLoading: true });
      try {
        const rows = await api.page(storeId, state.filter, cursor, signal);
        if (!current(version)) return;
        cursor = rows.at(-1) ?? cursor;
        emit({ rows: mergeOrders(state.rows, rows), hasMore: rows.length > 0 && (!state.counts || mergeOrders(state.rows, rows).length < state.counts[state.filter]) });
      } catch { if (current(version)) emit({ moreError: true }); }
      finally { if (current(version)) emit({ moreLoading: false }); }
    },
    retryMore() { emit({ moreError: false }); },
    realtime() {
      if (!active || locks.size) return;
      if (state.loading) { realtimePending = true; return; }
      void refresh();
    },
    async action(order: MerchantOrder, next: "preparing" | "ready_for_pickup" | "rejected", reason?: string) {
      if (!active || suspended || !state.storeId || locks.has(order.id)) return false;
      const live = state.rows.find(row => row.id === order.id);
      if (!live || (next === "ready_for_pickup" ? live.status !== "preparing" : live.status !== "awaiting_review")) {
        emit({notice:"تغيرت حالة طلب المتجر. راجع حالته الحالية قبل تنفيذ الإجراء."});return false;
      }
      if (next === "rejected" && rejectionError(reason ?? "")) return false;
      const storeId = state.storeId, actionLifecycle = lifecycle;
      locks.add(order.id); emit({ busyIds: [...locks], notice: "" });
      try {
        await api.update(order.id, next, reason?.trim());
        if (!active || lifecycle !== actionLifecycle || state.storeId !== storeId) return true;
        // Do not reuse a read started before the successful write.
        cancel();
        // This state is acknowledged by the RPC, not an optimistic transition.
        // Keep the confirmed action if the following read fails.
        emit({ counts: null, rows: state.rows.map(row => row.id === order.id ? {
          ...row, status: next, rejection_reason: next === "rejected" ? (reason ?? "").trim() : null,
        } : row).filter(row => state.filter === "all" || row.status === state.filter) });
        const updated = await refresh();
        if (active && lifecycle === actionLifecycle && state.storeId === storeId) emit({ notice: updated ? "تم تحديث حالة الطلب." : "تم تحديث حالة الطلب بنجاح، لكن تعذر تحديث العرض. أعد تحميل القائمة." });
        return true;
      } catch {
        if (active && lifecycle === actionLifecycle && state.storeId === storeId) emit({ notice: "تعذر تأكيد تحديث الطلب. حدّث القائمة للتحقق من حالته قبل إعادة المحاولة." });
        return false;
      } finally { locks.delete(order.id); if (active) emit({ busyIds: [...locks] }); }
    },
  };
}
