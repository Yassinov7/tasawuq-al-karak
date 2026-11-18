// Disposable synthetic PostgreSQL only. Never connects to the owner's project.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../.expo/onboarding-sql-check/node_modules/@electric-sql/pglite");

async function main() {
  const db = new PGlite();
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const [customer, merchant, installation, shop, business, offer, note] = [1,2,3,4,5,6,7].map(id);
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema notification_private; create schema cron;
      create function auth.uid() returns uuid language sql as
        $$select nullif(current_setting('app.owner',true),'')::uuid$$;
      create function auth.role() returns text language sql as
        $$select current_setting('app.role',true)$$;
      create table profiles(id uuid primary key,role text);
      create table merchants(id uuid primary key,status text,owner_user_id uuid);
      create table stores(id uuid primary key,merchant_id uuid,status text);
      create table store_orders(id uuid primary key,store_id uuid);
      create table store_offers(id uuid primary key,store_id uuid,starts_at timestamptz,ends_at timestamptz,is_active boolean);
      create table notifications(id uuid primary key,user_id uuid,type text,title text,body text,data jsonb,event_key text,created_at timestamptz default now(),read_at timestamptz);
      create table money_invoices(id uuid primary key,owner_id uuid,kind text);
      create table store_notification_follows(user_id uuid,store_id uuid,followed_at timestamptz);
      create table store_offer_notification_preferences(user_id uuid,enabled boolean,changed_at timestamptz);
      create table notification_private.offer_start_events(offer_id uuid primary key);
      create table cron.job(jobid bigint primary key,jobname text,schedule text,active boolean);
      create table cron.job_run_details(jobid bigint,status text,start_time timestamptz,end_time timestamptz);
    `);
    const initial = fs.readFileSync("supabase/migrations/20261117000100_live_updates_notifications.sql","utf8");
    const hardened = fs.readFileSync("supabase/migrations/20261118000100_notification_delivery_hardening.sql","utf8");
    const tables = initial.slice(initial.indexOf("create table public.push_devices"),initial.indexOf("create function public.register_push_device"));
    await db.exec(tables);
    for (const [source,name] of [[hardened,"register_push_device"],[hardened,"authorize_push_delivery"],[initial,"claim_push_deliveries"]]) {
      const pattern = new RegExp("create (?:or replace )?function public\\."+name+"\\([\\s\\S]*?end \\$\\$;");
      const sql = source.match(pattern)?.[0];
      assert(sql, name); await db.exec(sql);
    }
    await db.exec(`
      insert into profiles values ('${customer}','customer'),('${merchant}','merchant');
      set app.owner='${merchant}';
      select register_push_device('${installation}','ExpoPushToken[fixture]','android','${merchant}');
      insert into notifications values ('${note}','${merchant}','system','PRIVATE TITLE','PRIVATE BODY',
        '{"event":"invoice-SAL"}','fixture',now(),null);
      insert into push_deliveries(notification_id,installation_id) values ('${note}','${installation}');
      set app.role='service_role';
    `);
    const first = (await db.query("select claim_push_deliveries(10) items")).rows[0].items[0];
    assert.equal((await db.query("select authorize_push_delivery($1,$2) ok",[first.id,first.lease])).rows[0].ok,true);
    await db.exec(`set app.owner='${customer}';
      select register_push_device('${installation}','ExpoPushToken[fixture]','android','${customer}');`);
    assert.equal((await db.query("select authorize_push_delivery($1,$2) ok",[first.id,first.lease])).rows[0].ok,false);
    // Reinstall with SAME token moves registration and deletes old installation/queue.
    await db.query("select register_push_device($1,$2,'android',$3)",[id(8),"ExpoPushToken[fixture]",customer]);
    assert.equal((await db.query("select count(*)::int n from push_devices")).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int n from push_deliveries")).rows[0].n,0);
    await db.exec(`
      insert into merchants values ('${business}','accepted','${merchant}');
      insert into stores values ('${shop}','${business}','accepted');
      insert into store_offers values ('${offer}','${shop}',now()-interval '1 minute',now()+interval '1 hour',true);
      insert into notification_private.offer_start_events values ('${offer}');
    `);
    const diagnostics = fs.readFileSync("supabase/verification/push_delivery_incident_readonly.sql","utf8");
    const results = await db.exec(diagnostics);
    const output = JSON.stringify(results);
    assert(!output.includes("ExpoPushToken[fixture]"));
    assert(!output.includes(customer)); assert(!output.includes(merchant));
    assert(!output.includes("PRIVATE TITLE")); assert(!output.includes("PRIVATE BODY"));
    assert(output.includes("D: consumed"));
    console.log("PASS production token uniqueness/reassignment, stale lease denied; diagnostic SQL runs read-only without identifiers or message copy");
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
