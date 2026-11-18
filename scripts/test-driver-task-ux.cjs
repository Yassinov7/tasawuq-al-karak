// Production read/presentation adapters. No remote SQL, app runtime or RLS deployment claim.
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), ts = require("typescript");
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, AbortController, require(name) {
    if (name in mocks) return mocks[name];
    throw Error("Unmocked " + name);
  } });
  return exports;
}
const item = (id, store, quantity, unit = "قطعة", product = id) => ({
  id, store_order_id: store, quantity, selling_unit_snapshot: unit,
  product_id: product, product_title_snapshot: "اسم تاريخي " + id,
});
const stores = [
  { id: "s1", status: "handed_to_driver", customer_note: "ملاحظة محفوظة", stores: { name: "متجر أول", address: "نقطة أولى" } },
  { id: "s2", status: "ready_for_pickup", stores: { name: "متجر ثان", address: "نقطة ثانية" } },
  { id: "sx", status: "cancelled", stores: { name: "غير مشمول" } },
];
const originalRows = [{ id: "task", driver_id: "driver", customer_order_id: "order", status: "accepted",
  customer_orders: { store_orders: stores, recipient_name: "اسم خاص", delivery_address: "عنوان خاص", delivery_zone_name_snapshot: "المنطقة" } }];
let actor = "driver", rows = originalRows, itemFail = false, switchDuringItems = false, foreignItem = false, reads = [];
const inventory = [item("01", "s1", 2), item("02", "s2", 3), item("03", "s2", 0.5, "كغ", null)];
const client = { auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }) },
  rpc(name) {
    assert.equal(name, "list_available_delivery_tasks");
    return Promise.resolve({ data: [{ task_id: "available", customer_order_id: "order", store_count: 2, delivery_zone_name_snapshot: "المنطقة" }], error: null });
  },
  from(table) {
    assert(["delivery_tasks", "store_order_items"].includes(table), "No catalogue or financial writes");
    const calls = [];
    const query = {};
    for (const op of ["select", "eq", "in", "order", "limit", "range", "gt", "abortSignal"]) query[op] = (...args) => { calls.push([op, ...args]); return query; };
    query.then = yes => {
      reads.push({ table, calls });
      if (table === "delivery_tasks") return Promise.resolve({ data: JSON.parse(JSON.stringify(rows)), error: null }).then(yes);
      const scope = calls.find(([op]) => op === "in")[2];
      const cursor = calls.find(([op]) => op === "gt")?.[2];
      assert.equal(calls.find(([op]) => op === "limit")[1], 100);
      assert.deepEqual(Array.from(scope), ["s1", "s2"]);
      // A synthetic server cap of ONE row proves we don't stop on a short page.
      const data = inventory.filter(row => scope.includes(row.store_order_id) && (!cursor || row.id > cursor)).slice(0, 1);
      if (switchDuringItems) actor = "other";
      return Promise.resolve({ data: foreignItem ? [item("99", "foreign", 4)] : data,
        error: itemFail && cursor ? Error("offline midway") : null }).then(yes);
    };
    return query;
  },
};
const refs = { "TSK:task": "TSK-000001", "ORD:order": "ORD-000002", "SOR:s1": "SOR-000003", "SOR:s2": "SOR-000004" };
const workflow = { state: "c4", confirmed: ["s1"], canConfirmPickup: true, canCompleteDelivery: false, pricingVersion: 3, reason: null };
const data = load("src/lib/driver-deliveries.ts", {
  "@/lib/supabase": { supabase: client },
  "@/lib/c3-orders": { getC3Contexts: async () => ({ order: { references: refs, pricing: {} } }) },
  "@/lib/driver-collection": { collectionFromContext: () => ({ state: "ready", amount: 650 }) },
  "@/lib/store-pickups": { getPickupWorkflows: async () => ({ task: workflow }) },
});
const model = load("src/lib/driver-task-presentation.ts");
let passed = 0;
async function test(name, fn) { await fn(); console.log("PASS " + name); passed++; }
const read = async () => (await data.getDriverAssignedTasks("driver", undefined, "task"))[0];
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function flatten(node) { return Array.isArray(node) ? node.flatMap(flatten) : typeof node?.type === "function" ? flatten(node.type(node.props)) : node?.props ? [node, ...flatten(node.props.children)] : []; }
function text(node) { return Array.isArray(node) ? node.map(text).join("") : node?.props ? text(node.props.children) : typeof node === "string" || typeof node === "number" ? String(node) : ""; }
async function main() {
  let task;
  await test("assigned read hydrates all historical items under a capped response and correct TSK/ORD/SOR", async () => {
    task = await read();
    assert.equal(task.productsState, "ready"); assert.equal(task.orderReference, refs["ORD:order"]);
    assert.equal(task.customer_orders.store_orders[0].reference, refs["SOR:s1"]);
    assert.equal(task.customer_orders.store_orders[1].items.length, 2);
    assert.equal(task.customer_orders.store_orders[1].items[1].product_id, null);
    assert.equal(task.collection.amount, 650); assert.equal(task.pickups.confirmed[0], "s1");
    assert.equal(reads.filter(row => row.table === "store_order_items").length, 4);
  });
  await test("one/many stores, distinct products, historical units and fractional quantities", () => {
    const summary = model.driverTaskSummary(task);
    assert(summary.includes("متجران") && summary.includes("أصناف") && !summary.includes("3 متاجر"));
    const sum = model.driverItemSummary([...inventory, { ...inventory[0], id: "gift", quantity: 1 }]);
    assert.equal(sum.count, 3); assert(sum.quantity.includes("+") && sum.quantity.includes("كغ"));
    assert(model.driverTaskSummary({ ...task, customer_orders: { store_orders: [task.customer_orders.store_orders[0]] } }).includes("متجر واحد"));
    assert.equal(model.driverItemSummary([item("a", "s1", 0.1), item("b", "s1", 0.2)]).quantity, model.driverNumber(0.3) + " قطعة");
    assert.equal(model.driverItemSummary([item("a", "s1", NaN)]), null);
  });
  await test("a failed or foreign partial response never masquerades as an empty product list", async () => {
    itemFail = true; const failed = await read(); itemFail = false;
    assert.equal(failed.productsState, "unavailable");
    assert.equal(failed.customer_orders.store_orders[0].items, undefined);
    assert(model.driverTaskSummary(failed).includes("غير متاحة"));
    foreignItem = true; assert.equal((await read()).productsState, "unavailable"); foreignItem = false;
  });
  await test("account switch, foreign task rows, cancelled reads and unassigned tasks stay isolated", async () => {
    switchDuringItems = true; await assert.rejects(read); switchDuringItems = false; actor = "driver";
    rows = [{ ...originalRows[0], driver_id: "other" }]; await assert.rejects(read); rows = originalRows;
    const abort = new AbortController(); abort.abort(); await assert.rejects(() => data.getDriverAssignedTasks("driver", undefined, "task", abort.signal));
    reads = []; const [available] = await data.getAvailableDeliveryTasks();
    assert.equal(available.recipient_name, undefined); assert.equal(available.items, undefined);
    assert(!reads.some(row => row.table === "store_order_items"));
  });
  for (const isRTL of [false, true]) await test("actual card/contents and partial pickup controls in native RTL=" + isRTL, () => {
    const colors = new Proxy({}, { get: (_, key) => key });
    const native = { I18nManager: { isRTL }, Text: "Text", View: "View", Pressable: "Pressable", StyleSheet: { create: value => value, hairlineWidth: 1 } };
    const layout = load("src/lib/arabic-layout.ts", { "react-native": native });
    const mocks = { react: { memo: fn => fn }, "react/jsx-runtime": jsx, "react-native": native,
      "@/context/ThemeContext": { useTheme: () => ({ colors }) }, "@/constants/theme": { Spacing: {}, Typography: {}, Radius: {} },
      "@/lib/arabic-layout": layout, "@/lib/driver-task-presentation": model,
      "@/lib/driver-collection": { driverCollectionMessage: () => "تعذر التحقق" },
      "@/components/ui/AppButton": { AppButton: "Button" }, "@/components/ui/AppIcon": { AppIcon: "Icon" },
      "@/components/ui/FinancialAmount": { FinancialAmount: "Amount" },
    };
    const Card = load("src/components/driver/DeliveryTaskCard.tsx", mocks).DeliveryTaskCard;
    let opens = 0;
    const card = Card({ task, stale: false, onOpen: () => opens++ });
    assert(text(card).includes("TSK-000001") && text(card).includes("ORD-000002"));
    assert(!text(card).includes("اسم خاص") && !text(card).includes("عنوان خاص") && !text(card).includes("اسم تاريخي"));
    card.props.onPress(); assert.equal(opens, 1);
    assert.equal(flatten(card).filter(node => node.props.accessibilityRole === "button").length, 1);
    assert(!flatten(Card({ task, stale: true })).some(node => node.type === "Amount"));
    assert(!flatten(Card({ task: { ...task, status: "delivered" }, stale: false })).some(node => node.type === "Amount"));
    assert(flatten(card).some(node => node.props.style?.flexDirection === (isRTL ? "row" : "row-reverse")));
    const Contents = load("src/components/driver/DriverStoreContents.tsx", mocks).DriverStoreContents;
    const content = Contents({ store: task.customer_orders.store_orders[1] });
    assert(text(content).includes("SOR-000004") && text(content).includes("اسم تاريخي 03") && text(content).includes("كغ"));
    assert(text(Contents({ store: { ...stores[0] } })).includes("تعذر قراءة المنتجات"));
    const Panel = load("src/components/driver/StorePickupPanel.tsx", mocks).StorePickupPanel;
    const confirms = [];
    const options = { stores: task.customer_orders.store_orders, workflow, disabled: false, onConfirm: id => confirms.push(id), renderContents: store => Contents({ store }) };
    const panel = Panel(options), buttons = flatten(panel).filter(node => node.type === "Button");
    assert.equal(buttons.length, 1); assert.equal(buttons[0].props.disabled, false);
    buttons[0].props.onPress(); assert.deepEqual(confirms, ["s2"]);
    assert(text(panel).includes("استُلم من المتجر") && !text(panel).includes("غير مشمول"));
    for (const patch of [{ disabled: true }, { busy: "s2" }, { workflow: { ...workflow, canConfirmPickup: false } }]) {
      assert(flatten(Panel({ ...options, ...patch })).filter(node => node.type === "Button").every(node => node.props.disabled));
    }
    assert(!fs.readFileSync("src/components/driver/DeliveryTaskCard.tsx", "utf8").includes("onConfirmPickup"));
  });
  console.log(passed + " focused driver read/UI checks passed; no live database or phone claims");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
