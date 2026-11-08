// Offline contracts only. Never connects to Supabase or changes financial data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadModule(file, requireMock = () => { throw new Error('Unexpected runtime dependency'); }) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: requireMock, Date });
  return exports;
}
const calls = [];
let response;
const client = { rpc: async (name, args) => { calls.push({ name, args }); return typeof response === "function" ? response(args.section_name) : response; } };
const { loadMerchantFinancialAccount } = loadModule('src/lib/merchant-financial-account.ts', (name) => {
  if (name.startsWith('@/lib/') && name !== '@/lib/supabase') return require('./financial-test-loader.cjs').load(`src/lib/${name.slice(6)}.ts`, { '@/lib/supabase': { supabase: client } });
  assert.equal(name, '@/lib/supabase'); return { supabase: client };
});
const { resolveNotificationDestination } = loadModule('src/lib/notification-routing.ts');
const recordId = '11111111-1111-4111-8111-111111111111';
const sale={currency:'SYP',store_order_id:recordId,order_number:'123',delivered_at:'2026-10-01T00:00:00Z',gross_items_amount:50000,commission_amount_at_delivery:5000,initial_net_entitlement_amount:45000,adjustment_amount:0,current_entitlement_amount:45000,paid_amount:0,remaining_amount:45000,unbatched_amount:45000,settlement_status:'unsettled'};
const batch={currency:'SYP',id:recordId,created_at:'2026-10-01T00:00:00Z',total_amount:45000,paid_amount:0,remaining_amount:45000,settlement_status:'open'};
function envelopeFor(section){
 const base={currency:'SYP',id:recordId,occurred_at:'2026-10-01T00:00:00Z'};
 const record=section==='sale'?sale:section==='settlement'?batch:null;
 const row=section==='sales'?sale:section==='sale'?{...base,event_type:'sale_payment',amount:1}:section==='settlements'?batch:section==='settlement'?{...base,store_order_id:recordId,current_entitlement_amount:45000,paid_amount:0,remaining_amount:45000}:section==='commissions'?{...base,store_order_id:recordId,base_amount:50000,commission_rate:10,commission_amount:5000,reversed_amount:0,net_commission_amount:5000}:section==='invoices'?{...base,invoice_number:'INV1',total_amount:1000,paid_amount:0,remaining_amount:1000,status:'open'}:{...base,amount:1000,allocated_amount:0,unallocated_amount:1000,method:'cash'};
 return {summary:['overview','sales'].includes(section)?[{...sale,open_count:0,partial_count:0,completed_count:0}]:[],obligations:section==='overview'?[{currency:'SYP',invoice_outstanding:1000,effective_exposure:1000,credit_enabled:false,credit_limit:0,credit_available:0}]:[],subscription:null,record,rows:section==='overview'?[]:Array.from({length:20},(_,id)=>({...row,id:section==='sales'?undefined:String(id)})).map(item=>Object.fromEntries(Object.entries(item).filter(([,value])=>value!==undefined))),count:section==='overview'?0:41,payments:[],payments_count:0};
}
const envelope=envelopeFor('overview');
(async () => {
  response = section => ({ data: envelopeFor(section), error: null });
  for (const section of ['overview', 'sales', 'sale', 'settlements', 'settlement', 'commissions', 'invoices', 'payments']) {
    const data = await loadMerchantFinancialAccount(section, { recordId, page: 1, merchantId: 'untrusted-route-value' });
    assert.equal(calls.at(-1).name, 'merchant_financial_account');
    assert.equal(calls.at(-1).args.section_name, section);
    assert.equal(calls.at(-1).args.page_number, 1);
    assert(!('merchant_id' in calls.at(-1).args));
    assert(!('merchantId' in calls.at(-1).args));
    assert(!('target_merchant' in calls.at(-1).args));
    assert.equal(data.count, section === "overview" ? 0 : 41);
    assert.equal(data.rows.length, section === "overview" ? 0 : 20);
    if (data.summary.length) assert.equal(data.summary[0].current_entitlement_amount,45000);
    if (section === 'overview') assert.equal(data.obligations[0].invoice_outstanding,1000);
  }
  await loadMerchantFinancialAccount('sales', { from: '2026-10-01', to: '2026-10-23', order: '١٢٣', status: 'partially_paid' });
  const { args } = calls.at(-1);
  assert.equal(args.period_from, new Date(2026, 9, 1).toISOString());
  assert.equal(args.period_until, new Date(2026, 9, 24).toISOString());
  assert.equal(args.order_search, '123');
  assert(!('selected_currency' in args));
  assert.equal(args.selected_status, 'partially_paid');
  await loadMerchantFinancialAccount('settlement', { recordId, page: 2, paymentsPage: 3 });
  assert.equal(calls.at(-1).args.record_id, recordId);
  assert.equal(calls.at(-1).args.page_number, 2);
  assert.equal(calls.at(-1).args.payments_page, 3, 'Independent payment-history pagination');
  for (const [section, filter] of [
    ['sales', { from: '2026-02-30' }], ['sales', { from: '2026-10-24', to: '2026-10-23' }],
    ['sales', { page: -1 }], ['settlements', { to: 'bad-date' }], ['sales', { order: '1 OR 1=1' }],
    ['sale', {}], ['settlement', { recordId: 'invalid' }],
  ]) {
    const previous = calls.length;
    await assert.rejects(loadMerchantFinancialAccount(section, filter));
    assert.equal(calls.length, previous);
  }
  for (const code of ['P0002', '42501', '42P01']) {
    response = { data: null, error: { code, message: 'database failure' } };
    await assert.rejects(loadMerchantFinancialAccount('overview'));
  }
  for (const data of [null, { ...envelope, summary: null }, { ...envelope, count: null }, { ...envelope, rows: [{ nested: {} }] }]) {
    response = { data, error: null };
    await assert.rejects(loadMerchantFinancialAccount('overview'), 'Do not turn an incomplete response into zero balances');
  }
  assert.equal(resolveNotificationDestination('merchant', { route: '/merchant/finance' }).type, 'merchant-finance');
  for (const role of ['customer', 'driver', 'admin']) {
    assert.equal(resolveNotificationDestination(role, { route: '/merchant/finance' }).type, 'none');
  }
  assert.equal(resolveNotificationDestination('merchant', { route: '/merchant/orders' }).type, 'merchant-orders');
  console.log('Merchant financial account and notification contracts passed (offline).');
})().catch((error) => { console.error(error); process.exitCode = 1; });
