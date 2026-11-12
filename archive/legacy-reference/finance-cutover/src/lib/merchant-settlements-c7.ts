import {supabase} from '@/lib/supabase';
import {c3Object} from '@/lib/c3-order-contract';
import {validFinancialId} from '@/lib/financial-input';
import {parseFinancialReference} from '@/lib/finance-c2-contract';
import {custodyDecimal,handoverAmount,C5ScopeError} from '@/lib/driver-custody-c5';
import {normalizeFinancialRate,calculatePercentage,sumFinancialAmounts} from '@/lib/financial-decimal';
import {createFinancialTransport} from '@/lib/financial-transport';
import {createDurableFinancialOperation} from '@/lib/financial-operation';
// Handwritten LOCAL UNAPPLIED C7 DTOs, not officially generated Supabase types.
type Rpc='get_c7_merchant_settlements'|'list_c7_merchant_settlements'|'prepare_c7_settlement'|'pay_c7_settlement'|'recover_c7_operation';
const rpc=createFinancialTransport(supabase as unknown as {rpc(name:Rpc,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string;code?:string}|null}>});
export type MerchantPosition={gross:string;commission:string;net:string;pending:string;paid:string;available:string;review_required:boolean};
export type MerchantSub={store_order_id:string;gross:string;commission_rate:string;commission:string;net:string;recorded_at:string;sub_reference:string;order_reference:string;status:'zero_net'|'paid'|'pending'|'review'|'available'};
export type MerchantSettlement={id:string;amount:string;prepared_at:string;reference:string;status:'pending'|'paid';pay_reference:string|null;paid_at:string|null;items:{sub_reference:string;amount:string}[]};
export type MerchantSettlementData={store_id:string;store_name:string;position:MerchantPosition;subs:MerchantSub[];settlements:MerchantSettlement[];can_prepare:boolean;can_pay:boolean;treasury_balance:string|null;has_more:boolean};
export type SettlementInput={kind:'prepare';storeId:string;subs:string[];amount:string}|{kind:'pay';storeId:string;settlementId:string;amount:string};
export type SettlementResult={state:'unknown'}|{state:'rejected';code:string}|{state:'completed';kind:'settlement'|'payment';id:string;reference:string};
function text(v:unknown){if(typeof v!=='string')throw Error('سجل التسوية غير مكتمل.');return v;}
function id(v:unknown){const s=text(v);validFinancialId(s);return s;}
function bool(v:unknown){if(typeof v!=='boolean')throw Error('صلاحيات التسوية غير مكتملة.');return v;}
function array(v:unknown){if(!Array.isArray(v))throw Error('قائمة التسويات غير مكتملة.');return v;}
function date(v:unknown){const s=text(v);if(!Number.isFinite(Date.parse(s)))throw Error('تاريخ غير صالح.');return s;}
function ref(v:unknown,kind:'ORD'|'SUB'|'SET'|'PAY'){const s=text(v);if(parseFinancialReference(s)?.kind!==kind)throw Error('مرجع تسوية غير صالح.');return s;}
function position(v:unknown):MerchantPosition{const p=c3Object(v);return{gross:custodyDecimal(p.gross),commission:custodyDecimal(p.commission),net:custodyDecimal(p.net),pending:custodyDecimal(p.pending),paid:custodyDecimal(p.paid),available:custodyDecimal(p.available),review_required:bool(p.review_required)};}
export function decodeMerchantSettlements(raw:unknown):MerchantSettlementData{
 const d=c3Object(raw);return{store_id:id(d.store_id),store_name:text(d.store_name),position:position(d.position),
 subs:array(d.subs).map(v=>{const s=c3Object(v),gross=custodyDecimal(s.gross),commission=custodyDecimal(s.commission),net=custodyDecimal(s.net),rate=normalizeFinancialRate(text(s.commission_rate));
  if(handoverAmount(calculatePercentage(gross,rate),true)!==handoverAmount(commission,true)||sumFinancialAmounts([net,commission])!==handoverAmount(gross,true))throw Error('تعارض بين المبلغ والنسبة المثبتة؛ الصرف متوقف.');
  if(!['zero_net','paid','pending','review','available'].includes(String(s.status))||(handoverAmount(net,true)==='0.00')!==(s.status==='zero_net'))throw Error('حالة مستحق غير صالحة.');
  return{store_order_id:id(s.store_order_id),gross,commission_rate:rate,commission,net,recorded_at:date(s.recorded_at),sub_reference:ref(s.sub_reference,'SUB'),order_reference:ref(s.order_reference,'ORD'),status:s.status as MerchantSub['status']};}),
 settlements:array(d.settlements).map(v=>{const s=c3Object(v);const items=array(s.items).map(v=>{const i=c3Object(v);return{sub_reference:ref(i.sub_reference,'SUB'),amount:handoverAmount(custodyDecimal(i.amount))};});
  const amount=handoverAmount(custodyDecimal(s.amount));if(!items.length||new Set(items.map(i=>i.sub_reference)).size!==items.length||sumFinancialAmounts(items.map(i=>i.amount))!==amount)throw Error('بنود التسوية غير متوازنة.');
  if(!['paid','pending'].includes(String(s.status))||(s.status==='paid')!==(s.pay_reference!==null))throw Error('حالة الصرف غير مكتملة.');
  return{id:id(s.id),amount,prepared_at:date(s.prepared_at),reference:ref(s.reference,'SET'),status:s.status as 'paid'|'pending',pay_reference:s.pay_reference===null?null:ref(s.pay_reference,'PAY'),paid_at:s.paid_at===null?null:date(s.paid_at),items};}),
 can_prepare:bool(d.can_prepare),can_pay:bool(d.can_pay),treasury_balance:d.treasury_balance===null?null:custodyDecimal(d.treasury_balance),has_more:bool(d.has_more)};
}
async function owner(actor:string){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==actor)throw new C5ScopeError('تغير الحساب أو تعذر التحقق من الجلسة.');}
async function read(name:Rpc,args:Record<string,unknown>,actor:string){await owner(actor);const r=await rpc(name,args);await owner(actor);if(r.error){if('code' in r.error&&r.error.code==='42501')throw new C5ScopeError('لا توجد صلاحية لقراءة هذا المتجر.');throw Error('تعذر تحميل المستحقات؛ لا نعرض صفرًا تقديريًا.');}return r.data;}
export async function getC7Settlements(actor:string,storeId:string|null=null,page=0){if(storeId)validFinancialId(storeId);const d=decodeMerchantSettlements(await read('get_c7_merchant_settlements',{expected_user:actor,target_store:storeId,page_number:page},actor));if(storeId&&d.store_id!==storeId)throw new C5ScopeError('بيانات متجر غير مطابقة.');return d;}
export async function getC7Overview(actor:string,page=0){const d=c3Object(await read('list_c7_merchant_settlements',{expected_user:actor,page_number:page},actor));return{rows:array(d.rows).map(v=>{const r=c3Object(v);return{store_id:id(r.store_id),store_name:text(r.store_name),position:position(r.position)};}),has_more:bool(d.has_more)};}
export function normalizeSettlementInput(input:SettlementInput):SettlementInput{
 validFinancialId(input.storeId);const amount=handoverAmount(input.amount);
 if(input.kind==='pay'){validFinancialId(input.settlementId);return{kind:'pay',storeId:input.storeId,settlementId:input.settlementId,amount};}
 if(input.kind!=='prepare'||!input.subs.length||input.subs.length>100||new Set(input.subs).size!==input.subs.length)throw Error('اختر مستحقات كاملة غير مكررة.');input.subs.forEach(validFinancialId);return{kind:'prepare',storeId:input.storeId,subs:[...input.subs].sort(),amount};
}
function result(raw:unknown,input:SettlementInput):SettlementResult{const r=c3Object(raw);if(r.state==='unknown')return{state:'unknown'};
 if(r.state==='rejected'&&['settlements_disabled','payout_disabled','ledger_requires_review','sub_not_available','amount_changed','insufficient_treasury'].includes(String(r.code)))return{state:'rejected',code:String(r.code)};
 if(r.state==='completed'&&r.kind===(input.kind==='prepare'?'settlement':'payment')&&r.store_id===input.storeId&&handoverAmount(custodyDecimal(r.amount))===input.amount&&(input.kind!=='pay'||r.settlement_id===input.settlementId))return{state:'completed',kind:input.kind==='prepare'?'settlement':'payment',id:id(input.kind==='prepare'?r.settlement_id:r.payment_id),reference:ref(r.reference,input.kind==='prepare'?'SET':'PAY')};
 throw Error('تعذر إثبات نتيجة التسوية.');
}
const operations=createDurableFinancialOperation<SettlementInput,SettlementResult>({namespace:'c7-settlements:v1',normalize:normalizeSettlementInput,scopeFor:i=>i.storeId,decode:result,owner,
 recover:(actor,key)=>rpc('recover_c7_operation',{expected_user:actor,attempt_key:key}),
 send:(actor,key,i)=>rpc(i.kind==='prepare'?'prepare_c7_settlement':'pay_c7_settlement',i.kind==='prepare'?{target_store:i.storeId,expected_user:actor,attempt_key:key,target_subs:i.subs,expected_amount:i.amount}:{target_store:i.storeId,target_settlement:i.settlementId,expected_user:actor,attempt_key:key,expected_amount:i.amount})
});
export const restoreC7Input=operations.restore,finishC7Operation=operations.finish,runC7Operation=operations.run;
