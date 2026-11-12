import { readMerchantHomeStatus, type HomeEligibility } from "@/lib/operational-home";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";
import { readMoney } from "@/lib/invoice-finance";

type ApprovalStatus = Tables<"stores">["status"];
export type MerchantHomeIdentity = {
  merchantId: string;
  merchantStatus: Tables<"merchants">["status"];
  store: Pick<Tables<"stores">, "id" | "name" | "status">;
};
export type MerchantHomeCounts = {
  awaitingReview: number; preparing: number; readyForPickup: number;
  products: number; activeOffers: number; availableProducts: number;
};
type Snapshot = { ownerId: string; storeId: string; counts: MerchantHomeCounts; eligibility: HomeEligibility; loadedAt: number; finance?: { payable: string; receivable: string }; financeError?: boolean };
export type MerchantHomeState = {
  identity: MerchantHomeIdentity | null; snapshot: Snapshot | null; busy: boolean; error: boolean;
};
export const initialMerchantHomeState: MerchantHomeState = { identity: null, snapshot: null, busy: true, error: false };
export const merchantHomeFreshnessMs = 30_000;
const catalogueRevisions = new Map<string, number>();
export function merchantCatalogRevision(ownerId: string) { return catalogueRevisions.get(ownerId) ?? 0; }
export function invalidateMerchantHome(ownerId: string) {
  catalogueRevisions.set(ownerId, (catalogueRevisions.get(ownerId) ?? 0) + 1);
}

async function readIdentity(ownerId: string, signal: AbortSignal): Promise<MerchantHomeIdentity | null> {
  const merchant = await supabase.from("merchants").select("id,status")
    .eq("owner_user_id", ownerId).abortSignal(signal).maybeSingle();
  if (merchant.error) throw merchant.error;
  if (!merchant.data) return null;
  const store = await supabase.from("stores").select("id,name,status")
    .eq("merchant_id", merchant.data.id).abortSignal(signal).maybeSingle();
  if (store.error) throw store.error;
  return store.data ? { merchantId: merchant.data.id, merchantStatus: merchant.data.status, store: store.data } : null;
}

async function readCounts(storeId: string, signal: AbortSignal): Promise<MerchantHomeCounts> {
  const now = new Date().toISOString();
  const orderCount = (status: Tables<"store_orders">["status"]) => supabase.from("store_orders")
    .select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", status).abortSignal(signal);
  const results = await Promise.all([
    orderCount("awaiting_review"), orderCount("preparing"), orderCount("ready_for_pickup"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId).abortSignal(signal),
    supabase.from("store_offers").select("id", { count: "exact", head: true })
      .eq("store_id", storeId).eq("is_active", true).lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gt.${now}`).abortSignal(signal),
    // The offer editor only accepts displayed products, without loading details.
    supabase.from("products").select("id", { count: "exact", head: true })
      .eq("store_id", storeId).eq("is_available", true).abortSignal(signal),
  ]);
  const counts = results.map((result) => {
    if (result.error) throw result.error;
    const count = result.count;
    if (count === null || !Number.isSafeInteger(count) || count < 0) throw new Error("Missing dashboard count");
    return count;
  });
  return { awaitingReview: counts[0], preparing: counts[1], readyForPickup: counts[2], products: counts[3], activeOffers: counts[4], availableProducts: counts[5] };
}

/** One page/owner, one in-memory snapshot. Never hydrate the old merchant-home
 * persistent cache (notification counts/previews), including pre-SYP data.
 * Recheck ownership on every focus; reuse counts only for the same fresh store.
 */
export function createMerchantHomeController(ownerId: string, publish: (state: MerchantHomeState) => void) {
  let state = initialMerchantHomeState;
  let focused = false;
  let abort: AbortController | undefined;
  let revision = 0;
  let catalogueRevision = catalogueRevisions.get(ownerId) ?? 0;
  return {
    activate() { focused = true; },
    deactivate() { focused = false; revision++; abort?.abort(); },
    async refresh(force = false, parentSignal?: AbortSignal): Promise<void> {
      if (!focused) return;
      abort?.abort();
      const requestAbort = new AbortController(); abort = requestAbort;
      const cancel = () => requestAbort.abort();
      parentSignal?.addEventListener("abort", cancel, { once: true });
      if (parentSignal?.aborted) cancel();
      const signal = requestAbort.signal;
      const hadError = state.error;
      const request = ++revision;
      const current = () => focused && !signal.aborted && request === revision;
      const commit = (next: MerchantHomeState) => { state = next; publish(next); };
      commit({ ...state, busy: true, error: false });
      try {
        const identity = await readIdentity(ownerId, signal);
        if (!current()) return;
        if (!identity) { commit({ identity: null, snapshot: null, busy: false, error: false }); return; }
        const previous = state.identity;
        const sameStore = identity.store.id === previous?.store.id && identity.merchantId === previous.merchantId;
        const sameApproval = sameStore && identity.store.status === previous.store.status && identity.merchantStatus === previous.merchantStatus;
        // Discard the previous store before its replacement counts arrive.
        commit({ ...state, identity, snapshot: sameStore ? state.snapshot : null });
        const cached = state.snapshot;
        const age = cached ? Date.now() - cached.loadedAt : Infinity;
        if (!force && catalogueRevision === (catalogueRevisions.get(ownerId) ?? 0) && !hadError && sameApproval && cached?.ownerId === ownerId && cached.storeId === identity.store.id
          && !cached.financeError && age >= 0 && age < merchantHomeFreshnessMs) {
          commit({ ...state, busy: false }); return;
        }
        const nextCatalogueRevision = catalogueRevisions.get(ownerId) ?? 0;
        // Server totals are independent of the returned invoice page. A finance
        // read failure must not turn valid order counts into a failed dashboard.
        const financeRead = readMoney("", 0, ownerId, signal).then(data => {
          if (data.owner !== ownerId || data.admin || !data.account_reference ||
            !/^(?:0|[1-9]\d{0,39})(?:\.\d{1,2})?$/.test(data.payable) || !/^(?:0|[1-9]\d{0,39})(?:\.\d{1,2})?$/.test(data.receivable)) throw Error("Invalid account scope");
          return { payable: data.payable, receivable: data.receivable };
        }).catch(() => undefined);
        const [counts, eligibility, finance] = await Promise.all([readCounts(identity.store.id, signal), readMerchantHomeStatus(ownerId, identity.store.id, signal), financeRead]);
        if (!current()) return;
        catalogueRevision = nextCatalogueRevision;
        commit({ identity, snapshot: { ownerId, storeId: identity.store.id, counts, eligibility, loadedAt: Date.now(), finance: finance ?? cached?.finance, financeError: !finance }, busy: false, error: false });
      } catch {
        if (current()) commit({ ...state, busy: false, error: true });
      } finally { parentSignal?.removeEventListener("abort", cancel); }
    },
  };
}

export function merchantHomeActions(state: MerchantHomeState) {
  const approved = state.identity?.store.status === "accepted" && state.identity.merchantStatus === "accepted";
  const current = approved && Boolean(state.snapshot) && !state.error && !state.busy;
  return { addProduct: current, addOffer: current && (state.snapshot?.counts.availableProducts ?? 0) > 0 };
}

export const merchantStoreStatusLabels: Record<ApprovalStatus, string> = {
  accepted: "متجر معتمد", pending: "قيد المراجعة", changes_requested: "بحاجة إلى استكمال", rejected: "غير مقبول",
};
