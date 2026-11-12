// Actual TypeScript client paths with an in-memory transport; NOT a PostgreSQL test.
const assert=require('node:assert/strict');
const {load}=require('./financial-test-loader.cjs');
function setup(options={}){
 let actor='driver',key=0,writes=0,result,held,release;
 const disk=new Map(),calls=[];
 const api={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},async rpc(name,args){
  calls.push({name,args});
  if(name==='recover_delivery_collection'&&options.throwRecovery)throw Error('recovery transport');
  if(name==='recover_delivery_collection')return{data:result??{state:'unknown'},error:options.recoveryError?{message:'offline'}:null};
  writes++; if(held)await new Promise(resolve=>release=resolve);
  if(options.switchActor)actor='other';
  if(!options.noCommit)result=options.rejected?{state:'rejected',code:'pricing_changed'}:options.conflict?{state:'rejected',code:'zero_cash_economic_conflict'}:{state:'completed',task_id:'task',amount:options.zero?'0':'13300.50',kind:options.malformed?'cash_delivery':options.zero?'zero_cash_delivery':'cash_delivery'};
  if(options.throwTransport)throw Error('transport');
  return{data:result,error:options.loss?{message:'lost'}:null};
 }};
 const cache={readLocalCache:async k=>{if(options.readFailure)throw Error('disk read');return disk.get(k);},
  writeLocalCache:async(k,v)=>{if(options.writeFailure)throw Error('disk full');disk.set(k,v);},
  invalidateLocalCache:async k=>{if(options.removeFailure)throw Error('disk remove');disk.delete(k);}};
 const mocks={'@/lib/supabase':{supabase:api},'@/lib/local-cache':cache,
  '@/lib/request-key':{newIdempotencyKey:()=>`key-${++key}`},
  '@/lib/store-pickups':{getPickupWorkflows:async()=>({task:{state:'c4',canCompleteDelivery:!options.disabled,pricingVersion:7}})}};
 const client=()=>load('src/lib/delivery-collection-attempt.ts',mocks);
 return{client:client(),restart:client,writes:()=>writes,calls,disk,hold:()=>held=true,release:()=>{held=false;release();}};
}
let count=0;async function test(name,fn){await fn();count++;console.log('PASS '+name);}
(async()=>{
 await test('server decimal current amount returned, no caller amount sent',async()=>{
  const t=setup(),r=await t.client.deliveryCollection('driver','task',7);
  assert.equal(r.state,'completed');assert.equal(r.amount,13300.5);
  const args=t.calls.find(c=>c.name==='complete_delivery_and_collect_cash').args;
  assert.deepEqual(Object.keys(args).sort(),['attempt_key','expected_pricing_version','expected_user','target_task']);
 });
 await test('zero delivery decodes explicit server outcome and sends no amount selector',async()=>{
  const t=setup({zero:true}),r=await t.client.deliveryCollection('driver','task',7);
  assert.equal(r.state,'completed');assert.equal(r.kind,'zero_cash_delivery');assert.equal(r.amount,0);
  const args=t.calls.find(c=>c.name==='complete_delivery_and_collect_cash').args;
  assert.deepEqual(Object.keys(args).sort(),['attempt_key','expected_pricing_version','expected_user','target_task']);
 });
 await test('zero lost-response/restart recovery does not submit a second delivery',async()=>{
  const t=setup({zero:true,loss:true,removeFailure:true});
  assert.equal((await t.client.deliveryCollection('driver','task',7)).kind,'zero_cash_delivery');
  assert.equal((await t.restart().deliveryCollection('driver','task',7,true)).kind,'zero_cash_delivery');assert.equal(t.writes(),1);
 });
 await test('zero double tap has one submission and keeps account protections',async()=>{
  const t=setup({zero:true});t.hold();const first=t.client.deliveryCollection('driver','task',7);
  await new Promise(r=>setImmediate(r));await assert.rejects(t.client.deliveryCollection('driver','task',7));t.release();await first;assert.equal(t.writes(),1);
  await assert.rejects(setup({zero:true,switchActor:true}).client.deliveryCollection('driver','task',7));
 });
 await test('zero mislabeled as cash is not accepted; economic conflict is explicit rejection',async()=>{
  await assert.rejects(setup({zero:true,malformed:true}).client.deliveryCollection('driver','task',7));
  const t=setup({conflict:true}),r=await t.client.deliveryCollection('driver','task',7);
  assert.equal(r.state,'rejected');assert.equal(r.code,'zero_cash_economic_conflict');assert.equal(t.disk.size,0);
 });
 await test('lost committed response is recovered once',async()=>{
  const t=setup({loss:true});assert.equal((await t.client.deliveryCollection('driver','task',7)).state,'completed');assert.equal(t.writes(),1);assert.equal(t.disk.size,0);
 });
 await test('transport rejection after commit also recovers without resend',async()=>{
  const t=setup({throwTransport:true});assert.equal((await t.client.deliveryCollection('driver','task',7)).state,'completed');assert.equal(t.writes(),1);
 });
 await test('unknown survives restart and read-only recovery sends no cash write',async()=>{
  const t=setup({loss:true,noCommit:true});assert.equal((await t.client.deliveryCollection('driver','task',7)).state,'unknown');
  assert.equal((await t.restart().deliveryCollection('driver','task',8,true)).state,'unknown');assert.equal(t.writes(),1);
  await t.restart().deliveryCollection('driver','task',8);
  const sends=t.calls.filter(c=>c.name==='complete_delivery_and_collect_cash');assert.equal(sends.length,2);
  assert.equal(sends[0].args.attempt_key,sends[1].args.attempt_key);assert.equal(sends[1].args.expected_pricing_version,7);
 });
 await test('rejected result retires old intent; next deliberate action has new key',async()=>{
  const t=setup({rejected:true});assert.equal((await t.client.deliveryCollection('driver','task',7)).state,'rejected');assert.equal(t.disk.size,0);
  await t.client.deliveryCollection('driver','task',7);const sends=t.calls.filter(c=>c.name==='complete_delivery_and_collect_cash');assert.notEqual(sends[0].args.attempt_key,sends[1].args.attempt_key);
 });
 await test('read/write cache failure prevents collection',async()=>{
  for(const option of ['readFailure','writeFailure']){const t=setup({[option]:true});await assert.rejects(t.client.deliveryCollection('driver','task',7));assert.equal(t.writes(),0);}
 });
 await test('double tap locks synchronously',async()=>{
  const t=setup();t.hold();const first=t.client.deliveryCollection('driver','task',7);
  await new Promise(r=>setImmediate(r));await assert.rejects(t.client.deliveryCollection('driver','task',7));t.release();await first;assert.equal(t.writes(),1);
 });
 await test('account switch never exposes recovered result; other owner cannot use saved intent',async()=>{
  const t=setup({switchActor:true});await assert.rejects(t.client.deliveryCollection('driver','task',7));assert.equal(t.disk.size,1);
  await assert.rejects(t.client.deliveryCollection('driver','task',7,true));
 });
 await test('failed cleanup or recovery read never authorizes a duplicate write',async()=>{
  const t=setup({removeFailure:true});assert.equal((await t.client.deliveryCollection('driver','task',7)).state,'completed');
  assert.equal((await t.restart().deliveryCollection('driver','task',7)).state,'completed');assert.equal(t.writes(),1);
  const u=setup({loss:true,recoveryError:true});assert.equal((await u.client.deliveryCollection('driver','task',7)).state,'unknown');
  assert.equal((await u.restart().deliveryCollection('driver','task',7)).state,'unknown');assert.equal(u.writes(),1);
  const v=setup({loss:true,throwRecovery:true});assert.equal((await v.client.deliveryCollection('driver','task',7)).state,'unknown');assert.equal(v.writes(),1);
 });
 await test('capability/version mismatch prevents new collection',async()=>{
  const t=setup({disabled:true});assert.equal((await t.client.deliveryCollection('driver','task',7)).state,'rejected');assert.equal(t.writes(),0);
  const s=setup();assert.equal((await s.client.deliveryCollection('driver','task',8)).state,'rejected');assert.equal(s.writes(),0);
 });
 console.log(`${count} atomic client tests passed; SQL behavior NOT TESTED.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
