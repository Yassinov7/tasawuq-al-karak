// Offline: actual persisted-intent inspection/enrichment, mocked authenticated reads only.
const assert=require('node:assert/strict');const {load}=require('./financial-test-loader.cjs');
let actor='admin',result={},fail=false,calls=0;const disk=new Map(),saved={owner:'admin',key:'original-key',input:{action:'settle',due:'due',amount:'12.50',reason:'قبض تجريبي'}};
const cache='invoice-finance-action:v1:admin';disk.set(cache,saved);
let onPeople=()=>{};
const client={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},rpc:async(name,args)=>{calls++;assert.equal(name,'recover_money_action','inspection must never call a writer');assert.equal(args.attempt_key,'original-key');if(fail)throw Error('offline');return{data:result,error:null};},from:table=>{assert.equal(table,'money_dues');const q={select:()=>q,eq:(key,value)=>{assert.equal(key,'id');assert.equal(value,'due');return q;},maybeSingle:async()=>({data:{invoice_id:'invoice'},error:null})};return q;}};
const mocks={'@/lib/supabase':{supabase:client},'@/lib/local-cache':{readLocalCache:async k=>disk.get(k),writeLocalCache:async()=>{throw Error('inspection changed cache');},invalidateLocalCache:async()=>{throw Error('inspection discarded key');}},'@/lib/request-key':{newIdempotencyKey:()=>{throw Error('inspection generated a new key');}}};
const finance=load('src/lib/invoice-finance.ts',mocks);
const read=load('src/lib/pending-money-review.ts',{...mocks,'@/lib/invoice-finance':{...finance,readInvoice:async()=>({id:'invoice',reference:'SUB-0000001',owner_id:'merchant',amount:'100',dues:[{id:'due',direction:'in'}]}),moneyPeople:async()=>{onPeople();return[{id:'merchant',name:'تاجر اختبار',role:'merchant',account_reference:'ACC-0000001'}];}}}).readPendingMoneyReview;
async function main(){
 const before=JSON.stringify(saved);let review=await read('admin');assert.equal(review.party,'تاجر اختبار');assert.equal(review.partyRole,'تاجر');assert.equal(review.reference,'SUB-0000001');assert.equal(review.amount,'12.50');assert.equal(review.label,'قبض فعلي للمنصة');assert.equal(review.attemptKey,'original-key');assert.equal(review.result,undefined);assert.equal(JSON.stringify(disk.get(cache)),before);
 result={state:'completed',invoice_id:'settlement'};review=await read('admin');assert.equal(review.result.state,'completed');assert(disk.has(cache),'checking completion never silently clears intent');
 result={state:'rejected',message:'excess settlement'};review=await read('admin');assert.equal(review.result.state,'rejected');assert(review.result.message.includes('يتجاوز'));
 fail=true;review=await read('admin');assert.equal(review.result,undefined);assert(review.notice.includes('تعذر جلب'));fail=false;
 const previous=calls;await assert.rejects(finance.moneyAction('admin',undefined,'different-key'));assert.equal(calls,previous,'stale summary cannot resume another attempt');
 onPeople=()=>actor='other';await assert.rejects(read('admin'));actor='admin';onPeople=()=>{};
 disk.set(cache,{...saved,input:{action:'settle',reason:{unsafe:true}}});await assert.rejects(read('admin'));disk.delete(cache);assert.equal(await read('admin'),undefined);
 console.log('PASS read-only pending details, exact saved amount/reference/party, completed/rejected/offline states, unchanged key/cache, stale-key and owner-switch denial');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
