import type { AccountRole } from "@/lib/account-routing";
import type { NotificationData } from "@/context/NotificationContext";

export type NotificationDestination =
  | { type: "none" }
  | { type: "customer-order"; orderId: string }
  | { type: "product"; productId: string }
  | { type: "store"; storeId: string }
  | { type: "offers" }
  | { type: "merchant-orders" }
  | { type: "merchant-home" }
  | { type: "merchant-finance" }
  | { type: "driver-home" }
  | { type: "driver-orders" }
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

  if (role === "driver") {
    if (route === "/driver/orders" || data?.deliveryTaskId) return { type: "driver-orders" };
    if (route === "/driver") return { type: "driver-home" };
    return { type: "none" };
  }

  if (role === "merchant") {
    if (route === "/merchant/finance") return { type: "merchant-finance" };
    if (route === "/merchant/orders" || data?.storeOrderId || data?.orderId) {
      return { type: "merchant-orders" };
    }
    if (route === "/merchant") return { type: "merchant-home" };
    return { type: "none" };
  }

  if (role === "admin") return route === "/admin" ? { type: "admin-home" } : { type: "none" };

  const orderId = data?.orderId ?? getOrderIdFromRoute(data);
  if (orderId) return { type: "customer-order", orderId };
  if (data?.productId) return { type: "product", productId: data.productId };
  if (data?.storeId) return { type: "store", storeId: data.storeId };
  if (data?.offerId || route === "/home/offers") return { type: "offers" };
  if (route === "/home") return { type: "customer-home" };
  return { type: "none" };
}
