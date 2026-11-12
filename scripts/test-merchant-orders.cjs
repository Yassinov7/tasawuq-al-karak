// Offline tests exercise the production query builder and controller; no network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { load } = require('./syp-test-loader.cjs');
const calls = [];
const rpcCalls=[];let lookupId='12345678-1234-1234-1234-123456789012',lookupError=null;
const queryClient = { rpc(name,args){rpcCalls.push({name,args});return {abortSignal:async signal=>({data:lookupId,error:lookupError})};}, from(table) {
  const call = {table, filters:[], order:[]}; calls.push(call);
  const q = {
    select(columns,options) {call.columns=columns;call.options=options;return q;},
    eq(key,value) {call.filters.push([key,value]);return q;},
    order(key,options) {call.order.push([key,options]);return q;},
    limit(value) {call.limit=value;return q;}, or(value) {call.cursor=value;return q;},
    abortSignal(signal) {call.signal=signal;return Promise.resolve({data:[],count:123,error:null});},
  }; return q;
}};
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/merchant-orders.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {
  exports:exportsObject, AbortController, Date, Number, Map, Set,
  require(name) {
    if(name==='@/lib/c3-orders')return {getC3Contexts:async()=>({})};
    if(name==='@/lib/supabase')return {supabase:queryClient};
    if(name==='@/lib/merchant-store')return {getMerchantStore:async()=>({id:'store-a'})};
    if(name==='@/lib/money')return load('src/lib/money.ts');
    throw Error(name);
  }
});
const m = exportsObject;
const plain = x => JSON.parse(JSON.stringify(x));
const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const row = (id,status='awaiting_review') => ({id,status,created_at:'2026-10-29T10:00:00Z',store_order_totals:{currency:'SYP',items_subtotal:7500},store_order_items:[]});
const counts = {all:45,awaiting_review:24,preparing:12,ready_for_pickup:3};
function harness(owner='owner-a') {
  let state,store='store-a', updateCalls=0;
  const api = {
    store:async()=>store,
    page:async(_store,_filter,cursor)=>cursor?[row('older')]:Array.from({length:20},(_,i)=>row(String(i))),
    counts:async()=>counts,
    update:async()=>{updateCalls++;},
  };
  const controller=m.createMerchantOrdersController(owner,s=>state=s,api);controller.activate();
  return {api,controller,get state(){return state;},get updateCalls(){return updateCalls;},setStore:value=>store=value};
}
let passed=0;
async function test(name,run) {await run();passed++;console.log('PASS '+name);}
(async()=>{
 await test('singleton SYP total and missing/invalid totals never become zero',()=>{
  assert.match(m.orderTotal(row('a').store_order_totals),/ل.س/);
  for(const value of [null,[],{currency:'USD',items_subtotal:7},{currency:'SYP',items_subtotal:NaN},{currency:'SYP',items_subtotal:-1},{currency:'SYP',items_subtotal:'7'}])assert.equal(m.orderTotal(value),null);
  assert.notEqual(m.orderTotal({currency:'SYP',items_subtotal:0}),null);
 });
 await test('server counts are exact, scoped, independent of pages',async()=>{
  const actual=await m.merchantOrdersApi.counts('store-a',new AbortController().signal);
  assert.equal(actual.all,123);assert.equal(calls.length,4);
  for(const call of calls){assert.equal(call.options.head,true);assert.equal(call.options.count,'exact');assert.deepEqual(plain(call.filters[0]),['store_id','store-a']);}
  assert.equal(calls[0].filters.length,1);assert.equal(calls[1].filters[1][1],'awaiting_review');
 });
 await test('stable keyset, server status filter, bounded page, all includes history',async()=>{
  calls.length=0;
  await m.merchantOrdersApi.page('store-a','preparing',row('abc'),new AbortController().signal);
  assert.equal(calls[0].limit,20);assert.deepEqual(plain(calls[0].order.map(x=>x[0])),['created_at','id']);
  assert.ok(calls[0].cursor.includes('id.lt.abc'));assert.ok(calls[0].filters.some(x=>x[0]==='status'&&x[1]==='preparing'));
  await m.merchantOrdersApi.page('store-a','all',null,new AbortController().signal);
  assert.ok(!calls[1].filters.some(x=>x[0]==='status'));
 });
 await test('pagination deduplicates and does not derive counts from loaded rows',async()=>{
  const h=harness();await h.controller.refresh();assert.equal(h.state.rows.length,20);assert.equal(h.state.counts.all,45);
  h.api.page=async()=>[row('19'),row('older')];await h.controller.more();assert.equal(h.state.rows.length,21);assert.equal(new Set(h.state.rows.map(x=>x.id)).size,21);
 });
 await test('late response from previous filter cannot replace newer filter',async()=>{
  const h=harness(),held=deferred();h.api.page=async(_s,f)=>f==='all'?held.promise:[row('new','preparing')];
  const old=h.controller.refresh();await new Promise(setImmediate);await h.controller.select('preparing');held.resolve([row('old')]);await old;
  assert.equal(h.state.filter,'preparing');assert.equal(h.state.rows[0].id,'new');
 });
 await test('changed store drops old rows before the replacement page arrives',async()=>{
  const h=harness();await h.controller.refresh();h.setStore('store-b');const held=deferred();h.api.page=()=>held.promise;
  const work=h.controller.refresh();await new Promise(setImmediate);assert.equal(h.state.rows.length,0);assert.equal(h.state.counts,null);assert.equal(h.state.storeId,'store-b');
  held.resolve([row('b')]);await work;assert.equal(h.state.rows[0].id,'b');
 });
 await test('blur/account replacement fences pending reads and aborts signal',async()=>{
  const a=harness(),held=deferred();let signal;a.api.page=async(_s,_f,_c,s)=>{signal=s;return held.promise;};
  const work=a.controller.refresh();await new Promise(setImmediate);a.controller.deactivate();assert.equal(signal.aborted,true);
  const b=harness('owner-b');b.setStore('store-b');await b.controller.refresh();held.resolve([row('leak')]);await work;
  assert.equal(b.state.storeId,'store-b');assert.ok(!a.state.rows.some(x=>x.id==='leak'));
 });
 await test('rapid repeated action invokes RPC once and lock survives refresh',async()=>{
  const h=harness();await h.controller.refresh();const held=deferred();let calls=0;h.api.update=async()=>{calls++;await held.promise;};
  const a=h.controller.action(h.state.rows[0],'preparing');const b=await h.controller.action(h.state.rows[0],'preparing');assert.equal(b,false);assert.equal(calls,1);assert.equal(h.state.busyIds.length,1);
  held.resolve();await a;assert.equal(h.state.busyIds.length,0);
 });
 await test('RPC success plus failed refresh is still successful and keeps old data',async()=>{
  const h=harness();await h.controller.refresh();h.api.page=async()=>{throw Error('private database detail');};
  assert.equal(await h.controller.action(h.state.rows[0],'preparing'),true);assert.match(h.state.notice,/بنجاح/);assert.equal(h.state.rows.length,20);assert.equal(h.state.rows[0].status,'preparing');assert.equal(await h.controller.action(row('0'),'preparing'),false);assert.ok(!h.state.notice.includes('private'));
 });
 await test('rejection validation, trimmed reason, errors and finally unlock',async()=>{
  const h=harness();await h.controller.refresh();assert.ok(m.rejectionError(' a '));assert.equal(m.rejectionError(' سبب '),'');
  assert.equal(await h.controller.action(h.state.rows[0],'rejected',' '),false);assert.equal(h.updateCalls,0);
  h.api.update=async(_id,_next,reason)=>{assert.equal(reason,'سبب');throw Error('secret');};
  assert.equal(await h.controller.action(h.state.rows[0],'rejected',' سبب '),false);assert.equal(h.state.busyIds.length,0);assert.ok(!h.state.notice.includes('secret'));
 });
 await test('count failure displays unknown counts and preserves loaded page',async()=>{
  const h=harness();h.api.counts=async()=>{throw Error('offline');};await h.controller.refresh();assert.equal(h.state.counts,null);assert.equal(h.state.rows.length,20);assert.ok(h.state.error);
 });
 await test('short server pages still continue when server count exceeds rows',async()=>{
  const h=harness();h.api.page=async()=>[row('one')];await h.controller.refresh();assert.equal(h.state.hasMore,true);
 });
 await test('independent order locks release safely when one action fails',async()=>{
  const h=harness();await h.controller.refresh();const first=deferred(),second=deferred();
  h.api.update=id=>id==='0'?first.promise:second.promise;
  const a=h.controller.action(h.state.rows[0],'preparing'),b=h.controller.action(h.state.rows[1],'preparing');
  assert.equal(h.state.busyIds.length,2);first.reject(Error('offline'));await a;assert.deepEqual(plain(h.state.busyIds),['1']);second.resolve();await b;assert.equal(h.state.busyIds.length,0);
 });
 await test('focus freshness reuses current data and refreshes stale data',async()=>{
  const h=harness();let reads=0;h.api.counts=async()=>{reads++;return counts;};await h.controller.focus();await h.controller.focus();assert.equal(reads,1);
  const original=Date.now;try {Date.now=()=>original()+31000;await h.controller.focus();assert.equal(reads,2);} finally {Date.now=original;}
 });
 await test('parallel refreshes coalesce and realtime during a read queues one refresh',async()=>{
  const h=harness(),held=deferred();let reads=0;h.api.page=async()=>{reads++;if(reads===1)return held.promise;return [row('current')];};
  const a=h.controller.refresh(),b=h.controller.refresh();await new Promise(setImmediate);assert.equal(reads,1);
  h.controller.realtime();h.controller.realtime();held.resolve([row('old')]);await Promise.all([a,b]);await new Promise(setImmediate);assert.equal(reads,2);assert.equal(h.state.rows[0].id,'current');
 });
 await test('failed next page preserves rows and explicit retry recovers',async()=>{
  const h=harness();await h.controller.refresh();h.api.page=async()=>{throw Error('offline');};await h.controller.more();assert.equal(h.state.rows.length,20);assert.equal(h.state.moreError,true);
  h.api.page=async()=>[row('retry')];h.controller.retryMore();await h.controller.more();assert.equal(h.state.rows.length,21);assert.equal(h.state.moreError,false);
 });
 await test('late write completion after blur/refocus cannot refresh another lifecycle',async()=>{
  const h=harness();await h.controller.refresh();const held=deferred();h.api.update=()=>held.promise;let reads=0;h.api.page=async()=>{reads++;return [row('refocused')];};
  const action=h.controller.action(h.state.rows[0],'preparing');h.controller.deactivate();h.controller.activate();held.resolve();await action;assert.equal(reads,0);assert.equal(h.state.busyIds.length,0);
 });
 await test('offer snapshots keep components, quantities and original/final values',()=>{
  const groups=load('src/lib/order-item-groups.ts');
  const item=(id,q,gift)=>({id,product_title_snapshot:gift?'هدية':'منتج',selling_unit_snapshot:'قطعة',quantity:q,unit_price_snapshot:gift?0:100,currency:'SYP',line_total:gift?0:200,offer_snapshot:{offer_id:'offer',title:'عرض مع هدية',offer_type:'buy_x_get_y',currency:'SYP',original_line_total:gift?0:300,final_line_total:gift?0:200}});
  const result=groups.groupOrderItems([item('p',2,false),item('g',1,true)]);assert.equal(result.length,1);assert.equal(result[0].items.length,2);assert.equal(result[0].items[0].quantity,2);assert.equal(result[0].items[1].quantity,1);assert.equal(result[0].finalTotal,200);assert.equal(result[0].originalTotal,300);
 });
 await test('exact readable search is normalized and always re-scoped to the store',async()=>{
  calls.length=0;rpcCalls.length=0;
  await m.merchantOrdersApi.page('store-a','preparing',null,new AbortController().signal,undefined,'sor-٠٠٠٠٠٠١');
  assert.equal(rpcCalls[0].name,'find_merchant_store_order');assert.equal(rpcCalls[0].args.search_value,'SOR-0000001');assert.equal(rpcCalls[0].args.target_store,'store-a');
  assert(calls[0].filters.some(([key,value])=>key==='store_id'&&value==='store-a'));
  assert(calls[0].filters.some(([key,value])=>key==='id'&&value===lookupId));
  assert(calls[0].filters.some(([key,value])=>key==='status'&&value==='preparing'));
  calls.length=0;lookupId=null;assert.equal((await m.merchantOrdersApi.page('store-a','all',null,new AbortController().signal,undefined,'ORD-0000001')).length,0);assert.equal(calls.length,0);
  lookupError={message:'private detail'};await assert.rejects(m.merchantOrdersApi.page('store-a','all',null,new AbortController().signal,undefined,'123'));
  lookupError=null;lookupId='12345678-1234-1234-1234-123456789012';
  assert.equal(m.normalizeOrderSearch(' #۱۲۳ '),'123');assert(m.orderSearchError('SOR-1'));assert(m.orderSearchError('x),or(id.eq.anything'));
 });
 await test('search and status are independent; global counts are never the match count',async()=>{
  const h=harness(),queries=[];h.api.page=async(_s,f,_c,_signal,_target,search)=>{queries.push({f,search});return [row(search||'all',f==='preparing'?'preparing':'awaiting_review')];};
  await h.controller.search('sor-٠٠٠٠٠٠١');assert.equal(h.state.search,'SOR-0000001');assert.equal(h.state.hasMore,false);assert.equal(h.state.counts.all,45);
  await h.controller.select('preparing');assert.equal(queries.at(-1).search,'SOR-0000001');assert.equal(queries.at(-1).f,'preparing');
  await h.controller.search('');assert.equal(h.state.search,'');
 });
 await test('late search cannot replace a newer search and blur cancels it',async()=>{
  const h=harness(),held=deferred();h.api.page=async(_s,_f,_c,_signal,_target,search)=>search==='1'?held.promise:[row('new')];
  const old=h.controller.search('1');await new Promise(setImmediate);await h.controller.search('2');held.resolve([row('old')]);await old;
  assert.equal(h.state.search,'2');assert.equal(h.state.rows[0].id,'new');
 });
 await test('refresh revalidates later loaded pages without collapsing the list',async()=>{
  const h=harness(),rows=Array.from({length:45},(_,i)=>row(String(i)));
  h.api.page=async(_s,_f,cursor)=>{const start=cursor?Number(cursor.id)+1:0;return rows.slice(start,start+20);};
  await h.controller.refresh();await h.controller.more();assert.equal(h.state.rows.length,40);
  await h.controller.refresh();assert.equal(h.state.rows.length,40);await h.controller.more();assert.equal(h.state.rows.length,45);
 });
 await test('background cancels even direct search/pagination reads and resume recovers',async()=>{
  const h=harness(),held=deferred();let signal;h.api.page=async(_s,_f,_c,s)=>{signal=s;return held.promise;};
  const old=h.controller.search('1');await new Promise(setImmediate);h.controller.suspend();assert.equal(signal.aborted,true);
  held.resolve([row('old')]);await old;assert.equal(h.state.rows.length,0);
  h.controller.resume();h.api.page=async()=>[row('fresh')];await h.controller.refresh();assert.equal(h.state.rows[0].id,'fresh');assert.equal(h.state.search,'1');
 });
 await test('migration search contract is read-only and checks role plus store ownership',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261120000100_merchant_order_reference_search.sql','utf8');
  assert(sql.includes("p.role='merchant'"));assert(sql.includes('m.owner_user_id=auth.uid()'));assert(sql.includes('so.store_id=target_store'));
  assert(sql.includes("set search_path=''"));assert(sql.includes('from public,anon'));assert(!/^\s*(insert|update|delete|drop|alter)\b/im.test(sql));
 });
 console.log(`${passed} merchant orders tests passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
