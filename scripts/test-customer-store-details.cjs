const assert = require("node:assert/strict");
const fs = require("node:fs");
const { load } = require("./syp-test-loader.cjs");

async function main() {
  let owner = "customer";
  let available = true;
  let missing = false;
  let switchWhileSigning = false;
  let signed = 0;
  const filters = [];
  const query = {
    select(columns) { assert.equal(columns, "id,storage_path"); return query; },
    eq(key, value) { filters.push([key, value]); return query; },
    abortSignal() { return query; },
    maybeSingle: async () => ({ data: missing ? null : { id: "version", storage_path: "store/version.mp4" } }),
  };
  const supabase = {
    from: name => { assert.equal(name, "store_branding_assets"); return query; },
    rpc: (name, args) => {
      assert.equal(name, "store_accepts_new_orders");
      assert.equal(args.target_store, "store");
      return { abortSignal: async () => ({ data: available }) };
    },
    storage: { from: bucket => {
      assert.equal(bucket, "store-videos");
      return { createSignedUrl: async (path, seconds) => {
        assert.equal(path, "store/version.mp4");
        assert.equal(seconds, 600);
        signed++;
        if (switchWhileSigning) owner = "another";
        return { data: { signedUrl: "signed" } };
      } };
    } },
  };
  const { readCustomerStoreIdentity, signPublishedStoreVideo } = load("src/lib/customer-store-details.ts", {
    "@/lib/supabase": { supabase },
    "@/lib/public-catalog": { assertCatalogOwner: async expected => { if (expected !== owner) throw Error("Account changed"); } },
  });
  const signal = new AbortController().signal;
  const result = await readCustomerStoreIdentity("store", "customer", signal);
  assert.deepEqual(filters, [["store_id", "store"], ["kind", "promo_video"], ["state", "current"], ["is_current", true]]);
  assert.equal(result.video.id, "version");
  assert.equal(signed, 0);
  assert.equal(await signPublishedStoreVideo(result.video, "customer", signal), "signed");
  available = false;
  const paused = await readCustomerStoreIdentity("store", "customer", signal);
  assert.equal(paused.acceptsOrders, false);
  assert.equal(paused.video.id, "version");
  available = true;
  missing = true;
  assert.equal((await readCustomerStoreIdentity("store", "customer", signal)).video, null);
  switchWhileSigning = true;
  await assert.rejects(signPublishedStoreVideo(result.video, "customer", signal), /Account changed/);
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(signPublishedStoreVideo(result.video, "another", aborted.signal), /cancelled/);
  assert.equal(signed, 2);
  const videoSource = fs.readFileSync("src/components/marketplace/StorePromoVideo.tsx", "utf8");
  assert.match(videoSource, /onFullscreenEnter/);
  assert.match(videoSource, /onFullscreenExit/);
  assert.match(videoSource, /if \(fullscreen\.current\) return;/);
  assert.match(videoSource, /surfaceType="surfaceView"/);
  assert.match(videoSource, /<BrandMark size="medium"/);
  assert.doesNotMatch(videoSource, /logo\?: \{ url:/);
  const pageSource = fs.readFileSync("src/app/store-details.tsx", "utf8");
  assert.doesNotMatch(pageSource, /<RatingsSection/);
  assert.match(pageSource, /pathname: "\/store-reviews"/);
  const reviewsSource = fs.readFileSync("src/app/store-reviews.tsx", "utf8");
  assert.match(reviewsSource, /<RatingsSection kind="store"/);
  console.log("PASS current-only promo metadata, no signing until request, independent order status, missing asset and session/abort isolation");
  console.log("PASS fullscreen lifecycle guard, recommended Android surface, official brand preview and independent store reviews route");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
