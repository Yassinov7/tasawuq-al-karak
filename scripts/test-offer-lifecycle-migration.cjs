const assert = require("node:assert/strict");
const fs = require("node:fs");

const sql = fs.readFileSync("supabase/migrations/20261129000100_offer_lifecycle_phase1.sql", "utf8");
assert.match(sql, /create or replace function public\.read_customer_active_offers\(\)/);
assert.match(sql, /o\.starts_at <= statement_timestamp\(\)/);
assert.match(sql, /o\.ends_at is null or o\.ends_at > statement_timestamp\(\)/);
assert.match(sql, /create or replace function public\.read_customer_next_offer_transition\(\)/);
assert.match(sql, /create or replace function public\.save_store_offer_v2\(/);
assert.match(sql, /input_starts_at timestamptz/);
assert.match(sql, /input_ends_at timestamptz/);
assert.match(sql, /selected_offer is null or coalesce\(input_is_active, true\)/);
assert.match(sql, /input_ends_at <= input_starts_at/);
assert.match(sql, /saved_offer := public\.save_store_offer\(/);
assert.match(sql, /set starts_at = input_starts_at/);
assert.doesNotMatch(sql, /update public\.store_offers[\s\S]+set ends_at/);
assert.doesNotMatch(sql, /alter column ends_at set not null/);
console.log("offer lifecycle phase-1 migration contract: ok");
