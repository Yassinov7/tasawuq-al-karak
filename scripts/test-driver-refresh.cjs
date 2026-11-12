// FIX-DRV-01: actual production queue/hooks/screens with offline adapters; no phone/RLS claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,AbortController,Promise,Set,Map,setTimeout,clearTimeout,require:n=>{if(n in mocks)return mocks[n];throw Error('Unmocked '+n);}});return exports;}
function hooks(){let values=[],index=0,pending=[],cleanups=[];const memo=(f,deps)=>{const i=index++,old=values[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n]))){values[i]={value:f(),deps};}return values[i].value;};return{
 react:{useState:initial=>{const i=index++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],v=>values[i]=typeof v==='function'?v(values[i]):v];},useRef:initial=>{const i=index++;return values[i]??(values[i]={current:initial});},useMemo:memo,useCallback:(fn,deps)=>memo(()=>fn,deps),useEffect:(fn,deps)=>memo(()=>{pending.push(fn);},deps),useLayoutEffect:(fn,deps)=>memo(()=>{pending.push(fn);},deps)},
 render(fn){index=0;return fn();},effects(){pending.splice(0).forEach(fn=>{const c=fn();if(c)cleanups.push(c);});},stop(){cleanups.splice(0).reverse().forEach(fn=>fn());}};}
