const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { load } = require("./syp-test-loader.cjs");

const jsx = (type, props) => ({ type, props });
const colors = { primary: "accent", surface: "background", text: "text", textSecondary: "secondary" };
let state;
const mocks = {
  "react/jsx-runtime": { jsx, jsxs: jsx },
  react: {
    useEffect() {},
    useState(initial) {
      return [state ?? (typeof initial === "function" ? initial() : initial), next => { state = next; }];
    },
  },
  "react-native": { Pressable: "Pressable", View: "View", Text: "Text", StyleSheet: { create: s => s, absoluteFill: {} } },
  "expo-image": { Image: "Image" },
  "@/components/ui/AppIcon": { AppIcon: "Icon" },
  "@/components/marketplace/ShoppingCardImage": { ShoppingCardImage: "ShoppingCardImage" },
  "@/context/ThemeContext": { useTheme: () => ({ colors }) },
  "@/context/CustomerCatalogContext": { useCustomerCatalog: () => ({ stores: [{ id: "store", name: "البقالة" }] }) },
  "@/lib/offer-presentation": load("src/lib/offer-presentation.ts"),
  "@/lib/money": load("src/lib/money.ts"),
  "@/constants/theme": { Fonts: {}, FontSizes: {}, Radius: {}, Spacing: {} },
};

function component(file, name) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require: key => {
    assert.ok(Object.hasOwn(mocks, key), key);
    return mocks[key];
  } });
  return exports[name];
}
function textOf(node) {
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (node && typeof node === "object") return textOf(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}

const OfferCard = component("src/components/marketplace/OfferCard.tsx", "OfferCard");
const offer = {
  title: "باقة الفطور", store_id: "store", offer_type: "bundle", bundle_price: 120, currency: "SYP",
  items: ["حليب", "جبن", "خبز"].map((name, i) => ({
    id: "item" + i, quantity: i + 0.5, itemRole: "bundle",
    product: { id: "p" + i, name, unit: "كغ", price: 200 },
  })),
};
let opened = 0;
for (const layout of [{ cardWidth: 240 }, { expanded: true }]) {
  const view = OfferCard({ ...layout, offer, added: true, onPress: () => { opened++; } });
  const content = textOf(view);
  for (const value of ["باقة الفطور", "البقالة", "حليب × 0.5 كغ", "جبن × 1.5 كغ", "من المنتجات الأخرى", "في السلة"]) {
    assert.ok(content.includes(value), value);
  }
  assert.ok(view.props.accessibilityLabel.includes(mocks["@/lib/money"].formatSypNumber(120)));
  assert.ok(!content.includes("خبز"));
  view.props.onPress();
}
assert.equal(opened, 2);
for (const [offer_type, icon, roles] of [
  ["discount", "pricetag-outline", ["discounted"]],
  ["bundle", "cube-outline", ["bundle"]],
  ["buy_x_get_y", "gift-outline", ["buy", "reward"]],
]) {
  const view = OfferCard({ offer: {
    ...offer, offer_type, discount_method: "fixed", discount_value: 10,
    items: roles.map((itemRole, i) => ({ ...offer.items[i], itemRole })),
  }, onPress() {} });
  assert.equal(view.props.accessibilityRole, "link");
  assert.equal(view.props.children[1].props.children[0].props.name, icon);
  assert.ok(!textOf(view).includes("التفاصيل"));
}


const ShoppingCardImage = component("src/components/marketplace/ShoppingCardImage.tsx", "ShoppingCardImage");
const render = props => ShoppingCardImage({ icon: "cube-outline", ...props });
assert.equal(render({}).type, "View");
assert.equal(render({ uri: "public/v1" }).props.cachePolicy, "memory-disk");
const previous = render({ uri: "signed-v1", cacheKey: "account:v1", restricted: true });
assert.equal(previous.props.cachePolicy, "memory");
assert.equal(previous.props.recyclingKey, render({ uri: "renewed-v1", cacheKey: "account:v1", restricted: true }).props.recyclingKey);
previous.props.onError();
assert.equal(render({ uri: "signed-v1", cacheKey: "account:v1", restricted: true }).type, "View");
assert.equal(render({ uri: "renewed-v1", cacheKey: "account:v1", restricted: true }).type, "Image");
assert.notEqual(previous.props.recyclingKey, render({ uri: "signed-v2", cacheKey: "account:v2", restricted: true }).props.recyclingKey);
console.log("PASS offer card JSX, shared pricing, names/quantities, overflow and navigation; image cache and error fallback props");
