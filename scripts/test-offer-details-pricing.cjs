const assert = require("node:assert/strict");
const fs = require("node:fs");
const { load } = require("./syp-test-loader.cjs");

const { calculateCustomerOffer } = load("src/lib/customer-offers.ts");
const { getOfferPriceSummary } = load("src/lib/offer-presentation.ts");
const { calculateOfferRemaining, formatOfferCountdown } = load("src/lib/offer-countdown.ts");
const product = (id, price) => ({ id, name: id, price, unit: "قطعة", available: true });
const base = { id: "o", store_id: "s", title: "عرض", description: "", currency: "SYP", starts_at: "2026-01-01", ends_at: null, is_active: true };

const bundle = { ...base, offer_type: "bundle", discount_method: null, discount_value: null, bundle_price: 250,
  items: [
    { id: "a", itemRole: "bundle", quantity: 2, product: product("أ", 100) },
    { id: "b", itemRole: "bundle", quantity: 3, product: product("ب", 50) },
  ] };
const bundleSummary = getOfferPriceSummary(bundle);
assert.equal(bundleSummary.originalTotal, 350);
assert.equal(bundleSummary.finalTotal, 250);
assert.equal(bundleSummary.savings, 100);
assert.equal(bundleSummary.items.reduce((sum, item) => sum + item.finalLineTotal, 0), 250);

const discount = { ...base, offer_type: "discount", discount_method: "percentage", discount_value: 20, bundle_price: null,
  items: [{ id: "a", itemRole: "discounted", quantity: 2, product: product("أ", 100) }] };
const discountSummary = calculateCustomerOffer(discount);
assert.equal(discountSummary.currency, "SYP");
assert.equal(discountSummary.originalTotal, 200);
assert.equal(discountSummary.finalTotal, 160);
assert.equal(discountSummary.items[0].originalLineTotal, 200);
assert.equal(discountSummary.items[0].finalLineTotal, 160);

const gift = { ...base, offer_type: "buy_x_get_y", discount_method: null, discount_value: null, bundle_price: null,
  items: [
    { id: "a", itemRole: "buy", quantity: 2, product: product("أ", 100) },
    { id: "b", itemRole: "reward", quantity: 1, product: product("ب", 50) },
  ] };
const giftSummary = getOfferPriceSummary(gift);
assert.equal(giftSummary.originalTotal, 250);
assert.equal(giftSummary.finalTotal, 200);
assert.equal(giftSummary.savings, 50);

const details = fs.readFileSync("src/app/offer-details.tsx", "utf8");
const cardSource = fs.readFileSync("src/components/marketplace/OfferCard.tsx", "utf8");
const clockSource = fs.readFileSync("src/hooks/useOfferCountdown.ts", "utf8");
assert.match(details, /قيمة المنتجات منفردة/);
assert.match(details, /summary\.savings > 0/);
assert.match(details, /offer\.offer_type === "bundle"/);
assert.match(details, /قيمتها منفردة/);
assert.match(details, /item\.itemRole === "reward"/);
assert.match(details, /if \(!offer \|\| adding \|\| inCart \|\| unavailable \|\| expired\) return/);
assert.match(details, /title=\{expired \? "انتهى العرض"/);
assert.match(details, /<\/ScrollView>[\s\S]+styles\.actions/);
assert.match(details, /scroller: \{ flex: 1, minHeight: 0 \}/);
assert.doesNotMatch(details, /actionPrice|actionSummary/);

const now = Date.parse("2026-11-20T10:00:00.000Z");
const remaining = milliseconds => calculateOfferRemaining(new Date(now + milliseconds).toISOString(), now);
assert.equal(formatOfferCountdown(remaining((2 * 24 + 22) * 60 * 60_000 + 50 * 60_000)), "متبقٍ 2 يوم و22 س و50 د");
assert.equal(formatOfferCountdown(remaining(5 * 60 * 60_000 + 30 * 60_000), true), "متبقٍ 5 س و30 د");
assert.equal(formatOfferCountdown(remaining(25 * 60_000), true), "متبقٍ 25 د");
assert.equal(formatOfferCountdown(calculateOfferRemaining(new Date(now).toISOString(), now), true), "انتهى العرض");
assert.equal(formatOfferCountdown(calculateOfferRemaining(null, now), true), null);
assert.doesNotMatch(cardSource, /setInterval|setTimeout/);
assert.match(cardSource, /useOfferCountdown\(offer\.ends_at, true, offer\.id\)/);
assert.match(clockSource, /AppState\.addEventListener\("change"/);
assert.match(clockSource, /if \(next === "active"\) publishNow\(\)/);
assert.match(clockSource, /if \(listeners\.size === 0\)/);
console.log("offer details pricing contract: ok");
