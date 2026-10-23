// Offline source-contract checks; no PostgreSQL/API connection or app startup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root,
  'supabase/migrations/20261018001500_review_views_invoker_security.sql'), 'utf8');
const projections = {
  store_reviews: ['id', 'store_id', 'rating', 'comment', 'created_at', 'updated_at'],
  product_reviews: ['id', 'product_id', 'product_title_snapshot', 'rating', 'comment', 'created_at', 'updated_at'],
};
for (const [table, expected] of Object.entries(projections)) {
  const grants = [...sql.matchAll(new RegExp(`grant select \\(([^)]+)\\)\\s+on public\\.${table} to anon, authenticated;`, 'g'))];
  assert.equal(grants.length, 1);
  assert.deepEqual(grants[0][1].split(',').map((column) => column.trim()), expected);
  assert(sql.includes(`alter table public.${table} enable row level security;`));
  assert(!new RegExp(`grant select on (?:table )?public\\.${table}\\b`).test(sql));
}
for (const view of ['product_public_reviews', 'product_rating_summaries', 'store_public_reviews', 'store_rating_summaries']) {
  assert(sql.includes(`alter view public.${view} set (security_invoker = true, security_barrier = true);`));
  assert(fs.readFileSync(path.join(root, 'src/lib/customer-reviews.ts'), 'utf8').includes(`from("${view}")`));
}
for (const policy of ['stores_read_accepted_public', 'stores_subscription_grace_read_gate',
  'products_read_available_owner_admin', 'products_subscription_grace_read_gate']) {
  assert(new RegExp(`alter policy ${policy} on public\\.(stores|products) to authenticated;`).test(sql));
}
assert(sql.includes('p.store_id = product_reviews.store_id'));
assert(sql.includes('p.is_available and public.store_accepts_new_orders(p.store_id)'));
assert.equal((sql.match(/as restrictive for select to anon/g) || []).length, 2);
assert(!/grant\s+(?:select|all).*?on\s+public\.merchants/i.test(sql));
assert(!/security definer|create (?:or replace )?function|disable row level security|delete from|truncate /i.test(sql));
const test = fs.readFileSync(path.join(root, 'supabase/tests/phase_10_4_review_views_security.sql'), 'utf8');
assert(test.includes('set local role anon;') && test.includes('set local role authenticated;'));
assert(test.includes('as restrictive for select to anon,authenticated using(false)'));
assert(test.includes('NEEDS FIXTURES') && /rollback;\s*$/.test(test));
console.log('PASS: four invoker views, public-column allowlists, catalog anon isolation and rollback SQL test contract. PostgreSQL execution still required on staging.');
