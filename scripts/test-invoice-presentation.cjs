// Executes production presentation and screen handlers with local React/native adapters.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,BigInt,Set,Object,Promise,AbortController,require:n=>{assert(n in mocks,n);return mocks[n];}});return exports;}
const show=load('src/lib/invoice-presentation.ts').invoicePresentation;
const due=(amount,remaining)=>({id:'due',purpose:'sale',direction:'out',amount,remaining});
const base={status:'confirmed',voided_by:null,dues:[due('100.00','100.00')]};
assert.equal(show(base).payment,'غير مسددة');assert.equal(show({...base,dues:[due('100','0.01')]}).payment,'مسددة جزئيًا');assert.equal(show({...base,dues:[due('100','0')]}).payment,'مسددة');
assert.equal(show({...base,dues:[due('999999999999999999999999999999.99','999999999999999999999999999999.98')]}).payment,'مسددة جزئيًا');
for(const record of [{...base,status:'pending'},{...base,status:'cancelled'},{...base,voided_by:'correction'},{...base,dues:[]}])assert.equal(show(record).payment,null,'no inferred payment for cancelled/pending/no-dues records');
assert.equal(show({...base,dues:[due('10','0'),due('20','20')]}).payment,'مسددة جزئيًا');
console.log('PASS issuance independent from payment, partial/full/zero/multiple dues and large exact decimals');

