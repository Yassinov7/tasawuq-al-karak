import { getC3Contexts } from "@/lib/c3-orders";
import { c3Money } from "@/lib/c3-order-contract";
import { readLegacyDeliveryCollection } from "@/lib/legacy-delivery-collection";
import { collectionFromContext, canProgressDriverCollection, DriverCollectionError, type DriverCollection } from "@/lib/driver-collection";
import { supabase } from "@/lib/supabase";
import { getPickupWorkflows, type PickupWorkflow } from "@/lib/store-pickups";
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
  reference?: string;
  task_id: string;
  customer_order_id: string;
  order_number: number;
  delivery_zone_name_snapshot: string;
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
  reference?: string;
  collection: DriverCollection;
  pickups?: PickupWorkflow;
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
  const rows = data ?? [];
  const contexts = await getC3Contexts(rows.map(row => row.customer_order_id));
  return rows.map(row => ({ ...row, reference: contexts[row.customer_order_id]?.references[`DLV:${row.task_id}`] }));
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
  customerOrderId?: string,
): Promise<DriverAssignedTask[]> {
  await requireDriverIdentity(userId);
  let query = supabase
    .from("delivery_tasks")
    .select(
      "id,driver_id,status,customer_order_id,created_at,accepted_at,picked_up_at,delivered_at,customer_orders!inner(order_number,recipient_name,contact_phone,delivery_address,delivery_zone_name_snapshot,store_orders(id,status,stores(name,address)))",
    )
    .eq("driver_id", userId)
    .in("status", ["accepted", "picked_up", "delivered"] satisfies AssignedTaskStatus[])
    .order("created_at", { ascending: false });
  if (customerOrderId) query = query.eq("customer_order_id", customerOrderId);
  const { data, error } = await query;

  if (error) throw error;
  const rows = data ?? [];
  await requireDriverIdentity(userId);
  if (rows.some(row => row.driver_id !== userId)) throw new Error("تعذر التحقق من إسناد المهمة.");
  const result: DriverAssignedTask[] = [];
  // Bound both RPC and legacy reads below Supabase response limits.
  for (let offset = 0; offset < rows.length; offset += 80) {
    const batch = rows.slice(offset, offset + 80);
    const tasks: DriverAssignedTask[] = batch.map(row => ({ ...row, collection: { state: "unavailable" } }));
    try {
      const contexts = await getC3Contexts(batch.map(row => row.customer_order_id));
      const legacy = tasks.filter(row => !contexts[row.customer_order_id]?.pricing);
      for (const task of tasks) {
        const context = contexts[task.customer_order_id];
        task.reference = context?.references[`DLV:${task.id}`];
        if (context?.pricing) task.collection = collectionFromContext(context);
      }
      if (legacy.length) {
        // These are delivery-time financial snapshots. Never use historical
        // customer_order_totals or add child amounts/fees on the device.
        const obligations = await supabase.from("customer_order_cash_obligations")
          .select("customer_order_id,delivery_task_id,driver_id,currency,collectible_amount")
          .eq("driver_id", userId).in("delivery_task_id", legacy.map(task => task.id));
        if (!obligations.error) for (const task of legacy) {
          const matches = (obligations.data ?? []).filter(row => row.driver_id === userId
            && row.delivery_task_id === task.id && row.customer_order_id === task.customer_order_id);
          if (matches.length === 1 && matches[0].currency === "SYP") {
            try { task.collection = { state: "ready", amount: c3Money(matches[0].collectible_amount), source: "legacy_obligation" }; }
            catch { /* Unknown money remains unavailable, never zero. */ }
          }
        }
        for (const task of legacy) if (task.collection.state === "unavailable") {
          try { task.collection = await readLegacyDeliveryCollection(userId, task.id, task.customer_order_id); }
          catch { /* No local/historical estimate; the scoped server RPC must prove the amount. */ }
        }
      }
    } catch { /* A context read/decoding failure must not fall back to old totals. */ }
    try {
      const pickups = await getPickupWorkflows(batch.map(task => task.id), userId);
      for (const task of tasks) task.pickups = pickups[task.id] ?? { state: "unavailable" };
    } catch { for (const task of tasks) task.pickups = { state: "unavailable" }; }
    await requireDriverIdentity(userId);
    result.push(...tasks);
  }
  return result;
}

async function requireDriverIdentity(expectedUser: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== expectedUser) throw new Error("تغير الحساب أو انتهت الجلسة. أعد فتح توصيلاتك.");
}

export async function updateDeliveryTaskStatus(
  customerOrderId: string,
  status: "picked_up" | "delivered",
  expectedUser: string,
): Promise<void> {
  // Refresh the server amount/review state immediately before a transition.
  // This is client safety, not a replacement for the RPC's assignment/review locks.
  const tasks = await getDriverAssignedTasks(expectedUser, customerOrderId);
  const task = tasks.length === 1 ? tasks[0] : undefined;
  if (!task || !canProgressDriverCollection(task.collection)) throw new DriverCollectionError(task?.collection);
  if (task.pickups?.state !== "legacy") throw new Error(task.pickups?.state === "c4"
    ? "استخدم استلام كل متجر ثم زر التسليم والتحصيل المخصص لهذه المهمة."
    : "تعذر التحقق من مسار الاستلام. حدّث المهمة أولًا.");
  await requireDriverIdentity(expectedUser);
  const { error } = await supabase.rpc("update_delivery_task_status", {
    target_customer_order: customerOrderId,
    next_status: status,
  });

  if (error) throw error;
}
