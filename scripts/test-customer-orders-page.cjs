const assert = require('node:assert/strict');
const fs = require('node:fs');

const screen = fs.readFileSync('src/app/orders.tsx', 'utf8');
const service = fs.readFileSync('src/lib/customer-orders.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261130000100_customer_order_directory_search.sql', 'utf8');

assert.match(screen, /const ORDERS_PAGE_SIZE = 12/);
assert.match(screen, /orderSnapshots = new Map/);
assert.match(screen, /initialSnapshot\?\.orders/);
assert.match(screen, /scrollOffsetRef/);
assert.match(screen, /getCustomerOrdersPage\(offset, limit, criteria\.query, criteria\.filter\)/);
assert.match(screen, /readRef\.current\?\.key === requestKey/);
assert.match(screen, /mapped\.filter\([\s\S]*!ordersRef\.current\.some/);
assert.match(screen, /onEndReached=/);
assert.match(screen, /onEndReachedThreshold=\{0\.35\}/);
assert.match(screen, /جارٍ تحميل طلبات إضافية/);
assert.match(screen, /function CustomerOrderCard/);
assert.match(screen, /borderRightColor: statusColors\.color/);
assert.match(screen, /تفاصيل الطلب/);
assert.match(screen, /الإجمالي النهائي/);
assert.match(screen, /horizontal/);
assert.match(screen, /contentContainerStyle=\{styles\.filters\}/);
assert.match(screen, /direction: "rtl"/);
assert.match(screen, /<FlatList/);
assert.match(screen, /keyExtractor=\{\(order\) => order\.id\}/);
assert.match(screen, /<CategoryChip/);
assert.match(screen, /<RefreshStatus/);
assert.match(screen, /<AppEmptyState/);
assert.match(screen, /لا توجد طلبات بعد/);
assert.match(screen, /لا توجد طلبات ضمن هذا الفلتر/);
assert.doesNotMatch(screen, /function FilterButton/);
assert.doesNotMatch(screen, /طلبات محمّلة/);
const contentStyle = screen.match(/content:\s*\{([\s\S]*?)\n\s*\},\n\n\s*search:/)?.[1] ?? '';
assert.doesNotMatch(contentStyle, /direction:\s*["']rtl["']/, 'the list container must not double-reverse the approved card layout');
assert.match(screen, /filtersScroll:\s*\{ direction: "rtl"/, 'the filter viewport owns RTL independently from the cards');
assert.match(screen, /refreshing && orders\.length > 0 \? \(/, 'background status must not reserve an idle gap above the first card');
assert.match(screen, /useOrderRealtime/);
assert.doesNotMatch(screen, /<LiveStatus/);
assert.match(screen, /ابحث برقم الطلب أو المتجر أو المنتج/);
assert.match(screen, /setTimeout\(\(\) => setQuery\(searchText\.trim\(\)\), 350\)/);
assert.match(screen, /searchText:/);
assert.match(screen, /query:/);
assert.match(screen, /partially_cancelled: "ملغى جزئيًا"/);
assert.match(screen, /pathname: "\/order-details"/);
assert.match(screen, /key=\{user\?\.id \?\? "guest"\}/);
assert.doesNotMatch(screen, />\s*طلباتك\s*</);
assert.doesNotMatch(screen, /getCustomerOrders\(\)/);

const routeFiles = fs.readdirSync('src/app').filter((name) => name === 'orders.tsx');
assert.deepEqual(routeFiles, ['orders.tsx']);

assert.match(service, /export async function getCustomerOrdersPage/);
assert.match(service, /supabase\.rpc\("read_customer_orders_page"/);
assert.match(service, /query_value: query\.trim\(\)/);
assert.match(service, /status_value: status/);
assert.match(service, /return attachOrderDetails\(data \?\? \[\]\)/);

assert.match(migration, /co\.customer_id = auth\.uid\(\)/);
assert.match(migration, /cr\.kind = 'ORD'/);
assert.match(migration, /co\.order_number::text/);
assert.match(migration, /join public\.stores s/);
assert.match(migration, /soi\.product_title_snapshot/);
assert.match(migration, /order by co\.created_at desc, co\.id desc/);
assert.match(migration, /offset safe_offset[\s\S]*limit safe_limit/);
assert.match(migration, /revoke all on function public\.read_customer_orders_page[\s\S]*from public, anon/);

console.log('customer orders page contract: ok');
