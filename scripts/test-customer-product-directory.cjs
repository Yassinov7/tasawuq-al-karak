const fs = require("node:fs");
const assert = require("node:assert/strict");

const sql = fs.readFileSync("supabase/migrations/20261128000100_customer_product_directory.sql", "utf8");
const page = fs.readFileSync("src/app/(customer)/products.tsx", "utf8");
const hook = fs.readFileSync("src/hooks/useProductDirectory.ts", "utf8");

assert.match(sql, /create function public\.read_customer_product_directory/);
assert.match(sql, /limit 13/i);
assert.match(sql, /p\.is_available and s\.status = 'accepted'/);
assert.match(sql, /public\.store_accepts_new_orders/);
assert.match(sql, /with recursive chosen_categories/);
assert.match(sql, /price-ascending/);
assert.match(sql, /price-descending/);
assert.match(page, /content: \{[^\n]+direction: "rtl"/);
assert.match(page, /<ProductCard/);
assert.match(page, /ProductRefinements/);
assert.match(hook, /setTimeout\(\(\) => setDebounced\(query\), query \? 270 : 0\)/);
assert.match(hook, /new Map\(\(mode === "more"/);

console.log("customer product directory contract: ok");
