// MUTATING OWNER-RUN ONLY. NO migration application. Numeric loopback + pinned disposable identity.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {buildConfig}=require('./finance-c2-test-guard.cjs'),{createPsql}=require('./test-finance-c2-postgres.cjs'),{overlap}=require('./finance-c3-test-session.cjs');
function literal(value){const s=String(value);let tag;do{tag='$c11_'+randomUUID().replaceAll('-','')+'$';}while(s.includes(tag));return tag+s+tag;}
function once(source,needle,replacement){assert.equal(source.split(needle).length,2,'Expected one production test anchor: '+needle);return source.replace(needle,()=>replacement);}
function buildSuite(){
 let suite=fs.readFileSync('supabase/tests/finance_c10_integration.sql','utf8');
 suite=once(suite,'create function pg_temp.c10_assert',fs.readFileSync('supabase/tests/finance_c11_transition.sql','utf8')+'\ncreate function pg_temp.c10_assert');
 const anchor=" perform public.save_subscription_plan_version(a,gen_random_uuid(),(f->>'plan')::uuid,'C10 paid plan'";
 suite=once(suite,anchor,' perform pg_temp.c11_enable_fixture(a);\n'+anchor);
 assert.match(suite,/rollback;\s*$/);return suite.replace(/rollback;\s*$/,'select pg_temp.c11_verify();\nset constraints all immediate;\nrollback;');
}
async function main(){
 if(process.env.C11_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C11 disposable opt-in required; NO connection attempted');
 if(!path.isAbsolute(process.env.C2_TEST_MANIFEST||''))throw Error('Absolute pinned manifest required');
 const manifest=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8')),config=buildConfig(process.env,manifest),f=config.fixtures,c8=manifest.c8,c9=manifest.c9Completion,c11=manifest.c11;
 const uuid=value=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value||'');
 for(const value of [c8?.merchant,c8?.owner,c8?.store,c8?.product,c8?.plan,c8?.expiredMerchant,c9?.approver,manifest.c4OtherDriver,manifest.c3Products?.[1],c11?.paidMerchant,c11?.preC3Task])if(!uuid(value))throw Error('Missing actual synthetic C8/C9/C11 fixture');
 if(typeof c11.legacyCollectible!=='string'||!/^\d+(?:\.\d{1,2})?$/.test(c11.legacyCollectible))throw Error('Independent exact legacy fixture amount required');
 if(new Set([c8.merchant,c8.expiredMerchant,c11.paidMerchant]).size!==3||c9.approver===f.admin||manifest.c4OtherDriver===f.driver)throw Error('Distinct synthetic actors/cohorts required');
 if(!fs.statSync(config.psqlPath).isFile())throw Error('Pinned existing psql required');
 const sql=createPsql(config),suite=buildSuite();
 // Only the isolated, pristine fixture database may be mutated. Marker checked in EACH session.
 assert.equal(await sql(`begin read only;select not exists(select 1 from public.financial_events) and not exists(select 1 from public.subscription_memberships) and not exists(select 1 from finance_private.c11_gates where admit)
 and exists(select 1 from public.merchant_subscriptions where merchant_id=${literal(c11.paidMerchant)} and expires_at>clock_timestamp())
 and exists(select 1 from public.merchant_subscriptions where merchant_id=${literal(c8.expiredMerchant)} and expires_at+interval '168 hours'<=clock_timestamp())
 and not exists(select 1 from public.merchant_subscriptions where merchant_id=${literal(c8.expiredMerchant)} and expires_at+interval '168 hours'>clock_timestamp())
 and (select count(*) from public.profiles where id in (${literal(f.admin)},${literal(c9.approver)}) and role='admin')=2
 and exists(select 1 from public.delivery_tasks t where t.id=${literal(c11.preC3Task)} and t.driver_id=${literal(f.driver)} and t.status='picked_up' and not exists(select 1 from public.order_pricing_current p where p.customer_order_id=t.customer_order_id) and not finance_private.c4_is_order(t.customer_order_id))
 and exists(select 1 from public.products a join public.products b on b.id=${literal(manifest.c3Products[1])} and b.store_id<>a.store_id where a.id=${literal(c8.product)} and a.store_id=${literal(c8.store)} and a.is_available and b.is_available);rollback;`),'t','Pristine isolated C11 ledger and actual paid/expired fixtures required');
 const fixture={token:config.token,admin:f.admin,approver:c9.approver,driver:f.driver,foreignDriver:manifest.c4OtherDriver,customer:f.customer,merchant:c8.merchant,owner:c8.owner,store:c8.store,plan:c8.plan,product:c8.product,otherProduct:manifest.c3Products[1],expiredMerchant:c8.expiredMerchant,paidMerchant:c11.paidMerchant,preC3Task:c11.preC3Task,legacyCollectible:c11.legacyCollectible};
 const prefix=`select set_config('c10.fixture',${literal(JSON.stringify(fixture))},false);\n`;
 await sql(prefix+suite); // Full C10/C11 rollback + deferred failure tests.
 await sql(prefix+suite.replace(/rollback;\s*$/,'commit;')); // Real separate COMMIT boundary.
 const auth=`select set_config('request.jwt.claim.sub',${literal(f.admin)},true);`;
 // Observe a second controller BLOCKING on the same gates, then verify no lost update.
 const enable=`${auth}select public.set_finance_transition_gate(${literal(f.admin)},'delivery',true,'isolated overlapping gate controller');`;
 const disable=`${auth}select public.set_finance_transition_gate(${literal(f.admin)},'delivery',false,'isolated second gate controller');`;
 await overlap(config,sql,enable,disable);
 assert.equal(await sql("begin read only;select not admit from finance_private.c11_gates where path='delivery';rollback;"),'t');
 assert.equal(await sql("begin read only;select count(*)=0 from finance_private.c10_reconciliation_issues where severity='error';rollback;"),'t');
 console.log('C11 actual rollback/COMMIT, C10 cycles, transition/drain and observed controller overlap PASS; real JWT checks separate.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});module.exports={main,buildSuite};
