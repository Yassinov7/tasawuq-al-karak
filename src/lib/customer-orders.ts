import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type CustomerOrder = Tables<"customer_orders">;
export type CustomerOrderTotal = Tables<"customer_order_totals">;
export type CustomerStoreOrder = Tables<"store_orders">;
export type CustomerOrderItem = Tables<"store_order_items">;
export type DeliveryZone = Tables<"delivery_zones">;
export type CustomerAddress = Tables<"customer_addresses"> & {
  zone: DeliveryZone | null;
};

export type CustomerOrderView = CustomerOrder & {
  totals: CustomerOrderTotal[];
  stores: {
    storeOrder: CustomerStoreOrder;
    storeName: string;
    items: CustomerOrderItem[];
  }[];
};

export function formatCurrency(amount: number, currency: "SYP" | "USD") {
  return `${amount.toLocaleString("en-US")} ${currency === "USD" ? "$" : "ل.س"}`;
}

async function attachOrderDetails(
  orders: CustomerOrder[],
): Promise<CustomerOrderView[]> {
  if (orders.length === 0) return [];
  const orderIds = orders.map((order) => order.id);

  const [totalsResult, storeOrdersResult] = await Promise.all([
    supabase
      .from("customer_order_totals")
      .select("*")
      .in("customer_order_id", orderIds),
    supabase
      .from("store_orders")
      .select("*")
      .in("customer_order_id", orderIds)
      .order("created_at", { ascending: true }),
  ]);
  if (totalsResult.error) throw totalsResult.error;
  if (storeOrdersResult.error) throw storeOrdersResult.error;

  const storeOrders = storeOrdersResult.data ?? [];
  const storeIds = [...new Set(storeOrders.map((item) => item.store_id))];
  const storeOrderIds = storeOrders.map((item) => item.id);
  const [storesResult, itemsResult] = await Promise.all([
    storeIds.length > 0
      ? supabase.from("stores").select("id,name").in("id", storeIds)
      : Promise.resolve({ data: [], error: null }),
    storeOrderIds.length > 0
      ? supabase.from("store_order_items").select("*").in("store_order_id", storeOrderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (storesResult.error) throw storesResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const storeNames = new Map((storesResult.data ?? []).map((store) => [store.id, store.name]));
  const itemsByStoreOrder = new Map<string, CustomerOrderItem[]>();
  for (const item of itemsResult.data ?? []) {
    const current = itemsByStoreOrder.get(item.store_order_id) ?? [];
    current.push(item);
    itemsByStoreOrder.set(item.store_order_id, current);
  }

  return orders.map((order) => ({
    ...order,
    totals: (totalsResult.data ?? []).filter((total) => total.customer_order_id === order.id),
    stores: storeOrders
      .filter((storeOrder) => storeOrder.customer_order_id === order.id)
      .map((storeOrder) => ({
        storeOrder,
        storeName: storeNames.get(storeOrder.store_id) ?? "متجر",
        items: itemsByStoreOrder.get(storeOrder.id) ?? [],
      })),
  }));
}

export async function getCustomerOrders(): Promise<CustomerOrderView[]> {
  const { data, error } = await supabase
    .from("customer_orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return attachOrderDetails(data ?? []);
}

export async function getCustomerOrder(orderId: string): Promise<CustomerOrderView | null> {
  const { data, error } = await supabase
    .from("customer_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [order] = await attachOrderDetails([data]);
  return order ?? null;
}

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCustomerAddresses(): Promise<CustomerAddress[]> {
  const { data, error } = await supabase
    .from("customer_addresses")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const addresses = data ?? [];
  const zoneIds = [...new Set(addresses.map((address) => address.delivery_zone_id))];
  const zonesResult = zoneIds.length > 0
    ? await supabase.from("delivery_zones").select("*").in("id", zoneIds)
    : { data: [], error: null };
  if (zonesResult.error) throw zonesResult.error;

  const zones = new Map((zonesResult.data ?? []).map((zone) => [zone.id, zone]));
  return addresses.map((address) => ({
    ...address,
    zone: zones.get(address.delivery_zone_id) ?? null,
  }));
}

export async function saveCustomerAddress(input: {
  id: string | null;
  title: string;
  recipientName: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryZoneId: string;
  mapsUrl: string;
  isDefault: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc("save_customer_address", {
    target_address: input.id,
    input_title: input.title,
    input_recipient_name: input.recipientName,
    input_contact_phone: input.contactPhone,
    input_delivery_address: input.deliveryAddress,
    input_delivery_zone: input.deliveryZoneId,
    input_maps_url: input.mapsUrl,
    input_is_default: input.isDefault,
  });
  if (error) throw error;
  return data;
}

export async function setDefaultCustomerAddress(addressId: string): Promise<void> {
  const { error } = await supabase.rpc("set_default_customer_address", {
    target_address: addressId,
  });
  if (error) throw error;
}

export async function deleteCustomerAddress(addressId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_customer_address", {
    target_address: addressId,
  });
  if (error) throw error;
}

export async function createCustomerOrder(input: {
  recipientName: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryZoneId: string;
  customerNote: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_order_from_cart", {
    input_recipient_name: input.recipientName,
    input_contact_phone: input.contactPhone,
    input_delivery_address: input.deliveryAddress,
    input_delivery_zone: input.deliveryZoneId,
    input_customer_note: input.customerNote,
  });
  if (error) throw error;
  return data;
}

export async function cancelCustomerOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_customer_order", {
    target_customer_order: orderId,
  });
  if (error) throw error;
}
