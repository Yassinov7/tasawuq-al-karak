import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type DriverApplication = Pick<
  Tables<"driver_applications">,
  | "available_hours"
  | "contact_phone"
  | "full_name"
  | "is_available"
  | "status"
  | "vehicle_type"
>;

export type AvailableDeliveryTask = {
  task_id: string;
  customer_order_id: string;
  order_number: number;
  delivery_zone_name_snapshot: string;
  delivery_address: string;
  created_at: string;
  store_count: number;
};

type AssignedTaskStatus = Extract<
  Tables<"delivery_tasks">["status"],
  "accepted" | "picked_up" | "delivered"
>;

export type DriverAssignedTask = Pick<
  Tables<"delivery_tasks">,
  | "accepted_at"
  | "created_at"
  | "customer_order_id"
  | "delivered_at"
  | "id"
  | "picked_up_at"
  | "status"
> & {
  customer_orders: {
    order_number: number;
    recipient_name: string;
    contact_phone: string;
    delivery_address: string;
    delivery_zone_name_snapshot: string;
    store_orders: {
      id: string;
      status: Tables<"store_orders">["status"];
      stores: {
        name: string;
        address: string;
      } | null;
    }[];
  };
};

export async function getDriverApplication(
  userId: string,
): Promise<DriverApplication | null> {
  const { data, error } = await supabase
    .from("driver_applications")
    .select("available_hours,contact_phone,full_name,is_available,status,vehicle_type")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAvailableDeliveryTasks(): Promise<
  AvailableDeliveryTask[]
> {
  const { data, error } = await supabase.rpc("list_available_delivery_tasks");

  if (error) throw error;
  return data ?? [];
}

export async function setDriverAvailability(
  isAvailable: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("set_driver_availability", {
    input_available: isAvailable,
  });

  if (error) throw error;
}

export async function acceptDeliveryTask(
  customerOrderId: string,
): Promise<void> {
  const { error } = await supabase.rpc("accept_delivery_task", {
    target_customer_order: customerOrderId,
  });

  if (error) throw error;
}

export async function getDriverAssignedTasks(
  userId: string,
): Promise<DriverAssignedTask[]> {
  const { data, error } = await supabase
    .from("delivery_tasks")
    .select(
      "id,status,customer_order_id,created_at,accepted_at,picked_up_at,delivered_at,customer_orders!inner(order_number,recipient_name,contact_phone,delivery_address,delivery_zone_name_snapshot,store_orders(id,status,stores(name,address)))",
    )
    .eq("driver_id", userId)
    .in("status", ["accepted", "picked_up", "delivered"] satisfies AssignedTaskStatus[])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as DriverAssignedTask[];
}

export async function updateDeliveryTaskStatus(
  customerOrderId: string,
  status: "picked_up" | "delivered",
): Promise<void> {
  const { error } = await supabase.rpc("update_delivery_task_status", {
    target_customer_order: customerOrderId,
    next_status: status,
  });

  if (error) throw error;
}
