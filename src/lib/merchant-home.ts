import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

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
type Snapshot = { ownerId: string; storeId: string; counts: MerchantHomeCounts; loadedAt: number };
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

async function readIdentity(ownerId: string): Promise<MerchantHomeIdentity | null> {
  const merchant = await supabase.from("merchants").select("id,status")
    .eq("owner_user_id", ownerId).maybeSingle();
  if (merchant.error) throw merchant.error;
  if (!merchant.data) return null;
  const store = await supabase.from("stores").select("id,name,status")
    .eq("merchant_id", merchant.data.id).maybeSingle();
  if (store.error) throw store.error;
  return store.data ? { merchantId: merchant.data.id, merchantStatus: merchant.data.status, store: store.data } : null;
}

async function readCounts(storeId: string): Promise<MerchantHomeCounts> {
  const now = new Date().toISOString();
  const orderCount = (status: Tables<"store_orders">["status"]) => supabase.from("store_orders")
    .select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", status);
  const results = await Promise.all([
    orderCount("awaiting_review"), orderCount("preparing"), orderCount("ready_for_pickup"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("store_offers").select("id", { count: "exact", head: true })
      .eq("store_id", storeId).eq("is_active", true).lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gt.${now}`),
    // The offer editor only accepts displayed products, without loading details.
    supabase.from("products").select("id", { count: "exact", head: true })
      .eq("store_id", storeId).eq("is_available", true),
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
  let revision = 0;
  let catalogueRevision = catalogueRevisions.get(ownerId) ?? 0;
  return {
    activate() { focused = true; },
    deactivate() { focused = false; revision++; },
    async refresh(force = false): Promise<void> {
      if (!focused) return;
      const hadError = state.error;
      const request = ++revision;
      const current = () => focused && request === revision;
      const commit = (next: MerchantHomeState) => { state = next; publish(next); };
      commit({ ...state, busy: true, error: false });
      try {
        const identity = await readIdentity(ownerId);
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
          && age >= 0 && age < merchantHomeFreshnessMs) {
          commit({ ...state, busy: false }); return;
        }
        const nextCatalogueRevision = catalogueRevisions.get(ownerId) ?? 0;
        const counts = await readCounts(identity.store.id);
        if (!current()) return;
        catalogueRevision = nextCatalogueRevision;
        commit({ identity, snapshot: { ownerId, storeId: identity.store.id, counts, loadedAt: Date.now() }, busy: false, error: false });
      } catch {
        if (current()) commit({ ...state, busy: false, error: true });
      }
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
