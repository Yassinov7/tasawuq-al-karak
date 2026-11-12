import {createDurableFinancialOperation} from '@/lib/financial-operation';
import {supabase} from '@/lib/supabase';
import {c3Object} from '@/lib/c3-order-contract';
import {validFinancialId} from '@/lib/financial-input';
import {parseFinancialReference} from '@/lib/finance-c2-contract';
import {custodyDecimal,handoverAmount,C5ScopeError as FinancialScopeError} from '@/lib/driver-custody-c5';
import {createFinancialTransport} from '@/lib/financial-transport';
import {normalizeFinancialRate as normalizeWageRate,calculatePercentage as calculateWage} from '@/lib/financial-decimal';
export {normalizeFinancialRate as normalizeWageRate,calculatePercentage as calculateWage,sumFinancialAmounts as sumWageAmounts,displayFinancialRate as displayWageRate} from '@/lib/financial-decimal';
// Handwritten boundary for LOCAL UNAPPLIED C6, not officially generated database types.
type Rpc='get_c6_wage_policy'|'get_c6_driver_wages'|'list_c6_driver_wages'|'save_c6_wage_policy'|'pay_c6_driver_wages'|'recover_c6_operation';
const api=supabase as unknown as {rpc(name:Rpc,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string;code?:string}|null}>};
const rpc=createFinancialTransport(api);
export type WagePosition={earned:string;paid:string;outstanding:string;available:string;blocked:string;review_required:boolean};
export type WageTask={task_id:string;amount:string;fee_amount:string;percentage:string;accrued_at:string;reference:string;cash_total:string;cash_remaining:string;status:'zero_wage'|'paid'|'available'|'blocked'|'review';allocations:{amount:string;reference:string}[]};
export type WageData={position:WagePosition;tasks:WageTask[];payments:{id:string;amount:string;paid_at:string;paid_by:string;reference:string}[];uncovered:{task_id:string;reference:string}[];uncovered_count:number;has_more:boolean;can_pay:boolean;treasury_balance:string|null};
export type WagePolicy={id:string;percentage:string;effective_at:string};
export type WagePolicyData={current:WagePolicy;history:(WagePolicy&{reason:string;changed_by:string|null})[];has_more:boolean;can_edit:boolean};
export type WageOverview={rows:{driver_id:string;full_name:string;position:WagePosition}[];has_more:boolean};
export type WageInput={kind:'policy';policyId:string;percentage:string;reason:string}|{kind:'pay';driverId:string;tasks:string[];amount:string};
export type WageResult={state:'completed';kind:'policy'|'payment';id:string;reference?:string}|{state:'rejected';code:string}|{state:'unknown'};
function string(v:unknown){if(typeof v!=='string')throw Error('بيانات الأجور غير مكتملة.');return v;}
function id(v:unknown){const s=string(v);validFinancialId(s);return s;}
function bool(v:unknown){if(typeof v!=='boolean')throw Error('الصلاحيات غير مكتملة.');return v;}
function date(v:unknown){const s=string(v);if(!Number.isFinite(Date.parse(s)))throw Error('تاريخ غير صالح.');return s;}
function count(v:unknown){if(!Number.isSafeInteger(v)||Number(v)<0)throw Error('عدد السجلات غير صالح.');return Number(v);}
function array(v:unknown){if(!Array.isArray(v))throw Error('السجل غير مكتمل.');return v;}
function reference(v:unknown,kind:'DLV'|'RCT'|'PAY'){const s=string(v);if(parseFinancialReference(s)?.kind!==kind)throw Error('مرجع مالي غير صالح.');return s;}
function cents(value:string):bigint{const [w,f]=handoverAmount(value,true).split('.');return BigInt(w)*100n+BigInt(f);}
function position(v:unknown):WagePosition{const p=c3Object(v);return{earned:custodyDecimal(p.earned),paid:custodyDecimal(p.paid),outstanding:custodyDecimal(p.outstanding),available:custodyDecimal(p.available),blocked:custodyDecimal(p.blocked),review_required:bool(p.review_required)};}
export function decodeWages(raw:unknown):WageData{
 const d=c3Object(raw);
 return{position:position(d.position),tasks:array(d.tasks).map(v=>{const r=c3Object(v);const a=custodyDecimal(r.amount),fee=custodyDecimal(r.fee_amount),rate=normalizeWageRate(string(r.percentage));
   if(cents(a)!==cents(calculateWage(fee,rate)))throw Error('مبلغ الأجرة لا يطابق لقطة النسبة ورسوم التوصيل.');
   if(!['zero_wage','paid','available','blocked','review'].includes(String(r.status))||(cents(a)===0n)!==(r.status==='zero_wage'))throw Error('حالة الأجرة غير صالحة.');
   const allocations=array(r.allocations).map(v=>{const a=c3Object(v);const value=custodyDecimal(a.amount);if(cents(value)<=0n)throw Error('تخصيص صفري غير صالح.');return{amount:value,reference:reference(a.reference,'RCT')};});
   const cashTotal=custodyDecimal(r.cash_total),remaining=custodyDecimal(r.cash_remaining);
   if(allocations.reduce((sum,a)=>sum+cents(a.amount),0n)+cents(remaining)!==cents(cashTotal)||r.status==='available'&&cents(remaining)!==0n)throw Error('تخصيصات العهدة غير مكتملة أو متعارضة.');
   return{task_id:id(r.task_id),amount:a,fee_amount:fee,percentage:rate,accrued_at:date(r.accrued_at),reference:reference(r.reference,'DLV'),cash_total:cashTotal,cash_remaining:remaining,status:r.status as WageTask['status'],allocations};
 }),payments:array(d.payments).map(v=>{const p=c3Object(v);return{id:id(p.id),amount:custodyDecimal(p.amount),paid_at:date(p.paid_at),paid_by:id(p.paid_by),reference:reference(p.reference,'PAY')};}),
 uncovered:array(d.uncovered).map(v=>{const p=c3Object(v);return{task_id:id(p.task_id),reference:reference(p.reference,'DLV')};}),uncovered_count:count(d.uncovered_count),has_more:bool(d.has_more),can_pay:bool(d.can_pay),treasury_balance:d.treasury_balance===null?null:custodyDecimal(d.treasury_balance)};
}
async function owner(actor:string){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==actor)throw new FinancialScopeError('تغير الحساب أو تعذر التحقق من الجلسة.');}
async function read(name:Rpc,args:Record<string,unknown>,actor:string){await owner(actor);const r=await rpc(name,args);await owner(actor);if(r.error){if('code' in r.error&&['42501','PGRST301'].includes(String(r.error.code)))throw new FinancialScopeError('لا توجد صلاحية لقراءة هذه الأجور.');throw Error('تعذر تحميل الأجور؛ لا نعرض مبلغًا تقديريًا.');}return r.data;}
export async function getC6Wages(driver:string,actor:string,page=0){validFinancialId(driver);return decodeWages(await read('get_c6_driver_wages',{target_driver:driver,expected_user:actor,page_number:page},actor));}
function policy(v:unknown):WagePolicy{const p=c3Object(v);return{id:id(p.id),percentage:normalizeWageRate(string(p.percentage)),effective_at:date(p.effective_at)};}
export async function getC6Policy(actor:string,page=0):Promise<WagePolicyData>{const d=c3Object(await read('get_c6_wage_policy',{expected_user:actor,page_number:page},actor));return{current:policy(d.current),history:array(d.history).map(v=>{const p=c3Object(v);return{...policy(p),reason:string(p.reason),changed_by:p.changed_by===null?null:id(p.changed_by)};}),has_more:bool(d.has_more),can_edit:bool(d.can_edit)};}
export async function getC6Overview(actor:string,page=0):Promise<WageOverview>{const d=c3Object(await read('list_c6_driver_wages',{expected_user:actor,page_number:page},actor));return{rows:array(d.rows).map(v=>{const p=c3Object(v);return{driver_id:id(p.driver_id),full_name:string(p.full_name),position:position(p.position)};}),has_more:bool(d.has_more)};}
export function normalizeWageInput(input:WageInput):WageInput{
 if(input.kind==='policy'){validFinancialId(input.policyId);const reason=input.reason.trim();if(reason.length<2||reason.length>1500)throw Error('أدخل سبب تعديل النسبة.');return{kind:'policy',policyId:input.policyId,percentage:normalizeWageRate(input.percentage),reason};}
 if(input.kind!=='pay')throw Error('نوع العملية غير صالح.');validFinancialId(input.driverId);if(!input.tasks.length||input.tasks.length>100||new Set(input.tasks).size!==input.tasks.length)throw Error('اختر أجور مهام غير مكررة.');input.tasks.forEach(validFinancialId);
 return{kind:'pay',driverId:input.driverId,tasks:[...input.tasks].sort(),amount:handoverAmount(input.amount)};
}
function result(v:unknown,input:WageInput):WageResult{
 const r=c3Object(v);if(r.state==='unknown')return{state:'unknown'};
 if(r.state==='rejected'&&['policy_changed','payout_disabled','ledger_requires_review','wage_not_available','amount_changed','insufficient_treasury'].includes(String(r.code)))return{state:'rejected',code:String(r.code)};
 if(r.state==='completed'&&input.kind==='policy'&&r.kind==='policy'&&normalizeWageRate(string(r.percentage))===input.percentage)return{state:'completed',kind:'policy',id:id(r.policy_id)};
 if(r.state==='completed'&&input.kind==='pay'&&r.kind==='payment'&&r.driver_id===input.driverId&&handoverAmount(custodyDecimal(r.amount))===input.amount)return{state:'completed',kind:'payment',id:id(r.payment_id),reference:reference(r.reference,'PAY')};
 throw Error('تعذر التحقق من نتيجة عملية الأجور.');
}
const operations=createDurableFinancialOperation<WageInput,WageResult>({
 namespace:'c6-wages:v1',normalize:normalizeWageInput,scopeFor:input=>input.kind==='policy'?'policy':`pay:${input.driverId}`,decode:result,owner,
 recover:(actor,key)=>rpc('recover_c6_operation',{expected_user:actor,attempt_key:key}),
 send:(actor,key,input)=>rpc(input.kind==='policy'?'save_c6_wage_policy':'pay_c6_driver_wages',input.kind==='policy'
  ?{expected_user:actor,attempt_key:key,expected_policy:input.policyId,percentage_value:input.percentage,change_reason:input.reason}
  :{target_driver:input.driverId,expected_user:actor,attempt_key:key,target_tasks:input.tasks,expected_amount:input.amount})
});
export const restoreC6Input=operations.restore,finishC6Operation=operations.finish,runC6Operation=operations.run;
