import type { DriverAssignedTask, DriverOrderItem } from "@/lib/driver-deliveries";

export const driverTaskLabels: Record<DriverAssignedTask["status"], string> = {
  pending_stores: "بانتظار تجهيز المتاجر", available: "متاحة", accepted: "بانتظار استلام المتاجر",
  picked_up: "قيد التوصيل", delivered: "تم التسليم", cancelled: "أُلغيت المهمة",
};
export const driverNumber = (value: number) => value.toLocaleString("ar-SY", { maximumFractionDigits: 3 });
function countLabel(value: number, single: string, dual: string, plural: string) {
  return value === 1 ? `${single} واحد` : value === 2 ? dual : `${driverNumber(value)} ${value >= 3 && value <= 10 ? plural : single}`;
}
export function deliveryStores(task: DriverAssignedTask) {
  return task.customer_orders.store_orders.filter(store => !["rejected", "cancelled"].includes(store.status));
}
export function driverItemSummary(items: DriverOrderItem[]) {
  const quantities = new Map<string, number>();
  const products = new Set<string>();
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) return null;
    const unit = item.selling_unit_snapshot.trim();
    if (!unit) return null;
    const total = (quantities.get(unit) ?? 0) + Math.round(item.quantity * 1000);
    if (!Number.isSafeInteger(total)) return null;
    quantities.set(unit, total);
    products.add(item.product_id ?? item.id);
  }
  const quantity = [...quantities].map(([unit, total]) => `${driverNumber(total / 1000)} ${unit}`).join(" + ");
  return { count: products.size, quantity, text: `${countLabel(products.size, "صنف", "صنفان", "أصناف")}${quantity ? ` · ${quantity}` : ""}` };
}
export function driverTaskSummary(task: DriverAssignedTask) {
  const stores = deliveryStores(task);
  const items = task.productsState === "ready" && stores.every(store => Array.isArray(store.items))
    ? driverItemSummary(stores.flatMap(store => store.items ?? [])) : null;
  return `${countLabel(stores.length, "متجر", "متجران", "متاجر")}${items ? ` · ${items.text}` : " · تفاصيل المنتجات غير متاحة"}`;
}
export function driverNextStep(task: DriverAssignedTask, stale: boolean) {
  if (stale || task.collection.state !== "ready" && task.status !== "delivered") return "مراجعة المهمة";
  if (task.status === "delivered") return "تفاصيل التوصيل";
  if (task.status === "accepted") return "عرض نقاط الاستلام";
  if (task.status === "picked_up") return "مراجعة التسليم والتحصيل";
  return "تفاصيل المهمة";
}
