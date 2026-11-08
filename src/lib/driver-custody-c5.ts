import {createFinancialTransport as createC5Transport} from '@/lib/financial-transport';
import { supabase } from '@/lib/supabase';
import { c3Object } from '@/lib/c3-order-contract';
import { validFinancialId } from '@/lib/financial-input';
import { readLocalCache, writeLocalCache, invalidateLocalCache } from '@/lib/local-cache';
import { parseFinancialReference } from '@/lib/finance-c2-contract';
import { newIdempotencyKey } from '@/lib/driver-cash';

// Handwritten boundary for the UNAPPLIED C5 migration; not generated Supabase types.
type C5Rpc='request_c5_cash_handover'|'confirm_c5_cash_handover'|'recover_c5_cash_handover'|'get_c5_driver_custody'|'list_c5_cash_requests';
const client = supabase as unknown as { rpc(name: C5Rpc, args: Record<string, unknown>): PromiseLike<{data:unknown;error:{message:string;code?:string}|null}> };
export {createFinancialTransport as createC5Transport} from '@/lib/financial-transport';
const rpc=createC5Transport(client);
export type HandoverRequest={id:string;amount:string;requested_at:string;needs_review:boolean;last_counted:string|null};
export type CustodyHistory={id:string;amount:string;at:string;kind:string;reference:string|null};
export type C5Custody={position:{collected:string;confirmed:string;remaining:string;reserved:string;available:string;pending_count:number;ledger_requires_review:boolean};requests:HandoverRequest[];history:CustodyHistory[];has_more:boolean;can_request:boolean;can_confirm:boolean};
export type C5Queue={rows:(HandoverRequest&{driver_id:string;full_name:string})[];has_more:boolean;can_confirm:boolean};
export type HandoverInput={kind:'request';driverId:string;amount:string}|{kind:'confirm';driverId:string;requestId:string;amount:string};
export type HandoverResult={state:'completed';kind:'request'|'confirmed'|'discrepancy';requestId:string;reference?:string}|{state:'rejected';code:string}|{state:'unknown'};
type Intent={owner:string;key:string;input:HandoverInput};
export class C5ScopeError extends Error { readonly scopeDenied=true; }
export function custodyDecimal(value:unknown):string {
  if(typeof value!=='string'||value.length>100||! /^-?\d+(?:\.\d+)?$/.test(value))throw Error('المبلغ الخادمي غير صالح؛ أعد تحميل العهدة.');
  // PostgreSQL numeric may retain redundant scale (10.5000). Remove zeros only, never significant digits.
  const normalized=value.includes('.')?value.replace(/0+$/,'').replace(/\.$/,''):value;
  if(! /^-?(?:0|[1-9]\d{0,39})(?:\.\d{1,2})?$/.test(normalized))throw Error('دقة المبلغ الخادمي غير صالحة.');
  return normalized;
}
export function handoverAmount(value:string,allowZero=false):string {
  const normalized=value.trim().replace(',','.').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/٫/g,'.');
  if(!/^\d{1,20}(?:\.\d{1,2})?$/.test(normalized))throw Error('أدخل مبلغًا بالليرة السورية بمنزلتين عشريتين كحد أقصى.');
  const [whole,fraction='']=normalized.split('.');const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if(!allowZero&&cents===0n)throw Error('أدخل مبلغًا موجبًا.');
  return `${cents/100n}.${String(cents%100n).padStart(2,'0')}`;
}
async function owner(id:string){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==id)throw new C5ScopeError('تغير الحساب أو تعذر التحقق من الجلسة؛ أعد فتح الصفحة.');}
function boolean(value:unknown):boolean {if(typeof value!=='boolean')throw Error('بيانات العهدة غير مكتملة.');return value;}
function id(value:unknown):string{if(typeof value!=='string')throw Error('معرّف غير صالح.');validFinancialId(value);return value;}
function text(value:unknown):string{if(typeof value!=='string')throw Error('بيانات السجل غير مكتملة.');return value;}
function date(value:unknown):string{const s=text(value);if(!Number.isFinite(Date.parse(s)))throw Error('تاريخ مالي غير صالح.');return s;}
function requests(value:unknown):HandoverRequest[]{if(!Array.isArray(value))throw Error('قائمة الطلبات غير مكتملة.');return value.map(v=>{const r=c3Object(v);return{id:id(r.id),amount:custodyDecimal(r.amount),requested_at:date(r.requested_at),needs_review:boolean(r.needs_review),last_counted:r.last_counted===null?null:custodyDecimal(r.last_counted)};});}
export function decodeCustody(raw:unknown):C5Custody {
  const r=c3Object(raw),p=c3Object(r.position);
  if(!Number.isSafeInteger(p.pending_count)||Number(p.pending_count)<0||!Array.isArray(r.history))throw Error('بيانات العهدة غير مكتملة.');
  return{position:{collected:custodyDecimal(p.collected),confirmed:custodyDecimal(p.confirmed),remaining:custodyDecimal(p.remaining),reserved:custodyDecimal(p.reserved),available:custodyDecimal(p.available),pending_count:Number(p.pending_count),ledger_requires_review:boolean(p.ledger_requires_review)},requests:requests(r.requests),history:r.history.map(v=>{const h=c3Object(v);if(!['cash_delivery','zero_cash_delivery','confirmed','discrepancy'].includes(String(h.kind)))throw Error('حركة عهدة غير معروفة.');return{id:id(h.id),amount:custodyDecimal(h.amount),at:date(h.at),kind:String(h.kind),reference:h.reference===null?null:text(h.reference)};}),has_more:boolean(r.has_more),can_request:boolean(r.can_request),can_confirm:boolean(r.can_confirm)};
}
async function readRpc(name:C5Rpc,args:Record<string,unknown>,expected:string){await owner(expected);const r=await rpc(name,args);await owner(expected);if(r.error){if('code' in r.error&&['42501','PGRST301'].includes(String(r.error.code)))throw new C5ScopeError('تعذر التحقق من صلاحية قراءة هذه العهدة.');throw Error('تعذر تحميل العهدة الحالية؛ لا نعرض رصيدًا تقديريًا.');}return r.data;}
export async function getC5Custody(driverId:string,expected:string,page=0){validFinancialId(driverId);return decodeCustody(await readRpc('get_c5_driver_custody',{target_driver:driverId,expected_user:expected,page_number:page},expected));}
export async function getC5Queue(expected:string,filter:'pending'|'review',page=0):Promise<C5Queue>{
  const r=c3Object(await readRpc('list_c5_cash_requests',{expected_user:expected,state_filter:filter,page_number:page},expected));
  const base=requests(r.rows);const raw=r.rows as unknown[];
  return{rows:base.map((b,i)=>{const v=c3Object(raw[i]);return{...b,driver_id:id(v.driver_id),full_name:text(v.full_name)};}),has_more:boolean(r.has_more),can_confirm:boolean(r.can_confirm)};
}
function normalize(input:HandoverInput):HandoverInput {
  validFinancialId(input.driverId);
  if(input.kind==='request')return{kind:'request',driverId:input.driverId,amount:handoverAmount(input.amount)};
  if(input.kind!=='confirm')throw Error('نوع المحاولة غير صالح.');validFinancialId(input.requestId);
  return{kind:'confirm',driverId:input.driverId,requestId:input.requestId,amount:handoverAmount(input.amount,true)};
}
function decodeResult(raw:unknown,input:HandoverInput):HandoverResult {
  const r=c3Object(raw);
  if(r.state==='unknown')return{state:'unknown'};
  if(r.state==='rejected'&&['intake_disabled','ledger_requires_review','insufficient_available','already_confirmed_different_count'].includes(String(r.code)))return{state:'rejected',code:String(r.code)};
  if(r.state!=='completed'||!['request','confirmed','discrepancy'].includes(String(r.kind)))throw Error('تعذر التحقق من نتيجة المحاولة.');
  const requestId=id(r.request_id);
  if(input.kind==='confirm'&&(requestId!==input.requestId||r.kind==='request')||input.kind==='request'&&r.kind!=='request')throw Error('نتيجة المحاولة لا تطابق الطلب.');
  const actual=r.kind==='discrepancy'?r.counted:r.amount;
  if(handoverAmount(custodyDecimal(actual),true)!==input.amount)throw Error('المبلغ المثبت لا يطابق المحاولة.');
  if(r.kind==='confirmed'&&(typeof r.reference!=='string'||parseFinancialReference(r.reference)?.kind!=='RCT'))throw Error('الإيصال المؤكد بلا مرجع صالح.');
  return{state:'completed',kind:r.kind as 'request'|'confirmed'|'discrepancy',requestId,...(typeof r.reference==='string'?{reference:r.reference}:{})};
}
const locks=new Set<string>();
const keyFor=(actor:string,driver:string)=>`c5-handover:v1:${actor}:${driver}`;
async function recover(intent:Intent){try{return await rpc('recover_c5_cash_handover',{expected_user:intent.owner,attempt_key:intent.key});}catch{return{data:null,error:{message:'unknown'}};}}
export async function restoreC5Input(actor:string,driver:string):Promise<HandoverInput|undefined>{
  await owner(actor);const saved=await readLocalCache<Intent>(keyFor(actor,driver),{requirePersistence:true});await owner(actor);
  if(!saved)return undefined;
  if(saved.owner!==actor||normalize(saved.input).driverId!==driver||saved.input.kind==='request'&&driver!==actor)throw Error('المحاولة المحفوظة لا تخص هذه الصفحة.');validFinancialId(saved.key);
  return normalize(saved.input);
}
/** A NEW independent request/confirmation is deliberate; a fast repeat cannot create a second reservation. */
export async function finishC5Handover(actor:string,driver:string){
  const scope=keyFor(actor,driver);if(locks.has(scope))throw Error('المحاولة قيد التنفيذ.');locks.add(scope);
  try{
    await owner(actor);const intent=await readLocalCache<Intent>(scope,{requirePersistence:true});
    if(!intent)return;
    if(intent.owner!==actor||normalize(intent.input).driverId!==driver)throw Error('المحاولة لا تخص هذه الصفحة.');validFinancialId(intent.key);
    const found=await recover(intent);await owner(actor);
    if(found.error||decodeResult(found.data,intent.input).state==='unknown')throw Error('تحقق من نتيجة المحاولة قبل بدء عملية مستقلة.');
    await invalidateLocalCache(scope,{requirePersistence:true});
  }finally{locks.delete(scope);}
}
/** Pending input/key survives restart. Recovery can run without knowing the frozen form values. */
export async function runC5Handover(actor:string,driver:string,input?:HandoverInput,readOnly=false):Promise<HandoverResult>{
  validFinancialId(driver);const scope=keyFor(actor,driver);if(locks.has(scope))throw Error('المحاولة قيد التنفيذ.');locks.add(scope);
  try{
    await owner(actor);let intent=await readLocalCache<Intent>(scope,{requirePersistence:true});
    const current=input?normalize(input):undefined;
    if(current&&(current.driverId!==driver||current.kind==='request'&&current.driverId!==actor))throw Error('الطلب لا يخص هذه الصفحة.');
    if(intent){
      if(intent.owner!==actor||normalize(intent.input).driverId!==driver||intent.input.kind==='request'&&driver!==actor)throw Error('محاولة محفوظة في نطاق آخر.');validFinancialId(intent.key);
      const found=await recover(intent);await owner(actor);
      if(found.error)return{state:'unknown'};
      const result=decodeResult(found.data,intent.input);
      if(result.state!=='unknown')return result;
      if(readOnly)return result;
      if(current&&JSON.stringify(current)!==JSON.stringify(intent.input))throw Error('هناك محاولة غير محسومة بمدخلات أخرى؛ تحقق منها أولًا.');
    }else{
      if(readOnly)return{state:'unknown'};if(!current)throw Error('لا توجد محاولة محفوظة لإعادة إرسالها.');
      intent={owner:actor,key:newIdempotencyKey(),input:current};
    }
    await writeLocalCache(scope,intent,{requirePersistence:true});await owner(actor);
    const frozen=intent.input;
    let response:{data:unknown;error:{message:string;code?:string}|null};
    try{response=await rpc(frozen.kind==='request'?'request_c5_cash_handover':'confirm_c5_cash_handover',frozen.kind==='request'
      ?{expected_user:actor,attempt_key:intent.key,requested_amount:frozen.amount}
      :{expected_user:actor,attempt_key:intent.key,target_request:frozen.requestId,target_driver:frozen.driverId,counted_amount:frozen.amount});}
    catch{response={data:null,error:{message:'unknown'}};}
    await owner(actor);
    if(response.error)response=await recover(intent);
    await owner(actor);if(response.error)return{state:'unknown'};
    const result=decodeResult(response.data,intent.input);
    return result;
  }finally{locks.delete(scope);}
}
