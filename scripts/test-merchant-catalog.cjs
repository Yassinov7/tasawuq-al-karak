// Offline tests exercise the production controller and query adapter; no Supabase connection.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./syp-test-loader.cjs');
let revision = 0, passed = 0;
const m = load('src/lib/merchant-catalog.ts', {
  '@/lib/merchant-catalog-api': { catalogApi: {} },
  '@/lib/merchant-home': { merchantCatalogRevision: () => revision },
});
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const product = (id, store_id = 'store-a') => ({ kind:'products', id,store_id,title:id,price:100.25,selling_unit:'unit',category_id:'cat',is_available:true,created_at:'2030-01-01T00:00:00Z',category:null,image:null });
const offer = (id = 'offer') => ({kind:'offers',id,store_id:'store-a',title:id,offer_type:'buy_x_get_y',discount_method:null,discount_value:null,bundle_price:null,is_active:true,starts_at:'2020-01-01T00:00:00Z',ends_at:null,created_at:'2020-01-01T00:00:00Z',items:[]});
function harness(kind = 'products') {
  let state, now=1000, failEffects=false, changed=0;
  const calls=[]; let all=kind==='products'?[product('3'),product('2'),product('1')]:[offer()];
  const api={
    store:async owner=>{calls.push(['owner',owner]);return {id:'store-a',approved:true};},
    page:async(k,store,scope,cursor,at)=>{calls.push(['page',k,store,plain(scope),cursor?.id,at]);return all.filter(row=>row.store_id===store&&(!scope.query||row.title.includes(scope.query))&&(scope.filter==='all'||row.kind==='products'&&row.is_available===(scope.filter==='available'))&&(!cursor||row.id<cursor.id)).slice(0,2);},
    availability:async(id,store,value)=>{calls.push(['update',id,store,value]);all=all.map(row=>row.id===id?{...row,is_available:value}:row);return{id,is_available:value};},
    exists:async(id,store)=>all.some(row=>row.id===id&&row.store_id===store),
    remove:async id=>{calls.push(['delete',id]);all=all.filter(row=>row.id!==id);},
  };
  const c=m.createCatalogController('owner-a',kind,{query:'',filter:'all'},next=>{state=next;},async()=>{changed++;revision++;if(failEffects)throw Error('client refresh');},api,()=>now);
  c.activate();
  return {c,api,calls,get state(){return state;},get rows(){return all;},set rows(value){all=value;},get changed(){return changed;},failEffects(){failEffects=true;},advance(){now+=31000;}};
}
async function test(name, fn){await fn();passed++;console.log('PASS '+name);}
async function run(){
 await test('catalog tab defaults and compatibility routes preserve both panel entry points',()=>{
  assert.equal(m.catalogTab('offers'),'offers');for(const value of [undefined,'products','wrong',[]])assert.equal(m.catalogTab(value),'products');
  const catalog=fs.readFileSync('src/app/merchant/catalog.tsx','utf8');assert(catalog.includes('router.setParams'));assert(catalog.includes('catalogTab(params.tab)'));
  for(const kind of ['products','offers'])assert(fs.readFileSync(`src/app/merchant/${kind}.tsx`,'utf8').includes(`kind="${kind}"`));
 });
 await test('existing add/edit success and cancel routes remain intact',()=>{
  for(const mode of ['Add','Edit']){const code=fs.readFileSync(`src/components/merchant/Merchant${mode}Product.tsx`,'utf8');assert(code.includes('router.back()'));assert(code.includes("tab:'products'")||code.includes('tab:"products"'));assert(code.includes('invalidateMerchantHome'));}
  const code=fs.readFileSync('src/components/merchant/MerchantOfferEditor.tsx','utf8');assert(code.includes("tab:'offers'"));assert(code.includes('allowExit.current=true;catalog()'));assert(code.includes('router.back()'));
 });
 await test('keyset pages deduplicate, include final short capped page, and finish only on empty read',async()=>{
  const h=harness();await h.c.focus();assert.equal(h.state.rows.length,2);assert(h.state.hasMore);await h.c.more();assert.equal(h.state.rows.length,3);assert(h.state.hasMore);await h.c.more();assert(!h.state.hasMore);
  assert.deepEqual(plain(m.mergeCatalogRows([product('a')],[product('a'),product('b')])).map(r=>r.id),['a','b']);
 });
 await test('server scope resets rows and cursor; search can find an item outside first page',async()=>{
  const h=harness();await h.c.focus();await h.c.select({query:'1',filter:'all'});assert.deepEqual(plain(h.state.rows).map(r=>r.id),['1']);assert.equal(h.calls.at(-1)[4],undefined);
  await h.c.select({query:'',filter:'paused'});assert.equal(h.state.rows.length,0);assert.equal(h.state.error,'');
 });
 await test('late first-page response cannot replace a newer search',async()=>{
  const h=harness(),wait=deferred();h.api.page=()=>wait.promise;const old=h.c.focus();await new Promise(setImmediate);h.api.page=async()=>[product('new')];await h.c.select({query:'new',filter:'all'});wait.resolve([product('old')]);await old;assert.equal(h.state.rows[0].id,'new');
 });
 await test('late continuation cannot merge into a new filter',async()=>{
  const h=harness();await h.c.focus();const wait=deferred();h.api.page=()=>wait.promise;const more=h.c.more();h.api.page=async()=>[];await h.c.select({query:'',filter:'paused'});wait.resolve([product('old')]);await more;assert.equal(h.state.rows.length,0);
 });
 await test('blur fences requests and fresh focus still checks store ownership',async()=>{
  const h=harness(),wait=deferred();h.api.page=()=>wait.promise;const pending=h.c.focus();await new Promise(setImmediate);h.c.deactivate();wait.resolve([product('late')]);await pending;h.c.activate();assert.equal(h.state.rows.length,0);
  h.api.page=async()=>[product('ok')];await h.c.focus();const before=h.calls.filter(x=>x[0]==='owner').length;await h.c.focus();assert.equal(h.calls.filter(x=>x[0]==='owner').length,before+1);
 });
 await test('store replacement discards rows before replacement page, absent store clears all data',async()=>{
  const h=harness();await h.c.focus();h.api.store=async()=>({id:'store-b',approved:true});const wait=deferred();h.api.page=()=>wait.promise;const pending=h.c.refresh();await new Promise(setImmediate);assert.equal(h.state.rows.length,0);assert.equal(h.state.store.id,'store-b');wait.resolve([product('b','store-b')]);await pending;h.api.store=async()=>null;await h.c.refresh();assert.equal(h.state.rows.length,0);assert.equal(h.state.store,null);
 });
 await test('fresh controllers for another account never hydrate previous account cache',()=>{
  const h=harness();assert.equal(h.state.rows.length,0);const source=fs.readFileSync('src/components/merchant/MerchantCatalogPanel.tsx','utf8');assert(source.includes('key={`${user.id}:${kind}`}'));assert(!source.includes('peekLocalCache'));assert(!source.includes('readLocalCache'));
 });
 await test('refresh preserves same-store rows on failure, exposes error and clears it on retry',async()=>{
  const h=harness();await h.c.focus();h.api.page=async()=>{throw Error('offline');};await h.c.refresh();assert.equal(h.state.rows.length,2);assert(h.state.error);assert(!h.state.loading);h.api.page=async()=>[];await h.c.refresh();assert.equal(h.state.error,'');assert.equal(h.state.rows.length,0);
 });
 await test('continuation failure is independently retryable without dropping prior rows',async()=>{
  const h=harness();await h.c.focus();h.api.page=async()=>{throw Error('offline');};await h.c.more();assert(h.state.moreError);assert.equal(h.state.rows.length,2);h.api.page=async()=>[product('1')];await h.c.more(true);assert(!h.state.moreError);assert.equal(h.state.rows.length,3);
 });
 await test('availability locks immediately and verified update survives client refresh failure',async()=>{
  const h=harness();await h.c.focus();const row=h.state.rows[0];h.failEffects();const wait=deferred(),update=h.api.availability;h.api.availability=async(...args)=>{await wait.promise;return update(...args);};const first=h.c.availability(row),second=h.c.availability(row);assert.equal(await second,false);wait.resolve();assert.equal(await first,true);assert.equal(h.calls.filter(x=>x[0]==='update').length,1);assert(h.state.notice.includes('العملية محفوظة'));assert(h.changed);assert(!h.state.rows.find(r=>r.id===row.id).is_available);assert(!h.state.busy);
 });
 await test('availability refuses another store and foreign ownership prevents mutation',async()=>{
  const h=harness();await h.c.focus();assert.equal(await h.c.availability(product('other','store-b')),false);h.api.store=async()=>({id:'store-b',approved:true});await h.c.availability(h.state.rows[0]);assert(!h.calls.some(x=>x[0]==='update'));
 });
 await test('catalogue revision invalidates fresh page after editor saves and product availability',async()=>{
  const h=harness();await h.c.focus();const before=h.calls.filter(x=>x[0]==='page').length;revision++;await h.c.focus();assert.equal(h.calls.filter(x=>x[0]==='page').length,before+1);h.advance();await h.c.focus();assert.equal(h.calls.filter(x=>x[0]==='page').length,before+2);
 });
 await test('confirmed editor revision hides obsolete names until fresh rows arrive, including after blur',async()=>{
  const h=harness();await h.c.focus();h.c.deactivate();assert(h.state.validating);h.c.activate();revision++;const wait=deferred();h.api.page=()=>wait.promise;const pending=h.c.focus();await new Promise(setImmediate);assert.equal(h.state.rows.length,0);wait.resolve([product('renamed')]);await pending;assert.equal(h.state.rows[0].id,'renamed');
 });
 await test('a confirmed mutation in another mounted screen fences a read already in flight',async()=>{
  const h=harness(),wait=deferred();h.api.page=()=>wait.promise;const pending=h.c.focus();await new Promise(setImmediate);revision++;h.api.page=async()=>[product('confirmed')];wait.resolve([product('obsolete')]);await pending;assert.equal(h.state.rows[0].id,'confirmed');
 });
 await test('confirmed delete is scoped, locked and invalidates related data',async()=>{
  const h=harness('offers');await h.c.focus();const row=h.state.rows[0],wait=deferred(),remove=h.api.remove;h.api.remove=async id=>{await wait.promise;return remove(id);};const first=h.c.remove(row);assert.equal(await h.c.remove(row),false);wait.resolve();assert.equal(await first,true);assert.equal(h.calls.filter(x=>x[0]==='delete').length,1);assert.equal(h.state.rows.length,0);assert.equal(h.changed,1);assert.equal(h.state.pendingDelete,null);
 });
 await test('lost delete response is verified as absent without replaying RPC',async()=>{
  const h=harness('offers');await h.c.focus();h.api.remove=async()=>{h.rows=[];throw Error('lost');};assert.equal(await h.c.remove(h.state.rows[0]),true);assert.equal(h.state.pendingDelete,null);assert.equal(h.state.rows.length,0);
 });
 await test('unknown delete blocks repeats and read-only verification never resends',async()=>{
  const h=harness('offers');await h.c.focus();let sends=0;h.api.remove=async()=>{sends++;throw Error('lost');};await h.c.remove(h.state.rows[0]);assert(h.state.pendingDelete);assert(!h.state.busy);await h.c.remove(h.state.rows[0]);assert.equal(sends,1);await h.c.verifyDelete();assert(h.state.pendingDelete);h.rows=[];await h.c.verifyDelete();assert.equal(h.state.pendingDelete,null);assert.equal(sends,1);
 });
 await test('a deleted row cannot be resurrected by a load started before deletion or a stale replica page',async()=>{
  const h=harness('offers');await h.c.focus();const row=h.state.rows[0],wait=deferred();h.api.page=()=>wait.promise;const pending=h.c.refresh();await new Promise(setImmediate);h.api.page=async()=>[row];await h.c.remove(row);wait.resolve([row]);await pending;assert.equal(h.state.rows.length,0);
 });
 await test('delete errors before scope verification never send RPC',async()=>{
  const h=harness('offers');await h.c.focus();h.api.store=async()=>{throw Error('offline');};await h.c.remove(h.state.rows[0]);assert(!h.calls.some(x=>x[0]==='delete'));assert(!h.state.busy);assert.equal(h.state.pendingDelete,null);
 });
 await test('offer states have explicit priority and exact end/start boundaries',()=>{
  const now=Date.parse('2030-01-01T00:00:00Z'),o=offer();assert.equal(m.offerPhase(o,now),'current');assert.equal(m.offerPhase({...o,starts_at:'2030-01-01T00:00:01Z'},now),'scheduled');assert.equal(m.offerPhase({...o,ends_at:'2030-01-01T00:00:00Z'},now),'expired');assert.equal(m.offerPhase({...o,ends_at:'2029-01-01',is_active:false},now),'paused');assert.equal(m.offerPhase({...o,starts_at:'2031-01-01',ends_at:'2029-01-01'},now),'expired');
 });
 await test('fractional component quantities and buy/reward roles stay visible; prices retain SYP',()=>{
  const code=fs.readFileSync('src/components/merchant/MerchantCatalogPanel.tsx','utf8');assert(code.includes('maximumFractionDigits: 3'));assert(code.includes("item.item_role === 'buy'"));assert(code.includes("item.item_role === 'reward'"));assert(!code.includes('quantity > 1'));assert(m.offerPriceSummary({...offer(),offer_type:'bundle',bundle_price:100.25}).includes('ل.س'));
 });
 await test('list uses virtual rendering, debounced server scopes, refined confirmation and safe media retention',()=>{
  const code=fs.readFileSync('src/components/merchant/MerchantCatalogPanel.tsx','utf8');assert(code.includes('<FlatList'));assert(code.includes('}, 300)'));assert(code.includes('onRefresh='));assert(code.includes('controller.select'));assert(code.includes('AppConfirmModal design="refined"'));assert(!code.includes('.storage.'));assert(code.includes('invalidateMerchantHome(ownerId)'));assert(code.includes('invalidatePublicCatalog()'));assert(code.includes('merchant-offers:${ownerId}'));assert(code.includes('merchant-products:${ownerId}'));
 });
 await test('adapter uses page-sized stable keyset and page-scoped images and offer items',()=>{
  const code=fs.readFileSync('src/lib/merchant-catalog-api.ts','utf8');assert(code.includes('catalogPageSize = 20'));assert(code.includes("order('created_at', { ascending: false }).order('id', { ascending: false })"));assert(code.includes(".eq('product_media.media_type', 'image')"));assert(code.includes(".limit(1, { referencedTable: 'product_media' })"));assert(code.includes(".in('offer_id', offers.map(row => row.id))"));assert(code.includes("itemsQuery.gt('id', after)"));assert(code.includes(".eq('store_id', storeId)"));assert(!code.includes('.delete('));
 });
 await test('query adapter sends scoped search and filters to Supabase, including page continuations',async()=>{
  const calls=[];function query(table){const ops=[];const q={};for(const name of ['select','eq','gt','lte','ilike','or','order','limit','in'])q[name]=(...args)=>{ops.push([name,...args]);return q;};q.then=resolve=>{calls.push({table,ops});return Promise.resolve(resolve({data:[],error:null}));};return q;}
  const a=load('src/lib/merchant-catalog-api.ts',{'@/lib/supabase':{supabase:{from:query}},'@/lib/merchant-store':{setMerchantProductAvailability:async()=>{}}}).catalogApi;
  const cursor={created_at:'2030-01-01T00:00:00Z',id:'abc'},at='2030-02-01T00:00:00Z';
  for(const filter of ['all','available','paused'])await a.page('products','owned-store',{query:'50%_\\',filter},cursor,at);
  for(const filter of ['all','current','scheduled','expired','paused'])await a.page('offers','owned-store',{query:'needle',filter},cursor,at);
  assert.equal(calls.length,8);for(const call of calls){assert(call.ops.some(op=>op[0]==='eq'&&op[1]==='store_id'&&op[2]==='owned-store'));assert(call.ops.some(op=>op[0]==='or'&&op[1].includes('id.lt.abc')));assert(call.ops.some(op=>op[0]==='ilike'));}
  assert.equal(calls[0].ops.find(op=>op[0]==='ilike')[2],'%50\\%\\_\\\\%');
  assert(calls[4].ops.some(op=>op[0]==='lte'&&op[1]==='starts_at'));assert(calls[5].ops.some(op=>op[0]==='gt'&&op[1]==='starts_at'));assert(calls[6].ops.some(op=>op[0]==='lte'&&op[1]==='ends_at'));assert(calls[7].ops.some(op=>op[0]==='eq'&&op[1]==='is_active'&&op[2]===false));
 });
 await test('offer child rows survive a server cap smaller than requested, with lookup names and fractional rewards',async()=>{
  const calls=[];
  const components=Array.from({length:5},(_,index)=>({id:String(index+1),offer_id:'offer',product_id:`p${index}`,item_role:index%2?'reward':'buy',quantity:0.5,products:{title:`product ${index}`,selling_unit:'kg',is_available:true}}));
  function from(table){const ops=[];const q={};for(const name of ['select','eq','gt','lte','ilike','or','order','limit','in'])q[name]=(...args)=>{ops.push([name,...args]);return q;};q.then=resolve=>{calls.push(table);const cursor=ops.find(op=>op[0]==='gt')?.[2];const rows=table==='store_offers'?[offer()]:components.filter(row=>!cursor||row.id>cursor).slice(0,2);return Promise.resolve(resolve({data:rows,error:null}));};return q;}
  const api=load('src/lib/merchant-catalog-api.ts',{'@/lib/supabase':{supabase:{from}},'@/lib/merchant-store':{setMerchantProductAvailability:async()=>{}}}).catalogApi;
  const result=await api.page('offers','store-a',{query:'',filter:'all'},null,'2030-01-01T00:00:00Z');assert.equal(result[0].items.length,5);assert.equal(result[0].items[1].quantity,0.5);assert.equal(result[0].items[1].item_role,'reward');assert.equal(result[0].items[4].product.title,'product 4');assert.equal(calls.filter(x=>x==='store_offer_products').length,4);assert(!calls.includes('products'));
 });
 await test('product adapter keeps actual readable inactive category and first ordered image without loading video rows',async()=>{
  const q={};for(const name of ['select','eq','ilike','or','order','limit'])q[name]=()=>q;
  q.then=resolve=>Promise.resolve(resolve({data:[{...product('p'),product_categories:{name:'Historical category',is_active:false},product_media:[{storage_path:'store-a/primary',display_order:0,id:'image'}]}],error:null}));
  const api=load('src/lib/merchant-catalog-api.ts',{'@/lib/supabase':{supabase:{from:()=>q}},'@/lib/merchant-store':{setMerchantProductAvailability:async()=>{}}}).catalogApi;
  const [row]=await api.page('products','store-a',{query:'',filter:'all'},null,'2030-01-01');assert.equal(row.category.name,'Historical category');assert.equal(row.category.is_active,false);assert.equal(row.image,'store-a/primary');
 });
 await test('historical order snapshots are never rewritten by catalog operations',()=>{
  const code=fs.readFileSync('src/lib/merchant-catalog-api.ts','utf8');assert(!code.includes("from('store_order"));assert(code.includes("rpc('delete_store_offer', { target_offer: id })"));const sql=fs.readFileSync('supabase/migrations/20261026000100_syp_only_architecture.sql','utf8');assert(sql.includes("'offer_id', offer_row.id"));assert(sql.includes('item_offer_snapshot'));
 });
 console.log(`${passed} merchant catalog tests passed (offline)`);
}
run().catch(error=>{console.error(error);process.exitCode=1;});
