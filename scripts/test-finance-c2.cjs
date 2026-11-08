const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./financial-test-loader.cjs');

const contract = load('src/lib/finance-c2-contract.ts');
let passed = 0;
function test(name, run) {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('all eleven server reference kinds have a canonical client representation', () => {
  assert.equal(contract.financialReferenceKinds.length, 11);
  for (const kind of contract.financialReferenceKinds) {
    assert.equal(contract.parseFinancialReference(`${kind}-000001`).kind, kind);
  }
});
test('references expand beyond six digits without truncation or aliases', () => {
  assert.equal(contract.parseFinancialReference('ORD-1000000').number, '1000000');
  for (const value of ['ORD-000000', 'ORD-1', 'ORD-0000001', 'ORD-9223372036854775808', 'XXX-000001']) {
    assert.equal(contract.parseFinancialReference(value), null);
  }
});
test('whole SYP preserves all twenty digits without JS number conversion', () => {
  assert.equal(contract.wholeSyp('99999999999999999999'), '99999999999999999999');
  assert.equal(contract.wholeSyp('0'), '0');
  for (const input of ['1.5', '-1', 'NaN', 'Infinity', '1e3', ' 1', '01', '100000000000000000000']) {
    assert.throws(() => contract.wholeSyp(input));
  }
});
test('server durations handle timezone offsets and reject missing/negative data', () => {
  assert.equal(contract.lifecycleDurationMs('2026-11-05T12:00:00+03:00', '2026-11-05T09:01:00Z'), 60000);
  assert.equal(contract.lifecycleDurationMs(null, '2026-11-05T09:01:00Z'), null);
  assert.equal(contract.lifecycleDurationMs('invalid', '2026-11-05T09:01:00Z'), null);
  assert.equal(contract.lifecycleDurationMs('2026-11-05T09:02:00Z', '2026-11-05T09:01:00Z'), null);
});

// These checks protect dormancy and the SQL contract. They are not SQL execution.
const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261105000100_finance_c2_foundation.sql'), 'utf8');
test('foundation never changes an old business function or installs an old-table trigger', () => {
  assert.doesNotMatch(sql, /create\s+or\s+replace/i);
  assert.doesNotMatch(sql, /(?:insert into|update|delete from|alter table)\s+public\.(?:customer_orders|store_orders|delivery_tasks|wallets|merchant_ledger_entries)\b/i);
  for (const [, table] of sql.matchAll(/create\s+(?:constraint\s+)?trigger\s+\w+[\s\S]*?\bon\s+public\.(\w+)/gi)) {
    assert.ok(['financial_document_references','financial_accounts','financial_account_definitions','financial_events',
      'journal_entries','journal_lines','financial_operations','order_lifecycle_events'].includes(table), table);
  }
});
test('only two narrow public read functions exist and internal writers are revoked', () => {
  const functions = [...sql.matchAll(/create function public\.(\w+)/g)].map(match => match[1]);
  assert.deepEqual(functions, ['get_c2_financial_operation', 'find_c2_document_reference']);
  assert.match(sql, /revoke all on all functions in schema finance_private from public, anon, authenticated, service_role/);
  assert.match(sql, /revoke all on all sequences in schema finance_private/);
  assert.match(sql, /o\.actor_id = auth\.uid\(\)/);
  assert.match(sql, /not public\.is_admin\(\)/);
});
test('balance is checked immediately and at commit, with entry locks and immutable identities', () => {
  assert.match(sql, /perform finance_private\.check_journal\(entry_id\)/);
  assert.equal((sql.match(/deferrable initially deferred for each row execute function finance_private\.enforce_journal/g) || []).length, 2);
  assert.match(sql, /where id = new\.journal_entry_id for update/);
  assert.match(sql, /to_jsonb\(new\) - 'status' - 'posted_at'/);
  assert.match(sql, /unique \(source_reference_id, event_type\)/);
  assert.match(sql, /reversal_of uuid unique/);
});
test('numeric fractions cannot be coerced away before CHECK validation', () => {
  assert.match(sql, /amount numeric not null check/);
  assert.match(sql, /amount = trunc\(amount\)/);
  assert.match(sql, /amount::text not in \('NaN','Infinity','-Infinity'\)/);
});
test('an economic event requires a posted journal and a successful operation at commit', () => {
  assert.match(sql,/create constraint trigger financial_event_complete after insert/);
  assert.match(sql,/for each row execute function finance_private\.require_posted_event/);
  assert.match(sql,/financial event requires a posted journal and successful operation/);
  assert.match(sql,/new\.state = 'rejected'/);
  assert.match(sql,/state in \('pending','completed','rejected'\)/);
  assert.match(sql,/set constraints public\.financial_reference_journal_fkey/);
});
test('event validation owns server time and enforces both parent relations', () => {
  assert.match(sql, /new\.occurred_at := clock_timestamp\(\)/);
  assert.match(sql, /new\.actor_id := auth\.uid\(\)/);
  assert.match(sql, /store_order_id and customer_order_id = new\.customer_order_id/);
  assert.match(sql, /delivery_task_id and customer_order_id = new\.customer_order_id/);
  assert.match(sql, /unique \(customer_order_id, natural_key\)/);
  assert.match(sql, /where id = new\.customer_order_id for update/);
});
console.log(`${passed} C2 local contract checks passed. PostgreSQL execution is separate and NOT asserted here.`);
