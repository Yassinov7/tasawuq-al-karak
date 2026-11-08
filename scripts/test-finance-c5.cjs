// Offline tests of real C5 TypeScript paths + source contracts. NOT PostgreSQL/JWT proof.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {load}=require('./financial-test-loader.cjs');
const ids={driver:'11111111-1111-4111-8111-111111111111',admin:'22222222-2222-4222-8222-222222222222',other:'33333333-3333-4333-8333-333333333333',request:'44444444-4444-4444-8444-444444444444'};
function document(){return{position:{collected:'13300.50',confirmed:'10.50',remaining:'13290.00',reserved:'20.00',available:'13270.00',pending_count:2,ledger_requires_review:false},requests:[{id:ids.request,amount:'10.50',requested_at:'2026-11-08T10:00:00Z',needs_review:false,last_counted:null}],history:[{id:ids.request,amount:'13300.50',at:'2026-11-08T10:00:00Z',kind:'cash_delivery',reference:'DLV-000001'}],has_more:false,can_request:true,can_confirm:false};}
function setup(options={}){
 let actor=options.admin?ids.admin:ids.driver,counter=0,sends=0,effects=0,hold=false,release;
 const calls=[],disk=new Map(),results=new Map();
 const api={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},async rpc(name,args){
  calls.push({name,args});
  if(name==='get_c5_driver_custody')return{data:document(),error:options.readError?{message:'missing migration'}:options.scopeDenied?{message:'denied',code:'42501'}:null};
  if(name==='list_c5_cash_requests')return{data:{rows:document().requests.map(r=>({...r,driver_id:ids.driver,full_name:'synthetic'})),has_more:false,can_confirm:true},error:null};
  if(name==='recover_c5_cash_handover'){if(options.recoveryError)throw Error('offline');return{data:results.get(args.attempt_key)??{state:'unknown'},error:null};}
  sends++;if(hold)await new Promise(r=>release=r);
  if(options.switchUser)actor=ids.other;
  if(options.denied||options.noCommit)return{data:null,error:{message:'unavailable'}};
  let result=results.get(args.attempt_key);
  if(!result){effects++;result=options.rejected?{state:'rejected',code:'insufficient_available'}:name==='request_c5_cash_handover'
    ?{state:'completed',kind:'request',request_id:ids.request,amount:args.requested_amount}
    :options.mismatch?{state:'completed',kind:'discrepancy',request_id:args.target_request,counted:args.counted_amount}
    :{state:'completed',kind:'confirmed',request_id:args.target_request,amount:args.counted_amount,reference:'RCT-1000000'};
   results.set(args.attempt_key,result);}
  if(options.loss)return{data:null,error:{message:'lost after commit'}};
  return{data:result,error:null};
 }};
 const cache={readLocalCache:async key=>{if(options.readCacheFailure)throw Error('disk');return disk.get(key);},writeLocalCache:async(key,value)=>{if(options.writeCacheFailure)throw Error('disk');disk.set(key,value);},invalidateLocalCache:async key=>{if(options.clearFailure)throw Error('disk');disk.delete(key);}};
 const mocks={'@/lib/supabase':{supabase:api},'@/lib/local-cache':cache,'@/lib/driver-cash':{newIdempotencyKey:()=>`55555555-5555-4555-8555-${String(++counter).padStart(12,'0')}`}};
 const client=()=>load('src/lib/driver-custody-c5.ts',mocks);
 return{client:client(),restart:client,calls,disk,sends:()=>sends,effects:()=>effects,hold:()=>hold=true,release:()=>{hold=false;release();}};
}
const request=(amount='10.50')=>({kind:'request',driverId:ids.driver,amount});
const confirm=(amount='10.50')=>({kind:'confirm',driverId:ids.driver,requestId:ids.request,amount});
let count=0;async function test(name,fn){await fn();count++;console.log('PASS '+name);}
(async()=>{
 await test('exact SYP input normalization retains cents, rejects excessive precision/nonfinite/negative/zero request',()=>{
  const c=setup().client;for(const [a,b] of [['100','100.00'],['10.50','10.50'],['١٠٫٥٠','10.50'],['10,50','10.50']])assert.equal(c.handoverAmount(a),b);
  for(const a of ['0','-1','0.001','NaN','Infinity','1e3','100000000000000000000'])assert.throws(()=>c.handoverAmount(a));
  assert.equal(c.handoverAmount('0',true),'0.00');assert.equal(c.handoverAmount('99999999999999999999.99'),'99999999999999999999.99');
 });
 await test('transport timeout is unknown and a late response cannot turn it into a false success',async()=>{
  const c=setup().client;let finish,calls=0;
  const transport=c.createC5Transport({rpc:()=>{calls++;return new Promise(r=>finish=r);}},2);
  const r=await transport('request_c5_cash_handover',{});assert(r.error);assert.equal(r.data,null);
  finish({data:{state:'completed'},error:null});await new Promise(r=>setImmediate(r));assert(r.error);assert.equal(calls,1);
 });
 await test('server scale zeros normalize exactly; significant precision is rejected; large sums stay strings',()=>{
  const c=setup().client;assert.equal(c.custodyDecimal('10.5000'),'10.5');assert.throws(()=>c.custodyDecimal('10.5010'));
  const d=document();d.position.remaining='9007199254740993.50';assert.equal(c.decodeCustody(d).position.remaining,'9007199254740993.5');
 });
 await test('exact FinancialAmount string formatter preserves values above Number safe integer',()=>{
  const m=load('src/lib/money.ts'),n='9007199254740993';
  assert(m.formatSypExact(n+'.50').includes(new Intl.NumberFormat('ar-SY').format(BigInt(n))));
  assert.throws(()=>m.formatSypExact('1.234'));assert.equal(m.formatSypExact('100'),m.formatSyp(100));
 });
 await test('read DTO rejects missing money/list/capabilities rather than defaulting to zero',()=>{
  const c=setup().client;for(const key of ['collected','remaining','reserved','available']){const d=document();delete d.position[key];assert.throws(()=>c.decodeCustody(d));}
  const d=document();delete d.requests;assert.throws(()=>c.decodeCustody(d));
 });
 await test('scoped read and queue send current actor and server paging; missing RPC is an error',async()=>{
  const t=setup();await t.client.getC5Custody(ids.driver,ids.driver,2);assert.equal(t.calls[0].args.page_number,2);assert.equal(t.calls[0].args.expected_user,ids.driver);
  await assert.rejects(setup({readError:true}).client.getC5Custody(ids.driver,ids.driver));
  await assert.rejects(setup({scopeDenied:true}).client.getC5Custody(ids.driver,ids.driver),e=>e.scopeDenied===true);
  const a=setup({admin:true});assert.equal((await a.client.getC5Queue(ids.admin,'review')).rows[0].driver_id,ids.driver);
 });
 await test('late reads cannot restore financial data after a newer permission denial',async()=>{
  const client=setup().client;
  const {createCustodyReader}=load('src/hooks/useCustodyRead.ts',{'react':{},'expo-router':{},'@/lib/driver-custody-c5':client});
  let next,seen=[];const pending=[];
  const reader=createCustodyReader('owned',()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),s=>{next=s;seen.push(s);});
  reader.activate();const initial=reader.load();await new Promise(r=>setImmediate(r));pending.shift().resolve('authorized');await initial;assert.equal(next.data,'authorized');
  const stale=reader.load();await new Promise(r=>setImmediate(r));const old=pending.shift();
  const revoked=reader.load();await new Promise(r=>setImmediate(r));pending.shift().reject(new client.C5ScopeError('denied'));await revoked;assert.equal(next.data,null);
  old.resolve('late secret');await stale;assert.equal(next.data,null);
  const renewed=reader.load();await new Promise(r=>setImmediate(r));assert.equal(next.data,null);pending.shift().resolve('new authorized');await renewed;assert.equal(next.data,'new authorized');reader.deactivate();
 });
 await test('request has frozen exact amount and does not call old cash/remittance services',async()=>{
  const t=setup(),r=await t.client.runC5Handover(ids.driver,ids.driver,request());assert.equal(r.kind,'request');assert.equal(t.effects(),1);
  const send=t.calls.find(c=>c.name==='request_c5_cash_handover');assert.equal(send.args.requested_amount,'10.50');assert.equal(send.args.expected_user,ids.driver);
  assert(!t.calls.some(c=>/record_driver_cash_remittance|pay_driver_cash_credit/.test(c.name)));
 });
 await test('lost request response recovers, including restart after failed cache cleanup, without new economic write',async()=>{
  const t=setup({loss:true,clearFailure:true});assert.equal((await t.client.runC5Handover(ids.driver,ids.driver,request())).kind,'request');
  assert.equal((await t.restart().runC5Handover(ids.driver,ids.driver,undefined,true)).kind,'request');assert.equal(t.sends(),1);assert.equal(t.effects(),1);
 });
 await test('unknown retry freezes key/input across restart; changed input cannot fork another request',async()=>{
  const t=setup({noCommit:true});assert.equal((await t.client.runC5Handover(ids.driver,ids.driver,request())).state,'unknown');
  await assert.rejects(t.restart().runC5Handover(ids.driver,ids.driver,request('11')));assert.equal(t.sends(),1);
  await t.restart().runC5Handover(ids.driver,ids.driver);const sends=t.calls.filter(c=>c.name==='request_c5_cash_handover');
  assert.equal(sends[0].args.attempt_key,sends[1].args.attempt_key);assert.equal(sends[1].args.requested_amount,'10.50');
 });
 await test('office confirmation freezes actual count, request and driver; RCT expands beyond six digits',async()=>{
  const t=setup({admin:true}),r=await t.client.runC5Handover(ids.admin,ids.driver,confirm());assert.equal(r.reference,'RCT-1000000');
  const args=t.calls.find(c=>c.name==='confirm_c5_cash_handover').args;assert.equal(args.counted_amount,'10.50');assert.equal(args.target_request,ids.request);assert.equal(args.target_driver,ids.driver);assert.equal(args.expected_user,ids.admin);
 });
 await test('count discrepancy is an explicit terminal outcome, never confirmed cash',async()=>{
  const t=setup({admin:true,mismatch:true}),r=await t.client.runC5Handover(ids.admin,ids.driver,confirm('7.25'));assert.equal(r.kind,'discrepancy');assert.equal(r.reference,undefined);assert.equal(t.disk.size,1);
 });
 await test('lost office response and recovery cannot repost confirmation',async()=>{
  const t=setup({admin:true,loss:true,clearFailure:true});assert.equal((await t.client.runC5Handover(ids.admin,ids.driver,confirm())).kind,'confirmed');
  assert.equal((await t.restart().runC5Handover(ids.admin,ids.driver,undefined,true)).kind,'confirmed');assert.equal(t.sends(),1);
 });
 await test('denied office RPC cannot become success or clear the ambiguous key',async()=>{
  const t=setup({admin:true,denied:true});assert.equal((await t.client.runC5Handover(ids.admin,ids.driver,confirm())).state,'unknown');assert.equal(t.disk.size,1);
 });
 await test('double tap is locked before first await',async()=>{
  const t=setup();t.hold();const first=t.client.runC5Handover(ids.driver,ids.driver,request());await new Promise(r=>setImmediate(r));
  await assert.rejects(t.client.runC5Handover(ids.driver,ids.driver,request()));t.release();await first;assert.equal(t.sends(),1);
 });
 await test('account switch, foreign page and cache I/O failure prevent results/writes in wrong scope',async()=>{
  const t=setup({switchUser:true});await assert.rejects(t.client.runC5Handover(ids.driver,ids.driver,request()));
  await assert.rejects(setup().client.runC5Handover(ids.driver,ids.other,{...request(),driverId:ids.other}));
  for(const key of ['readCacheFailure','writeCacheFailure']){const v=setup({[key]:true});await assert.rejects(v.client.runC5Handover(ids.driver,ids.driver,request()));assert.equal(v.sends(),0);}
 });
 await test('terminal rejection stays recoverable; unconfirmed recovery failure does not resend',async()=>{
  const t=setup({rejected:true});assert.equal((await t.client.runC5Handover(ids.driver,ids.driver,request())).code,'insufficient_available');assert.equal(t.disk.size,1);
  const v=setup({loss:true,recoveryError:true});assert.equal((await v.client.runC5Handover(ids.driver,ids.driver,request())).state,'unknown');
  assert.equal((await v.restart().runC5Handover(ids.driver,ids.driver)).state,'unknown');assert.equal(v.sends(),1);
 });
 await test('terminal intent persists until deliberate finish; repeated successful click cannot create another reservation',async()=>{
  const t=setup();await t.client.runC5Handover(ids.driver,ids.driver,request());
  await t.client.runC5Handover(ids.driver,ids.driver,request());assert.equal(t.sends(),1);assert.equal(t.disk.size,1);
  await t.client.finishC5Handover(ids.driver,ids.driver);assert.equal(t.disk.size,0);
  await t.client.runC5Handover(ids.driver,ids.driver,request());assert.equal(t.sends(),2);
  const u=setup({noCommit:true});await u.client.runC5Handover(ids.driver,ids.driver,request());await assert.rejects(u.client.finishC5Handover(ids.driver,ids.driver));assert.equal(u.disk.size,1);
 });
 const sql=fs.readFileSync('supabase/migrations/20261108000100_finance_c5_driver_cash_handover.sql','utf8');
 await test('SQL uses immutable requests/decisions, all-pending reservations and ledger-derived balance',()=>{
  assert.match(sql,/accept_requests boolean not null default false/);assert.match(sql,/sum\(r.amount\)/);assert.match(sql,/greatest\(balance-reserved,0\)/);
  assert.match(sql,/for update/);assert.match(sql,/c5_one_confirmation/);assert.match(sql,/c5_request_immutable/);assert.match(sql,/c5_attempt_immutable/);
  assert.doesNotMatch(sql,/update public\.(financial_accounts|journal_lines)|balance numeric not null|disable trigger/i);
 });
 await test('only approved driver requests; admin role PLUS explicit receiver permission confirms',()=>{
  assert.match(sql,/coalesce\(public.is_admin\(\),false\) and exists/);assert.match(sql,/c5_cash_receivers where user_id=auth.uid\(\) and enabled/);
  assert.match(sql,/expected_user is distinct from auth.uid\(\)/);assert.match(sql,/driver_value is distinct from target_driver/);
  for(const d of sql.matchAll(/security definer([\s\S]*?)as \$\$/gi))assert.match(d[1],/search_path=''/);
  assert.match(sql,/revoke all on all functions in schema finance_private/);assert.match(sql,/for select to authenticated using\(public.is_admin\(\) or driver_id=auth.uid\(\)\)/);
 });
 await test('cash confirmation alone posts exact Dr treasury / Cr driver with deferred receipt checks',()=>{
  const requestSql=sql.slice(sql.indexOf('create function public.request_c5_cash_handover'),sql.indexOf('create function public.confirm_c5_cash_handover'));
  assert.doesNotMatch(requestSql,/post_journal|record_financial_event|c5_register_receipt/);
  assert.match(sql,/counted_amount<>req.amount/);assert.match(sql,/'discrepancy'/);
  assert.match(sql,/'account_id',treasury,'side','debit','amount',req.amount/);assert.match(sql,/'account_id',driver_account,'side','credit','amount',req.amount/);
  assert.match(sql,/set constraints public.c5_confirmed_receipt deferred/);assert.match(sql,/confirmed handover needs its posted receipt/);
  assert.match(sql,/set constraints all immediate/);
 });
 await test('RCT has its own FK/kind branch, immutable C2 numbering and source-event uniqueness preserved',()=>{
  assert.match(sql,/when 'RCT' then cash_handover_id=document_id/);assert.match(sql,/found_count<>2/);assert.match(sql,/finance_private.c5_register_receipt/);
  assert.doesNotMatch(sql,/create or replace function finance_private.next_reference|drop trigger|drop table/);
 });
 await test('zero C4 and legacy cannot fund C5; unsupported ledger movements block spending',()=>{
  const position=sql.slice(sql.indexOf('create function finance_private.c5_position'),sql.indexOf('create function public.request_c5_cash_handover'));
  assert.match(position,/r.kind='cash_delivery'/);assert.doesNotMatch(position,/driver_cash_remittances|driver_cash_custody_positions|delivery_fee_entitled/);
  assert.match(position,/balance<>collected-received/);assert.match(sql,/ledger_requires_review/);
  assert.doesNotMatch(sql,/insert into public\.(driver_cash_remittances|driver_cash_credit_payouts|customer_order_cash_obligations)/);
 });
 await test('UI reuses FinancialAmount, server capabilities, scoped reads and RLS-filtered realtime',()=>{
  const p=fs.readFileSync('src/components/driver/DriverCustodyPanel.tsx','utf8');assert.match(p,/FinancialAmount/);assert.match(p,/data.can_request/);assert.match(p,/data.can_confirm/);assert.match(p,/ledger_requires_review/);assert.match(p,/restoreC5Input/);assert.match(p,/scope===scope/);
  assert.match(p,/driver_cash_handover_attempts/);assert.match(p,/delivery_collection_results/);assert.match(p,/useCustodyRead/);
 });
 await test('isolated harness has opt-ins/identity/real blocking and SQL covers deferred failures and zero C4',()=>{
  const h=fs.readFileSync('scripts/test-finance-c5-postgres.cjs','utf8'),s=fs.readFileSync('supabase/tests/finance_c5_driver_cash_handover.sql','utf8');
  assert(h.indexOf('C5_ALLOW_DISPOSABLE_TEST')<h.indexOf('createPsql(config)'));assert.match(h,/buildConfig/);assert.match(h,/await overlap\(config,sql,request\(a\),request\(b\)\)/);assert.match(h,/await overlap\(config,sql,confirm\(c\),confirm\(d\)\)/);
  assert.match(h,/finance_c4_zero_delivery.sql/);assert.match(s,/set constraints c5_test_deferred deferred/);assert.match(s,/injected C5 deferred failure/);assert.match(s,/set local role authenticated/);
 });
 console.log(`${count} offline C5 checks passed; actual PostgreSQL/JWT/concurrency NOT RUN.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
