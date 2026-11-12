const assert = require("node:assert/strict");
const { load } = require("./syp-test-loader.cjs");

async function main() {
  let owner = "manager";
  let admin = true;
  let changeOwner = false;
  const reads = [];
  const tables = {
    stores: [{ id: "store", name: "البقالة", status: "accepted" }],
    products: [
      { id: "p1", title: "حليب", store_id: "store", is_available: true },
      { id: "p2", title: "حليب", store_id: "other", is_available: true },
    ],
    store_offers: [{ id: "offer", title: "وجبة", store_id: "store", is_active: true, ends_at: "2020-01-01" }],
    store_offer_products: [{ offer_id: "offer", product_id: "p1" }],
    product_media: [{ product_id: "p1", storage_path: "public/milk", media_type: "image" }],
  };

  function from(table) {
    let rows = tables[table];
    const query = {
      select: () => query,
      order: () => query,
      limit: count => { rows = rows.slice(0, count); return query; },
      eq: (key, value) => { rows = rows.filter(row => row[key] === value); return query; },
      ilike: (key, value) => { rows = rows.filter(row => row[key].includes(value.slice(1, -1))); return query; },
      in: (key, values) => { rows = rows.filter(row => values.includes(row[key])); return query; },
      abortSignal: async signal => {
        reads.push(table);
        if (changeOwner) owner = "other";
        return { data: rows, error: signal.aborted ? Error("aborted") : null };
      },
    };
    return query;
  }

  const { readHomeAdTargets } = load("src/lib/home-ad-targets.ts", {
    "@/lib/personal-account": { assertAccount: async id => { if (id !== owner) throw Error("account changed"); } },
    "@/lib/merchant-store": { getStoreMediaUrl: path => "https://example.invalid/" + path },
    "@/lib/supabase": { supabase: { from, rpc: name => {
      assert.equal(name, "is_admin");
      return { abortSignal: async () => ({ data: admin }) };
    } } },
  });
  const signal = new AbortController().signal;
  const [store] = await readHomeAdTargets(owner, "store", { search: "بقال" }, signal);
  assert.equal(store.name, "البقالة");
  const products = await readHomeAdTargets(owner, "product", { storeId: store.id, search: "حليب" }, signal);
  assert.equal(products.length, 1);
  assert.equal(products[0].id, "p1");
  assert.ok(products[0].image.endsWith("/milk"));
  const [savedOffer] = await readHomeAdTargets(owner, "offer", { id: "offer" }, signal);
  assert.equal(savedOffer.storeId, store.id);
  assert.equal(savedOffer.unavailable, true);
  assert.ok(savedOffer.image.endsWith("/milk"));
  assert.equal((await readHomeAdTargets(owner, "offer", { id: "deleted" }, signal)).length, 0);

  admin = false;
  const before = reads.length;
  await assert.rejects(readHomeAdTargets(owner, "store", {}, signal), /صلاحية الإدارة/);
  assert.equal(reads.length, before);
  admin = true;
  changeOwner = true;
  await assert.rejects(readHomeAdTargets(owner, "store", {}, signal), /account changed/);
  console.log("PASS ad target search, store scope, images, saved/missing/expired target, admin and account guards");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