let cursor=0;const cells=[],effects=[],writes=[],confirms=[];
const jsx=(type,props)=>({type,props});
const react={useState(initial){const i=cursor++;if(!cells[i])cells[i]={value:initial};const cell=cells[i];return[cell.value,value=>cell.value=typeof value==='function'?value(cell.value):value];},useRef(initial){const i=cursor++;return cells[i]??(cells[i]={current:initial});},useCallback:f=>f};
const invoice={...base,id:'invoice',kind:'SAL',reference:'SAL-0000001',owner_id:'merchant',owner_name:'تاجر الاختبار',admin:true,title:'فاتورة بيع',amount:'100',details:{},references:{},corrects:null,settlements:[]};
const mocks={react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{ActivityIndicator:'Spinner',Text:'Text',View:'View'},'expo-router':{useFocusEffect:fn=>effects.push(fn),useLocalSearchParams:()=>({id:'invoice'}),useRouter:()=>({back(){},push(){}})},'@/context/AuthContext':{useAuth:()=>({user:{id:'admin'}})},'@/context/ThemeContext':{useTheme:()=>({colors:{}})},'@/context/AppDialogContext':{useAppDialog:()=>({confirm:async request=>{confirms.push(request);return true;}})},'@/constants/theme':{Typography:{}},'@/lib/money':{formatSypExact:s=>s},'@/hooks/useOrderRealtime':{useOrderRealtime:()=> 'live'},'@/lib/invoice-finance':{readInvoice:async()=>invoice,pendingMoneyAction:async()=>undefined,moneyAction:async(owner,input)=>{writes.push(input);return{state:'rejected',message:'اختبار رفض'};},invoiceKindLabels:{SAL:'بيع'},purposeLabels:{sale:'حق التاجر'}}};
for(const [module,name]of [['finance/InvoiceStatus','InvoiceStatus'],['ui/LiveStatus','LiveStatus'],['ui/DocumentReference','DocumentReference'],['navigation/AppHeader','AppHeader'],['ui/KeyboardAwareScrollView','KeyboardAwareScrollView'],['ui/AppButton','AppButton'],['ui/AppTextField','AppTextField']])mocks['@/components/'+module]={[name]:name};
mocks['@/lib/user-error-message']=load('src/lib/user-error-message.ts');
mocks['@/components/ui/LoadingState']={LoadingSkeleton:'LoadingSkeleton',RefreshStatus:'RefreshStatus'};
mocks['@/components/finance/PendingMoneyCard']={PendingMoneyCard:'PendingMoneyCard'};
mocks['@/components/finance/FinancialAccountSummary']={FinancialAccountSummary:'FinancialAccountSummary'};
mocks['@/components/finance/FinancialParts']=Object.fromEntries(['FinancialAmount','FinancialFeedback','FinancialSection','InvoiceListItem'].map(n=>[n,n]));
const screen=load('src/components/finance/InvoiceScreen.tsx',mocks).InvoiceScreen;
const render=()=>{cursor=0;const wrapper=screen({});return wrapper.type(wrapper.props);};
const nodes=(tree)=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const button=(tree,title)=>{const node=nodes(tree).find(n=>n.type==='AppButton'&&n.props.title===title);assert(node,title);return node.props;};
const field=(tree,label)=>{const node=nodes(tree).find(n=>n.type==='AppTextField'&&n.props.label===label);assert(node,label);return node.props;};
async function main(){
 let tree=render();effects[0]();for(let i=0;i<16;i++)await Promise.resolve();tree=render();
 assert(!nodes(tree).some(n=>n.type==='AppTextField'&&n.props.label==='سبب التصحيح'));
 button(tree,'تسجيل صرف فعلي').onPress();tree=render();field(tree,'سبب التسوية / مرجع التسليم').onChangeText('سبب التسوية الأول');
 button(tree,'إجراءات إضافية — تصحيح المستند').onPress();tree=render();assert.equal(field(tree,'سبب التصحيح').value,'');
 field(tree,'سبب التصحيح').onChangeText('سبب تصحيح مستقل');tree=render();await button(tree,'مراجعة التصحيح واعتماده').onPress();
 for(let i=0;i<12;i++)await Promise.resolve();tree=render();assert.equal(writes[0].action,'correct');assert.equal(writes[0].reason,'سبب تصحيح مستقل');assert(confirms[0].message.includes('SAL-0000001'));assert.equal(field(tree,'سبب التصحيح').value,'سبب تصحيح مستقل','business rejection preserves form');
 button(tree,'تسجيل صرف فعلي').onPress();tree=render();assert.equal(field(tree,'سبب التسوية / مرجع التسليم').value,'');assert(!nodes(tree).some(n=>n.type==='AppTextField'&&n.props.label==='سبب التصحيح'));
 console.log('PASS actual invoice screen: correction hidden by default, separate form reasons, reference in confirmation, rejected input preserved');
 cells.length=0;effects.length=0;
 mocks['expo-router'].usePathname=()=>'/admin/finance';
 mocks['@/constants/theme'].Typography={};
 mocks['@/lib/invoice-finance'].readMoney=async()=>({admin:true,account_reference:'ACC-0001',cash:'100',receivable:'20',payable:'10',collection_due:'20',subscription_due:'0',rows:[invoice]});
 mocks['@/lib/invoice-finance'].moneyPeople=async()=>[{id:'driver',name:'سائق الاختبار',role:'driver',account_reference:'ACC-0002',policy:{mode:'salary',value:1000}}];
 mocks['@/lib/invoice-finance'].difference=()=> '0';
 mocks['react-native'].Pressable='Pressable';
 const finance=load('src/components/finance/FinanceScreen.tsx',mocks).FinanceScreen;
 const renderFinance=()=>{cursor=0;const parent=finance();const child=nodes(parent).find(n=>typeof n.type==='function');assert(child);return child.type(child.props);};
 tree=renderFinance();effects.at(-1)();for(let i=0;i<12;i++)await Promise.resolve();tree=renderFinance();
 assert(!nodes(tree).some(n=>n.type==='AppTextField'&&n.props.label==='اسم الطرف أو رمز حسابه'));
 button(tree,'اختيار حساب تاجر أو سائق').onPress();tree=renderFinance();
 const driver=nodes(tree).find(n=>n.type==='Pressable'&&JSON.stringify(n.props.children).includes('سائق الاختبار'));assert(driver);driver.props.onPress();tree=renderFinance();effects.at(-1)();for(let i=0;i<12;i++)await Promise.resolve();tree=renderFinance();
 assert(!nodes(tree).some(n=>n.type==='AppTextField'&&n.props.label==='سبب الإجراء'));
 button(tree,'إعداد أجر المهام التالية').onPress();tree=renderFinance();
 assert.equal(field(tree,'المبلغ ل.س').value,'','salary amount is never silently reused as per-task wage');
 assert(!nodes(tree).some(n=>n.type==='AppButton'&&/راتب للفترة|إصدار فاتورة استحقاق الراتب/.test(n.props.title)));
 console.log('PASS actual admin finance: account picker and wage settings collapsed, no salary creation or silent salary-to-task conversion');
 const pendingReader=mocks['@/lib/invoice-finance'].pendingMoneyAction;
 mocks['@/lib/invoice-finance'].pendingMoneyAction=async()=>{throw Error('disk/network unavailable');};
 await effects.at(-1)() ;for(let i=0;i<20;i++)await Promise.resolve();tree=renderFinance();
 assert(nodes(tree).some(n=>n.type==='FinancialAccountSummary'),'cache-check failure must not hide a successful money read');
 assert(nodes(tree).some(n=>n.type==='FinancialFeedback'&&n.props.message.includes('الإجراءات المالية متوقفة')));
 const writesBefore=writes.length;await button(tree,'حفظ سياسة الأجر للمهام التالية').onPress();for(let i=0;i<12;i++)await Promise.resolve();assert.equal(writes.length,writesBefore,'partial read never permits an unverified new writer');
 mocks['@/lib/invoice-finance'].pendingMoneyAction=pendingReader;
 console.log('PASS partial finance failure retains data, explains missing verification and prevents financial writes');

 const parts={FinancialSection:'FinancialSection',FinancialAmount:'FinancialAmount',FinancialFeedback:'FinancialFeedback'};
 const summary=load('src/components/finance/FinancialAccountSummary.tsx',{...mocks,'./FinancialParts':parts}).FinancialAccountSummary;
 const totals={admin:false,account_reference:'ACC-0000001',cash:null,payable:'10',receivable:'20',collection_due:'20',subscription_due:'5'};
 const labels=tree=>nodes(tree).filter(n=>n.type==='FinancialAmount').map(n=>n.props.label);
 const merchant=labels(summary({data:totals,view:'merchant',targeted:false})),driverLabels=labels(summary({data:totals,view:'driver',targeted:false}));
 assert(merchant.includes('اشتراكات غير مسددة'));assert(!merchant.includes('كامل تحصيل العملاء الواجب تسليمه'));
 assert(driverLabels.includes('كامل تحصيل العملاء الواجب تسليمه'));assert(!driverLabels.includes('اشتراكات غير مسددة'));
 assert.equal(summary({data:{...totals,account_reference:null},view:'customer',targeted:false}),null);
 assert(!labels(summary({data:{...totals,admin:true},view:'customer',targeted:true})).includes('نقد الخزينة الفعلي'),'unknown targeted account must not masquerade as treasury');
 cells.length=0;effects.length=0;let checks=0,resumes=0;
 const pendingCard=load('src/components/finance/PendingMoneyCard.tsx',{...mocks,'./FinancialParts':parts,'@/lib/pending-money-review':{readPendingMoneyReview:async()=>{checks++;return{attemptKey:'frozen-key',input:{action:'settle',reason:'سبب محفوظ'},label:'قبض فعلي',party:'التاجر',reference:'SUB-0000001',amount:'12.50',amountLabel:'المبلغ'};}}}).PendingMoneyCard;
 const renderPending=()=>{cursor=0;return pendingCard({owner:'admin',busy:false,onResume:async key=>{assert.equal(key,'frozen-key');resumes++;},onRefresh:async()=>{}});};
 tree=renderPending();const stop=effects.at(-1)();for(let i=0;i<12;i++)await Promise.resolve();tree=renderPending();assert.equal(resumes,0);assert.equal(checks,1);
 button(tree,'التحقق فقط — دون تنفيذ').onPress();for(let i=0;i<12;i++)await Promise.resolve();tree=renderPending();assert.equal(checks,2);assert.equal(resumes,0);
 button(tree,'مراجعة واستكمال المحاولة نفسها').onPress();assert.equal(resumes,1);stop();
 console.log('PASS role-specific summaries and actual pending card: mount/check are read-only; explicit resume is bound to displayed intent');
 cells.length=0;effects.length=0;tree=render();effects.at(-1)();for(let i=0;i<12;i++)await Promise.resolve();tree=render();
 button(tree,'تسجيل صرف فعلي').onPress();tree=render();field(tree,'مبلغ التسوية ل.س — يمكن دفع جزء').onChangeText('42');
 invoice.dues=[due('100','0')];tree=render();assert.equal(button(tree,'اعتماد فاتورة التسوية').disabled,true);assert.equal(field(tree,'مبلغ التسوية ل.س — يمكن دفع جزء').value,'42');invoice.dues=base.dues;
 mocks['@/lib/invoice-finance'].pendingMoneyAction=async()=>({action:'settle',due:'due',amount:'12.50',reason:'saved'});
 mocks['@/context/AppDialogContext'].useAppDialog=()=>({confirm:async()=>false});
 effects.at(-1)();for(let i=0;i<12;i++)await Promise.resolve();tree=render();const pending=nodes(tree).find(n=>n.type==='PendingMoneyCard');assert(pending);const written=writes.length;await pending.props.onResume('frozen-key');assert.equal(writes.length,written,'cancelling explicit resume must not send any action');
 console.log('PASS fully settled realtime due disables submit without erasing draft; cancelling pending resume sends no financial action');

 // The merchant layout must reject a stale owner or privileged snapshot before displaying any part of it.
 cells.length=0;effects.length=0;
 let owner='merchant',query='SUB-',response;
 const reads=[], destinations=[];
 const ownedInvoice={...invoice,owner_id:owner,kind:'SUB',reference:'SUB-0000001'};
 const owned={...totals,owner,rows:[ownedInvoice]};
 response=owned;
 const merchantMocks={
   ...mocks,
   'expo-router':{usePathname:()=>'/merchant/finance',useLocalSearchParams:()=>({search:query}),
     useFocusEffect:fn=>effects.push(fn),useRouter:()=>({push:route=>destinations.push(route)})},
   '@/context/AuthContext':{useAuth:()=>({user:{id:owner}})},
   '@/lib/invoice-finance':{...mocks['@/lib/invoice-finance'],
     readMerchantMoney:async(...args)=>{reads.push(args);return {overview:response,hasMore:response===owned};},
     pendingMoneyAction:async()=>undefined,
     moneyPeople:async()=>{throw Error('merchant must never read the directory');}},
 };
 const merchantScreen=load('src/components/finance/FinanceScreen.tsx',merchantMocks).FinanceScreen;
 const view=()=>null;
 const renderMerchant=()=>{
   cursor=0;
   const parent=merchantScreen({MerchantView:view});
   const child=nodes(parent).find(n=>typeof n.type==='function');
   return {key:child.props.owner, view:child.type(child.props).props};
 };
 renderMerchant();const stopMerchant=effects.at(-1)();
 for(let i=0;i<12;i++)await Promise.resolve();
 let merchantView=renderMerchant().view;
 assert.deepEqual(reads[0],['','SUB',undefined]);
 assert.equal(merchantView.data.rows[0].reference,'SUB-0000001');
 merchantView.onInvoice('invoice');
 assert.equal(destinations[0].pathname,'/financial-invoice');
 assert.equal(destinations[0].params.id,'invoice');
 merchantView.onPage(1);
 merchantView=renderMerchant().view;
 assert.equal(merchantView.page,1);
 assert.equal(merchantView.data,null);
 await merchantView.onRefresh();
 assert.equal(reads.at(-1)[2].id,'invoice');
 merchantView=renderMerchant().view;
 merchantView.onSearch('SUB-0000001');
 merchantView=renderMerchant().view;
 assert.equal(merchantView.page,0);
 assert.equal(merchantView.kind,'SUB');
 assert.equal(merchantView.data,null,'previous search rows are hidden while the new scope loads');
 assert.equal(merchantView.account,owned,'same owner retains account totals while changing the filter');
 merchantView.onKind('SAL');
 merchantView=renderMerchant().view;
 assert.equal(merchantView.query,'SUB-0000001');
 assert.equal(merchantView.kind,'SAL');
 await merchantView.onRefresh();
 assert.deepEqual(reads.at(-1),['SUB-0000001','SAL',undefined]);
 for(const invalid of [{...owned,owner:'another'}, {...owned,admin:true}, {...owned,rows:[{...ownedInvoice,owner_id:'another'}]}]){
   response=invalid;
   await renderMerchant().view.onRefresh();
   merchantView=renderMerchant().view;
   assert.equal(merchantView.account,null);
   assert.equal(merchantView.data,null);
   assert(merchantView.error);
 }
 stopMerchant();
 owner='another';query='';cells.length=0;
 assert.equal(renderMerchant().key,'another');
 assert.equal(renderMerchant().view.account,null);
 assert.equal(writes.length,written,'list navigation, search and refresh send no financial write');
 console.log('PASS merchant finance: SUB- deep link, read-only invoice navigation, scoped search, owner/row/admin rejection and fresh account state');

 const theme=load('src/constants/theme.ts',{'react-native':{Platform:{select:values=>values.default??values.ios}},'./fonts':{FontFamily:{}}});
 const money=load('src/lib/money.ts');
 for(const colors of [theme.LightColors,theme.DarkColors]){
   const presentation=load('src/components/finance/MerchantFinanceView.tsx',{
     ...merchantMocks,
     react:{useCallback:fn=>fn,useEffect:fn=>fn(),useRef:current=>({current})},
     'react-native':{...mocks['react-native'],ScrollView:'ScrollView',StyleSheet:{create:styles=>styles,hairlineWidth:1},Keyboard:{dismiss(){}}},
     '@/constants/theme':theme,
     '@/context/ThemeContext':{useTheme:()=>({colors})},
     '@/components/ui/AppIcon':{AppIcon:'AppIcon'},
     '@/components/ui/LoadingState':{useLongWait:()=>false},
     '@/lib/money':money,
     '@/lib/invoice-finance':{difference:()=>'-10.00',invoiceKindLabels:{SUB:'فاتورة اشتراك'}},
     './FinancialParts':parts,
     './InvoiceStatus':{InvoiceStatus:'InvoiceStatus'},
   });
   const kinds=[], opened=[], pages=[];
   const props={...merchantView,account:owned,data:owned,kind:'SUB',page:0,hasNext:true,query:'',search:'',error:'',
     onKind:value=>kinds.push(value),onInvoice:id=>opened.push(id),onPage:page=>pages.push(page)};
   const flatten=node=>{
     if(!node||typeof node!=='object')return[node];
     if(Array.isArray(node))return node.flatMap(flatten);
     if(typeof node.type==='function')return flatten(node.type(node.props));
     return [node,...flatten(node.props.children)];
   };
   const rendered=flatten(presentation.MerchantFinanceView(props));
   assert(rendered.includes('مستحق لك من المنصة'));
   assert(rendered.includes('مطلوب منك دفعه للمنصة'));
   assert(rendered.includes('صافي الرصيد عليك'));
   assert(rendered.includes(money.formatSypExact('10.00')));
   assert(rendered.some(node=>node?.type==='InvoiceStatus'&&node.props.invoice===ownedInvoice));
   rendered.find(node=>node?.props?.accessibilityHint==='يفتح تفاصيل المستند').props.onPress();
   const chips=rendered.filter(node=>typeof node?.props?.accessibilityState?.selected==='boolean');
   assert.equal(chips.length,5);
   assert.equal(chips.filter(node=>node.props.accessibilityState.selected).length,1);
   const strip=rendered.find(node=>node?.type==='ScrollView');
   assert.equal(strip.props.horizontal,true);
   assert.equal(strip.props.contentContainerStyle.flexWrap,'nowrap');
   const scrolls=[];
   strip.props.ref.current={scrollTo:options=>scrolls.push(options)};
   strip.props.onLayout({nativeEvent:{layout:{width:240}}});
   strip.props.onContentSizeChange(520);
   chips.find(node=>node.props.accessibilityState.selected).props.onLayout({nativeEvent:{layout:{x:320,width:100}}});
   assert.equal(scrolls.at(-1).x,250);
   strip.props.onLayout({nativeEvent:{layout:{width:600}}});
   assert.equal(scrolls.at(-1).x,0);
   chips[1].props.onPress();
   assert.deepEqual(opened,['invoice']);
   assert.deepEqual(kinds,['SAL']);
   const previous=rendered.find(node=>node?.props?.accessibilityLabel==='السابق');
   const next=rendered.find(node=>node?.props?.accessibilityLabel==='التالي');
   assert(previous.props.disabled);
   assert(!next.props.disabled);
   assert(next.props.style.minHeight>=44&&next.props.style.minWidth>=44);
   assert(rendered.indexOf(previous)>rendered.findIndex(node=>node?.type==='InvoiceStatus'));
   next.props.onPress();
   const lastPage=flatten(presentation.MerchantFinanceView({...props,page:1,hasNext:false}));
   assert(lastPage.find(node=>node?.props?.accessibilityLabel==='التالي').props.disabled);
   lastPage.find(node=>node?.props?.accessibilityLabel==='السابق').props.onPress();
   assert.deepEqual(pages,[1,0]);
   const waiting=flatten(presentation.MerchantFinanceView({...props,data:null,refreshing:true}));
   assert(waiting.includes('صافي الرصيد عليك'));
   assert(!waiting.some(node=>node?.type==='InvoiceStatus'));
   const driver=flatten(presentation.FinanceAccountView({...props,role:'driver',kind:'DLV',
     filters:[{kind:'ALL',label:'الكل'},{kind:'DLV',label:'التوصيل'}],
     account:{...owned,collection_due:'80.25',payable:'30.15'},refreshing:true}));
   for(const label of ['النقد الواجب توريده للمنصة','مستحقات السائق من الأجور',money.formatSypExact('80.25'),money.formatSypExact('30.15')])assert(driver.includes(label));
   assert(!driver.some(node=>typeof node==='string'&&(node.includes('صافي الرصيد')||node.includes('متبقي على الاشتراك'))));
   assert.deepEqual(driver.find(node=>node?.type==='InvoiceStatus').props,rendered.find(node=>node?.type==='InvoiceStatus').props);
   assert.deepEqual(driver.find(node=>node?.type==='ScrollView').props.contentContainerStyle,strip.props.contentContainerStyle);
   assert.deepEqual(driver.find(node=>node?.props?.accessibilityLabel==='السابق').props.style,previous.props.style);
 }
 console.log('PASS shared finance view in both palettes: role-specific balances, identical invoice/filter/paging layout and retained rows during refresh');
 {
 cells.length=0;effects.length=0;
 const copied=[], notices=[], routes=[];
 const id='10000000-0000-0000-0000-000000000001';
 const sale={...invoice,id,admin:false,created_at:'2026-11-10T12:00:00Z',
   reference:'SAL-123456789012345678',store_order_id:'store-order',references:{SOR:'SOR-0000001',ORD:'ORD-0000001'},
   details:{store:'المتجر',commission:'10',merchant_net:'90',items:[{title:'منتج',price:'100',quantity:'1',total:'100'}]},
   dues:[due('90','30')],settlements:[{id:'settlement',reference:'SET-0000001',amount:'60',voided:false}]};
 const flatten=node=>Array.isArray(node)?node.flatMap(flatten):!node||typeof node!=='object'?[node]:
   typeof node.type==='function'?flatten(node.type(node.props)):[node,...flatten(node.props?.children)];
 class InvoiceUnavailableError extends Error {constructor(){super('الفاتورة غير متاحة لهذا الحساب.');}}
 let response=async()=>sale;
 const merchantDetailMocks={
   ...mocks, 'react-native':{...mocks['react-native'],ScrollView:'ScrollView',StyleSheet:{create:v=>v,hairlineWidth:1}},
   'expo-router':{useRouter:()=>({canGoBack:()=>false,replace:v=>routes.push(v),push:v=>routes.push(v)}),useFocusEffect:fn=>effects.push(fn)},
   'expo-clipboard':{setStringAsync:async value=>{copied.push(value);return true;}},
   '@/context/ToastContext':{useToast:()=>({show:notice=>notices.push(notice)})},
   '@/components/ui/LoadingState':{useLongWait:()=>false},
   '@/constants/theme':theme,'@/lib/money':money,
   '@/lib/invoice-finance':{readInvoice:(...args)=>response(...args),InvoiceUnavailableError,
     difference:(amount,remaining)=>String(Number(amount)-Number(remaining)),invoiceKindLabels:{SAL:'مبيعات',SUB:'اشتراك',SET:'تسوية',COR:'تصحيح'}},
   './FinancialParts':parts,'./InvoiceStatus':{InvoiceStatus:'InvoiceStatus'},
 };
 for(const colors of [theme.LightColors,theme.DarkColors]){
   const {MerchantInvoiceDocument}=load('src/components/finance/MerchantInvoiceScreen.tsx',{
     ...merchantDetailMocks,'@/context/ThemeContext':{useTheme:()=>({colors})},
   });
   const display=(invoice)=>flatten(MerchantInvoiceDocument({invoice,onCopy(){},onOrder:v=>routes.push(v),onInvoice:v=>routes.push(v),onReference:v=>routes.push(v)}));
   const sales=display(sale);
   for(const value of ['عمولة المنصة','مستحق التاجر عند الإصدار','منتج','ما استلمته',money.formatSypExact('60'),'المتبقي'])assert(sales.includes(value));
   assert(sales.some(node=>node?.type==='InvoiceStatus'&&show(node.props.invoice).payment==='مسددة جزئيًا'));
   assert(display({...sale,voided_by:'correction'}).every(value=>value!=='ملخص السداد'));
   assert(display({...sale,kind:'SUB',details:{plan:'خطة التاجر',months:3}}).includes('خطة التاجر'));
   const settlement=display({...sale,kind:'SET',dues:[],cashDirection:'in',details:{original_reference:'SUB-0000001'}});
   assert(settlement.includes('منك إلى المنصة'));
   settlement.find(node=>node?.props?.accessibilityRole==='link'&&flatten(node).includes('فتح المستند الأصلي')).props.onPress();
   assert.equal(routes.at(-1),'SUB-0000001');
   assert(display({...sale,kind:'COR',dues:[],corrects:'original',details:{reason:'تصحيح موثق'}}).includes('أُلغي الأثر المالي للمستند الأصلي.'));
 }
 const {MerchantInvoiceScreen}=load('src/components/finance/MerchantInvoiceScreen.tsx',merchantDetailMocks);
 const renderDetail=()=>{cursor=0;return MerchantInvoiceScreen({owner:'merchant',id});};
 renderDetail();
 const stopDetail=effects.at(-1)();
 for(let i=0;i<8;i++)await Promise.resolve();
 let document=nodes(renderDetail()).find(node=>node.props?.invoice);
 assert.equal(document.props.invoice,sale);
 document.props.onCopy(sale.reference);
 for(let i=0;i<8;i++)await Promise.resolve();
 assert.equal(copied.at(-1),sale.reference);
 assert.equal(notices.at(-1).tone,'success');
 nodes(renderDetail()).find(node=>node.type==='AppHeader').props.onBack();
 assert.equal(routes.at(-1),'/merchant/finance');
 response=async()=>{throw Error('offline');};
 effects.at(-1)();
 for(let i=0;i<8;i++)await Promise.resolve();
 assert(nodes(renderDetail()).some(node=>node.props?.invoice===sale),'transient failure retains same invoice');
 response=async()=>({...sale,owner_id:'another'});
 effects.at(-1)();
 for(let i=0;i<8;i++)await Promise.resolve();
 assert(!nodes(renderDetail()).some(node=>node.props?.invoice),'foreign response clears prior data');
 let finish,signal;
 response=(_id,abortSignal)=>{signal=abortSignal;return new Promise(resolve=>{finish=resolve;});};
 const stopPending=effects.at(-1)();
 stopPending();
 assert(signal.aborted);
 finish(sale);
 for(let i=0;i<8;i++)await Promise.resolve();
 assert(!nodes(renderDetail()).some(node=>node.props?.invoice),'late response is ignored after blur/account teardown');
 stopDetail();
 console.log('PASS merchant invoice detail: four kinds in both palettes, payment split, related reference, copy, direct back, offline, foreign and late response');
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
