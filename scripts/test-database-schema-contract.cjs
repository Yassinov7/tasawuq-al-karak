// Offline, deliberately bounded DDL audit, NOT a PostgreSQL schema generator.
// Handles the CREATE/ALTER TABLE forms in this repository; fails on unknown
// column mutations. Final Supabase-generated types still require a migrated DB.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
// PostgreSQL balances both identifier parts before appending the suffix when
// its automatically chosen constraint name would exceed NAMEDATALEN - 1.
function objectName(table, column, suffix) {
  let first = table, second = column;
  const available = 63 - suffix.length - 2;
  while (first.length + second.length > available) {
    if (first.length > second.length) first = first.slice(0, -1);
    else second = second.slice(0, -1);
  }
  return `${first}_${second}_${suffix}`;
}
function split(text, separator = ',') {
  const parts = []; let depth = 0, quoted = false, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") { if (quoted && text[i + 1] === "'") { i++; continue; } quoted = !quoted; }
    if (quoted) continue;
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    if (text[i] === separator && !depth) { parts.push(text.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(text.slice(start).trim()); return parts.filter(Boolean);
}
function model() {
  const tables = new Map();
  function column(table, definition) {
    const m = definition.match(/^(\w+)\s+([\w.]+(?:\(\d+(?:,\d+)?\))?(?:\[\])?)([\s\S]*)$/);
    assert(m, `Unrecognized column: ${definition}`);
    const [, name, type, tail] = m;
    table.columns.set(name, { name, type, nullable: !/not null|primary key|generated always as identity/i.test(tail), optional: /default |generated /i.test(tail) });
    if (/primary key|\bunique\b/i.test(tail)) table.unique.set(`${table.name}_${/primary key/i.test(tail) ? 'pkey' : name + '_key'}`, [name]);
    const ref = tail.match(/references\s+(public|auth)\.(\w+)\s*\(([^)]+)\)/i);
    if (ref) table.relations.set(objectName(table.name, name, 'fkey'), { columns: [name], schema: ref[1], target: ref[2], referenced: split(ref[3]) });
  }
  function constraint(table, value) {
    const named = value.match(/^constraint\s+(\w+)\s+([\s\S]*)/i);
    const body = named ? named[2] : value;
    let m = body.match(/^(primary key|unique)\s*\(([^)]+)\)/i);
    if (m) { const cols = split(m[2]); table.unique.set(named?.[1] ?? `${table.name}_${m[1].toLowerCase() === 'primary key' ? 'pkey' : cols.join('_') + '_key'}`, cols); return; }
    m = body.match(/^foreign key\s*\(([^)]+)\)\s*references\s+(public|auth)\.(\w+)\s*\(([^)]+)\)/i);
    if (m) { const cols = split(m[1]); table.relations.set(named?.[1] ?? objectName(table.name, cols.join('_'), 'fkey'), { columns: cols, schema: m[2], target: m[3], referenced: split(m[4]) }); }
  }
  const files = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql') && f <= '20261026000100_syp_only_architecture.sql').sort();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8');
    // Ignore function/DO bodies and comments so dynamic DDL is handled explicitly below.
    const sql = raw.replace(/\$([\w]*)\$[\s\S]*?\$\1\$/g, "''").replace(/--[^\n]*/g, '');
    for (const statement of split(sql, ';')) {
      let m = statement.match(/^create table public\.(\w+)\s*\(([\s\S]*)\)$/i);
      if (m) {
        const table = { name: m[1], columns: new Map(), relations: new Map(), unique: new Map() };
        for (const part of split(m[2])) /^(constraint|primary|foreign|unique|check)\b/i.test(part) ? constraint(table, part) : column(table, part);
        tables.set(m[1], table); continue;
      }
      m = statement.match(/^alter table public\.(\w+)\s+([\s\S]*)$/i);
      if (!m) continue;
      const table = tables.get(m[1]); assert(table, `${file}: unknown table ${m[1]}`);
      for (const action of split(m[2])) {
        let x = action.match(/^add column\s+([\s\S]*)/i);
        if (x) { column(table, x[1]); continue; }
        x = action.match(/^drop column\s+(\w+)/i);
        if (x) { table.columns.delete(x[1]); continue; }
        x = action.match(/^drop constraint(?: if exists)?\s+(\w+)/i);
        if (x) { table.unique.delete(x[1]); table.relations.delete(x[1]); continue; }
        x = action.match(/^add\s+([\s\S]*)/i);
        if (x) { constraint(table, x[1]); continue; }
        x = action.match(/^alter column\s+(\w+)\s+(drop not null|set not null|set default|drop default)/i);
        if (x) { const col = table.columns.get(x[1]); assert(col); if (/not null/i.test(x[2])) col.nullable = /^drop/i.test(x[2]); else col.optional = /^set/i.test(x[2]); continue; }
        assert(!/\bcolumn\b/i.test(action), `${file}: unsupported mutation ${action}`);
      }
    }
  }
  // Dynamic ALTER loop in the SYP migration applies to EVERY remaining enum column.
  for (const table of tables.values()) {
    for (const col of table.columns.values()) if (col.type === 'public.currency_code') { col.nullable = false; col.optional = true; }
    for (const [key, cols] of table.unique) if (key.endsWith('_pkey')) for (const name of cols) table.columns.get(name).nullable = false;
    for (const rel of table.relations.values()) rel.one = [...table.unique.values()].some(cols => cols.length === rel.columns.length && cols.every(c => rel.columns.includes(c)));
  }
  return tables;
}
function typeOf(col) {
  let type = /^(numeric|integer|bigint|smallint|real|double)/.test(col.type) ? 'number' : col.type === 'boolean' ? 'boolean' : /^(json|jsonb)$/.test(col.type) ? 'Json' : col.type.startsWith('public.') ? `Database["public"]["Enums"]["${col.type.slice(7)}"]` : 'string';
  if (col.name === 'age_range') type = 'ProfileAgeRange';
  if (col.name === 'gender') type = 'ProfileGender';
  return type + (col.nullable ? ' | null' : '');
}
function inspect() {
  const text = fs.readFileSync(path.join(root, 'src/types/database.ts'), 'utf8');
  const source = ts.createSourceFile('database.ts', text, ts.ScriptTarget.Latest, true);
  const db = source.statements.find(n => ts.isTypeAliasDeclaration(n) && n.name.text === 'Database').type;
  const member = (node, name) => node.members.find(m => m.name?.getText(source).replaceAll('"', '') === name);
  const types = member(member(db, 'public').type, 'Tables').type;
  const functions = member(member(db, 'public').type, 'Functions').type;
  return { text, source, member, types, functions };
}
function verify() {
  const schema = model(); const { member, types, source, functions } = inspect();
  assert.equal(schema.get('merchant_financial_audit_events').columns.get('actor_id').nullable, true);
  assert.equal(schema.get('merchant_ledger_entries').columns.get('reversal_of').nullable, true);
  assert.equal(schema.get('customer_orders').columns.get('order_number').nullable, false);
  assert(schema.get('invoice_payment_allocations').columns.has('allocation_batch_id'));
  assert.equal([...schema.get('merchant_subscriptions').relations.values()].find(r => r.target === 'merchants').one, false);
  const problems = [];
  for (const [name, table] of schema) {
    const block = member(types, name)?.type;
    if (!block) { problems.push(`${name}: missing table`); continue; }
    for (const shape of ['Row', 'Insert', 'Update']) {
      const fields = member(block, shape).type;
      for (const col of table.columns.values()) {
        const field = member(fields, col.name);
        const optional = shape === 'Update' || shape === 'Insert' && (col.optional || col.nullable);
        if (!field || Boolean(field.questionToken) !== optional) problems.push(`${name}.${shape}.${col.name}: missing/incorrect optionality`);
        if (field && /\bnull\b/.test(field.type.getText(source)) !== col.nullable) problems.push(`${name}.${shape}.${col.name}: incorrect nullability`);
        const raw = field?.type.getText(source).replace(/ \| null/g, '');
        const expected = /^(numeric|integer|bigint|smallint)/.test(col.type) ? 'number' : col.type === 'boolean' ? 'boolean' : /^(json|jsonb)$/.test(col.type) ? 'Json' : null;
        if (expected && raw !== expected && raw !== 'never') problems.push(`${name}.${shape}.${col.name}: incorrect scalar type`);
      }
      for (const field of fields.members) if (!table.columns.has(field.name.getText(source))) problems.push(`${name}.${shape}.${field.name.getText(source)}: removed column remains`);
    }
    const relNodes = member(block, 'Relationships').type.elements ?? [];
    for (const [key, rel] of table.relations) if (rel.schema === 'public') {
      // Typegen also exposes projections of the same FK through Views. Match
      // the base relation, rather than mistaking its first View for the table.
      const node = relNodes.find(n => member(n, 'foreignKeyName')?.type.getText(source) === `"${key}"`
        && member(n, 'referencedRelation')?.type.getText(source) === `"${rel.target}"`);
      if (!node) { problems.push(`${name}: missing relationship ${key}`); continue; }
      for (const [field, expected] of Object.entries({ columns: rel.columns, referencedColumns: rel.referenced, referencedRelation: rel.target, isOneToOne: rel.one })) {
        const value = JSON.parse(member(node, field).type.getText(source));
        if (JSON.stringify(value) !== JSON.stringify(expected)) problems.push(`${name}.${key}: incorrect ${field}`);
      }
    }
  }
  for (const [name, contract] of functionContracts()) {
    const node = member(functions, name)?.type;
    if (!node) { problems.push(`Missing SQL function ${name}`); continue; }
    const args = member(node, 'Args').type;
    const names = (args.members ?? []).map(field => field.name.getText(source)).sort();
    if (JSON.stringify(names) !== JSON.stringify(contract.args.map(arg => arg.name).sort())) problems.push(`${name}: incorrect SQL argument names`);
    for (const arg of contract.args) {
      const field = args.members && member(args, arg.name);
      if (field && Boolean(field.questionToken) !== arg.optional) problems.push(`${name}.${arg.name}: incorrect argument optionality`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261026000100_syp_only_architecture.sql'), 'utf8');
  for (const invariant of ['syp_view_metadata','syp_view_column_acl','alter view public.%I owner to %I','revoke all privileges on table public.%I from %s','SYP migration changed view relation privileges','SYP migration changed view column privileges','security_invoker=true','security_barrier=true']) assert(sql.includes(invariant), invariant);
  const bootstrap = fs.readFileSync(path.join(root, 'supabase/migrations/20260930000000_currency_code_bootstrap.sql'), 'utf8');
  assert(bootstrap.includes("create type public.currency_code as enum ('SYP')"));
  assert(!/\b(?:drop type|alter type)\b/i.test(bootstrap));
  console.log(`PASS: offline table column/optionality/nullability and FK coverage across ${schema.size} tables; remote verification is a separate check.`);
  require('./test-syp-view-dependencies.cjs');
}
function functionContracts() {
  const functions = new Map();
  for (const file of fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql') && f <= '20261026000100_syp_only_architecture.sql').sort()) {
    const sql = fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8');
    for (const m of sql.matchAll(/create (?:or replace )?function public\.(\w+)\s*\(([\s\S]*?)\)\s*returns\s+(\w+)(?:\s*\(([^)]*)\))?/gi)) {
      if (m[3].toLowerCase() === 'trigger') continue;
      const args = split(m[2]).map(arg => {
        const p = arg.match(/^(\w+)\s+([\w.]+(?:\[\])?)([\s\S]*)$/);
        assert(p, `${m[1]}: unknown argument ${arg}`);
        return { name: p[1], type: p[2], optional: /default/i.test(p[3]), nullable: /default null/i.test(p[3]) };
      });
      functions.set(m[1], { args, returns: m[3].toLowerCase(), fields: m[4] });
    }
  }
  return functions;
}
module.exports = { model, typeOf, inspect, verify, functionContracts };
if (require.main === module) verify();
