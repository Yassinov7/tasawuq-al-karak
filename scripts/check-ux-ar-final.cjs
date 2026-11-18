// Narrow safety probe: actual tracking/recovery code and the new copy trigger in disposable PostgreSQL.
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), ts = require("typescript");
const { PGlite } = require("../.expo/onboarding-sql-check/node_modules/@electric-sql/pglite");
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, AbortController, require(name) {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/lib/")) return load("src/" + name.slice(2) + ".ts", mocks);
    throw Error(name);
  } });
  return exports;
}
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const walk = node => Array.isArray(node) ? node.flatMap(walk) : node?.props ? [node, ...walk(node.props.children)] : [];
async function main() {
  const progress = load("src/lib/order-progress.ts");
  assert(!progress.storeStepCompleted("delivered", "handed_to_driver", false));
  assert(progress.storeStepCompleted("delivered", "delivered", false));
  const order = { status: "partially_cancelled", deliveryTask: { status: "delivered" }, stores: [
    { storeOrder: { status: "delivered" } }, { storeOrder: { status: "rejected" } },
  ] };
  assert(progress.customerDeliveryCompleted(order));
  assert(!progress.customerDeliveryCompleted({ ...order, deliveryTask: { status: "accepted" } }));
  assert(!progress.customerDeliveryCompleted({ ...order, stores: [{ storeOrder: { status: "handed_to_driver" } }] }));
  assert(!progress.customerDeliveryCompleted({ ...order, status: "cancelled" }));
  console.log("PASS actual terminal checks, partial cancellation and no delivery inferred from invoice or acceptance");

  let intent, actor = "driver", cacheError = false, calls = [];
  const cacheKey = "delivery-collection:v1:driver:task";
  const service = load("src/lib/delivery-collection-attempt.ts", {
    "@/lib/supabase": { supabase: { auth: { getUser: async () => ({ data: { user: { id: actor } } }) } } },
    "@/lib/local-cache": { readLocalCache: async key => { assert.equal(key, cacheKey); if (cacheError) throw Error("storage"); return intent; },
      writeLocalCache: async (_, value) => { intent = value; }, invalidateLocalCache: async () => { intent = undefined; } },
    "@/lib/request-key": { newIdempotencyKey: () => { throw Error("A pending retry must not create a key"); } },
    "@/lib/store-pickups": { getPickupWorkflows: () => { throw Error("Existing attempt recovery must not require workflow"); } },
    "@/lib/financial-transport": { createFinancialTransport: () => async (name, args) => {
      calls.push({ name, args });
      return { data: name === "recover_delivery_collection" ? { state: "unknown" } : { state: "completed", task_id: "task", amount: "100.00" }, error: null };
    } },
  });
  assert.equal(await service.pendingDeliveryAttempt("driver", "task"), false);
  assert.equal((await service.deliveryCollection("driver", "task", 0, true)).state, "unknown");
  assert.equal(calls.length, 0);
  intent = { owner: "driver", task: "task", key: "old-key", version: 7 };
  assert(await service.pendingDeliveryAttempt("driver", "task"));
  await service.deliveryCollection("driver", "task", 0, true);
  assert.equal(calls.length, 1); assert.equal(calls[0].name, "recover_delivery_collection");
  const result = await service.deliveryCollection("driver", "task", 99);
  assert.equal(result.state, "completed");
  const writes = calls.filter(call => call.name === "complete_delivery_and_collect_cash");
  assert.equal(writes.length, 1); assert.equal(writes[0].args.attempt_key, "old-key");
  assert.equal(writes[0].args.expected_pricing_version, 7); assert.equal(intent, undefined);
  actor = "other"; await assert.rejects(() => service.pendingDeliveryAttempt("driver", "task")); actor = "driver";
  cacheError = true; await assert.rejects(() => service.pendingDeliveryAttempt("driver", "task"));
  console.log("PASS pending-attempt visibility, read-only recovery, same-key/version retry, storage/account failures");

  // Actual details component: hide recovery without an intent; gate fresh delivery while recovery is required.
  let values = [], index = 0, readTask, pending = false;
  const react = { useState(initial) { const i = index++; if (!(i in values)) values[i] = typeof initial === "function" ? initial() : initial;
    return [values[i], next => { values[i] = typeof next === "function" ? next(values[i]) : next; }]; },
    useRef(initial) { const i = index++; return values[i] ?? (values[i] = { current: initial }); }, useCallback: fn => fn };
  const taskId = "00000000-0000-4000-8000-000000000003";
  const task = { id: taskId, status: "picked_up", customer_order_id: "order", collection: { state: "ready", amount: 100 },
    customer_orders: { store_orders: [] }, pickups: { state: "c4", canCompleteDelivery: true, pricingVersion: 7 } };
  const mocks = {
    react, "react/jsx-runtime": jsx,
    "react-native": { StyleSheet: { create: value => value, hairlineWidth: 1 }, View: "View", Text: "Text", ScrollView: "Scroll", RefreshControl: "Refresh",
      useWindowDimensions: () => ({ width: 360, fontScale: 1 }), AppState: { addEventListener: () => ({ remove() {} }) } },
    "expo-router": { useLocalSearchParams: () => ({ taskId }), useRouter: () => ({}), useFocusEffect() {} },
    "@/context/AuthContext": { useAuth: () => ({ user: { id: "driver" }, loading: false }) },
    "@/context/ThemeContext": { useTheme: () => ({ colors: {} }) },
    "@/constants/theme": { Spacing: { four: 16 }, Typography: {}, MaxContentWidth: 600 },
    "@/hooks/useDriverTaskRefresh": { useDriverTaskRefresh: fn => { readTask = fn; return () => fn(new AbortController().signal, "change"); } },
    "@/hooks/useOrderRealtime": { useOrderRealtime() {} },
    "@/lib/arabic-layout": { arabicRowDirection: "row-reverse", arabicTextAlign: "right" },
    "@/lib/driver-deliveries": { getDriverApplication: async () => ({ status: "accepted" }), getDriverAssignedTasks: async () => [task] },
    "@/lib/store-pickups": { confirmStorePickup: async () => "confirmed" },
    "@/lib/delivery-collection-attempt": { pendingDeliveryAttempt: async () => { if (pending === "error") throw Error("storage"); return pending; }, deliveryCollection: async () => ({ state: "unknown" }) },
  };
  const source = fs.readFileSync("src/app/driver/task-details.tsx", "utf8");
  for (const [, name] of source.matchAll(/from "([^\"]+)"/g)) if (name.startsWith("@/components/")) mocks[name] = new Proxy({}, { get: (_, key) => key });
  const entry = load("src/app/driver/task-details.tsx", mocks).default();
  const render = () => { index = 0; return walk(entry.type(entry.props)); };
  render(); await readTask(new AbortController().signal, "initial");
  assert(render().some(node => node.props.title === "تأكيد التسليم"));
  assert(!render().some(node => node.props.title === "التحقق من نتيجة التسليم"));
  pending = true; await readTask(new AbortController().signal, "change");
  assert(!render().some(node => node.props.title === "تأكيد التسليم"));
  await render().find(node => node.props.title === "التحقق من نتيجة التسليم").props.onPress();
  for (let tick = 0; tick < 30; tick++) await Promise.resolve();
  assert(render().some(node => node.props.title === "إعادة المحاولة نفسها"));
  pending = "error"; await readTask(new AbortController().signal, "change");
  assert(!render().some(node => ["تأكيد التسليم", "إعادة المحاولة نفسها"].includes(node.props.title)));
  console.log("PASS actual details-screen recovery visibility and delivery gating");

  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema notification_private;
      create table public.notifications(id bigint generated always as identity,user_id uuid,type text,title text,body text,data jsonb,event_key text unique);
      create table public.profiles(id uuid,role text);
      create table public.customer_orders(id uuid,order_number bigint,customer_id uuid); create table public.commerce_references(record_id uuid,kind text,reference text);
      create table public.stores(id uuid,name text); create table public.store_orders(id uuid,status text,store_id uuid,customer_order_id uuid);
      create table public.delivery_tasks(id uuid,customer_order_id uuid,status text,driver_id uuid);
      create table public.money_invoices(id uuid,kind text,cash_direction text,customer_order_id uuid,owner_id uuid,status text,voided_by uuid);`);
    const baseline = fs.readFileSync("supabase/migrations/20261202000100_central_notifications.sql", "utf8");
    const renderer = baseline.indexOf("create function notification_private.render_notification()");
    await db.exec(baseline.slice(renderer, baseline.indexOf("end $$;", renderer) + 7));
    await db.exec("create trigger render_notification before insert on public.notifications for each row execute function notification_private.render_notification()");
    await db.exec(fs.readFileSync("supabase/migrations/20261204000100_arabic_notification_copy.sql", "utf8"));
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
    await db.query("insert into customer_orders values($1,1,$2);", [id(1),id(6)]);
    await db.query("insert into store_orders values($1,'handed_to_driver',$2,$3)", [id(2),id(4),id(1)]);
    await db.query("insert into delivery_tasks values($1,$2,'accepted',$3)", [id(7),id(1),id(6)]);
    await db.query("insert into money_invoices values($1,'INV',null,$2,$3,'confirmed',null)", [id(5),id(1),id(6)]);
    const insert = async (key, data, title = "original") => (await db.query("insert into notifications(user_id,type,title,body,data,event_key) values($1,'order',$2,'original',$3,$4) on conflict(event_key) do nothing returning *", [id(6),title,JSON.stringify(data),key])).rows[0];
    const created = await insert("order-created:"+id(1), { orderId:id(1) }, "تم استلام طلبك");
    assert.equal(created.title,"أُرسل طلبك للمتاجر"); assert.equal(created.user_id,id(6));
    const payload = { orderId:id(1),invoiceId:id(5),reference:"INV-0000001",route:"/financial-invoice" };
    assert.equal((await insert("invoice:"+id(5)+":confirmed",payload)).title,"اعتُمدت فاتورة شرائك");
    await db.exec("update delivery_tasks set status='delivered'");
    assert.equal((await insert("invoice:proof-incomplete",payload)).title,"اعتُمدت فاتورة شرائك");
    await db.exec("update store_orders set status='delivered'");
    const complete = await insert("invoice:delivery-final",payload);
    assert.equal(complete.title,"تم تسليم طلبك"); assert.equal(complete.data.event,"invoice-INV");
    assert.equal(complete.data.route,payload.route); assert.equal(complete.event_key,"invoice:delivery-final");
    await insert("invoice:delivery-final",payload);
    assert.equal((await db.query("select count(*)::int n from notifications where event_key='invoice:delivery-final'")).rows[0].n,1);
    console.log("PASS real SQL copy trigger: no premature delivery, recipient/payload/key preserved, one final INV event");
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
