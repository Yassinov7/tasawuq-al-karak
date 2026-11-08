import {supabase} from '@/lib/supabase';
import {c3Object} from '@/lib/c3-order-contract';
import {custodyDecimal,C5ScopeError} from '@/lib/driver-custody-c5';
import {createFinancialTransport} from '@/lib/financial-transport';
// Handwritten local C11 boundary. UI is read-only; activation is owner-reviewed separately.
export const transitionPaths=['new_orders','delivery','custody','wages','settlements','subscriptions','treasury','reconciliation'] as const;
export type TransitionPath=typeof transitionPaths[number];
export type TransitionReport={at:string;gates:{path:TransitionPath;admit:boolean;ready:boolean;problems:string[]}[];cohorts:Record<string,number>;rows:{kind:string;entityId:string;amount:string;note:string}[];hasMore:boolean};
const rpc=createFinancialTransport(supabase as unknown as {rpc(name:'read_finance_transition',args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string;code?:string}|null}>});
function text(v:unknown){if(typeof v!=='string')throw Error('بيانات الانتقال غير مكتملة.');return v;}
export function decodeTransition(raw:unknown):TransitionReport{
 const d=c3Object(raw);if(d.read_only!==true||d.balances_combined!==false||!Array.isArray(d.gates)||!Array.isArray(d.legacy_rows)||typeof d.has_more!=='boolean')throw Error('عقد الانتقال غير صالح.');
 const cohorts:Record<string,number>={};for(const [k,v] of Object.entries(c3Object(d.cohorts))){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw Error('عداد الانتقال غير صالح.');cohorts[k]=v;}
 const gates=d.gates.map<TransitionReport['gates'][number]>(value=>{const g=c3Object(value),r=c3Object(g.readiness);if(!transitionPaths.includes(g.path as TransitionPath)||typeof g.admit!=='boolean'||typeof r.ready!=='boolean'||!Array.isArray(r.problems))throw Error('حالة البوابة غير صالحة.');return{path:g.path as TransitionPath,admit:g.admit,ready:r.ready,problems:r.problems.map(text)};});
 if(new Set(gates.map(g=>g.path)).size!==transitionPaths.length)throw Error('بوابات الانتقال غير مكتملة.');
 const at=text(d.at);if(!Number.isFinite(Date.parse(at)))throw Error('وقت القراءة غير صالح.');
 return{at,gates,cohorts,hasMore:d.has_more,rows:d.legacy_rows.map(value=>{const r=c3Object(value);return{kind:text(r.kind),entityId:text(r.entity_id),amount:custodyDecimal(r.amount),note:text(r.note)};})};
}
async function owner(actor:string){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==actor)throw new C5ScopeError('تغير الحساب؛ لم نعرض بيانات المستخدم السابق.');}
export async function readFinanceTransition(actor:string,page=0){await owner(actor);const r=await rpc('read_finance_transition',{expected_user:actor,page_number:page});await owner(actor);if(r.error){if(r.error.code==='42501')throw new C5ScopeError('يلزم تفويض مراجعة الانتقال المالي.');throw Error('تعذر تحميل تقرير الانتقال. لم تُقدّر أي أرصدة.');}return decodeTransition(r.data);}
