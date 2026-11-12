// Offline dependency audit of final view definitions, not PostgreSQL execution.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const migrationName = '20261026000100_syp_only_architecture.sql';
const dir = path.join(root, 'supabase/migrations');
function definitions(sql) {
  // Current view SQL uses no dollar bodies/semicolon-bearing literals. Exclude
  // function/DO bodies so their text cannot masquerade as top-level view DDL.
  return [...sql.replace(/\$([\w]*)\$[\s\S]*?\$\1\$/g, '').replace(/--[^\n]*/g, '')
    .matchAll(/create (?:or replace )?view public\.(\w+)\b[\s\S]*?;/gi)]
    .map(m => [m[1], m[0]]);
}
const prior = new Map();
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql') && f < migrationName).sort()) {
  for (const [name, body] of definitions(fs.readFileSync(path.join(dir, file), 'utf8'))) prior.set(name, body);
}
const references = body => new Set([...body.matchAll(/\b(?:from|join)\s+public\.(\w+)/gi)].map(m => m[1]));
const sql = fs.readFileSync(path.join(dir, migrationName), 'utf8');
const creates = definitions(sql); const recreated = new Map(creates);
const drops = [...sql.matchAll(/\bdrop view public\.(\w+)\s*;/gi)].map(m => m[1]);
assert.equal(new Set(drops).size, drops.length);
assert.equal(recreated.size, creates.length);
assert.deepEqual([...recreated.keys()].sort(), [...drops].sort(), 'DROP/CREATE plans must match');
for (const [index, [name,body]] of creates.entries()) {
  for (const ref of references(body)) if (recreated.has(ref)) {
    assert(creates.findIndex(([n]) => n === ref) < index, `${name}: replacement base ${ref} not created yet`);
  }
}
// Include views that pin a changed table's currency type, even if they do not
// depend on another view (merchant_account_settlement_rows is such a case).
const tables = require('./test-database-schema-contract.cjs').model();
const monetaryTables = new Set([...tables].filter(([,t]) => [...t.columns.values()].some(c => c.type === 'public.currency_code')).map(([name]) => name));
for (const name of ['products','store_offers','subscription_plans','delivery_zones','wallets','merchant_credit_limits']) monetaryTables.add(name);
const affected = new Set();
let changed = true;
while (changed) {
  changed = false;
  for (const [name, body] of prior) {
    // A view reading products.id alone does not pin products.currency. Current
    // financial projections expose named currency columns or an alias.*.
    const exposesCurrency = /\b(?:currency|currency_snapshot|plan_currency_snapshot|delivery_currency)\b|\b\w+\.\*/i.test(body);
    if (!affected.has(name) && [...references(body)].some(ref => affected.has(ref) || monetaryTables.has(ref) && exposesCurrency)) { affected.add(name); changed = true; }
  }
}
for (const [name, body] of prior) {
  if (!affected.has(name)) continue;
  assert(drops.includes(name), `Missing DROP for affected/dependent view ${name}`);
  assert(recreated.has(name), `Missing CREATE for ${name}`);
  const acl = sql.slice(sql.indexOf('create temporary table syp_acl'), sql.indexOf("select 'function'"));
  const owners = sql.slice(sql.indexOf('create temporary table syp_view_metadata'), sql.indexOf('create temporary table syp_view_column_acl'));
  assert(acl.includes(`'${name}'`), `Missing saved relation ACL: ${name}`);
  assert(owners.includes(`'${name}'`), `Missing saved owner/column ACL/options: ${name}`);
  for (const ref of references(body)) if (prior.has(ref) && affected.has(ref)) {
    assert(drops.indexOf(name) < drops.indexOf(ref), `${name} must DROP before ${ref}`);
    assert(creates.findIndex(([n]) => n === ref) < creates.findIndex(([n]) => n === name), `${ref} must CREATE before ${name}`);
  }
  assert(/security_invoker\s*=\s*true/.test(recreated.get(name)), name);
  assert(/security_barrier\s*=\s*true/.test(recreated.get(name)), name);
}
// These final read models need no monetary/formula changes. Preserve verbatim SQL.
for (const name of ['merchant_account_sale_rows','merchant_account_settlement_rows']) {
  const normalize = s => s.replace(/create or replace view/i, 'create view').replace(/\s+/g, ' ').trim();
  assert.equal(normalize(recreated.get(name)), normalize(prior.get(name)), `Final definition drift: ${name}`);
}
assert(!/drop\s+view[^;]*\bcascade\b/i.test(sql));
assert(sql.includes('Unplanned SYP view dependencies'));
console.log(`PASS: ${prior.size} final historical views audited; ${drops.length} affected views have dependency-safe DROP/CREATE, ACL and owner coverage.`);
for (const [name,body] of prior) for (const ref of references(body)) if (prior.has(ref)) console.log(`  ${ref} -> ${name}`);
