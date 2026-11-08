// Explicit opt-in, pinned disposable numeric-loopback PostgreSQL ONLY.
// Applies no migrations; retains synthetic committed rows. Never use on Supabase.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {buildConfig,preflight}=require('./finance-c2-test-guard.cjs');
const {createPsql}=require('./test-finance-c2-postgres.cjs');
const {overlap}=require('./finance-c3-test-session.cjs');
function literal(v){const s=String(v);let tag;do{tag='$c4_'+randomUUID().replaceAll('-','')+'$';}while(s.includes(tag));return tag+s+tag;}
const marked=output=>JSON.parse(output.split(/\r?\n/).find(s=>s.startsWith('RESULT:')).slice(7));
async function main(){
 if(process.env.C4_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C4 disposable opt-in required; NO connection attempted');
 if(!path.isAbsolute(process.env.C2_TEST_MANIFEST||''))throw Error('Absolute pinned manifest required');
 const manifest=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8'));
 const config=buildConfig(process.env,manifest),f=config.fixtures;
 if(!fs.statSync(config.psqlPath).isFile())throw Error('Preinstalled psql required');
 const products=manifest.c3Products,other=manifest.c4OtherDriver;
 const uuid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'');
 if(!Array.isArray(products)||products.length!==3||new Set(products).size!==3||!products.every(uuid)||!uuid(other)||other===f.driver)throw Error('Three synthetic product IDs and a distinct second driver required');
 const sql=createPsql(config);await preflight(config,sql);
 const auth=id=>`do $$ begin perform set_config('request.jwt.claim.sub',${literal(id)},true); end $$;`;
 assert.equal(await sql(`begin read only; select count(distinct store_id)=3 from public.products where id in (${products.map(literal)}) and is_available; rollback;`),'t');
 assert.equal(await sql(`begin read only; ${auth(other)} select public.is_approved_driver(); rollback;`),'t');
 assert.equal(await sql(`begin read only; select not accept_new_orders from finance_private.c4_rollout where singleton; rollback;`),'t');
 async function seed(admit){
  const cart=marked(await sql(`begin; update finance_private.c4_rollout set accept_new_orders=${admit} where singleton;
   ${auth(f.admin)} select set_config('c4.zone',public.save_c3_delivery_zone(null,'C4 synthetic ${randomUUID()}',10000,3000,true,null)::text,true);
   ${auth(f.customer)} insert into public.customer_carts(customer_id) values(${literal(f.customer)}) on conflict(customer_id) do nothing;
   delete from public.customer_cart_items where cart_id=(select id from public.customer_carts where customer_id=${literal(f.customer)});
   delete from public.customer_cart_offer_selections where cart_id=(select id from public.customer_carts where customer_id=${literal(f.customer)});
   delete from public.customer_cart_store_notes where cart_id=(select id from public.customer_carts where customer_id=${literal(f.customer)});
   insert into public.customer_cart_items(cart_id,product_id,quantity) select c.id,p.id,p.minimum_quantity from public.customer_carts c cross join public.products p where c.customer_id=${literal(f.customer)} and p.id in (${products.map(literal)});
   select 'RESULT:'||jsonb_build_object('zone',current_setting('c4.zone'),'quote',public.quote_c3_cart(current_setting('c4.zone')::uuid,${literal(f.customer)}))::text; commit;`));
  const created=marked(await sql(`begin; ${auth(f.customer)} select 'RESULT:'||public.create_c3_order_from_cart('C4 synthetic','00000','Synthetic only',${literal(cart.zone)},'',${literal(randomUUID())},${literal(cart.quote.total)}::numeric,${literal(f.customer)},${literal(cart.quote.cart_signature)})::text; commit;`));
  assert.equal(created.state,'completed');const order=created.order_id;
  assert.equal(await sql(`select count(*) from public.delivery_tasks where customer_order_id=${literal(order)};`),'0');
  const children=JSON.parse(await sql(`select jsonb_agg(id order by id) from public.store_orders where customer_order_id=${literal(order)};`));assert.equal(children.length,3);
  // Rejected store reduces current price. Creation committed deferred snapshots first.
  await sql(`begin; ${auth(f.admin)} select public.update_store_order_status(${literal(children[2])},'rejected','synthetic rejected store'); commit;`);
  for(const state of ['preparing','ready_for_pickup'])for(const id of children.slice(0,2))await sql(`begin; ${auth(f.admin)} select public.update_store_order_status(${literal(id)},'${state}'); commit;`);
  const task=await sql(`select id from public.delivery_tasks where customer_order_id=${literal(order)};`);
  assert(uuid(task));assert.equal(await sql(`select count(*) from public.delivery_tasks where customer_order_id=${literal(order)};`),'1');
  await sql(`begin; ${auth(f.driver)} select public.accept_delivery_task(${literal(order)}); commit;`);
  return{order,task,children};
 }
 const legacy=await seed(false),c4=await seed(true),race=await seed(true);
 // Legacy first pickup while admission is ON must remain legacy.
 await sql(`begin; ${auth(f.driver)} select public.update_delivery_task_status(${literal(legacy.order)},'picked_up'); commit;`);
 await sql('begin; update finance_private.c4_rollout set accept_new_orders=false where singleton; commit;');
 assert.equal(await sql(`select mode from public.order_financial_modes where customer_order_id=${literal(legacy.order)};`),'legacy');
 assert.equal(await sql(`select mode from public.order_financial_modes where customer_order_id=${literal(c4.order)};`),'c4');
 // Real legacy completion after activation and deactivation: no global writer kill.
 await sql(`begin; ${auth(f.driver)} select public.update_delivery_task_status(${literal(legacy.order)},'delivered'); commit;`);
 assert.equal(await sql(`select count(*) from public.customer_order_cash_obligations where customer_order_id=${literal(legacy.order)};`),'1');
 const vars={test_token:config.token,admin_user:f.admin,driver_user:f.driver,other_driver:other,task_id:c4.task,child_a:c4.children[0],child_b:c4.children[1],foreign_child:f.otherChild,customer_user:f.customer,product_a:products[0],product_b:products[1]};
 const declarations=Object.entries(vars).map(([k,v])=>`\u005cset ${k} '${v}'`).join('\n');
 console.log(await sql(declarations+'\n'+fs.readFileSync(path.join(__dirname,'../supabase/tests/finance_c4_decimal_pickups.sql'),'utf8')));
 console.log(await sql(declarations+'\n'+fs.readFileSync(path.join(__dirname,'../supabase/tests/finance_c4_zero_delivery.sql'),'utf8')));
 const pickup=id=>`${auth(f.driver)} select public.confirm_c4_store_pickup(${literal(c4.task)},${literal(id)},${literal(f.driver)});`;
 // Competing driver and duplicate child must wait, then fail for the RIGHT reason.
 const racePickup=(id,actor)=>`${auth(actor)} select public.confirm_c4_store_pickup(${literal(race.task)},${literal(id)},${literal(actor)});`;
 await overlap(config,sql,racePickup(race.children[0],f.driver),racePickup(race.children[0],other),/assigned driver required/);
 await overlap(config,sql,racePickup(race.children[1],f.driver),racePickup(race.children[1],f.driver),/store pickup already confirmed/);
 const raceVersion=await sql(`select version from public.order_pricing_current where customer_order_id=${literal(race.order)};`);
 assert(/^\d+$/.test(raceVersion));const raceKey=randomUUID();
 const sameKeyCash=`${auth(f.driver)} select public.complete_delivery_and_collect_cash(${literal(race.task)},${literal(f.driver)},${literal(raceKey)},${raceVersion});`;
 await overlap(config,sql,sameKeyCash,sameKeyCash);
 assert.equal(await sql(`select count(*) from public.delivery_collection_results where task_id=${literal(race.task)};`),'1');
 // Observer must see the second backend blocked by the first before COMMIT.
 await overlap(config,sql,pickup(c4.children[0]),pickup(c4.children[1]));
 assert.equal(await sql(`select count(*) from public.delivery_store_pickups where task_id=${literal(c4.task)};`),'2');
 const version=await sql(`select version from public.order_pricing_current where customer_order_id=${literal(c4.order)};`);
 assert(/^\d+$/.test(version));const key=randomUUID();
 const collect=k=>`${auth(f.driver)} select public.complete_delivery_and_collect_cash(${literal(c4.task)},${literal(f.driver)},${literal(k)},${version});`;
 await overlap(config,sql,collect(key),collect(randomUUID()));
 // A different key and same-key retries in independent committed requests cannot repost.
 await sql(`begin; ${collect(key)} commit;`);
 await sql(`begin; ${collect(randomUUID())} commit;`);
 const recovered=JSON.parse(await sql(`begin read only; ${auth(f.driver)} select public.recover_delivery_collection(${literal(key)},${literal(f.driver)}); commit;`));
 assert.equal(recovered.state,'completed');
 assert.equal(await sql(`select count(*) from public.delivery_collection_results where task_id=${literal(c4.task)};`),'1');
 assert.equal(await sql(`select count(*) from public.financial_events where id in (select cash_event_id from public.delivery_collection_results where task_id=${literal(c4.task)} union all select delivery_event_id from public.delivery_collection_results where task_id=${literal(c4.task)});`),'2');
 assert.equal(await sql(`select count(*) from public.customer_order_cash_obligations where customer_order_id=${literal(c4.order)};`),'0');
 assert.equal(await sql(`select count(*) from public.journal_entries j join public.financial_events e on e.id=j.event_id join public.delivery_collection_results r on r.operation_id=e.operation_id where r.task_id=${literal(c4.task)} and j.status='posted';`),'2');
 assert.equal(await sql(`begin read only; ${auth(other)} select public.recover_delivery_collection(${literal(key)},${literal(other)})->>'state'; commit;`),'unknown');
 console.log('PASS real COMMIT, blocked overlap, immutable legacy/C4, receipts, cash replay, economic uniqueness. NOT a signed-JWT network test. Synthetic rows retained.');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
