import { createFinancialTransport } from "@/lib/financial-transport";
import { latinDigits } from "@/lib/signup-data";
import { supabase } from "@/lib/supabase";
import { readLocalCache, writeLocalCache, invalidateLocalCache } from "@/lib/local-cache";
import { newIdempotencyKey } from "@/lib/request-key";

export type MoneyDue = { id: string; purpose: string; direction: "in" | "out"; amount: string; remaining: string };
export type MoneyInvoice = { id: string; reference: string; kind: string; title: string; amount: string; status: string; owner_id: string; owner_name?: string; created_at: string; voided_by: string | null; customer_order_id: string | null; store_order_id: string | null; task_id: string | null; dues: MoneyDue[] };
export type MoneyOverview = { admin: boolean; owner: string; account_reference: string | null; cash: string | null; receivable: string; payable: string; collection_due: string; subscription_due: string; rows: MoneyInvoice[] };
export type InvoiceDetail = MoneyInvoice & { admin: boolean; details: Record<string, unknown>; references: Record<string, string>; corrects: string | null; cashDirection?: "in" | "out"; settlements: { id: string; reference: string; amount: string; voided: boolean }[] };
export type MoneyPerson = { id: string; name: string; role: string; account_reference: string; policy: { mode: string; value: number } | null };
export type MoneyAction = { action: "settle" | "policy" | "salary" | "correct"; reason: string; [key: string]: string };
export type ActionResult = { state: "completed"; invoice_id: string | null } | { state: "rejected"; message: string };
type Rpc = "read_money" | "read_merchant_money" | "read_driver_money" | "read_money_invoice" | "record_money_action" | "recover_money_action" | "money_people" | "find_order_invoice";
// Local migration contract. All external values are validated before rendering money.
const api = supabase as unknown as { rpc(name: Rpc, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> };
const sendRpc = createFinancialTransport(api);
export class InvoiceUnavailableError extends Error {
  constructor() { super("الفاتورة غير متاحة لهذا الحساب."); }
}
async function rpc(name: Rpc, args: Record<string, unknown> = {}, signal?: AbortSignal) {
  const result = await sendRpc(name, args, signal);
  if (name === "read_money_invoice" && result.error?.code === "42501") throw new InvoiceUnavailableError();
  if (result.error) throw Error("تعذر تأكيد البيانات. تحقق من الاتصال وأعد المحاولة.");
  return result.data;
}
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("بيانات مالية غير مكتملة."); return v as Record<string, unknown>; };
const text = (v: unknown): string => { if (typeof v !== "string") throw Error("بيانات غير مكتملة."); return v; };
export function exactAmount(v: unknown): string { const s = text(v); if (!/^-?\d{1,40}(?:\.\d{1,2})?$/.test(s)) throw Error("قيمة مالية غير صالحة."); return s; }
function due(v: unknown): MoneyDue { const d = object(v); if (d.direction !== "in" && d.direction !== "out") throw Error("اتجاه مالي غير صالح."); return { id: text(d.id), purpose: text(d.purpose), direction: d.direction, amount: exactAmount(d.amount), remaining: exactAmount(d.remaining) }; }
function invoice(v: unknown): MoneyInvoice {
  const d = object(v); if (!Array.isArray(d.dues)) throw Error("تفاصيل المستحقات غير مكتملة.");
  return { id: text(d.id), reference: text(d.reference), kind: text(d.kind), title: text(d.title), amount: exactAmount(d.amount), status: text(d.status), owner_id: text(d.owner_id), owner_name: typeof d.owner_name === "string" ? d.owner_name : undefined, created_at: text(d.created_at), voided_by: d.voided_by === null ? null : text(d.voided_by), customer_order_id: d.customer_order_id === null ? null : text(d.customer_order_id), store_order_id: d.store_order_id === null ? null : text(d.store_order_id), task_id: d.task_id === null ? null : text(d.task_id), dues: d.dues.map(due) };
}
function moneyOverview(d: Record<string, unknown>): MoneyOverview {
  if (typeof d.admin !== "boolean" || !Array.isArray(d.rows)) throw Error("تعذر قراءة الحساب.");
  return { admin: d.admin, owner: text(d.owner), account_reference: d.account_reference === null ? null : text(d.account_reference), cash: d.cash === null ? null : exactAmount(d.cash), receivable: exactAmount(d.receivable), payable: exactAmount(d.payable), collection_due: exactAmount(d.collection_due), subscription_due: exactAmount(d.subscription_due), rows: d.rows.map(invoice) };
}
export async function readMoney(search = "", page = 0, owner?: string, signal?: AbortSignal): Promise<MoneyOverview> {
  return moneyOverview(object(await rpc("read_money", { search_value: search, page_value: page, target_owner: owner ?? null }, signal)));
}

export type MerchantInvoiceKind = "ALL" | "SAL" | "SUB" | "SET" | "COR";
export type DriverInvoiceKind = "ALL" | "DLV" | "SET" | "COR" | "WAG";
export type MerchantInvoiceCursor = { createdAt: string; id: string };

