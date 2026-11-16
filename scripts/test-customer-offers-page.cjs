const assert = require("node:assert/strict");
const fs = require("node:fs");
const { load } = require("./syp-test-loader.cjs");

const source = fs.readFileSync("src/app/(customer)/home/offers.tsx", "utf8");
assert.match(source, /normalizeCustomerSearchText\(searchText\)/);
assert.match(source, /<OffersContent key=\{scope\}/);
assert.match(source, /matchesAllCustomerSearchTerms\(searchable, terms\)/);
assert.match(source, /categoryFilterIds\(categories, selectedCategory\)/);
assert.match(source, /fontScale > 1\.25 \? 1 : 2/);
assert.match(source, /<OfferCard/);
assert.match(source, /compact cardWidth=\{cardWidth\}/);
assert.match(source, /style=\{\{ width: cardWidth \}\}/);
assert.match(source, /pathname: "\/offer-details"/);
assert.match(source, /content: \{[^\n]+direction: "rtl"/);

const search = load("src/lib/customer-search.ts");
assert.equal(search.normalizeCustomerSearchText("  عَرْض آلذَّهَب "), "عرض الذهب");
assert.equal(search.matchesAllCustomerSearchTerms("باقة خبز وحليب", ["باقه", "حليب"]), true);
console.log("customer offers page contract: ok");
