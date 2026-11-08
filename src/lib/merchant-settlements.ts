import { supabase } from "@/lib/supabase";
import { requireSyp } from "@/lib/money";
import { allFinancialRows, centsAmount, moneyCents, sumMoney, validFinancialId } from '@/lib/financial-input';

const client = supabase;

export type SettlementCurrency = "SYP";
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
const amount = (row: DbRecord, field: string) => { const value = row[field]; if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('مبلغ التسوية غير مكتمل.'); return value; };
const currency = (value: unknown): SettlementCurrency => requireSyp(value);

const entitlement = (row: DbRecord): SettlementEntitlement => ({
  batch_entitlement_id: nullableText(row, "batch_entitlement_id") ?? undefined,
  merchant_order_entitlement_id: text(row, "merchant_order_entitlement_id"),
  merchant_id: text(row, "merchant_id"),
  currency: currency(row.currency),
  store_order_id: text(row, "store_order_id"),
  delivered_at: text(row, "delivered_at"),
  current_entitlement_amount: amount(row, "current_entitlement_amount"),
  paid_amount: row.paid_amount === undefined ? 0 : amount(row, "paid_amount"),
  remaining_amount: row.remaining_amount === undefined ? amount(row, 'current_entitlement_amount') : amount(row, "remaining_amount"),
  gross_items_amount: row.gross_items_amount === undefined ? undefined : amount(row, "gross_items_amount"),
  commission_amount_at_delivery: row.commission_amount_at_delivery === undefined ? undefined : amount(row, "commission_amount_at_delivery"),
});

async function labels(merchantIds: string[]) {
  const merchants: { id:string; owner_user_id:string }[] = [], stores: { id:string; merchant_id:string; name:string }[] = [];
  for(let offset=0;offset<merchantIds.length;offset+=80){
    const ids=merchantIds.slice(offset,offset+80);
    const [m,s]=await Promise.all([
      allFinancialRows(after=>{let q=client.from('merchants').select('id,owner_user_id').in('id',ids).order('id').limit(200);if(after)q=q.gt('id',after);return q;}),
      allFinancialRows(after=>{let q=client.from('stores').select('id,merchant_id,name').in('merchant_id',ids).order('id').limit(200);if(after)q=q.gt('id',after);return q;}),
    ]);merchants.push(...m);stores.push(...s);
  }
  const owners=[...new Set(merchants.map(row=>row.owner_user_id))], profiles: {id:string;full_name:string}[]=[];
  for(let offset=0;offset<owners.length;offset+=80){const ids=owners.slice(offset,offset+80);profiles.push(...await allFinancialRows(after=>{let q=client.from('profiles').select('id,full_name').in('id',ids).order('id').limit(200);if(after)q=q.gt('id',after);return q;}));}
  const profileNames=new Map(profiles.map(row=>[row.id,row.full_name])),storeNames=new Map(stores.map(row=>[row.merchant_id,row.name]));
  return new Map(merchants.map(row=>[row.id,{merchantName:profileNames.get(row.owner_user_id),storeName:storeNames.get(row.id)}]));
}

const batch = (row: DbRecord): SettlementBatch => ({
  id: text(row, "id"), merchant_id: text(row, "merchant_id"), currency: currency(row.currency),
  status: row.status === "completed" ? "completed" : "open", created_at: text(row, "created_at"),
  period_starts_at: nullableText(row, "period_starts_at"), period_ends_at: nullableText(row, "period_ends_at"),
  note: text(row, "note"), totalAmount: 0, paidAmount: 0, remainingAmount: 0,
});

export async function getSettlementBatches(search = ""): Promise<SettlementBatch[]> {
  const source = await allFinancialRows(after => {
    let q = client.from("merchant_settlement_batches").select("id,merchant_id,currency,status,created_at,period_starts_at,period_ends_at,note").order("id").limit(200);
    if (after) q = q.gt("id", after); return q;
  });
  const batches = source.map(batch), names = await labels([...new Set(batches.map(item => item.merchant_id))]);
  const positions = await allFinancialRows(after => {
    let q = client.from("merchant_settlement_batch_positions").select("id:batch_entitlement_id,batch_id,current_entitlement_amount,paid_amount,remaining_amount").order("batch_entitlement_id").limit(200);
    if (after) q = q.gt("batch_entitlement_id", after); return q;
  });
  const grouped = new Map<string, typeof positions>();
  for (const row of positions) { const entries = grouped.get(row.batch_id!) ?? []; entries.push(row); grouped.set(row.batch_id!, entries); }
  const rows = batches.map(item => { const entries = grouped.get(item.id) ?? []; return { ...item, ...(names.get(item.merchant_id) ?? {}), totalAmount: sumMoney(entries.map(row => amount(record(row),'current_entitlement_amount'))), paidAmount: sumMoney(entries.map(row => amount(record(row),'paid_amount'))), remainingAmount: sumMoney(entries.map(row => amount(record(row),'remaining_amount'))) }; });
  const query = search.trim().toLowerCase();
  return rows.filter(item => !query || [item.merchantName,item.storeName,item.id].join(' ').toLowerCase().includes(query)).sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}