const jsx=(type,props,key)=>({type,props,key}),runtime={jsx,jsxs:jsx};
const native={ActivityIndicator:'Spinner',View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'Scroll',RefreshControl:'Refresh',Switch:'Switch',StyleSheet:{create:x=>x},Platform:{OS:'android',select:o=>o.android??o.default}};
let dimensions={width:390,fontScale:1};
native.useWindowDimensions=()=>dimensions;
const theme=load('src/constants/theme.ts',{'react-native':native,'./fonts':{FontFamily:{regular:'Cairo',medium:'Cairo',semiBold:'Cairo',bold:'Cairo'}}});
async function main(){
 const queueModule=load('src/lib/driver-read-queue.ts');let release,calls=0,inflight=0,max=0,signals=[];
 const queue=queueModule.createDriverReadQueue(async(signal)=>{signals.push(signal);calls++;max=Math.max(max,++inflight);if(calls===1)await new Promise(r=>release=r);inflight--;});
 queue.open();const first=queue.request('initial');await tick();
 for(let i=0;i<30;i++)queue.request('manual');assert.equal(calls,1,'manual refresh joins the active read');
 for(let i=0;i<30;i++)queue.request('change');release();await first;assert.equal(calls,2,'a real event burst produces exactly one trailing read');assert.equal(max,1);
 await tick();assert.equal(calls,2,'idle renders have no poll loop');queue.close();await queue.request('change');assert.equal(calls,2);
 let oldRelease;const aborts=queueModule.createDriverReadQueue(async(signal)=>{signals.push(signal);await new Promise(r=>oldRelease=r);});aborts.open();const old=aborts.request('initial');await tick();aborts.close();assert.equal(signals.at(-1).aborted,true);oldRelease();await old;
 console.log('PASS one active read, burst coalescing, no idle loop and abort on close');
 // Focus/background/resume use the production hook, with a real AbortController.
 const h=hooks();let focused,app,removed=0,reads=0;const requestHook=load('src/hooks/useDriverTaskRefresh.ts',{
  react:h.react,'expo-router':{useFocusEffect:f=>focused=f},'react-native':{AppState:{currentState:'active',addEventListener:(_,fn)=>{app=fn;return{remove:()=>removed++};}}},'@/lib/driver-read-queue':queueModule});
 const reader=async()=>reads++;const request=h.render(()=>requestHook.useDriverTaskRefresh(reader,true));const blur=focused();await tick();assert.equal(reads,1);app('active');await tick();assert.equal(reads,1);app('background');await request('change');assert.equal(reads,1);app('active');await tick();assert.equal(reads,2);blur();await request('manual');assert.equal(reads,2);assert.equal(removed,1);
 const freshHarness=hooks();let homeFocus, homeApp, shouldRead=true, homeReads=[];
 const freshHook=load('src/hooks/useDriverTaskRefresh.ts',{
  react:freshHarness.react,'expo-router':{useFocusEffect:f=>homeFocus=f},
  'react-native':{AppState:{currentState:'active',addEventListener:(_,fn)=>{homeApp=fn;return{remove(){}};}}},
  '@/lib/driver-read-queue':queueModule
 });
 const manual=freshHarness.render(()=>freshHook.useDriverTaskRefresh(async(_,reason)=>{homeReads.push(reason);},true,()=>shouldRead));
 let unfocus=homeFocus();await tick();assert.deepEqual(homeReads,['initial']);
 shouldRead=false;
 for(let i=0;i<3;i++){unfocus();unfocus=homeFocus();await tick();}
 assert.deepEqual(homeReads,['initial'],'fresh refocus never starts a catalog read');
 await manual('manual');assert.deepEqual(homeReads,['initial','manual']);
 homeApp('background');shouldRead=true;homeApp('active');await tick();
 assert.deepEqual(homeReads,['initial','manual','change'],'stale foreground still revalidates');unfocus();
 console.log('PASS focus, duplicate active event, background, resume and blur cleanup');
 // Production screens: a fresh auth object for the SAME id must not recreate load.
 for(const file of ['src/app/driver/index.tsx','src/app/driver/orders.tsx','src/app/driver/task-details.tsx']){
  const h=hooks();let owner='driver', captured,loads=0,subscriptionSnapshot,acceptEvent,failHome=false,palette=theme.DarkColors;
  let assignment={count:0,task:null},offers=[];const routes=[];const scope={open(){},close(){},begin:()=>1,current:()=>true};
  const detailId='12345678-1234-1234-1234-123456789012';
  let assignedRows, assignedPage, writes=0, finishWrite, focus, appState, failDetails=false, pickups=0, finishPickup;
  let params=file.endsWith('task-details.tsx')?{taskId:detailId}:{};
  const dialed=[];let failDial=false;
  const refresh=async()=>{};const router={replace(){},push(route){routes.push(route);}};
  const mocks={'@/components/ui/LoadingState':{LoadingSkeleton:'Skeleton'},'@/context/ToastContext':{useToast:()=>({show:()=>true})},react:h.react,'react/jsx-runtime':runtime,'react-native':{...native,Keyboard:{dismiss(){}},AppState:{addEventListener:(_,fn)=>{appState=fn;return{remove(){}};}}},'expo-router':{useRouter:()=>router,useLocalSearchParams:()=>params,useFocusEffect:fn=>{focus=fn;},Redirect:'Redirect'},
   '@/hooks/useDriverTaskRefresh':{useDriverTaskRefresh:fn=>{captured=fn;return refresh;}},'@/lib/driver-read-queue':queueModule,'@/hooks/useReadScope':{useReadScope:()=>scope},
   '@/context/AuthContext':{useAuth:()=>({user:{id:owner},loading:false})},'@/context/ThemeContext':{useTheme:()=>({colors:palette})},'@/constants/theme':theme,
   '@/hooks/useOrderRealtime':{useOrderRealtime:options=>{subscriptionSnapshot=options.subscriptions;acceptEvent=options.acceptEvent;assert.equal(options.sdkManagedRecovery,true);}},'@/components/ui/LiveStatus':{LiveStatus:'Live'},'@/components/ui/AppButton':{AppButton:'Button'},'@/components/ui/FinancialAmount':{FinancialAmount:'Amount'},'@/components/navigation/AppHeader':{AppHeader:'Header'},'@/components/ui/AppIcon':{AppIcon:'Icon'},
   '@/components/driver/DeliveryTaskCard':{DeliveryTaskCard:'Task',toAvailableTaskCard:x=>x},
   '@/components/ui/AppTextField':{AppTextField:'Field'},'@/components/ui/KeyboardAwareScrollView':{KeyboardAwareScrollView:'KeyboardScroll'},
   '@/components/driver/StorePickupPanel':{StorePickupPanel:'Pickup'},'@/components/ui/AppModal':{AppModal:'Modal'},
   '@/lib/invoice-finance':{readMoney:async()=>assignment.count?{owner,admin:false,account_reference:'ACC-1',collection_due:'80.00',payable:'30.00'}:null},
   '@/lib/driver-deliveries':{getDriverApplication:async()=>({status:'accepted',is_available:true,full_name:'سائق'}),getAvailableDeliveryTasks:async()=>{loads++;return offers;},getDriverHomeAssignment:async()=>{if(failHome)throw Error('offline');return assignment;},getDriverAssignedTasks:async(_owner,_order,id,_signal,page)=>{assignedPage=page;loads++;if(failDetails)throw Error('offline');if(file.endsWith('task-details.tsx'))assert.equal(id,detailId);return assignedRows??['accepted','delivered'].map((status,index)=>({id:'task-'+index,status,customer_order_id:'parent-'+index,collection:{state:'unavailable'},pickups:{state:'unavailable'},customer_orders:{order_number:index+1,store_orders:[]}}));}},
   '@/lib/delivery-collection-attempt':{deliveryCollection:async()=>{writes++;await new Promise(resolve=>finishWrite=resolve);return {state:'completed',kind:'cash_delivery'};}},'@/lib/driver-collection':{canProgressDriverCollection:collection=>collection?.state==='ready',driverCollectionMessage:()=>'تعذر تأكيد المبلغ'},'@/lib/store-pickups':{confirmStorePickup:async()=>{pickups++;await new Promise(resolve=>finishPickup=resolve);return 'confirmed';}}};
  mocks['@/components/driver/DriverTaskLocation']=load('src/components/driver/DriverTaskLocation.tsx',{
   ...mocks,'react-native':{...native,Linking:{openURL:async url=>{if(failDial)throw Error('no dialer');dialed.push(url);}}},'@/lib/signup-data':load('src/lib/signup-data.ts'),
  });
  const destination={delivery_address:'العنوان',delivery_zone_name_snapshot:'الحي',recipient_name:'المستلم',contact_phone:'+٩٦٣ ٩٤٤-١٢٣٤٥٦',customer_note:'المدخل الجانبي'};
  const screen=load(file,mocks).default;const entry=screen();const component=()=>entry.type(entry.props);
  h.render(()=>component());h.effects();const before=captured;await captured(new AbortController().signal,'initial');h.render(()=>component());assert.equal(captured,before,'state/auth object rerender must preserve load identity');assert.equal(loads,1);
  const initialBindings=JSON.stringify(subscriptionSnapshot);
  if(file.endsWith('index.tsx')){
   const walk=node=>Array.isArray(node)?node.flatMap(walk):typeof node?.type==='function'?walk(node.type(node.props)):node?.props?[node,...walk(node.props.children)]:[];
   const read=()=>captured(new AbortController().signal,'change');
   const render=()=>walk(h.render(()=>component()));
   assert.ok(render().some(n=>n.props.children==='لا توجد مهمة جارية.'));
   assignment={count:2,task:{id:'active',orderId:'order',reference:'TSK-2',status:'picked_up',destination,pickupStores:[],collection:{state:'ready',amount:100}}};
   offers=[{task_id:'new',customer_order_id:'new-order',order_number:8,delivery_zone_name_snapshot:'الحي',store_count:1}];
   await read();let tree=render();
   for(const colors of [theme.LightColors,theme.DarkColors]){
    palette=colors;const root=render()[0];assert.equal(root.props.style[1].backgroundColor,colors.background);
   }
   assert.deepEqual(tree.filter(n=>n.type==='Amount').map(n=>n.props.amount),[100,'80.00','30.00']);
   assert(tree.some(n=>n.props.children==='المستلم'));
   assert(!tree.some(n=>n.props.title==='اتصال بالمستلم'));
   assert.equal(tree.filter(n=>n.props.title==='قبول المهمة').length,1);
   tree.find(n=>n.props.accessibilityRole==='button'&&n.type==='Pressable').props.onPress();
   assert.equal(routes[0].pathname,'/driver/task-details');assert.equal(routes[0].params.taskId,'active');
   assert(subscriptionSnapshot.some(n=>n.table==='store_orders'&&!n.filter));
   assert(!subscriptionSnapshot.some(n=>n.table==='order_pricing_current'));
   assert.equal(acceptEvent('store_orders',{new:{customer_order_id:'order'}}),true);
   assert.equal(acceptEvent('store_orders',{new:{customer_order_id:'other'}}),false);
   assert.equal(JSON.stringify(subscriptionSnapshot),initialBindings,'assignment change keeps the home channel bindings');
   const moneyDirection=()=>render().find(n=>n.props.style?.[1]?.flexDirection &&
    Array.isArray(n.props.children) && n.props.children[0]?.key==='النقد الواجب توريده للمنصة').props.style[1].flexDirection;
   assert.equal(moneyDirection(),'row-reverse');
   dimensions={width:320,fontScale:1.5};assert.equal(moneyDirection(),'column');
   dimensions={width:390,fontScale:1};
   render().find(n=>n.props.title==='فتح المالية').props.onPress();assert.equal(routes.at(-1),'/driver/cash-account');
   failHome=true;await read();tree=render();assert.ok(tree.some(n=>n.props.children==='TSK-2'));assert.ok(!tree.some(n=>n.type==='Amount'));
   assert(!tree.some(n=>n.props.title==='اتصال بالمستلم'||n.props.children==='المستلم'));
   assert.equal(tree.find(n=>n.props.title==='قبول المهمة').props.disabled,true);
   failHome=false;assignment={count:1,task:{...assignment.task,status:'accepted',collection:{state:'blocked'},pickupStores:[
    {status:'ready_for_pickup',stores:{name:'متجر أول',address:'عنوان الاستلام'}},
    {status:'handed_to_driver',stores:{name:'تم استلامه'}},
   ]}};
   await read();tree=render();assert.ok(tree.some(n=>n.props.accessibilityHint==='يفتح تفاصيل المهمة'));assert.deepEqual(tree.filter(n=>n.type==='Amount').map(n=>n.props.amount),['80.00','30.00']);
   assert(tree.some(n=>n.props.children==='عنوان الاستلام'));
   const originalKey=screen().key;owner='other';assert.notEqual(screen().key,originalKey);owner='driver';
  }
  if(file.endsWith('orders.tsx')){
   assert(subscriptionSnapshot.some(s=>s.table==='store_orders'&&!s.filter));
   assert.equal(acceptEvent('store_orders',{new:{customer_order_id:'parent-0'}}),true);
   assert.equal(acceptEvent('store_orders',{new:{customer_order_id:'parent-1'}}),false,'completed history does not trigger store reads');
   const walk=node=>Array.isArray(node)?node.flatMap(walk):typeof node?.type==='function'?walk(node.type(node.props)):node?.props?[node,...walk(node.props.children)]:[];
   const render=()=>walk(h.render(()=>component()));
   const read=()=>captured(new AbortController().signal,'change');
   const task={id:'active',reference:'TSK-3',status:'picked_up',customer_order_id:'parent-3',
    customer_orders:{...destination,store_orders:[]},collection:{state:'ready',amount:100}};
   assignedRows=[task];await read();
   assert(render().some(n=>n.props.children==='المستلم'));
   assert(!render().some(n=>n.props.title==='اتصال بالمستلم'||n.type==='Modal'));
   assert.equal(JSON.stringify(subscriptionSnapshot),initialBindings);
   render().find(n=>n.props.accessibilityRole==='button'&&n.type==='Pressable').props.onPress();
   assert.equal(routes.at(-1).pathname,'/driver/task-details');assert.equal(routes.at(-1).params.taskId,'active');
   assignedRows=Array.from({length:11},(_,i)=>({...task,id:String(i)}));await read();
   assert.equal(render().filter(n=>n.props.accessibilityHint==='يفتح تفاصيل المهمة').length,10);
   render().find(n=>n.props.title==='التالي').props.onPress();render();await read();assert.equal(assignedPage.offset,10);
   render().find(n=>n.type==='Field').props.onChangeText(' TSK-٣ ');
   render().find(n=>n.props.title==='بحث').props.onPress();render();await read();
   assert.equal(assignedPage.search,'TSK-٣');assert.equal(assignedPage.offset,0);assert.equal(assignedPage.size,10);
   render().find(n=>n.props.accessibilityRole==='tab'&&n.props.children.props.children==='المكتملة').props.onPress();
   render();await read();assert.equal(assignedPage.view,'completed');assert.equal(assignedPage.search,'TSK-٣');
   render().find(n=>n.props.title==='مسح البحث').props.onPress();render();await read();assert.equal(assignedPage.search,'');
   params={taskId:detailId};
   assert.equal(screen().type,'Redirect');assert.equal(screen().props.href.params.taskId,detailId);
   params={};
  }
  if(file.endsWith('task-details.tsx')){
   const walk=node=>Array.isArray(node)?node.flatMap(walk):typeof node?.type==='function'?walk(node.type(node.props)):node?.props?[node,...walk(node.props.children)]:[];
   const render=()=>walk(h.render(component));
   const read=()=>captured(new AbortController().signal,'change');
   const blur=focus();
   assert(render().some(n=>n.props.children==='المهمة غير متاحة لهذا الحساب.'));
   const stores=[{id:'a',status:'ready_for_pickup',stores:{name:'متجر أول',address:'عنوان الاستلام'}},{id:'b',status:'handed_to_driver',stores:{name:'متجر ثان'}}];
   const task={id:detailId,reference:'TSK-3',status:'accepted',customer_order_id:'parent-3',
    customer_orders:{...destination,store_orders:stores},collection:{state:'ready',amount:100},
    pickups:{state:'c4',pricingVersion:1,canConfirmPickup:true,canCompleteDelivery:false,confirmed:['b']}};
   assignedRows=[task];await read();
   const summary=()=>render().find(n=>Array.isArray(n.props.children)&&n.props.children[0]?.props?.children?.[0]?.props?.children==='مرجع المهمة');
   assert.equal(summary().props.style.flexDirection,'row-reverse');
   dimensions={width:320,fontScale:1.5};assert.equal(summary().props.style.flexDirection,undefined);
   dimensions={width:390,fontScale:1};
   for(const colors of [theme.LightColors,theme.DarkColors]){
    palette=colors;assert.equal(render()[0].props.style[1].backgroundColor,colors.background);
   }
   assert(render().some(n=>n.props.children==='التسليم · الحي · العنوان'&&n.props.numberOfLines===undefined));
   assert(render().some(n=>Array.isArray(n.props.children)&&n.props.children.includes('المدخل الجانبي')));
   render().find(n=>n.props.title==='اتصال بالمستلم').props.onPress();
   assert.deepEqual(dialed,['tel:+963944123456']);
   failDial=true;render().find(n=>n.props.title==='اتصال بالمستلم').props.onPress();await tick();
   assert(render().some(n=>n.props.children==='تعذر فتح تطبيق الهاتف. حاول مرة أخرى.'));
   const pickup=render().find(n=>n.type==='Pickup').props;
   assert.equal(pickup.stores.length,2);assert.equal(pickup.disabled,false);
   pickup.onConfirm('a');pickup.onConfirm('a');assert.equal(pickups,1);finishPickup();await tick();
   assert(!render().some(n=>n.type==='Button'&&n.props.title==='تأكيد التسليم'));
   assignedRows=[{...task,status:'picked_up',pickups:{...task.pickups,canConfirmPickup:false,canCompleteDelivery:true}}];await read();
   const open=()=>render().find(n=>n.type==='Button'&&n.props.title==='تأكيد التسليم').props.onPress();
   const modal=()=>render().find(n=>n.type==='Modal').props;
   open();assert.equal(modal().visible,true);modal().onCancel();assert.equal(modal().visible,false);assert.equal(writes,0);
   open();assignedRows=[{...assignedRows[0],collection:{state:'ready',amount:120}}];await read();
   modal().onConfirm();assert.equal(writes,0,'price change invalidates the open confirmation');
   open();const confirm=modal().onConfirm;confirm();confirm();assert.equal(writes,1);finishWrite();await tick();
   assert.equal(acceptEvent('store_orders',{new:{customer_order_id:'parent-3'}}),true);
   assert.equal(acceptEvent('store_orders',{new:{customer_order_id:'other'}}),false);
   appState('background');assert(!render().some(n=>n.props.children==='المستلم'));
   await read();assert(render().some(n=>n.props.children==='المستلم'));
   failDetails=true;await read();assert(!render().some(n=>n.props.title==='اتصال بالمستلم'||n.type==='Amount'));
   failDetails=false;assignedRows=[{...task,status:'delivered'}];await read();
   assert(!render().some(n=>n.props.children==='المستلم'||n.props.title==='اتصال بالمستلم'));
   assert(render().some(n=>n.props.children==='التسليم · الحي'));
   const longAddress='العنوان الطويل '.repeat(18).trim();
   assignedRows=[{...task,customer_orders:{...task.customer_orders,recipient_name:'',contact_phone:'',delivery_address:longAddress,store_orders:stores.slice(0,1)}}];await read();
   assert(render().some(n=>n.props.children==='رقم هاتف المستلم غير مسجل'));
   assert(render().some(n=>n.props.children==='اسم المستلم غير مسجل'));
   assert(render().some(n=>n.props.children?.endsWith?.(longAddress)&&n.props.numberOfLines===undefined));
   assert.equal(render().find(n=>n.type==='Pickup').props.stores.length,1);
   assignedRows=[task];await read();
   acceptEvent('delivery_tasks',{eventType:'UPDATE',new:{driver_id:'other'}});
   assert(!render().some(n=>n.props.children==='TSK-3'));
   assignedRows=[];await read();assert(render().some(n=>n.props.children==='المهمة غير متاحة لهذا الحساب.'));
   const oldKey=screen().key;owner='other';assert.notEqual(screen().key,oldKey);owner='driver';
   params={taskId:'bad'};assert.equal(screen().props.taskId,undefined);
   blur();
   console.log('PASS direct detail scope, stores, dialer, refresh, revocation, privacy and delivery/pickup locks');
  }
  owner='other';h.render(()=>component());assert.notEqual(captured,before,'changing account changes read scope');h.stop();
 }
 console.log('PASS actual driver screen loaders stay stable through same-account rerenders');
 {
  const h=hooks();let owner='driver',loadPage,next,offline=false,realtime;
  const routes=[],requests=[],refreshes=[];
  const invoice={id:'a',owner_id:owner,kind:'DLV',created_at:'2026-11-11T00:00:00Z'};
  const overview={admin:false,owner,account_reference:'ACC-1',collection_due:'80.25',payable:'30.15',rows:[invoice]};
  next={overview,hasMore:true};
  const screen=load('src/app/driver/cash-account.tsx',{
   react:h.react,'react/jsx-runtime':runtime,'react-native':{...native,Keyboard:{dismiss(){}}},
   'expo-router':{useRouter:()=>({push:route=>routes.push(route)})},
   '@/constants/theme':theme,'@/context/ThemeContext':{useTheme:()=>({colors:theme.DarkColors})},
   '@/context/AuthContext':{useAuth:()=>({user:{id:owner},loading:false})},
   '@/hooks/useDriverTaskRefresh':{useDriverTaskRefresh:fn=>{loadPage=fn;return async reason=>{refreshes.push(reason);};}},
   '@/hooks/useOrderRealtime':{useOrderRealtime:options=>{realtime=options;}},
   '@/lib/invoice-finance':{readDriverMoney:async(...args)=>{requests.push(args.slice(0,3));if(offline)throw Error('offline');return next;}},
   '@/components/finance/FinancialParts':{FinancialFeedback:'Feedback'},
   '@/components/finance/MerchantFinanceView':{FinanceAccountView:'FinanceView'},
   '@/components/navigation/AppHeader':{AppHeader:'Header'},'@/components/ui/AppButton':{AppButton:'Button'},
   '@/components/ui/AppTextField':{AppTextField:'Field'},'@/components/ui/DocumentReference':{DocumentReference:'Reference'},
   '@/components/ui/FinancialAmount':{FinancialAmount:'Amount'},'@/components/ui/KeyboardAwareScrollView':{KeyboardAwareScrollView:'Scroll'},
   '@/components/ui/LoadingState':{LoadingSkeleton:'Skeleton'},
  }).default;
  const walk=node=>Array.isArray(node)?node.flatMap(walk):node?.props?[node,...walk(node.props.children)]:[];
  const entry=screen().props.children[1];
  const render=()=>walk(h.render(()=>entry.type(entry.props)));
  const read=()=>loadPage(new AbortController().signal);
  render();await read();
  const view=()=>render().find(n=>n.type==='FinanceView').props;
  assert.equal(view().account.collection_due,'80.25');assert.equal(view().account.payable,'30.15');
  assert.equal(view().role,'driver');
  view().onInvoice('a');assert.equal(routes.at(-1).params.id,'a');
  view().onPage(1);assert.equal(view().data,null,'old page rows stay hidden in new scope');
  await read();assert.equal(requests.at(-1)[2].id,'a');
  view().onKind('SET');
  render();await read();assert.deepEqual(requests.at(-1),['','SET',undefined]);
  view().onChangeSearch(' SET-1 ');
  view().onSearch(view().search);
  render();await read();assert.deepEqual(requests.at(-1),['SET-1','SET',undefined]);
  await realtime.onChange();assert.equal(refreshes.at(-1),'change');
  offline=true;await read();assert(view().error&&view().data.rows.length===1);
  offline=false;next={...next,overview:{...overview,rows:[{...invoice,owner_id:'other'}]}};
  await read();assert.equal(view().data,null);assert.equal(view().account,null);
  owner='other';assert.notEqual(screen().props.children[1].key,entry.key);
  console.log('PASS driver finance separates balances, scopes search/filter/cursors, refreshes, and rejects foreign rows');
 }
 // Home reads exactly one leading task and an exact count, then hydrates only that order.
 const queries=[];let actor='driver',hydrations=0,failPricing=false;
 let rows=[{id:'active',driver_id:'driver',status:'picked_up',customer_order_id:'order',customer_orders:{order_number:2,delivery_zone_name_snapshot:'الحي'}}];
 const client={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},rpc:(name,args)=>{
  assert.equal(name,'search_driver_task_references');
  assert.equal(args.search_value,'TSK-٢');assert.equal(args.page_offset,10);assert.equal(args.view_value,'active');
  return {abortSignal:async()=>({data:[{task_id:'active',reference:'TSK-2'}],error:null})};
 },from:table=>{
  assert.equal(table,'delivery_tasks');const q={};
  for(const op of ['select','eq','in','order','limit','range','abortSignal'])q[op]=(...v)=>{queries.push([op,...v]);return q;};
  q.then=yes=>Promise.resolve({data:rows,count:rows.length?2:0,error:null}).then(yes);
  return q;
 }};
 const deliveries=load('src/lib/driver-deliveries.ts',{'@/lib/supabase':{supabase:client},
  '@/lib/c3-orders':{getC3Contexts:async ids=>{hydrations++;assert.deepEqual(Array.from(ids),['order']);if(failPricing)throw Error('offline');return {order:{references:{'TSK:active':'TSK-2'}}};}},
  '@/lib/driver-collection':{collectionFromContext:()=>({state:'ready',amount:100,source:'pricing'})},'@/lib/store-pickups':{}});
 const homeSignal=new AbortController().signal;
 const home=await deliveries.getDriverHomeAssignment('driver',homeSignal);
 assert.equal(home.count,2);assert.equal(home.task.reference,'TSK-2');assert.equal(home.task.collection.amount,100);assert.equal(hydrations,1);
 assert(queries.some(x=>x[0]==='eq'&&x[1]==='driver_id'&&x[2]==='driver'));assert(queries.some(x=>x[0]==='limit'&&x[1]===1));assert(queries.some(x=>x[0]==='order'&&x[1]==='status'&&x[2].ascending===false));
 failPricing=true;assert.equal((await deliveries.getDriverHomeAssignment('driver',homeSignal)).task.collection.state,'unavailable');
 rows=[{...rows[0],driver_id:'other'}];await assert.rejects(deliveries.getDriverHomeAssignment('driver',homeSignal));
 rows=[];assert.equal((await deliveries.getDriverHomeAssignment('driver',homeSignal)).task,null);
 actor='other';await assert.rejects(deliveries.getDriverHomeAssignment('driver',homeSignal));
 const canceled=new AbortController();canceled.abort();await assert.rejects(deliveries.getDriverHomeAssignment('driver',canceled.signal));
 console.log('PASS leading task, exact count, partial pricing, ownership and pre-cancelled reads');
 actor='driver';failPricing=false;
 for(const [view,statuses,order] of [['active',['accepted','picked_up'],'accepted_at'],['completed',['delivered'],'delivered_at']]){
  queries.length=0;
  await deliveries.getDriverAssignedTasks('driver',undefined,undefined,homeSignal,{view,offset:10,size:10});
  assert.deepEqual(Array.from(queries.find(q=>q[0]==='in')[2]),statuses);
  assert.deepEqual(queries.find(q=>q[0]==='range'),['range',10,20]);
  assert(queries.some(q=>q[0]==='order'&&q[1]===order));
  assert.equal(queries.filter(q=>q[0]==='order').at(-1)[1],'id');
 }
 queries.length=0;
 await deliveries.getDriverAssignedTasks('driver',undefined,'direct-task',homeSignal);
 assert(queries.some(q=>q[0]==='eq'&&q[1]==='id'&&q[2]==='direct-task'));
 assert(queries.some(q=>q[0]==='eq'&&q[1]==='driver_id'&&q[2]==='driver'));
 assert(!queries.some(q=>q[0]==='range'));
 rows=[{id:'active',driver_id:'driver',status:'picked_up',customer_order_id:'order',customer_orders:{order_number:2}}];
 queries.length=0;
 failPricing=true;
 const searched=await deliveries.getDriverAssignedTasks('driver',undefined,undefined,homeSignal,{view:'active',offset:10,size:10,search:'TSK-٢'});
 assert.equal(searched[0].reference,'TSK-2','search reference survives a separate pricing read failure');
 assert(queries.some(q=>q[0]==='in'&&q[1]==='id'&&q[2][0]==='active'));
 assert(!queries.some(q=>q[0]==='range'),'RPC result is already paginated');
 console.log('PASS assigned task server filters, bounded pages, stable tie-break and scoped direct link');
 // Theme states: actual finance root and invoice loading/guest variants, nested driver Stack.
 for(const colors of [theme.LightColors,theme.DarkColors]){
  for(const file of ['src/components/finance/FinanceScreen.tsx','src/components/finance/InvoiceScreen.tsx']){
   let user={id:'driver'},loading=false;const h=hooks();const mocks={'@/components/ui/LoadingState':{LoadingSkeleton:'Skeleton'},'@/context/ToastContext':{useToast:()=>({show:()=>true})},react:h.react,'react/jsx-runtime':runtime,'react-native':native,'expo-router':{useRouter:()=>({}),usePathname:()=>'/driver/cash-account',useLocalSearchParams:()=>({id:'invoice'})},'@/context/AuthContext':{useAuth:()=>({user,loading})},'@/context/ThemeContext':{useTheme:()=>({colors})}};
   const imports=[...fs.readFileSync(file,'utf8').matchAll(/from "([^"]+)"/g)].map(m=>m[1]);for(const name of imports)if(!(name in mocks))mocks[name]=new Proxy({},{get:(_,key)=>key});
   const m=load(file,mocks),fn=m.FinanceScreen??m.InvoiceScreen;
   if(m.FinanceScreen){const tree=h.render(()=>fn({}));assert.equal(tree.props.style.backgroundColor,colors.background);}
   loading=true;let tree=h.render(()=>fn({}));assert.equal(tree.props.style.backgroundColor,colors.background);assert.equal(tree.props.children.props.label,'جارٍ التحقق من الحساب');
   loading=false;user=null;tree=h.render(()=>fn({}));assert.equal(tree.props.style.backgroundColor,colors.background);
  }
  const layout=load('src/app/driver/_layout.tsx',{'react/jsx-runtime':runtime,'expo-router':{Stack:'Stack'},'@/context/ThemeContext':{useTheme:()=>({colors})},'@/components/auth/RoleRouteGuard':{RoleRouteGuard:'Guard'}}).default();assert.equal(layout.props.children.props.screenOptions.contentStyle.backgroundColor,colors.background);
  const parts=load('src/components/finance/FinancialParts.tsx',{'react/jsx-runtime':runtime,'react-native':native,'@/context/ThemeContext':{useTheme:()=>({colors})},'@/constants/theme':theme,'@/components/ui/DocumentReference':{DocumentReference:'Reference'},'./InvoiceStatus':{InvoiceStatus:'Status'},'@/lib/money':{formatSypExact:v=>v},'@/lib/invoice-finance':{invoiceKindLabels:{DLV:'توصيل'}}});
  assert.equal(parts.FinancialSection({children:'x'}).props.style.backgroundColor,colors.surface);
  const error=parts.FinancialFeedback({message:'x',error:true});assert.equal(error.props.style.color,colors.errorForeground);assert.equal(error.props.style.backgroundColor,colors.errorSurface);
  const amount=parts.FinancialAmount({label:'x',amount:'220'});assert.equal(amount.props.children[1].props.style.color,colors.text);
 }
 console.log('PASS light/dark finance and invoice root/loading/guest surfaces, driver Stack, cards/amounts/error tokens');
 // The shared controls/statuses also use the supplied palette, not fixed colors.
 for(const colors of [theme.LightColors,theme.DarkColors]){
  const h=hooks();const base={'@/components/ui/LoadingState':{useLongWait:()=>false},react:h.react,'react/jsx-runtime':runtime,'react-native':native,'@/constants/theme':theme,'@/context/ThemeContext':{useTheme:()=>({colors})},'@/components/ui/AppIcon':{AppIcon:'Icon'}};
  const button=load('src/components/ui/AppButton.tsx',base).AppButton;
  for(const variant of ['primary','outline','danger']){
   const tree=button({title:'متابعة',variant,onPress(){}});const style=Object.assign({},...tree.props.style({pressed:false}).filter(Boolean));assert.equal(style.backgroundColor,variant==='primary'?colors.primary:variant==='danger'?colors.error:colors.surface);
   const compact=button({title:'إضافة',accessibilityLabel:'إضافة منتج',compact:true,fullWidth:false,icon:'add-outline',variant,onPress(){}});
   assert.equal(compact.props.accessibilityLabel,'إضافة منتج');
   assert(compact.props.style[0].minHeight>=44&&compact.props.style[0].minWidth>=44);
   assert.equal(compact.props.style[1],false);
   const face=compact.props.children({pressed:false});
   assert.equal(face.props.children[0].props.name,'add-outline');
   assert.equal(face.props.children[0].props.size,16);
   assert.equal(face.props.children[0].props.color,variant==='primary'?colors.onPrimary:variant==='danger'?colors.onError:colors.primary);
  }
  const field=load('src/components/ui/AppTextField.tsx',{...base,'@/components/ui/KeyboardAwareScrollView':{useFormFocus:()=>null}}).AppTextField;
  const fieldTree=h.render(()=>field({label:'البحث',value:'SUB-0000001'}));const shell=fieldTree.props.children[1];assert.equal(Object.assign({},...shell.props.style.filter(Boolean)).backgroundColor,colors.surface);assert.equal(shell.props.children[0].props.placeholderTextColor,colors.textSecondary);
  const presentation=load('src/lib/invoice-presentation.ts',{});
  const Status=load('src/components/finance/InvoiceStatus.tsx',{...base,'@/lib/invoice-presentation':presentation}).InvoiceStatus;
  const status=Status({invoice:{status:'confirmed',voided_by:null,dues:[{amount:'220',remaining:'0'}]}});assert.equal(status.props.children[1].props.style.color,colors.successForeground);assert.equal(status.props.children[1].props.style.backgroundColor,colors.successSurface);
 }
 console.log('PASS actual shared buttons/search field/payment badges in both palettes');
 // Cancellation is optional and supplied to read queries only. No writer is issued here.
 const transport=load('src/lib/financial-transport.ts').createFinancialTransport;
 let abortSignal,rpcCalls=0;const signal=new AbortController().signal;
 const send=transport({rpc(){rpcCalls++;return{abortSignal:s=>{abortSignal=s;return Promise.resolve({data:'ok',error:null});},then:r=>Promise.resolve({data:'ok',error:null}).then(r)};}});
 assert.equal((await send('read',{},signal)).data,'ok');assert.equal(abortSignal,signal);
 const aborted=new AbortController();aborted.abort();await send('read',{},aborted.signal);assert.equal(rpcCalls,1,'already cancelled read never starts an RPC');
 console.log('PASS optional read cancellation reaches the real transport without changing normal calls');

}
main().catch(e=>{console.error(e);process.exitCode=1;});
