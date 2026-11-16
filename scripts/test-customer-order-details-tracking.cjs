const assert = require('node:assert/strict');
const fs = require('node:fs');

const screen = fs.readFileSync('src/app/order-details.tsx', 'utf8');
const tracking = fs.readFileSync('src/components/orders/OrderTracking.tsx', 'utf8');

assert.match(screen, /OrderSuborderTracking/);
assert.match(screen, /selectedStoreOrderId/);
assert.match(screen, /storeOrder\.id === selectedStoreOrderId/);
assert.match(screen, /orderDetailsSnapshots\.set/);
assert.match(screen, /scrollOffsetRef/);
assert.doesNotMatch(screen, /<CustomerOrderTimeline/);
assert.doesNotMatch(screen, /<StoreStatusHistory/);

assert.match(tracking, /export function OrderSuborderTracking/);
assert.match(tracking, /storeOrder\.id === selectedId/);
assert.match(tracking, /onSelect\(expanded \? null : store\.storeOrder\.id\)/);
assert.match(tracking, /stores\.length === 1 \|\| store\.storeOrder\.id === selectedId/);
assert.match(tracking, /eventsByStatus = new Map/);
assert.match(tracking, /Boolean\(event\) && !current/);
assert.match(tracking, /rejection_reason/);
assert.match(tracking, /groupOrderItems\(store\.items\)/);
assert.match(tracking, /formatCurrency\(group\.finalTotal/);
assert.doesNotMatch(tracking, /storeRail|storeChip|ScrollView/);
assert.match(tracking, /طلبات المتاجر[\s\S]*title="تحديث"/);
assert.match(screen, /styles\.orderHero[\s\S]*styles\.heroDelivery[\s\S]*styles\.heroActions[\s\S]*OrderSuborderTracking[\s\S]*styles\.summaryCard/);
assert.doesNotMatch(screen, /styles\.deliveryAddressCard|styles\.pageActions/);
assert.match(screen, /title="الفاتورة"/);
assert.match(screen, /canCancel \? <AppButton title="إلغاء الطلب"/);
assert.doesNotMatch(screen, /<LiveStatus/);

console.log('customer order suborder tracking contract: ok');
