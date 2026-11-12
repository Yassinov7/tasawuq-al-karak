// MUTATING OWNER-RUN ONLY. Full pre-applied C2-C10, existing synthetic fixtures, pinned loopback.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {buildConfig}=require('./finance-c2-test-guard.cjs'),{createPsql}=require('./test-finance-c2-postgres.cjs'),{overlap}=require('./finance-c3-test-session.cjs');
function literal(v){const s=String(v);let tag;do{tag='$c10_'+randomUUID().replaceAll('-','')+'$';}while(s.includes(tag));return tag+s+tag;}
function marked(s){const row=s.split(/\r?\n/).find(x=>x.startsWith('RESULT:'));if(!row)throw Error('Required fixture/result missing, NOT skipped');return JSON.parse(row.slice(7));}
async function main(){
 if(process.env.C10_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C10 disposable opt-in required; NO connection attempted');
 if(!path.isAbsolute(process.env.C2_TEST_MANIFEST||''))throw Error('Absolute pinned manifest required');
 const manifest=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8')),config=buildConfig(process.env,manifest),f=config.fixtures,c8=manifest.c8,c9=manifest.c9Completion;
 const uuid=v=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v||'');
 if(!fs.statSync(config.psqlPath).isFile())throw Error('Pinned existing psql required');
 for(const key of ['merchant','owner','store','plan','product','expiredMerchant','expiredOwner'])if(!uuid(c8?.[key]))throw Error('Missing C8 synthetic fixture '+key);
 if(!uuid(c9?.approver)||!uuid(c9?.owner)||new Set([f.admin,c9.approver,c9.owner]).size!==3)throw Error('Three independent synthetic admins required');
 const otherProduct=manifest.c3Products?.[1];if(!uuid(otherProduct)||otherProduct===c8.product)throw Error('Distinct actual second-store product required');
 if(!uuid(manifest.c4OtherDriver)||manifest.c4OtherDriver===f.driver)throw Error('Existing distinct foreign driver fixture required');
 const sql=createPsql(config),auth=id=>`select set_config('request.jwt.claim.sub',${literal(id)},true);`;
 // No migration, reset, user creation, or balance seed. Fail before fixtures mutate if not pristine.
 assert.equal(await sql(`begin read only;select not exists(select 1 from public.financial_events) and not exists(select 1 from finance_private.c10_reconciliation_issues)
 and (select count(*) from public.profiles where id in (${literal(f.admin)},${literal(c9.approver)},${literal(c9.owner)}) and role='admin')=3
 and exists(select 1 from public.products a join public.products b on b.id=${literal(otherProduct)} and b.store_id<>a.store_id join public.stores sa on sa.id=a.store_id join public.stores sb on sb.id=b.store_id and sb.merchant_id<>sa.merchant_id where a.id=${literal(c8.product)} and a.store_id=${literal(c8.store)} and a.is_available and b.is_available)
 and exists(select 1 from public.profiles where id=${literal(manifest.c4OtherDriver)} and role='driver')
 and exists(select 1 from public.subscription_plans where id=${literal(c8.plan)} and is_active and commission_rate>=0 and commission_rate<100)
 and not (select enabled or opening_enabled from finance_private.c9_control where singleton);rollback;`),'t','Pristine ledger, identities, actual products/plan, or default gates invalid');
 const c8vars={test_token:config.token,admin_user:f.admin,customer_user:f.customer,driver_user:f.driver,c8_merchant:c8.merchant,c8_owner:c8.owner,c8_store:c8.store,c8_plan:c8.plan,c8_product:c8.product,expired_merchant:c8.expiredMerchant,expired_owner:c8.expiredOwner};
 const definitions=Object.entries(c8vars).map(([k,v])=>`\\set ${k} '${v}'`).join('\n');
 // Full original subscription suite includes real expired fixtures / scheduler / RLS / rollback.
 await sql(definitions+'\n'+fs.readFileSync('supabase/tests/finance_c8_subscriptions.sql','utf8'));
 const ownerFixture={admin:f.admin,driver:f.driver,approver:c9.approver,owner:c9.owner};
 await sql(`select set_config('c9.completion_fixture',${literal(JSON.stringify(ownerFixture))},false);\n`+fs.readFileSync('supabase/tests/finance_c9_opening.sql','utf8'));
 const fixture={token:config.token,admin:f.admin,approver:c9.approver,driver:f.driver,foreignDriver:manifest.c4OtherDriver,customer:f.customer,merchant:c8.merchant,owner:c8.owner,store:c8.store,plan:c8.plan,product:c8.product,otherProduct};
 const suite=fs.readFileSync('supabase/tests/finance_c10_integration.sql','utf8');if(!/rollback;\s*$/.test(suite))throw Error('Explicit terminal rollback boundary required');
 const prefix=`select set_config('c10.fixture',${literal(JSON.stringify(fixture))},false);\n`;
 await sql(prefix+suite); // Actual rollback and injected deferred-fault assertions.
 try{
  await sql(prefix+suite.replace(/rollback;\s*$/,'commit;')); // Actual successful COMMIT, NOT only rollback.
  // C4 left a second delivered, unpaid task; allocate its FULL custody with two overlapping C5 confirmations.
  const available=await sql(`select trim_scale((finance_private.c5_position(${literal(f.driver)})->>'available')::numeric)::text;`);
  const reqKey=randomUUID();await sql(`begin;${auth(f.driver)}select public.request_c5_cash_handover(${literal(f.driver)},${literal(reqKey)},${literal(available)}::numeric);commit;`);
  const recover=async(name,actor,key)=>marked(await sql(`begin read only;${auth(actor)}select 'RESULT:'||public.${name}(${literal(actor)},${literal(key)})::text;rollback;`));
  const request=await recover('recover_c5_cash_handover',f.driver,reqKey);assert.equal(request.kind,'request');
  const confirm=key=>`${auth(f.admin)}select public.confirm_c5_cash_handover(${literal(request.request_id)},${literal(f.driver)},${literal(f.admin)},${literal(key)},${literal(available)}::numeric);`;
  const ca=randomUUID(),cb=randomUUID();await overlap(config,sql,confirm(ca),confirm(cb));
  const receipt=await recover('recover_c5_cash_handover',f.admin,ca);assert.equal(receipt.kind,'confirmed');assert.equal((await recover('recover_c5_cash_handover',f.admin,cb)).reference,receipt.reference);
  const job=marked(await sql(`select 'RESULT:'||jsonb_build_object('task',w.task_id,'wage',w.amount::text,'sub',x.store_order_id,'store',x.store_id,'net',x.net::text)
  from public.driver_wage_entitlements w join public.merchant_delivery_positions x on x.task_id=w.task_id where w.driver_id=${literal(f.driver)} and w.amount>0 and x.net>0
  and finance_private.c6_cash_remaining(w.task_id)=0 and not exists(select 1 from public.driver_wage_payment_items i where i.task_id=w.task_id)
  and not exists(select 1 from public.merchant_settlement_document_items i where i.store_order_id=x.store_order_id) order by w.task_id,x.store_order_id limit 1;`));
  const setKey=randomUUID();await sql(`begin;${auth(f.admin)}select public.prepare_c7_settlement(${literal(job.store)},${literal(f.admin)},${literal(setKey)},array[${literal(job.sub)}::uuid],${literal(job.net)}::numeric);commit;`);
  const settlement=await recover('recover_c7_operation',f.admin,setKey);assert.equal(settlement.kind,'settlement');
  const wageKey=randomUUID(),merchantKey=randomUUID();
  const wage=`${auth(f.admin)}select public.pay_c6_driver_wages(${literal(f.driver)},${literal(f.admin)},${literal(wageKey)},array[${literal(job.task)}::uuid],${literal(job.wage)}::numeric);`;
  const pay=`${auth(f.admin)}select public.pay_c7_settlement(${literal(job.store)},${literal(settlement.settlement_id)},${literal(f.admin)},${literal(merchantKey)},${literal(job.net)}::numeric);`;
  await overlap(config,sql,wage,pay);assert.equal((await recover('recover_c6_operation',f.admin,wageKey)).kind,'payment');assert.equal((await recover('recover_c7_operation',f.admin,merchantKey)).kind,'payment');
  assert.equal(await sql(`select count(*) from public.driver_wage_payment_items where task_id=${literal(job.task)};`),'1');
  const report=marked(await sql(`begin read only;${auth(f.admin)}select 'RESULT:'||public.read_financial_reconciliation(${literal(f.admin)})::text;rollback;`));assert.equal(report.summary.errors,0);assert.equal(report.summary.warnings,0);
  console.log('C10 full SQL cycle + original C8 + opening rollback + successful COMMIT + observed cross-writer overlap PASS. Real JWT/device tests separate.');
 }finally{
  await sql('begin;update finance_private.c4_rollout set accept_new_orders=false;update finance_private.c5_rollout set accept_requests=false;update finance_private.c6_control set accept_tasks=false,payout_enabled=false;update finance_private.c7_control set accept_settlements=false,payout_enabled=false;update finance_private.c8_control set accept_operations=false,enforce_gate=false,scheduler_enabled=false;update finance_private.c9_control set enabled=false,opening_enabled=false;commit;');
 }
}
if(require.main===module)main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});module.exports={main};
