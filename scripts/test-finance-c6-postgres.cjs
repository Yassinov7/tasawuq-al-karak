// MUTATING, owner-run only. No migration application; pinned disposable LOOPBACK DB only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {buildConfig,fixtureNames}=require('./finance-c2-test-guard.cjs');
const {createPsql}=require('./test-finance-c2-postgres.cjs');
const {overlap}=require('./finance-c3-test-session.cjs');
function literal(v){const s=String(v);let tag;do{tag='$c6_'+randomUUID().replaceAll('-','')+'$';}while(s.includes(tag));return tag+s+tag;}
function marked(s){const r=s.split(/\r?\n/).find(s=>s.startsWith('RESULT:'));if(!r)throw Error('Missing result, never infer success');return JSON.parse(r.slice(7));}
async function main(){
 if(process.env.C6_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C6 disposable-test opt-in required; NO connection attempted');
 if(!path.isAbsolute(process.env.C2_TEST_MANIFEST||''))throw Error('Absolute pinned test manifest required');
 const manifest=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8')),config=buildConfig(process.env,manifest),f=config.fixtures;
 if(!fs.statSync(config.psqlPath).isFile())throw Error('Preinstalled pinned psql required');
 const products=manifest.c3Products,other=manifest.c4OtherDriver;
 const valid=id=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id||'');
 if(!Array.isArray(products)||products.length!==3||new Set(products).size!==3||!products.every(valid)||!valid(other)||other===f.driver)throw Error('Distinct synthetic products and approved other driver required');
 const sql=createPsql(config),auth=id=>`do $$ begin perform set_config('request.jwt.claim.sub',${literal(id)},true);end $$;`;
 // Identity assertion on EVERY connection: database OID, cluster ID, marker token, loopback.
 const fixtures=JSON.parse(await sql('begin read only; select jsonb_object_agg(name,id::text) from c2_test_guard.fixtures;rollback;'));
 for(const name of fixtureNames)assert.equal(fixtures[name],f[name]);
 assert.equal(await sql(`begin read only;${auth(f.admin)} select public.is_admin();rollback;`),'t');
 assert.equal(await sql(`begin read only;${auth(f.driver)} select public.is_approved_driver();rollback;`),'t');
 assert.equal(await sql(`begin read only;${auth(other)} select public.is_approved_driver();rollback;`),'t');
 assert.equal(await sql('show default_transaction_isolation;'),'read committed');
 assert.equal(await sql('select not accept_tasks and not payout_enabled from finance_private.c6_control where singleton;'),'t');
 assert.equal(await sql('select count(*) from public.driver_wage_entitlements;'),'0');
 assert.equal(await sql('select count(*) from public.driver_wage_payments;'),'0');
 const pos=JSON.parse(await sql(`select finance_private.c5_position(${literal(f.driver)});`));
 assert.equal(pos.ledger_requires_review,false);assert.equal(Number(pos.remaining),0);assert.equal(Number(pos.reserved),0);
 const variables={test_token:config.token,admin_user:f.admin,driver_user:f.driver,other_driver:other,customer_user:f.customer,product_a:products[0],product_b:products[1]};
 const declarations=Object.entries(variables).map(([k,v])=>`\\set ${k} '${v}'`).join('\n');
 const suite=fs.readFileSync(path.join(__dirname,'../supabase/tests/finance_c6_driver_wages.sql'),'utf8');
 console.log(await sql(declarations+'\n'+suite)); // rollback suite, deferred assertions inside SQL.
 // Real separate COMMIT boundaries, using real C3/C4 creation (never hand-insert fake wage rows).
 const helpers=suite.slice(0,suite.indexOf('create function pg_temp.c6_fail()'));
 await sql(`begin;update finance_private.c6_control set accept_tasks=true,payout_enabled=true where singleton;
  update finance_private.c5_rollout set accept_requests=true where singleton;
  insert into finance_private.c6_permissions(user_id,may_edit_policy,may_pay_wages) values(${literal(f.admin)},true,true) on conflict(user_id) do update set may_edit_policy=true,may_pay_wages=true;
  insert into finance_private.c5_cash_receivers(user_id,enabled) values(${literal(f.admin)},true) on conflict(user_id) do update set enabled=true;commit;`);
 async function seed(driver=f.driver){const defs=Object.entries({...variables,driver_user:driver}).map(([k,v])=>`\\set ${k} '${v}'`).join('\n');return marked(await sql(defs+'\n'+helpers+`
  select set_config('c6.fee','100',true);
  select 'RESULT:'||jsonb_build_object('task',pg_temp.c4z_order(true))::text;commit;`)).task;}
 const a=await seed(),b=await seed();
 assert(valid(a)&&valid(b)&&a!==b);
 const version=task=>sql(`select p.version from public.delivery_tasks d join public.order_pricing_current p on p.customer_order_id=d.customer_order_id where d.id=${literal(task)};`);
 const av=await version(a),bv=await version(b);
 const complete=(task,v,key)=>`${auth(f.driver)} select public.complete_delivery_and_collect_cash(${literal(task)},${literal(f.driver)},${literal(key)},${v});`;
 // A & B truly overlap: second waits on same task, then recovers without double accrual.
 await overlap(config,sql,complete(a,av,randomUUID()),complete(a,av,randomUUID()));
 await sql(`begin;${complete(b,bv,randomUUID())}commit;`);
 assert.equal(await sql(`select count(*) from public.driver_wage_entitlements where task_id in (${literal(a)},${literal(b)});`),'2');
 assert.equal(await sql(`select count(*) from public.financial_events e join public.financial_document_references f on f.id=e.source_reference_id where f.document_id=${literal(a)} and e.event_type='driver_wage_accrued';`),'1');
 // Two real committed RCTs allocate FIFO. Reservations before confirmation are not settlement.
 const request=async amount=>marked(await sql(`begin;${auth(f.driver)} select 'RESULT:'||public.request_c5_cash_handover(${literal(f.driver)},${literal(randomUUID())},${amount})::text;commit;`));
 const confirm=(req,key,amount)=>`${auth(f.admin)} select public.confirm_c5_cash_handover(${literal(req.request_id)},${literal(f.driver)},${literal(f.admin)},${literal(key)},${amount});`;
 const r1=await request(100),r2=await request(100);assert.equal(r1.kind,'request');assert.equal(r2.kind,'request');
 assert.equal(Number(await sql(`select finance_private.c6_cash_remaining(${literal(a)});`)),100);
 await overlap(config,sql,confirm(r1,randomUUID(),100),confirm(r2,randomUUID(),100));
 assert.equal(Number(await sql(`select finance_private.c6_cash_remaining(${literal(a)})+finance_private.c6_cash_remaining(${literal(b)});`)),0);
 // Lost response recovered through durable server operation. Different keys cannot pay same DLV twice.
 const payKey=randomUUID(),otherKey=randomUUID();
 const pay=(task,key,driver=f.driver)=>`${auth(f.admin)} select public.pay_c6_driver_wages(${literal(driver)},${literal(f.admin)},${literal(key)},array[${literal(task)}::uuid],70);`;
 const before=await sql(`select finance_private.c5_position(${literal(f.driver)})->>'remaining';`);
 await overlap(config,sql,pay(a,payKey),pay(a,otherKey));
 const recovered=marked(await sql(`begin read only;${auth(f.admin)} select 'RESULT:'||public.recover_c6_operation(${literal(f.admin)},${literal(payKey)})::text;rollback;`));
 assert.equal(recovered.kind,'payment');assert.match(recovered.reference,/^PAY-[0-9]{6,}$/);
 assert.equal(await sql(`select state from public.financial_operations where actor_id=${literal(f.admin)} and attempt_key=${literal(otherKey)};`),'rejected');
 assert.equal(await sql(`select count(*) from public.driver_wage_payment_items where task_id=${literal(a)};`),'1');
 assert.equal(await sql(`select finance_private.c5_position(${literal(f.driver)})->>'remaining';`),before);
 // Different driver profiles must still serialize on the SAME treasury mutex.
 const c=await seed(other),d=await seed(f.driver),cv=await version(c),dv=await version(d);
 const finishOther=`${auth(other)} select public.complete_delivery_and_collect_cash(${literal(c)},${literal(other)},${literal(randomUUID())},${cv});`;
 await sql(`begin;${finishOther}commit;`);await sql(`begin;${complete(d,dv,randomUUID())}commit;`);
 for(const driver of [other,f.driver]){
  const req=marked(await sql(`begin;${auth(driver)} select 'RESULT:'||public.request_c5_cash_handover(${literal(driver)},${literal(randomUUID())},100)::text;commit;`));
  assert.equal(req.kind,'request');
  await sql(`begin;${auth(f.admin)} select public.confirm_c5_cash_handover(${literal(req.request_id)},${literal(driver)},${literal(f.admin)},${literal(randomUUID())},100);commit;`);
 }
 // A valid synthetic expense makes only ONE wage affordable. Dedicated local DB only.
 await sql(`begin;${auth(f.admin)} do $$ declare op public.financial_operations%rowtype;ref uuid;evt uuid;expense uuid;treasury uuid;amount numeric;begin
  amount:=finance_private.c6_treasury_balance()-70;if amount<=0 then raise exception 'treasury fixture not funded';end if;
  op:=finance_private.begin_operation('c6_test_expense',gen_random_uuid(),jsonb_build_object('isolated','treasury competition'));
  select id into strict ref from public.financial_document_references where kind='DLV' and document_id=${literal(c)};
  evt:=finance_private.record_financial_event(ref,'isolated_treasury_expense',op.id);
  expense:=finance_private.c4_account('driver_earnings_expense');treasury:=finance_private.c4_account('treasury_cash');
  perform finance_private.post_journal(evt,jsonb_build_array(jsonb_build_object('account_id',expense,'side','debit','amount',amount),jsonb_build_object('account_id',treasury,'side','credit','amount',amount)),'isolated expense for concurrency only');
  perform finance_private.complete_operation(op.id,jsonb_build_object('state','completed'));end $$;set constraints all immediate;commit;`);
 const firstKey=randomUUID(),lastKey=randomUUID();
 await overlap(config,sql,pay(c,firstKey,other),pay(d,lastKey,f.driver));
 const failed=marked(await sql(`begin read only;${auth(f.admin)} select 'RESULT:'||public.recover_c6_operation(${literal(f.admin)},${literal(lastKey)})::text;rollback;`));
 assert.equal(failed.code,'insufficient_treasury');assert.equal(Number(await sql('select finance_private.c6_treasury_balance();')),0);
 assert.equal(await sql(`select count(*) from public.driver_wage_payment_items where task_id in (${literal(c)},${literal(d)});`),'1');
 await sql('begin;update finance_private.c6_control set accept_tasks=false,payout_enabled=false where singleton;update finance_private.c5_rollout set accept_requests=false where singleton;update finance_private.c4_rollout set accept_new_orders=false where singleton;commit;');
 console.log('PASS actual COMMIT + observed overlapping C4 accrual, FIFO RCTs and payout recovery/single PAY. SQL role tests ran in rollback suite; signed JWT/network NOT RUN. Synthetic rows retained.');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
