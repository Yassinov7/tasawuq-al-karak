// Offline checks only: no database connection, application startup, or writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks, suffix = '') {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + suffix;
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}
const availability = load('src/lib/purchase-availability.ts', {});
const catalog = load('src/context/CustomerCatalogContext.tsx', {
  react: require('react'), 'react/jsx-runtime': require('react/jsx-runtime'),
  '@/lib/merchant-store': { getStoreMediaUrl: (value) => value },
  '@/lib/customer-reviews': {}, '@/lib/public-catalog': {},
}, '\nexport { toCatalogState };');
const fixture = {
  stores: [], productCategories: [], storeCategories: [], productMedia: [],
  products: [
    { id: 'a', is_available: true, price: 100, title: 'available' },
    { id: 'b', is_available: false, price: 200, title: 'inactive' },
    { id: 'c', is_available: true, price: 300, title: 'other' },
  ],
  offers: [{ id: 'bundle' }, { id: 'active' }],
  offerItems: [
    { id: '1', offer_id: 'bundle', product_id: 'a', item_role: 'bundle', quantity: 1 },
    { id: '2', offer_id: 'bundle', product_id: 'b', item_role: 'bundle', quantity: 1 },
    { id: '3', offer_id: 'active', product_id: 'c', item_role: 'discounted', quantity: 1 },
  ],
};
const mapped = catalog.toCatalogState(fixture);
assert.equal(mapped.products.length, 2, 'Filter inactive products even from a cached catalog');
assert.equal(mapped.offers.length, 1, 'Do not sell a partial bundle with the inactive member dropped');
assert.equal(mapped.offers[0].id, 'active');
assert.equal(mapped.products.find((p) => p.id === 'a').offer, false, 'No offer badge for an unpurchasable offer');
assert.equal(mapped.products.find((p) => p.id === 'c').offer, true);
assert.equal(fixture.offerItems.length, 3, 'Filtering must not mutate stored offer relationships');
assert.equal(fixture.products.length, 3, 'Keep the original records intact');

const calls = [];
let response;
const query = {};
for (const method of ['update', 'eq', 'select']) query[method] = (...args) => { calls.push({ method, args }); return query; };
query.single = async () => response;
const merchant = load('src/lib/merchant-store.ts', { '@/lib/supabase': { supabase: { from: (name) => { assert.equal(name, 'products'); return query; } } } });
const orders = load('src/lib/customer-orders.ts', {
  '@/lib/supabase': { supabase: { rpc: async (name) => { assert.equal(name, 'create_order_from_cart'); return response; } } },
  '@/lib/purchase-availability': availability,
});
(async () => {
  for (const available of [false, true]) {
    calls.length = 0;
    response = { data: { id: 'product', is_available: available }, error: null };
    await merchant.setMerchantProductAvailability('product', 'own-store', available);
    assert.equal(calls[0].method, 'update');
    assert.equal(calls[0].args[0].is_available, available);
    assert.equal(Object.keys(calls[0].args[0]).join(), 'is_available');
    assert(calls.some((call) => call.method === 'eq' && call.args[0] === 'store_id' && call.args[1] === 'own-store'));
  }
  response = { data: null, error: null };
  await assert.rejects(merchant.setMerchantProductAvailability('other-product', 'own-store', false), 'Never treat zero updated rows as success');
  for (const error of [
    { code: 'P1301', message: 'product_unavailable' },
    { message: 'one or more cart items are unavailable or have an invalid quantity' },
    { message: 'one or more selected offers are no longer available' },
  ]) {
    assert.equal(availability.purchaseAvailabilityMessage(error), availability.UNAVAILABLE_PURCHASE_MESSAGE);
    response = { data: null, error };
    await assert.rejects(orders.createCustomerOrder({}), (caught) => caught.message === availability.UNAVAILABLE_PURCHASE_MESSAGE);
  }
  assert.equal(availability.purchaseAvailabilityMessage({ message: 'unrelated database failure' }), null);
  console.log('Safe product removal contracts passed (offline).');
})().catch((error) => { console.error(error); process.exitCode = 1; });
