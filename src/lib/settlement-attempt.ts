import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { newIdempotencyKey } from '@/lib/driver-cash';
import { createSettlement, recordSettlementPayment } from '@/lib/merchant-settlements';
import { centsAmount, moneyCents, sumMoney, validFinancialId } from '@/lib/financial-input';
export type BatchInput = { merchantId: string; ids: string[]; note?: string };
export type PaymentInput = { batchId: string; amount: number; allocations: { batch_entitlement_id: string; amount: number }[]; reference?: string; note?: string };
export type SettlementOperation = { kind: 'batch'; input: BatchInput } | { kind: 'payment'; input: PaymentInput };
export type SettlementAttempt = SettlementOperation & { ownerId: string; key: string; phase: 'prepared' | 'sending' | 'unknown' | 'confirmed' | 'rejected'; resultId?: string };
export type AttemptResult = { kind: 'confirmed'; id: string } | { kind: 'unknown' | 'rejected'; message: string };
export function settlementAllocations(amount: number, entitlements: { batch_entitlement_id?: string; remaining_amount: number }[]) {
  let remaining = moneyCents(amount);
  const allocations = entitlements.flatMap(row => { const available = moneyCents(row.remaining_amount), used = remaining < available ? remaining : available; if (used <= 0n) return []; if (!row.batch_entitlement_id) throw new Error('عنصر التسوية غير مكتمل.'); remaining -= used; return [{ batch_entitlement_id: row.batch_entitlement_id, amount: centsAmount(used) }]; });
  if (remaining !== 0n) throw new Error('تخصيص الدفعة غير مكتمل؛ حدّث التسوية.'); return allocations;
}
export function normalizeOperation(operation: SettlementOperation): SettlementOperation {
  if (operation.kind === 'batch') { validFinancialId(operation.input.merchantId); if (!operation.input.ids.length || new Set(operation.input.ids).size !== operation.input.ids.length) throw new Error('اختر مستحقات غير مكررة.'); operation.input.ids.forEach(validFinancialId); return { kind:'batch', input:{merchantId:operation.input.merchantId,ids:[...operation.input.ids].sort(),note:operation.input.note?.trim() || ''} }; }
  validFinancialId(operation.input.batchId); const allocations = operation.input.allocations.map(row=>{validFinancialId(row.batch_entitlement_id);if(moneyCents(row.amount)<=0n)throw new Error('تخصيص غير صالح.');return{...row};}).sort((a,b)=>a.batch_entitlement_id.localeCompare(b.batch_entitlement_id));
  if (moneyCents(operation.input.amount)<=0n || !allocations.length || new Set(allocations.map(row=>row.batch_entitlement_id)).size!==allocations.length || sumMoney(allocations.map(row=>row.amount))!==operation.input.amount) throw new Error('مجموع التخصيصات لا يطابق الدفعة.');
  return {kind:'payment',input:{batchId:operation.input.batchId,amount:operation.input.amount,allocations,reference:operation.input.reference?.trim()||'',note:operation.input.note?.trim()||''}};
}
const storageKey = (ownerId: string, scope: string) => `@tasawuq/settlement-attempt/syp-v1/${ownerId}/${scope}`;
export const settlementAttemptApi = {
  async owner(ownerId: string) { const result=await supabase.auth.getUser(); if(result.error||result.data.user?.id!==ownerId)throw new Error('تغير الحساب؛ أعد فتح الصفحة.'); },
  async read(ownerId: string, scope: string): Promise<SettlementAttempt|null> {
    const text=await AsyncStorage.getItem(storageKey(ownerId,scope)); if(!text)return null;
    const value: SettlementAttempt=JSON.parse(text);
    if(!value||value.ownerId!==ownerId||!['batch','payment'].includes(value.kind)||!['prepared','sending','unknown','confirmed','rejected'].includes(value.phase))throw new Error('تعذر قراءة محاولة التسوية المحفوظة.');
    validFinancialId(value.key);normalizeOperation(value);
    if(scope==='create'&&value.kind!=='batch'||scope.startsWith('payment:')&&(value.kind!=='payment'||value.input.batchId!==scope.slice(8)))throw new Error('محاولة الاستعادة لا تخص هذه الصفحة.');
    return value;
  },
  write: (ownerId:string,scope:string,value:SettlementAttempt)=>AsyncStorage.setItem(storageKey(ownerId,scope),JSON.stringify(value)),
  clear: (ownerId:string,scope:string)=>AsyncStorage.removeItem(storageKey(ownerId,scope)),
  key: newIdempotencyKey,
  async find(attempt:SettlementAttempt) {
    if(attempt.kind==='batch') {const result=await supabase.from('merchant_settlement_batches').select('id,merchant_id').eq('idempotency_key',attempt.key).eq('merchant_id',attempt.input.merchantId).maybeSingle();if(result.error)throw result.error;return result.data?.id??null;}
    const result=await supabase.from('merchant_settlement_payments').select('id,amount,external_reference,note').eq('idempotency_key',attempt.key).eq('batch_id',attempt.input.batchId).maybeSingle();if(result.error)throw result.error;
    if(result.data&&(result.data.amount!==attempt.input.amount||(result.data.external_reference??'')!==(attempt.input.reference??'')||result.data.note!==(attempt.input.note??'')))throw new Error('المحاولة لا تطابق الدفعة المثبتة.');return result.data?.id??null;
  },
  send: (attempt:SettlementAttempt)=>attempt.kind==='batch'?createSettlement({...attempt.input,idempotencyKey:attempt.key}):recordSettlementPayment({...attempt.input,idempotencyKey:attempt.key}),
};
/** Durable snapshot is written before sending. Verification/retry always uses that same snapshot and key. */
export function createSettlementAttemptController(ownerId:string,scope:string,api=settlementAttemptApi) {
  let locked=false;
  return {
    restore:()=>api.read(ownerId,scope),
    async finish() { await api.owner(ownerId); const saved=await api.read(ownerId,scope);if(saved&&saved.phase!=='confirmed'&&saved.phase!=='rejected')throw new Error('المحاولة تحتاج إلى تحقق.');await api.clear(ownerId,scope); },
    async run(operation:SettlementOperation,readOnly=false):Promise<AttemptResult> {
      if(locked)return{kind:'unknown',message:'المحاولة قيد التنفيذ.'};locked=true;
      let attempt:SettlementAttempt|null=null, sent=false;
      try {
        await api.owner(ownerId);const normalized=normalizeOperation(operation);attempt=await api.read(ownerId,scope);
        if(attempt){const previous=normalizeOperation(attempt);if(JSON.stringify(previous)!==JSON.stringify(normalized))throw new Error('هناك محاولة محفوظة بمدخلات مختلفة؛ تحقق منها قبل بدء عملية مستقلة.');}
        else {if(readOnly)return{kind:'unknown',message:'لا توجد محاولة محفوظة للتحقق.'};attempt={...normalized,ownerId,key:api.key(),phase:'prepared'};await api.write(ownerId,scope,attempt);}
        const existing=await api.find(attempt);if(existing){await api.write(ownerId,scope,{...attempt,phase:'confirmed',resultId:existing});return{kind:'confirmed',id:existing};}
        if(readOnly)return{kind:'unknown',message:'لم يظهر سجل مطابق في هذه القراءة. النتيجة غير محسومة؛ إعادة الإرسال تستخدم المفتاح نفسه.'};
        if(attempt.phase==='confirmed')return{kind:'unknown',message:'تعذر العثور على السجل الذي تأكد سابقًا؛ لا نعيد إرساله.'};
        if(attempt.phase==='rejected')return{kind:'rejected',message:'رُفضت هذه المحاولة. أنهِها قبل بدء عملية جديدة.'};
        attempt={...attempt,phase:'sending'};await api.write(ownerId,scope,attempt);await api.owner(ownerId);
        sent=true;const id=await api.send(attempt);if(!id)throw new Error('Missing result');
        await api.write(ownerId,scope,{...attempt,phase:'confirmed',resultId:id});return{kind:'confirmed',id};
      } catch(failure) {
        if(attempt){
          let verifiedAbsent=false;
          try{await api.owner(ownerId);const id=await api.find(attempt);if(id){await api.write(ownerId,scope,{...attempt,phase:'confirmed',resultId:id});return{kind:'confirmed',id};}verifiedAbsent=true;}catch{/* No claim of success/failure when verification fails. */}
          const code=typeof failure==='object'&&failure!==null&&'code'in failure?String(failure.code):'';
          const rejected=sent&&verifiedAbsent&&/^(P0001|22\w{3}|23\w{3}|42501)$/.test(code);
          try{await api.write(ownerId,scope,{...attempt,phase:rejected?'rejected':attempt.phase==='confirmed'?'confirmed':'unknown'});}catch{/* Keep the previously persisted sending snapshot. */}
          return{kind:rejected?'rejected':'unknown',message:rejected?'رفض الخادم هذه المحاولة. تحقق من المتبقي والاختيار قبل عملية جديدة.':'تعذر تأكيد النتيجة. تحقق بالقراءة أو أعد المحاولة بالمفتاح المحفوظ نفسه.'};
        }
        return{kind:'unknown',message:failure instanceof Error?failure.message:'تعذر حفظ المحاولة؛ لم نبدأ الإرسال.'};
      } finally{locked=false;}
    },
  };
}
