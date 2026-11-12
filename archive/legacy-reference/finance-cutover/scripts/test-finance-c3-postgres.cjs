// Opt-in LOCAL database only. No migration application, remote access or cleanup.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {buildConfig,preflight}=require('./finance-c2-test-guard.cjs');
const {createPsql}=require('./test-finance-c2-postgres.cjs');
const {overlap}=require('./finance-c3-test-session.cjs');
const literal=value=>{const text=String(value);let tag;do{tag='$c3_'+randomUUID().replaceAll('-','')+'$';}while(text.includes(tag));return tag+text+tag;};
const marked=output=>JSON.parse(output.split(/\r?\n/).find(line=>line.startsWith('RESULT:')).slice(7));
async function main(){
 if(process.env.C3_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C3 explicit disposable-test opt-in required; no connection attempted');
 if(!path.isAbsolute(process.env.C2_TEST_MANIFEST||''))throw Error('Absolute pinned local manifest required');
 const manifest=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8'));
 const config=buildConfig(process.env,manifest);
 if(!fs.statSync(config.psqlPath).isFile())throw Error('Preinstalled psql required');
 const products=manifest.c3Products;
 if(!Array.isArray(products)||products.length!==3||new Set(products).size!==3||products.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))throw Error('Three pinned synthetic product UUIDs required');
 const sql=createPsql(config),f=config.fixtures;
 await preflight(config,sql);
 assert.equal(await sql(`begin read only; select count(distinct store_id)=3 from public.products where id in (${products.map(literal).join(',')}) and is_available; rollback;`),'t');
 const journals=await sql('begin read only; select count(*) from public.journal_entries; rollback;');
 const vars={admin_user:f.admin,customer_user:f.customer,merchant_user:f.merchantOwner,driver_user:f.driver,product_a:products[0],product_b:products[1],product_c:products[2],legacy_order:f.order,legacy_task:f.task};
 const declarations=Object.entries(vars).map(([key,value])=>`\\set ${key} '${value}'`).join('\n');
 console.log(await sql(declarations+'\n'+fs.readFileSync(path.join(__dirname,'../supabase/tests/finance_c3_delivery_pricing.sql'),'utf8')));
 const auth=actor=>`select set_config('request.jwt.claim.sub',${literal(actor)},true);`;
 async function seedCart(){
  const output=await sql(`begin; ${auth(f.admin)}
   select set_config('c3.zone',public.save_c3_delivery_zone(null,'C3 concurrency ${randomUUID()}',10000,3000,true,null)::text,true);
   ${auth(f.customer)}
   insert into public.customer_carts(customer_id) values(${literal(f.customer)}) on conflict(customer_id) do nothing;
   delete from public.customer_cart_items where cart_id=(select id from public.customer_carts where customer_id=${literal(f.customer)});
   delete from public.customer_cart_offer_selections where cart_id=(select id from public.customer_carts where customer_id=${literal(f.customer)});
   delete from public.customer_cart_store_notes where cart_id=(select id from public.customer_carts where customer_id=${literal(f.customer)});
   insert into public.customer_cart_items(cart_id,product_id,quantity) select c.id,p.id,p.minimum_quantity from public.customer_carts c cross join public.products p where c.customer_id=${literal(f.customer)} and p.id in (${literal(products[0])},${literal(products[1])});
   select 'RESULT:'||jsonb_build_object('zone',current_setting('c3.zone'),'quote',public.quote_c3_cart(current_setting('c3.zone')::uuid,${literal(f.customer)}))::text;
   commit;`);
  return marked(output);
 }
 function createStatement(cart,key){return `${auth(f.customer)} select 'RESULT:'||public.create_c3_order_from_cart('C3 test','00000','synthetic',${literal(cart.zone)},'',${literal(key)},${literal(cart.quote.total)}::numeric,${literal(f.customer)},${literal(cart.quote.cart_signature)})::text;`;}
 async function seedOrder(preparation){
  const cart=await seedCart(),key=randomUUID();
  // Creation commits BEFORE merchant transitions, exercising deferred snapshots.
  const created=marked(await sql(`begin; ${createStatement(cart,key)} commit;`));
  assert.equal(created.state,'completed');const order=created.order_id;
  const children=JSON.parse(await sql(`select jsonb_agg(id order by id) from public.store_orders where customer_order_id=${literal(order)};`));
  if(preparation){const selected=preparation===1?[children[0]]:children;await sql(`begin; ${auth(f.admin)} ${selected.map(id=>`select public.update_store_order_status(${literal(id)},'preparing');`).join('\n')} commit;`);}
  return{order,children};
 }
 // Both sessions ACK identity; the observer MUST prove session B waits on A.
 const cart=await seedCart(),key=randomUUID();
 await overlap(config,sql,createStatement(cart,key),createStatement(cart,key));
 const replay=marked(await sql(`begin; ${createStatement(cart,key)} commit;`));
 assert.equal(replay.state,'completed');assert.equal(replay.replayed,true);
 assert.equal(await sql(`select count(*) from public.customer_order_requests where customer_id=${literal(f.customer)} and request_key=${literal(key)} and state='completed';`),'1');
 assert.equal(await sql(`select count(*) from public.delivery_tasks where customer_order_id=${literal(replay.order_id)};`),'0');
 console.log('PASS same-key concurrent creation: observed blocking, one real parent, no early DLV');
 const ready=id=>`${auth(f.admin)} select public.update_store_order_status(${literal(id)},'ready_for_pickup');`;
 const data=await seedOrder(2);
 await overlap(config,sql,ready(data.children[0]),ready(data.children[1]));
 await overlap(config,sql,ready(data.children[0]),ready(data.children[1]));
 async function oneTask(order){
  assert.equal(await sql(`select count(*) from public.delivery_tasks where customer_order_id=${literal(order)};`),'1');
  assert.equal(await sql(`select count(*) from public.financial_document_references r join public.delivery_tasks d on d.id=r.delivery_task_id where d.customer_order_id=${literal(order)} and r.kind='DLV';`),'1');
  assert.equal(await sql(`select count(*)=count(distinct order_sequence) from public.order_lifecycle_events where customer_order_id=${literal(order)};`),'t');
 }
 await oneTask(data.order);
 // Three separate request transactions, followed by reads AFTER commit.
 for(const statement of [`select public.accept_delivery_task(${literal(data.order)});`,`select public.update_delivery_task_status(${literal(data.order)},'picked_up');`,`select public.update_delivery_task_status(${literal(data.order)},'delivered');`])await sql(`begin; ${auth(f.driver)} ${statement} commit;`);
 assert.equal(await sql(`select count(*) from public.customer_order_cash_obligations where customer_order_id=${literal(data.order)};`),'1');
 assert.equal(await sql(`select count(*) from public.driver_delivery_fee_entitlements where customer_order_id=${literal(data.order)};`),'1');
 assert.equal(await sql(`select count(*) from public.merchant_order_entitlements e join public.store_orders s on s.id=e.store_order_id where s.customer_order_id=${literal(data.order)};`),'2');
 assert.equal(await sql(`select count(*) from public.store_order_commissions c join public.store_orders s on s.id=c.store_order_id where s.customer_order_id=${literal(data.order)} and c.status='due';`),'2');
 assert.equal(await sql(`select o.collectible_amount=c.total from public.customer_order_cash_obligations o join public.order_pricing_current c using(customer_order_id) where c.customer_order_id=${literal(data.order)};`),'t');
 console.log('PASS real commit boundaries: exactly one cash/driver entitlement, two merchant entitlements and commissions');
 const rejected=await seedOrder(1);
 await overlap(config,sql,ready(rejected.children[0]),`${auth(f.admin)} select public.update_store_order_status(${literal(rejected.children[1])},'rejected','concurrent rejection');`);
 await oneTask(rejected.order);
 assert.equal(await sql(`select delivery_fee=10000 and not review_required from public.order_pricing_current where customer_order_id=${literal(rejected.order)};`),'t');
 assert.equal(await sql(`select count(*) from public.order_pricing_revisions where customer_order_id=${literal(rejected.order)};`),'1');
 console.log('PASS overlapping readiness/rejection uses decreased fee before dispatch');
 const cancelled=await seedOrder(0);
 await overlap(config,sql,`${auth(f.customer)} select public.cancel_customer_order(${literal(cancelled.order)});`,`${auth(f.admin)} select public.update_store_order_status(${literal(cancelled.children[0])},'preparing');`,/ERROR:\s+invalid store order status transition/);
 assert.equal(await sql(`select count(*) from public.delivery_tasks where customer_order_id=${literal(cancelled.order)};`),'0');
 assert.equal(await sql(`select status='cancelled' from public.customer_orders where id=${literal(cancelled.order)};`),'t');
 const accepted=await seedOrder(0);
 await overlap(config,sql,`${auth(f.admin)} select public.update_store_order_status(${literal(accepted.children[0])},'preparing');`,`${auth(f.customer)} select public.cancel_customer_order(${literal(accepted.order)});`,/ERROR:\s+order cannot be cancelled after store preparation has started/);
 assert.equal(await sql(`select status<>'cancelled' from public.customer_orders where id=${literal(accepted.order)};`),'t');
 assert.equal(await sql('select count(*) from public.journal_entries;'),journals);
 console.log('PASS both cancellation/acceptance orderings; no C2 journal after commits');
 console.log('Committed synthetic rows retained ONLY in disposable local database; no cleanup performed.');
}
module.exports={main,literal};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
