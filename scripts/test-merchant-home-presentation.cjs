// Executes the real page and shared summary with synthetic state; no network/DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, Date, Intl, setTimeout, clearTimeout, require: name => { assert(name in mocks, name); return mocks[name]; } });
  return exports;
}
const jsx = (type, props, key) => ({ type, props, key });
const runtime = { jsx, jsxs: jsx };
let dimensions={width:360,height:780,fontScale:1};
const rn = { useWindowDimensions:()=>dimensions, View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'Scroll', RefreshControl: 'RefreshControl', StyleSheet: { create: x => x }, Platform: { select: x => x.default ?? x.ios } };
const theme = load('src/constants/theme.ts', { 'react-native': rn, './fonts': { FontFamily: {} } });
const sample = () => ({ identity: { merchantId: 'merchant', merchantStatus: 'accepted', store: { id: 'store', name: 'متجر التجربة', status: 'accepted' } }, snapshot: { ownerId: 'owner', storeId: 'store', loadedAt: 1, finance:{payable:'9007199254740993.25',receivable:'100.50'},financeError:false, counts: { awaitingReview: 5, preparing: 3, readyForPickup: 2, products: 8, activeOffers: 1, availableProducts: 4 }, eligibility: { eligible: true, reason: 'ready', recheckDelay: null } }, busy: false, error: false });
const walk = node => !node || typeof node !== 'object' ? [] : [node, ...(Array.isArray(node.props?.children) ? node.props.children : [node.props?.children]).flatMap(walk)];
const strings = node => typeof node === 'string' ? node : !node || typeof node !== 'object' ? '' : (Array.isArray(node.props?.children) ? node.props.children : [node.props?.children]).map(strings).join(' ');
const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : typeof style === 'function' ? style({ pressed: false }) : style ?? {};
function luminance(hex) { const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return rgb.reduce((total, value, i) => total + value * [.2126, .7152, .0722][i], 0); }
function checkContrast(node, background) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'function') return checkContrast(node.type(node.props), background);
  const style = flatten(node.props?.style), surface = style.backgroundColor ?? background;
  if (node.type === 'Text' && /^#[0-9a-f]{6}$/i.test(style.color) && /^#[0-9a-f]{6}$/i.test(surface)) {
    const values = [luminance(style.color), luminance(surface)].sort((a, b) => a - b);
    assert((values[1] + .05) / (values[0] + .05) >= 4.5, `text contrast: ${style.color} on ${surface}`);
    assert.notEqual(node.props.allowFontScaling, false);
  }
  for (const child of Array.isArray(node.props?.children) ? node.props.children : [node.props?.children]) checkContrast(child, surface);
}
function setup(initial, colors) {
  let state = initial, owner = 'owner', index = 0, memo = [], stateSlots = [], loads = 0, lastLoad, subscriptions, finish;
  const paths = [];
  const refresh = () => new Promise(resolve => { finish = resolve; });
  const react = { useState: value => { const n=index++;if(n===0)return [state,next=>{state=next;}];if(!(n in stateSlots))stateSlots[n]=value;return[stateSlots[n],next=>{stateSlots[n]=typeof next==='function'?next(stateSlots[n]):next;}]; },
    useMemo: (fn, deps) => { const n = index++, old = memo[n]; if (!old || deps.some((x, i) => x !== old.deps[i])) memo[n] = { value: fn(), deps }; return memo[n].value; }, useEffect() {} };
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  const base = { react, 'react/jsx-runtime': runtime, 'react-native': rn, '@/constants/theme': theme, '@/context/ThemeContext': { useTheme: () => ({ colors }) } };
  const liveStatus = load('src/components/ui/LiveStatus.tsx', base).LiveStatus;
  const summary = load('src/components/home/HomeSummary.tsx', base).HomeSummary;
  const Page = load('src/app/merchant/index.tsx', { ...base,
    'expo-router': { useRouter: () => ({ push: route => paths.push(route) }), useFocusEffect() {} },
    '@/context/AuthContext': { useAuth: () => ({ user: owner ? { id: owner } : null }) },
    '@/lib/dashboard-spacing':load('src/lib/dashboard-spacing.ts',{'@/constants/theme':theme}),
    '@/components/ui/FinancialAmount':{FinancialAmount:load('src/components/ui/FinancialAmount.tsx',{...base,'@/lib/money':load('src/lib/money.ts',{})}).FinancialAmount},
    '@/components/ui/LoadingState': { RefreshStatus: 'RefreshStatus' }, '@/components/ui/LiveStatus': { LiveStatus: liveStatus }, '@/context/AppDialogContext': { useAppDialog: () => ({ alert: async () => true }) },
    '@/components/ui/AppButton': { AppButton: 'Button' }, '@/components/ui/AppIcon': { AppIcon: 'Icon' }, '@/components/home/HomeSummary': { HomeSummary: summary },
    '@/hooks/useDriverTaskRefresh': { useDriverTaskRefresh: fn => { if (lastLoad) assert.equal(fn, lastLoad, 'loader stays stable'); lastLoad = fn; return refresh; } },
    '@/hooks/useOrderRealtime': { useOrderRealtime: options => { if (subscriptions) assert.equal(options.subscriptions, subscriptions, 'subscription scope stays stable'); subscriptions = options.subscriptions; return {}; } },
    '@/lib/operational-home': { eligibilityReasons: { ready: 'متجرك مؤهل لاستقبال طلبات جديدة.', unavailable: 'راجع الإدارة.', subscription_unpaid: 'يلزم سداد الاشتراك.', approval: 'الاعتماد غير مكتمل.' } },
    '@/lib/merchant-home': { merchantStoreStatusLabels:{accepted:"متجر معتمد",pending:"قيد المراجعة",changes_requested:"بحاجة إلى استكمال",rejected:"غير مقبول"}, initialMerchantHomeState: initial, createMerchantHomeController: () => ({ activate() {}, deactivate() {}, refresh: () => { loads++; } }), merchantHomeActions: s => ({ addProduct: Boolean(s.snapshot) && !s.busy && !s.error, addOffer: Boolean(s.snapshot) && !s.busy && !s.error }) },
  }).default;
  return { render() { index = 0; const root = Page(); return root ? root.type(root.props) : null; }, paths, summary, update: next => { state = next; }, owner: next => { owner = next; }, finish: () => finish(), loads: () => loads, page: Page };
}
async function main() {
  for (const colors of [theme.LightColors, theme.DarkColors]) {
    const h = setup(sample(), colors), first = h.render();
    checkContrast(first, colors.background);
    const text = strings(first);
    assert(text.indexOf('يستقبل الطلبات') < text.indexOf('طلبات متجرك'));
    assert(text.indexOf('طلبات متجرك') < text.indexOf('المنتجات والعروض'));
    const cards = walk(first).filter(n => n.type === h.summary);
    assert.deepEqual(cards.map(c => c.props.count), [5, 3, 2]);
    for (const [i, filter] of ['awaiting_review', 'preparing', 'ready_for_pickup'].entries()) { cards[i].props.onPress(); assert.equal(h.paths.pop().params.filter, filter); }
    assert(!walk(first).some(n => n.props?.title === 'مراجعة فواتير الاشتراك'));
    walk(first).find(n=>n.props?.accessibilityHint?.includes('حسابك وفواتيرك')).props.onPress();assert.equal(h.paths.pop(),'/merchant/finance');
    assert(strings(first).includes('الحساب المالي'));assert(strings(first).includes('متجر معتمد'));
    for(const [title,target] of [['إضافة منتج','/merchant/product-editor'],['إضافة عرض','/merchant/offer-editor']]){
      const action=walk(first).find(n=>n.props?.title===title);assert(action);action.props.onPress();assert.equal(h.paths.pop(),target);
    }
    const failed = sample(); failed.error = true; h.update(failed);
    let tree = h.render();
    assert(strings(tree).includes('حالة المتجر غير مؤكدة'));
    assert.deepEqual(walk(tree).filter(n => n.type === h.summary).map(c => c.props.count), [5, 3, 2], 'failed read keeps same-owner counts');
    assert(walk(tree).find(n => n.props?.title === 'إضافة منتج').props.disabled);
    const busy = sample(); busy.busy = true; h.update(busy); tree = h.render();
    const scroll = walk(tree).find(n => n.type === 'Scroll');
    assert.equal(scroll.props.refreshControl.props.refreshing, false, 'background work does not start pull spinner');
    const pending = scroll.props.refreshControl.props.onRefresh();
    assert.equal(walk(h.render()).find(n => n.type === 'Scroll').props.refreshControl.props.refreshing, true);
    h.finish(); await pending; for (let i = 0; i < 5; i++) await Promise.resolve();
    assert.equal(walk(h.render()).find(n => n.type === 'Scroll').props.refreshControl.props.refreshing, false);
    assert.equal(h.loads(), 0, 'render does not read or write data');
    const unpaid = sample(); unpaid.snapshot.eligibility = { eligible: false, reason: 'subscription_unpaid' }; h.update(unpaid);
    tree = h.render(); walk(tree).find(n => n.props?.title === 'مراجعة فواتير الاشتراك').props.onPress(); assert.equal(h.paths.pop().params.search, 'SUB-');
    assert(strings(tree).includes('متجر معتمد') && strings(tree).includes('فاتورة الاشتراك غير مسددة'), 'store approval is distinct from order eligibility');
    checkContrast(tree, colors.background);
    unpaid.snapshot.eligibility = { eligible: false, reason: 'unavailable' }; h.update(unpaid);
    assert(!walk(h.render()).some(n => n.props?.title === 'مراجعة فواتير الاشتراك'), 'unknown reason must not imply a subscription problem');
    unpaid.snapshot.eligibility = { eligible: false, reason: 'approval' }; h.update(unpaid);
    walk(h.render()).find(n => n.props?.title === 'مراجعة معلومات المتجر').props.onPress(); assert.equal(h.paths.pop(), '/merchant/store-info');
    h.owner('other'); assert.equal(h.page().key, 'other'); h.owner(null); assert.equal(h.page(), null);
  }
  for (const state of [{ identity: null, snapshot: null, busy: true, error: false }, { identity: null, snapshot: null, busy: false, error: true }]) {
    const h = setup(state, theme.DarkColors), cards = walk(h.render()).filter(n => n.type === h.summary);
    assert(cards.every(c => c.props.count === undefined && c.props.disabled), 'unloaded is not zero');
  }
  const empty = sample(); Object.assign(empty.snapshot.counts, { awaitingReview: 0, preparing: 0, readyForPickup: 0 });
  assert(!strings(setup(empty, theme.LightColors).render()).includes('لا توجد طلبات تحتاج متابعة الآن.'));
  for (const width of [320, 360, 390]) for (const fontScale of [1, 1.5, 2]) {
    dimensions = { width, height: 740, fontScale };
    const state = sample(); state.identity.store.name = 'متجر طويل الاسم لتجربة التفاف النص دون قص بيانات التاجر';
    const h = setup(state, theme.DarkColors), tree = h.render();
    const grid = walk(tree).find(n => n.props?.style?.flexWrap === 'wrap' && n.props?.style?.alignItems === 'stretch');
    assert(grid); const cells = grid.props.children;
    const basis = flatten(cells[0].props.style).flexBasis;
    const available = width - 2 * theme.LayoutSpacing.pageGutter;
    const columns = Math.min(3, Math.floor((available + theme.Spacing.two) / (basis + theme.Spacing.two)));
    assert(columns >= 1);
    if (fontScale === 1) assert.equal(columns, 3, 'three columns fit small/medium normal text');
    if (fontScale === 2) assert(columns < 3, 'large fonts are allowed more rows');
    assert(strings(tree).includes(state.identity.store.name));
    for (const card of walk(tree).filter(n => n.type === h.summary)) {
      const rendered = card.type(card.props), style = flatten(rendered.props.style);
      assert(style.minHeight >= 44); assert.equal(rendered.props.accessibilityRole, 'button');
      assert(!strings(rendered).includes(card.props.description), 'compact description is accessible, not a tall visible paragraph');
      assert(rendered.props.accessibilityLabel.includes(card.props.description));
    }
    const productWrapper=walk(tree).find(n=>n.props?.children?.props?.title==='إضافة منتج');
    assert.equal(flatten(productWrapper.props.style).flexBasis,Math.max(140,140*fontScale));
  }
  const base = { 'react-native': rn, 'react/jsx-runtime': runtime, '@/constants/theme': theme, '@/context/ThemeContext': { useTheme: () => ({ colors: theme.DarkColors }) } };
  const Status = load('src/components/ui/LiveStatus.tsx', base).LiveStatus;
  const connected = Status({ state: 'live', compact: true, updatedAt: 123456 }), disconnected = Status({ state: 'disconnected', compact: true, updatedAt: 123456 });
  assert.equal(flatten(connected.props.style).minHeight, flatten(disconnected.props.style).minHeight);
  assert(connected.props.accessibilityLabel.includes('آخر قراءة ناجحة'));
  assert(disconnected.props.accessibilityLabel.includes('مستقل عن نجاح قراءة البيانات'));
  assert(!strings(connected).includes('التحديث اليدوي متاح'));
  assert(strings(Status({ state: 'live' })).includes('التحديث اليدوي متاح'), 'legacy consumers keep their default presentation');
  const Summary = load('src/components/home/HomeSummary.tsx', base).HomeSummary;
  assert(strings(Summary({ title:'إدارة',count:2,description:'وصف الإدارة',onPress(){} })).includes('وصف الإدارة'), 'admin default card remains unchanged');
  assert.equal(theme.LightColors.pendingSurface, theme.LightColors.warningSurface);
  assert.equal(theme.LightColors.pendingForeground, theme.LightColors.warningForeground);
  assert.equal(theme.LightColors.pendingBorder, theme.LightColors.borderStrong, 'accepted light compact card colors are preserved');
  assert.notEqual(theme.DarkColors.pendingSurface, theme.DarkColors.warningSurface, 'pending compact card uses the new dark surface only');
  const spacing = load('src/lib/dashboard-spacing.ts', {'@/constants/theme':theme}).dashboardSectionGap;
  assert.equal(spacing(500,630,4,1),8);
  assert.equal(spacing(700,630,4,1),12);
  assert.equal(spacing(1000,630,4,1),16);
  assert.equal(spacing(1000,630,4,2),8,'large text prioritizes content over spreading whitespace');
  assert.equal(spacing(1000,0,4,1),8,'unknown layout never invents spare space');
  for (const [width,height,fontScale,amount] of [[320,568,1,'100.50'],[390,844,1,'100.50'],[768,1024,1,'100.50'],[390,844,2,'100.50'],[390,844,1,'1234567890123456789012345678901234567890.12']]) {
    dimensions={width,height,fontScale};const state=sample();state.snapshot.finance.payable=amount;
    const h=setup(state,theme.DarkColors);let tree=h.render();
    tree.props.onLayout({nativeEvent:{layout:{height,width}}});
    const sections=walk(tree).filter(n=>n.props?.onLayout&&n!==tree);
    assert.equal(sections.length,4);
    for(const [i,section] of sections.entries())section.props.onLayout({nativeEvent:{layout:{height:[130,150,200,150][i],width}}});
    tree=h.render();
    assert.equal(flatten(walk(tree).find(n=>n.type==='Scroll').props.contentContainerStyle).gap,spacing(height,630,4,fontScale));
    const finance=walk(tree).find(n=>n.props?.accessibilityHint?.includes('حسابك وفواتيرك'));
    assert(strings(finance).includes('الحساب المالي')&&strings(finance).includes('فتح المالية'));
    assert(strings(finance).includes('مطلوب منك دفعه للمنصة'));
    const values=walk(finance).find(n=>Array.isArray(n.props?.style)&&n.props.style[0]?.gap===theme.Spacing.three&&n.props.style[1]?.flexDirection);
    assert.equal(flatten(values.props.style).flexDirection,fontScale>1.25||amount.length>12?'column':'row-reverse');
    const figure=walk(finance).find(n=>n.props?.amount===amount);assert(figure);
    assert.equal(figure.type(figure.props).props.numberOfLines,undefined,'money has no ellipsis or line cap');
    const status=walk(tree).find(n=>n.props?.compact&&n.props?.hideTimestamp);assert(status);
    const statesColumn=walk(tree).find(n=>n.props?.style?.[0]?.alignItems==='flex-end');assert(statesColumn);
    assert(strings(statesColumn).includes('متجر معتمد')&&strings(statesColumn).includes('يستقبل الطلبات'));
    state.snapshot.financeError=true;h.update(state);assert(strings(h.render()).includes('المبالغ من آخر قراءة ناجحة'));
    assert.equal(h.loads(),0,'layout measurements never trigger data loads');
  }
  console.log('PASS merchant page: order/eligibility priority, actual filters, correct contextual links, retained data, unknown/empty, pull-vs-background, stable dependencies, account key and both theme palettes.');
  console.log('PASS compact constraints: 320/360/390 widths, 1/1.5/2 font scales, RTL wrapping, touch targets, accessible descriptions, fixed connection slots and unchanged shared defaults (not native layout measurement).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
