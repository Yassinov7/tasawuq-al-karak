const assert = require("node:assert/strict");
const fs = require("node:fs");
const { load } = require("./syp-test-loader.cjs");

const source = fs.readFileSync("src/app/product-details.tsx", "utf8");
const gallery = fs.readFileSync("src/components/marketplace/ProductMediaGallery.tsx", "utf8");
const productCard = fs.readFileSync("src/components/marketplace/ProductCard.tsx", "utf8");
const productReviews = fs.readFileSync("src/app/product-reviews.tsx", "utf8");
assert.match(source, /contentContainerStyle=\{styles\.content\}/);
assert.match(source, /content: \{[^\n]+direction: "rtl"/);
assert.match(source, /title="إضافة إلى السلة"/);
assert.match(source, /loading=\{adding\}/);
assert.match(source, /Math\.round\(product\.price \* selectedQuantity \* 100\) \/ 100/);
assert.match(source, /<OfferCard/);
assert.match(source, /pathname: "\/product-reviews"/);
assert.doesNotMatch(source, /<RatingsSection/);
assert.doesNotMatch(source, /TextInput|ملاحظة المنتج/);
assert.match(gallery, /categoryLabel/);
assert.match(gallery, /ضمن عرض/);
assert.match(productCard, /backgroundColor: colors\.primaryLight/);
assert.doesNotMatch(productCard, /backgroundColor: offerLabel/);
assert.match(productReviews, /<RatingsSection kind="product"/);
assert.match(productReviews, /productId=\{product\.id\}/);

const quantity = load("src/lib/catalog-quantity.ts");
assert.equal(quantity.snapCatalogQuantity(1, 0.5, 0.25), 1);
assert.equal(quantity.snapCatalogQuantity(0.6, 0.5, 0.25), 0.75);
assert.equal(quantity.snapCatalogQuantity(0, 2, 2), 2);

console.log("product details presentation contract: ok");
