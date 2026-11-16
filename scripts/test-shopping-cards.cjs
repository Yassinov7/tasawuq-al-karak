const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { load } = require("./syp-test-loader.cjs");

const jsx = (type, props) => ({ type, props });
const colors = { primary: "accent", surface: "background", text: "text", textSecondary: "secondary" };
let state;
let fontScale = 1;
let width = 320;
let offers = [];
const mocks = {
  "react/jsx-runtime": { jsx, jsxs: jsx },
  react: {
    useEffect() {},
    useMemo: callback => callback(),
    useState(initial) {
      return [state ?? (typeof initial === "function" ? initial() : initial), next => { state = next; }];
    },
  },
  "react-native": { SectionList: "SectionList", RefreshControl: "RefreshControl", Pressable: "Pressable", View: "View", Text: "Text", StyleSheet: { create: s => s, absoluteFill: {} }, useWindowDimensions: () => ({ width, fontScale }) },
  "expo-image": { Image: "Image" },
  "@/components/ui/AppBadge": { AppBadge: "AppBadge" },
  "@/components/marketplace/RatingStars": { RatingStars: "RatingStars" },
  "@/components/ui/AppIcon": { AppIcon: "Icon" },
  "@/components/marketplace/ShoppingCardImage": { ShoppingCardImage: "ShoppingCardImage" },
  "@/context/ThemeContext": { useTheme: () => ({ colors }) },
  "@/context/CustomerCatalogContext": { useCustomerCatalog: () => ({ stores: [{ id: "store", name: "البقالة" }], categories: [], productRatings: new Map(), offers }) },
  "@/hooks/useOfferCountdown": { useOfferCountdown: () => ({ valid: true, expired: false, label: "متبقٍ 2 يوم و3 س" }) },
  "@/lib/offer-presentation": load("src/lib/offer-presentation.ts"),
  "@/lib/money": load("src/lib/money.ts"),
  "@/constants/theme": { Fonts: {}, FontSizes: {}, Radius: {}, RtlText: { textAlign: "right", writingDirection: "rtl" }, Spacing: { two: 8, four: 16 } },
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
  const header = view.props.children[0];
  assert.equal(header.props.style.alignItems, "flex-start");
  assert.equal(header.props.children[0].props.children.props.name, icon);
  const longTitle = "عرض موسمي طويل ".repeat(10).trim();
  const long = OfferCard({ offer: { ...offer, offer_type, title: longTitle }, onPress() {} });
  assert.equal(long.props.children[0].props.children[0].props.children.props.name, icon);
  assert.ok(textOf(long).includes(longTitle));
  assert.equal(header.props.children[2], null);
  assert.equal(view.props.children.at(-1).props.style.marginTop, "auto");
  assert.equal(view.props.style({})[0].alignSelf, "stretch");
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

const CategoryChip = component("src/components/marketplace/CategoryChip.tsx", "CategoryChip");
const ProductCard = component("src/components/marketplace/ProductCard.tsx", "ProductCard");
const name = "اسم منتج طويل لا ينبغي أن يختفي عند تكبير حجم النص";
const product = { id: "p0", name, storeId: "store", unit: "كغ", price: 1250, available: true };
const chip = () => CategoryChip({ tile: true, label: name, icon: "cube-outline", onPress() {} });
assert.equal(chip().props.style({})[1].minHeight, 56);
assert.equal(chip().props.children[0].props.size, 22);
assert.equal(chip().props.children[1].props.numberOfLines, 1);
fontScale = 1.8;
assert.equal(chip().props.children[1].props.numberOfLines, undefined);
assert.equal(chip().props.accessibilityLabel, name);
offers = [{
  ...offer, offer_type: "discount", discount_method: "percentage", discount_value: 15,
  items: [{ ...offer.items[0], product, itemRole: "discounted" }],
}];
const card = ProductCard({ product, compact: true, showOffer: true, onPress() {} });
assert.equal(card.props.children[1].props.numberOfLines, undefined);
assert.equal(card.props.children[1].props.style[0].writingDirection, "rtl");
assert.equal(card.props.children[4].props.children[0].props.style[0].writingDirection, "rtl");
assert.equal(chip().props.children[1].props.style[0].writingDirection, "rtl");
assert.ok(textOf(card).includes(name));
assert.ok(textOf(card).includes(mocks["@/lib/money"].formatSyp(product.price)));
assert.ok(textOf(card).includes(product.unit));
assert.ok(card.props.accessibilityLabel.includes("ضمن عرض"));
assert.ok(!ProductCard({ product: { ...product, available: false }, showOffer: true, onPress() {} }).props.accessibilityLabel.includes("ضمن عرض"));
console.log("PASS compact product name, price, unit and qualifying discount; category touch target and large text");

Object.assign(mocks, {
  "@/components/marketplace/CategoryChip": { CategoryChip },
  "@/components/marketplace/OfferCard": { OfferCard },
  "@/components/marketplace/ProductCard": { ProductCard },
  "@/components/marketplace/StoreCard": { StoreCard: "StoreCard" },
  "@/components/search/searchStyles": { styles: {} },
  "@/hooks/useCustomerStoreLogos": { useCustomerStoreLogos: () => ({ logos: new Map() }) },
  "@/lib/category-tree": load("src/lib/category-tree.ts"),
});
const SearchResults = component("src/components/search/SearchResults.tsx", "SearchResults");
const data = {
  products: [product, { ...product, id: "p1" }],
  stores: [{ id: "s0" }, { id: "s1" }],
  offers: [{ ...offer, id: "o0" }, { ...offer, id: "o1" }],
  categories: ["c0", "c1", "c2"].map(id => ({ id, name: "اسم تصنيف طويل يلتف داخل البطاقة" })),
};
for (const [viewport, scale, expected] of [
  [320, 1, [2, 2, 2, 2]], [360, 1, [2, 2, 2, 3]], [300, 1, [1, 1, 1, 1]], [360, 1.8, [1, 1, 1, 1]],
]) {
  width = viewport;
  fontScale = scale;
  const view = SearchResults({ results: data, categories: data.categories });
  assert.deepEqual(Array.from(view.props.sections, section => section.data[0].cells.length), expected);
}
console.log("PASS responsive result grids at 300, 320 and 360; one column at system font scale 1.8");

for (const file of [
  "src/components/marketplace/OfferCard.tsx",
  "src/components/marketplace/ProductCard.tsx",
  "src/components/marketplace/CategoryChip.tsx",
  "src/components/marketplace/StoreCard.tsx",
  "src/components/marketplace/StoreDetailsHero.tsx",
  "src/components/ui/AppBadge.tsx",
]) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /writingDirection:\s*"rtl"|\.\.\.RtlText/, file + " explicit Arabic writing direction");
}
console.log("PASS shared customer cards, category chips, badges and store hero declare Arabic writing direction");
