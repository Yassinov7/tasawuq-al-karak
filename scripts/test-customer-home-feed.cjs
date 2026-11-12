const assert = require("node:assert/strict");
const { load } = require("./syp-test-loader.cjs");

async function checkCatalogSections() {
  let finishMedia;
  let reportOffers;
  let readFinished = false;
  const queryLog = [];
  const data = {
    stores: [{ id: "store" }], products: [{ id: "product" }], store_offers: [{ id: "offer" }],
    store_offer_products: [{ id: "item", offer_id: "offer", product_id: "product", quantity: 2 }],
  };
  const media = new Promise(resolve => { finishMedia = resolve; });
  const offersReady = new Promise(resolve => { reportOffers = resolve; });
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: "customer" } } } }) },
    from(table) {
      queryLog.push(table);
      const query = {};
      for (const method of ["select", "eq", "in", "order", "lte", "or"]) query[method] = () => query;
      query.then = (resolve, reject) => (table === "product_media" ? media : Promise.resolve({ data: data[table] }))
        .then(resolve, reject);
      return query;
    },
  };
  const { getPublicCatalog } = load("src/lib/public-catalog.ts", {
    "@/lib/supabase": { supabase },
    "@/lib/local-cache": { writeLocalCache: async () => {} },
    "@/lib/catalog-categories": { readSelectableCategories: async scope => [{ id: scope }] },
  });

  let categories;
  const inflight = getPublicCatalog("customer", {
    categories: rows => { categories = rows; },
    offers: rows => reportOffers(rows),
  }).finally(() => { readFinished = true; });
  const partial = await offersReady;
  assert.equal(categories.productCategories[0].id, "product");
  assert.equal(partial.offerItems[0].quantity, 2);
  assert.equal(readFinished, false);
  assert.equal(queryLog.filter(table => table === "store_offer_products").length, 1);
  finishMedia({ data: [{ id: "image" }] });
  assert.equal((await inflight).productMedia[0].id, "image");
}

async function main() {
  let owner = "customer";
  let failMedia = false;
  let switchOwner = false;
  let failStores = false;
  let mediaGate;
  let markMediaStarted;
  const ads = ["store", "product", "offer"].map(target_kind => ({
    id: target_kind, target_kind, target_id: target_kind, media_path: target_kind,
    media_kind: target_kind === "offer" ? "video" : "image",
    thumbnail_path: target_kind === "offer" ? "offer.jpg" : null,
  }));
  const from = {
    stores: [{ id: "first" }, { id: "second" }],
    products: [{ id: "older" }, { id: "newer" }],
    product_media: [],
  };
  const query = data => {
    const result = {};
    for (const method of ["select", "eq", "in", "order"]) result[method] = () => result;
    result.abortSignal = async () => ({ data, error: null });
    return result;
  };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: owner } } } }) },
    rpc(name, args) {
      if (name === "read_customer_home_ads") return query(ads);
      assert.equal(name, "read_customer_home_discovery");
      assert.equal(args.seed_value, "stable");
      return query({ store_ids: ["second", "first", "second"], product_ids: ["newer", "older"] });
    },
    from: name => {
      const result = query(from[name]);
      if (name === "stores" && failStores) result.abortSignal = async () => ({ error: Error("store read failed") });
      if (name === "product_media" && mediaGate) result.abortSignal = async () => {
        markMediaStarted();
        await mediaGate;
        return { data: [], error: null };
      };
      return result;
    },
    storage: { from: bucket => {
      assert.equal(bucket, "customer-home-ads");
      return { createSignedUrls: async paths => {
        if (switchOwner) owner = "other";
        return { data: paths.map(path => ({ path, signedUrl: failMedia ? null : `signed:${path}` })) };
      } };
    } },
  };
  const mocks = { "@/lib/supabase": { supabase }, "@/lib/local-cache": {}, "@/lib/catalog-categories": {} };
  const { readHomeDiscovery } = load("src/lib/public-catalog.ts", mocks);
  const { readCustomerHomeAds, homeAdDestinations } = load("src/lib/customer-home-feed.ts", mocks);
  const signal = new AbortController().signal;
  const discovery = await readHomeDiscovery(owner, "stable", signal);
  assert.equal(discovery.stores.map(row => row.id).join(","), "second,first");
  assert.equal(discovery.products.map(row => row.id).join(","), "newer,older");
  let releaseMedia;
  mediaGate = new Promise(resolve => { releaseMedia = resolve; });
  const mediaStarted = new Promise(resolve => { markMediaStarted = resolve; });
  const publishedShelves = [];
  const progressive = readHomeDiscovery(owner, "stable", signal,
    (shelf, data, pending) => publishedShelves.push({ shelf, data, pending }));
  await mediaStarted;
  assert.ok(publishedShelves.some(result => result.shelf === "stores" && result.data.stores.length === 2));
  assert.ok(publishedShelves.some(result => result.shelf === "products" && result.pending && result.data.products.length === 2));
  releaseMedia();
  await progressive;
  mediaGate = undefined;
  failStores = true;
  const outcomes = {};
  await readHomeDiscovery(owner, "stable", signal, (shelf, data) => { outcomes[shelf] = data; });
  assert.equal(outcomes.stores, null);
  assert.equal(outcomes.products.products.length, 2);

  const aborted = new AbortController();
  mediaGate = new Promise(resolve => { releaseMedia = resolve; });
  const waiting = new Promise(resolve => { markMediaStarted = resolve; });
  const stale = [];
  const inflight = readHomeDiscovery(owner, "stable", aborted.signal, (shelf, data, pending) => stale.push({ shelf, data, pending }));
  await waiting;
  const beforeSwitch = stale.length;
  aborted.abort();
  owner = "other";
  releaseMedia();
  await inflight;
  assert.equal(stale.length, beforeSwitch);
  owner = "customer";
  mediaGate = undefined;
  const published = await readCustomerHomeAds(owner, signal);
  assert.equal(published.ads.map(ad => homeAdDestinations[ad.target_kind]).join(","), "/store-details,/product-details,/offer-details");
  assert.equal(published.ads[2].media_kind, "video");
  assert.equal(published.ads[2].thumbnailUrl, "signed:offer.jpg");
  assert.equal(published.ads[2].thumbnailKey, (await readCustomerHomeAds(owner, signal)).ads[2].thumbnailKey);
  ads[2].thumbnail_path = "replacement.jpg";
  assert.notEqual(published.ads[2].thumbnailKey, (await readCustomerHomeAds(owner, signal)).ads[2].thumbnailKey);
  assert.equal(published.ads[0].mediaKey, (await readCustomerHomeAds(owner, signal)).ads[0].mediaKey);
  ads[0].media_path = "replacement";
  assert.notEqual(published.ads[0].mediaKey, (await readCustomerHomeAds(owner, signal)).ads[0].mediaKey);
  failMedia = true;
  await assert.rejects(readCustomerHomeAds(owner, signal), /media unavailable/);
  switchOwner = true;
  await assert.rejects(readCustomerHomeAds(owner, signal), /تغير الحساب/);
  await checkCatalogSections();
  console.log("PASS independent category and offer reads, batched offer items, server ordering, isolated shelf failures, progressive media, cancelled owner reads, ad version and routing");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
