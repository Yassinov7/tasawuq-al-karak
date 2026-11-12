/** Handwritten runtime C3 contracts. Official post-deployment database types are still pending. */
export type C3Pricing = {
  original: { approved_total: number; original_delivery_fee: number };
  current: { items_amount: number; delivery_fee: number; total: number; version: number; review_required: boolean };
};
export type C3Context = { references: Record<string, string>; pricing: C3Pricing | null };
export type C3Quote = { items_amount: number; delivery_fee: number; total: number; store_count: number; cart_signature: string };

export function c3Fee(base: number, uplift: number, stores: number): number {
  if (![base, uplift, stores].every(Number.isSafeInteger) || base < 0 || uplift < 0 || stores < 0) throw new Error("تسعير توصيل غير صالح.");
  const result = stores === 0 ? 0 : base + Math.max(0, stores - 1) * uplift;
  if (!Number.isSafeInteger(result) || result > 999999999999) throw new Error("المبلغ يتجاوز الحد المدعوم.");
  return result;
}
export function c3CanApply(original: number, current: number, proposed: number): boolean {
  try { return c3Cents(proposed) <= Math.min(c3Cents(original), c3Cents(current)); } catch { return false; }
}
export function c3Ready(statuses: string[], blocked: boolean, taskExists: boolean): boolean {
  const active = statuses.filter(status => status !== "rejected" && status !== "cancelled");
  return !blocked && !taskExists && active.length > 0 && active.every(status => status === "ready_for_pickup");
}
export function c3Number(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 999999999999) throw new Error("بيانات المبلغ غير مكتملة.");
  return value;
}
/** Merchandise keeps the existing numeric(14,2) contract; never round an input. */
export function c3Money(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 999999999999.99 || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) throw new Error("مبلغ غير صالح؛ الدقة منزلتان عشريتان.");
  return value;
}
export function c3Cents(value: unknown): number {
  const [whole, fraction = ""] = String(c3Money(value)).split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function c3TotalMatches(items: number, fee: number, total: number): boolean {
  return c3Cents(items) + c3Cents(fee) === c3Cents(total);
}
export function c3Object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("بيانات C3 غير مكتملة.");
  return value as Record<string, unknown>;
}
export function decodeC3Context(value: unknown): C3Context {
  const row = c3Object(value);
  const refs = c3Object(row.references);
  const references: Record<string, string> = {};
  for (const [key, ref] of Object.entries(refs)) {
    if (typeof ref !== "string" || !/^(ORD|SOR|TSK)-\d{6,}$/.test(ref)) throw new Error("مرجع طلب غير صالح.");
    references[key] = ref;
  }
  if (row.pricing === null) return { references, pricing: null };
  const pricing = c3Object(row.pricing), original = c3Object(pricing.original), current = c3Object(pricing.current);
  if (typeof current.review_required !== "boolean") throw new Error("حالة تسعير غير مكتملة.");
  const items = c3Money(current.items_amount), fee = c3Number(current.delivery_fee), total = c3Money(current.total);
  if (!c3TotalMatches(items, fee, total)) throw new Error("إجمالي طلب غير متسق.");
  return { references, pricing: { original: { approved_total: c3Money(original.approved_total), original_delivery_fee: c3Number(original.original_delivery_fee) },
    current: { items_amount: items, delivery_fee: fee, total, version: c3Number(current.version), review_required: current.review_required } } };
}

export type C3PricingException = {
  customer_order_id: string; public_reference: string; approved_total: string;
  current_amount: string; proposed_total: string; difference: string; reason: string;
  decided_at: string; recorded_at: string; updated_at: string;
};
export function decodeC3Exception(value: unknown): C3PricingException {
  const row = c3Object(value);
  for (const key of ["customer_order_id", "public_reference", "reason", "decided_at", "recorded_at", "updated_at"] as const) {
    if (typeof row[key] !== "string" || !row[key]) throw new Error("بيانات المراجعة غير مكتملة.");
  }
  for (const key of ["approved_total", "current_amount", "proposed_total", "difference"] as const) {
    if (typeof row[key] !== "string" || !/^-?\d+(?:\.\d{1,2})?$/.test(row[key])) throw new Error("مبلغ المراجعة غير صالح.");
  }
  for (const key of ["decided_at", "recorded_at", "updated_at"] as const) if (!Number.isFinite(Date.parse(String(row[key])))) throw new Error("تاريخ المراجعة غير صالح.");
  return row as C3PricingException;
}
