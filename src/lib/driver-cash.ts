import { supabase } from "@/lib/supabase";

// These Phase 9.2 relations are added by a migration and intentionally kept
// isolated until generated Supabase types are refreshed after deployment.
const client = supabase as unknown as { from: (relation: string) => any; rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: Error | null }> };

export type CashCurrency = "SYP" | "USD";
export type DriverCustodyPosition = { driver_id: string; currency: CashCurrency; cash_collected_amount: number; delivery_fee_entitled_amount: number; net_custody_due_amount: number; office_received_amount: number; custody_remaining_amount: number; driver_credit_amount: number; driver_credit_paid_amount: number };
export type CashRemittance = { id: string; currency: CashCurrency; amount: number; external_reference: string | null; note: string; received_at: string };
export type CashPayout = { id: string; currency: CashCurrency; amount: number; external_reference: string | null; note: string; paid_at: string };
export type DeliveryCashOrder = { customer_order_id: string; currency: CashCurrency; collectible_amount: number; delivery_fee_amount: number; delivery_zone_name_snapshot: string; delivered_at: string };
export type DriverCashAccount = { positions: DriverCustodyPosition[]; remittances: CashRemittance[]; payouts: CashPayout[]; deliveries: DeliveryCashOrder[] };
export type AdminDriverCustody = { driverId: string; applicationId: string; name: string; phone: string; positions: DriverCustodyPosition[] };

const toNumber = <T extends Record<string, unknown>>(row: T) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "string" && ["amount", "cash_collected_amount", "delivery_fee_entitled_amount", "net_custody_due_amount", "office_received_amount", "custody_remaining_amount", "driver_credit_amount", "driver_credit_paid_amount", "collectible_amount", "delivery_fee_amount"].includes(k) ? Number(v) : v])) as T;

export async function getDriverCashAccount(driverId: string): Promise<DriverCashAccount> {
  const [positions, remittances, payouts, deliveries] = await Promise.all([
    client.from("driver_cash_custody_positions").select("*").eq("driver_id", driverId).order("currency"),
    client.from("driver_cash_remittances").select("id,currency,amount,external_reference,note,received_at").eq("driver_id", driverId).order("received_at", { ascending: false }),
    client.from("driver_cash_credit_payouts").select("id,currency,amount,external_reference,note,paid_at").eq("driver_id", driverId).order("paid_at", { ascending: false }),
    client.from("customer_order_cash_obligations").select("customer_order_id,currency,collectible_amount,delivery_fee_amount,delivery_zone_name_snapshot,delivered_at").eq("driver_id", driverId).order("delivered_at", { ascending: false }),
  ]);
  for (const result of [positions, remittances, payouts, deliveries]) if (result.error) throw result.error;
  return { positions: (positions.data ?? []).map(toNumber) as DriverCustodyPosition[], remittances: (remittances.data ?? []).map(toNumber) as CashRemittance[], payouts: (payouts.data ?? []).map(toNumber) as CashPayout[], deliveries: (deliveries.data ?? []).map(toNumber) as DeliveryCashOrder[] };
}

export async function getAdminDriverCustodies(search = ""): Promise<AdminDriverCustody[]> {
  let query = client.from("driver_applications").select("id,user_id,full_name,contact_phone").eq("status", "accepted").order("created_at", { ascending: false });
  if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,contact_phone.ilike.%${search.trim()}%`);
  const { data: drivers, error } = await query; if (error) throw error;
  const source = drivers ?? []; const ids = source.map((x: { user_id: string }) => x.user_id);
  const { data: positions, error: positionError } = ids.length ? await client.from("driver_cash_custody_positions").select("*").in("driver_id", ids) : { data: [], error: null };
  if (positionError) throw positionError;
  return source.map((driver: { id: string; user_id: string; full_name: string; contact_phone: string }) => ({ driverId: driver.user_id, applicationId: driver.id, name: driver.full_name, phone: driver.contact_phone, positions: (positions ?? []).filter((x: { driver_id: string }) => x.driver_id === driver.user_id).map(toNumber) as DriverCustodyPosition[] }));
}

export async function recordDriverCashRemittance(input: { driverId: string; currency: CashCurrency; amount: number; key: string; reference?: string; note?: string }) {
  const { data, error } = await client.rpc("record_driver_cash_remittance", { target_driver: input.driverId, remittance_currency: input.currency, remittance_amount: input.amount, remittance_idempotency_key: input.key, remittance_reference: input.reference?.trim() || null, remittance_note: input.note?.trim() || null });
  if (error) throw error; return data;
}

export async function payDriverCashCredit(input: { driverId: string; currency: CashCurrency; amount: number; key: string; reference?: string; note?: string }) {
  const { data, error } = await client.rpc("pay_driver_cash_credit", { target_driver: input.driverId, payout_currency: input.currency, payout_amount: input.amount, payout_idempotency_key: input.key, payout_reference: input.reference?.trim() || null, payout_note: input.note?.trim() || null });
  if (error) throw error; return data;
}

export const newIdempotencyKey = () => {
  const cryptoValue = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoValue?.randomUUID) return cryptoValue.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
};
