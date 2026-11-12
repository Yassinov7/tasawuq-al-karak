import { purchaseAvailabilityMessage } from "@/lib/purchase-availability";
import { supabase } from "@/lib/supabase";
import { c3Object, c3Number, c3Money, c3TotalMatches, decodeC3Context, type C3Context, type C3Quote } from "@/lib/c3-order-contract";
import { readLocalCache, writeLocalCache, invalidateLocalCache } from "@/lib/local-cache";
import { newIdempotencyKey } from "@/lib/request-key";
import { createFinancialTransport } from "@/lib/financial-transport";

type C3RpcName = "recover_c3_order_request" | "get_c3_delivery_zones" | "save_c3_delivery_zone" | "get_c3_order_context" | "create_c3_order_from_cart" | "quote_c3_cart" | "get_c3_pricing_exceptions";
// Temporary handwritten adapter for applied C3; replace only after official
// schema type generation and review. This cast is not generated schema evidence.
const client = supabase as unknown as { rpc(name: C3RpcName, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> };
const rpc = createFinancialTransport(client);
export async function c3Rpc(name: C3RpcName, args?: Record<string, unknown>, signal?: AbortSignal) {
  const result = await rpc(name, args ?? {}, signal);
  if (result.error) {
    if (result.error.message.includes("C8_STORE_UNAVAILABLE")) throw new Error("أحد المتاجر غير متاح لاستقبال طلبات جديدة. راجع السلة وأزل المتجر غير المتاح، ثم حدّث عرض السعر قبل التأكيد.");
    if (result.error.message.includes("C3_ACCOUNT_CHANGED")) throw new Error("تغير الحساب؛ لم نؤكد أي إجراء للحساب الجديد.");
    if (result.error.message.includes("C3_PRICE_CHANGED")) throw new Error("تغير السعر في الخادم. حدّث ملخص الطلب ثم راجعه قبل التأكيد.");
    throw new Error(result.error.code === "42883" || result.error.code === "PGRST202" ? "خدمة الطلبات غير متاحة حاليًا. حاول مرة أخرى لاحقًا." : "تعذر تأكيد بيانات الطلب. حدّث السجل وتحقق من الاتصال.");
  }
  return result.data;
}
export async function getC3Contexts(ids: string[], signal?: AbortSignal): Promise<Record<string, C3Context>> {
  const result: Record<string, C3Context> = {};
  const unique = [...new Set(ids)];
  for (let offset = 0; offset < unique.length; offset += 80) {
    const rows = c3Object(await c3Rpc("get_c3_order_context", { target_orders: unique.slice(offset, offset + 80) }, signal));
    for (const [id, row] of Object.entries(rows)) result[id] = decodeC3Context(row);
  }
  return result;
}
export async function quoteC3Cart(zoneId: string, expectedUser: string): Promise<C3Quote> {
  await requireOwner(expectedUser);
  const row = c3Object(await c3Rpc("quote_c3_cart", { target_zone: zoneId, expected_user: expectedUser }));
  const quote = { items_amount: c3Money(row.items_amount), delivery_fee: c3Number(row.delivery_fee), total: c3Money(row.total), store_count: c3Number(row.store_count), cart_signature: row.cart_signature };
  if (!c3TotalMatches(quote.items_amount, quote.delivery_fee, quote.total) || quote.store_count === 0 || typeof quote.cart_signature !== "string" || !quote.cart_signature || quote.cart_signature.length > 1000000) throw new Error("ملخص الطلب غير متسق.");
  await requireOwner(expectedUser);
  return { ...quote, cart_signature: quote.cart_signature };
}
export type C3CheckoutArgs = {
  input_recipient_name: string; input_contact_phone: string; input_delivery_address: string;
  input_delivery_zone: string; input_customer_note: string; expected_total: number;
  expected_user: string; expected_cart_signature: string;
};
type Attempt = { version: 2; owner: string; key: string; args: C3CheckoutArgs };
export type C3CheckoutResult =
  | { kind: "created" | "recovered"; orderId: string }
  | { kind: "pending"; recipient: string; expectedTotal: number }
  | { kind: "rejected"; message: string }
  | { kind: "none" };
const locks = new Set<string>();
// v2 deliberately does not reinterpret predeployment provisional v1 caches.
const keyFor = (owner: string) => `c3-checkout-v2:${owner}`;
async function requireOwner(owner: string) {
  const identity = await supabase.auth.getUser();
  if (identity.error || !identity.data.user || identity.data.user.id !== owner) throw new Error("تغير الحساب أو انتهت الجلسة؛ أعد فتح إتمام الطلب.");
}
async function exclusive(owner: string, work: () => Promise<C3CheckoutResult>): Promise<C3CheckoutResult> {
  if (locks.has(owner)) throw new Error("جارٍ التحقق من محاولة الطلب.");
  locks.add(owner);
  try { await requireOwner(owner); return await work(); }
  finally { locks.delete(owner); }
}
async function readAttempt(owner: string): Promise<Attempt | undefined> {
  // Storage failure is UNKNOWN, never evidence that no previous request exists.
  let attempt: Attempt | undefined;
  try { attempt = await readLocalCache<Attempt>(keyFor(owner), { requirePersistence: true }); }
  catch { throw new Error("تعذر قراءة محاولة الطلب المحفوظة. لا تنشئ محاولة أخرى قبل التحقق من النتيجة."); }
  if (attempt && (attempt.version !== 2 || attempt.owner !== owner || attempt.args?.expected_user !== owner || typeof attempt.key !== "string" || typeof attempt.args.expected_cart_signature !== "string")) throw new Error("تعذر قراءة محاولة الطلب المحفوظة بأمان. لا تُنشئ محاولة أخرى قبل التحقق.");
  return attempt;
}
function rejectionMessage(code: unknown): string {
  if (code === "C8_STORE_UNAVAILABLE") return "أحد المتاجر لم يعد متاحًا لاستقبال طلبات جديدة. لم يُنشأ طلب؛ راجع السلة ثم حدّث السعر وأكد محاولة جديدة.";
  if (code === "C3_CART_CHANGED") return "تغير محتوى السلة أو تسعيرها. لم يُنشأ طلب لهذه المحاولة؛ حدّث السلة وأكد طلبًا جديدًا.";
  if (code === "C3_PRICE_CHANGED") return "تغير السعر. لم يُنشأ طلب لهذه المحاولة؛ راجع الملخص الجديد.";
  return "لم يُنشأ طلب لهذه المحاولة. تحقق من المنطقة وتوفر المنتجات والكميات ثم راجع الملخص.";
}
async function finish(owner: string, row: Record<string, unknown>, kind: "created" | "recovered"): Promise<C3CheckoutResult> {
  await requireOwner(owner);
  if (row.state === "completed" && typeof row.order_id === "string") {
    // A cleanup failure can only cause another RECOVERY, never a new-key resend.
    await invalidateLocalCache(keyFor(owner)).catch(() => undefined);
    return { kind, orderId: row.order_id };
  }
  if (row.state === "rejected" && ["C3_CART_CHANGED", "C3_PRICE_CHANGED", "C3_ORDER_REJECTED", "C8_STORE_UNAVAILABLE"].includes(String(row.code))) {
    await invalidateLocalCache(keyFor(owner)).catch(() => undefined);
    return { kind: "rejected", message: rejectionMessage(row.code) };
  }
  throw new Error("تعذر تأكيد نتيجة الطلب. استخدم التحقق من المحاولة السابقة.");
}
async function inspect(owner: string, attempt: Attempt): Promise<C3CheckoutResult> {
  const row = c3Object(await c3Rpc("recover_c3_order_request", { request_key_value: attempt.key, expected_user: owner }));
  await requireOwner(owner);
  if (row.state === "unknown") return { kind: "pending", recipient: attempt.args.input_recipient_name, expectedTotal: c3Money(attempt.args.expected_total) };
  return finish(owner, row, "recovered");
}
/** Read-only recovery, independent of cart existence, quotes and current delivery fields. */
export async function recoverC3Checkout(expectedUser: string): Promise<C3CheckoutResult> {
  return exclusive(expectedUser, async () => {
    const attempt = await readAttempt(expectedUser);
    return attempt ? inspect(expectedUser, attempt) : { kind: "none" };
  });
}
async function send(attempt: Attempt, resuming: boolean): Promise<C3CheckoutResult> {
  await requireOwner(attempt.owner);
  try { await writeLocalCache(keyFor(attempt.owner), attempt, { requirePersistence: true }); }
  catch { throw new Error("تعذر حفظ محاولة الطلب على الجهاز. تحقق من التخزين ثم أعد المحاولة السابقة."); }
  const response = await rpc("create_c3_order_from_cart", { ...attempt.args, request_key_value: attempt.key });
  if (response.error) {
    // Only a persisted terminal JSON result retires an intent. A SQL/transport
    // error may have rolled back or lost its response; retain the exact key.
    const availability = purchaseAvailabilityMessage(response.error);
    if (response.error.message.includes("C3_ACCOUNT_CHANGED")) throw new Error("تغير الحساب؛ أوقف الخادم الطلب قبل تنفيذه للحساب الجديد.");
    throw new Error(availability ?? "تعذر تأكيد الطلب. تحقّق من المحاولة السابقة قبل إنشاء طلب آخر.");
  }
  const row = c3Object(response.data);
  if (row.state === "completed" && typeof row.replayed !== "boolean") throw new Error("تعذر تأكيد نتيجة المحاولة.");
  return finish(attempt.owner, row, resuming || row.replayed === true ? "recovered" : "created");
}
/** A pending intent is NEVER identified using amount/address equality. */
export async function submitC3Order(args: C3CheckoutArgs): Promise<C3CheckoutResult> {
  return exclusive(args.expected_user, async () => {
    const previous = await readAttempt(args.expected_user);
    if (previous) return inspect(args.expected_user, previous);
    c3Money(args.expected_total);
    if (!args.expected_cart_signature || args.expected_cart_signature.length > 1000000) throw new Error("حدّث ملخص السلة قبل التأكيد.");
    const attempt: Attempt = { version: 2, owner: args.expected_user, key: newIdempotencyKey(), args: { ...args } };
    return send(attempt, false);
  });
}
/** Explicit user action: retry the frozen OLD intent, never today's edited cart. */
export async function retryC3Checkout(expectedUser: string): Promise<C3CheckoutResult> {
  return exclusive(expectedUser, async () => {
    const attempt = await readAttempt(expectedUser);
    if (!attempt) return { kind: "none" };
    const result = await inspect(expectedUser, attempt);
    return result.kind === "pending" ? send(attempt, true) : result;
  });
}
