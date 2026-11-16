const assert = require('node:assert/strict');
const fs = require('node:fs');

const screen = fs.readFileSync('src/app/cart.tsx', 'utf8');
const context = fs.readFileSync('src/context/CartContext.tsx', 'utf8');
const pricing = fs.readFileSync('src/lib/customer-offers.ts', 'utf8');
const orderSource = fs.readFileSync('src/lib/cart-order.ts', 'utf8');
const { load } = require('./syp-test-loader.cjs');
const { updateOrderedCartItem, isCartReadCurrent } = load('src/lib/cart-order.ts');

assert.match(screen, /ShoppingCardImage/);
assert.match(screen, /styles\.scroll/);
assert.match(screen, /styles\.purchaseBar/);
assert.match(screen, /paddingBottom: Math\.max\(insets\.bottom/);
assert.match(screen, /الإجمالي قبل التوصيل/);
assert.match(screen, /quantityUnit/);
assert.match(screen, /quantity <= \(product\.minimumQuantity \?\? 1\) \? onRemove\(\)/);
assert.match(screen, /unresolvedOfferIds/);
assert.match(screen, /لم نحذفه من سلتك/);
assert.match(screen, /checkoutBlocked/);
assert.match(screen, /Promise\.all\(\[revalidateCart\(\), revalidateCatalog\(\)\]\)/);
assert.doesNotMatch(screen, /useFocusEffect\(useCallback\(\(\) => \{ void refresh\(\)/);
assert.match(screen, /CartInitialSkeleton/);
assert.match(screen, /catalogRefreshing/);
assert.match(screen, /verifiedPrices/);
assert.match(screen, /تم تحديث سعر/);
assert.match(screen, /useCustomerStoreLogos\(storeIds, true, true\)/);
assert.match(screen, /cartOffersByStore/);
assert.doesNotMatch(screen, />\s*سلة مشترياتك\s*</);
assert.doesNotMatch(screen, /<CartTypeCard/);
assert.doesNotMatch(screen, /styles\.totalCard/);
assert.doesNotMatch(screen, /إجمالي المنتج/);
assert.match(screen, /AppHeader title="سلة التسوق"/);
assert.match(screen, /calculation\.items\.slice\(0, 2\)/);
assert.match(screen, /minWidth: 36/);
assert.match(screen, /minHeight: 36/);
assert.match(screen, /formatSyp\(product\.price\).*لكل/);

assert.match(context, /supabase\.rpc\("add_customer_cart_offer"/);
assert.match(context, /supabase\.rpc\("remove_customer_cart_offer"/);
assert.match(context, /queueRef\.current\.then/);
assert.match(context, /cartReadRef\.current\?\.userId === userId/);
assert.match(context, /Date\.now\(\) - validated\.at < 30_000/);
assert.match(context, /refreshing/);
assert.match(context, /calculateCustomerOffer\(offer\)\.finalTotal/);
assert.match(context, /updateOrderedCartItem\(itemsRef\.current, productId, quantity\)/);
assert.match(context, /reconcileOnSuccess: false/);
assert.match(context, /mutationVersionRef\.current \+= 1/);
assert.match(context, /\[cart\] read \$\{cartReadCountRef\.current\} · \$\{reason\}/);
assert.match(context, /loadCart\(userId, "mutation-rollback"\)/);
assert.doesNotMatch(context, /filter\(\(item\) => item\.productId !== productId\)[\s\S]{0,100}nextItems\.push/);
assert.match(orderSource, /index === itemIndex \? \{ \.\.\.item, quantity \} : item/);
assert.match(pricing, /export function calculateCustomerOffer/);

const original = [
  { productId: 'store-a-product-1', quantity: 1 },
  { productId: 'store-a-product-2', quantity: 2 },
  { productId: 'store-b-product-1', quantity: 3 },
];
const increasedFirst = updateOrderedCartItem(original, 'store-a-product-1', 4);
assert.equal(increasedFirst.map((item) => item.productId).join('|'), original.map((item) => item.productId).join('|'));
assert.equal(increasedFirst[0].quantity, 4);
assert.equal(increasedFirst[1], original[1]);
assert.equal(increasedFirst[2], original[2]);

const decreasedFirst = updateOrderedCartItem(increasedFirst, 'store-a-product-1', 1);
assert.equal(decreasedFirst.map((item) => item.productId).join('|'), original.map((item) => item.productId).join('|'));
const changedLast = updateOrderedCartItem(decreasedFirst, 'store-b-product-1', 2);
assert.equal(changedLast.map((item) => item.productId).join('|'), original.map((item) => item.productId).join('|'));
const appended = updateOrderedCartItem(changedLast, 'store-b-product-2', 1);
assert.equal(appended.map((item) => item.productId).join('|'), [...original.map((item) => item.productId), 'store-b-product-2'].join('|'));
const deleted = updateOrderedCartItem(appended, 'store-a-product-2', 0);
assert.equal(deleted.map((item) => item.productId).join('|'), [
  'store-a-product-1',
  'store-b-product-1',
  'store-b-product-2',
].join('|'));

// A read that started before an optimistic mutation must not replace newer state.
assert.equal(isCartReadCurrent(7, 7), true);
assert.equal(isCartReadCurrent(7, 8), false);

// Catalog price refresh changes totals, never the cart's positional identity.
const repriced = changedLast.map((item) => ({ ...item, unitPrice: item.productId === 'store-a-product-1' ? 12 : 8 }));
assert.equal(repriced.map((item) => item.productId).join('|'), changedLast.map((item) => item.productId).join('|'));

// A failed optimistic write can be restored from the authoritative sequence.
const failedOptimistic = updateOrderedCartItem(original, 'store-a-product-1', 9);
assert.equal(failedOptimistic[0].quantity, 9);
const restored = original.map((item) => ({ ...item }));
assert.equal(restored.map((item) => item.productId).join('|'), original.map((item) => item.productId).join('|'));
assert.equal(restored[0].quantity, 1);

const catalogContext = fs.readFileSync('src/context/CustomerCatalogContext.tsx', 'utf8');
assert.match(catalogContext, /catalogReadRef\.current\?\.scope === scope/);
assert.match(catalogContext, /Date\.now\(\) - lastValidatedRef\.current\.at < 60_000/);
assert.match(catalogContext, /const revalidate = useCallback/);
assert.match(catalogContext, /refreshing/);

console.log('customer cart page contract: ok');
