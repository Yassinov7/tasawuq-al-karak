import {supabase} from '@/lib/supabase';
import {c3Object} from '@/lib/c3-order-contract';
import {custodyDecimal,C5ScopeError} from '@/lib/driver-custody-c5';
import {validFinancialId} from '@/lib/financial-input';
import {createFinancialTransport} from '@/lib/financial-transport';
// LOCAL UNAPPLIED C10 handwritten DTO. This report never initiates a financial operation.
export const reconciliationScopes=['all','ledger','orders','references','wages','custody','merchants','subscriptions','treasury'] as const;
export type ReconciliationScope=typeof reconciliationScopes[number];
export type ReconciliationData={scope:ReconciliationScope;errors:number;warnings:number;at:string;snapshot:string;hasMore:boolean;rows:{scope:ReconciliationScope;code:string;severity:'error'|'warning';entityId:string|null;expected:string|null;actual:string|null;details:Record<string,unknown>}[]};
const rpc=createFinancialTransport(supabase as unknown as {rpc(name:'read_financial_reconciliation',args:Record<string,unknown>):PromiseLike<{data:unknown;error:{code?:string;message:string}|null}>});
function text(v:unknown){if(typeof v!=='string')throw Error('تقرير المطابقة غير مكتمل.');return v;}
function count(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw Error('عدد نتائج المطابقة غير صالح.');return v;}
function scope(v:unknown):ReconciliationScope{if(!reconciliationScopes.includes(v as ReconciliationScope))throw Error('نطاق مطابقة غير صالح.');return v as ReconciliationScope;}
export function decodeReconciliation(raw:unknown):ReconciliationData{const d=c3Object(raw),summary=c3Object(d.summary),at=text(d.at);if(d.read_only!==true||!Number.isFinite(Date.parse(at))||typeof d.has_more!=='boolean'||!Array.isArray(d.rows))throw Error('تعذر إثبات عقد التقرير للقراءة فقط.');
 return{scope:scope(d.scope),errors:count(summary.errors),warnings:count(summary.warnings),at,snapshot:text(d.snapshot),hasMore:d.has_more,rows:d.rows.map<ReconciliationData['rows'][number]>(v=>{const r=c3Object(v);if(r.severity!=='error'&&r.severity!=='warning')throw Error('تصنيف مطابقة غير صالح.');const entityId=r.entity_id===null?null:text(r.entity_id);if(entityId)validFinancialId(entityId);return{scope:scope(r.scope),code:text(r.code),severity:r.severity,entityId,expected:r.expected===null?null:custodyDecimal(r.expected),actual:r.actual===null?null:custodyDecimal(r.actual),details:c3Object(r.details)};})};
}
async function owner(actor:string){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==actor)throw new C5ScopeError('تغير الحساب؛ لم نعرض بيانات الحساب السابق.');}
export async function getReconciliation(actor:string,filter:ReconciliationScope,page=0){await owner(actor);const r=await rpc('read_financial_reconciliation',{expected_user:actor,scope_value:filter,page_number:page});await owner(actor);if(r.error){if('code' in r.error&&r.error.code==='42501')throw new C5ScopeError('يلزم تفويض المطابقة المالية المستقل.');throw Error('تعذر تحميل المطابقة؛ النتيجة غير معلومة.');}const d=decodeReconciliation(r.data);if(d.scope!==filter)throw new C5ScopeError('نطاق التقرير غير مطابق.');return d;}
