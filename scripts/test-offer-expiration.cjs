// Focused date/clock tests. Child processes verify independence from the device timezone.
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const ts = require("typescript"), { spawnSync } = require("node:child_process");
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, Number, Intl, require(name) {
    if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts");
    throw Error(name);
  } });
  return exports;
}
const clock = load("src/lib/offer-syria-time.ts");
const calendar = load("src/lib/offer-expiration.ts");
const model = load("src/lib/merchant-offer-editor.ts");
const now = Date.parse("2030-07-10T07:00:00Z");
if (process.argv[2] === "--zone") {
  assert.equal(clock.syriaOfferInstant("2030-07-10", "14:20"), "2030-07-10T11:20:00.000Z");
  assert.equal(clock.syriaOfferFields("2030-07-10T21:15:00Z").date, "2030-07-11");
  assert.equal(clock.syriaOfferFields("2030-07-10T11:20:00Z").time, "14:20");
  const future = "2038-07-10T14:20:45.123456+03:00";
  const fields = clock.syriaOfferFields(future);
  assert.equal(clock.keepsSavedSyriaOfferTime(future, fields.date, fields.time), true);
  assert.equal(model.offerEndsAt({ ...model.emptyOfferForm, endMode: "keep", originalEndsAt: future }, undefined, now), future);
  const args = model.validateOffer({
    ...model.emptyOfferForm, title: "عرض صالح", discountValue: "10",
    startMode: "scheduled", startDate: "2038-07-10", startTime: "12:00",
    endMode: "new", endDate: "2038-07-11", endTime: "14:20",
    items: [{ key: "p", productId: "p", role: "discounted", quantity: "1" }],
  }, [{ id: "p", title: "منتج", price: 100, selling_unit: "قطعة", minimum_quantity: 1, quantity_step: 1, is_available: true }], null, undefined, now).args;
  assert.equal(args.input_starts_at, "2038-07-10T09:00:00.000Z");
  assert.equal(args.input_ends_at, "2038-07-11T11:20:00.000Z");
  console.log("PASS device zone " + process.env.TZ);
  process.exit(0);
}
let passed = 0;
function test(name, run) { run(); passed++; console.log("PASS " + name); }
test("Syrian time is explicit, including midnight across UTC days", () => {
  assert.equal(clock.syriaOfferInstant("2030-01-02", "00:15"), "2030-01-01T21:15:00.000Z");
  assert.equal(clock.syriaOfferFields("2030-01-01T21:15:00Z").date, "2030-01-02");
  assert(clock.formatSyriaOfferTime("2030-01-01T21:15:00Z").length > 10);
});
test("missing clock, invalid days and invalid 24-hour values are rejected", () => {
  for (const time of ["", "24:00", "12:60", "-1:00"]) assert.throws(() => clock.syriaOfferInstant("2030-07-10", time));
  for (const date of ["", "2030-02-29", "2030-13-01", "2030-04-31"]) assert.throws(() => clock.syriaOfferInstant(date, "14:20"));
  assert(clock.syriaOfferInstant("2028-02-29", "14:20"));
});
test("calendar starts Saturday and keeps each weekday correct", () => {
  for (const [year, month] of [[2026,11],[2028,2],[2030,1],[2100,2]]) {
    const cells = calendar.offerCalendarCells(year, month);
    assert.equal(cells.filter(day => day !== null).length, calendar.offerMonthDays(year, month));
    for (let index = 0; index < cells.length; index++) if (cells[index] !== null) {
      const day = new Date(Date.UTC(year, month - 1, cells[index]));
      assert.equal(index % 7, (day.getUTCDay() + 1) % 7);
    }
  }
  assert.equal(calendar.moveOfferMonth(2030,12,1).year,2031);
  assert.equal(calendar.moveOfferMonth(2030,1,-1).year,2029);
});
test("past days, exhausted last minute and end-before-start are disabled", () => {
  assert.equal(clock.canSelectSyriaOfferDay("2030-07-09", now), false);
  assert.equal(clock.canSelectSyriaOfferDay("2030-07-10", now), true);
  assert.equal(clock.canSelectSyriaOfferDay("2030-07-10", Date.parse("2030-07-10T20:59:00Z")), false);
  const start = "2030-07-12T21:00:00Z";
  assert.equal(clock.canSelectSyriaOfferDay("2030-07-12", now, start), false);
  assert.equal(clock.canSelectSyriaOfferDay("2030-07-13", now, start), true);
  assert.throws(() => clock.validateSyriaOfferTime("2030-07-10", "10:00", now));
  assert.throws(() => clock.validateSyriaOfferTime("2030-07-10", "11:00", now, "2030-07-10T08:00:00Z"));
});
test("historical Syrian missing and repeated times are rejected explicitly", () => {
  assert.throws(() => clock.syriaOfferInstant("2021-03-26","00:30"), /غير موجود/);
  assert.throws(() => clock.syriaOfferInstant("2021-10-28","23:30"), /يتكرر/);
});
test("saved starts and ends preserve exact original offset and fractional seconds", () => {
  const start = "2026-01-02T14:20:45.123456+03:00", end = "2038-07-10T14:20:45.123456+03:00";
  const form = { ...model.emptyOfferForm, startMode: "keep", originalStartsAt: start, endMode: "keep", originalEndsAt: end };
  assert.equal(model.offerStartsAt(form, now), start);
  assert.equal(model.offerEndsAt(form, start, now), end);
  assert.equal(model.offerStartsAt({ ...form, startMode: "now" }, now), new Date(now).toISOString());
  assert.throws(() => model.offerEndsAt({ ...form, originalEndsAt: "2020-01-01T00:00:00Z" }, start, now));
});
test("scheduled selection and wall-clock mismatch cannot silently change the instant", () => {
  const form = { ...model.emptyOfferForm, startMode: "scheduled", startDate: "2038-07-10", startTime: "14:20", selectedStartInstant: "2038-07-10T11:20:00.000Z" };
  assert.equal(model.offerStartsAt(form, now), form.selectedStartInstant);
  assert.throws(() => model.offerStartsAt({ ...form, selectedStartInstant: "2038-07-10T12:20:00Z" }, now));
  assert.throws(() => model.offerEndsAt({ ...form, endMode: "new", endDate: "2038-07-11", endTime: "14:20", selectedEndInstant: "2038-07-11T12:20:00Z" }, undefined, now));
});
for (const zone of ["UTC","Asia/Damascus","America/New_York","America/Los_Angeles","Pacific/Kiritimati","Australia/Lord_Howe"]) {
  test("same Syrian UTC value and save contract under device zone " + zone, () => {
    const child = spawnSync(process.execPath, [require("node:path").resolve("scripts/test-offer-expiration.cjs"),"--zone"], { env: { ...process.env, TZ: zone }, encoding: "utf8" });
    assert.equal(child.status, 0, child.stdout + child.stderr);
  });
}
console.log(passed + " focused Syrian-time/calendar checks passed; no remote calls");
