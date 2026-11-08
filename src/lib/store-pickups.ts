import { supabase } from "@/lib/supabase";
import { c3Object } from "@/lib/c3-order-contract";
import { createFinancialTransport } from "@/lib/financial-transport";

export type PickupWorkflow = { state: "legacy" | "unavailable" }
  | { state: "c4"; confirmed: string[]; canConfirmPickup: boolean; canCompleteDelivery: boolean; pricingVersion: number; reason: string | null };
type PickupRpc = "get_c4_pickup_context" | "confirm_c4_store_pickup";
// Handwritten boundary for LOCAL, unapplied C4 SQL. Not generated database types.
const api = supabase as unknown as { rpc(name: PickupRpc, args: Record<string, unknown>): PromiseLike<{
  data: unknown; error: { code?: string; message: string } | null;
}> };
const rpc = createFinancialTransport(api);
async function owner(expectedUser: string) {
  const result = await supabase.auth.getUser();
  if (result.error || result.data.user?.id !== expectedUser) throw Error("تغير الحساب؛ أعد فتح توصيلاتك.");
}
export function decodePickupWorkflow(raw: unknown): PickupWorkflow {
  const row = c3Object(raw);
  if (row.mode === "legacy") return { state: "legacy" };
  if (row.mode !== "c4" || typeof row.can_confirm_pickup !== "boolean" || typeof row.can_complete_delivery !== "boolean"
    || !Number.isSafeInteger(row.pricing_version) || Number(row.pricing_version)<=0
    || !(row.reason === null || typeof row.reason === "string")
    || !Array.isArray(row.confirmed) || row.confirmed.some(id => typeof id !== "string")
    || new Set(row.confirmed).size !== row.confirmed.length) throw Error("بيانات الاستلام غير مكتملة.");
  return { state: "c4", confirmed: row.confirmed, canConfirmPickup: row.can_confirm_pickup,
    canCompleteDelivery: row.can_complete_delivery, pricingVersion: Number(row.pricing_version), reason: row.reason };

}
export async function getPickupWorkflows(taskIds: string[], expectedUser: string): Promise<Record<string, PickupWorkflow>> {
  await owner(expectedUser);
  if (taskIds.length > 80) throw Error("عدد المهام يتجاوز حد القراءة.");
  const result = await rpc("get_c4_pickup_context", { target_tasks: taskIds, expected_user: expectedUser });
  await owner(expectedUser);
  if (result.error) {
    // Only a confirmed absent additive RPC means pre-C4; transport failure is UNKNOWN.
    if (result.error.code === "PGRST202") return Object.fromEntries(taskIds.map(id => [id, { state: "legacy" as const }]));
    throw Error("تعذر تحديث حالات استلام المتاجر.");
  }
  const data = c3Object(result.data);
  return Object.fromEntries(taskIds.map(id => [id, data[id] === undefined ? { state: "unavailable" as const } : decodePickupWorkflow(data[id])]));
}
const locks = new Set<string>();
export async function confirmStorePickup(taskId: string, storeOrderId: string, expectedUser: string): Promise<"confirmed" | "unknown"> {
  const key = `${expectedUser}:${taskId}`;
  if (locks.has(key)) throw Error("جارٍ التحقق من الاستلام.");
  locks.add(key);
  try {
    await owner(expectedUser);
    const before = (await getPickupWorkflows([taskId], expectedUser))[taskId];
    if (before?.state !== "c4") throw Error("مسار استلام C4 غير متاح لهذه المهمة.");
    if (before.confirmed.includes(storeOrderId)) return "confirmed";
    if (!before.canConfirmPickup) throw Error("استلام المتجر غير مسموح حاليًا؛ حدّث المهمة.");
    // The immutable task/store pair is the natural retry key; never mass-pickup.
    try { await rpc("confirm_c4_store_pickup", { target_task: taskId, target_store_order: storeOrderId, expected_user: expectedUser }); }
    catch { /* Read recovery below decides; no automatic resend. */ }
    await owner(expectedUser);
    try {
      const after = (await getPickupWorkflows([taskId], expectedUser))[taskId];
      return after?.state === "c4" && after.confirmed.includes(storeOrderId) ? "confirmed" : "unknown";
    } catch { await owner(expectedUser); return "unknown"; }
  } finally { locks.delete(key); }
}
