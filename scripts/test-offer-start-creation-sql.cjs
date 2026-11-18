// Actual v1/v2 save functions + original trigger/publisher in disposable PostgreSQL.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../.expo/onboarding-sql-check/node_modules/@electric-sql/pglite");
const read = name => fs.readFileSync("supabase/migrations/"+name,"utf8");
function definition(source, marker) {
  const start=source.indexOf(marker);
  assert(start>=0,marker);
  return source.slice(start,source.indexOf("$$;",start)+3);
}
async function main() {
  const db=new PGlite();
  const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  const [customer,merchant,shop,business,product]=[1,2,3,4,5].map(id);
  const one=async sql=>(await db.query(sql)).rows[0];
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema notification_private;
      create function auth.uid() returns uuid language sql as $$select '${merchant}'::uuid$$;
      create type store_offer_type as enum('discount','bundle','buy_x_get_y');
      create type offer_discount_method as enum('percentage','fixed_amount');
      create type offer_product_role as enum('discounted','bundle','buy','reward');
      create type currency_code as enum('SYP');
      create table profiles(id uuid primary key,role text);
      create table merchants(id uuid primary key,owner_user_id uuid,status text);
      create table stores(id uuid primary key,merchant_id uuid,name text,status text);
      create table products(id uuid primary key,store_id uuid,price numeric,is_available boolean);
      create table store_offer_products(store_id uuid,offer_id uuid,product_id uuid,item_role offer_product_role,quantity numeric);
      create table store_notification_follows(user_id uuid,store_id uuid,followed_at timestamptz);
      create table store_offer_notification_preferences(user_id uuid,enabled boolean,changed_at timestamptz);
      create table notifications(user_id uuid,type text,title text,body text,data jsonb,event_key text unique);
      create table notification_private.offer_start_events(offer_id uuid primary key);
      insert into profiles values ('${customer}','customer');
      insert into merchants values ('${business}','${merchant}','accepted');
      insert into stores values ('${shop}','${business}','fixture','accepted');
      insert into products values ('${product}','${shop}',100,true);
      insert into store_notification_follows values ('${customer}','${shop}',now()-interval '1 day');
      insert into store_offer_notification_preferences values ('${customer}',true,now()-interval '1 day');
    `);
    const catalog=read("20260930000200_store_catalog_offers.sql");
    const tableStart=catalog.indexOf("create table public.store_offers (");
    await db.exec(catalog.slice(tableStart,catalog.indexOf("\n);",tableStart)+3));
    await db.exec(definition(read("20261026000100_syp_only_architecture.sql"),"create or replace function public.save_store_offer("));
    await db.exec(definition(read("20261129000100_offer_lifecycle_phase1.sql"),"create or replace function public.save_store_offer_v2("));
    const central=read("20261202000100_central_notifications.sql");
    await db.exec(definition(central,"create function notification_private.publish_offer_starts()"));
    await db.exec(definition(central,"create function notification_private.retain_started_offer()"));
    await db.exec(definition(central,"create function public.set_store_offer_notifications("));
    await db.exec("create trigger retain_started_offer after update of starts_at on store_offers for each row execute function notification_private.retain_started_offer()");
    const save=async start=>{
      // Match the RPC transaction: transaction begins before the SELECT statement.
      await db.exec("begin");
      try {
        const result=await one(`select save_store_offer_v2(null,'اختبار','', 'discount','percentage',10,null,
          ${start},now()+interval '2 days',true,
          '[{"product_id":"${product}","item_role":"discounted","quantity":1}]') id`);
        await db.exec("commit");
        return result.id;
      } catch(error) { await db.exec("rollback"); throw error; }
    };
    const consumed=async offer=>(await one(`select exists(select 1 from notification_private.offer_start_events where offer_id='${offer}') yes`)).yes;
    const originalImmediate=await save("statement_timestamp()-interval '1 millisecond'");
    const originalScheduled=await save("statement_timestamp()+interval '5 minutes'");
    assert(await consumed(originalImmediate));
    assert(await consumed(originalScheduled));
    assert.equal((await one("select notification_private.publish_offer_starts() n")).n,0);
    console.log("REPRODUCED original v2 save consumes both new immediate and scheduled offers before Cron");
    const diagnostics=fs.readFileSync("supabase/verification/offer_start_incident_readonly.sql","utf8")
      .replace("null::uuid",`'${originalImmediate}'::uuid`)
      .replace("null::uuid",`'${originalScheduled}'::uuid`);
    const report=await db.exec(diagnostics);
    const fingerprints=report.flatMap(result=>result.rows).filter(row=>Object.hasOwn(row,"matches_original_local_body"));
    assert.equal(fingerprints.length,5);
    assert(fingerprints.every(row=>row.matches_original_local_body===true),JSON.stringify(fingerprints));
    const offers=report.flatMap(result=>result.rows).filter(row=>Object.hasOwn(row,"recipient_predicate_now"));
    assert.equal(offers.length,2);
    assert(offers.every(row=>row.consumed && row.recipient_predicate_now && row.json_offer_notifications===0));
    const json=JSON.stringify(report);
    assert(!json.includes(customer)); assert(!json.includes(merchant));
    await db.exec(read("20261203000100_offer_start_creation_guard.sql"));
    const immediate=await save("statement_timestamp()-interval '1 millisecond'");
    const scheduled=await save("statement_timestamp()+interval '5 minutes'");
    assert.equal(await consumed(immediate),false);
    assert.equal(await consumed(scheduled),false);
    assert.equal((await one("select notification_private.publish_offer_starts() n")).n,1);
    await db.exec(`update store_offers set starts_at=statement_timestamp() where id='${scheduled}'`);
    assert.equal((await one("select notification_private.publish_offer_starts() n")).n,1);
    assert.equal((await one("select notification_private.publish_offer_starts() n")).n,0);
    assert(await consumed(originalImmediate)); assert(await consumed(originalScheduled));
    await db.exec(`update store_offers set starts_at=statement_timestamp()+interval '1 hour' where id='${immediate}'`);
    assert(await consumed(immediate));
    // Existing active offer with no marker still retains its past start on reschedule.
    await db.exec(`insert into store_offers(store_id,title,offer_type,discount_method,discount_value,created_at,starts_at,ends_at)
      values('${shop}','سابق','discount','percentage',10,now()-interval '1 day',now()-interval '1 hour',now()+interval '2 days');
      update store_offers set starts_at=now()+interval '1 hour' where title='سابق';`);
    assert.equal((await one("select count(*)::int n from notification_private.offer_start_events")).n,5);
    assert.equal((await one("select count(*)::int n from notifications")).n,2);
    console.log("PASS fixed initialization, immediate/scheduled one-time publication, old markers preserved, established-start reschedule retained; no remote DB");
  } finally { await db.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
