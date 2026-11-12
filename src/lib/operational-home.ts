import { supabase } from "@/lib/supabase";
import { createFinancialTransport } from "@/lib/financial-transport";

type HomeRpc = "read_admin_home" | "read_merchant_home_status" | "read_admin_review_order_ids";
const api = supabase as unknown as { rpc(name: HomeRpc,args: Record<string,unknown>): PromiseLike<{data:unknown;error:{message:string}|null}> };
const rpc = createFinancialTransport(api);
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))throw Error("بيانات الملخص غير مكتملة.");return value as Record<string,unknown>;}
export function homeCount(value:unknown){if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0)throw Error("تعذر تأكيد عدد الملخص.");return value;}
async function read(name:HomeRpc,args:Record<string,unknown>,signal?:AbortSignal){const result=await rpc(name,args,signal);if(signal?.aborted)throw Error("أوقفت القراءة.");if(result.error)throw Error("تعذر تحديث الملخص. تحقق من الاتصال وأعد المحاولة.");return result.data;}
export type AdminHome = {owner:string;merchant_pending:number;driver_pending:number;new_orders:number;delivery_orders:number;pricing_review:number};
export async function readAdminHome(owner:string,signal:AbortSignal):Promise<AdminHome>{
 const d=object(await read("read_admin_home",{expected_user:owner},signal));if(d.owner!==owner)throw Error("تغير الحساب؛ أعد فتح الرئيسية.");
 return {owner,merchant_pending:homeCount(d.merchant_pending),driver_pending:homeCount(d.driver_pending),new_orders:homeCount(d.new_orders),delivery_orders:homeCount(d.delivery_orders),pricing_review:homeCount(d.pricing_review)};
}
export const eligibilityReasons = {
 ready:"متجرك مؤهل لاستقبال طلبات جديدة.",approval:"اعتماد التاجر أو المتجر غير مكتمل. راجع حالة المتجر.",
 subscription_unavailable:"تعذر العثور على اشتراك المتجر. راجع الإدارة.",subscription_unpaid:"لم تبدأ فترة الاشتراك؛ يلزم سداد فاتورته كاملة لتفعيل استقبال الطلبات.",
 subscription_not_started:"فترة الاشتراك لم تبدأ بعد.",subscription_expired:"انتهت فترة الاشتراك؛ راجع الاشتراك مع الإدارة.",unavailable:"المتجر غير مؤهل حاليًا لاستقبال الطلبات. راجع الإدارة."
} as const;
export type HomeEligibility={eligible:boolean;reason:keyof typeof eligibilityReasons;recheckDelay:number|null};
export async function readMerchantHomeStatus(owner:string,store:string,signal?:AbortSignal):Promise<HomeEligibility>{
 const d=object(await read("read_merchant_home_status",{expected_user:owner,target_store:store},signal));
 if(d.owner!==owner||d.store_id!==store||typeof d.eligible!=="boolean"||typeof d.reason!=="string"||!Object.hasOwn(eligibilityReasons,d.reason))throw Error("تعذر تأكيد أهلية المتجر.");
 const reason=d.reason as HomeEligibility["reason"];if(d.eligible!==(reason==="ready"))throw Error("حالة المتجر غير متسقة.");
 const delay=d.recheck_at===null?null:Date.parse(String(d.recheck_at))-Date.parse(String(d.server_now));
 if(delay!==null&&!Number.isFinite(delay))throw Error("تعذر تأكيد فترة الأهلية.");
 return {eligible:d.eligible,reason,recheckDelay:delay===null?null:Math.max(1000,Math.min(delay+100,2147483647))};
}
export async function readReviewOrderIds(page:number,size:number,search=""){
 const rows=await read("read_admin_review_order_ids",{page_value:page,page_size:size,search_value:search});
 if(!Array.isArray(rows)||rows.some(id=>typeof id!=="string"||!/^[-0-9a-f]{36}$/i.test(id)))throw Error("تعذر قراءة الطلبات التي تحتاج مراجعة السعر.");
 return rows as string[];
}
