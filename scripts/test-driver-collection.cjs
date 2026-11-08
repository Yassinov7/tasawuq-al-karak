// Offline production service/decoder tests. NOT PostgreSQL, RLS or signed-JWT proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./financial-test-loader.cjs');
const model = load('src/lib/driver-collection.ts');
const money = load('src/lib/money.ts');
let count = 0;
async function test(name, work) { await work(); count++; console.log('PASS '+name); }
const rawContext = (total = 13300.50, blocked = false) => ({
  references: { 'DLV:task': 'DLV-000001' },
  pricing: { original: { approved_total: 16600.50, original_delivery_fee: 16000 },
    current: { items_amount: total - 13000, delivery_fee: 13000, total, version: 2, review_required: blocked } },
  proposed_total: 999999,
});
const row = () => ({id:'task',driver_id:'A',customer_order_id:'order',status:'picked_up',
  accepted_at:null,created_at:'2026-11-07',delivered_at:null,picked_up_at:null,
  customer_orders:{order_number:1,recipient_name:'synthetic',contact_phone:'00000',delivery_address:'synthetic',delivery_zone_name_snapshot:'zone',store_orders:[]}});
function setup(options = {}) {
  let identity = 'A'; const calls = [];
  const tables = { delivery_tasks: options.rows ?? [row()], customer_order_cash_obligations: options.obligations ?? [] };
  const client = {
    auth: { getUser: async () => ({data:{user:{id:identity}},error:null}) },
    from(table) {
      const filters = []; calls.push({table,filters});
      const query = { select(){return query;},eq(key,value){filters.push([key,value]);return query;},
        in(key,values){filters.push([key,values]);return query;},order(){return query;},
        then(resolve,reject){
          let data = tables[table] ?? [];
          if (!options.ignoreFilters) data = data.filter(item=>filters.every(([key,value])=>Array.isArray(value)?value.includes(item[key]):item[key]===value));
          return Promise.resolve({data,error:options.failTable===table?{message:'offline failure'}:null}).then(resolve,reject);
        }};
      return query;
    },
    async rpc(name,args) {
      calls.push({name,args});
      if (name === 'get_c4_pickup_context') return {data:null,error:{code:'PGRST202',message:'not deployed'}};
      if (name !== 'get_c3_order_context') return {data:null,error:null};
      if (options.switchAtContext) identity = 'B';
      return {data:options.contexts ?? {order:rawContext()},error:options.failContext?{message:'offline failure'}:null};
    },
  };
  return {api:load('src/lib/driver-deliveries.ts',{'@/lib/supabase':{supabase:client}}),calls};
}
const obligation = overrides => ({customer_order_id:'order',delivery_task_id:'task',driver_id:'A',currency:'SYP',collectible_amount:777.25,...overrides});
async function main() {
  await test('assigned driver receives current C3 total after rejection, never original/proposed',async()=>{
    const t=setup(),tasks=await t.api.getDriverAssignedTasks('A');
    assert.equal(tasks[0].collection.amount,13300.50); assert.equal(tasks[0].collection.source,'c3');
    assert.equal(tasks[0].reference,'DLV-000001');
    assert(!t.calls.some(call=>call.table==='customer_order_totals'));
  });
  await test('review-required context blocks collection and transition without using proposed money',async()=>{
    const t=setup({contexts:{order:rawContext(13300.50,true)}});
    const task=(await t.api.getDriverAssignedTasks('A'))[0];assert.equal(task.collection.state,'blocked');
    assert.match(model.driverCollectionMessage(task.collection),/مراجعة التسعير/);
    await assert.rejects(t.api.updateDeliveryTaskStatus('order','delivered','A'),/مراجعة التسعير/);
    assert(!t.calls.some(call=>call.name==='update_delivery_task_status'));
  });
  await test('context failure stays unavailable and cannot fall back to any legacy amount',async()=>{
    const t=setup({failContext:true,obligations:[obligation({})]});
    assert.equal((await t.api.getDriverAssignedTasks('A'))[0].collection.state,'unavailable');
    assert(!t.calls.some(call=>call.table==='customer_order_cash_obligations'));
    await assert.rejects(t.api.updateDeliveryTaskStatus('order','delivered','A'),/تعذر تحميل مبلغ التحصيل/);
  });
  await test('malformed C3 money never becomes zero or an original-total fallback',async()=>{
    for(const total of [null,NaN,-1,13300.501]) {
      const context=rawContext();context.pricing.current.total=total;
      const t=setup({contexts:{order:context}});
      assert.equal((await t.api.getDriverAssignedTasks('A'))[0].collection.state,'unavailable');
    }
  });
  await test('legacy task reads an owned delivery-time financial obligation unchanged',async()=>{
    const t=setup({contexts:{},rows:[{...row(),status:'delivered'}],obligations:[obligation({})]});
    const value=(await t.api.getDriverAssignedTasks('A'))[0].collection;
    assert.equal(value.amount,777.25);assert.equal(value.source,'legacy_obligation');
    const read=t.calls.find(call=>call.table==='customer_order_cash_obligations');
    assert(read.filters.some(([key,value])=>key==='driver_id'&&value==='A'));
    assert(read.filters.some(([key,value])=>key==='delivery_task_id'&&value.includes('task')));
  });
  await test('legacy active task without a financial snapshot cannot be delivered using historical totals',async()=>{
    const t=setup({contexts:{order:{references:{},pricing:null}}});
    const value=(await t.api.getDriverAssignedTasks('A'))[0].collection;
    assert.equal(value.state,'unavailable');assert(!model.canProgressDriverCollection(value));
    await assert.rejects(t.api.updateDeliveryTaskStatus('order','delivered','A'));
    assert(!t.calls.some(call=>call.table==='customer_order_totals'||call.name==='update_delivery_task_status'));
  });
  await test('legacy read failure and foreign/mismatched/currency records cannot supply money',async()=>{
    for(const options of [
      {failTable:'customer_order_cash_obligations',obligations:[obligation({})]},
      {obligations:[obligation({driver_id:'B'})]},
      {obligations:[obligation({customer_order_id:'other'})]},
      {obligations:[obligation({delivery_task_id:'other'})]},
      {obligations:[obligation({currency:'USD'})]},
      {obligations:[obligation({}),obligation({})]},
    ]) {
      const t=setup({contexts:{},...options});
      assert.equal((await t.api.getDriverAssignedTasks('A'))[0].collection.state,'unavailable');
    }
  });
  await test('foreign assigned-task row fails closed even if a mock bypasses query filters',async()=>{
    const t=setup({rows:[{...row(),driver_id:'B'}],ignoreFilters:true});
    await assert.rejects(t.api.getDriverAssignedTasks('A'),/إسناد/);
    assert(!t.calls.some(call=>call.name==='get_c3_order_context'));
  });
  await test('caller cannot request another driver identity or use an unassigned parent',async()=>{
    const t=setup();await assert.rejects(t.api.getDriverAssignedTasks('B'),/تغير الحساب/);
    await assert.rejects(t.api.updateDeliveryTaskStatus('unassigned','delivered','A'));
    assert(!t.calls.some(call=>call.name==='update_delivery_task_status'));
  });
  await test('account switch during context read discards collection and customer details',async()=>{
    const t=setup({switchAtContext:true});await assert.rejects(t.api.getDriverAssignedTasks('A'),/تغير الحساب/);
  });
  await test('valid transition re-reads scoped context before calling existing RPC',async()=>{
    const t=setup();await t.api.updateDeliveryTaskStatus('order','delivered','A');
    const contextIndex=t.calls.findIndex(call=>call.name==='get_c3_order_context');
    const writeIndex=t.calls.findIndex(call=>call.name==='update_delivery_task_status');
    assert(contextIndex>=0&&writeIndex>contextIndex);
    assert.deepEqual(JSON.parse(JSON.stringify(t.calls[writeIndex].args)),{target_customer_order:'order',next_status:'delivered'});
  });
  await test('zero is valid only when explicitly supplied by server; fractional SYP is preserved',()=>{
    assert.equal(model.collectionFromContext(rawContext(13000)).amount,13000);
    const zero=rawContext();zero.pricing.current={...zero.pricing.current,items_amount:0,delivery_fee:0,total:0};
    assert.equal(model.collectionFromContext(zero).amount,0);
    assert.equal(money.formatSyp(13300.50),new Intl.NumberFormat('ar-SY',{maximumFractionDigits:2}).format(13300.50)+' ل.س');
  });
  await test('UI wires retry/block states and immediate action lock; unknown collection cannot progress',()=>{
    const card=fs.readFileSync('src/components/driver/DeliveryTaskCard.tsx','utf8');
    const screen=fs.readFileSync('src/app/driver/orders.tsx','utf8');
    assert.match(card,/<FinancialAmount label="مبلغ التحصيل" amount=\{collection.amount\}/);
    assert.match(card,/disabled=\{disabled\}/);assert.match(card,/إعادة تحميل مبلغ التحصيل/);
    assert.match(screen,/collection=\{task.collection\}/);assert.match(screen,/onRetryCollection=/);
    assert.match(screen,/actionLock.current = true/);assert.match(screen,/readEpoch.current === epoch/);
    assert(!model.canProgressDriverCollection(undefined));assert(!model.canProgressDriverCollection({state:'unavailable'}));
  });
  await test('SQL permits assigned-driver pricing only and keeps review blocks; inspection is not JWT proof',()=>{
    const sql=fs.readFileSync('supabase/migrations/20261106000100_finance_c3_delivery_pricing.sql','utf8');
    const readable=sql.split('create function public.c3_pricing_readable')[1].split('$$;')[0];
    assert.match(readable,/driver_id=auth.uid\(\)/);assert.doesNotMatch(readable,/is_available_driver/);
    assert.match(sql,/if public.c3_pricing_readable\(order_value\) then/);
    assert.match(sql,/jsonb_build_object\('original',to_jsonb\(s\),'current',to_jsonb\(c\)\)/);
    for(const name of ['accept_delivery_task','update_delivery_task_status']) {
      const body=sql.split(`create function public.${name}`)[1].split('end $$;')[0];
      assert.match(body,/review_required/);assert(body.indexOf('review_required')<body.indexOf(`perform finance_private.c3_legacy_${name}`));
    }
  });
  console.log(`${count} driver collection checks passed (offline; PostgreSQL/JWT/device NOT RUN).`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
