// MUTATING test harness: preinstalled psql + pinned disposable LOCAL C4 test DB only.
// Applies no migrations. Run isolated C4 harness first. Keeps all synthetic rows.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {buildConfig,fixtureNames}=require('./finance-c2-test-guard.cjs');
const {createPsql}=require('./test-finance-c2-postgres.cjs');
const {overlap}=require('./finance-c3-test-session.cjs');
function literal(v){const text=String(v);let tag;do{tag='$c5_'+randomUUID().replaceAll('-','')+'$';}while(text.includes(tag));return tag+text+tag;}
async function main(){
 if(process.env.C5_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C5 explicit disposable-test opt-in required; no connection attempted');
 if(!path.isAbsolute(process.env.C2_TEST_MANIFEST||''))throw Error('Absolute pinned manifest required');
 const manifest=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8'));
 const config=buildConfig(process.env,manifest),f=config.fixtures;
 if(!fs.statSync(config.psqlPath).isFile())throw Error('Preinstalled psql required');
 const other=manifest.c4OtherDriver,products=manifest.c3Products;
 if(!Array.isArray(products)||products.length!==3||new Set(products).size!==3||products.some(id=>!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)))throw Error('Three pinned synthetic C3 products required');
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(other||'')||other===f.driver)throw Error('Pinned distinct approved synthetic driver required');
 const sql=createPsql(config),auth=id=>`do $$ begin perform set_config('request.jwt.claim.sub',${literal(id)},true); end $$;`;
 // createPsql prepends OID/system/token/loopback identity verification to EVERY connection.
 // C2's EMPTY-book preflight intentionally cannot apply after real C4 posting; verify fixtures without requiring an empty book.
 const fixtures=JSON.parse(await sql('begin read only; select jsonb_object_agg(name,id::text) from c2_test_guard.fixtures; rollback;'));
 for(const name of fixtureNames)assert.equal(fixtures[name],f[name]);
 assert.equal(await sql(`begin read only; ${auth(f.admin)} select public.is_admin(); rollback;`),'t');
 assert.equal(await sql(`begin read only; ${auth(f.driver)} select public.is_approved_driver(); rollback;`),'t');
 assert.equal(await sql(`begin read only; ${auth(other)} select public.is_approved_driver(); rollback;`),'t');
 assert.equal(await sql(`begin read only; select count(*)=0 from public.driver_cash_handover_requests; rollback;`),'t');
 assert.equal(await sql('begin read only; select not accept_requests from finance_private.c5_rollout where singleton; rollback;'),'t');
 assert.equal(await sql('show default_transaction_isolation;'),'read committed');
 const start=JSON.parse(await sql(`begin read only; select finance_private.c5_position(${literal(f.driver)}); rollback;`));
 assert.equal(start.ledger_requires_review,false);assert(BigInt(start.remaining.split('.')[0])>30n);
 assert.equal(await sql(`select count(*)>0 from public.delivery_collection_results where driver_id=${literal(f.driver)} and kind='cash_delivery';`),'t');
 const vars={test_token:config.token,driver_user:f.driver,admin_user:f.admin,other_driver:other,customer_user:f.customer,merchant_user:f.merchantOwner,product_a:products[0],product_b:products[1]};
 const declarations=Object.entries(vars).map(([key,value])=>`\u005cset ${key} '${value}'`).join('\n');
 assert.equal(await sql("select to_regprocedure('finance_private.c5_position(uuid)') is not null;"),'t');
 console.log(await sql(declarations+'\n'+fs.readFileSync(path.join(__dirname,'../supabase/tests/finance_c4_zero_delivery.sql'),'utf8')));
 console.log(await sql(declarations+'\n'+fs.readFileSync(path.join(__dirname,'../supabase/tests/finance_c5_driver_cash_handover.sql'),'utf8')));
 await assert.rejects(sql(`begin isolation level repeatable read; ${auth(f.driver)} select public.request_c5_cash_handover(${literal(f.driver)},${literal(randomUUID())},1); commit;`),/C5 writes require READ COMMITTED/);
 await sql(`begin; update finance_private.c5_rollout set accept_requests=true where singleton;
   insert into finance_private.c5_cash_receivers(user_id,enabled) values(${literal(f.admin)},true) on conflict(user_id) do update set enabled=true; commit;`);
 const a=randomUUID(),b=randomUUID(),amount=literal(start.available);
 const request=key=>`${auth(f.driver)} select public.request_c5_cash_handover(${literal(f.driver)},${literal(key)},${amount}::numeric);`;
 // Full available amount twice: B MUST visibly block on A, then be rejected, never overbook.
 await overlap(config,sql,request(a),request(b));
 assert.equal(await sql(`select state from public.financial_operations where actor_id=${literal(f.driver)} and attempt_key=${literal(b)};`),'rejected');
 const created=JSON.parse(await sql(`begin read only; ${auth(f.driver)} select public.recover_c5_cash_handover(${literal(f.driver)},${literal(a)}); commit;`));
 assert.equal(created.kind,'request');
 assert.equal(await sql('select count(*) from public.driver_cash_handover_requests;'),'1');
 // Disabling intake must NOT strand a reserved request.
 await sql('begin; update finance_private.c5_rollout set accept_requests=false where singleton; commit;');
 const c=randomUUID(),d=randomUUID();
 const confirm=key=>`${auth(f.admin)} select public.confirm_c5_cash_handover(${literal(created.request_id)},${literal(f.driver)},${literal(f.admin)},${literal(key)},${amount}::numeric);`;
 await overlap(config,sql,confirm(c),confirm(d));
 const recovered=JSON.parse(await sql(`begin read only; ${auth(f.admin)} select public.recover_c5_cash_handover(${literal(f.admin)},${literal(c)}); commit;`));
 assert.equal(recovered.kind,'confirmed');assert.match(recovered.reference,/^RCT-[0-9]{6,}$/);
 assert.equal(await sql(`select count(*) from public.driver_cash_handover_attempts where request_id=${literal(created.request_id)} and outcome='confirmed';`),'1');
 assert.equal(await sql(`select count(*) from public.financial_events e join public.driver_cash_handover_attempts h on h.operation_id=e.operation_id where h.request_id=${literal(created.request_id)} and e.event_type='office_cash_received';`),'1');
 const end=JSON.parse(await sql(`begin read only; select finance_private.c5_position(${literal(f.driver)}); rollback;`));
 assert.equal(Number(end.remaining),0);assert.equal(Number(end.reserved),0);assert.equal(end.collected,start.collected);
 // Legacy may still have custody; it must NEVER fund another C5 request.
 assert.equal(await sql(`select custody_remaining_amount>0 from public.driver_cash_custody_positions where driver_id=${literal(f.driver)};`),'t');
 await sql('begin; update finance_private.c5_rollout set accept_requests=true where singleton; commit;');
 const denied=JSON.parse(await sql(`begin; ${auth(f.driver)} select public.request_c5_cash_handover(${literal(f.driver)},${literal(randomUUID())},0.01); commit;`));
 assert.equal(denied.code,'insufficient_available');
 await sql('begin; update finance_private.c5_rollout set accept_requests=false where singleton; commit;');
 console.log('PASS observed overlapping reservations and confirmations, real COMMIT/deferred checks, recovery, single RCT and no legacy funding. Signed JWT/network tests NOT RUN. Synthetic rows retained.');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
