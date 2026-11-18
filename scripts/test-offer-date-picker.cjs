// Render the actual picker with native/React adapters; no browser or phone claims.
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), ts = require("typescript");
function harness(isRTL) {
  const states = new Map(); let cells, cursor;
  const react = { useState(initial) {
    const index = cursor++;
    const scopeCells = cells;
    if (!(index in scopeCells)) scopeCells[index] = typeof initial === "function" ? initial() : initial;
    return [scopeCells[index], next => { scopeCells[index] = typeof next === "function" ? next(scopeCells[index]) : next; }];
  } };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const mocks = {
    react, "react/jsx-runtime": jsx,
    "react-native": { I18nManager: { isRTL }, Platform: { OS: "android" }, Modal: "Modal", Text: "Text", View: "View",
      Pressable: "Pressable", ScrollView: "Scroll", KeyboardAvoidingView: "Keyboard", StyleSheet: { create: value => value, hairlineWidth: 1 } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
    "@/components/ui/AppButton": { AppButton: "Button" }, "@/components/ui/AppIcon": { AppIcon: "Icon" },
    "@/components/ui/AppTextField": { AppTextField: "Input" },
    "@/constants/theme": { Spacing: {}, Radius: {}, Typography: {} },
    "@/context/ThemeContext": { useTheme: () => ({ colors: {} }) },
  };
  function load(file) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, Date, Intl, require(name) {
      if (mocks[name]) return mocks[name];
      if (name.startsWith("@/lib/")) return load("src/" + name.slice(2) + ".ts");
      throw Error(name);
    } });
    return exports;
  }
  return { Picker: load("src/components/merchant/OfferExpirationPicker.tsx").OfferExpirationPicker,
    render(key, render) { cells = states.get(key) ?? []; states.set(key, cells); cursor = 0; return render(); } };
}
const walk = node => Array.isArray(node) ? node.flatMap(walk) : node?.props ? [node, ...walk(node.props.children)] : [];
for (const isRTL of [false, true]) {
  const h = harness(isRTL), commits = [];
  const props = { kind: "start", mode: "none", original: null, date: "", time: "", now: Date.parse("2030-07-10T07:00:00Z"),
    disabled: false, onSelect: value => commits.push(value) };
  const field = () => h.render("field", () => h.Picker(props));
  walk(field()).find(node => node.props.accessibilityLabel === "اختيار بداية العرض").props.onPress();
  let child = walk(field()).find(node => typeof node.type === "function" && node.props.commit);
  const dialog = () => h.render("dialog", () => child.type(child.props));
  let tree = walk(dialog());
  assert(tree.some(node => node.type === "Modal"));
  assert(tree.some(node => node.type === "View" && node.props.style?.flexDirection === (isRTL ? "row" : "row-reverse")));
  for (const week of tree.filter(node => node.type === "View" && node.props.style?.flexDirection === (isRTL ? "row" : "row-reverse") && Array.isArray(node.props.children) && node.props.children.length === 7)) {
    assert.equal(week.props.children.length, 7);
  }
  const dates = tree.filter(node => node.type === "Pressable" && typeof node.props.accessibilityLabel === "string" && node.props.accessibilityState);
  assert.equal(dates.length, 31);
  assert(dates.some(node => node.props.disabled));
  assert(dates.some(node => node.props.accessibilityLabel.includes("اليوم")));
  const selectedDay = (11).toLocaleString("ar-SY", { useGrouping: false });
  dates.find(node => node.props.accessibilityLabel.startsWith(selectedDay + " ")).props.onPress();
  tree = walk(dialog());
  tree.find(node => node.type === "Input" && node.props.label === "الساعة").props.onChangeText("١٤");
  tree = walk(dialog());
  tree.find(node => node.type === "Input" && node.props.label === "الدقيقة").props.onChangeText("٢٠");
  tree = walk(dialog());
  // Footer is outside the scrollable calendar/time content.
  const scroll = tree.find(node => node.type === "Scroll");
  assert(!walk(scroll).some(node => node.props.title === "تأكيد الموعد"));
  assert.equal(commits.length, 0);
  tree.find(node => node.props.title === "تأكيد الموعد").props.onPress();
  assert.equal(commits[0].instant, "2030-07-11T11:20:00.000Z");
  assert.equal(commits[0].time, "14:20");
  assert(!walk(field()).some(node => typeof node.type === "function" && node.props.commit));
}
// Opening/cancelling a saved timestamp does not mutate it; confirming its minute keeps full precision.
{
  const h = harness(true), commits = [];
  const original = "2038-07-10T14:20:45.123456+03:00";
  const props = { mode: "keep", original, date: "", time: "", now: Date.parse("2030-01-01"), disabled: false,
    onSelect: value => commits.push(value) };
  const field = () => h.render("field", () => h.Picker(props));
  const open = () => {
    walk(field()).find(node => node.props.accessibilityLabel === "اختيار نهاية العرض").props.onPress();
    return walk(field()).find(node => typeof node.type === "function" && node.props.commit);
  };
  let child = open();
  walk(h.render("saved", () => child.type(child.props))).find(node => node.type === "Modal").props.onRequestClose();
  assert.equal(commits.length, 0); assert.equal(props.original, original);
  child = open();
  walk(h.render("saved", () => child.type(child.props))).find(node => node.props.title === "تأكيد الموعد").props.onPress();
  assert.equal(commits[0].mode, "keep"); assert.equal(props.original, original);
}
console.log("PASS actual picker: seven-column calendar, disabled past days, Arabic clock input, fixed footer, UTC commit, cancel and exact saved-time retention in RTL/LTR");
