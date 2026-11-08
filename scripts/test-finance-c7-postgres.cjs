// OWNER-RUN MUTATING tests: pinned disposable LOCAL PostgreSQL only. Applies no migrations.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {buildConfig,fixtureNames}=require('./finance-c2-test-guard.cjs'),{createPsql}=require('./test-finance-c2-postgres.cjs'),{overlap}=require('./finance-c3-test-session.cjs');
function literal(v){const s=String(v);let tag;do{tag='$c7_'+randomUUID().replaceAll('-','')+'$';}while(s.includes(tag));return tag+s+tag;}
function marked(out){const r=out.split(/\r?\n/).find(s=>s.startsWith('RESULT:'));if(!r)throw Error('Missing result, not proof of success');return JSON.parse(r.slice(7));}
async function main(){
 if(process.env.C7_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C7 disposable-test opt-in required; NO connection attempted');
 if(!path.isAbsolute(process.env.C2_TEST_MANIFEST||''))throw Error('Absolute pinned manifest required');
 const manifest=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8')),config=buildConfig(process.env,manifest),f=config.fixtures;
 if(!fs.statSync(config.psqlPath).isFile())throw Error('Pinned preinstalled psql required');
 const products=manifest.c3Products,other=manifest.c4OtherDriver,uuid=v=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v||'');
 if(!Array.isArray(products)||products.length!==3||new Set(products).size!==3||!products.every(uuid)||!uuid(other)||other===f.driver)throw Error('Pinned distinct synthetic products/driver required');
 const sql=createPsql(config),auth=id=>`do $$ begin perform set_config('request.jwt.claim.sub',${literal(id)},true);end $$;`;
 // createPsql checks loopback, OID, cluster identifier and marker BEFORE SQL on EVERY connection.
 const fixtures=JSON.parse(await sql('begin read only;select jsonb_object_agg(name,id::text) from c2_test_guard.fixtures;rollback;'));for(const name of fixtureNames)assert.equal(fixtures[name],f[name]);
 assert.equal(await sql(`begin read only;${auth(f.admin)} select public.is_admin();rollback;`),'t');assert.equal(await sql(`begin read only;${auth(f.driver)} select public.is_approved_driver();rollback;`),'t');
 assert.equal(await sql('show default_transaction_isolation;'),'read committed');
 assert.equal(await sql('select not accept_settlements and not payout_enabled from finance_private.c7_control where singleton;'),'t');
 assert.equal(await sql('select count(*) from public.merchant_settlement_documents;'),'0');
 const variables={test_token:config.token,admin_user:f.admin,driver_user:f.driver,other_driver:other,customer_user:f.customer,merchant_user:f.merchantOwner,product_a:products[0],product_b:products[1]};
 const definitions=Object.entries(variables).map(([k,v])=>`\\set ${k} '${v}'`).join('\n');
 const suite=fs.readFileSync(path.join(__dirname,'../supabase/tests/finance_c7_merchant_settlements.sql'),'utf8');console.log(await sql(definitions+'\n'+suite));
 const helpers=suite.slice(0,suite.indexOf('create function pg_temp.c7_fault()'));
 await sql(`begin;update finance_private.c7_control set accept_settlements=true,payout_enabled=true where singleton;
  update finance_private.c6_control set accept_tasks=true,payout_enabled=true where singleton;update finance_private.c5_rollout set accept_requests=true where singleton;
  insert into finance_private.c7_permissions(user_id,may_prepare,may_pay) values(${literal(f.admin)},true,true) on conflict(user_id) do update set may_prepare=true,may_pay=true;
  insert into finance_private.c6_permissions(user_id,may_edit_policy,may_pay_wages) values(${literal(f.admin)},true,true) on conflict(user_id) do update set may_pay_wages=true;
  insert into finance_private.c5_cash_receivers(user_id,enabled) values(${literal(f.admin)},true) on conflict(user_id) do update set enabled=true;commit;`);
 async function seed(){
  const t=marked(await sql(definitions+'\n'+helpers+`select set_config('c7.single','yes',true),set_config('c6.fee','100',true);
   select 'RESULT:'||jsonb_build_object('task',pg_temp.c4z_order(false))::text;commit;`)).task;
  const version=await sql(`select p.version from public.order_pricing_current p join public.delivery_tasks d on d.customer_order_id=p.customer_order_id where d.id=${literal(t)};`);assert(/^\d+$/.test(version));
  await sql(`begin;${auth(f.driver)} select public.complete_delivery_and_collect_cash(${literal(t)},${literal(f.driver)},${literal(randomUUID())},${version});commit;`);
  const data=marked(await sql(`select 'RESULT:'||jsonb_build_object('task',x.task_id,'store',x.store_id,'sub',x.store_order_id,'net',x.net::text,'wage',w.amount::text) from public.merchant_delivery_positions x join public.driver_wage_entitlements w on w.task_id=x.task_id where x.task_id=${literal(t)};`));assert(uuid(data.sub)&&uuid(data.store));assert(!/^0(?:\.0+)?$/.test(data.net));assert(!/^0(?:\.0+)?$/.test(data.wage));return data;
 }
 async function fund(){
  const available=await sql(`select finance_private.c5_position(${literal(f.driver)})->>'available';`);
  const req=marked(await sql(`begin;${auth(f.driver)} select 'RESULT:'||public.request_c5_cash_handover(${literal(f.driver)},${literal(randomUUID())},${literal(available)}::numeric)::text;commit;`));assert.equal(req.kind,'request');
  await sql(`begin;${auth(f.admin)} select public.confirm_c5_cash_handover(${literal(req.request_id)},${literal(f.driver)},${literal(f.admin)},${literal(randomUUID())},${literal(available)}::numeric);commit;`);
 }
 const a=await seed();
 const prepare=(job,key)=>`${auth(f.admin)} select public.prepare_c7_settlement(${literal(job.store)},${literal(f.admin)},${literal(key)},array[${literal(job.sub)}::uuid],${literal(job.net)}::numeric);`;
 const ka=randomUUID(),kb=randomUUID();await overlap(config,sql,prepare(a,ka),prepare(a,kb));
 const setA=marked(await sql(`begin read only;${auth(f.admin)} select 'RESULT:'||public.recover_c7_operation(${literal(f.admin)},${literal(ka)})::text;rollback;`));assert.equal(setA.kind,'settlement');
 assert.equal(await sql(`select state from public.financial_operations where actor_id=${literal(f.admin)} and attempt_key=${literal(kb)};`),'rejected');
 await fund();
 const pay=(job,set,key)=>`${auth(f.admin)} select public.pay_c7_settlement(${literal(job.store)},${literal(set)},${literal(f.admin)},${literal(key)},${literal(job.net)}::numeric);`;
 const pa=randomUUID(),pb=randomUUID();await overlap(config,sql,pay(a,setA.settlement_id,pa),pay(a,setA.settlement_id,pb));
 const recovered=marked(await sql(`begin read only;${auth(f.admin)} select 'RESULT:'||public.recover_c7_operation(${literal(f.admin)},${literal(pa)})::text;rollback;`));assert.equal(recovered.kind,'payment');assert.match(recovered.reference,/^PAY-[0-9]{6,}$/);
 assert.equal(await sql(`select count(*) from public.c7_merchant_settlement_payments where settlement_id=${literal(setA.settlement_id)};`),'1');
 const b=await seed();await fund();const setB=marked(await sql(`begin;${auth(f.admin)} select 'RESULT:'||public.prepare_c7_settlement(${literal(b.store)},${literal(f.admin)},${literal(randomUUID())},array[${literal(b.sub)}::uuid],${literal(b.net)}::numeric)::text;commit;`));assert.equal(setB.kind,'settlement');
 // Consume synthetic treasury down to max(wage,net). Enough for either, NOT both.
 await sql(`begin;${auth(f.admin)} do $$ declare op public.financial_operations%rowtype;ref uuid;evt uuid;expense uuid;treasury uuid;amount numeric;begin
  amount:=finance_private.c6_treasury_balance()-greatest(${literal(b.net)}::numeric,${literal(b.wage)}::numeric);
  if amount<=0 then raise exception 'positive synthetic treasury expense required';end if;
  op:=finance_private.begin_operation('c7_test_expense',gen_random_uuid(),jsonb_build_object('isolated','competing C6 C7'));
  select id into strict ref from public.financial_document_references where kind='DLV' and document_id=${literal(b.task)};
  evt:=finance_private.record_financial_event(ref,'isolated_treasury_expense',op.id);expense:=finance_private.c4_account('driver_earnings_expense');treasury:=finance_private.c4_account('treasury_cash');
  perform finance_private.post_journal(evt,jsonb_build_array(jsonb_build_object('account_id',expense,'side','debit','amount',amount),jsonb_build_object('account_id',treasury,'side','credit','amount',amount)),'isolated concurrency expense only');
  perform finance_private.complete_operation(op.id,jsonb_build_object('state','completed'));end $$;set constraints all immediate;commit;`);
 const wk=randomUUID(),mk=randomUUID();
 const wage=`${auth(f.admin)} select public.pay_c6_driver_wages(${literal(f.driver)},${literal(f.admin)},${literal(wk)},array[${literal(b.task)}::uuid],${literal(b.wage)}::numeric);`;
 await overlap(config,sql,wage,pay(b,setB.settlement_id,mk));
 const denied=marked(await sql(`begin read only;${auth(f.admin)} select 'RESULT:'||public.recover_c7_operation(${literal(f.admin)},${literal(mk)})::text;rollback;`));assert.equal(denied.code,'insufficient_treasury');
 assert.equal(await sql(`select count(*) from public.c7_merchant_settlement_payments where settlement_id=${literal(setB.settlement_id)};`),'0');
 assert.equal(await sql('select finance_private.c6_treasury_balance()>=0;'),'t');
 await sql('begin;update finance_private.c7_control set accept_settlements=false,payout_enabled=false where singleton;update finance_private.c6_control set accept_tasks=false,payout_enabled=false where singleton;update finance_private.c5_rollout set accept_requests=false where singleton;update finance_private.c4_rollout set accept_new_orders=false where singleton;commit;');
 console.log('PASS real COMMIT + observed overlapping SET preparation, PAY replay and competing C6/C7 outflows; no double payment/treasury overdraft. Signed network JWT NOT RUN. Synthetic records retained.');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};
