// UX-FOUNDATION-01: deterministic offline tests; no Supabase socket/device claims.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let now=0,serial=0;const timers=new Map();
const clock={setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)};
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
async function advance(ms){now+=ms;for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn();}await tick();}
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Map,Set,Promise,...clock,require:n=>{if(n in mocks)return mocks[n];throw Error(n);}});return exports;}
function hooks(){let store=[],i=0,pending=[],cleanup=[];const memo=(f,deps)=>{const n=i++,old=store[n];if(!old||deps.some((d,k)=>!Object.is(d,old.deps[k])))store[n]={value:f(),deps};return store[n].value;};return{react:{useState:initial=>{const n=i++;if(!(n in store))store[n]=initial;return[store[n],v=>store[n]=typeof v==='function'?v(store[n]):v];},useRef:initial=>{const n=i++;return store[n]??(store[n]={current:initial});},useCallback:(fn,d)=>memo(()=>fn,d),useMemo:memo,useEffect:(fn,d)=>memo(()=>{pending.push(fn);},d)},render:f=>{i=0;return f();},effects(){pending.splice(0).forEach(f=>{const c=f();if(c)cleanup.push(c);});},stop(){cleanup.splice(0).reverse().forEach(f=>f());}};}
const jsx=(type,props,key)=>({type,props,key}),runtime={jsx,jsxs:jsx};
async function main(){
 const live=load('src/lib/live-updates.ts');let app;const channels=[],states=[];let reads=0;
 const stop=live.startLiveUpdates({foreground:true,watchApp:fn=>{app=fn;return()=>app=null;},listen:(event,status)=>{const c={event,status,removed:false};channels.push(c);return()=>c.removed=true;},refresh:async()=>reads++,status:s=>states.push(s)});
 channels[0].status('SUBSCRIBED');await advance(350);assert.equal(reads,1);channels[0].status('SUBSCRIBED');await advance(350);assert.equal(reads,1,'duplicate subscribe does not reread');
 for(let i=0;i<12;i++){channels[0].status('CHANNEL_ERROR');channels[0].status('TIMED_OUT');}
 await advance(30000);assert.equal(channels.length,1,'no 30-second app subscription timer');assert.equal(states.filter(s=>s==='disconnected').length,1,'retry attempts do not flip warning state');
 // A normal/manual read can succeed while the socket remains disconnected.
 reads++;assert.equal(states.at(-1),'disconnected');channels[0].status('SUBSCRIBED');await advance(350);assert.equal(states.at(-1),'live');assert.equal(reads,3);await advance(60000);assert.equal(channels.length,1,'SDK recovery cancels the fallback');
 channels[0].status('CLOSED');await advance(5000);assert.equal(channels.length,2);assert(channels[0].removed);channels[0].status('SUBSCRIBED');assert.equal(states.at(-1),'disconnected');channels[1].status('SUBSCRIBED');await advance(350);
 app(false);assert(channels[1].removed);app(true);assert.equal(channels.length,3);channels[2].status('SUBSCRIBED');await advance(350);stop();assert(channels[2].removed);assert.equal(timers.size,0);
 assert.equal(live.liveSubscriptionSignature([{table:'a',filter:'id=eq.1'},{table:'b'},{table:'a',filter:'id=eq.1'}]),live.liveSubscriptionSignature([{table:'b'},{table:'a',filter:'id=eq.1'}]));
 console.log('PASS transient SDK recovery, duplicate subscribe, stable disconnected state, normal reads during outage, terminal close, background and canonical bindings');
 const diag=load('src/lib/live-diagnostics.ts');for(let i=0;i<100;i++)diag.recordLiveDiagnostic('invoice:secret-owner-id','CHANNEL_ERROR',{message:'JWT secret-token personal-data'});const log=diag.readLiveDiagnostics();assert.equal(log.length,80);assert.equal(log[0].cause,'authorization');assert(!JSON.stringify(log).includes('secret'));diag.recordLiveDiagnostic('unknown-owner-without-colon','CLOSED');assert.equal(diag.readLiveDiagnostics().at(-1).scope,'other');
 console.log('PASS bounded diagnostics contain no raw token, owner, filter or server message');
 const notices=[];const store=load('src/lib/toast-store.ts').createToastStore(n=>notices.push(n),()=>now);const a={},b={},nextA={};store.setScope(a);
 assert(store.show({tone:'success',message:'تم الحفظ'},a));for(let i=0;i<20;i++)assert.equal(store.show({tone:'success',message:'تم الحفظ'},a),false);await advance(3500);assert.equal(notices.at(-1),null);
 assert.equal(store.show({tone:'success',message:'تم الحفظ'},a),false);await advance(6500);assert(store.show({tone:'success',message:'تم الحفظ'},a));store.setScope(b);assert.equal(store.show({tone:'error',message:'نتيجة حساب سابق'},a),false);
 store.setScope(nextA);assert.equal(store.show({tone:'warning',message:'من صفحة قديمة'},a),false,'returning to same route/account must not revive an old lease');assert(store.show({tone:'info',message:'معلومة'},nextA));store.setScope(null);assert.equal(timers.size,0);
 console.log('PASS toast cooldown, expiry, four-tone API, route/account isolation, ABA and cleanup');
 const h=hooks(),colors={surface:'surface',mutedSurface:'muted',border:'border',textSecondary:'text',primary:'green',surfaceSecondary:'secondary'};
 const theme={Typography:{caption:{},body:{},cardTitle:{}},Spacing:{two:8,three:12,four:16},Radius:{sm:4,lg:16}};
 const native={View:'View',Text:'Text',ActivityIndicator:'Spinner',StyleSheet:{create:x=>x},Pressable:'Pressable'};
 const uiMocks={react:h.react,'react/jsx-runtime':runtime,'react-native':native,'@/constants/theme':theme,'@/context/ThemeContext':{useTheme:()=>({colors})}};
 const loading=load('src/components/ui/LoadingState.tsx',uiMocks);
 let row=h.render(()=>loading.RefreshStatus({busy:false}));h.effects();const height=row.props.style.minHeight;row=h.render(()=>loading.RefreshStatus({busy:true}));h.effects();assert.equal(row.props.style.minHeight,height);assert(row.props.children[0].props.children);await advance(12000);row=h.render(()=>loading.RefreshStatus({busy:true}));assert(!row.props.children[0].props.children);assert(row.props.children[1].props.children.includes('لم تُؤكد'));
 row=h.render(()=>loading.RefreshStatus({busy:false}));assert.equal(row.props.style.minHeight,height);h.stop();
 const liveUI=load('src/components/ui/LiveStatus.tsx',uiMocks).LiveStatus;assert.equal(liveUI({state:'live'}).props.style.minHeight,liveUI({state:'disconnected'}).props.style.minHeight);assert(!liveUI({state:'live'}).props.accessibilityLiveRegion);
 console.log('PASS stable connection/refresh slots and bounded spinner without pretending completion');
 // Real hook: render changes cannot recreate the channel; account scope cannot inherit live status.
 const hooks2=hooks();const actualChannels=[];const actual=load('src/hooks/useLiveUpdates.ts',{
  react:hooks2.react,'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})}},'@/lib/live-updates':live,'@/lib/live-diagnostics':{recordLiveDiagnostic(){}},
  '@/lib/supabase':{supabase:{channel:()=>{const c={on(){return c;},subscribe:fn=>{c.status=fn;return c;}};actualChannels.push(c);return c;},removeChannel:c=>{c.status('CLOSED');}}}
 });
 let options={channelName:'money:A',enabled:true,subscriptions:[{table:'money_invoices'},{table:'money_allocations'}],onChange:async()=>{}};
 let state=hooks2.render(()=>actual.useLiveController(options));hooks2.effects();const start=state.start,dispose=start();actualChannels[0].status('SUBSCRIBED');state=hooks2.render(()=>actual.useLiveController({...options,subscriptions:[...options.subscriptions].reverse()}));hooks2.effects();assert.equal(state.start,start);assert.equal(state.status,'live');assert.equal(actualChannels.length,1);
 dispose();options={...options,channelName:'money:B'};state=hooks2.render(()=>actual.useLiveController(options));assert.equal(state.status,'connecting');hooks2.stop();
 console.log('PASS actual live hook: stable start on equivalent renders, intentional close ignored, new owner not live by inheritance');
 const providerHooks=hooks();let actor='A',route='/driver',palette='light';
 const palettes=Object.fromEntries(['light','dark'].map(mode=>[mode,Object.fromEntries(['success','error','warning','info'].flatMap(t=>[[t+'Foreground',mode+'-'+t+'-text'],[t+'Surface',mode+'-'+t+'-surface']]).concat([['borderStrong',mode+'-border']]))]));
 const ToastProvider=load('src/context/ToastContext.tsx',{
  react:{...providerHooks.react,useLayoutEffect:providerHooks.react.useEffect,createContext:()=>({Provider:'Provider'})},'react/jsx-runtime':runtime,'react-native':native,'expo-router':{usePathname:()=>route},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:24})},
  '@/context/AuthContext':{useAuth:()=>({user:{id:actor}})},'@/context/ThemeContext':{useTheme:()=>({colors:palettes[palette]})},'@/constants/theme':theme,'@/lib/toast-store':load('src/lib/toast-store.ts')
 }).ToastProvider;
 const stableChild={type:'Screen',props:{}};const renderToast=()=>providerHooks.render(()=>ToastProvider({children:stableChild}));let toastTree=renderToast();providerHooks.effects();const oldShow=toastTree.props.value.show;
 for(const tone of ['success','error','warning','info']){toastTree.props.value.show({tone,message:tone});for(const mode of ['light','dark']){palette=mode;toastTree=renderToast();const overlay=toastTree.props.children[1];assert.equal(overlay.props.children.props.style.backgroundColor,mode+'-'+tone+'-surface');assert.equal(overlay.props.children.props.children[0].props.style.color,mode+'-'+tone+'-text');assert.equal(toastTree.props.children[0],stableChild,'toast updates never key/remount the screen');}}
 actor='B';route='/home';toastTree=renderToast();providerHooks.effects();toastTree=renderToast();assert.equal(toastTree.props.children[1],null);assert.equal(oldShow({tone:'success',message:'late'}),false);providerHooks.stop();assert.equal(timers.size,0);
 console.log('PASS actual toast host: all four tones in both themes, stable child, scope cleanup and late callback denial');
 const buttonHooks=hooks();const buttonTheme={...theme,Fonts:{},FontSizes:{},ControlSizes:{icon:24,button:48,touch:44}};
 const buttonMocks={...uiMocks,react:buttonHooks.react,'@/constants/theme':buttonTheme};const buttonLoading=load('src/components/ui/LoadingState.tsx',buttonMocks);
 const Button=load('src/components/ui/AppButton.tsx',{...buttonMocks,'@/components/ui/LoadingState':buttonLoading,'@/components/ui/AppIcon':{AppIcon:'Icon'}}).AppButton;
 const renderButton=busy=>buttonHooks.render(()=>Button({title:'تأكيد التسليم',loading:busy,onPress(){}}));let buttonTree=renderButton(false);buttonHooks.effects();const slotWidth=buttonTree.props.children[0].props.style.width;buttonTree=renderButton(true);buttonHooks.effects();assert.equal(buttonTree.props.children[0].props.style.width,slotWidth);await advance(12000);buttonTree=renderButton(true);assert.equal(buttonTree.props.children[0].props.children.type,'Icon');assert.equal(buttonTree.props.disabled,true);assert.equal(buttonTree.props.accessibilityState.busy,true);assert.equal(buttonTree.props.children[1].props.children,'تأكيد التسليم');buttonHooks.stop();
 console.log('PASS actual action button: fixed slot, bounded animation, no fake completion or unlock');
 const customerHooks=hooks();let customer='customer-A',liveOptions;const requests=[];
 const guard=load('src/lib/read-scope.ts').createReadScope();guard.open();
 const customerScreen=load('src/app/orders.tsx',{
  react:customerHooks.react,'react/jsx-runtime':runtime,'react-native':{...native,ScrollView:'Scroll',RefreshControl:'Refresh'},'expo-router':{useRouter:()=>({})},
  '@/context/ThemeContext':{useTheme:()=>({colors})},'@/constants/theme':{...theme,FontSizes:{},Fonts:{}},'@/context/AuthContext':{useAuth:()=>({user:{id:customer}})},'@/context/CartContext':{useCart:()=>({itemCount:0})},
  '@/hooks/useReadScope':{useReadScope:()=>guard},'@/hooks/useOrderRealtime':{useOrderRealtime:options=>{liveOptions=options;return 'disconnected';}},
  '@/lib/user-error-message':load('src/lib/user-error-message.ts'),'@/lib/order-item-groups':{groupOrderItems:items=>items},'@/lib/customer-orders':{formatCurrency:()=> '220',getCustomerOrders:()=>new Promise((resolve,reject)=>requests.push({resolve,reject}))},
  '@/components/ui/LoadingState':{LoadingSkeleton:'Skeleton'},'@/components/ui/LiveStatus':{LiveStatus:'Live'},'@/components/navigation/AppHeader':{AppHeader:'Header'},'@/components/ui/AppButton':{AppButton:'Button'},'@/components/ui/AppIcon':{AppIcon:'Icon'}
 }).default;
 const children=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(children)];
 let wrapper=customerScreen();const originalKey=wrapper.props.key??wrapper.key;const content=wrapper.type;
 let customerTree=customerHooks.render(()=>content());customerHooks.effects();await advance(0);assert.equal(requests.length,1);
 const backgroundRead=liveOptions.onChange();requests[0].resolve([]);requests[1].resolve([]);await backgroundRead;customerTree=customerHooks.render(()=>content());assert(!children(customerTree).some(n=>n.type==='Skeleton'),'latest background read ends first-load state');
 const fresh=liveOptions.onChange();requests[2].resolve([{id:'order',c3:{references:{'ORD:order':'ORD-0000001'}},stores:[{storeName:'متجر',items:[]}],totals:[{total:220,currency:'SYP'}],created_at:'2026-11-10',status:'submitted'}]);await fresh;customerTree=customerHooks.render(()=>content());assert(JSON.stringify(customerTree).includes('ORD-0000001'));
 const failedRead=liveOptions.onChange();requests[3].reject({message:'offline SQL secret'});await failedRead;customerTree=customerHooks.render(()=>content());assert(JSON.stringify(customerTree).includes('ORD-0000001'),'failed refresh must retain same-account orders');assert(!JSON.stringify(customerTree).includes('SQL secret'));
 customer='customer-B';wrapper=customerScreen();assert.notEqual(wrapper.props.key??wrapper.key,originalKey);customerHooks.stop();guard.close();
 console.log('PASS actual customer orders: superseded initial read finishes, same-owner rows survive read failure and account key isolates data');
 const user=load('src/lib/user-error-message.ts');assert.equal(user.userErrorMessage({message:'relation money_invoices does not exist'},'تعذر التحميل'),'تعذر التحميل');assert.equal(user.userErrorMessage({message:'المبلغ يتجاوز المتبقي على الفاتورة.'},'تعذر التحميل'),'المبلغ يتجاوز المتبقي على الفاتورة.');
 console.log('PASS technical errors hidden without changing useful financial/domain reasons');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
