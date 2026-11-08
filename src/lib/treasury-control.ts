import {supabase} from '@/lib/supabase';
import {c3Object} from '@/lib/c3-order-contract';
import {custodyDecimal,handoverAmount,C5ScopeError} from '@/lib/driver-custody-c5';
import {validFinancialId} from '@/lib/financial-input';
import {createFinancialTransport} from '@/lib/financial-transport';
import {createDurableFinancialOperation} from '@/lib/financial-operation';
import {parseFinancialReference} from '@/lib/finance-c2-contract';

// Handwritten boundary for LOCAL UNAPPLIED C9, not generated remote types.
export type TreasuryView='dashboard'|'ledger'|'expenses'|'counts'|'differences'|'opening';
export type TreasuryInput=({kind:'start'}|{kind:'count';session_id:string;amount:string}|{kind:'cancel_count'|'review';session_id:string}|{kind:'expense_request';amount:string;expense_type:string}|{kind:'opening_request';amount:string;source:string})&{reason:string};
export type TreasuryResult={state:'unknown'}|{state:'rejected';code:string}|{state:'completed';id:string;kind:TreasuryInput['kind'];posted:false};
export type TreasuryPermission='dashboard'|'ledger'|'expense'|'pay'|'count'|'review'|'adjust'|'opening';
export type TreasuryRow={id:string;at:string;kind:string;reason:string|null;amount:string|null;difference:string|null;balance:string|null;side:'debit'|'credit'|null;reference:string|null;journal_reference:string|null;journal_id:string|null;actor_id:string|null;operation_id:string;session_id:string|null;reviewed:boolean;cut:{balance:string;snapshot:string}|null;event:string|null;source:string|null;expense_type:string|null;reversal_of:string|null};
export type TreasuryData={view:TreasuryView;metrics:Record<string,string>|null;rows:TreasuryRow[];details:{reason:string;lines:{account:string;side:'debit'|'credit';amount:string}[]}|null;has_more:boolean;permissions:Record<TreasuryPermission,boolean>;enabled:boolean;open_session:{id:string;actor_id:string;cut:{balance:string;snapshot:string};at:string}|null};
type Rpc='read_treasury_control'|'record_treasury_action'|'recover_treasury_action';
const rpc=createFinancialTransport(supabase as unknown as {rpc(name:Rpc,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string;code?:string}|null}>});
function text(v:unknown){if(typeof v!=='string')throw Error('سجل الخزينة غير مكتمل.');return v;}
function bool(v:unknown){if(typeof v!=='boolean')throw Error('صلاحيات الخزينة غير مكتملة.');return v;}
function id(v:unknown){const s=text(v);validFinancialId(s);return s;}
function date(v:unknown){const s=text(v);if(!Number.isFinite(Date.parse(s)))throw Error('توقيت غير صالح.');return s;}
function ref(v:unknown){const s=text(v);if(!parseFinancialReference(s))throw Error('مرجع مالي غير صالح.');return s;}
function nullable(v:unknown,parse:(v:unknown)=>string){return v===null||v===undefined?null:parse(v);}
export function treasuryCountAmount(v:string){return handoverAmount(v,true);}
export function normalizeTreasuryInput(i:TreasuryInput):TreasuryInput{
 const reason=i.reason.trim();if(reason.length<2||reason.length>1500)throw Error('أدخل سببًا موثقًا من حرفين إلى 1500 حرف.');
 switch(i.kind){case'start':return{kind:i.kind,reason};case'count':validFinancialId(i.session_id);return{kind:i.kind,reason,session_id:i.session_id,amount:treasuryCountAmount(i.amount)};
 case'cancel_count':case'review':validFinancialId(i.session_id);return{kind:i.kind,reason,session_id:i.session_id};
 case'expense_request':case'opening_request':{const amount=treasuryCountAmount(i.amount);if(BigInt(amount.replace('.',''))===0n)throw Error('المبلغ يجب أن يكون موجبًا.');
 if(i.kind==='expense_request'){const expense_type=i.expense_type.trim();if(expense_type.length<2||expense_type.length>100)throw Error('حدد نوع المصروف.');return{kind:i.kind,reason,amount,expense_type};}
 const source=i.source.trim();if(source.length<2||source.length>500)throw Error('حدد مصدر الرصيد الافتتاحي.');return{kind:i.kind,reason,amount,source};}
 default:throw Error('إجراء خزينة غير صالح.');}
}
function cut(raw:unknown){const c=c3Object(raw);return{balance:custodyDecimal(c.balance),snapshot:text(c.snapshot)};}
export function decodeTreasury(raw:unknown):TreasuryData{
 const d=c3Object(raw),p=c3Object(d.permissions);if(!['dashboard','ledger','expenses','counts','differences','opening'].includes(String(d.view))||!Array.isArray(d.rows))throw Error('بيانات الخزينة غير مكتملة.');
 if(d.expense_posting_enabled!==false||d.adjustment_posting_enabled!==false||d.opening_posting_enabled!==false)throw Error('تغير عقد الترحيل؛ يلزم تحديث الواجهة.');
 const metrics=d.metrics===null?null:Object.fromEntries(['treasury','receipts','payments','net','driver_cash','driver_payable','merchant_payable','subscription_receivable'].map(k=>[k,custodyDecimal(c3Object(d.metrics)[k])]));
 if(metrics){for(const k of ['unreviewed_differences','negative_accounts','cash_receipt_discrepancies','pricing_exceptions']){const n=c3Object(d.metrics)[k];if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0)throw Error('تنبيه خزينة غير صالح.');metrics[k]=String(n);}}
 const rows=d.rows.map(v=>{const r=c3Object(v),ledger=d.view==='ledger';if(ledger&&(r.state!=='completed'||!['debit','credit'].includes(String(r.side))))throw Error('حركة غير مرحّلة.');return{
 id:id(r.id),at:date(r.at),kind:ledger?text(r.operation_type):text(r.kind),reason:nullable(r.reason,text),amount:nullable(r.amount,custodyDecimal),difference:nullable(r.difference,custodyDecimal),balance:nullable(r.balance,custodyDecimal),side:ledger?r.side as 'debit'|'credit':null,
 reference:nullable(r.reference,ref),journal_reference:nullable(r.journal_reference,ref),journal_id:nullable(r.journal_id,id),actor_id:nullable(r.actor_id,id),operation_id:id(r.operation_id),session_id:nullable(r.session_id,id),reviewed:r.reviewed===true,cut:r.cut===null||r.cut===undefined?null:cut(r.cut),event:nullable(r.event,text),source:nullable(r.source,text),expense_type:nullable(r.expense_type,text),reversal_of:nullable(r.reversal_of,id)};});
 const details=d.details===null||d.details===undefined?null:c3Object(d.details);if(details&&!Array.isArray(details.lines))throw Error('تفاصيل القيد غير مكتملة.');
 const lines=details?(details.lines as unknown[]).map<{account:string;side:'debit'|'credit';amount:string}>(v=>{const l=c3Object(v);if(l.side!=='debit'&&l.side!=='credit')throw Error('طرف القيد غير صالح.');return{account:text(l.account),side:l.side,amount:custodyDecimal(l.amount)};}):[];
 const s=d.open_session===null?null:c3Object(d.open_session);return{view:d.view as TreasuryView,metrics,rows,details:details?{reason:text(details.reason),lines}:null,has_more:bool(d.has_more),permissions:Object.fromEntries(['dashboard','ledger','expense','pay','count','review','adjust','opening'].map(k=>[k,bool(p[k])])) as TreasuryData['permissions'],enabled:bool(d.enabled),open_session:s?{id:id(s.id),actor_id:id(s.actor_id),cut:cut(s.cut),at:date(s.at)}:null};
}
async function owner(actor:string){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==actor)throw new C5ScopeError('تغير الحساب أو انتهت الجلسة.');}
export async function getTreasury(actor:string,view:TreasuryView,page=0,from:string|null=null,to:string|null=null,direction:'all'|'in'|'out'='all',journalId:string|null=null){
 await owner(actor);if(journalId)validFinancialId(journalId);const r=await rpc('read_treasury_control',{expected_user:actor,view_value:view,page_number:page,from_time:from,to_time:to,direction_value:direction,target_journal:journalId});await owner(actor);
 if(r.error){if('code' in r.error&&r.error.code==='42501')throw new C5ScopeError('لا تملك صلاحية هذا القسم من الخزينة.');throw Error('تعذر تحميل الخزينة؛ الرصيد غير معلوم.');}const d=decodeTreasury(r.data);if(d.view!==view)throw new C5ScopeError('نطاق قراءة غير مطابق.');return d;
}
export function decodeTreasuryResult(raw:unknown,input:TreasuryInput):TreasuryResult{const r=c3Object(raw);if(r.state==='unknown')return{state:'unknown'};if(r.state==='rejected'&&['c9_disabled','session_unavailable','already_completed','count_already_open','cash_moved_restart_count'].includes(String(r.code)))return{state:'rejected',code:String(r.code)};
 if(r.state!=='completed'||r.posted!==false||r.kind!==input.kind)throw Error('تعذر إثبات نتيجة الرقابة.');return{state:'completed',kind:input.kind,id:id(r.id),posted:false};}
const operations=createDurableFinancialOperation<TreasuryInput,TreasuryResult>({namespace:'treasury-control:v1',normalize:normalizeTreasuryInput,scopeFor:()=> 'office',decode:decodeTreasuryResult,owner,recover:(actor,key)=>rpc('recover_treasury_action',{expected_user:actor,attempt_key:key}),send:(actor,key,input)=>rpc('record_treasury_action',{expected_user:actor,attempt_key:key,action_input:input})});
export const treasuryOperationApi={restore:operations.restore,run:operations.run,finish:operations.finish};
