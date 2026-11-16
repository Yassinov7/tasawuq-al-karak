const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./syp-test-loader.cjs');

const screen = fs.readFileSync('src/app/checkout.tsx', 'utf8');
const orders = fs.readFileSync('src/lib/c3-orders.ts', 'utf8');
const guide = fs.readFileSync('docs/rui-cus-09.ar.md', 'utf8');

assert.match(screen, /title="إتمام الطلب"/);
assert.match(screen, /Promise\.all\(\[revalidateCart\(\), revalidateCatalog\(\)\]\)/);
assert.doesNotMatch(screen, /useFocusEffect\(useCallback\(\(\) => \{ void refreshCatalog\(\)/);
assert.match(screen, /catalogPricingSignature/);
assert.match(screen, /const scopedQuote = quote\?\.scope === quoteScope/);
assert.match(screen, /!quoting/);
assert.match(screen, /جارٍ التحديث/);
assert.match(screen, /recoveryCheckedOwnerRef/);
assert.match(screen, /مراجعة الطلب/);
assert.match(screen, /cartStoreIds/);
assert.match(screen, /مستلم مختلف لهذا الطلب/);
assert.match(screen, /selectedAddress \? \(/);
assert.match(screen, /selectedAddress\.zone\?\.name/);
assert.match(screen, /تغيير العنوان/);
assert.match(screen, /إضافة عنوان/);
assert.match(screen, /differentRecipientRef/);
assert.match(screen, /applySavedAddress\(selectedAddress, true\)/);
assert.match(screen, /label="المنتجات والعروض"/);
assert.match(screen, /الدفع عند الاستلام/);
assert.match(screen, /deliveryDetailsReady/);
assert.doesNotMatch(screen, /<Section title="طريقة الدفع">/);
assert.match(screen, /router\.push\("\/cart"\)/);
assert.match(screen, /paddingBottom: Math\.max\(Spacing\.three, insets\.bottom\)/);
assert.match(screen, /submissionLock\.current/);
assert.match(screen, /confirmedCart\.current !== validQuote\.cart_signature/);
assert.match(screen, /expectedUser: owner, cartSignature: validQuote\.cart_signature/);
assert.match(screen, /key=\{user\?\.id \?\? "guest"\}/);

assert.match(orders, /newIdempotencyKey\(\)/);
assert.match(orders, /recover_c3_order_request/);
assert.match(orders, /expected_cart_signature/);
assert.match(orders, /requireOwner/);

const { c3Fee, c3TotalMatches } = load('src/lib/c3-order-contract.ts');
assert.equal(c3Fee(1000, 250, 1), 1000);
assert.equal(c3Fee(1000, 250, 3), 1500);
assert.equal(c3TotalMatches(10500.5, 1500, 12000.5), true);
assert.equal(c3TotalMatches(10500.5, 1500, 12001), false);

assert.match(guide, /مفتوحة — بانتظار اختبار الهاتف/);
console.log('customer checkout page contract: ok');
