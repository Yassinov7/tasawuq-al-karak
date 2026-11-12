import { getC3Contexts } from "@/lib/c3-orders";
import { collectionFromContext, type DriverCollection } from "@/lib/driver-collection";
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

export type DriverDestination = Pick<Tables<"customer_orders">,
  "recipient_name" | "contact_phone" | "delivery_address" | "delivery_zone_name_snapshot"
>;

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
  customer_orders: DriverDestination & {
    order_number: number;
    customer_note: string;
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
  signal?: AbortSignal,
): Promise<DriverApplication | null> {
  assertReadActive(signal);
  const query = supabase
    .from("driver_applications")
    .select("available_hours,contact_phone,full_name,is_available,status,vehicle_type")
    .eq("user_id", userId);
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  assertReadActive(signal);

  if (error) throw error;
  return data;
}

export async function getAvailableDeliveryTasks(signal?: AbortSignal): Promise<
  AvailableDeliveryTask[]
> {
  assertReadActive(signal);
  const query = supabase.rpc("list_available_delivery_tasks");
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  assertReadActive(signal);

  if (error) throw error;
  const rows = data ?? [];
  const contexts = await getC3Contexts(rows.map(row => row.customer_order_id), signal);
  assertReadActive(signal);
  return rows.map(row => ({ ...row, reference: contexts[row.customer_order_id]?.references[`TSK:${row.task_id}`] }));
}

export async function setDriverAvailability(
  isAvailable: boolean,
  expectedUser: string,
): Promise<void> {
  await requireDriverIdentity(expectedUser);
  const { error } = await supabase.rpc("set_driver_availability", {
    input_available: isAvailable,
  });

  if (error) throw error;
}

export async function acceptDeliveryTask(
  customerOrderId: string,
  expectedUser: string,
): Promise<void> {
  await requireDriverIdentity(expectedUser);
  const { error } = await supabase.rpc("accept_delivery_task", {
    target_customer_order: customerOrderId,
  });

  if (error) throw error;
}

export type DriverHomeTask = {
  id: string;
  orderId: string;
  orderNumber: number;
  reference?: string;
  status: "accepted" | "picked_up";
  destination: DriverDestination;
  pickupStores: DriverAssignedTask["customer_orders"]["store_orders"];
  collection: DriverCollection;
};

/** One task and the exact active count. Only the leading task needs pricing. */
export async function getDriverHomeAssignment(userId: string, signal: AbortSignal): Promise<{ count: number; task: DriverHomeTask | null }> {
  assertReadActive(signal);
  await requireDriverIdentity(userId);
  assertReadActive(signal);
  const { data, count, error } = await supabase.from("delivery_tasks")
    .select("id,driver_id,status,customer_order_id,customer_orders!inner(order_number,delivery_zone_name_snapshot,recipient_name,contact_phone,delivery_address,store_orders(id,status,stores(name,address)))", { count: "exact" })
    .eq("driver_id", userId).in("status", ["accepted", "picked_up"])
    .order("status", { ascending: false })
    .order("accepted_at", { ascending: true, nullsFirst: false })
    .order("id")
    .limit(1)
    .abortSignal(signal);
  assertReadActive(signal);
  if (error) throw error;
  if (count === null || !Number.isSafeInteger(count) || count < 0) throw Error("تعذر قراءة عدد التوصيلات الجارية.");
  const row = data?.[0];
  if (count === 0 && !row) {
    await requireDriverIdentity(userId);
    assertReadActive(signal);
    return { count, task: null };
  }
  if (!row || row.driver_id !== userId || !row.customer_orders || (row.status !== "accepted" && row.status !== "picked_up")) {
    throw Error("تعذر التحقق من المهمة المسندة.");
  }
  let context: Awaited<ReturnType<typeof getC3Contexts>>[string] | undefined;
  try { context = (await getC3Contexts([row.customer_order_id], signal))[row.customer_order_id]; }
  catch { /* Keep the assigned task visible without a collection amount. */ }
  assertReadActive(signal);
  await requireDriverIdentity(userId);
  assertReadActive(signal);
  return { count, task: {
    id: row.id, orderId: row.customer_order_id, status: row.status,
    orderNumber: row.customer_orders.order_number,
    destination: row.customer_orders,
    pickupStores: row.status === "accepted" ? row.customer_orders.store_orders : [],
    reference: context?.references[`TSK:${row.id}`],
    collection: context ? collectionFromContext(context) : { state: "unavailable" },
  } };
}

