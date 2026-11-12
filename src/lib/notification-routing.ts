import type { AccountRole } from "@/lib/account-routing";
import type { NotificationData } from "@/context/NotificationContext";

export type NotificationDestination =
  | {type:"admin-application";applicationId:string;role:"merchant"|"driver"}
  | {type:"invoice";invoiceId:string}
  | {type:"application-status"}
  | {type:"admin-order";orderId:string}
  | { type: "none" }
  | { type: "customer-order"; orderId: string }
  | { type: "product"; productId: string }
  | { type: "store"; storeId: string }
  | { type: "offers" }
  | { type: "merchant-orders"; storeOrderId?:string }
  | { type: "merchant-home" }
  | { type: "merchant-finance" }
  | { type: "driver-home";taskId?:string }
  | { type: "driver-orders"; taskId?:string }
  | { type: "admin-home" }
  | { type: "customer-home" };

function getRoutePath(data: NotificationData | undefined) {
  const value = data?.route ?? data?.url;
  return value?.split("?")[0] ?? "";
}

function getOrderIdFromRoute(data: NotificationData | undefined) {
  const value = data?.route ?? data?.url;
  if (!value || getRoutePath(data) !== "/order-details") return undefined;

  const match = value.match(/[?&]id=([^&#]+)/);
  if (!match?.[1]) return undefined;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

/**
 * Resolves only destinations that are valid for the notification recipient's
 * role. This keeps legacy order IDs from sending drivers to customer routes.
 */
export function resolveNotificationDestination(
  role: AccountRole,
  data: NotificationData | undefined,
): NotificationDestination {
  const route = getRoutePath(data);
  const validId=(v:string|undefined)=>!!v&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  if(role==="admin"&&validId(data?.applicationId)&&(data?.applicationRole==="merchant"||data?.applicationRole==="driver"))return {type:"admin-application",applicationId:data!.applicationId!,role:data.applicationRole};
  if(validId(data?.invoiceId))return {type:"invoice",invoiceId:data!.invoiceId!};
  if(route==="/application-status"&&(role==="merchant"||role==="driver"))return {type:"application-status"};
  if(role==="admin"&&validId(data?.orderId))return {type:"admin-order",orderId:data!.orderId!};

  if (role === "driver") {
    if(route==="/driver")return {type:"driver-home",...(validId(data?.deliveryTaskId)?{taskId:data!.deliveryTaskId!}:{})};
    if(route==="/driver/task-details"&&!validId(data?.deliveryTaskId))return {type:"none"};
    if (route === "/driver/orders" || data?.deliveryTaskId) return { type: "driver-orders", ...(validId(data?.deliveryTaskId)?{taskId:data!.deliveryTaskId!}:{}) };
    return { type: "none" };
  }

  if (role === "merchant") {
    if (route === "/merchant/finance") return { type: "merchant-finance" };
    if (route === "/merchant/orders" || data?.storeOrderId || data?.orderId) {
      return { type: "merchant-orders", ...(validId(data?.storeOrderId)?{storeOrderId:data!.storeOrderId!}:{}) };
    }
    if (route === "/merchant") return { type: "merchant-home" };
    return { type: "none" };
  }

  if (role === "admin") return route === "/admin" ? { type: "admin-home" } : { type: "none" };

  const orderId = data?.orderId ?? getOrderIdFromRoute(data);
  if (validId(orderId)) return { type: "customer-order", orderId:orderId! };
  if (validId(data?.productId)) return { type: "product", productId: data!.productId! };
  if (validId(data?.storeId)) return { type: "store", storeId: data!.storeId! };
  if (data?.offerId || route === "/home/offers") return { type: "offers" };
  if (route === "/home") return { type: "customer-home" };
  return { type: "none" };
}
