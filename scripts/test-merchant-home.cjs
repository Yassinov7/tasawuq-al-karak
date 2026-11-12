// Offline production-controller tests. No real account, network or database.
const assert = require('node:assert/strict');
const { load } = require('./syp-test-loader.cjs');
const fs = require('node:fs');
const path = require('node:path');
const now = Date.now();
const iso = offset => new Date(now + offset).toISOString();
const plain = value => JSON.parse(JSON.stringify(value));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function harness() {
  const rows = {
    merchants: [{ id: 'merchant-a', owner_user_id: 'owner-a', status: 'accepted' }, { id: 'merchant-b', owner_user_id: 'owner-b', status: 'accepted' }],
    stores: [{ id: 'store-a', merchant_id: 'merchant-a', name: 'Store A', status: 'accepted' }, { id: 'store-b', merchant_id: 'merchant-b', name: 'Store B', status: 'accepted' }],
    store_orders: ['awaiting_review','awaiting_review','preparing','ready_for_pickup','delivered','cancelled','rejected'].map(status => ({ store_id: 'store-a', status })).concat([{ store_id: 'store-b', status: 'awaiting_review' }]),
    products: [{ store_id: 'store-a', is_available: true }, { store_id: 'store-a', is_available: false }, { store_id: 'store-b', is_available: true }],
    store_offers: [
      { store_id:'store-a',is_active:true,starts_at:iso(-60000),ends_at:null },
      { store_id:'store-a',is_active:true,starts_at:iso(-60000),ends_at:iso(60000) },
      { store_id:'store-a',is_active:true,starts_at:iso(-60000),ends_at:iso(-1000) },
      { store_id:'store-a',is_active:true,starts_at:iso(60000),ends_at:null },
      { store_id:'store-a',is_active:false,starts_at:iso(-60000),ends_at:null },
      { store_id:'store-b',is_active:true,starts_at:iso(-60000),ends_at:null },
    ],
  };
  const calls = [];
  let failTable, missingCount = false, holdNextOrder = false, held;
  const client = { from(table) {
    assert(Object.hasOwn(rows,table), `Unexpected dashboard data source: ${table}`);
    const call = { table, filters: [], columns: '', options: {} }; calls.push(call);
    const result = () => {
      let matching = rows[table].filter(row => call.filters.every(([operator,key,value]) => {
        if(operator==='eq')return row[key]===value;
        if(operator==='lte')return row[key]<=value;
        if(operator==='or')return row.ends_at===null||row.ends_at>value.slice('ends_at.is.null,ends_at.gt.'.length);
        throw Error(operator);
      }));
      return { data: call.options.head ? null : matching, count: missingCount ? null : matching.length, error: failTable===table ? {message:'offline'} : null };
    };
    const query = {
      abortSignal() { return query; },
      select(columns,options={}) { call.columns=columns;call.options=options;return query; },
      eq(key,value) { call.filters.push(['eq',key,value]);return query; },
      lte(key,value) { call.filters.push(['lte',key,value]);return query; },
      or(value) { call.filters.push(['or','',value]);return query; },
      maybeSingle() { const response=result();return Promise.resolve({...response,data:response.data[0]??null}); },
      then(resolve,reject) {
        const response=result();
        if(table==='store_orders'&&holdNextOrder){holdNextOrder=false;held=deferred();return held.promise.then(()=>response).then(resolve,reject);}
        return Promise.resolve(response).then(resolve,reject);
      },
    };return query;
  } };
  let finance = async (search,page,owner,signal) => ({owner,admin:false,account_reference:'ACC-0000001',payable:'700.25',receivable:'100.50'});
  const module = load('src/lib/merchant-home.ts',{'@/lib/invoice-finance':{readMoney:(...args)=>finance(...args)},'@/lib/supabase':{supabase:client},'@/lib/operational-home':{readMerchantHomeStatus:async()=>({eligible:true,reason:'ready',recheckDelay:null})}});
  let state;const states=[];
  const controller=module.createMerchantHomeController('owner-a',value=>{state=value;states.push(value);});
  controller.activate();
  return {rows,calls,module,controller,states,setFinance(fn){finance=fn;},get state(){return state;},fail(table){failTable=table;},missing(value){missingCount=value;},hold(){held=undefined;holdNextOrder=true;},get held(){return held;}};
}
async function waitForHold(h){for(let i=0;i<100&&!h.held;i++)await new Promise(resolve=>setImmediate(resolve));assert(h.held,'Request did not reach controlled delay');}
async function run() {
  const h=harness();await h.controller.refresh();
  assert.deepEqual(plain(h.state.snapshot.counts),{awaitingReview:2,preparing:1,readyForPickup:1,products:2,activeOffers:2,availableProducts:1});
  assert.deepEqual(plain(h.module.merchantHomeActions(h.state)),{addProduct:true,addOffer:true});
  const counts=h.calls.filter(c=>c.options.head);
  assert.equal(counts.length,6);
  for(const call of counts){assert.deepEqual(plain(call.options),{count:'exact',head:true});assert.equal(call.columns,'id');assert(call.filters.some(([op,key,value])=>op==='eq'&&key==='store_id'&&value==='store-a'));}
  assert(h.calls[0].filters.some(([,key,value])=>key==='owner_user_id'&&value==='owner-a'));
  const before=h.calls.length;await h.controller.refresh();
  assert.equal(h.calls.length-before,2,'Fresh focus only revalidates merchant/store identity');
  const beforeInvalidation=h.calls.length;
  h.module.invalidateMerchantHome('owner-a');
  h.rows.products.push({store_id:'store-a',is_available:true});
  await h.controller.refresh();
  assert.equal(h.calls.length-beforeInvalidation,8,'Confirmed catalogue mutation invalidates fresh home counters');
  assert.equal(h.state.snapshot.counts.products,3);
  h.module.invalidateMerchantHome('owner-b');
  const beforeOtherOwner=h.calls.length;await h.controller.refresh();
  assert.equal(h.calls.length-beforeOtherOwner,2,'Another owner invalidation must not invalidate this home');
  const originalNow=Date.now;try{Date.now=()=>now+h.module.merchantHomeFreshnessMs+1000;const before=h.calls.length;await h.controller.refresh();assert.equal(h.calls.length-before,8,'Stale focus must refetch counts');}finally{Date.now=originalNow;}
  await h.controller.refresh(true);
  const snapshot=h.state.snapshot;h.fail('store_orders');await h.controller.refresh(true);
  assert(h.state.error);assert.equal(h.state.snapshot,snapshot,'Failed refresh retains confirmed counts');assert.equal(h.module.merchantHomeActions(h.state).addProduct,false);
  h.fail(undefined);await h.controller.refresh();assert.equal(h.state.error,false,'Returning after an error retries even with a recent snapshot');
  const initial=harness();initial.missing(true);await initial.controller.refresh();assert(initial.state.error);assert.equal(initial.state.snapshot,null,'Unavailable counts are not fabricated zeros');
  h.rows.products.forEach(row=>{row.is_available=false;});await h.controller.refresh(true);assert.equal(h.module.merchantHomeActions(h.state).addOffer,false);
  for(const target of ['stores','merchants']){h.rows[target][0].status='changes_requested';await h.controller.refresh();assert.equal(h.module.merchantHomeActions(h.state).addProduct,false);h.rows[target][0].status='accepted';}
  h.rows.store_orders=[];h.rows.products=[];await h.controller.refresh(true);assert.equal(h.state.snapshot.counts.products,0);assert.equal(h.state.snapshot.counts.awaitingReview,0);
  const otherStates=[];const other=h.module.createMerchantHomeController('owner-b',value=>otherStates.push(value));other.activate();await other.refresh();assert.equal(otherStates.at(-1).identity.store.id,'store-b');assert(otherStates[0].snapshot===null,'New account must not inherit the previous snapshot');
  h.rows.stores=h.rows.stores.filter(row=>row.merchant_id!=='merchant-a');await h.controller.refresh();assert.equal(h.state.identity,null);assert.equal(h.state.snapshot,null,'A removed store clears previous values');

  const race=harness();await race.controller.refresh();race.hold();const older=race.controller.refresh(true);await waitForHold(race);
  race.rows.stores[0]={id:'replacement',merchant_id:'merchant-a',name:'Replacement',status:'accepted'};
  race.rows.store_orders.push({store_id:'replacement',status:'awaiting_review'});
  await race.controller.refresh(true);assert.equal(race.state.snapshot.storeId,'replacement');
  assert(race.states.some(state=>state.identity?.store.id==='replacement'&&state.snapshot===null),'Old counts must clear before replacement counts arrive');
  race.held.resolve();await older;assert.equal(race.state.snapshot.storeId,'replacement','Delayed older request cannot overwrite the new store');
  race.hold();const leaving=race.controller.refresh(true);await waitForHold(race);race.controller.deactivate();const published=race.states.length;race.held.resolve();await leaving;assert.equal(race.states.length,published,'Blur/unmount invalidates pending responses');
  const money = harness(); await money.controller.refresh(true);
  assert.deepEqual(plain(money.state.snapshot.finance),{payable:'700.25',receivable:'100.50'},'keep both server directions; no netting');
  money.setFinance(async()=>{throw Error('offline');});await money.controller.refresh(true);
  assert.equal(money.state.error,false,'money failure does not fail order counts');
  assert.equal(money.state.snapshot.financeError,true);
  assert.equal(money.state.snapshot.finance.payable,'700.25','keep last same-account totals marked stale');
  const wrong = harness();wrong.setFinance(async()=>({owner:'other',admin:false,account_reference:'ACC',payable:'999',receivable:'0'}));await wrong.controller.refresh(true);
  assert.equal(wrong.state.snapshot.finance,undefined);assert.equal(wrong.state.snapshot.financeError,true);
  wrong.setFinance(async()=>({owner:'owner-a',admin:false,account_reference:'ACC',payable:'9007199254740993.25',receivable:'123.75'}));await wrong.controller.refresh(true);
  assert.equal(wrong.state.snapshot.finance.payable,'9007199254740993.25','never convert money to Number');
  const lateMoney=harness();let resolveMoney,financialSignal;
  lateMoney.setFinance((search,page,owner,signal)=>{assert.equal(search,'');assert.equal(page,0);assert.equal(owner,'owner-a');financialSignal=signal;return new Promise(resolve=>{resolveMoney=resolve;});});
  const waitingMoney=lateMoney.controller.refresh(true);for(let turn=0;turn<40&&!resolveMoney;turn++)await Promise.resolve();assert(resolveMoney);
  lateMoney.controller.deactivate();const financePublished=lateMoney.states.length;
  assert.equal(financialSignal.aborted,true,'financial read is cancelled on blur');
  resolveMoney({owner:'owner-a',admin:false,account_reference:'ACC',payable:'9999.00',receivable:'99.00'});await waitingMoney;
  assert.equal(lateMoney.states.length,financePublished,'late financial result cannot publish after blur');
  console.log('PASS central finance: both directions, large exact amounts, independent failure, stale marking, owner mismatch and recovery.');
  const source=fs.readFileSync(path.join(__dirname,'../src/app/merchant/index.tsx'),'utf8');
  assert(source.includes('useFocusEffect'));assert(source.includes('key={user.id}'));
  for(const removed of ['readLocalCache','recentProducts','activeOffers.map','<AppHeader','<AppBottomNav','notifications'])assert(!source.includes(removed),removed);
  for(const route of ['/merchant/orders','/merchant/product-editor','/merchant/offer-editor'])assert(source.includes('router.push("'+route+'")'));
  console.log('PASS: merchant home scoped counts/offer windows, freshness, retry/empty states, eligibility, account isolation and stale-response/blur protection (offline).');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
