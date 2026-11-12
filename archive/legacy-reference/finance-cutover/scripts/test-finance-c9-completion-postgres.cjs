// OWNER-RUN / MUTATING / PINNED NUMERIC LOOPBACK ONLY. No migrations, no user creation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {buildConfig}=require('./finance-c2-test-guard.cjs'),{createPsql}=require('./test-finance-c2-postgres.cjs'),{overlap}=require('./finance-c3-test-session.cjs');
function lit(v){let t;const s=String(v);do{t='$c9f_'+randomUUID().replaceAll('-','')+'$';}while(s.includes(t));return t+s+t;}
function marked(s){const row=s.split(/\r?\n/).find(x=>x.startsWith('RESULT:'));if(!row)throw Error('Required fixture/result missing, NOT skipped');return JSON.parse(row.slice(7));}
async function main(){
 if(process.env.C9_COMPLETION_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C9 completion opt-in required; NO connection attempted');
 if(!path.isAbsolute(process.env.C2_TEST_MANIFEST||''))throw Error('Absolute pinned manifest required');
 const manifest=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8')),config=buildConfig(process.env,manifest),f=config.fixtures,x=manifest.c9Completion;
 if(!fs.statSync(config.psqlPath).isFile())throw Error('Existing pinned psql required');
 for(const k of ['approver','owner'])if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x?.[k]||''))throw Error('Synthetic '+k+' required');
 if(new Set([f.admin,x.approver,x.owner,f.driver]).size!==4)throw Error('Three distinct admins and a driver required');
 const scenario=process.env.C9_TEST_SCENARIO;if(!['opening','operations'].includes(scenario))throw Error('Explicit scenario opening or operations required');
 const sql=createPsql(config),fixture={admin:f.admin,driver:f.driver,order:f.order,approver:x.approver,owner:x.owner};
 const auth=id=>`select set_config('request.jwt.claim.sub',${lit(id)},true);`;
 assert.equal(await sql(`begin read only;select (select count(*) from public.profiles where id in (${lit(f.admin)},${lit(x.approver)},${lit(x.owner)}) and role='admin')=3 and not (select enabled or opening_enabled from finance_private.c9_control where singleton) and not exists(select 1 from public.treasury_control_documents d where d.kind='start' and not exists(select 1 from public.treasury_control_documents r where r.session_id=d.id and r.kind in ('count','cancel_count')));rollback;`),'t','Fixture identities, default gates, or open counts failed');
 const file=scenario==='opening'?'supabase/tests/finance_c9_opening.sql':'supabase/tests/finance_c9_completion.sql';
 await sql(`select set_config('c9.completion_fixture',${lit(JSON.stringify(fixture))},false);\n`+fs.readFileSync(file,'utf8'));
 const requestSql=(actor,key,input)=>`${auth(actor)}select public.request_treasury_finance(${lit(actor)},${lit(key)},${lit(JSON.stringify(input))}::jsonb);`;
 const actionSql=(actor,key,id,action,confirmed=false)=>`${auth(actor)}select public.act_on_treasury_finance(${lit(actor)},${lit(key)},${lit(id)},${lit(action)},'isolated concurrent operation',${confirmed});`;
 const recover=async(actor,key)=>marked(await sql(`begin read only;${auth(actor)}select 'RESULT:'||public.recover_treasury_action(${lit(actor)},${lit(key)})::text;rollback;`));
 const request=async input=>{const k=randomUUID();await sql(`begin;${requestSql(f.admin,k,input)}commit;`);const r=await recover(f.admin,k);assert.equal(r.stage,'requested');return r;};
 try{
  await sql(`begin;update finance_private.c9_control set enabled=true where singleton;
   insert into finance_private.c9_permissions(user_id,dashboard,ledger,expense,pay,count_cash,review,adjust,opening,expense_approve,adjust_request,opening_approve)
   values(${lit(f.admin)},true,true,true,true,true,true,true,true,false,true,false),(${lit(x.approver)},true,true,false,true,false,true,true,false,true,false,false),(${lit(x.owner)},true,true,false,true,false,true,true,false,true,false,true)
   on conflict(user_id) do update set dashboard=excluded.dashboard,ledger=excluded.ledger,expense=excluded.expense,pay=excluded.pay,count_cash=excluded.count_cash,review=excluded.review,adjust=excluded.adjust,opening=excluded.opening,expense_approve=excluded.expense_approve,adjust_request=excluded.adjust_request,opening_approve=excluded.opening_approve;
   commit;`);
  if(scenario==='opening'){
   assert.equal(await sql('select not exists(select 1 from finance_private.c9_cash_lines) and not exists(select 1 from public.treasury_finance_postings);'),'t');
   await sql(`begin;insert into finance_private.c9_system_owners(user_id,reason) values(${lit(x.owner)},'isolated actual owner fixture') on conflict do nothing;update finance_private.c9_control set opening_enabled=true where singleton;commit;`);
   const cashDate=await sql("select (clock_timestamp() at time zone 'UTC')::date::text;"),input={kind:'opening',amount:'500.50',source:'isolated physical opening',cash_date:cashDate,reason:'explicit opening fixture'};
   const a=await request(input),b=await request(input),ka=randomUUID(),kb=randomUUID();
   await overlap(config,sql,actionSql(x.owner,ka,a.request_id,'approve',true),actionSql(x.owner,kb,b.request_id,'approve',true));
   assert.equal((await recover(x.owner,ka)).stage,'posted');assert.equal((await recover(x.owner,kb)).code,'opening_after_movements');
   assert.equal(await sql("select count(*)=1 from public.treasury_finance_postings where kind='opening';"),'t');
  }else{
   const source=manifest.c9;for(const k of ['handover','subscriptionInvoice','subscriptionMerchant','wageTask','settlement'])if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(source?.[k]||''))throw Error('Genuine C5-C8 fixture missing: '+k);
   await sql(`begin;insert into finance_private.c5_cash_receivers(user_id,enabled) values(${lit(f.admin)},true) on conflict(user_id) do update set enabled=true;
    update finance_private.c6_control set payout_enabled=true where singleton;insert into finance_private.c6_permissions(user_id,may_pay_wages) values(${lit(f.admin)},true) on conflict(user_id) do update set may_pay_wages=true;
    update finance_private.c7_control set payout_enabled=true where singleton;insert into finance_private.c7_permissions(user_id,may_pay) values(${lit(f.admin)},true) on conflict(user_id) do update set may_pay=true;
    update finance_private.c8_control set accept_operations=true where singleton;insert into finance_private.c8_permissions(user_id,collect) values(${lit(f.admin)},true) on conflict(user_id) do update set collect=true;commit;`);
   const countSql=(key,input)=>`${auth(f.admin)}select public.record_treasury_action(${lit(f.admin)},${lit(key)},${lit(JSON.stringify(input))}::jsonb);`;
   const inflows=[
    {read:`select 'RESULT:'||jsonb_build_object('driver',driver_id,'amount',amount::text) from public.driver_cash_handover_requests where id=${lit(source.handover)} and not exists(select 1 from public.driver_cash_handover_attempts where request_id=${lit(source.handover)} and outcome='confirmed');`,write:(r,k)=>`select public.confirm_c5_cash_handover(${lit(source.handover)},${lit(r.driver)},${lit(f.admin)},${lit(k)},${lit(r.amount)}::numeric);`},
    {read:`select 'RESULT:'||jsonb_build_object('amount',amount::text) from public.subscription_billing_documents where id=${lit(source.subscriptionInvoice)} and merchant_id=${lit(source.subscriptionMerchant)} and not exists(select 1 from public.subscription_cash_receipts where invoice_id=${lit(source.subscriptionInvoice)});`,write:(r,k)=>`select public.collect_subscription_invoice(${lit(source.subscriptionInvoice)},${lit(source.subscriptionMerchant)},${lit(f.admin)},${lit(k)},${lit(r.amount)}::numeric,'C9 overlap actual receipt');`}
   ];
   for(const s of inflows){const r=marked(await sql(s.read)),k=randomUUID(),ck=randomUUID();await overlap(config,sql,`${auth(f.admin)}${s.write(r,k)}`,countSql(ck,{kind:'start',reason:'count waits for real receipt'}));
    assert.equal(await sql(`select state='completed' and result->>'kind' in ('confirmed','receipt') from public.financial_operations where actor_id=${lit(f.admin)} and attempt_key=${lit(k)};`),'t');
    const count=await recover(f.admin,ck);assert.equal(count.state,'completed');assert.equal(await sql(`select (cut->>'balance')::numeric=finance_private.c6_treasury_balance() from public.treasury_control_documents where id=${lit(count.id)};`),'t');
    await sql(`begin;${countSql(randomUUID(),{kind:'cancel_count',session_id:count.id,reason:'finish inflow overlap'})}commit;`);
   }
   const approvedExpense=async amount=>{const r=await request({kind:'expense',amount,expense_type:'actual operating expense fixture',reason:'immutable requested amount'}),k=randomUUID();await sql(`begin;${actionSql(x.approver,k,r.request_id,'approve')}commit;`);assert.equal((await recover(x.approver,k)).stage,'approved');return r;};
   const outflows=[
    {read:`select 'RESULT:'||jsonb_build_object('driver',driver_id,'amount',amount::text) from public.driver_wage_entitlements where task_id=${lit(source.wageTask)} and amount>0 and finance_private.c6_cash_remaining(task_id)=0 and not exists(select 1 from public.driver_wage_payment_items where task_id=${lit(source.wageTask)});`,write:(r,k)=>`select public.pay_c6_driver_wages(${lit(r.driver)},${lit(f.admin)},${lit(k)},array[${lit(source.wageTask)}::uuid],${lit(r.amount)}::numeric);`},
    {read:`select 'RESULT:'||jsonb_build_object('store',store_id,'amount',amount::text) from public.merchant_settlement_documents where id=${lit(source.settlement)} and not exists(select 1 from public.c7_merchant_settlement_payments where settlement_id=${lit(source.settlement)});`,write:(r,k)=>`select public.pay_c7_settlement(${lit(r.store)},${lit(source.settlement)},${lit(f.admin)},${lit(k)},${lit(r.amount)}::numeric);`}
   ];
   for(const s of outflows){const r=marked(await sql(s.read)),before=await sql('select trim_scale(finance_private.c6_treasury_balance())::text;');assert.equal(await sql(`select ${lit(before)}::numeric>=${lit(r.amount)}::numeric;`),'t');
    const office=await approvedExpense(before),k=randomUUID(),pk=randomUUID();await overlap(config,sql,`${auth(f.admin)}${s.write(r,k)}`,actionSql(x.approver,pk,office.request_id,'pay'));
    assert.equal(await sql(`select state='completed' and result->>'kind'='payment' from public.financial_operations where actor_id=${lit(f.admin)} and attempt_key=${lit(k)};`),'t');assert.equal((await recover(x.approver,pk)).code,'insufficient_treasury');assert.equal(await sql('select finance_private.c6_treasury_balance()>=0;'),'t');
   }
   assert.equal(await sql('select finance_private.c6_treasury_balance()>=0.02;'),'t','Need remaining real fixture cash, not a skipped case');
   const expense=await approvedExpense('0.01'),ka=randomUUID(),kb=randomUUID();await overlap(config,sql,actionSql(x.approver,ka,expense.request_id,'pay'),actionSql(x.approver,kb,expense.request_id,'pay'));
   const paid=await recover(x.approver,ka);assert.equal(paid.stage,'posted');assert.equal((await recover(x.approver,kb)).posting_id,paid.posting_id);assert.equal(await sql(`select count(*) from public.treasury_finance_postings where request_id=${lit(expense.request_id)};`),'1');
   // Actual shortage correction races an expense; the earlier movement MUST invalidate its exact cut.
   const balance=await sql('select trim_scale(finance_private.c6_treasury_balance())::text;'),startKey=randomUUID();await sql(`begin;${countSql(startKey,{kind:'start',reason:'shortage competition'})}commit;`);const session=await recover(f.admin,startKey);
   const counted=await sql(`select trim_scale((${lit(balance)}::numeric-0.01))::text;`),countKey=randomUUID();await sql(`begin;${countSql(countKey,{kind:'count',session_id:session.id,amount:counted,reason:'actual isolated shortage'})}commit;`);const count=await recover(f.admin,countKey);
   const correction=await request({kind:'adjustment',count_id:count.id,reason:'exact cut shortage'}),office=await approvedExpense('0.01'),payKey=randomUUID(),adjustKey=randomUUID();
   await overlap(config,sql,actionSql(x.approver,payKey,office.request_id,'pay'),actionSql(x.approver,adjustKey,correction.request_id,'approve'));
   assert.equal((await recover(x.approver,payKey)).stage,'posted');assert.equal((await recover(x.approver,adjustKey)).code,'stale_count');
  }
  process.stdout.write(`C9 ${scenario} SQL + genuinely overlapping separate COMMIT checks PASS. HTTP JWT proof is separate.\n`);
 }finally{await sql('begin;update finance_private.c9_control set enabled=false,opening_enabled=false where singleton;update finance_private.c6_control set payout_enabled=false where singleton;update finance_private.c7_control set payout_enabled=false where singleton;update finance_private.c8_control set accept_operations=false where singleton;commit;');}
}
if(require.main===module)main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
module.exports={main};
