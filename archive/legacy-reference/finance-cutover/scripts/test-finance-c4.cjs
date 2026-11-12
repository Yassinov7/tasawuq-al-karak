// Offline production contract/client + SQL source checks; NOT PostgreSQL proof.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {load}=require('./financial-test-loader.cjs');
const contract=load('src/lib/finance-c2-contract.ts'),input=load('src/lib/financial-input.ts');
const money=load('src/lib/money.ts');
const decimal=fs.readFileSync('supabase/migrations/20261107000100_finance_c4_decimal_contract.sql','utf8');
const sql=fs.readFileSync('supabase/migrations/20261107000200_c4_store_pickups_review_gate.sql','utf8');
let tests=0;async function test(name,work){await work();tests++;console.log('PASS '+name);}
function setup(options={}){
 let identity='driver',confirmed=[],writes=0,held=false,release;
 const calls=[];
 const api={auth:{getUser:async()=>({data:{user:{id:identity}},error:null})},async rpc(name,args){
  calls.push({name,args});
  if(args.expected_user!==identity)return{data:null,error:{code:'42501',message:'identity changed'}};
  if(name==='get_c4_pickup_context'){
   if(options.missing)return{data:null,error:{code:'PGRST202',message:'not deployed'}};
   if(options.undefinedFunction)return{data:null,error:{code:'42883',message:'internal function missing'}};
   if(options.readFailure)return{data:null,error:{message:'network'}};
   const value={task:{mode:'c4',can_confirm_pickup:options.disabled!==true,can_complete_delivery:false,pricing_version:1,reason:null,confirmed:[...confirmed]}};
   if(options.switchUser)identity='other';
   return{data:value,error:null};
  }
  writes++;if(held)await new Promise(resolve=>release=resolve);
  if(options.noCommit)return{data:null,error:{message:'lost before execution'}};
  if(!confirmed.includes(args.target_store_order))confirmed.push(args.target_store_order);
  return{data:options.loss?null:{state:'confirmed'},error:options.loss?{message:'lost after commit'}:null};
 }};
 return{client:load('src/lib/store-pickups.ts',{'@/lib/supabase':{supabase:api}}),calls,
  writes:()=>writes,seed:id=>confirmed.push(id),hold:()=>held=true,release:()=>{held=false;release();}};
}
async function main(){
 await test('major SYP strings retain 100, 100.50, 0.01 and twenty major digits',()=>{
  for(const value of ['100','100.50','0.01','99999999999999999999.99'])assert.equal(contract.sypAmount(value),value);
  for(const value of ['100.501','0.001','-1','NaN','Infinity','1e3','100000000000000000000',' 1','01'])assert.throws(()=>contract.sypAmount(value));
 });
 await test('office validation accepts integer/fraction, rejects zero/negative/invalid without coercion',()=>{
  for(const [text,value] of [['100',100],['100.50',100.5],['0.01',0.01],['١٠٠٫٥٠',100.5],['100,50',100.5]])assert.equal(input.positiveSypAmount(text),value);
  for(const text of ['0','0.00','-1','NaN','1e2','100.501','1,000','text',''])assert.throws(()=>input.positiveSypAmount(text));
  const page=fs.readFileSync('src/app/admin/driver-custody-details.tsx','utf8');
  assert(page.includes('positiveSypAmount(amount)'));assert(!page.includes('Math.round(numericAmount * 100) !== numericAmount'));
 });
 await test('display hides .00 but retains fractional money; helper performs no scale conversion',()=>{
  const expected=n=>new Intl.NumberFormat('ar-SY',{maximumFractionDigits:2}).format(n)+' ل.س';
  for(const n of [100,100.5,0.01])assert.equal(money.formatSyp(n),expected(n));
 });
 await test('decimal amendment preserves stored values and exact numeric balance/reversal functions',()=>{
  assert.match(decimal,/amount=round\(amount,2\)/);assert.match(decimal,/validate constraint/);
  assert.doesNotMatch(decimal,/alter column amount type|update public.journal|create or replace function|post_journal\(/i);
  assert.match(decimal,/sum\(l.amount\) filter\(where l.side='debit'\)/);
  assert.match(decimal,/sum\(l.amount\) filter\(where l.side='credit'\)/);
  assert.match(decimal,/matches<>1/);
 });
 await test('separate store receipts recover independently and never mass-pickup from client',async()=>{
  const t=setup();assert.equal(await t.client.confirmStorePickup('task','store-a','driver'),'confirmed');
  const first=(await t.client.getPickupWorkflows(['task'],'driver')).task;assert.equal(first.confirmed.length,1);
  assert.equal(await t.client.confirmStorePickup('task','store-b','driver'),'confirmed');
  assert.equal((await t.client.getPickupWorkflows(['task'],'driver')).task.confirmed.length,2);
  assert.equal(t.writes(),2);assert(!t.calls.some(call=>call.name==='update_delivery_task_status'));
 });
 await test('lost success response is read-recovered without duplicate pickup',async()=>{
  const t=setup({loss:true});assert.equal(await t.client.confirmStorePickup('task','store-a','driver'),'confirmed');
  assert.equal(await t.client.confirmStorePickup('task','store-a','driver'),'confirmed');assert.equal(t.writes(),1);
 });
 await test('lost pre-execution response is UNKNOWN, never automatic resend or collection success',async()=>{
  const t=setup({noCommit:true});assert.equal(await t.client.confirmStorePickup('task','store-a','driver'),'unknown');assert.equal(t.writes(),1);
 });
 await test('restart-style read restores natural task/store receipt, with no new write',async()=>{
  const t=setup();t.seed('store-a');assert.equal(await t.client.confirmStorePickup('task','store-a','driver'),'confirmed');assert.equal(t.writes(),0);
 });
 await test('double tap is locked before first await and releases safely',async()=>{
  const t=setup();t.hold();const first=t.client.confirmStorePickup('task','store-a','driver');
  await new Promise(resolve=>setImmediate(resolve));await assert.rejects(t.client.confirmStorePickup('task','store-a','driver'));
  t.release();assert.equal(await first,'confirmed');assert.equal(t.writes(),1);
 });
 await test('foreign account and session switch cannot return pickup result',async()=>{
  await assert.rejects(setup().client.getPickupWorkflows(['task'],'other'));
  await assert.rejects(setup({switchUser:true}).client.getPickupWorkflows(['task'],'driver'));
 });
 await test('missing C4 RPC preserves C3; transport failure cannot silently enable old path',async()=>{
  assert.equal((await setup({missing:true}).client.getPickupWorkflows(['task'],'driver')).task.state,'legacy');
  await assert.rejects(setup({readFailure:true}).client.getPickupWorkflows(['task'],'driver'));
 });
 await test('explicit server capabilities are preserved; disabled pickup and 42883 fail closed',async()=>{
  const t=setup().client;
  const row=t.decodePickupWorkflow({mode:'c4',can_confirm_pickup:false,can_complete_delivery:true,pricing_version:2,reason:null,confirmed:['a']});
  assert.equal(row.canConfirmPickup,false);assert.equal(row.canCompleteDelivery,true);assert.equal(row.pricingVersion,2);
  assert.equal(t.decodePickupWorkflow({mode:'legacy'}).state,'legacy');
  assert.throws(()=>t.decodePickupWorkflow({mode:'c4',confirmed:[]}));
  await assert.rejects(setup({disabled:true}).client.confirmStorePickup('task','a','driver'));
  await assert.rejects(setup({undefinedFunction:true}).client.getPickupWorkflows(['task'],'driver'));
 });
 await test('SQL receipt ownership, parent links, duplicate guard and all-pickups gate are explicit',()=>{
  assert.match(sql,/primary key\(task_id,store_order_id\), unique\(store_order_id\)/);
  assert.match(sql,/new\.driver_id:=auth.uid\(\)/);assert.match(sql,/new\.picked_up_at:=clock_timestamp\(\)/);
  assert.match(sql,/s.customer_order_id=parent_value/);assert.match(sql,/kind='ORD'/);assert.match(sql,/kind='SUB'/);assert.match(sql,/kind='DLV'/);
  assert.match(sql,/p.task_id=target_task and p.store_order_id=s.id and p.driver_id=expected_user/);assert.match(sql,/errcode='23505'/);
  assert(sql.indexOf('for update')<sql.indexOf('perform finance_private.c3_legacy_update_delivery_task_status'));
 });
 await test('immutable birth-time selector, default-off admission and no reassignment after pickup',()=>{
  assert.match(sql,/accept_new_orders boolean not null default false/);
  assert.match(sql,/birth_xid=txid_current\(\)/);assert.match(sql,/where singleton for share/);
  assert.match(sql,/c4_select_order_mode after insert on public.order_pricing_snapshots/);
  assert.match(sql,/c4_mode_immutable/);assert.match(sql,/C4_USE_SCOPED_PICKUP_OR_ATOMIC_COLLECTION/);
  const pickup=sql.slice(sql.indexOf('create function public.confirm_c4_store_pickup'),sql.indexOf('create function public.get_c4_pickup_context'));
  assert.doesNotMatch(pickup,/accept_new_orders|c4_rollout/);
  assert.match(sql,/C4 reassignment after first pickup is prohibited/);
  for(const declaration of sql.matchAll(/security definer([\s\S]*?)as \$\$/gi))assert.match(declaration[1],/search_path=''/);
 });
 await test('cash contract uses authoritative current price, economic uniqueness, two balanced journals and legacy fences',()=>{
  const cash=fs.readFileSync('supabase/migrations/20261107000300_c4_atomic_delivery_collection.sql','utf8');
  assert.match(cash,/task_id uuid primary key/);assert.match(cash,/customer_order_id uuid not null unique/);
  assert.match(cash,/price.version<>expected_pricing_version/);assert.match(cash,/if price.review_required/);
  assert.match(cash,/'driver_cash',expected_user/);assert.match(cash,/'customer_advance',customer_value/);
  assert.match(cash,/'merchant_sales_payable'/);assert.match(cash,/'full_cash_collected'/);
  assert.match(cash,/'delivery_completed'/);assert.equal((cash.match(/:=finance_private.post_journal/g)||[]).length,2);
  assert.match(cash,/set constraints all immediate/);assert.match(cash,/C4_LEGACY_FINANCIAL_WRITE_PROHIBITED/);
  assert.doesNotMatch(cash,/driver_earnings|disable trigger|approved_total|proposed_total/);
  for(const declaration of cash.matchAll(/security definer([\s\S]*?)as \$\$/gi))assert.match(declaration[1],/search_path=''/);
 });
 await test('zero branch is auditable without financial events/accounts/journals; positive branch is retained',()=>{
  const cash=fs.readFileSync('supabase/migrations/20261107000300_c4_atomic_delivery_collection.sql','utf8');
  const positive=cash.slice(cash.indexOf('  if price.total>0 then'),cash.indexOf('  end if; -- zero delivery'));
  assert.equal((positive.match(/:=finance_private.post_journal/g)||[]).length,2);
  const outside=cash.slice(cash.indexOf('create function public.complete_delivery_and_collect_cash')).replace(positive,'');
  assert.doesNotMatch(outside,/finance_private\.(post_journal|record_financial_event|c4_account)\(/);
  assert.match(cash,/zero_cash_economic_conflict/);assert.match(cash,/c.commission_amount<>0/);assert.match(cash,/t.items_subtotal<>0/);
  assert.match(cash,/kind='zero_cash_delivery' and amount=0 and cash_event_id is null and delivery_event_id is null/);
  assert.match(cash,/delivery_lifecycle_event_id uuid not null unique/);
  assert.match(cash,/if price.total>0 then\s+perform finance_private.append_lifecycle_event[\s\S]*?'full_cash_collected'/);
  assert.doesNotMatch(sql,/zero_total_requires_policy|C4_ZERO_TOTAL_REQUIRES_POLICY|and total_value>0/);
  const page=fs.readFileSync('src/app/driver/orders.tsx','utf8');assert.match(page,/تأكيد التسليم — لا يوجد مبلغ للتحصيل/);
 });
 await test('alternative delivery writers require the same committed result, with explicitly deferred guards',()=>{
  const cash=fs.readFileSync('supabase/migrations/20261107000300_c4_atomic_delivery_collection.sql','utf8');
  assert.match(cash,/create constraint trigger c4_task_atomic_result/);assert.match(cash,/create constraint trigger c4_child_atomic_result/);
  assert.match(cash,/C4 task requires all store receipts/);
  const defer=cash.indexOf('set constraints public.c4_task_atomic_result,public.c4_child_atomic_result deferred;');
  const transition=cash.indexOf("perform finance_private.c3_legacy_update_delivery_task_status(parent_value,'delivered')");
  assert(defer>0&&defer<transition);assert.match(cash,/r.amount=p.total and r.pricing_version=p.version/);
 });
 await test('PostgreSQL harness requires explicit opt-in and observed blocking, not serialized fake concurrency',()=>{
  const harness=fs.readFileSync('scripts/test-finance-c4-postgres.cjs','utf8');
  assert(harness.indexOf('C4_ALLOW_DISPOSABLE_TEST')<harness.indexOf('createPsql(config)'));
  assert.match(harness,/await preflight/);assert.match(harness,/await overlap\(config,sql,sameKeyCash,sameKeyCash\)/);
  assert.match(harness,/overlap\(config,sql,collect\(key\),collect\(randomUUID/);
  assert.match(harness,/store pickup already confirmed/);assert.match(harness,/assigned driver required/);
  const session=fs.readFileSync('scripts/finance-c3-test-session.cjs','utf8');assert.match(session,/pg_blocking_pids/);
 });
 await test('UI uses per-store controls/progress, realtime store updates, neutral financial component',()=>{
  const card=fs.readFileSync('src/components/driver/StorePickupPanel.tsx','utf8');
  const page=fs.readFileSync('src/app/driver/orders.tsx','utf8');
  assert.match(card,/تم استلام \{done\} من \{required.length\}/);assert.match(card,/تأكيد الاستلام/);
  assert.match(page,/table: "store_orders"/);assert.match(page,/تأكيد التسليم وقبض المبلغ كاملًا/);
  assert.match(page,/confirmStorePickup\(task.id, storeOrderId, expectedUser\)/);
  const amount=fs.readFileSync('src/components/ui/FinancialAmount.tsx','utf8');assert.doesNotMatch(amount,/supabase|tasawuq|karak/i);
 });
 await test('SQL suite has isolation guards and post-deferred assertions; execution is separate',()=>{
  const tests=fs.readFileSync('supabase/tests/finance_c4_decimal_pickups.sql','utf8');
  assert.match(tests,/set constraints all immediate/);assert.match(tests,/0\.001/);assert.match(tests,/100\.50/);
  assert.match(tests,/journal_count/);
  assert.match(tests,/_c2_test/);assert.match(tests,/c2_test_guard.environment/);
 });
 console.log(`${tests} offline C4 checks passed. Actual PostgreSQL/JWT/concurrency NOT RUN.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