export async function getUnsettledEntitlements(): Promise<SettlementEntitlement[]> {
  const [positions, inclusions, batches, allocations] = await Promise.all([
    allFinancialRows(after => { let q = client.from('merchant_order_entitlement_positions').select('id:merchant_order_entitlement_id,merchant_order_entitlement_id,merchant_id,currency,store_order_id,delivered_at,current_entitlement_amount').eq('status','pending_settlement').order('merchant_order_entitlement_id').limit(200); if(after) q=q.gt('merchant_order_entitlement_id',after); return q; }),
    allFinancialRows(after => { let q=client.from('merchant_settlement_batch_entitlements').select('id,batch_id,merchant_order_entitlement_id,amount_snapshot').order('id').limit(200);if(after)q=q.gt('id',after);return q; }),
    allFinancialRows(after => { let q=client.from('merchant_settlement_batches').select('id,status').order('id').limit(200);if(after)q=q.gt('id',after);return q; }),
    allFinancialRows(after => { let q=client.from('merchant_settlement_payment_allocations').select('id,batch_entitlement_id,amount').order('id').limit(200);if(after)q=q.gt('id',after);return q; }),
  ]);
  const status=new Map(batches.map(row=>[row.id,row.status])), byId=new Map(inclusions.map(row=>[row.id,row])), paid=new Map<string,bigint>(), reserved=new Map<string,bigint>();
  for(const row of allocations){const inclusion=byId.get(row.batch_entitlement_id);if(!inclusion)throw new Error('Incomplete settlement allocation');const id=inclusion.merchant_order_entitlement_id;paid.set(id,(paid.get(id)??0n)+moneyCents(row.amount));}
  for(const row of inclusions){if(!status.has(row.batch_id))throw new Error('Incomplete settlement batch');if(status.get(row.batch_id)==='open')reserved.set(row.merchant_order_entitlement_id,(reserved.get(row.merchant_order_entitlement_id)??0n)+moneyCents(row.amount_snapshot));}
  // Same reservation equation as create_merchant_settlement_batch, including later entitlement increases.
  return positions.flatMap(row=>{const id=row.merchant_order_entitlement_id!;const available=moneyCents(amount(record(row),'current_entitlement_amount'))-(paid.get(id)??0n)-(reserved.get(id)??0n);return available>0n?[{...entitlement(record(row)),paid_amount:centsAmount(paid.get(id)??0n),remaining_amount:centsAmount(available)}]:[];}).sort((a,b)=>b.delivered_at.localeCompare(a.delivered_at));
}

export async function getSettlementDetails(batchId: string): Promise<SettlementDetails | null> {
  const { data: rawBatch, error } = await client.from("merchant_settlement_batches").select("*").eq("id", batchId).maybeSingle();
  if (error) throw error;
  if (!rawBatch) return null;
  const settlement = batch(record(rawBatch));
  const [positions, payments] = await Promise.all([
    allFinancialRows(after => { let q = client.from('merchant_settlement_batch_positions').select('*,id:batch_entitlement_id').eq('batch_id',batchId).order('batch_entitlement_id').limit(200); if(after)q=q.gt('batch_entitlement_id',after);return q; }),
    allFinancialRows(after => { let q=client.from('merchant_settlement_payments').select('id,amount,paid_at,external_reference,note').eq('batch_id',batchId).order('id').limit(200);if(after)q=q.gt('id',after);return q; }),
  ]);

  const named = await labels([settlement.merchant_id]);
  const entitlements = records(positions).map(entitlement);
  const totalAmount = sumMoney(entitlements.map(item => item.current_entitlement_amount));
  const paidAmount = sumMoney(entitlements.map(item => item.paid_amount));
  const remainingAmount = sumMoney(entitlements.map(item => item.remaining_amount));
  const paymentRows = records(payments).map((item) => ({
    id: text(item, "id"), amount: amount(item, "amount"), paid_at: text(item, "paid_at"),
    external_reference: nullableText(item, "external_reference"), note: text(item, "note"),
  }));
  return { ...settlement, ...(named.get(settlement.merchant_id) ?? {}), totalAmount, paidAmount, remainingAmount, entitlements, payments: paymentRows };
}

export async function createSettlement(input: { merchantId: string; ids: string[]; note?: string; idempotencyKey: string }) {
  validFinancialId(input.idempotencyKey);
  const { data, error } = await client.rpc("create_merchant_settlement_batch", {
    target_merchant: input.merchantId, entitlement_ids: input.ids,
    batch_idempotency_key: input.idempotencyKey, period_start_value: null, period_end_value: null,
    batch_note: input.note?.trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function recordSettlementPayment(input: { batchId: string; amount: number; allocations: { batch_entitlement_id: string; amount: number }[]; reference?: string; note?: string; idempotencyKey: string }) {
  validFinancialId(input.idempotencyKey);
  const { data, error } = await client.rpc("record_merchant_settlement_payment", {
    target_batch: input.batchId, payment_amount: input.amount, payment_allocations: input.allocations,
    payment_idempotency_key: input.idempotencyKey, payment_reference: input.reference?.trim() || null,
    payment_note: input.note?.trim() || null,
  });
  if (error) throw error;
  return data;
}
