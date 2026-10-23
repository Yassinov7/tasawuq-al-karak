import { supabase } from "@/lib/supabase";
import { newIdempotencyKey } from "@/lib/driver-cash";

const client = supabase as unknown as {
  from: (relation: string) => any;
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: Error | null }>;
};

export type SettlementCurrency = "SYP" | "USD";
export type SettlementEntitlement = {
  batch_entitlement_id?: string;
  merchant_order_entitlement_id: string;
  merchant_id: string;
  currency: SettlementCurrency;
  store_order_id: string;
  delivered_at: string;
  current_entitlement_amount: number;
  paid_amount: number;
  remaining_amount: number;
  gross_items_amount?: number;
  commission_amount_at_delivery?: number;
};
export type SettlementBatch = {
  id: string;
  merchant_id: string;
  currency: SettlementCurrency;
  status: "open" | "completed";
  created_at: string;
  period_starts_at: string | null;
  period_ends_at: string | null;
  note: string;
  merchantName?: string;
  storeName?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
};
export type SettlementDetails = SettlementBatch & {
  entitlements: SettlementEntitlement[];
  payments: { id: string; amount: number; paid_at: string; external_reference: string | null; note: string }[];
};

type DbRecord = Record<string, unknown>;
const records = (value: unknown): DbRecord[] => Array.isArray(value)
  ? value.filter((row): row is DbRecord => typeof row === "object" && row !== null)
  : [];
const record = (value: unknown): DbRecord => typeof value === "object" && value !== null ? value as DbRecord : {};
const text = (row: DbRecord, field: string) => typeof row[field] === "string" ? row[field] : "";
const nullableText = (row: DbRecord, field: string) => typeof row[field] === "string" ? row[field] : null;
const amount = (row: DbRecord, field: string) => Number(row[field] ?? 0);
const currency = (value: unknown): SettlementCurrency => value === "USD" ? "USD" : "SYP";

const entitlement = (row: DbRecord): SettlementEntitlement => ({
  batch_entitlement_id: nullableText(row, "batch_entitlement_id") ?? undefined,
  merchant_order_entitlement_id: text(row, "merchant_order_entitlement_id"),
  merchant_id: text(row, "merchant_id"),
  currency: currency(row.currency),
  store_order_id: text(row, "store_order_id"),
  delivered_at: text(row, "delivered_at"),
  current_entitlement_amount: amount(row, "current_entitlement_amount"),
  paid_amount: amount(row, "paid_amount"),
  remaining_amount: amount(row, "remaining_amount"),
  gross_items_amount: row.gross_items_amount === undefined ? undefined : amount(row, "gross_items_amount"),
  commission_amount_at_delivery: row.commission_amount_at_delivery === undefined ? undefined : amount(row, "commission_amount_at_delivery"),
});

async function labels(merchantIds: string[]) {
  if (!merchantIds.length) return new Map<string, { merchantName?: string; storeName?: string }>();
  const [{ data: merchants, error: merchantError }, { data: stores, error: storeError }] = await Promise.all([
    client.from("merchants").select("id,owner_user_id").in("id", merchantIds),
    client.from("stores").select("merchant_id,name").in("merchant_id", merchantIds),
  ]);
  if (merchantError || storeError) throw merchantError ?? storeError;

  const merchantRows = records(merchants);
  const ownerIds = merchantRows.map((merchant) => text(merchant, "owner_user_id")).filter(Boolean);
  const { data: profiles, error } = ownerIds.length
    ? await client.from("profiles").select("id,full_name").in("id", ownerIds)
    : { data: [], error: null };
  if (error) throw error;

  const profileNames = new Map(records(profiles).map((profile) => [text(profile, "id"), text(profile, "full_name")]));
  const storeNames = new Map(records(stores).map((store) => [text(store, "merchant_id"), text(store, "name")]));
  return new Map(merchantRows.map((merchant) => {
    const merchantId = text(merchant, "id");
    return [merchantId, { merchantName: profileNames.get(text(merchant, "owner_user_id")), storeName: storeNames.get(merchantId) }];
  }));
}

const batch = (row: DbRecord): SettlementBatch => ({
  id: text(row, "id"), merchant_id: text(row, "merchant_id"), currency: currency(row.currency),
  status: row.status === "completed" ? "completed" : "open", created_at: text(row, "created_at"),
  period_starts_at: nullableText(row, "period_starts_at"), period_ends_at: nullableText(row, "period_ends_at"),
  note: text(row, "note"), totalAmount: 0, paidAmount: 0, remainingAmount: 0,
});

