const assert = require("node:assert/strict");
const fs = require("node:fs");
const { load } = require("./syp-test-loader.cjs");

const database = fs.readFileSync("src/types/database.ts", "utf8");
const catalog = fs.readFileSync("src/lib/public-catalog.ts", "utf8");
const context = fs.readFileSync("src/context/CustomerCatalogContext.tsx", "utf8");
const card = fs.readFileSync("src/components/marketplace/OfferCard.tsx", "utf8");
const details = fs.readFileSync("src/app/offer-details.tsx", "utf8");
const hook = fs.readFileSync("src/hooks/useOfferCountdown.ts", "utf8");
const { calculateOfferRemaining, formatOfferCountdown } = load("src/lib/offer-countdown.ts");

assert.match(database, /store_offers:[\s\S]+ends_at: string \| null/);
assert.match(catalog, /\.rpc\("read_customer_active_offers"\)/);
assert.match(catalog, /\.rpc\("read_customer_next_offer_transition"\)/);
assert.doesNotMatch(catalog, /\.lte\("starts_at", now\)/);
assert.match(context, /wait for the server-clock RPC/);
assert.match(context, /\? \[\{ \.\.\.offer, items \}\]/);
assert.match(card, /useOfferCountdown\(offer\.ends_at, true, offer\.id\)/);
assert.match(details, /useOfferCountdown\(offer\?\.ends_at, false, offer\?\.id\)/);
assert.match(hook, /missing ends_at/);
assert.match(hook, /invalid ends_at/);

const now = Date.parse("2026-11-20T10:00:00.000Z");
const row = { id: "offer-real", ends_at: "2026-11-22T08:50:00.000Z" };
const customerOffer = { ...row, items: [] };
assert.equal(customerOffer.ends_at, row.ends_at);
const remaining = calculateOfferRemaining(customerOffer.ends_at, now);
assert.equal(formatOfferCountdown(remaining), "متبقٍ 1 يوم و22 س و50 د");
assert.equal(formatOfferCountdown(remaining, true), "متبقٍ 1 يوم و22 س");
assert.equal(formatOfferCountdown(calculateOfferRemaining(null, now), true), null);
console.log("offer countdown database-to-UI pipeline contract: ok");
