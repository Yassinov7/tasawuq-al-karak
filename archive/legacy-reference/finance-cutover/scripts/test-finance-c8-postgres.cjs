// MUTATING OWNER-RUN ONLY: pinned disposable numeric-loopback PostgreSQL. No migrations.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {buildConfig,fixtureNames}=require('./finance-c2-test-guard.cjs'),{createPsql}=require('./test-finance-c2-postgres.cjs'),{overlap}=require('./finance-c3-test-session.cjs');
function lit(v){const s=String(v);let t;do{t='$c8_'+randomUUID().replaceAll('-','')+'$';}while(s.includes(t));return t+s+t;}
function marked(v){const r=v.split(/\r?\n/).find(x=>x.startsWith('RESULT:'));if(!r)throw Error('Missing result');return JSON.parse(r.slice(7));}
async function main(){
 if(process.env.C8_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C8 disposable-test opt-in required; NO connection attempted');
 if(!path.isAbsolute(process.env.C2_TEST_MANIFEST||''))throw Error('Absolute pinned manifest required');
 const manifest=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8')),config=buildConfig(process.env,manifest),f=config.fixtures;
 if(!fs.statSync(config.psqlPath).isFile())throw Error('Preinstalled pinned psql required');
 const names=['merchant','owner','store','plan','product','expiredMerchant','expiredOwner','wageTask','settlement'];const fixtures=manifest.c8;
 if(!fixtures||names.some(k=>!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(fixtures[k]||'')))throw Error('Pinned C8 synthetic fixtures required');
 if(fixtures.merchant===fixtures.expiredMerchant||fixtures.owner===fixtures.expiredOwner)throw Error('C8 distinct merchant/owner fixtures required');
 const sql=createPsql(config),auth=id=>`do $$ begin perform set_config('request.jwt.claim.sub',${lit(id)},true);end $$;`;
 // Every psql connection verifies numeric loopback + OID + cluster identity + marker BEFORE any test statement.
 const marker=JSON.parse(await sql('begin read only;select jsonb_object_agg(name,id::text) from c2_test_guard.fixtures;rollback;'));for(const n of fixtureNames)assert.equal(marker[n],f[n]);
 assert.equal(await sql(`begin read only;${auth(f.admin)} select public.is_admin();rollback;`),'t');
 assert.equal(await sql('show default_transaction_isolation;'),'read committed');
 assert.equal(await sql('select not accept_operations and not enforce_gate and not scheduler_enabled from finance_private.c8_control where singleton;'),'t');
 assert.equal(await sql(`select count(*) from public.subscription_memberships where merchant_id in (${lit(fixtures.merchant)},${lit(fixtures.expiredMerchant)});`),'0');
 assert.equal(await sql(`select count(*) from public.merchant_subscriptions where merchant_id=${lit(fixtures.merchant)};`),'0');
 assert.equal(await sql(`select exists(select 1 from public.merchants m join public.stores s on s.merchant_id=m.id join public.products p on p.store_id=s.id where m.id=${lit(fixtures.merchant)} and m.owner_user_id=${lit(fixtures.owner)} and m.status='accepted' and s.id=${lit(fixtures.store)} and s.status='accepted' and p.id=${lit(fixtures.product)} and p.is_available);`),'t');
 assert.equal(await sql(`select exists(select 1 from public.merchant_subscriptions p join public.subscription_invoices i on i.subscription_id=p.id where p.merchant_id=${lit(fixtures.expiredMerchant)} and p.expires_at+interval '168 hours'<clock_timestamp() and i.status='paid') and not exists(select 1 from public.merchant_subscriptions where merchant_id=${lit(fixtures.expiredMerchant)} and expires_at+interval '168 hours'>clock_timestamp());`),'t');
 const variables={test_token:config.token,admin_user:f.admin,customer_user:f.customer,driver_user:f.driver,c8_merchant:fixtures.merchant,c8_owner:fixtures.owner,c8_store:fixtures.store,c8_plan:fixtures.plan,c8_product:fixtures.product,expired_merchant:fixtures.expiredMerchant,expired_owner:fixtures.expiredOwner};
 const defs=Object.entries(variables).map(([k,v])=>`\\set ${k} '${v}'`).join('\n');
 console.log(await sql(defs+'\n'+fs.readFileSync(path.join(__dirname,'../supabase/tests/finance_c8_subscriptions.sql'),'utf8')));
 await sql(`begin;update finance_private.c8_control set accept_operations=true,enforce_gate=true where singleton;
  insert into finance_private.c8_permissions(user_id,plans,issue,collect,suspend,resume,cancel) values(${lit(f.admin)},true,true,true,true,true,true);
  ${auth(f.admin)} select public.save_subscription_plan_version(${lit(f.admin)},${lit(randomUUID())},${lit(fixtures.plan)},'C8 committed plan','synthetic',100.50,1,true,null,'committed plan fixture');
  select public.enroll_subscription_account(${lit(fixtures.merchant)},${lit(fixtures.plan)},${lit(f.admin)},${lit(randomUUID())},'committed new membership');commit;`);
 const issue=(merchant,key)=>`${auth(f.admin)} select public.issue_subscription_invoice(${lit(merchant)},${lit(f.admin)},${lit(key)},'concurrent issue fixture');`;
 const ka=randomUUID(),kb=randomUUID();await overlap(config,sql,issue(fixtures.merchant,ka),issue(fixtures.merchant,kb));
 const recover=async key=>marked(await sql(`begin read only;${auth(f.admin)} select 'RESULT:'||public.recover_subscription_operation(${lit(f.admin)},${lit(key)})::text;rollback;`));
 const invoice=await recover(ka);assert.equal(invoice.kind,'invoice');assert.equal((await recover(kb)).id,invoice.id);
 const collect=(id,merchant,key)=>`${auth(f.admin)} select public.collect_subscription_invoice(${lit(id)},${lit(merchant)},${lit(f.admin)},${lit(key)},100.50,'committed counted cash');`;
 const ca=randomUUID(),cb=randomUUID();await overlap(config,sql,collect(invoice.id,fixtures.merchant,ca),collect(invoice.id,fixtures.merchant,cb));
 const received=await recover(ca);assert.equal(received.kind,'receipt');assert.equal((await recover(cb)).id,received.id);
 assert.equal(await sql(`select count(*) from public.subscription_cash_receipts where invoice_id=${lit(invoice.id)};`),'1');
 // A future period may be PAID once in advance. Its invoice competes with a C6 outflow.
 const next=marked(await sql(`begin;${auth(f.admin)} select 'RESULT:'||public.issue_subscription_invoice(${lit(fixtures.merchant)},${lit(f.admin)},${lit(randomUUID())},'one early renewal fixture')::text;commit;`));assert.equal(next.kind,'invoice');
 const wage=marked(await sql(`select 'RESULT:'||jsonb_build_object('driver',e.driver_id,'amount',e.amount::text) from public.driver_wage_entitlements e where e.task_id=${lit(fixtures.wageTask)} and e.amount>0 and finance_private.c6_cash_remaining(e.task_id)=0 and not exists(select 1 from public.driver_wage_payment_items i where i.task_id=e.task_id);`));
 const before=await sql('select finance_private.c6_treasury_balance()::text;');assert.equal(await sql(`select ${lit(before)}::numeric>=${lit(wage.amount)}::numeric;`),'t');
 await sql(`begin;update finance_private.c6_control set payout_enabled=true where singleton;insert into finance_private.c6_permissions(user_id,may_pay_wages) values(${lit(f.admin)},true) on conflict(user_id) do update set may_pay_wages=true;commit;`);
 const wageKey=randomUUID(),nextCashKey=randomUUID();await overlap(config,sql,`${auth(f.admin)} select public.pay_c6_driver_wages(${lit(wage.driver)},${lit(f.admin)},${lit(wageKey)},array[${lit(fixtures.wageTask)}::uuid],${lit(wage.amount)}::numeric);`,collect(next.id,fixtures.merchant,nextCashKey));
 assert.equal(await sql(`select state='completed' and result->>'kind'='payment' from public.financial_operations where actor_id=${lit(f.admin)} and attempt_key=${lit(wageKey)};`),'t');assert.equal((await recover(nextCashKey)).kind,'receipt');assert.equal(await sql(`select finance_private.c6_treasury_balance()=${lit(before)}::numeric-${lit(wage.amount)}::numeric+100.50;`),'t');
 // A distinct explicit expired cohort supplies another invoice for the C7/C8 overlap.
 await sql(`begin;${auth(f.admin)} select public.enroll_subscription_account(${lit(fixtures.expiredMerchant)},${lit(fixtures.plan)},${lit(f.admin)},${lit(randomUUID())},'explicit expired cohort fixture');commit;`);
 const late=marked(await sql(`begin;${auth(f.admin)} select 'RESULT:'||public.issue_subscription_invoice(${lit(fixtures.expiredMerchant)},${lit(f.admin)},${lit(randomUUID())},'late invoice fixture')::text;commit;`));
 const settlement=marked(await sql(`select 'RESULT:'||jsonb_build_object('store',s.store_id,'amount',s.amount::text) from public.merchant_settlement_documents s where s.id=${lit(fixtures.settlement)} and not exists(select 1 from public.c7_merchant_settlement_payments p where p.settlement_id=s.id);`));
 assert.equal(await sql(`select finance_private.c6_treasury_balance()>=${lit(settlement.amount)}::numeric;`),'t');
 await sql(`begin;update finance_private.c7_control set payout_enabled=true where singleton;insert into finance_private.c7_permissions(user_id,may_pay) values(${lit(f.admin)},true) on conflict(user_id) do update set may_pay=true;commit;`);
 const pk=randomUUID(),ck=randomUUID();await overlap(config,sql,`${auth(f.admin)} select public.pay_c7_settlement(${lit(settlement.store)},${lit(fixtures.settlement)},${lit(f.admin)},${lit(pk)},${lit(settlement.amount)}::numeric);`,collect(late.id,fixtures.expiredMerchant,ck));assert.equal(await sql(`select state='completed' and result->>'kind'='payment' from public.financial_operations where actor_id=${lit(f.admin)} and attempt_key=${lit(pk)};`),'t');assert.equal((await recover(ck)).kind,'receipt');
 assert.equal(await sql('select finance_private.c6_treasury_balance()>=0;'),'t');
 await sql('begin;update finance_private.c8_control set accept_operations=false,enforce_gate=false,scheduler_enabled=false where singleton;update finance_private.c6_control set payout_enabled=false where singleton;update finance_private.c7_control set payout_enabled=false where singleton;commit;');
 console.log('PASS actual COMMIT, observed overlapping invoice/receipt uniqueness and C6/C7 outflows vs C8 cash inflow. Signed network JWT NOT RUN. Synthetic rows retained; enrolled cohorts stay gated even when new intake closes.');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};
