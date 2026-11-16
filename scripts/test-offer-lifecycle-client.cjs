const assert = require('node:assert/strict');
const fs = require('node:fs');

const types = fs.readFileSync('src/types/database.ts', 'utf8');
const editor = fs.readFileSync('src/lib/merchant-offer-editor.ts', 'utf8');
const adapter = fs.readFileSync('src/lib/merchant-offer-editor-api.ts', 'utf8');
const form = fs.readFileSync('src/components/merchant/MerchantOfferForm.tsx', 'utf8');
const datePicker = fs.readFileSync('src/components/merchant/OfferExpirationPicker.tsx', 'utf8');
const catalog = fs.readFileSync('src/lib/public-catalog.ts', 'utf8');
const context = fs.readFileSync('src/context/CustomerCatalogContext.tsx', 'utf8');
const search = fs.readFileSync('src/app/home/search.tsx', 'utf8');
const storeDetails = fs.readFileSync('src/app/store-details.tsx', 'utf8');
const cartSql = fs.readFileSync('supabase/migrations/20261026000100_syp_only_architecture.sql', 'utf8');

assert.match(types, /read_customer_active_offers:[\s\S]+read_customer_next_offer_transition/);
assert.match(types, /save_store_offer_v2:[\s\S]+input_starts_at: string/);
assert.match(editor, /startMode:"now"\|"keep"\|"scheduled"/);
assert.match(editor, /\(!offerId\|\|form\.active\)&&end===null/);
assert.match(adapter, /rpc\('save_store_offer_v2',args\)/);
assert.match(form, /kind="start"/);
assert.match(datePicker, /يبدأ الآن/);
assert.match(catalog, /rpc\("read_customer_active_offers"\)/);
assert.match(catalog, /rpc\("read_customer_next_offer_transition"\)/);
assert.doesNotMatch(catalog, /\.lte\("starts_at", now\)/);
assert.match(context, /offers: \[\], offerItems: \[\]/);
assert.match(context, /transitionTimer/);
assert.doesNotMatch(search, /Date\.parse\(offer\.ends_at\)/);
assert.match(storeDetails, /Eligibility is centralized in CustomerCatalogContext/);

// The established server contracts remain the final authority for cart and checkout.
assert.match(cartSql, /create or replace function public\.add_customer_cart_offer/);
assert.match(cartSql, /o\.starts_at > now\(\)/);
assert.match(cartSql, /o\.ends_at is not null and o\.ends_at <= now\(\)/);
assert.match(cartSql, /create or replace function public\.create_order_from_cart/);

console.log('offer lifecycle phase-2 client contract: ok');
