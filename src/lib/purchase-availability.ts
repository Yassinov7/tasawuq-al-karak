export const UNAVAILABLE_PURCHASE_MESSAGE = "يوجد منتج أو عرض لم يعد متاحًا. حدّث السلة وأزل العناصر غير المتاحة قبل المتابعة.";

export function purchaseAvailabilityMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const value = error as { code?: unknown; message?: unknown };
  if (value.code === "P1301" || (typeof value.message === "string" && (
    value.message === "product_unavailable"
    || /cart items are unavailable|selected offers are no longer available|offer is unavailable|offer products are unavailable/.test(value.message)
  ))) return UNAVAILABLE_PURCHASE_MESSAGE;
  return null;
}
