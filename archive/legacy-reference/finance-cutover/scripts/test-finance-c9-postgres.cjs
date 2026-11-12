// MUTATING OWNER-RUN ONLY. Identity asserted on EVERY session; never migrations or remote URLs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {buildConfig}=require('./finance-c2-test-guard.cjs'),{createPsql}=require('./test-finance-c2-postgres.cjs'),{overlap}=require('./finance-c3-test-session.cjs');
function lit(v){const s=String(v);let t;do{t='$c9_'+randomUUID().replaceAll('-','')+'$';}while(s.includes(t));return t+s+t;}
function marked(s){const row=s.split(/\r?\n/).find(s=>s.startsWith('RESULT:'));if(!row)throw Error('Missing result');return JSON.parse(row.slice(7));}
async function main(){
 if(process.env.C9_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C9 disposable-test opt-in required; NO connection attempted');
 if(!path.isAbsolute(process.env.C2_TEST_MANIFEST||''))throw Error('Pinned absolute manifest required');
 const manifest=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8')),config=buildConfig(process.env,manifest),f=config.fixtures;
 if(!fs.statSync(config.psqlPath).isFile())throw Error('Preinstalled pinned psql required');
 const x=manifest.c9;
 for(const key of ['handover','subscriptionInvoice','subscriptionMerchant','wageTask','settlement'])if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x?.[key]||''))throw Error('Missing mandatory genuine C5-C8 fixtures: '+key);
 const sql=createPsql(config),auth=id=>`select set_config('request.jwt.claim.sub',${lit(id)},true);`,fixture={admin:f.admin,driver:f.driver,order:f.order};
 // Explicit baseline: no unfinished count sessions; source suites must prepare genuine synthetic records.
 const ready=await sql(`begin read only;select exists(select 1 from public.profiles where id=${lit(f.admin)} and role='admin') and exists(select 1 from public.profiles where id=${lit(f.driver)} and role='driver') and finance_private.c6_treasury_balance()>=0 and not (select enabled from finance_private.c9_control where singleton) and not exists(select 1 from public.treasury_control_documents d where kind='start' and not exists(select 1 from public.treasury_control_documents r where r.session_id=d.id and r.kind in ('count','cancel_count')));rollback;`);
 assert.equal(ready,'t','C9 baseline fixture preflight failed');
 await sql(`select set_config('c9.test_fixture',${lit(JSON.stringify(fixture))},false);\n`+fs.readFileSync('supabase/tests/finance_c9_treasury.sql','utf8'));
 // Real separate COMMITs, not two sequential source assertions. Observe actual mutex lock wait.
 await sql(`begin;insert into finance_private.c9_permissions(user_id,dashboard,ledger,count_cash,review) values(${lit(f.admin)},true,true,true,true) on conflict(user_id) do update set dashboard=true,ledger=true,count_cash=true,review=true;update finance_private.c9_control set enabled=true where singleton;commit;`);
 const call=(key,input)=>`${auth(f.admin)} select public.record_treasury_action(${lit(f.admin)},${lit(key)},${lit(JSON.stringify(input))}::jsonb);`;
 const recover=async key=>marked(await sql(`begin read only;${auth(f.admin)} select 'RESULT:'||public.recover_treasury_action(${lit(f.admin)},${lit(key)})::text;rollback;`));
 try{
  const a=randomUUID(),b=randomUUID();await overlap(config,sql,call(a,{kind:'start',reason:'overlap A'}),call(b,{kind:'start',reason:'overlap B'}));
  const first=await recover(a),second=await recover(b);assert.equal(first.state,'completed');assert.equal(second.code,'count_already_open');
  const amount=await sql('select finance_private.c6_treasury_balance()::text;'),ca=randomUUID(),cb=randomUUID();
  const input={kind:'count',session_id:first.id,amount,reason:'overlap count'};await overlap(config,sql,call(ca,input),call(cb,input));
  assert.equal((await recover(ca)).state,'completed');assert.equal((await recover(cb)).code,'already_completed');
  assert.equal(await sql(`select count(*) from public.treasury_control_documents where session_id=${lit(first.id)} and kind='count';`),'1');
  // Real C5/C8 inflows and C6/C7 outflows must be supplied; missing fixtures FAIL, never skip.
  await sql(`begin;
   insert into finance_private.c5_cash_receivers(user_id,enabled) values(${lit(f.admin)},true) on conflict(user_id) do update set enabled=true;
   update finance_private.c6_control set payout_enabled=true where singleton;
   insert into finance_private.c6_permissions(user_id,may_pay_wages) values(${lit(f.admin)},true) on conflict(user_id) do update set may_pay_wages=true;
   update finance_private.c7_control set payout_enabled=true where singleton;
   insert into finance_private.c7_permissions(user_id,may_pay) values(${lit(f.admin)},true) on conflict(user_id) do update set may_pay=true;
   update finance_private.c8_control set accept_operations=true where singleton;
   insert into finance_private.c8_permissions(user_id,collect) values(${lit(f.admin)},true) on conflict(user_id) do update set collect=true;
   commit;`);
  const sources=[
   {read:`select 'RESULT:'||jsonb_build_object('driver',driver_id,'amount',amount::text) from public.driver_cash_handover_requests where id=${lit(x.handover)} and not exists(select 1 from public.driver_cash_handover_attempts where request_id=${lit(x.handover)} and outcome='confirmed');`,write:(r,k)=>`select public.confirm_c5_cash_handover(${lit(x.handover)},${lit(r.driver)},${lit(f.admin)},${lit(k)},${lit(r.amount)}::numeric);`},
   {read:`select 'RESULT:'||jsonb_build_object('amount',amount::text) from public.subscription_billing_documents where id=${lit(x.subscriptionInvoice)} and merchant_id=${lit(x.subscriptionMerchant)} and not exists(select 1 from public.subscription_cash_receipts where invoice_id=${lit(x.subscriptionInvoice)});`,write:(r,k)=>`select public.collect_subscription_invoice(${lit(x.subscriptionInvoice)},${lit(x.subscriptionMerchant)},${lit(f.admin)},${lit(k)},${lit(r.amount)}::numeric,'C9 overlap cash receipt');`},
   {read:`select 'RESULT:'||jsonb_build_object('driver',driver_id,'amount',amount::text) from public.driver_wage_entitlements where task_id=${lit(x.wageTask)} and amount>0 and finance_private.c6_cash_remaining(task_id)=0 and not exists(select 1 from public.driver_wage_payment_items where task_id=${lit(x.wageTask)});`,write:(r,k)=>`select public.pay_c6_driver_wages(${lit(r.driver)},${lit(f.admin)},${lit(k)},array[${lit(x.wageTask)}::uuid],${lit(r.amount)}::numeric);`},
   {read:`select 'RESULT:'||jsonb_build_object('store',store_id,'amount',amount::text) from public.merchant_settlement_documents where id=${lit(x.settlement)} and not exists(select 1 from public.c7_merchant_settlement_payments where settlement_id=${lit(x.settlement)});`,write:(r,k)=>`select public.pay_c7_settlement(${lit(r.store)},${lit(x.settlement)},${lit(f.admin)},${lit(k)},${lit(r.amount)}::numeric);`}
  ];
  for(const source of sources){const r=marked(await sql(source.read)),key=randomUUID(),start=randomUUID();
   await overlap(config,sql,`${auth(f.admin)} ${source.write(r,key)}`,call(start,{kind:'start',reason:'count waits for committed treasury movement'}));
   const op=await sql(`select state='completed' and result->>'kind' in ('confirmed','receipt','payment') and exists(select 1 from public.financial_events e join public.journal_entries j on j.event_id=e.id and j.status='posted' where e.operation_id=financial_operations.id) from public.financial_operations where actor_id=${lit(f.admin)} and attempt_key=${lit(key)};`);assert.equal(op,'t','Source operation must actually post, not a discrepancy/rejection');
   const session=await recover(start);assert.equal(session.state,'completed');
   assert.equal(await sql(`select (cut->>'balance')::numeric=finance_private.c6_treasury_balance() from public.treasury_control_documents where id=${lit(session.id)};`),'t');
   await sql(`begin;${call(randomUUID(),{kind:'cancel_count',session_id:session.id,reason:'finish overlap fixture'})}commit;`);
  }
  process.stdout.write('C9 rollback SQL + COMMIT overlap checks PASS. Not a real HTTP JWT test.\n');
 }finally{await sql('begin;update finance_private.c9_control set enabled=false where singleton;update finance_private.c6_control set payout_enabled=false where singleton;update finance_private.c7_control set payout_enabled=false where singleton;update finance_private.c8_control set accept_operations=false where singleton;commit;');}
}
if(require.main===module)main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
module.exports={main};
