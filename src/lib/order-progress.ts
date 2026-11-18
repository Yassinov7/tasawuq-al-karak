import type { CustomerOrderView } from "@/lib/customer-orders";

export function storeStepCompleted(step: string, status: string, recorded: boolean) {
  if (step === "delivered") return status === "delivered";
  return recorded && step !== status;
}

/** Partial cancellation is terminal only when the remaining stores and task were actually delivered. */
export function customerDeliveryCompleted(order: CustomerOrderView) {
  const remaining = order.stores.filter(store => !["rejected", "cancelled"].includes(store.storeOrder.status));
  return ["delivered", "partially_cancelled"].includes(order.status) && order.deliveryTask?.status === "delivered"
    && remaining.length > 0 && remaining.every(store => store.storeOrder.status === "delivered");
}
