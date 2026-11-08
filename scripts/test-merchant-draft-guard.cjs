// Exercise real hooks with a tiny deterministic hook host; no network or app server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function host() {
  const slots = []; let cursor = 0; let pending = [];
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (next) => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++; if (!equal(slots[index]?.deps, deps)) slots[index] = { value: fn, deps }; return slots[index].value; },
    useEffect(fn, deps) { const index = cursor++; if (!equal(slots[index]?.deps, deps)) { slots[index]?.cleanup?.(); slots[index] = { deps }; pending.push(() => { slots[index].cleanup = fn(); }); } },
  };
  return { react, render(fn) { cursor = 0; const value = fn(); const tasks = pending; pending = []; tasks.forEach((task) => task()); return value; }, unmount() { slots.forEach((slot) => slot?.cleanup?.()); } };
}
function load(file, mocks) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require(name) { if (!(name in mocks)) throw Error(`Unmocked import: ${name}`); return mocks[name]; },
  });
  return exports;
}
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const storage = new Map();
const cache = {
  async readLocalCache(key) { return clone(storage.get(key)); },
  async writeLocalCache(key, value) { storage.set(key, clone(value)); },
  async invalidateLocalCache(key) { storage.delete(key); },
};
const empty = { store: '', categoryId: '' };
function draftHost(key) {
  const h = host();
  const { useOnboardingDraft } = load('src/hooks/useOnboardingDraft.ts', { react: h.react, '@/lib/local-cache': cache });
  return { ...h, current: () => h.render(() => useOnboardingDraft(key, empty)) };
}
(async () => {
  let h = draftHost('merchant:first'); h.current(); await Promise.resolve();
  let draft = h.current();
  assert.equal(draft.dirty, false);
  draft.change('store', 'المتجر المحفوظ'); draft = h.current(); await draft.save();
  draft = h.current(); assert.equal(draft.dirty, false, 'Explicit save must update the current reference');
  h.unmount();
  h = draftHost('merchant:first'); h.current(); await Promise.resolve(); draft = h.current();
  assert.equal(draft.value.store, 'المتجر المحفوظ');
  assert.equal(draft.dirty, false, 'Restoration alone must not be dirty');
  const g = host(); let dialogs = 0; let actions; let hardwareBack; const routes = [];
  const { useOnboardingExit } = load('src/hooks/useOnboardingExit.ts', {
    react: g.react,
    'expo-router': { useRouter: () => ({ replace: (route) => routes.push(route) }), useFocusEffect: (fn) => g.react.useEffect(fn, [fn]) },
    'react-native': { Alert: { alert() { throw Error('Merchant must use the branded modal'); } }, BackHandler: { addEventListener(_name, fn) { hardwareBack = fn; return { remove() {} }; } } },
  });
  const guard = () => g.render(() => useOnboardingExit({ dirty: draft.dirty, busy: false, save: draft.save, discard: draft.discard, confirmExit: (next) => { dialogs++; actions = next; } }));
  guard()(); await Promise.resolve(); assert.equal(dialogs, 0, 'Clean exit must not prompt');
  draft.change('store', 'تعديل جديد'); draft = h.current();
  assert.equal(storage.get('merchant:first').store, 'المتجر المحفوظ', 'Typing must not overwrite the saved reference');
  guard()(); assert.equal(dialogs, 1, 'Save → reopen → edit → exit must prompt');
  actions.cancel(); guard(); hardwareBack(); assert.equal(dialogs, 2, 'Android back must use the same guard');
  await actions.discard(); draft = h.current();
  assert.equal(draft.value.store, 'المتجر المحفوظ'); assert.equal(draft.dirty, false);
  draft.change('categoryId', 'category-new'); draft = h.current(); guard()();
  await actions.save(); draft = h.current(); assert.equal(draft.dirty, false);
  draft.change('store', 'تعديل لاحق'); draft = h.current(); guard()();
  assert.equal(dialogs, 4, 'Editing after another explicit save must prompt again');
  actions.cancel();
  const fresh = draftHost('merchant:second'); fresh.current(); await Promise.resolve();
  let second = fresh.current(); second.change('store', 'مسودة جديدة'); second = fresh.current();
  await second.discard(); second = fresh.current();
  assert.equal(second.value.store, ''); assert.equal(storage.has('merchant:second'), false);
  assert.equal(storage.get('merchant:first').categoryId, 'category-new', 'Another account must remain untouched');

  // A long selector uses a native Modal and one independent virtualized list.
  const picker = host(); let selected = '';
  const native = Object.fromEntries(['FlatList', 'KeyboardAvoidingView', 'Modal', 'Pressable', 'Text', 'View'].map((key) => [key, key]));
  const element = (type, props) => ({ type, props });
  const { MerchantCategorySelect } = load('src/components/merchant/MerchantCategorySelect.tsx', {
    react: picker.react, 'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': { ...native, Platform: { OS: 'android' }, StyleSheet: { create: (styles) => styles, absoluteFill: {} }, useWindowDimensions: () => ({ height: 800 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
    '@/components/ui/AppIcon': { AppIcon: 'AppIcon' }, '@/components/ui/AppTextField': { AppTextField: 'AppTextField' },
    '@/constants/theme': { LayoutSpacing: {}, Radius: {}, Shadows: {}, Typography: {} },
    '@/context/ThemeContext': { useTheme: () => ({ colors: {} }) },
  });
  const categories = Array.from({ length: 300 }, (_, index) => ({ id: String(index), name: `تصنيف ${index}` }));
  const renderPicker = () => picker.render(() => MerchantCategorySelect({ categories, value: selected, onChange: (value) => { selected = value; } }));
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return undefined;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
  }
  const openPicker = () => {
    find(renderPicker(), (node) => node.props?.accessibilityRole === 'combobox').props.onPress();
    const tree = renderPicker();
    assert.equal(find(tree, (node) => node.type === 'Modal').props.visible, true);
    return tree;
  };
  let tree = openPicker();
  let list = find(tree, (node) => node.type === 'FlatList');
  assert.equal(list.props.data.length, 300);
  list.props.renderItem({ item: categories[0] }).props.onPress();
  assert.equal(selected, '0'); assert.equal(find(renderPicker(), (node) => node.type === 'Modal').props.visible, false);
  tree = openPicker(); list = find(tree, (node) => node.type === 'FlatList');
  list.props.renderItem({ item: categories[299] }).props.onPress(); assert.equal(selected, '299');
  tree = openPicker(); find(tree, (node) => node.type === 'AppTextField').props.onChangeText('299');
  list = find(renderPicker(), (node) => node.type === 'FlatList');
  assert.equal(list.props.data.length, 1); assert.equal(list.props.data[0].id, '299');
  console.log('PASS: draft reference/exit guard/account isolation; modal selector search and first/last selection across 300 categories. Physical scrolling still needs a phone.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