export async function getSettlementBatches(search = ""): Promise<SettlementBatch[]> {
  const { data, error } = await client.from("merchant_settlement_batches")
    .select("id,merchant_id,currency,status,created_at,period_starts_at,period_ends_at,note")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw error;

  const batches = records(data).map(batch);
  const names = await labels([...new Set(batches.map((item) => item.merchant_id))]);
  const positions = await Promise.all(batches.map((item) => client.from("merchant_settlement_batch_positions")
    .select("current_entitlement_amount,paid_amount,remaining_amount").eq("batch_id", item.id)));
  const rows = batches.map((item, index) => {
    const entries = records(positions[index].data);
    const totalAmount = entries.reduce((sum, entry) => sum + amount(entry, "current_entitlement_amount"), 0);
    const paidAmount = entries.reduce((sum, entry) => sum + amount(entry, "paid_amount"), 0);
    const remainingAmount = entries.reduce((sum, entry) => sum + amount(entry, "remaining_amount"), 0);
    return { ...item, ...(names.get(item.merchant_id) ?? {}), totalAmount, paidAmount, remainingAmount };
  });
  const query = search.trim().toLowerCase();
  return query ? rows.filter((item) => `${item.merchantName ?? ""} ${item.storeName ?? ""} ${item.id}`.toLowerCase().includes(query)) : rows;
}

export async function getUnsettledEntitlements(): Promise<SettlementEntitlement[]> {
  const { data, error } = await client.from("merchant_order_entitlement_positions")
    .select("merchant_order_entitlement_id,merchant_id,currency,store_order_id,delivered_at,current_entitlement_amount")
    .eq("status", "pending_settlement").order("delivered_at", { ascending: false }).limit(100);
  if (error) throw error;
  const bound = await client.from("merchant_settlement_batch_entitlements").select("merchant_order_entitlement_id");
  if (bound.error) throw bound.error;
  const used = new Set(records(bound.data).map((item) => text(item, "merchant_order_entitlement_id")));
  return records(data).filter((item) => !used.has(text(item, "merchant_order_entitlement_id"))).map((item) => {
    const current = amount(item, "current_entitlement_amount");
    return { ...entitlement(item), paid_amount: 0, remaining_amount: current };
  });
}

export async function getSettlementDetails(batchId: string): Promise<SettlementDetails | null> {
  const { data: rawBatch, error } = await client.from("merchant_settlement_batches").select("*").eq("id", batchId).maybeSingle();
  if (error) throw error;
  if (!rawBatch) return null;
  const settlement = batch(record(rawBatch));
  const [{ data: positions, error: positionError }, { data: payments, error: paymentError }] = await Promise.all([
    client.from("merchant_settlement_batch_positions").select("*").eq("batch_id", batchId).order("delivered_at", { ascending: false }),
    client.from("merchant_settlement_payments").select("id,amount,paid_at,external_reference,note").eq("batch_id", batchId).order("paid_at", { ascending: false }),
  ]);
  if (positionError || paymentError) throw positionError ?? paymentError;

  const named = await labels([settlement.merchant_id]);
  const entitlements = records(positions).map(entitlement);
  const totalAmount = entitlements.reduce((sum, item) => sum + item.current_entitlement_amount, 0);
  const paidAmount = entitlements.reduce((sum, item) => sum + item.paid_amount, 0);
  const remainingAmount = entitlements.reduce((sum, item) => sum + item.remaining_amount, 0);
  const paymentRows = records(payments).map((item) => ({
    id: text(item, "id"), amount: amount(item, "amount"), paid_at: text(item, "paid_at"),
    external_reference: nullableText(item, "external_reference"), note: text(item, "note"),
  }));
  return { ...settlement, ...(named.get(settlement.merchant_id) ?? {}), totalAmount, paidAmount, remainingAmount, entitlements, payments: paymentRows };
}

export async function createSettlement(input: { merchantId: string; currency: SettlementCurrency; ids: string[]; note?: string }) {
  const { data, error } = await client.rpc("create_merchant_settlement_batch", {
    target_merchant: input.merchantId, target_currency: input.currency, entitlement_ids: input.ids,
    batch_idempotency_key: newIdempotencyKey(), period_start_value: null, period_end_value: null,
    batch_note: input.note?.trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function recordSettlementPayment(input: { batchId: string; amount: number; allocations: { batch_entitlement_id: string; amount: number }[]; reference?: string; note?: string }) {
  const { data, error } = await client.rpc("record_merchant_settlement_payment", {
    target_batch: input.batchId, payment_amount: input.amount, payment_allocations: input.allocations,
    payment_idempotency_key: newIdempotencyKey(), payment_reference: input.reference?.trim() || null,
    payment_note: input.note?.trim() || null,
  });
  if (error) throw error;
  return data;
}
