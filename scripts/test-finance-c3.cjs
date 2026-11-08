// Offline production-contract + RPC-client tests. NOT PostgreSQL/security proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./financial-test-loader.cjs');
const contract = load('src/lib/c3-order-contract.ts');
const { evaluate, cents, pricing, assertCentRounding } = require('./c3-pricing-expression-test.cjs');
const sql = fs.readFileSync('supabase/migrations/20261106000100_finance_c3_delivery_pricing.sql','utf8');
let count = 0;
async function test(name, run) { await run(); count++; console.log('PASS '+name); }
async function main() {
  await test('one/two/three stores + all rejected', () => { assert.deepEqual([0,1,2,3].map(n => contract.c3Fee(10000,3000,n)),[0,10000,13000,16000]); });
  await test('negative/fraction/nonfinite/overflow rejected', () => { for (const args of [[-1,1,2],[1.5,1,1],[1,Infinity,2],[1,0,1.1],[999999999999,1,2]]) assert.throws(() => contract.c3Fee(...args)); });
  await test('defensive guard applies decreases/equality only', () => { assert(contract.c3CanApply(100,90,89)); assert(contract.c3CanApply(100,90,90)); assert(!contract.c3CanApply(100,90,91)); assert(!contract.c3CanApply(100,90,101)); });
  await test('one ready is insufficient; all active ready gates DLV', () => { assert(!contract.c3Ready(['ready_for_pickup','awaiting_review'],false,false)); assert(contract.c3Ready(['ready_for_pickup','rejected'],false,false)); });
  await test('zero active, blocked and existing DLV fail closed', () => { assert(!contract.c3Ready(['rejected','cancelled'],false,false)); assert(!contract.c3Ready(['ready_for_pickup'],true,false)); assert(!contract.c3Ready(['ready_for_pickup'],false,true)); });
  const context = { references:{'ORD:one':'ORD-1000000'},pricing:{original:{approved_total:100,original_delivery_fee:10},current:{items_amount:50,delivery_fee:5,total:55,version:2,review_required:false}} };
  await test('context preserves original amount and current amount separately', () => { const row=contract.decodeC3Context(context); assert.equal(row.pricing.original.approved_total,100); assert.equal(row.pricing.current.total,55); });
  await test('malformed/missing money never becomes zero', () => { for (const amount of [null,undefined,'55',NaN,Infinity,-1,1.2]) assert.throws(() => contract.c3Number(amount)); assert.throws(() => contract.decodeC3Context({...context,pricing:{...context.pricing,current:{...context.pricing.current,total:99}}})); });
  await test('merchant context can contain references but no parent pricing', () => { assert.equal(contract.decodeC3Context({references:{'SUB:two':'SUB-000001'},pricing:null}).pricing,null); });
  await test('merchandise retains cents; delivery remains integral',()=>{
    assert.equal(contract.c3Money(100.50),100.50);assert.equal(contract.c3Money(0.50),0.50);
    assert(contract.c3TotalMatches(0.29,10000,10000.29));assert.equal(contract.c3Cents(999999999999.99),99999999999999);
    assert(contract.c3CanApply(100.50,100.50,100.49));assert(!contract.c3CanApply(100.50,100.49,100.50));
    for(const n of [NaN,Infinity,-1,0.001,1000000000000])assert.throws(()=>contract.c3Money(n));
    assert.throws(()=>contract.c3Number(0.50));
  });
  await test('actual merchant offer validator accepts fractional bundle quantities and zero allocations',()=>{
    const offer=load('src/lib/merchant-offer-editor.ts',{'@/constants/selling-units':{sellingUnitOptions:()=>[{value:'piece'}]}});
    const products=['a','b'].map(id=>({id,title:id,price:0.40,selling_unit:'piece',minimum_quantity:1,quantity_step:1,is_available:true}));
    for(const [quantity,bundle,cents] of [[1,'0.50',50n],[2,'1.00',100n],[3,'1.50',150n],[1,'0.01',1n]]){
      const result=offer.validateOffer({...offer.emptyOfferForm,title:'valid bundle',type:'bundle',bundlePrice:bundle,items:products.map(p=>({key:p.id,productId:p.id,role:'bundle',quantity:String(quantity)}))},products,null);
      assert.equal(Object.keys(result.errors).length,0);assert.equal(result.preview.final,cents);
    }
  });
  const arithmetic = pricing(sql);
  await test('extracted production discount expressions retain cents and match quote expressions',()=>{
    const quote = sql.split('create function public.quote_c3_cart')[1];
    const expressions = quote.split(/\r?\n/).filter(line=>line.trimStart().startsWith("when o.offer_type='discount'"))
      .map(line=>line.match(/then\s+(round\(.+\))/)[1]);
    assert.equal(expressions.length,2);
    for (const [price,quantity,discount,expected] of [['100.50','1','10',9045n],['100.50','2','10',18090n],['0.05','1','50',3n]]) {
      const original = evaluate('round(price * quantity, 2)',{price,quantity});
      const actual = cents(evaluate(arithmetic.percentage,{'item_original_total':original,'offer_row.discount_value':discount}));
      assert.equal(actual,expected);
      assert.equal(actual,cents(evaluate(expressions[0],{'p.price':price,'op.quantity':quantity,'o.discount_value':discount})));
    }
    for (const [price,quantity,discount,expected] of [['100.50','1','0.25',10025n],['100.50','2','0.25',20050n],['0.40','1.125','0.10',34n]]) {
      const actual = cents(evaluate(arithmetic.fixed,{'offer_item.price':price,'item_quantity':quantity,'offer_row.discount_value':discount}));
      assert.equal(actual,expected);
      assert.equal(actual,cents(evaluate(expressions[1],{'p.price':price,'op.quantity':quantity,'o.discount_value':discount})));
    }
  });
  await test('extracted cumulative bundle expressions produce exact individual component amounts',()=>{
    for (const [weights,total,expected] of [
      [['0.40','0.40'],'0.50',[25n,25n]],
      [['1','1','1','1'],'2.00',[50n,50n,50n,50n]],
      [['0.80','0.80'],'1.00',[50n,50n]],
      [['1.20','1.20'],'1.50',[75n,75n]],
      [['1','1','1'],'0.10',[3n,4n,3n]],
      [['1','1','1','1'],'0.02',[1n,0n,1n,0n]],
      [['0','1','0'],'0.01',[0n,1n,0n]],
      [['0.40','0.40'],'0.01',[1n,0n]],
    ]) assert.deepEqual(arithmetic.allocate(weights,total),expected);
    // Exercise many residual-cent boundaries with exact BigInt arithmetic.
    for(let size=1;size<=8;size++)for(let total=1;total<=25;total++) {
      const amount=(total/100).toFixed(2),weights=Array.from({length:size},(_,i)=>String(i+1));
      const rows=arithmetic.allocate(weights,amount);
      assert.equal(rows.reduce((a,b)=>a+b,0n),BigInt(total)); assert(rows.every(row=>row>=0n));
    }
    assert.throws(()=>arithmetic.allocate(['0','0'],'0.01'));
    assert.throws(()=>arithmetic.allocate(['-1','2'],'0.01'));
    for(const bad of ['NaN','Infinity','invalid'])assert.throws(()=>arithmetic.allocate(['1'],bad));
    assert.throws(()=>arithmetic.allocate(['1'],'0.001'));
  });
  await test('balanced rounding scanner detects deliberate multiline precision regressions in memory',()=>{
    assertCentRounding(arithmetic.body);
    for(const original of [arithmetic.percentage,arithmetic.fixed]) {
      const mutant=original.replace(/,\s*2\s*\)/,',\n  0   \n)');
      assert.notEqual(mutant,original); assert.throws(()=>assertCentRounding(mutant));
    }
    const mutant=sql.replace('offer_original_total, 2','offer_original_total,\n  0   \n');
    assert.notEqual(mutant,sql); assert.throws(()=>assertCentRounding(pricing(mutant).body));
    assert.throws(()=>assertCentRounding('round(round(value, 0 ), 2)'));
    const old=sql.replace('offer_bundle_total * cumulative_original_total / offer_original_total, 2','offer_bundle_total * item_original_total / offer_original_total, 2');
    assert.throws(()=>assert.deepEqual(pricing(old).allocate(['1','1','1'],'0.10'),[3n,4n,3n]));
  });
  const setup=()=>{
    let identity='A',token='A',counter=0,orderCounter=0,cart='cart-1',hasCart=true,loss=false,transport=false,hold=false,release,readFail=false,writeFail=false,cleanupFail=false,switched=false;
    const storage=new Map(),requests=new Map(),calls=[];
    const server=async(name,args)=>{
      calls.push({name,args});
      if(switched){token='B';identity='B';switched=false;}
      if(args.expected_user!==token)return{data:null,error:{code:'42501',message:'C3_ACCOUNT_CHANGED'}};
      if(hold)await new Promise(resolve=>release=resolve);
      const key=`${token}/${args.request_key_value}`;
      if(name==='recover_c3_order_request')return{data:requests.get(key)?.result??{state:'unknown'},error:null};
      if(name==='quote_c3_cart')return{data:{items_amount:0.50,delivery_fee:10000,total:10000.50,store_count:1,cart_signature:cart},error:null};
      if(transport)return{data:null,error:{message:'network before execution'}};
      const existing=requests.get(key);
      if(existing){if(existing.input!==JSON.stringify(args))return{data:null,error:{code:'P0001',message:'C3_ATTEMPT_INPUT_MISMATCH'}};return{data:{...existing.result,replayed:existing.result.state==='completed'},error:null};}
      const result=args.expected_cart_signature!==cart?{state:'rejected',code:'C3_CART_CHANGED'}:!hasCart?{state:'rejected',code:'C3_ORDER_REJECTED'}:{state:'completed',order_id:`order-${++orderCounter}`,replayed:false};
      requests.set(key,{input:JSON.stringify(args),result});
      if(result.state==='completed')hasCart=false;
      if(loss){loss=false;return{data:null,error:{message:'lost response AFTER commit'}};}
      return{data:result,error:null};
    };
    const api=load('src/lib/c3-orders.ts',{
      '@/lib/driver-cash':{newIdempotencyKey:()=>`key-${++counter}`},
      '@/lib/supabase':{supabase:{auth:{getUser:async()=>({data:{user:{id:identity}},error:null})},rpc:server}},
      '@/lib/local-cache':{readLocalCache:async key=>{if(readFail)throw Error('storage read unavailable');return storage.get(key);},writeLocalCache:async(key,value)=>{storage.set(key,value);if(writeFail)throw Error('storage write unavailable');},invalidateLocalCache:async key=>{if(cleanupFail)throw Error('cleanup unavailable');storage.delete(key);}},
    });
    const args=()=>({input_recipient_name:'recipient',input_contact_phone:'00000',input_delivery_address:'address',input_delivery_zone:'zone',input_customer_note:'',expected_total:10000.50,expected_user:'A',expected_cart_signature:cart});
    return{api,args,calls,storage,requests,orders:()=>orderCounter,setCart:x=>{cart=x;hasCart=true;},emptyCart:()=>!hasCart,lose:()=>loss=true,transport:x=>transport=x,hold:()=>hold=true,release:()=>{hold=false;release();},switchAtRpc:()=>switched=true,readFail:x=>readFail=x,writeFail:x=>writeFail=x,cleanupFail:x=>cleanupFail=x};
  };
  await test('new result is explicitly CREATED and expected actor/signature are sent',async()=>{const t=setup();const result=await t.api.submitC3Order(t.args());assert.equal(result.kind,'created');assert.equal(t.calls[0].args.expected_user,'A');assert.equal(t.calls[0].args.expected_cart_signature,'cart-1');});
  await test('lost success response recovers with EMPTY server cart, no second create',async()=>{const t=setup();t.lose();await assert.rejects(t.api.submitC3Order(t.args()));assert(t.emptyCart());const recovered=await t.api.recoverC3Checkout('A');assert.equal(recovered.kind,'recovered');assert.equal(t.orders(),1);assert.equal(t.calls.filter(x=>x.name==='create_c3_order_from_cart').length,1);});
  await test('new cart with IDENTICAL amount/address recovers old intent, never consumes new cart',async()=>{const t=setup();const original=t.args();t.lose();await assert.rejects(t.api.submitC3Order(original));t.setCart('different-content');const result=await t.api.submitC3Order(t.args());assert.equal(result.kind,'recovered');assert(!t.emptyCart());assert.equal(t.orders(),1);const fresh=await t.api.submitC3Order(t.args());assert.equal(fresh.kind,'created');assert.equal(t.orders(),2);assert.notEqual(t.calls.filter(x=>x.name==='create_c3_order_from_cart')[0].args.request_key_value,t.calls.filter(x=>x.name==='create_c3_order_from_cart')[1].args.request_key_value);});
  await test('even identical recreated cart contents require an explicitly NEW key after recovery',async()=>{const t=setup();const args=t.args();t.lose();await assert.rejects(t.api.submitC3Order(args));t.setCart('cart-1');assert.equal((await t.api.submitC3Order(args)).kind,'recovered');assert(!t.emptyCart());assert.equal((await t.api.submitC3Order(args)).kind,'created');assert.equal(t.orders(),2);const sent=t.calls.filter(x=>x.name==='create_c3_order_from_cart');assert.notEqual(sent[0].args.request_key_value,sent[1].args.request_key_value);});
  await test('unknown attempt is not auto-resubmitted; explicit retry freezes original input/key',async()=>{const t=setup();t.transport(true);await assert.rejects(t.api.submitC3Order(t.args()));const first=t.calls[0].args;const pending=await t.api.submitC3Order(t.args());assert.equal(pending.kind,'pending');assert.equal(t.calls.filter(x=>x.name==='create_c3_order_from_cart').length,1);t.transport(false);const retried=await t.api.retryC3Checkout('A');assert.equal(retried.kind,'recovered');const last=t.calls.at(-1).args;assert.equal(last.request_key_value,first.request_key_value);assert.equal(last.expected_cart_signature,first.expected_cart_signature);});
  await test('changed cart retry is durably REJECTED, no duplicate creation',async()=>{const t=setup();t.transport(true);await assert.rejects(t.api.submitC3Order(t.args()));t.transport(false);t.setCart('new-cart');const result=await t.api.retryC3Checkout('A');assert.equal(result.kind,'rejected');assert.equal(t.orders(),0);assert(!t.emptyCart());assert.equal(await t.api.recoverC3Checkout('A').then(x=>x.kind),'none');});
  await test('session switch between identity check and token selection cannot WRITE',async()=>{const t=setup();t.switchAtRpc();await assert.rejects(t.api.submitC3Order(t.args()),/تغير الحساب/);assert.equal(t.orders(),0);assert.equal(t.requests.size,0);});
  await test('session switch during RECOVERY cannot return another account result',async()=>{const t=setup();t.lose();await assert.rejects(t.api.submitC3Order(t.args()));t.switchAtRpc();await assert.rejects(t.api.recoverC3Checkout('A'),/تغير الحساب/);assert(t.storage.has('c3-checkout-v2:A'));assert.equal(t.orders(),1);});
  await test('double-tap creation has one request',async()=>{const t=setup();t.hold();const first=t.api.submitC3Order(t.args());await new Promise(r=>setImmediate(r));await assert.rejects(t.api.submitC3Order(t.args()));t.release();assert.equal((await first).kind,'created');assert.equal(t.orders(),1);});
  await test('double-tap recovery remains read-only and locked',async()=>{const t=setup();t.lose();await assert.rejects(t.api.submitC3Order(t.args()));t.hold();const first=t.api.recoverC3Checkout('A');await new Promise(r=>setImmediate(r));await assert.rejects(t.api.recoverC3Checkout('A'));t.release();assert.equal((await first).kind,'recovered');assert.equal(t.orders(),1);});
  await test('storage read failure is NOT absence; failed durable writes also block retry sends',async()=>{const t=setup();t.readFail(true);await assert.rejects(t.api.submitC3Order(t.args()));assert.equal(t.calls.length,0);t.readFail(false);t.writeFail(true);await assert.rejects(t.api.submitC3Order(t.args()));assert.equal(t.calls.length,0);await assert.rejects(t.api.retryC3Checkout('A'));assert.equal(t.calls.filter(x=>x.name==='create_c3_order_from_cart').length,0);});
  await test('cleanup failure after confirmation can only yield recovered result, never resend',async()=>{const t=setup();t.cleanupFail(true);assert.equal((await t.api.submitC3Order(t.args())).kind,'created');t.setCart('new');assert.equal((await t.api.submitC3Order(t.args())).kind,'recovered');assert.equal(t.orders(),1);assert(!t.emptyCart());});
  await test('UI recovery is independent of quote/cart count and never clears local cart',()=>{const source=fs.readFileSync('src/app/checkout.tsx','utf8');assert.match(source,/recoverC3Checkout\(owner\)/);assert.match(source,/retryC3Checkout\(owner\)/);assert.doesNotMatch(source,/clearAfterOrder/);assert.match(source,/<CheckoutContent key=\{user\?\.id/);assert.match(source,/ownerRef.current = undefined/);assert.match(source,/result.kind === "created"/);assert.match(source,/result.kind === "recovered"/);assert.match(source,/expectedUser: owner, cartSignature:/);});
  await test('admin exceptions decode exact decimal strings including signed differences',()=>{const row={customer_order_id:'id',public_reference:'ORD-000001',approved_total:'100.50',current_amount:'90.25',proposed_total:'100000000000000000.01',difference:'-0.01',reason:'test',decided_at:'2026-11-06T00:00:00Z',recorded_at:'2026-11-06T01:00:00Z',updated_at:'2026-11-06T01:00:00Z'};assert.equal(contract.decodeC3Exception(row).proposed_total,row.proposed_total);const ui=fs.readFileSync('src/components/admin/C3DeliverySettings.tsx','utf8');for(const field of ['approved_total','current_amount','proposed_total','difference','reason','decided_at','recorded_at','updated_at'])assert(ui.includes(`row.${field}`));assert.doesNotMatch(ui,/c3Rpc\("(?:approve|unblock|override|reprice)/i);});
  await test('migration transaction and no journal posting/backfill/cascade',()=>{assert.match(sql,/^begin;/m);assert.match(sql,/commit;\s*$/);assert.doesNotMatch(sql,/perform\s+finance_private\.(post_journal|begin_operation|record_financial_event)/i);assert.doesNotMatch(sql,/\bcascade\b/i);});
  await test('snapshot + revisions immutable, guarded dispatch uses parent lock',()=>{assert.match(sql,/c3_snapshot_immutable[\s\S]*?reject_mutation/);assert.match(sql,/c3_revision_immutable[\s\S]*?reject_mutation/);assert.match(sql,/previous\.review_required or proposed_total>least\(previous\.total,snap\.approved_total\)/);const gate=sql.split('create function finance_private.c3_dispatch')[1].split('end $$;')[0];assert(gate.indexOf('for update')<gate.indexOf('insert into public.delivery_tasks'));assert.match(gate,/current_price.review_required then return/);});
  await test('C2 references assigned only after actual objects exist',()=>{const create=sql.split('create or replace function public.create_order_from_cart')[1].split('create or replace function public.make_order_delivery_available')[0];assert.doesNotMatch(create,/insert into public.delivery_tasks/);assert.match(create,/register_document\('ORD',new_order\)/);assert.match(create,/register_document\('SUB',child_value.id\)/);assert(sql.indexOf("insert into public.delivery_tasks")<sql.indexOf("register_document('DLV'"));});
  await test('C3 security definer declarations all have empty search_path',()=>{for(const match of sql.matchAll(/security definer([\s\S]*?)as \$\$/gi)) assert.match(match[1],/set search_path\s*=\s*''/i);assert.match(sql,/revoke all on all functions in schema finance_private from public,anon,authenticated,service_role/);});
  await test('old unconfirmed creation contract is not executable by runtime roles',()=>assert.match(sql,/revoke all on function public\.create_order_from_cart\(text,text,text,uuid,text\) from public,anon,authenticated,service_role/));
  await test('merchant pricing isolation and no customer increase approval API',()=>{const fn=sql.split('create function public.c3_pricing_readable')[1].split('$$;')[0];assert.doesNotMatch(fn,/is_store_owner/);assert.doesNotMatch(sql,/create (?:or replace )?function[^\n]*(approve.*increase|reprice_order)/i);});
  await test('delayed gate concurrency test is real separate psql sessions, guarded',()=>{const runner=fs.readFileSync('scripts/test-finance-c3-postgres.cjs','utf8');assert.match(runner,/buildConfig\(process.env,\s*manifest\)/);assert.match(runner,/await preflight\(config,\s*sql\)/);assert.match(runner,/await overlap\(config,sql/);const session=fs.readFileSync('scripts/finance-c3-test-session.cjs','utf8');assert.match(session,/pg_blocking_pids/);assert.match(session,/if\(!blocked\)throw/);assert.doesNotMatch(session,/pg_sleep/);assert.doesNotMatch(runner,/db push|db reset|drop database|truncate/i);});
  await test('server checks expected subject before writes/replay and binds canonical cart content',()=>{const fn=sql.split('create function public.create_c3_order_from_cart')[1].split('create function public.recover_c3_order_request')[0];assert(fn.indexOf('expected_user is distinct from auth.uid()')<fn.indexOf('insert into public.customer_order_requests'));assert(fn.indexOf('expected_user is distinct from auth.uid()')<fn.indexOf("request_row.state='completed'"));assert.match(fn,/c3_cart_signature\(cart_value\) is distinct from expected_cart_signature/);assert.match(fn,/state='rejected',failure_code/);assert.match(sql,/recover_c3_order_request\(request_key_value uuid,expected_user uuid\)/);});
  await test('SQL precision matches legacy pricing; fractional SQL cases and post-deferred assertions exist',()=>{const body=sql.split('create or replace function public.create_order_from_cart')[1].split('create or replace function public.make_order_delivery_available')[0];assert.match(body,/round\(ci.quantity \* p.price, 2\)/);assert.match(body,/round\(coalesce\(offer_row.bundle_price, 0\), 2\)/);assertCentRounding(body);const quote=sql.split('create function public.quote_c3_cart')[1];assert.match(quote,/round\(ci.quantity\*p.price,2\)/);const tests=fs.readFileSync('supabase/tests/finance_c3_delivery_pricing.sql','utf8');assert.match(tests,/100\.50/);assert.match(tests,/0\.40/);assert.match(tests,/0\.50/);assert.match(tests,/merchant_order_entitlements/);assert(tests.lastIndexOf('set constraints all immediate')>tests.indexOf("update_delivery_task_status(order_value,'delivered')"));});
  await test('interactive test connection cannot send test SQL before identity ACK',async()=>{
    const {EventEmitter}=require('node:events');const {openSession}=require('./finance-c3-test-session.cjs');
    let child;const writes=[];
    const config={psqlPath:'fake',args:[],env:{},database:'unit_c2_test',host:'127.0.0.1',port:'5432',databaseOid:'1',systemIdentifier:'2',token:'00000000-0000-4000-8000-000000000001'};
    const launch=()=>{child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin={write:sql=>writes.push(sql),end:()=>child.emit('close',0)};child.kill=()=>child.emit('close',1);return child;};
    const opening=openSession(config,launch);assert.equal(writes.length,1);assert.match(writes[0],/begin read only/);assert.doesNotMatch(writes[0],/insert into/i);
    const ack=text=>text.match(/\\echo (C3_ACK_\w+)/)[1];
    child.stdout.emit('data',ack(writes[0])+'\n');await new Promise(r=>setImmediate(r));
    assert.equal(writes.length,2);assert.match(writes[1],/pg_backend_pid/);child.stdout.emit('data','123\n'+ack(writes[1])+'\n');const session=await opening;
    const running=session.run('select 1;');assert.equal(writes.length,3);child.stdout.emit('data','1\n'+ack(writes[2])+'\n');assert.equal(await running,'1');session.close();
  });
  await test('actual shared cache strict read propagates failure instead of reporting no attempt',async()=>{
    const cache=load('src/lib/local-cache.ts',{'@react-native-async-storage/async-storage':{default:{getItem:async()=>{throw Error('unavailable');}}}});
    assert.equal(await cache.readLocalCache('ordinary-cache'),undefined);
    await assert.rejects(cache.readLocalCache('strict-c3-cache',{requirePersistence:true}));
  });
  console.log(`${count} offline C3 checks passed. PostgreSQL behavior NOT RUN here.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
