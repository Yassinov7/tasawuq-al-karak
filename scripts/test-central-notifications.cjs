// Disposable PostgreSQL fixture. No project credentials or remote database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../.expo/onboarding-sql-check/node_modules/@electric-sql/pglite");

async function main() {
  const db = new PGlite();
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const [owner, other, merchant, shop, merchantRow, order, child, device, lease] =
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(id);
  const one = async sql => (await db.query(sql)).rows[0];
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema notification_private;
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('app.owner',true),'')::uuid$$;
      create table profiles(id uuid primary key,role text);
      create table merchants(id uuid primary key,status text);
      create table stores(id uuid primary key,merchant_id uuid references merchants,name text,status text);
      create table store_offers(id uuid primary key,store_id uuid references stores,title text,starts_at timestamptz,ends_at timestamptz,is_active boolean);
      create table notifications(id uuid primary key default gen_random_uuid(),user_id uuid,type text,title text,body text,
        data jsonb,event_key text unique,created_at timestamptz default now(),read_at timestamptz);
      create table push_devices(installation_id uuid primary key,owner_id uuid,enabled boolean,updated_at timestamptz,registered_at timestamptz);
      create table push_deliveries(id uuid primary key default gen_random_uuid(),notification_id uuid,installation_id uuid,
        state text default 'pending',last_error text,lease uuid,ticket text,unique(notification_id,installation_id));
      create table customer_orders(id uuid primary key,order_number bigint);
      create table store_orders(id uuid primary key,customer_order_id uuid,store_id uuid,status text);
      create table commerce_references(record_id uuid,kind text,reference text);
      create table money_invoices(id uuid primary key,kind text);
      create table delivery_tasks(id uuid primary key,driver_id uuid,status text,customer_order_id uuid);
      create table driver_applications(user_id uuid,status text,is_available boolean);
      create function authorize_push_delivery(delivery_value uuid,lease_value uuid) returns boolean
        language sql as $$select exists(select 1 from public.push_deliveries where id=delivery_value and lease=lease_value)$$;
      create function notification_private.enqueue_push() returns trigger language plpgsql as $$begin return new;end$$;
      create trigger notification_push_enqueue after insert on notifications for each row execute function notification_private.enqueue_push();
      insert into profiles values ('${owner}','customer'),('${other}','customer'),('${merchant}','merchant');
      insert into merchants values ('${merchantRow}','accepted');
      insert into stores values ('${shop}','${merchantRow}','الكرم','accepted');
      insert into customer_orders values ('${order}',7);
      insert into store_orders values ('${child}','${order}','${shop}','preparing');
      insert into commerce_references values ('${order}','ORD','ORD-0000007');
      insert into push_devices values ('${device}','${owner}',true,now(),now()-interval '1 hour');
      insert into store_offers values ('${id(10)}','${shop}','قديم',now()-interval '1 hour',now()+interval '1 hour',true);
    `);
    await db.exec(fs.readFileSync("supabase/migrations/20261202000100_central_notifications.sql", "utf8"));
    await db.exec(`set role authenticated; set app.owner='${owner}'`);
    await assert.rejects(db.exec(`select set_store_notification_follow('${shop}',true,'${other}')`), /account changed/);
    await db.exec(`select set_store_notification_follow('${shop}',true,'${owner}')`);
    assert.equal((await one(`select read_store_notification_preferences('${owner}') as p`)).p.stores[0].name, "الكرم");
    await assert.rejects(db.exec("select * from store_notification_follows"), /permission denied/);
    await assert.rejects(db.exec(`select read_push_delivery_message('${id(11)}','${lease}')`), /permission denied/);
    await db.exec(`set app.owner='${merchant}'`);
    await assert.rejects(db.exec(`select set_store_notification_follow('${shop}',true,'${merchant}')`), /customer required/);
    await db.exec(`set app.owner='${other}'; select set_store_notification_follow('${shop}',true,'${other}');
      select set_store_offer_notifications(false,'${other}'); reset role;`);
    await db.exec(`
      insert into store_offers values
        ('${id(11)}','${shop}','السلة الأسبوعية',now()+interval '1 hour',now()+interval '2 hours',true),
        ('${id(12)}','${shop}','ملغى',now()+interval '1 hour',now()+interval '2 hours',false),
        ('${id(13)}','${shop}','منتهٍ',now()-interval '3 minutes',now()-interval '1 minute',true),
        ('${id(14)}','${shop}','متأخر',now()-interval '20 minutes',now()+interval '1 hour',true),
        ('${id(15)}','${shop}','قبل المتابعة',now()-interval '2 minutes',now()+interval '1 hour',true);
    `);
    assert.equal((await one("select notification_private.publish_offer_starts() as n")).n, 0);
    await db.exec(`update store_offers set starts_at=now() where id in ('${id(11)}','${id(12)}')`);
    assert.equal((await one("select notification_private.publish_offer_starts() as n")).n, 1);
    const message = await one("select * from notifications");
    assert.equal(message.user_id, owner);
    assert.match(message.title, /الكرم/);
    assert.match(message.body, /السلة الأسبوعية/);
    assert.equal(message.data.offerId, id(11));
    assert.equal((await one("select notification_private.publish_offer_starts() as n")).n, 0);
    const delivery = await one("select id from push_deliveries");
    await db.exec(`update push_deliveries set lease='${lease}'`);
    const getPush = () => one(`select read_push_delivery_message('${delivery.id}','${lease}') as p`);
    assert.equal((await getPush()).p.title, "بدأ عرض من متجر تتابعه");
    assert((await getPush()).p.ttl <= 600);
    await db.exec(`set role authenticated; set app.owner='${owner}';
      select set_store_notification_follow('${shop}',false,'${owner}'); reset role;`);
    assert.equal((await getPush()).p, null);
    await db.exec(`delete from notifications;
      update store_offers set starts_at=now()+interval '1 hour' where id='${id(11)}';
      set app.owner='${owner}'; select set_store_notification_follow('${shop}',true,'${owner}');
      update store_offers set starts_at=now() where id='${id(11)}';`);
    assert.equal((await one("select notification_private.publish_offer_starts() as n")).n, 0);
    await db.exec(`insert into notifications(user_id,type,title,body,data,event_key)
      values ('${owner}','order','قديم','قديم',jsonb_build_object('orderId','${order}','storeOrderId','${child}'),
      'store-status:${child}:preparing:${owner}')`);
    const operational = await one("select title,body from notifications");
    assert.equal(operational.title, "المتجر يجهّز طلبك");
    assert.match(operational.body, /الكرم.*ORD-0000007/);
    await db.exec(`insert into money_invoices values ('${id(21)}','INV');
      insert into delivery_tasks values ('${id(22)}',null,'picked_up','${order}');
      insert into notifications(user_id,type,title,body,data,event_key)
      values ('${owner}','system','قديم','فاتورة',jsonb_build_object('orderId','${order}','invoiceId','${id(21)}'),
        'invoice:${id(21)}:confirmed');`);
    assert.equal((await one("select title from notifications where data->>'event'='invoice-INV'")).title, "تأكدت فاتورة مشترياتك");
    await db.exec(`update delivery_tasks set status='delivered' where id='${id(22)}';
      insert into money_invoices values ('${id(23)}','INV');
      insert into notifications(user_id,type,title,body,data,event_key)
      values ('${owner}','system','قديم','فاتورة',jsonb_build_object('orderId','${order}','invoiceId','${id(23)}'),
        'invoice:${id(23)}:confirmed');`);
    assert.equal((await one(`select title from notifications where data->>'invoiceId'='${id(23)}'`)).title, "تم تسليم طلبك");
    console.log("PASS SQL migration, ownership, Arabic copy, opt-in/opt-out, activation, reschedule, device queue and non-replay");
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
