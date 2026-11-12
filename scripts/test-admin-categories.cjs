const assert = require('node:assert/strict');
const { load } = require('./syp-test-loader.cjs');

async function main() {
  const calls = [];
  const pending = [];
  let onUpdateSent = () => {};
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        gt: (key, value) => { call.cursor = [key, value]; return query; },
        eq: (key, value) => { call.filters.push([key, value]); return query; },
        upsert: (payload, options) => { Object.assign(call, { payload, options }); return query; },
        update: payload => { call.update = payload; return query; },
        delete: () => { call.delete = true; return query; },
        maybeSingle: () => query,
        abortSignal: signal => { call.signal = signal; return query; },
        then: (resolve, reject) => {
          if (call.update) onUpdateSent();
          return Promise.resolve(pending.shift()).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const { listAdminCategories, categoryRemovalReason, saveAdminCategory, removeAdminCategory } =
    load('src/lib/admin-categories.ts', { '@/lib/supabase': { supabase } });
  const signal = new AbortController().signal;
  const page = Array.from({ length: 100 }, (_, index) => ({ id: String(index) }));
  pending.push({ data: page }, { data: [{ id: '100' }] });
  assert.equal((await listAdminCategories(signal)).length, 101);
  assert.equal(calls[0].signal, signal);
  assert.deepEqual(calls[1].cursor, ['id', '99']);

  const values = { name: 'منتجات', scope: 'product', parent_id: null, sort_order: 0, is_active: true };
  const row = { ...values, id: 'test-id', updated_at: 'version-1' };
  pending.push({ data: [] }, { data: [{ id: 'product' }] });
  assert.match(await categoryRemovalReason(row, signal), /مرتبط بمنتج/);
  assert.deepEqual(calls.slice(-2).map(call => call.table), ['catalog_categories', 'products']);

  const before = calls.length;
  await assert.rejects(saveAdminCategory('another-admin', () => true, row.id, values), /تغيرت الجلسة/);
  await assert.rejects(removeAdminCategory('admin', () => false, row), /تغيرت الجلسة/);
  assert.equal(calls.length, before);

  pending.push({ error: new Error('lost response') });
  await assert.rejects(saveAdminCategory('admin', () => true, row.id, values), /lost response/);
  pending.push({}, { data: row });
  assert.equal(await saveAdminCategory('admin', () => true, row.id, values), row);
  const inserts = calls.filter(call => call.payload);
  assert.equal(inserts[0].payload.id, inserts[1].payload.id);
  assert.ok(inserts.every(call => call.options.ignoreDuplicates));

  let finishWrite;
  const writing = new Promise(resolve => { onUpdateSent = resolve; });
  pending.push(new Promise(resolve => { finishWrite = resolve; }));
  let current = true;
  const update = saveAdminCategory('admin', () => current, row.id, values, row);
  await writing;
  current = false;
  finishWrite({});
  await assert.rejects(update, /تغيرت الجلسة/);
  assert.deepEqual(calls.at(-1).filters, [['id', row.id], ['updated_at', row.updated_at]]);
  assert.equal(pending.length, 0);
  console.log('PASS admin categories: central cursor, deletion preflight, session isolation, stable insert retries, and late response guard');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
