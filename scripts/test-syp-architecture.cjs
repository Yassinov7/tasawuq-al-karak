// Offline assertions against real application modules and the cumulative SQL.
// These are NOT PostgreSQL execution tests. Run supabase/tests/syp_only_*.sql separately.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {load}=require('./syp-test-loader.cjs');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const money=load('src/lib/money.ts');
const ts=require('typescript');
// Inspect runtime syntax, not historical migrations or negative test fixtures.
function runtimeFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?runtimeFiles(path.join(dir,entry.name)):/\.tsx?$/.test(entry.name)?[path.join(dir,entry.name)]:[]);}
const oldArguments=new Set(['selected_currency','report_currency','payment_currency','target_currency','input_currency','credit_currency','remittance_currency','payout_currency']);
for(const file of runtimeFiles(path.join(root,'src'))){
 const text=fs.readFileSync(file,'utf8');const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 function visit(node){
  if(ts.isStringLiteralLike(node))assert(!/\bUSD\b|US\$|\$\s*\d|^\s*\$\s*$/i.test(node.text),`${file}: operational dollar literal`);
  if(ts.isPropertyAssignment(node)||ts.isPropertySignature(node))assert(!oldArguments.has(node.name.getText(source).replace(/["']/g,'')),`${file}: obsolete currency contract`);
  ts.forEachChild(node,visit);
 }visit(source);
 assert(!/CurrencyFilter|currencyFilter|exchange_rate|fx_rate|conversion_rate/.test(text),`${file}: old multi-currency abstraction`);
}
assert(money.formatSyp(1250.25).endsWith('ل.س'));
assert.throws(()=>money.formatSyp(NaN));
for(const bad of ['USD',null,'EUR',undefined])assert.throws(()=>money.requireSyp(bad));
for(const bad of ['USD','EUR',null,undefined])assert.throws(()=>money.formatSyp(10,bad),'Never relabel a foreign or unverified monetary document');
assert.equal(money.formatSypNumber(1250.25)+' '+String.fromCharCode(1604,46,1587),money.formatSyp(1250.25));
const offersModule=load('src/lib/customer-offers.ts');
assert.throws(()=>offersModule.calculateCustomerOffer({currency:'USD',items:[]}));
assert.throws(()=>load('src/lib/order-item-groups.ts').groupOrderItems([{currency:'USD',offer_snapshot:null}])) ;
assert.throws(()=>money.assertSypDocuments({rows:[{offer_snapshot:{currency:'USD',amount:10}}]}));
const sql=read('supabase/migrations/20261026000100_syp_only_architecture.sql');
assert(sql.includes("create type public.currency_code as enum ('SYP')"));
assert(sql.includes('drop type public.currency_code_previous;'));
assert.equal((sql.match(/\$\$/g) ?? []).length % 2,0,'Balanced SQL dollar quotes');
assert(!/\bend; \$;/.test(sql),'Do not truncate dollar-quote terminators');
assert(!/\bdelete from public\.(?:profiles|wallets|merchants|subscription_invoices)\b/i.test(sql));
assert(!/drop[^;]*cascade/i.test(sql));
for(const table of ['products','store_offers','subscription_plans','delivery_zones','wallets','merchant_credit_limits'])assert(sql.includes(`alter table public.${table} drop column currency;`));
for(const name of ['save_store_offer','record_wallet_transaction','record_subscription_payment','set_merchant_credit_limit','record_driver_cash_remittance','pay_driver_cash_credit','create_merchant_settlement_batch','admin_financial_report','admin_sales_revenue_report','merchant_financial_account']){
 const match=sql.match(new RegExp(`create or replace function public\\.${name}\\(([\\s\\S]*?)\\)\\s*returns`));
 assert(match,name);assert(!/currency/.test(match[1]),`${name}: obsolete argument`);
}
assert(sql.includes('and so.status=\'delivered\''),'Exclude cancelled/rejected children');
assert(sql.includes('coalesce(sum(sot.items_subtotal),0)+order_row.delivery_fee'));
assert(sql.includes('- coalesce(r.amount, 0) + coalesce(pc.amount, 0)'),'014 refunded-credit correction');
assert(sql.includes('payment allocations must equal the payment amount'));
assert(sql.includes('credit payout exceeds the available driver credit'));
assert(sql.includes('idempotency key was reused with different details'));
assert(sql.includes('security_invoker = true'));
const storage=new Map([['@tasawuq/cache/merchant-products:user',{currency:'USD',price:9}]]);
storage.set('@tasawuq/cache/syp-v1/merchant-products:user',{currency:'USD',price:9});
const cache=load('src/lib/local-cache.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async k=>storage.has(k)?JSON.stringify(storage.get(k)):null,setItem:async(k,v)=>storage.set(k,JSON.parse(v)),removeItem:async k=>storage.delete(k)}}});
const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return {data:'id',error:null}}};
const driver=load('src/lib/driver-cash.ts',{'@/lib/supabase':{supabase:client}});
const settlements=load('src/lib/merchant-settlements.ts',{'@/lib/supabase':{supabase:client}});
const search=load('src/lib/customer-search.ts');
const results=search.getVisibleCustomerSearchResults({stores:[],categories:[],products:[{categoryId:'x',price:20},{categoryId:'x',price:10}]},'products',null,'price-ascending');
assert.deepEqual(Array.from(results.products,p=>p.price),[10,20]);
const offers=load('src/lib/customer-offers.ts');
const discount=offers.calculateCustomerOffer({offer_type:'discount',discount_method:'percentage',discount_value:10,items:[{quantity:2,item_role:'discounted',product:{price:100}}]});
assert.equal(discount.finalTotal,180);
(async()=>{
 assert.equal(await cache.readLocalCache('merchant-products:user'),undefined,'Do not read pre-SYP cache');
 await assert.rejects(cache.writeLocalCache('merchant-products:user',{currency:'USD',price:9}));
 await cache.writeLocalCache('merchant-products:user',{price:9000});
 assert.equal((await cache.readLocalCache('merchant-products:user')).price,9000);
 assert(storage.has('@tasawuq/cache/merchant-products:user'),'Do not delete legacy data');
 const input={driverId:'driver',amount:10,key:'same-key'};
 await driver.recordDriverCashRemittance(input);await driver.payDriverCashCredit(input);
 const badCash=load('src/lib/driver-cash.ts',{'@/lib/supabase':{supabase:{from:()=>{
  const query={select:()=>query,eq:()=>query,order:()=>query,
   then:resolve=>Promise.resolve({data:[{currency:'USD',amount:10}],error:null}).then(resolve)};return query;
 }}}});
 await assert.rejects(badCash.getDriverCashAccount('driver'),'Reject foreign units before exposing custody balances');
 await settlements.createSettlement({merchantId:'merchant',ids:['entitlement'],idempotencyKey:'00000000-0000-4000-8000-000000000001'});
 for(const c of calls)assert(!Object.keys(c.args).some(k=>k.includes('currency')),`${c.name}: currency argument leaked`);
 const reports=load('src/lib/admin-financial-reports.ts',{'@/lib/supabase':{supabase:{rpc:async()=>({data:{rows:[],summary:[{currency:'USD',amount:9}],groups:[],options:[],count:0},error:null})}}});
 await assert.rejects(reports.loadFinancialReport('cash'),'Reject mismatched document unit');
 // Removing the currency filter must keep list pagination, status filters and
 // initial/read cache contracts aligned, without issuing currency predicates.
 const queries=[];
 const finance=load('src/lib/admin-finance.ts',{'@/lib/supabase':{supabase:{from:(table)=>{
  const query={table,filters:[],range:null};queries.push(query);
  const chain={select:()=>chain,order:()=>chain,eq:(...args)=>{query.filters.push(args);return chain;},
   in:()=>chain,range:(...args)=>{query.range=args;return chain;},
   then:(resolve)=>Promise.resolve({data:[],error:null,count:0}).then(resolve)};
  return chain;
 }}}});
 for(const [kind,filter]of [['Credit','enabled'],['Commission','due'],['Ledger','subscription_invoice']]){
  await finance[`getAdmin${kind}Page`]({filter,page:1,pageSize:20});
  const cached=finance[`getCachedAdmin${kind}Page`](filter,1,20);
  assert(cached,`${kind}: cache contract mismatch`);
  assert(finance[`isCachedAdmin${kind}PageFresh`](filter,1,20));
 }
 assert.equal(queries.filter(q=>q.range).length,3);
 for(const query of queries){assert(!query.filters.some(([key])=>key==='currency'));if(query.range)assert.deepEqual(query.range,[20,39]);}
 const positions=[
  {merchant_id:'m1',currency:'SYP',invoice_outstanding:120,payments_recorded:80,commissions_due:10,payments_allocated:50,unapplied_payment_balance:30,effective_exposure:130,credit_enabled:true,credit_limit:100},
  {merchant_id:'m2',currency:'SYP',invoice_outstanding:200,payments_recorded:90,commissions_due:20,payments_allocated:60,unapplied_payment_balance:30,effective_exposure:220,credit_enabled:false,credit_limit:0},
 ];
 const tables={merchant_financial_positions:positions,merchants:[{id:'m1',status:'accepted'},{id:'m2',status:'accepted'}],stores:[],subscription_invoices:[{merchant_id:'m1',currency:'SYP',status:'open'},{merchant_id:'m1',currency:'SYP',status:'partially_paid'}],merchant_subscriptions:[]};
 const totals=load('src/lib/admin-finance.ts',{'@/lib/supabase':{supabase:{from:table=>{
  let head=false;const filters=[];const chain={select:(_fields,options)=>{head=options?.head??false;return chain;},order:()=>chain,eq:(key,value)=>{assert.notEqual(key,'currency');filters.push([key,value]);return chain;},then:resolve=>Promise.resolve({data:head?null:(tables[table]??[]).filter(row=>filters.every(([k,v])=>row[k]===v)),count:table==='subscription_invoices'?2:3,error:null}).then(resolve)};return chain;
 }}}});
 const dashboard=await totals.loadAdminFinanceDashboard();
 await assert.rejects(totals.callFinanceRpc('record_subscription_payment',{payment_currency:'USD'}));
 await assert.rejects(totals.callFinanceRpc('record_subscription_payment',{currency:'USD'}));
 assert.equal(dashboard.currencies.length,1);assert.equal(dashboard.currencies[0].invoiceOutstanding,320);
 assert.equal(dashboard.currencies[0].commissionsDue,30);assert.equal(dashboard.actions.filter(x=>x.kind==='open_invoices').length,1);
 assert.equal(dashboard.actions.find(x=>x.kind==='open_invoices').count,2);
 assert.equal(dashboard.credit.currencies[0].effectiveExposureTotal,350);
 assert.equal((await totals.loadFinancialIndicators()).currencies[0].paymentsRecorded,170);
 console.log('PASS: SYP formatter/validation, cache namespace/isolation, real offer calculation/search sort, RPC contracts and SQL invariants. PostgreSQL execution NOT performed.');
})().catch(e=>{console.error(e);process.exitCode=1});
