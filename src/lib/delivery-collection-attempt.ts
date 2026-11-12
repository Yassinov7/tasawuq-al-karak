import { supabase } from "@/lib/supabase";
import { readLocalCache, writeLocalCache, invalidateLocalCache } from "@/lib/local-cache";
import { newIdempotencyKey } from "@/lib/request-key";
import { c3Object, c3Money } from "@/lib/c3-order-contract";
import { getPickupWorkflows } from "@/lib/store-pickups";
import { createFinancialTransport } from "@/lib/financial-transport";

type Intent = { owner: string; task: string; key: string; version: number };
export type CollectionResult = { state: "completed"; task: string; amount: number; kind: "cash_delivery" | "zero_cash_delivery" }
  | { state: "rejected"; code: string } | { state: "unknown" };
const client = supabase as unknown as { rpc(name: "complete_delivery_and_collect_cash" | "recover_delivery_collection", args: Record<string, unknown>):
  PromiseLike<{data: unknown; error: { message: string } | null}> };
const rpc = createFinancialTransport(client);
const locks = new Set<string>();
const cacheKey = (owner: string, task: string) => `delivery-collection:v1:${owner}:${task}`;
async function requireOwner(owner: string) {
  const result = await supabase.auth.getUser();
  if (result.error || result.data.user?.id !== owner) throw Error("تغير الحساب؛ أعد فتح توصيلاتك.");
}
function decode(raw: unknown, task: string): CollectionResult {
  const row = c3Object(raw);
  if (row.state === "unknown") return {state:"unknown"};
  if (row.state === "rejected" && ["pricing_review","pricing_changed","pickups_incomplete","zero_cash_economic_conflict"].includes(String(row.code))) return {state:"rejected",code:String(row.code)};
  if (row.state === "completed" && row.task_id === task && typeof row.amount === "string" && /^\d{1,12}(?:\.\d{1,2})?$/.test(row.amount)) {
    const amount=c3Money(Number(row.amount));
    if (row.kind === "zero_cash_delivery" && amount === 0) return {state:"completed",task,amount,kind:"zero_cash_delivery"};
    if ((row.kind === undefined || row.kind === "cash_delivery") && amount > 0) return {state:"completed",task,amount,kind:"cash_delivery"};
  }
  throw Error("تعذر التحقق من نتيجة التسليم والتحصيل.");
}
async function recoverIntent(intent: Intent) {
  try { return await rpc("recover_delivery_collection", {attempt_key:intent.key,expected_user:intent.owner}); }
  catch { return {data:null,error:{message:"unknown recovery result"}}; }
}
async function read(owner: string, task: string): Promise<Intent | undefined> {
  const value = await readLocalCache<Intent>(cacheKey(owner,task),{requirePersistence:true});
  if (value && (value.owner!==owner || value.task!==task || !Number.isSafeInteger(value.version) || value.version<=0 || typeof value.key!=="string" || !value.key)) throw Error("المحاولة المحفوظة غير صالحة؛ لا تُنشئ قبضًا آخر.");
  return value;
}
async function finish(intent: Intent, result: CollectionResult) {
  await requireOwner(intent.owner);
  if (result.state!=="unknown") await invalidateLocalCache(cacheKey(intent.owner,intent.task),{requirePersistence:true}).catch(()=>undefined);
  return result;
}
/** readOnly never sends a collection. Explicit retry always reuses the frozen old key/version. */
export async function deliveryCollection(owner: string, task: string, version: number, readOnly = false): Promise<CollectionResult> {
  const scope = cacheKey(owner,task);
  if (locks.has(scope)) throw Error("جارٍ التحقق من التسليم والتحصيل.");
  locks.add(scope);
  try {
    await requireOwner(owner);
    let intent = await read(owner,task);
    if (intent) {
      const recovered = await recoverIntent(intent);
      await requireOwner(owner);
      if (recovered.error) return {state:"unknown"};
      const result=decode(recovered.data,task);
      if (result.state!=="unknown") return finish(intent,result);
      if (readOnly) return result;
    } else {
      if (readOnly) return {state:"unknown"};
      const workflow = (await getPickupWorkflows([task],owner))[task];
      if (workflow?.state!=="c4" || !workflow.canCompleteDelivery || workflow.pricingVersion!==version) return {state:"rejected",code:"pricing_changed"};
      intent={owner,task,key:newIdempotencyKey(),version};
    }
    // Re-persist even after a previous write failure left an in-memory copy.
    await writeLocalCache(scope,intent,{requirePersistence:true});
    await requireOwner(owner);
    const response = await rpc("complete_delivery_and_collect_cash",{target_task:task,expected_user:owner,attempt_key:intent.key,expected_pricing_version:intent.version});
    await requireOwner(owner);
    if (!response.error) return finish(intent,decode(response.data,task));
    // SQL/commit errors can be ambiguous; never retire a key on transport alone.
    const recovered=await recoverIntent(intent);
    await requireOwner(owner);
    if (recovered.error) return {state:"unknown"};
    return finish(intent,decode(recovered.data,task));
  } finally { locks.delete(scope); }
}
