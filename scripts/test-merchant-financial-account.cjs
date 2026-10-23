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
const client = { rpc: async (name, args) => { calls.push({ name, args }); return response; } };
const { loadMerchantFinancialAccount } = loadModule('src/lib/merchant-financial-account.ts', (name) => {
  assert.equal(name, '@/lib/supabase'); return { supabase: client };
});
const { resolveNotificationDestination } = loadModule('src/lib/notification-routing.ts');
const recordId = '11111111-1111-4111-8111-111111111111';
const envelope = {
  summary: [{ currency: 'SYP', current_entitlement_amount: 45000 }, { currency: 'USD', current_entitlement_amount: 7 }],
  obligations: [{ currency: 'SYP', invoice_outstanding: 1000 }], subscription: null, record: null,
  rows: Array.from({ length: 20 }, (_, id) => ({ id: String(id), currency: 'SYP', amount: 1 })),
  count: 41, payments: [], payments_count: 0,
};
(async () => {
  response = { data: envelope, error: null };
  for (const section of ['overview', 'sales', 'sale', 'settlements', 'settlement', 'commissions', 'invoices', 'payments']) {
    const data = await loadMerchantFinancialAccount(section, { recordId, page: 1, merchantId: 'untrusted-route-value' });
    assert.equal(calls.at(-1).name, 'merchant_financial_account');
    assert.equal(calls.at(-1).args.section_name, section);
    assert.equal(calls.at(-1).args.page_number, 1);
    assert(!('merchant_id' in calls.at(-1).args));
    assert(!('merchantId' in calls.at(-1).args));
    assert(!('target_merchant' in calls.at(-1).args));
    assert.equal(data.count, 41);
    assert.equal(data.rows.length, 20);
    assert.equal(data.summary[0].current_entitlement_amount, 45000, 'Never calculate a total from the page of details');
    assert.equal(data.summary[1].currency, 'USD', 'Keep currencies separate');
    assert.equal(data.obligations[0].invoice_outstanding, 1000, 'Keep obligations separate from sales');
  }
  await loadMerchantFinancialAccount('sales', { from: '2026-10-01', to: '2026-10-23', order: '١٢٣', status: 'partially_paid', currency: 'USD' });
  const { args } = calls.at(-1);
  assert.equal(args.period_from, new Date(2026, 9, 1).toISOString());
  assert.equal(args.period_until, new Date(2026, 9, 24).toISOString());
  assert.equal(args.order_search, '123');
  assert.equal(args.selected_currency, 'USD');
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
