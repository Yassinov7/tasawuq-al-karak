// Actual TSX with synthetic Native hosts. No network, JWT or phone layout claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Intl,Set,Map,Promise,AbortController,require:name=>{if(name in mocks)return mocks[name];if(name.startsWith('@/lib/'))return load('src/lib/'+name.slice(6)+'.ts',mocks);throw Error(name);}});return exports;}
const jsx=(type,props,key)=>({type,props,key}),runtime={jsx,jsxs:jsx};
let dimensions={width:360,height:780,fontScale:1};
const rn={I18nManager:{isRTL:false},View:'View',Text:'Text',TextInput:'TextInput',ScrollView:'Scroll',Pressable:'Pressable',FlatList:'List',ActivityIndicator:'Spinner',useWindowDimensions:()=>dimensions,StyleSheet:{create:x=>x},Platform:{select:x=>x.default??x.ios},AppState:{currentState:'active',addEventListener:()=>({remove(){}})}};
const theme=load('src/constants/theme.ts',{'react-native':rn,'./fonts':{FontFamily:{}}});
const service=load('src/lib/merchant-orders.ts',{'@/lib/supabase':{supabase:{}},'@/lib/c3-orders':{getC3Contexts:async()=>({})}});
const walk=t=>Array.isArray(t)?t.flatMap(walk):typeof t?.type==='function'?walk(t.type(t.props)):!t||typeof t!=='object'?[]:[t,...[t.props?.children,t.props?.ListHeaderComponent,t.props?.ListEmptyComponent,t.props?.ListFooterComponent].flat(Infinity).flatMap(walk)];
const text=t=>Array.isArray(t)?t.map(text).join(' '):typeof t==='string'||typeof t==='number'?String(t):!t||typeof t!=='object'?'':(Array.isArray(t.props?.children)?t.props.children:[t.props?.children]).map(text).join(' ');
const flatten=s=>Array.isArray(s)?Object.assign({},...s.map(flatten)):typeof s==='function'?flatten(s({pressed:false})):s??{};
function expand(t){if(Array.isArray(t))return t.map(expand);if(!t||typeof t!=='object')return t;if(typeof t.type==='function')return expand(t.type(t.props));return{...t,props:{...t.props,children:(Array.isArray(t.props?.children)?t.props.children:[t.props?.children]).map(expand)}};}
function luminance(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
function contrast(t,bg){if(Array.isArray(t)){t.forEach(c=>contrast(c,bg));return;}if(!t||typeof t!=='object')return;const s=flatten(t.props?.style),next=s.backgroundColor??bg;if(t.type==='Text'&&/^#[0-9a-f]{6}$/i.test(s.color)&&/^#[0-9a-f]{6}$/i.test(next)){const [a,b]=[luminance(s.color),luminance(next)].sort((a,b)=>a-b);assert((b+.05)/(a+.05)>=4.5);assert.equal(t.props.numberOfLines,undefined);}for(const c of t.props.children??[])contrast(c,next);}
const item=(id,title)=>({id,product_title_snapshot:title,selling_unit_snapshot:'قطعة',quantity:2,unit_price_snapshot:100,currency:'SYP',line_total:200,offer_snapshot:null});
const order=(id,status='awaiting_review')=>({id,reference:'SOR-0000001',parentReference:'ORD-0000007',status,created_at:'2026-11-10T10:00:00Z',customer_order_id:'parent',customer_note:'ملاحظة خاصة بمتجري',rejection_reason:null,store_order_totals:{currency:'SYP',items_subtotal:400},store_order_items:[item('p1','منتج أول'),item('p2','منتج ثان')],customer_orders:{order_number:77,recipient_name:'عميل',contact_phone:'012345',delivery_address:'عنوان',other_stores:[{title:'منتج متجر آخر',amount:999999}]}});
async function main(){
 for(const colors of [theme.LightColors,theme.DarkColors]){
  const base={react:{useRef:value=>({current:value})},'react/jsx-runtime':runtime,'react-native':rn,'@/constants/theme':theme,'@/context/ThemeContext':{useTheme:()=>({colors})},'@/components/ui/AppButton':{AppButton:'Button'},'@/components/ui/AppIcon':{AppIcon:'Icon'},'@/lib/merchant-orders':service};
  base['@/components/ui/AppBadge']=load('src/components/ui/AppBadge.tsx',base);base['@/components/ui/DocumentReference']=load('src/components/ui/DocumentReference.tsx',base);
  const Card=load('src/components/orders/MerchantOrderCard.tsx',base).MerchantOrderCard;
  for(const status of ['awaiting_review','preparing','ready_for_pickup','handed_to_driver','delivered','rejected','cancelled']){
   const props={order:order('a',status),expanded:false,busy:false,toggle(){},onStart(){},onReady(){},onReject(){}};
   const collapsed=expand(Card(props));contrast(collapsed,colors.background);assert(text(collapsed).includes('SOR-0000001'));assert(!walk(collapsed).some(n=>n.type==='Button'));
   const details=expand(Card({...props,expanded:true}));contrast(details,colors.background);
   for(const value of ['منتج أول','منتج ثان','ORD-0000007','ملاحظة خاصة بمتجري'])assert(text(details).includes(value));
   assert(!text(details).includes('متجر آخر'));assert(!text(details).includes('999999'));
   const actions=walk(details).filter(n=>n.type==='Button');assert.equal(actions.length,status==='awaiting_review'?2:status==='preparing'?1:0);
  }
  const Toolbar=load('src/components/orders/MerchantOrdersToolbar.tsx',base).MerchantOrdersToolbar;
  const toolbarTree=expand(Toolbar({value:'',onChange(){},onSubmit(){},onClear(){},filter:'all',onFilter(){},counts:{all:999,awaiting_review:500,preparing:300,ready_for_pickup:20},connection:'live',onConnection(){},updating:false,delayed:false}));
  contrast(toolbarTree,colors.background);
  assert(walk(toolbarTree).some(n=>n.type==='Scroll'&&n.props.horizontal));
  assert(!text(toolbarTree).includes('999'));
  for(const chip of walk(toolbarTree).filter(n=>n.props?.accessibilityState?.selected!==undefined))assert(flatten(chip.props.style).minHeight>=44);
  let slots=[],index=0,memos=[],focuses=[],owner='owner',loadFn,resolveConfirm,confirmCalls=0;const actions=[],searches=[],filters=[];
  const react={useState:init=>{const n=index++;if(!(n in slots))slots[n]=init;return[slots[n],v=>{slots[n]=typeof v==='function'?v(slots[n]):v;}];},useMemo:(fn,deps)=>{const n=index++,old=memos[n];if(!old||deps.some((v,i)=>v!==old.deps[i]))memos[n]={value:fn(),deps};return memos[n].value;}};
  react.useCallback=(fn,deps)=>react.useMemo(()=>fn,deps);react.useRef=init=>react.useMemo(()=>({current:init}),[]);
  const controller={activate(){},deactivate(){},suspend(){},resume(){},refresh:async()=>{},search:async q=>searches.push(q),select:async f=>filters.push(f),more:async()=>{},retryMore(){},action:async(o,next,reason)=>{actions.push({id:o.id,next,reason});return true;}};
  const request=async()=>{};
  const Page=load('src/app/merchant/orders.tsx',{...base,react,'expo-router':{useRouter:()=>({replace(){}}),useLocalSearchParams:()=>({}),useFocusEffect:fn=>focuses.push(fn)},
   '@/context/AuthContext':{useAuth:()=>({user:{id:owner}})},'@/context/AppDialogContext':{useAppDialog:()=>({confirm:()=>{confirmCalls++;return new Promise(r=>{resolveConfirm=r;});}})},
   '@/components/orders/MerchantOrdersToolbar':{MerchantOrdersToolbar:Toolbar},'@/components/ui/LoadingState':{useLongWait:()=>false},'@/components/ui/LiveStatus':{LiveStatus:'Live'},'@/components/ui/AppSearchBar':{AppSearchBar:'Search'},'@/components/ui/AppModal':{AppModal:'Modal'},'@/components/ui/AppTextField':{AppTextField:'Field'},'@/components/orders/MerchantOrderCard':{MerchantOrderCard:Card},
   '@/hooks/useOrderRealtime':{useOrderRealtime:()=> 'live'},'@/hooks/useDriverTaskRefresh':{useDriverTaskRefresh:fn=>{if(loadFn)assert.equal(loadFn,fn);loadFn=fn;return request;}},
   '@/lib/merchant-orders':{...service,initialOrdersState:{...service.initialOrdersState,loading:false,storeId:'store',rows:[order('a'),order('b','preparing')],counts:{all:999,awaiting_review:500,preparing:300,ready_for_pickup:20}},createMerchantOrdersController:()=>controller}}).default;
  const render=()=>{index=0;const root=Page();return root.type(root.props);};let tree=render();
  const header=walk(tree);for(const node of header.filter(n=>n.props?.accessibilityState?.selected!==undefined))node.props.onPress();assert.equal(filters.join(','),service.orderFilters.join(','));
  assert(header.some(n=>n.props?.accessibilityLabel?.includes('999 طلبًا')),'server counts remain available without default visible badges');
  assert(!text(expand(walk(tree).find(n=>n.type==='List').props.ListHeaderComponent)).includes('999'));
  walk(tree).find(n=>n.type==='TextInput').props.onChangeText('SOR-0000001');tree=render();walk(tree).find(n=>n.type==='TextInput').props.onSubmitEditing();assert.equal(searches.pop(),'SOR-0000001');
  walk(tree).find(n=>n.props?.accessibilityLabel==='مسح البحث').props.onPress();assert.equal(searches.pop(),'');
  let list=walk(render()).find(n=>n.type==='List');let a=list.props.renderItem({item:order('a')});a.props.toggle();
  list=walk(render()).find(n=>n.type==='List');a=list.props.renderItem({item:order('a')});assert.equal(a.props.expanded,true);assert.equal(actions.length,0,'opening details is read-only');
  list.props.renderItem({item:order('b','preparing')}).props.toggle();list=walk(render()).find(n=>n.type==='List');assert.equal(list.props.renderItem({item:order('a')}).props.expanded,false);
  a=list.props.renderItem({item:order('a')});a.props.onStart();a.props.onStart();assert.equal(confirmCalls,1,'repeated taps cannot queue duplicate confirmations');resolveConfirm(true);for(let i=0;i<8;i++)await Promise.resolve();assert.equal(actions.length,1);assert.equal(actions[0].next,'preparing');
  const ready=list.props.renderItem({item:order('b','preparing')});ready.props.onReady();resolveConfirm(false);for(let i=0;i<8;i++)await Promise.resolve();assert.equal(actions.length,1,'cancelling readiness never writes');
  a.props.onReject();tree=render();let modal=walk(tree).find(n=>n.type==='Modal');assert.equal(modal.props.visible,true);modal.props.onConfirm();for(let i=0;i<5;i++)await Promise.resolve();assert.equal(actions.length,1,'invalid reason never writes');
  walk(tree).find(n=>n.type==='Field').props.onChangeText('غير متوفر');tree=render();walk(tree).find(n=>n.type==='Modal').props.onConfirm();for(let i=0;i<8;i++)await Promise.resolve();assert.equal(actions[1].next,'rejected');
  const stateSlot=slots.findIndex(v=>v?.storeId==='store'&&Array.isArray(v.rows)),seed=slots[stateSlot];
  slots[stateSlot]={...seed,rows:[],loading:true};let loadingList=walk(render()).find(n=>n.type==='List');assert.equal(walk(loadingList.props.ListEmptyComponent).filter(n=>n.type==='Spinner').length,1);
  slots[stateSlot]={...seed,rows:[],loading:false,error:'offline'};assert(text(walk(render()).find(n=>n.type==='List').props.ListEmptyComponent).includes('تعذر تحميل الطلبات'));
  slots[stateSlot]={...seed,rows:[],loading:false,search:'SOR-0000002'};assert(text(walk(render()).find(n=>n.type==='List').props.ListEmptyComponent).includes('لا توجد نتائج'));
  slots[stateSlot]={...seed,loading:true};assert.equal(walk(render()).find(n=>n.type==='List').props.data.length,2,'background read retains loaded rows');
  slots[stateSlot]=seed;assert(text(walk(render()).find(n=>n.type==='List').props.ListFooterComponent).includes('نهاية القائمة'));
  owner='other';assert(Page().key.startsWith('other:'),'new account requires a new subtree');
  for(const width of [320,390,768])for(const fontScale of [1,1.5,2]){dimensions={width,height:800,fontScale};render();}
 }
 console.log('PASS actual merchant order card/page: seven statuses, both palettes and contrast, own multi-item part only, inline details, exact filter counts, search submission, confirmation lock, rejection validation, stable loader, account key, small/large font constraints. No native/DB verification.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
