const assert = require('node:assert/strict');
const { load } = require('./syp-test-loader.cjs');
const { categoryFilterIds, categoryPath } = load('src/lib/category-tree.ts');
const { getCustomerSearchResults, getVisibleCustomerSearchResults, initialSearchFilter } = load('src/lib/customer-search.ts');

const root = { id: 'root', name: 'مخبوزات' };
const child = { id: 'child', parentId: root.id, name: 'خبز' };
const peer = { id: 'peer', name: 'مشروبات' };
const categories = [root, child, peer];
assert.deepEqual([...categoryFilterIds(categories, root.id)], ['root', 'child']);
assert.deepEqual([...categoryFilterIds(categories, child.id)], ['child']);
assert.deepEqual([...categoryFilterIds([root, peer], root.id)], ['root']);
assert.deepEqual([...categoryFilterIds([root, peer], child.id)], []);
assert.equal(categoryPath(child, new Map(categories.map(node => [node.id, node]))), 'مخبوزات / خبز');

const products = categories.map(node => ({ id: node.id, categoryId: node.id, name: 'منتج', description: '', unit: 'قطعة', available: true }));
const stores = [{ id: 'store', name: 'متجر', categoryIds: ['child'], description: '' }];
const offers = [
  { id: 'bundle', store_id: 'store', title: 'باقة الإفطار', offer_type: 'bundle', items: [{ product: { name: 'حليب طازج' } }] },
  { id: 'gift', store_id: 'store', title: 'حليب إضافي', offer_type: 'buy_x_get_y', description: 'الإفطار', items: [] },
];
const input = { categories, products, stores, storeCategories: categories, offers };
const ids = rows => Array.from(rows, row => row.id);
const search = getCustomerSearchResults(input, 'مخبوزات');
assert.deepEqual(ids(search.products), ['root', 'child']);
assert.deepEqual(ids(search.stores), ['store']);
assert.deepEqual(ids(getVisibleCustomerSearchResults(search, 'products', 'child', 'relevance', categories).products), ['child']);
const disabled = { ...input, categories: [root, peer] };
assert.deepEqual(ids(getCustomerSearchResults(disabled, 'مخبوزات').products), ['root']);
assert.deepEqual(ids(getCustomerSearchResults(disabled, '').products), ['root', 'child', 'peer']);
const renamed = [root, { ...child, name: 'معجنات', parentId: peer.id }, peer];
assert.deepEqual(ids(getCustomerSearchResults({ ...input, categories: renamed }, 'معجنات').products), ['child']);
assert.deepEqual([...categoryFilterIds(renamed, root.id)], ['root']);
console.log('PASS category tree: exact child, inclusive root, search paths, reparenting, and historical availability');

assert.deepEqual(ids(getCustomerSearchResults(input, 'بَاقة الافطار').offers), ['bundle']);
assert.deepEqual(ids(getCustomerSearchResults(input, 'متجر طازج').offers), ['bundle']);
assert.deepEqual(ids(getCustomerSearchResults(input, 'هدية').offers), ['gift']);
assert.deepEqual(ids(getCustomerSearchResults(input, 'حليب').offers), ['gift', 'bundle']);
const mixed = getCustomerSearchResults(input, '');
const offerOnly = getVisibleCustomerSearchResults(mixed, 'offers', null, 'relevance', categories);
assert.deepEqual(ids(offerOnly.offers), ['bundle', 'gift']);
assert.equal(offerOnly.products.length + offerOnly.stores.length + offerOnly.categories.length, 0);
const priced = { ...mixed, products: mixed.products.map((product, index) => ({ ...product, price: [30, 10, 20][index] })) };
const productOnly = getVisibleCustomerSearchResults(priced, 'products', root.id, 'price-ascending', categories);
assert.equal(productOnly.offers.length, 0);
assert.deepEqual(ids(productOnly.products), ['child', 'root']);
assert.deepEqual(ids(getVisibleCustomerSearchResults(priced, 'products', null, 'price-descending', categories).products), ['root', 'peer', 'child']);
console.log('PASS Arabic offer matching by title, type, store and item; result type isolation');

const grandchild = { id: 'grandchild', parentId: 'child', name: 'خبز أسمر' };
const deep = [...categories, grandchild];
assert.deepEqual([...categoryFilterIds(deep, root.id)], ['root', 'child', 'grandchild']);
assert.equal(categoryPath(grandchild, new Map(deep.map(node => [node.id, node]))), 'مخبوزات / خبز / خبز أسمر');
console.log('PASS progressive category path and descendant selection across three levels');

for (const [type, mode, categoryId, expected] of [
  [undefined, undefined, null, 'products'],
  [undefined, 'all', null, 'products'],
  [undefined, 'products', null, 'products'],
  ['stores', undefined, null, 'stores'],
  ['offers', 'all', null, 'offers'],
  [undefined, 'categories', null, 'categories'],
  ['all', undefined, null, 'products'],
  [undefined, undefined, 'root', 'products'],
]) assert.equal(initialSearchFilter(type, mode, categoryId), expected);
console.log('PASS four search entry scopes and legacy all fallback');