export async function readMerchantMoney(search: string, kind: MerchantInvoiceKind, before?: MerchantInvoiceCursor, signal?: AbortSignal) {
  return readOwnedMoneyPage("read_merchant_money", search, kind, before, signal);
}

export async function readDriverMoney(search: string, kind: DriverInvoiceKind, before?: MerchantInvoiceCursor, signal?: AbortSignal) {
  return readOwnedMoneyPage("read_driver_money", search, kind, before, signal);
}

async function readOwnedMoneyPage(name: "read_merchant_money" | "read_driver_money", search: string, kind: MerchantInvoiceKind | DriverInvoiceKind, before?: MerchantInvoiceCursor, signal?: AbortSignal) {
  const result = object(await rpc(name, {
    search_value: search,
    kind_value: kind,
    before_created_at: before?.createdAt ?? null,
    before_id: before?.id ?? null,
  }, signal));
  const overview = moneyOverview(result);
  if (typeof result.has_more !== "boolean" || overview.rows.length > 10 ||
      (result.has_more && overview.rows.length !== 10) ||
      new Set(overview.rows.map(row => row.id)).size !== overview.rows.length ||
      (kind !== "ALL" && overview.rows.some(row => row.kind !== kind)) ||
      (name === "read_driver_money" && overview.rows.some(row => !["DLV", "SET", "COR", "WAG"].includes(row.kind)))) {
    throw Error("تعذر تأكيد صفحة المستندات.");
  }
  return { overview, hasMore: result.has_more };
}
export async function readInvoice(id: string, signal?: AbortSignal): Promise<InvoiceDetail> {
  const d = object(await rpc("read_money_invoice", { target_invoice: id }, signal));
  if (!Array.isArray(d.settlements)) throw Error("سجل التسويات غير مكتمل.");
  return { ...invoice(d), admin: d.admin === true, details: object(d.details), references: Object.fromEntries(Object.entries(object(d.references)).map(([k, v]) => [k, text(v)])), corrects: d.corrects === null ? null : text(d.corrects), cashDirection: d.cash_direction === "in" || d.cash_direction === "out" ? d.cash_direction : undefined, settlements: d.settlements.map(v => { const s = object(v); return { id: text(s.id), reference: text(s.reference), amount: exactAmount(s.amount), voided: s.voided === true }; }) };
}
export async function findOrderInvoice(order: string) { const id = await rpc("find_order_invoice", { target_order: order }); if (typeof id !== "string") throw Error("فاتورة الطلب غير متاحة لهذا الحساب."); return id; }
export async function moneyPeople(): Promise<MoneyPerson[]> {
  const rows = await rpc("money_people"); if (!Array.isArray(rows)) throw Error("تعذر تحميل الأطراف.");
  return rows.map(v => { const p = object(v); const policy = p.policy === null ? null : object(p.policy); return { id: text(p.id), name: text(p.name), role: text(p.role), account_reference: text(p.account_reference), policy: policy ? { mode: text(policy.mode), value: Number(policy.value) } : null }; });
}
type Attempt = { owner: string; key: string; input: MoneyAction };
const cacheKey = (owner: string) => `invoice-finance-action:v1:${owner}`;
const locks = new Set<string>();
async function requireOwner(owner: string) { const result = await supabase.auth.getUser(); if (result.error || result.data.user?.id !== owner) throw Error("تغير الحساب. أعد فتح المالية."); }
export async function pendingMoneyAction(owner: string): Promise<MoneyAction | undefined> { await requireOwner(owner); const a = await readLocalCache<Attempt>(cacheKey(owner), { requirePersistence: true }); if (a && (a.owner !== owner || !a.key || !a.input)) throw Error("تعذر قراءة المحاولة السابقة."); return a?.input; }
/** Read-only inspection. Never creates/retries an action or discards its persisted key. */
export async function inspectPendingMoneyAction(owner:string) {
 await requireOwner(owner);
 const attempt=await readLocalCache<Attempt>(cacheKey(owner),{requirePersistence:true});
 if(!attempt)return undefined;
 if(attempt.owner!==owner||!attempt.key||!attempt.input)throw Error("تعذر قراءة المحاولة السابقة.");
 if(!["settle","correct","policy","salary"].includes(attempt.input.action)||typeof attempt.input.reason!=="string"||Object.values(attempt.input).some(value=>typeof value!=="string"))throw Error("بيانات المحاولة المحفوظة غير مكتملة؛ لا يمكن استكمالها تلقائيًا.");
 let result:ActionResult|undefined,checkError:string|undefined;
 try{
  const value=object(await rpc("recover_money_action",{attempt_key:attempt.key}));
  if(value.state==="completed")result={state:"completed",invoice_id:value.invoice_id===null?null:text(value.invoice_id)};
  else if(value.state==="rejected")result={state:"rejected",message:moneyRejection(text(value.message))};
  else if(value.state)throw Error("حالة غير معروفة.");
 }catch{checkError="تعذر جلب نتيجة الخادم. لا يمكن اعتبار العملية ناجحة أو مرفوضة الآن.";}
 await requireOwner(owner);
 return {key:attempt.key,input:attempt.input,result,checkError};
}
/** A frozen, persisted intent is retried with the same key, never replaced after a lost reply. */
export async function moneyAction(owner: string, input?: MoneyAction, expectedAttemptKey?:string): Promise<ActionResult> {
  if (locks.has(owner)) throw Error("جارٍ التحقق من العملية."); locks.add(owner);
  try {
    await requireOwner(owner);
    let a = await readLocalCache<Attempt>(cacheKey(owner), { requirePersistence: true });
    if (a && (a.owner !== owner || !a.key || !a.input)) throw Error("تعذر قراءة المحاولة السابقة.");
    if(expectedAttemptKey&&(!a||a.key!==expectedAttemptKey))throw Error("تغيرت المحاولة المحفوظة؛ أعد قراءة تفاصيلها قبل الاستكمال.");
    if (input) input = Object.fromEntries(Object.entries(input).map(([k,v]) => [k, k === "amount" || k === "value" ? latinDigits(v.trim()).replace(/[٫,]/g,".") : v])) as MoneyAction;
    if (a && input && JSON.stringify(a.input) !== JSON.stringify(input)) throw Error("تحقق من العملية السابقة أولًا قبل بدء عملية أخرى.");
    if (!a) { if (!input) throw Error("لا توجد محاولة معلقة."); a = { owner, key: newIdempotencyKey(), input }; await writeLocalCache(cacheKey(owner), a, { requirePersistence: true }); }
    let result = object(await rpc("recover_money_action", { attempt_key: a.key }));
    await requireOwner(owner);
    if (!result.state) result = object(await rpc("record_money_action", { attempt_key: a.key, action_input: a.input, expected_user: owner }));
    await requireOwner(owner);
    if (result.state !== "completed" && result.state !== "rejected") throw Error("نتيجة العملية غير مؤكدة؛ تحقق من المحاولة السابقة.");
    await invalidateLocalCache(cacheKey(owner), { requirePersistence: true });
    return result.state === "completed" ? { state: "completed", invoice_id: result.invoice_id === null ? null : text(result.invoice_id) } : { state: "rejected", message: moneyRejection(text(result.message)) };
  } finally { locks.delete(owner); }
}
export function difference(a: string, b: string) {
  const cents = (s: string) => { const [w, f = ""] = s.split("."); return BigInt(w) * 100n + BigInt(f.padEnd(2, "0")) * (w.startsWith("-") ? -1n : 1n); };
  const value = cents(exactAmount(a)) - cents(exactAmount(b)), absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
export const invoiceKindLabels: Record<string, string> = { INV: "فاتورة العميل", SUB: "فاتورة اشتراك", SAL: "فاتورة مبيعات متجر", DLV: "فاتورة توصيل", WAG: "استحقاق راتب", SET: "فاتورة تسوية", COR: "فاتورة تصحيح" };
export const purposeLabels: Record<string, string> = { subscription: "اشتراك", sale: "مبيعات المتجر", collection: "كامل تحصيل العميل", wage: "أجر السائق" };

function moneyRejection(message: string): string {
 const rules: [RegExp,string][] = [
 [/insufficient.*cash/i,"نقد الخزينة غير كافٍ لتنفيذ هذا الصرف أو إلغاء القبض."],
 [/excess settlement|invalid.*settlement/i,"المبلغ غير صالح أو يتجاوز المتبقي على الفاتورة."],
 [/correct its settlements/i,"صحح فواتير التسوية المرتبطة أولًا قبل إلغاء أثر المستند."],
 [/invoice cannot be corrected/i,"لا يمكن تصحيح هذا المستند بحالته الحالية."],
 [/period includes task/i,"تتضمن هذه الفترة مهامًا بأجر مستقل؛ لا يصدر راتب يكرر استحقاقها."],
 [/exclusion|money_salary_periods/i,"تتداخل الفترة مع راتب سبق إصداره لهذا السائق."],
 [/salary policy required/i,"اختر سياسة راتب لهذا السائق واحفظها أولًا."],
 [/completed salary period/i,"أدخل فترة راتب مكتملة وصحيحة؛ تاريخ النهاية غير شامل."],
 [/due unavailable/i,"المستحق غير متاح للتسوية. حدّث الفاتورة."],
 [/reason/i,"أدخل سببًا واضحًا من 3 إلى 1000 حرف."],
 [/wage|policy|mode/i,"تحقق من طريقة الأجر وقيمته؛ النسبة أكبر من صفر وحتى 100٪."],
 [/invalid input|date|numeric/i,"راجع المبلغ والتواريخ المدخلة ثم أعد المحاولة."],
 ];return rules.find(([pattern])=>pattern.test(message))?.[1] ?? "لم تُنفذ العملية. حدّث الفاتورة وراجع البيانات قبل المحاولة مجددًا.";
}
