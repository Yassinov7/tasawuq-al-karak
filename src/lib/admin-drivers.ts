import { supabase } from "@/lib/supabase";

// Driver availability and delivery tables are newer than generated app types.
const client = supabase as unknown as { from: (relation: string) => any };
export type DriverFilter = "all" | "available" | "busy" | "offline";
export type DriverSummary = { id: string; userId: string; name: string; phone: string; vehicle: string; available: boolean; createdAt: string; currentTasks: number };
const cache = new Map<string, { at: number; rows: DriverSummary[]; hasMore: boolean }>();
const key = (f: DriverFilter, p: number, s: string) => `${f}:${p}:${s}`;
export const getCachedDrivers = (f: DriverFilter, p: number, s: string) => cache.get(key(f, p, s));
export const driversCacheFresh = (f: DriverFilter, p: number, s: string) => { const x = getCachedDrivers(f, p, s); return Boolean(x && Date.now() - x.at < 15000); };

export async function getAdminDrivers({ filter, page, search, force = false }: { filter: DriverFilter; page: number; search: string; force?: boolean }) {
  const cacheKey = key(filter, page, search); const saved = cache.get(cacheKey); if (!force && saved && Date.now() - saved.at < 15000) return saved;
  const size = 20; let query = client.from("driver_applications").select("id,user_id,full_name,contact_phone,vehicle_type,is_available,created_at").eq("status", "accepted").order("created_at", { ascending: false }).range(page * size, page * size + size);
  if (filter === "available") query = query.eq("is_available", true); if (filter === "offline") query = query.eq("is_available", false);
  if (search) { const uuid = /^[0-9a-f-]{36}$/i.test(search); query = query.or(`full_name.ilike.%${search}%,contact_phone.ilike.%${search}%${uuid ? `,id.eq.${search},user_id.eq.${search}` : ""}`); }
  const { data, error } = await query; if (error) throw error;
  const source = (data ?? []) as { id: string; user_id: string; full_name: string; contact_phone: string; vehicle_type: string; is_available: boolean; created_at: string }[];
  const ids = source.map((x) => x.user_id); const { data: tasks, error: taskError } = ids.length ? await client.from("delivery_tasks").select("driver_id,status").in("driver_id", ids).in("status", ["accepted", "picked_up"]) : { data: [], error: null };
  if (taskError && __DEV__) console.warn("[admin-drivers] task enrichment unavailable; showing driver records.");
  const counts = new Map<string, number>(); for (const task of (tasks ?? []) as { driver_id: string }[]) counts.set(task.driver_id, (counts.get(task.driver_id) ?? 0) + 1);
  let rows = source.map((x) => ({ id: x.id, userId: x.user_id, name: x.full_name, phone: x.contact_phone, vehicle: x.vehicle_type, available: x.is_available, createdAt: x.created_at, currentTasks: counts.get(x.user_id) ?? 0 }));
  if (filter === "busy") rows = rows.filter((x) => x.currentTasks > 0);
  const value = { at: Date.now(), rows: rows.slice(0, size), hasMore: source.length > size }; cache.set(cacheKey, value); return value;
}
export async function getAdminDriverDetails(id: string) {
  const { data: driver, error } = await client.from("driver_applications").select("id,user_id,full_name,contact_phone,vehicle_type,contract_duration_months,available_hours,is_available,status,submitted_at,created_at").eq("id", id).eq("status", "accepted").maybeSingle();
  if (error) throw error; if (!driver) throw new Error("driver-not-found");
  const { data: tasks, error: taskError } = await client.from("delivery_tasks").select("id,customer_order_id,status,created_at,accepted_at,picked_up_at,delivered_at").eq("driver_id", driver.user_id).order("created_at", { ascending: false }).range(0, 9);
  if (taskError && __DEV__) console.warn("[admin-drivers] delivery history unavailable.");
  const rows = (tasks ?? []) as { id: string; customer_order_id: string; status: string; created_at: string; delivered_at: string | null }[];
  return { driver: driver as { id: string; user_id: string; full_name: string; contact_phone: string; vehicle_type: string; contract_duration_months: number; available_hours: { schedule?: string }; is_available: boolean; submitted_at: string }, tasks: rows, completed: rows.filter((x) => x.status === "delivered").length, current: rows.filter((x) => ["accepted", "picked_up"].includes(x.status)).length };
}
