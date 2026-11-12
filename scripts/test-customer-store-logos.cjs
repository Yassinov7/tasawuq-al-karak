const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

async function main() {
  const filters = [];
  let actor = null;
  let assetId = "first";
  let calls = 0;
  let switchDuringSigning = false;
  let batchEntryFails = false;
  let individualCalls = 0;
  const query = {};
  for (const name of ["select", "eq", "in"]) query[name] = (...args) => {
    filters.push([name, ...args]);
    return query;
  };
  query.abortSignal = async () => ({ data: [{ id: assetId, store_id: "store", storage_path: assetId }] });
  const supabase = {
    auth: { getSession: async () => ({ data: { session: actor ? { user: { id: actor } } : null } }) },
    from: table => { assert.equal(table, "store_branding_assets"); return query; },
    storage: { from: bucket => {
      assert.equal(bucket, "store-logos");
      return { createSignedUrls: async (paths, ttl) => {
        calls++;
        assert.equal(ttl, 60);
        if (switchDuringSigning) actor = "other";
        return { data: paths.map(path => batchEntryFails ? { path, error: "signing failed" } : { path, signedUrl: "signed:" + path }) };
      }, createSignedUrl: async path => {
        individualCalls++;
        return { data: { signedUrl: "individual:" + path } };
      } };
    }},
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/customer-store-logos.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: () => ({ supabase }), Date });
  const signal = new AbortController().signal;
  const first = await exports.readCustomerStoreLogos(["store"], null, signal);
  assert.equal(first.logos.get("store").key, "store-logo:guest:first");
  assert(filters.some(entry => entry[1] === "is_current" && entry[2] === true));
  assert(filters.some(entry => entry[1] === "kind" && entry[2] === "logo"));
  assetId = "replacement";
  const second = await exports.readCustomerStoreLogos(["store"], null, signal);
  assert.equal(second.logos.get("store").key, "store-logo:guest:replacement");
  assert.equal(calls, 2);
  batchEntryFails = true;
  const recovered = await exports.readCustomerStoreLogos(["store"], null, signal);
  assert.equal(recovered.logos.get("store").url, "individual:replacement");
  assert.equal(individualCalls, 1);
  actor = "customer"; switchDuringSigning = true;
  await assert.rejects(exports.readCustomerStoreLogos(["store"], "customer", signal), /scope changed/);
  console.log("PASS published logo filters, batched signing, replacement cache key and late account isolation");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