export async function getDriverAssignedTasks(
  userId: string,
  customerOrderId?: string,
  taskId?: string,
  signal?: AbortSignal,
  page?: { view: "active" | "completed"; offset: number; size: number; search?: string },
): Promise<DriverAssignedTask[]> {
  assertReadActive(signal);
  await requireDriverIdentity(userId);
  assertReadActive(signal);
  let matched: Map<string, string> | undefined;
  if (page?.search?.trim() && !taskId) {
    const request = supabase.rpc("search_driver_task_references", {
      search_value: page.search, view_value: page.view, page_offset: page.offset, page_size: page.size,
    });
    const { data, error } = await (signal ? request.abortSignal(signal) : request);
    assertReadActive(signal);
    if (error) throw error;
    matched = new Map(data?.map(row => [row.task_id, row.reference]));
    if (!matched.size) return [];
  }
  let query = supabase
    .from("delivery_tasks")
    .select(
      "id,driver_id,status,customer_order_id,created_at,accepted_at,picked_up_at,delivered_at,customer_orders!inner(order_number,recipient_name,contact_phone,delivery_address,delivery_zone_name_snapshot,customer_note,store_orders(id,status,stores(name,address)))",
    )
    .eq("driver_id", userId)
    .in("status", (page?.view === "active" ? ["accepted", "picked_up"] : page?.view === "completed" ? ["delivered"] : ["accepted", "picked_up", "delivered"]) satisfies AssignedTaskStatus[]);
  if (page?.view === "active") query = query.order("status", { ascending: false }).order("accepted_at", { ascending: true, nullsFirst: false });
  query = query.order(page?.view === "completed" ? "delivered_at" : "created_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false });
  if (customerOrderId) query = query.eq("customer_order_id", customerOrderId);
  if (taskId) query = query.eq("id", taskId).limit(1);
  if (matched) query = query.in("id", [...matched.keys()]);
  else if (page && !taskId) query = query.range(page.offset, page.offset + page.size);
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  assertReadActive(signal);

  if (error) throw error;
  const rows = data ?? [];
  assertReadActive(signal);
  await requireDriverIdentity(userId);
  assertReadActive(signal);
  if (rows.some(row => row.driver_id !== userId)) throw new Error("تعذر التحقق من إسناد المهمة.");
  const result: DriverAssignedTask[] = [];
  // Bound operational reads below response limits.
  for (let offset = 0; offset < rows.length; offset += 80) {
    const batch = rows.slice(offset, offset + 80);
    const tasks: DriverAssignedTask[] = batch.map(row => ({ ...row, reference: matched?.get(row.id), collection: { state: "unavailable" } }));
    try {
      const contexts = await getC3Contexts(batch.map(row => row.customer_order_id), signal);
      for (const task of tasks) {
        const context = contexts[task.customer_order_id];
        task.reference ??= context?.references[`TSK:${task.id}`];
        if (context?.pricing) task.collection = collectionFromContext(context);
      }
    } catch { /* A context read/decoding failure must not fall back to old totals. */ }
    assertReadActive(signal);
    if (!page || taskId) {
      try {
        const pickups = await getPickupWorkflows(batch.map(task => task.id), userId, signal);
        for (const task of tasks) task.pickups = pickups[task.id] ?? { state: "unavailable" };
      } catch { for (const task of tasks) task.pickups = { state: "unavailable" }; }
    }
    assertReadActive(signal);
    await requireDriverIdentity(userId);
    assertReadActive(signal);
    result.push(...tasks);
  }
  return result;
}

async function requireDriverIdentity(expectedUser: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== expectedUser) throw new Error("تغير الحساب أو انتهت الجلسة. أعد فتح توصيلاتك.");
}

function assertReadActive(signal?: AbortSignal) {
  if (signal?.aborted) throw Error("أُوقفت قراءة التوصيلات بعد مغادرة الشاشة.");
}
