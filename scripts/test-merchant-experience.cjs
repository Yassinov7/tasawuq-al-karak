// Offline behavior checks: mocked reads/writes only, no app server or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Date, require: (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unmocked import: ${name}`);
  } });
  return exports;
}
const { merchantNavigation } = load('src/lib/merchant-navigation.ts');
const main = ['/merchant', '/merchant/catalog', '/merchant/orders', '/merchant/finance', '/merchant/account'];
for (const file of fs.readdirSync(path.join(root, 'src/app/merchant')).filter((file) => file.endsWith('.tsx') && file !== '_layout.tsx')) {
  const route = file === 'index.tsx' ? '/merchant' : `/merchant/${file.replace('.tsx', '')}`;
  const page = merchantNavigation(route);
  assert.notEqual(page.title, 'مساحة التاجر', `Missing route configuration: ${route}`);
  assert(main.includes(page.section));
  assert.equal(Boolean(page.parent), !main.includes(route));
  assert(!read(`src/app/merchant/${file}`).includes('<AppHeader'), `Duplicate header: ${file}`);
}
assert.equal(merchantNavigation('/merchant/financial-sale-details').section, '/merchant/finance');
assert.equal(merchantNavigation('/merchant/product-editor', true).title, 'تعديل المنتج');
const { sellingUnitOptions } = load('src/constants/selling-units.ts');
for (const legacy of ['كغ', '1.5 لتر', '5 أقلام']) {
  const options = sellingUnitOptions(legacy);
  assert(options.some((option) => option.value === legacy));
  assert.equal(options.filter((option) => option.value === legacy).length, 1);
  assert(options.every((option) => option.value.length <= 32));
}
const { filterMerchantProducts } = load('src/lib/merchant-store.ts', { '@/lib/supabase': { supabase: {} } });
const products = [{ title: 'حليب', is_available: true }, { title: 'حليب قديم', is_available: false }];
assert.equal(filterMerchantProducts(products, '', 'all').length, 2);
assert.equal(filterMerchantProducts(products, ' حليب ', 'available').length, 1);
assert.equal(filterMerchantProducts(products, '', 'paused')[0].is_available, false);
assert.equal(products.length, 2);

// Inspect the actual useCallback dependency list, not a second application model.
const app = read('src/app/merchant-application.tsx');
const tree = ts.createSourceFile('application.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let dependencies;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'loadData') {
    dependencies = node.initializer.arguments[1].elements.map((item) => item.getText(tree));
  }
  ts.forEachChild(node, visit);
}
visit(tree);
assert.deepEqual(dependencies, ['router', 'userId']);
assert(app.includes('setCategoryId((previous)') && app.includes('setPlanId((previous)'));
assert(app.includes('merchant-application-draft:${userId}') && app.includes('submitLock.current'));
const editor = read('src/app/merchant/product-editor.tsx');
assert(!editor.includes('__DEV__') && !editor.includes('setAlert') && !editor.includes('projectRef'));
assert(editor.includes('setNotice(successMessage)') && editor.includes('router.back()'));
assert(editor.includes('saveLock.current') && editor.includes('draftProduct.current'));
const layout = read('src/app/merchant/_layout.tsx');
assert.equal((layout.match(/<AppHeader\b/g) || []).length, 1);
assert.equal((layout.match(/<AppBottomNav\b/g) || []).length, 1);
assert(layout.includes('BottomNavHeight + insets.bottom'));
assert(read('src/app/_layout.tsx').includes('!pathname.startsWith("/merchant") && MAIN_ROUTES.includes'));

const calls = [];
const fixtures = {
  profiles: [{ full_name: 'اسم محفوظ' }],
  merchant_subscriptions: [
    { id: 'future2', plan_id: 'plan', starts_at: '2099-01-01', expires_at: '2100-01-01' },
    { id: 'future1', plan_id: 'plan', starts_at: '2098-01-01', expires_at: '2099-01-01' },
    { id: 'current', plan_id: 'plan', starts_at: '1999-01-01', expires_at: '2000-01-01' },
  ],
  subscription_plans: [{ id: 'plan', product_limit: 10, features: ['ميزة'] }],
  merchant_billing_settings: [{ auto_renew: true }],
  merchant_subscription_plan_changes: [],
  stores: [{ id: 'store', merchant_id: 'merchant', name: 'متجر' }],
};
const client = { from(table) {
  const filters = [];
  const query = {
    select() { return query; },
    update(values) { calls.push({ table, values, filters }); return query; },
    eq(column, value) { filters.push([column, value]); return query; },
    is() { return query; }, order() { return query; }, limit() { return query; },
    single() { return Promise.resolve({ data: fixtures[table]?.[0] ?? null, error: null }); },
    maybeSingle() { return query.single(); },
    then(resolve, reject) { return Promise.resolve({ data: fixtures[table] ?? [], error: null }).then(resolve, reject); },
  };
  return query;
} };
const store = { id: 'store', merchant_id: 'merchant' };
const account = load('src/lib/merchant-account.ts', {
  '@/lib/supabase': { supabase: client },
  '@/lib/merchant-store': { getMerchantStore: async () => store },
  '@/lib/local-cache': { invalidateLocalCache: async () => undefined },
  '@/lib/merchant-financial-account': { loadMerchantFinancialAccount: async () => ({ subscription: {
    starts_at: '1999-01-01', subscription_status: 'expired', commission_rate_snapshot: 3,
  } }) },
  '@/types/profile-demographics': load('src/types/profile-demographics.ts'),
});
async function run() {
  const subscription = await account.loadMerchantSubscription('owner');
  assert.equal(subscription.current.id, 'current');
  assert.equal(subscription.next.id, 'future1');
  assert.equal(subscription.status, 'expired');
  assert.equal(subscription.commissionRate, 3);
  assert.equal(subscription.autoRenew, true);
  await assert.rejects(account.saveMerchantProfile('owner', 'x', null), /اسم/);
  await assert.rejects(account.saveMerchantProfile('owner', 'اسم صحيح', null, 'invalid'), /قيمة/);
  assert.equal(calls.length, 0);
  await account.saveMerchantProfile('owner', 'اسم صحيح', null);
  assert.deepEqual(Object.keys(calls[0].values).sort(), ['age_range', 'full_name']);
  assert.deepEqual(plain(calls[0].filters), [['id', 'owner']]);
  await assert.rejects(account.saveMerchantStoreInfo('owner', 'other-store', { name: 'متجر', description: '', phone: '12345', address: 'عنوان' }), /صلاحية/);
  assert.equal(calls.length, 1);
  await account.saveMerchantStoreInfo('owner', 'store', { name: 'متجر', description: '', phone: '12345', address: 'عنوان' });
  assert.deepEqual(Object.keys(calls[1].values).sort(), ['address', 'description', 'name', 'phone']);
  assert.deepEqual(plain(calls[1].filters), [['id', 'store'], ['merchant_id', 'merchant']]);
  const source = read('src/lib/merchant-account.ts');
  assert(!source.includes('.rpc('), 'No new merchant financial mutation RPC may be invented');
  console.log('PASS: merchant route sections/chrome, legacy units, availability filters, application dependencies, save feedback, server subscription selection and owned account writes. No network calls.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
