const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../.expo/onboarding-sql-check/node_modules/@electric-sql/pglite");
const { load } = require("./syp-test-loader.cjs");
const { normalizeCustomerSearchText } = load("src/lib/customer-search.ts");

async function checkReadScope() {
  let currentOwner = "first";
  let switchDuringRead = false;
  let calls = 0;
  const assertCatalogOwner = async expected => {
    if (currentOwner !== expected) throw Error("Account changed");
  };
  const { readStoreDirectoryPage } = load("src/lib/customer-store-directory.ts", {
    "@/lib/public-catalog": { assertCatalogOwner },
    "@/lib/supabase": { supabase: {
      rpc(name, args) {
        calls++;
        assert.equal(name, "read_customer_store_directory");
        assert.equal(args.query_value, "مخبز");
        assert.equal(args.category_value, "category");
        return { abortSignal: async () => {
          if (switchDuringRead) currentOwner = "second";
          return { data: Array.from({ length: 13 }, (_, i) => ({
            id: String(i), name: "متجر", category_id: "category", rank_key: String(i),
          })) };
        } };
      },
    } },
  });
  const signal = new AbortController().signal;
  const read = () => readStoreDirectoryPage("first", "seed", "مخبز", "category", null, signal);
  const page = await read();
  assert.equal(page.stores.length, 12);
  assert.equal(page.next.id, "11");
  switchDuringRead = true;
  await assert.rejects(read(), /Account changed/);
  await assert.rejects(read(), /Account changed/);
  assert.equal(calls, 2);
  console.log("PASS directory read rejects both a late old-account response and a request started after an account switch");
}

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create table public.stores(id uuid primary key, name text, category_id uuid, status text, eligible boolean);
      create table public.selectable_catalog_categories(id uuid primary key, scope text, parent_id uuid);
      create function public.store_accepts_new_orders(target uuid) returns boolean language sql stable
        as $$ select eligible from public.stores where id=target $$;
      insert into selectable_catalog_categories values
        ('00000000-0000-0000-0000-000000000001','store',null),
        ('00000000-0000-0000-0000-000000000002','store','00000000-0000-0000-0000-000000000001'),
        ('00000000-0000-0000-0000-000000000003','store',null);
      insert into stores
      select ('10000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,
        case when i = 30 then 'مَخبَز الأُسرة' else 'متجر ' || i end,
        ('00000000-0000-0000-0000-00000000000' || case when i <= 10 then 3 else 2 end)::uuid,
        case when i = 28 then 'pending' else 'accepted' end, i <> 29
      from generate_series(1, 30) i;
    `);
    await db.exec(fs.readFileSync("supabase/migrations/20261127000100_customer_store_directory.sql", "utf8"));
    for (const input of ["مَخبَز الأُسرة", " أُسـرة / أطعمة ", "مؤسسة ـ الآمال", "أَئِمَّة ١٢٣", "ABC / 5"]) {
      const { rows } = await db.query("select store_directory_private.normalize_name($1) as text", [input]);
      assert.equal(rows[0].text, normalizeCustomerSearchText(input), input);
    }

    const session = seed => async (query = "", category = null, cursor = null) => (
      await db.query("select * from public.read_customer_store_directory($1,$2,$3,$4,$5)",
        [seed, query, category, cursor?.rank_key ?? null, cursor?.id ?? null])
    ).rows;
    await db.exec("set role anon");
    const read = session("directory-seed");
    const first = await read();
    assert.equal(first.length, 13);
    assert.deepEqual(await read(), first);
    assert.notDeepEqual(await session("another-seed")(), first);
    const second = await read("", null, first[11]);
    const third = await read("", null, second[11]);
    const ids = [...first.slice(0, 12), ...second.slice(0, 12), ...third].map(row => row.id);
    assert.equal(ids.length, 28);
    assert.equal(new Set(ids).size, 28);
    assert.equal(first[12].id, second[0].id);
    assert.deepEqual(Object.keys(first[0]), ["id", "name", "category_id", "rank_key"]);
    const root = "00000000-0000-0000-0000-000000000001";
    const other = "00000000-0000-0000-0000-000000000003";
    assert.equal((await read("الاسره مخبز", root))[0].name, "مَخبَز الأُسرة");
    assert.deepEqual(await read("الاسره مخبز", other), []);
    assert.deepEqual(await read("29"), []);
    await assert.rejects(db.query("select store_directory_private.normalize_name('x')"), /permission denied/);
    await db.exec("reset role; set role authenticated");
    assert.deepEqual(await read(), first);
    console.log("PASS PostgreSQL directory: exact Arabic normalization, role access, eligibility, search + tree, stable cursor, narrow projection");
  } finally { await db.close(); }
}

main().then(checkReadScope).catch(error => { console.error(error); process.exitCode = 1; });
