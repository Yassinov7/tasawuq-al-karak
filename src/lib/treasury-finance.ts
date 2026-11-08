import {supabase} from '@/lib/supabase';
import {c3Object} from '@/lib/c3-order-contract';
import {custodyDecimal,handoverAmount,C5ScopeError} from '@/lib/driver-custody-c5';
import {validFinancialId} from '@/lib/financial-input';
import {parseFinancialReference} from '@/lib/finance-c2-contract';
import {parseOfferDay} from '@/lib/offer-expiration';
import {createFinancialTransport} from '@/lib/financial-transport';
import {createDurableFinancialOperation} from '@/lib/financial-operation';
// Explicit handwritten contract for the LOCAL UNAPPLIED C9 completion. Not generated database types.
export type TreasuryFinanceKind='expense'|'adjustment'|'opening';
export type TreasuryFinanceStage='requested'|'approved'|'posted'|'rejected';
export type TreasuryFinanceInput=({action:'request'}&({kind:'expense';amount:string;expenseType:string}|{kind:'adjustment';countId:string}|{kind:'opening';amount:string;source:string;cashDate:string})|{action:'approve'|'reject'|'pay';kind:TreasuryFinanceKind;requestId:string;ownerConfirmed:boolean})&{reason:string};
export type TreasuryFinanceResult={state:'unknown'}|{state:'rejected';code:string}|{state:'completed';kind:TreasuryFinanceKind;action:TreasuryFinanceInput['action'];stage:TreasuryFinanceStage;requestId:string;amount:string;reference:string|null;postingId:string|null;posted:boolean};
export type TreasuryFinanceRow={id:string;kind:TreasuryFinanceKind;amount:string;reason:string;requestedBy:string;at:string;stage:TreasuryFinanceStage;reference:string|null;postingId:string|null;countId:string|null;countActor:string|null;cashDelta:string|null;difference:string|null;book:string|null;counted:string|null;cutCurrent:boolean|null;expenseType:string|null;source:string|null;cashDate:string|null;events:{action:'approved'|'posted'|'rejected';actorId:string;reason:string;at:string;operationId:string}[]};
export type TreasuryFinanceData={kind:TreasuryFinanceKind;rows:TreasuryFinanceRow[];counts:{id:string;difference:string;counted:string;book:string;actorId:string;at:string;eligible:boolean}[];hasMore:boolean;enabled:boolean;openingEnabled:boolean;permissions:{request:boolean;approve:boolean;pay:boolean};treasuryBalance:string|null};
type Rpc='read_treasury_finance'|'request_treasury_finance'|'act_on_treasury_finance'|'recover_treasury_action';
const rpc=createFinancialTransport(supabase as unknown as {rpc(name:Rpc,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string;code?:string}|null}>});
function str(v:unknown){if(typeof v!=='string')throw Error('بيانات العملية المالية غير مكتملة.');return v;}
function id(v:unknown){const s=str(v);validFinancialId(s);return s;}
function bool(v:unknown){if(typeof v!=='boolean')throw Error('صلاحية مالية غير مكتملة.');return v;}
function date(v:unknown){const s=str(v);if(!Number.isFinite(Date.parse(s)))throw Error('تاريخ مالي غير صالح.');return s;}
function day(v:unknown){const s=str(v);try{parseOfferDay(s);}catch{throw Error('اختر تاريخ النقد الصحيح من التقويم.');}return s;}
function kind(v:unknown):TreasuryFinanceKind{if(v!=='expense'&&v!=='adjustment'&&v!=='opening')throw Error('نوع مالي غير صالح.');return v;}
function stage(v:unknown):TreasuryFinanceStage{if(v!=='requested'&&v!=='approved'&&v!=='posted'&&v!=='rejected')throw Error('مرحلة مالية غير صالحة.');return v;}
function nullable(v:unknown,parse:(v:unknown)=>string){return v===null?null:parse(v);}
function ref(v:unknown,k:TreasuryFinanceKind){const s=str(v);if(parseFinancialReference(s)?.kind!==(k==='expense'?'PAY':'ADJ'))throw Error('مرجع غير مطابق لنوع السند.');return s;}
export function normalizeTreasuryFinanceInput(input:TreasuryFinanceInput):TreasuryFinanceInput{
 const k=kind(input.kind),reason=input.reason.trim();if(reason.length<2||reason.length>1500)throw Error('أدخل سببًا موثقًا من حرفين إلى 1500 حرف.');
 if(input.action==='request'){
  if(input.kind==='adjustment'){validFinancialId(input.countId);return{action:'request',kind:'adjustment',countId:input.countId,reason};}
  const amount=handoverAmount(input.amount);
  if(input.kind==='expense'){const expenseType=input.expenseType.trim();if(expenseType.length<2||expenseType.length>100)throw Error('حدد نوع المصروف.');return{action:'request',kind:'expense',amount,expenseType,reason};}
  const source=input.source.trim();if(source.length<2||source.length>500)throw Error('حدد مصدر النقد الفعلي.');return{action:'request',kind:'opening',amount,source,cashDate:day(input.cashDate),reason};
 }
 if(!['approve','reject','pay'].includes(input.action)||input.action==='pay'&&k!=='expense')throw Error('إجراء غير مسموح لهذا السند.');
 validFinancialId(input.requestId);if(typeof input.ownerConfirmed!=='boolean'||input.action==='approve'&&k==='opening'&&!input.ownerConfirmed)throw Error('يلزم تأكيد المالك الصريح لاعتماد الافتتاحي.');
 return{action:input.action,kind:k,requestId:input.requestId,reason,ownerConfirmed:input.action==='approve'&&k==='opening'?input.ownerConfirmed:false};
}
export function decodeTreasuryFinance(raw:unknown):TreasuryFinanceData{
 const d=c3Object(raw),k=kind(d.kind),p=c3Object(d.permissions);if(!Array.isArray(d.rows)||!Array.isArray(d.counts))throw Error('السجل المالي غير مكتمل.');
 const rows=d.rows.map(v=>{const r=c3Object(v),s=stage(r.stage);if(kind(r.kind)!==k||!Array.isArray(r.events))throw Error('نطاق السند غير مطابق.');
  const postingId=nullable(r.posting_id,id),reference=r.reference===null?null:ref(r.reference,k);if((s==='posted')!==(postingId!==null)|| (s==='posted')!==(reference!==null))throw Error('لا يمكن إثبات ترحيل السند.');
  return{id:id(r.id),kind:k,amount:handoverAmount(custodyDecimal(r.amount)),reason:str(r.reason),requestedBy:id(r.requested_by),at:date(r.at),stage:s,reference,postingId,countId:nullable(r.count_id,id),countActor:nullable(r.count_actor,id),cashDelta:nullable(r.cash_delta,custodyDecimal),difference:nullable(r.difference,custodyDecimal),book:nullable(r.book,custodyDecimal),counted:nullable(r.counted,custodyDecimal),cutCurrent:r.cut_current===null?null:bool(r.cut_current),expenseType:nullable(r.expense_type,str),source:nullable(r.source,str),cashDate:nullable(r.cash_date,day),events:r.events.map<TreasuryFinanceRow['events'][number]>(v=>{const e=c3Object(v);if(e.action!=='approved'&&e.action!=='posted'&&e.action!=='rejected')throw Error('حدث مالي غير صالح.');return{action:e.action,actorId:id(e.actor_id),reason:str(e.reason),at:date(e.at),operationId:id(e.operation_id)};})};
 });
 return{kind:k,rows,counts:d.counts.map(v=>{const c=c3Object(v);return{id:id(c.id),difference:custodyDecimal(c.difference),counted:custodyDecimal(c.counted),book:custodyDecimal(c.book),actorId:id(c.actor_id),at:date(c.at),eligible:bool(c.eligible)};}),hasMore:bool(d.has_more),enabled:bool(d.enabled),openingEnabled:bool(d.opening_enabled),permissions:{request:bool(p.request),approve:bool(p.approve),pay:bool(p.pay)},treasuryBalance:nullable(d.treasury_balance,custodyDecimal)};
}
const businessCodes=['c9_disabled','count_unavailable','correction_exists','stale_count','invalid_cash_date','opening_after_movements','invalid_stage','self_approval','counter_approval','opening_disabled_or_unconfirmed','insufficient_treasury'];
export function decodeTreasuryFinanceResult(raw:unknown,input:TreasuryFinanceInput):TreasuryFinanceResult{
 const r=c3Object(raw);if(r.state==='unknown')return{state:'unknown'};if(r.state==='rejected'&&businessCodes.includes(String(r.code)))return{state:'rejected',code:String(r.code)};
 if(r.state!=='completed'||kind(r.kind)!==input.kind||r.action!==input.action)throw Error('نتيجة غير مطابقة للمحاولة.');
 const s=stage(r.stage),requestId=id(r.request_id),postingId=nullable(r.posting_id,id),reference=r.reference===null?null:ref(r.reference,input.kind),amount=handoverAmount(custodyDecimal(r.amount)),posted=bool(r.posted);
 if(input.action==='request'&&s!=='requested'||input.action==='reject'&&s!=='rejected'||input.action==='pay'&&s!=='posted'||input.action==='approve'&&(input.kind==='expense'?!['approved','posted'].includes(s):s!=='posted'))throw Error('مرحلة النتيجة لا تطابق الإجراء المطلوب.');
 if(posted!==(s==='posted')||posted!==(postingId!==null)||posted!==(reference!==null)||input.action!=='request'&&requestId!==input.requestId||input.action==='request'&&input.kind!=='adjustment'&&amount!==input.amount)throw new C5ScopeError('تعذر ربط النتيجة بالسند المحفوظ.');
 return{state:'completed',kind:input.kind,action:input.action,stage:s,requestId,amount,postingId,reference,posted};
}
async function owner(actor:string){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==actor)throw new C5ScopeError('تغير الحساب أو انتهت الجلسة.');}
export async function getTreasuryFinance(actor:string,k:TreasuryFinanceKind,page=0){await owner(actor);const r=await rpc('read_treasury_finance',{expected_user:actor,kind_value:k,page_number:page});await owner(actor);if(r.error){if('code' in r.error&&r.error.code==='42501')throw new C5ScopeError('لا تملك صلاحية هذا المسار المالي.');throw Error('تعذر تحميل السندات؛ لا نعرض رصيدًا تقديريًا.');}const d=decodeTreasuryFinance(r.data);if(d.kind!==k)throw new C5ScopeError('نطاق مالي غير مطابق.');return d;}
const operations=createDurableFinancialOperation<TreasuryFinanceInput,TreasuryFinanceResult>({namespace:'treasury-finance:v1',normalize:normalizeTreasuryFinanceInput,scopeFor:()=> 'office',decode:decodeTreasuryFinanceResult,owner,recover:(actor,key)=>rpc('recover_treasury_action',{expected_user:actor,attempt_key:key}),send:(actor,key,input)=>{
 const common={expected_user:actor,attempt_key:key};if(input.action==='request'){const base={kind:input.kind,reason:input.reason};const request_input=input.kind==='expense'?{...base,amount:input.amount,expense_type:input.expenseType}:input.kind==='adjustment'?{...base,count_id:input.countId}:{...base,amount:input.amount,source:input.source,cash_date:input.cashDate};return rpc('request_treasury_finance',{...common,request_input});}
 return rpc('act_on_treasury_finance',{...common,target_request:input.requestId,action_value:input.action,action_reason:input.reason,owner_confirmed:input.ownerConfirmed});
}});
export const treasuryFinanceOperationApi={restore:operations.restore,run:operations.run,finish:operations.finish};
