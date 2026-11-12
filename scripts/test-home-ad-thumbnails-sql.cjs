const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../.expo/onboarding-sql-check/node_modules/@electric-sql/pglite");
const migration = name => fs.readFileSync("supabase/migrations/" + name, "utf8");

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit integer, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text, metadata jsonb, primary key(bucket_id, name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated;
      grant select on storage.objects to anon, authenticated;
      create table public.stores(id uuid primary key, status text);
      create table public.products(id uuid, store_id uuid, is_available boolean);
      create table public.store_offers(id uuid, store_id uuid, is_active boolean, starts_at timestamptz, ends_at timestamptz);
      create table public.store_offer_products(offer_id uuid, product_id uuid);
      create function public.is_admin() returns boolean language sql as
        $$ select coalesce(current_setting('test.admin', true), '') = 'yes' $$;
      create function public.store_accepts_new_orders(store_id uuid) returns boolean language sql as
        $$ select exists(select 1 from public.stores where id = store_id and status = 'accepted') $$;
      create function public.set_updated_at() returns trigger language plpgsql as
        $$ begin new.updated_at := now(); return new; end $$;
    `);
    await db.exec(migration("20261125000100_customer_home_ads.sql"));
    const store = "00000000-0000-4000-8000-000000000001";
    const ad = "00000000-0000-4000-8000-000000000002";
    const base = ad + "/00000000-0000-4000-8000-000000000003";
    const other = ad + "/00000000-0000-4000-8000-000000000004.jpg";
    await db.exec(`
      insert into public.stores values ('${store}', 'accepted');
      insert into storage.objects values
        ('customer-home-ads', '${base}.mp4', '{"mimetype":"video/mp4"}'),
        ('customer-home-ads', '${base}.jpg', '{"mimetype":"image/jpeg"}'),
        ('customer-home-ads', '${other}', '{"mimetype":"image/jpeg"}');
      insert into public.customer_home_ads(id,target_kind,target_id,media_kind,media_path,starts_at,ends_at)
      values ('${ad}','store','${store}','video','${base}.mp4',now()-interval '1 hour',now()+interval '1 hour');
    `);
    await db.exec(migration("20261126000100_customer_home_ad_thumbnails.sql"));
    assert.equal((await db.query("select thumbnail_path from public.customer_home_ads")).rows[0].thumbnail_path, null);
    await assert.rejects(db.exec(`update public.customer_home_ads set thumbnail_path = '${other}'`), /thumbnail_matches_video/);
    await db.exec(`delete from storage.objects where name = '${base}.jpg'`);
    await assert.rejects(db.exec(`update public.customer_home_ads set thumbnail_path = '${base}.jpg'`), /thumbnail unavailable/);
    await db.exec(`insert into storage.objects values ('customer-home-ads','${base}.jpg','{"mimetype":"image/jpeg"}')`);
    await db.exec(`update public.customer_home_ads set thumbnail_path = '${base}.jpg'`);
    async function client(role) {
      await db.exec("set role " + role);
      try {
        return {
          media: (await db.query("select name from storage.objects order by name")).rows.map(row => row.name),
          ads: (await db.query("select * from public.read_customer_home_ads()")).rows,
        };
      } finally { await db.exec("reset role"); }
    }
    assert.deepEqual((await client("anon")).media, []);
    await db.exec("update public.customer_home_ads set is_active = true");
    for (const role of ["anon", "authenticated"]) {
      const visible = await client(role);
      assert.deepEqual(visible.media, [base + ".jpg", base + ".mp4"]);
      assert.equal(visible.ads[0].thumbnail_path, base + ".jpg");
      assert.ok(!Object.hasOwn(visible.ads[0], "admin_note"));
    }
    await db.exec("set test.admin = 'yes'");
    assert.equal((await db.query(`select public.can_delete_customer_ad_media('${base}.jpg') as allowed`)).rows[0].allowed, false);
    assert.equal((await db.query(`select public.can_delete_customer_ad_media('${other}') as allowed`)).rows[0].allowed, true);
    await db.exec("reset test.admin");
    await db.exec("update public.stores set status='disabled'");
    assert.deepEqual((await client("anon")).media, []);
    assert.deepEqual((await client("anon")).ads, []);
    await db.exec("update public.stores set status='accepted'");
    await db.exec("update public.customer_home_ads set starts_at=now()-interval '2 hours', ends_at=now()-interval '1 hour'");
    assert.deepEqual((await client("anon")).media, []);
    assert.deepEqual((await client("anon")).ads, []);
    console.log("PASS PostgreSQL fixture: legacy ad upgrade, exact JPEG pairing, private RLS, linked deletion protection and unchanged target/schedule rules");
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
