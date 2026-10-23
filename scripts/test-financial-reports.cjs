// Offline service contract checks. No network, credentials, or database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const calls = [];
let response;
const client = { rpc: async (name, args) => { calls.push({ name, args }); return response; } };
const source = fs.readFileSync(path.join(__dirname, '../src/lib/admin-financial-reports.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(compiled, {
  exports: moduleValue.exports,
  require: (name) => { assert.equal(name, '@/lib/supabase'); return { supabase: client }; },
  Date,
});
const { loadFinancialReport } = moduleValue.exports;
const envelope = {
  rows: Array.from({ length: 20 }, (_, id) => ({ id: String(id), currency: 'SYP', amount: 1 })),
  summary: [{ currency: 'SYP', inflow: 55000, outflow: 45000 }, { currency: 'USD', inflow: 2, outflow: 1 }],
  groups: [], options: [], count: 41,
};

(async () => {
  response = { data: envelope, error: null };
  for (const kind of ['cash', 'delivery', 'custody', 'merchant', 'platform']) {
    const result = await loadFinancialReport(kind, { page: 1, currency: 'SYP' });
    assert.equal(result.summary, envelope.summary, 'Use server totals unchanged, never page sums');
    assert.equal(result.count, 41);
    assert.equal(result.rows.length, 20);
    assert.equal(calls.at(-1).name, ['merchant', 'platform'].includes(kind) ? 'admin_sales_revenue_report' : 'admin_financial_report');
    assert.equal(calls.at(-1).args.page_number, 1);
    assert.equal(calls.at(-1).args.report_currency, 'SYP');
  }
  await loadFinancialReport('cash', { from: '2026-10-01', to: '2026-10-23', eventType: 'driver_remittance' });
  assert.equal(calls.at(-1).args.period_from, new Date(2026, 9, 1).toISOString());
  assert.equal(calls.at(-1).args.period_until, new Date(2026, 9, 24).toISOString());
  assert.equal(calls.at(-1).args.movement_type, 'driver_remittance');
  await loadFinancialReport('delivery', { driverId: 'driver', zone: 'zone|snapshot' });
  assert.equal(calls.at(-1).args.target_driver, 'driver');
  assert.equal(calls.at(-1).args.zone_snapshot, 'zone|snapshot');
  await loadFinancialReport('merchant', { merchantId: 'merchant', detailType: 'settlement', settlementState: 'partially_paid' });
  assert.equal(calls.at(-1).args.target_merchant, 'merchant');
  assert.equal(calls.at(-1).args.detail_type, 'settlement');
  assert.equal(calls.at(-1).args.settlement_state, 'partially_paid');
  for (const filter of [{ from: '2026-02-30' }, { to: 'bad' }, { from: '2026-10-24', to: '2026-10-23' }]) {
    const before = calls.length;
    await assert.rejects(loadFinancialReport('cash', filter));
    assert.equal(calls.length, before, 'Invalid periods must not query the database');
  }
  response = { data: null, error: { message: 'administrator access required' } };
  await assert.rejects(loadFinancialReport('cash'), /administrator access required/);
  response = { data: null, error: null };
  await assert.rejects(loadFinancialReport('platform'));
  response = { data: { ...envelope, groups: null }, error: null };
  await assert.rejects(loadFinancialReport('custody'));
  response = { data: { ...envelope, count: null }, error: null };
  await assert.rejects(loadFinancialReport('merchant'));
  console.log('Financial report service contract checks passed (offline).');
})().catch((error) => { console.error(error); process.exitCode = 1; });
