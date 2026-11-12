// Production service/model tests using fake adapters; no remote Auth or database calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={},timers={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,JSON,Number,Set,Promise,AbortController,setTimeout:timers.setTimeout||setTimeout,clearTimeout:timers.clearTimeout||clearTimeout,process:{env:{EXPO_PUBLIC_SUPABASE_URL:'https://example.invalid',EXPO_PUBLIC_SUPABASE_KEY:'test'}},require(n){if(Object.hasOwn(mocks,n))return mocks[n];if(n.startsWith('@/'))return load('src/'+n.slice(2)+'.ts',mocks);throw Error(n);}});return exports;}
const model=load('src/lib/personal-account-model.ts'),plain=x=>JSON.parse(JSON.stringify(x));
function harness(role='customer',timers={}){
 let owner='owner',before=null,lost=false,fail=false;const writes=[],invalidations=[],clients=[],events=[];
 const profile=id=>({id,full_name:'Saved name',age_range:null,gender:null,role:id==='owner'?role:'customer',updated_at:'v1'});
 const rows={owner:profile('owner'),other:profile('other')};
 const auth={getSession:async()=>({data:{session:owner?{user:{id:owner},access_token:'token-'+owner}:null},error:null}),getUser:async()=>({data:{user:{id:owner,email:'auth@example.invalid',phone:'LOGIN',user_metadata:{phone:'PERSONAL'}}},error:null}),signOut:async()=>{events.push('global-logout');if(before){const f=before;before=null;await f();}owner=null;return{error:null};}};
 function createClient(url,key,options){clients.push(options);if(!options.global?.headers)return {auth:{signInWithPassword:async()=>{events.push('isolated-verify');if(before){const f=before;before=null;await f();}return{data:{user:{id:'owner'}},error:null};},updateUser:async v=>{events.push('isolated-update');return{error:null};},signOut:async()=>{events.push('isolated-logout');return{error:null};}}};
  const token=options.global.headers.Authorization,subject=token.replace('Bearer token-','');
  return{from(table){assert.equal(table,'profiles');let values=null;const filters=[];const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},abortSignal:()=>q,update:v=>{values=v;return q;},single:execute,maybeSingle:execute};
   async function execute(){if(before){const f=before;before=null;await f();}const id=filters.find(x=>x[0]==='id')?.[1];assert.equal(id,subject,'a fixed token must accompany the fixed owner ID');if(values){writes.push({id,values:plain(values),filters:plain(filters),token});if(fail)return{error:Error('failed'),data:null};if(rows[id].updated_at!==filters.find(x=>x[0]==='updated_at')?.[1])return{error:null,data:null};rows[id]={...rows[id],...values,updated_at:'v2'};if(lost){lost=false;return{error:Error('lost reply'),data:null};}}
    return{data:{...rows[id]},error:null};}return q;}};
 }
 const api=load('src/lib/personal-account.ts',{'@/lib/push-device':{disablePushDevice:async()=>{}},'@/lib/supabase':{supabase:{auth}},'@supabase/supabase-js':{createClient},'@/lib/local-cache':{invalidateLocalCache:async k=>invalidations.push(k)}},timers);
 return{api,auth,rows,writes,events,clients,invalidations,setOwner:v=>owner=v,before:f=>before=f,lost:()=>lost=true,fail:()=>fail=true};
}
function hookHarness(){
 const cells=[];let cursor=0,pending=[];
 const react={createContext:()=>({Provider:'Provider'}),useContext:()=>null,
 useState(initial){const i=cursor++;if(!cells[i])cells[i]={value:typeof initial==='function'?initial():initial};return[cells[i].value,next=>{cells[i].value=typeof next==='function'?next(cells[i].value):next;}];},
 useRef(initial){const i=cursor++;if(!cells[i])cells[i]={current:initial};return cells[i];},useCallback:fn=>fn,useMemo:fn=>fn(),
 useEffect(fn,deps){const i=cursor++,old=cells[i];if(!old||!deps.every((d,j)=>Object.is(d,old.deps[j]))){cells[i]={deps,cleanup:old?.cleanup};pending.push(()=>{cells[i].cleanup?.();cells[i].cleanup=fn();});}}
 };
 return{react,jsx:{jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})},render:fn=>{cursor=0;return fn();},effects:()=>{const todo=pending;pending=[];todo.forEach(f=>f());}};
}
const tick=()=>new Promise(r=>setTimeout(r,0));
let count=0;async function test(label,fn){await fn();count++;console.log('PASS',label);}
async function main(){
 for(const role of ['customer','merchant','driver','admin'])await test('role identity '+role,async()=>{const h=harness(role),a=await h.api.readPersonalAccount('owner');assert.equal(a.role,role);assert.equal(a.email,'auth@example.invalid');assert.equal(a.loginPhone,'LOGIN');assert.equal(a.personalPhone,'PERSONAL');assert.equal(model.accountHome[role],{customer:'/home/account',merchant:'/merchant/account',driver:'/driver/account',admin:'/admin/more'}[role]);});
 await test('only allowed personal columns can be written',async()=>{const h=harness(),base=await h.api.readPersonalAccount('owner');await h.api.savePersonalAccount('owner',base,{full_name:' New name ',age_range:'25_34',gender:'female',role:'admin',email:'forged',phone:'STORE'});assert.deepEqual(h.writes[0].values,{full_name:'New name',age_range:'25_34',gender:'female'});assert.equal(h.rows.owner.role,'customer');assert.ok(h.invalidations.includes('customer-profile:owner'));assert.ok(h.invalidations.includes('merchant-account:owner'));});
 await test('final demographic constraints reject old genders and invalid age',async()=>{assert.throws(()=>model.personalValues({full_name:'Valid name',age_range:null,gender:'woman'}));assert.throws(()=>model.personalValues({full_name:'Valid name',age_range:'bad',gender:null}));});
 await test('invalid input does not permanently lock saves',async()=>{const h=harness(),b=await h.api.readPersonalAccount('owner');await assert.rejects(h.api.savePersonalAccount('owner',b,{...b,full_name:'x'}));await h.api.savePersonalAccount('owner',b,{...b,full_name:'Good name'});assert.equal(h.writes.length,1);});
 await test('late read after user switch is rejected',async()=>{const h=harness();h.before(async()=>h.setOwner('other'));await assert.rejects(h.api.readPersonalAccount('owner'));});
 await test('in-flight write remains bound to original token and cannot update the new user',async()=>{const h=harness(),b=await h.api.readPersonalAccount('owner');h.before(async()=>h.setOwner('other'));await assert.rejects(h.api.savePersonalAccount('owner',b,{...b,full_name:'Original owner'}));assert.equal(h.writes[0].token,'Bearer token-owner');assert.equal(h.rows.other.full_name,'Saved name');});
 await test('lost update response is read-confirmed without a second write',async()=>{const h=harness(),b=await h.api.readPersonalAccount('owner');h.lost();const r=await h.api.savePersonalAccount('owner',b,{...b,full_name:'Confirmed name'});assert.equal(r.full_name,'Confirmed name');assert.equal(h.writes.length,1);});
 await test('failed update is never reported as confirmed',async()=>{const h=harness(),b=await h.api.readPersonalAccount('owner');h.fail();await assert.rejects(h.api.savePersonalAccount('owner',b,{...b,full_name:'Not saved'}));assert.equal(h.rows.owner.full_name,'Saved name');});
 await test('concurrent profile change is not overwritten',async()=>{const h=harness(),b=await h.api.readPersonalAccount('owner');h.rows.owner.updated_at='v-new';await assert.rejects(h.api.savePersonalAccount('owner',b,{...b,full_name:'Stale edit'}));assert.equal(h.rows.owner.full_name,'Saved name');});
 await test('save locks immediately and freezes input snapshot',async()=>{const h=harness(),b=await h.api.readPersonalAccount('owner');let release;const wait=new Promise(r=>release=r);h.before(()=>wait);const input={...b,full_name:'Frozen name'},first=h.api.savePersonalAccount('owner',b,input);input.full_name='Later input';await assert.rejects(h.api.savePersonalAccount('owner',b,input));release();await first;assert.equal(h.writes[0].values.full_name,'Frozen name');});
 await test('return reload reads network values instead of old customer cache',async()=>{const h=harness();await h.api.readPersonalAccount('owner');h.rows.owner.full_name='Refreshed name';assert.equal((await h.api.readPersonalAccount('owner')).full_name,'Refreshed name');});
 await test('generation gate fences blur and late loads',async()=>{const gate=model.createAccountGate(),old=gate.next();gate.cancel();const fresh=gate.next();assert.equal(gate.valid(old),false);assert.equal(gate.valid(fresh),true);assert.ok(fs.readFileSync('src/hooks/usePersonalAccount.ts','utf8').includes('gate.current.cancel()'));});
 await test('password verification never signs into the shared client',async()=>{const h=harness();await h.api.changePersonalPassword('owner','auth@example.invalid','old-password','new-password');assert.deepEqual(h.events,['isolated-verify','isolated-update','isolated-logout']);assert.equal(h.clients[0].auth.persistSession,false);});
 await test('password verification user switch prevents password UPDATE',async()=>{const h=harness();h.before(async()=>h.setOwner('other'));await assert.rejects(h.api.changePersonalPassword('owner','auth@example.invalid','old-password','new-password'));assert.ok(!h.events.includes('isolated-update'));});
 await test('logout locks against rapid repeats and clears identity caches',async()=>{const h=harness();let release;const wait=new Promise(r=>release=r);h.before(()=>wait);const first=h.api.logoutPersonalAccount('owner');await assert.rejects(h.api.logoutPersonalAccount('owner'));release();await first;assert.equal(h.events.filter(x=>x==='global-logout').length,1);assert.ok(h.invalidations.includes('customer-profile:owner'));});
 await test('second password submission is blocked before another verification',async()=>{const h=harness();let release;const wait=new Promise(r=>release=r);h.before(()=>wait);const first=h.api.changePersonalPassword('owner','auth@example.invalid','old-password','new-password');await assert.rejects(h.api.changePersonalPassword('owner','auth@example.invalid','old-password','new-password'));release();await first;assert.equal(h.events.filter(x=>x==='isolated-update').length,1);});
 await test('Auth read timeout rejects without issuing any profile mutation',async()=>{const timers=new Map();let id=0;const h=harness('customer',{setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)});h.auth.getUser=()=>new Promise(()=>{});const read=h.api.readPersonalAccount('owner'),rejected=assert.rejects(read);await tick();for(const fn of [...timers.values()])fn();await rejected;assert.equal(h.writes.length,0);assert.equal(timers.size,0);});
 await test('legacy short names load without crashing the editor seed',async()=>{assert.equal(model.personalDraft({full_name:'x',age_range:null,gender:null}).full_name,'x');assert.throws(()=>model.personalValues({full_name:'x',age_range:null,gender:null}));});
 await test('actual settings provider restores theme, saves once, and retains previous value on failure',async()=>{
  const hooks=hookHarness(),writes=[];let fail=false;
  const m=load('src/context/SettingsContext.tsx',{'react':hooks.react,'react/jsx-runtime':hooks.jsx,'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async()=> 'light',setItem:async(k,v)=>{writes.push([k,v]);if(fail)throw Error('offline');}}}});
  const render=()=>hooks.render(()=>m.SettingsProvider({children:null})).props.value;
  let state=render();assert.equal(state.themeMode,'system');hooks.effects();await tick();state=render();assert.equal(state.themeMode,'light');assert.equal(state.settingsReady,true);
  state.setThemeMode('dark');state.setThemeMode('system');await tick();state=render();assert.equal(writes.length,1);assert.deepEqual(writes[0],['@taswoq/theme-mode','dark']);assert.equal(state.themeMode,'dark');
  fail=true;state.setThemeMode('light');await tick();state=render();assert.equal(state.themeMode,'dark');assert.ok(state.settingsError);assert.equal(state.themeSaving,false);
 });
 await test('actual account hook discards blur response, refreshes on focus and hides previous user synchronously',async()=>{
  const hooks=hookHarness();let owner='owner',focus;const requests=[];
  const m=load('src/hooks/usePersonalAccount.ts',{'react':hooks.react,'expo-router':{useFocusEffect:fn=>focus=fn},'@/context/AuthContext':{useAuth:()=>({user:{id:owner}})},'@/lib/personal-account':{readPersonalAccount:(id,signal)=>new Promise(resolve=>requests.push({id,signal,resolve}))}});
  const render=()=>hooks.render(()=>m.usePersonalAccount());render();let blur=focus();assert.equal(requests.length,1);blur();assert.equal(requests[0].signal.aborted,true);render();blur=focus();requests[0].resolve({id:'owner',full_name:'stale'});await tick();assert.equal(render().data,null);
  requests[1].resolve({id:'owner',full_name:'fresh'});await tick();assert.equal(render().data.full_name,'fresh');owner='other';assert.equal(render().data,null);blur();render();blur=focus();requests[2].resolve({id:'other',full_name:'other identity'});await tick();assert.equal(render().data.id,'other');blur();
 });
 await test('actual draft guard confirms cancel and blocks busy navigation',async()=>{
  const hooks=hookHarness();let block,focus,backHandler,dispatched=0,left=0,locked=false;
  const m=load('src/hooks/useAccountDraftGuard.tsx',{'react':hooks.react,'react/jsx-runtime':hooks.jsx,'expo-router':{useNavigation:()=>({dispatch:()=>dispatched++}),useFocusEffect:fn=>focus=fn},'expo-router/react-navigation':{usePreventRemove:(enabled,fn)=>block=fn},'react-native':{BackHandler:{addEventListener:(event,fn)=>{backHandler=fn;return{remove(){}};}}},'@/components/ui/AppModal':{AppConfirmModal:'Confirm'}});
  const render=()=>hooks.render(()=>m.useAccountDraftGuard(true,false,()=>left++,()=>locked));
  let guard=render();hooks.effects();focus();block({data:{action:{type:'GO_BACK'}}});guard=render();assert.equal(dispatched,0);assert.equal(guard.modal.props.children[0].props.visible,true);guard.modal.props.children[0].props.onCancel();
  assert.equal(backHandler(),true);guard=render();guard.modal.props.children[0].props.onConfirm();assert.equal(left,1);assert.equal(dispatched,0);
  const fresh=hookHarness();const busyModule=load('src/hooks/useAccountDraftGuard.tsx',{'react':fresh.react,'react/jsx-runtime':fresh.jsx,'expo-router':{useNavigation:()=>({dispatch:()=>dispatched++}),useFocusEffect:fn=>focus=fn},'expo-router/react-navigation':{usePreventRemove:(enabled,fn)=>block=fn},'react-native':{BackHandler:{addEventListener:()=>({remove(){}})}},'@/components/ui/AppModal':{AppConfirmModal:'Confirm'}});
  locked=true;guard=fresh.render(()=>busyModule.useAccountDraftGuard(true,false,()=>left++,()=>locked));fresh.effects();guard.back();assert.equal(left,1);assert.equal(dispatched,0);
 });
 await test('uncertain save permits explicit retry only after a verified unchanged base',async()=>{const base={full_name:'Base name',age_range:null,gender:null},draft={...base,full_name:'New name'};assert.equal(model.personalSaveResolution(draft,draft,base),'confirmed');assert.equal(model.personalSaveResolution(base,draft,base),'retry');assert.equal(model.personalSaveResolution({...base,full_name:'External name'},draft,base),'conflict');});
 await test('driver credentials retain safe snapshot on failure and ignore a late result after blur',async()=>{
  const hooks=hookHarness(),requests=[],routes=[];
  const queueModule=load('src/lib/driver-read-queue.ts');
  let owner='owner',loadCredentials,live,dimensions={width:390,fontScale:1};
  const router={replace:path=>routes.push(path)};
  const queue=queueModule.createDriverReadQueue((...args)=>loadCredentials(...args));
  const m=load('src/components/account/DriverProfessionalInfo.tsx',{
   react:hooks.react,'react/jsx-runtime':hooks.jsx,'expo-router':{useRouter:()=>router},
   'react-native':{ActivityIndicator:'Spinner',Text:'Text',View:'View',StyleSheet:{create:x=>x},useWindowDimensions:()=>dimensions},
   '@/context/AuthContext':{useAuth:()=>({user:{id:owner}})},'@/context/ThemeContext':{useTheme:()=>({colors:{}})},
   '@/lib/driver-deliveries':{getDriverApplication:(id,signal)=>new Promise((resolve,reject)=>requests.push({id,signal,resolve,reject}))},
   '@/lib/personal-account':{assertAccount:async()=>{},deadline:async task=>task},
   '@/components/account/AccountSection':{AccountSection:'Section'},'@/components/ui/AppButton':{AppButton:'Button'},
   '@/hooks/useDriverTaskRefresh':{useDriverTaskRefresh:fn=>{loadCredentials=fn;return queue.request;}},
   '@/hooks/useOrderRealtime':{useOrderRealtime:options=>{live=options;}},
   '@/constants/theme':{Typography:{},Spacing:{three:12,four:16},MaxContentWidth:600},
  });
  const walk=node=>Array.isArray(node)?node.flatMap(walk):node?.props?[node,...walk(node.props.children)]:[];
  const render=(summary=false)=>walk(hooks.render(()=>m.DriverProfessionalInfo({summary})));
  assert(render().some(node=>node.type==='Spinner'));
  queue.open();const first=queue.request('initial');await tick();
  requests[0].resolve({status:'accepted',full_name:'الاسم المهني',vehicle_type:'',contact_phone:'0990000000',available_hours:{schedule:'صباحًا'}});
  await first;assert(render().some(node=>node.props.children==='معتمد'));
  assert(render().some(node=>node.props.children==='غير مسجل'));
  const vehicle=()=>render().find(node=>node.key==='المركبة');
  assert.equal(vehicle().props.style[1].flexBasis,'42%');
  dimensions={width:320,fontScale:1.5};assert.equal(vehicle().props.style[1].flexBasis,'100%');
  const summary=render(true);
  assert(summary.some(node=>node.props.children==='سائق معتمد'));
  assert(!summary.some(node=>['الاسم المهني','دراجة','0990000000','صباحًا'].includes(node.props.children)));
  const failed=live.onChange();await tick();
  assert.equal(live.subscriptions[0].filter,'user_id=eq.owner');
  assert(!render().some(node=>node.type==='Spinner'));
  requests[1].reject(Error('offline'));await failed;
  const stale=render();assert(stale.some(node=>node.props.children==='غير مؤكدة'));assert(stale.some(node=>node.props.children==='صباحًا'));
  const staleSummary=render(true);
  assert(staleSummary.some(node=>node.props.children==='الاعتماد غير مؤكد'));
  assert(!staleSummary.some(node=>node.props.children==='سائق معتمد'));
  const late=queue.request('manual');await tick();queue.close();assert.equal(requests[2].signal.aborted,true);
  owner='other';assert(!render().some(node=>node.props.children==='الاسم المهني'));
  requests[2].resolve(null);await late;assert.equal(routes.length,0);
  queue.open();const revoked=queue.request('initial');await tick();assert.equal(requests[3].id,'other');
  requests[3].resolve({status:'rejected'});await revoked;assert.deepEqual(routes,['/application-status']);
  assert(!render().some(node=>node.props.children==='معتمد'));
  let history=false;
  const credentials=load('src/app/driver/credentials.tsx',{
   'react/jsx-runtime':hooks.jsx,'react-native':{StyleSheet:{create:x=>x},View:'View'},
   'expo-router':{useRouter:()=>({canGoBack:()=>history,replace:path=>routes.push(path),back:()=>routes.push('back')})},
   '@/components/account/AccountShell':{AccountShell:'Shell'},'@/components/account/DriverProfessionalInfo':{DriverProfessionalInfo:'Professional'},
   '@/components/navigation/AppHeader':{AppHeader:'Header'},'@/constants/theme':{MaxContentWidth:600},
   '@/context/AuthContext':{useAuth:()=>({user:{id:owner}})},
  }).default;
  const page=credentials();
  page.props.header.props.onBack();assert.equal(routes.at(-1),'/driver/account');
  history=true;page.props.header.props.onBack();assert.equal(routes.at(-1),'back');
  assert.equal(walk(page).find(node=>node.type==='Professional').key,'other');
 });
 await test('driver account opens ordered destinations without support and isolates the owner',()=>{
  const hooks=hookHarness(),routes=[];
  let owner='driver',profile={role:'driver',full_name:'اسم السائق',email:'driver@example.invalid'},error='',retries=0;
  const m=load('src/app/driver/account.tsx',{
   react:hooks.react,'react/jsx-runtime':hooks.jsx,'expo-router':{useRouter:()=>({push:path=>routes.push(path)})},
   'expo-constants':{__esModule:true,default:{expoConfig:{name:'تسوق',version:'9.8.7'}}},
   'react-native':{ActivityIndicator:'Spinner',Text:'Text',View:'View',StyleSheet:{create:x=>x,hairlineWidth:1}},
   '@/components/account/AccountMenuItem':{AccountMenuItem:'Menu'},'@/components/account/AccountProfileHeader':{AccountProfileHeader:'Profile'},
   '@/components/account/AccountSection':{AccountSection:'Section'},'@/components/account/AccountShell':{AccountShell:'Shell'},
   '@/components/account/DriverProfessionalInfo':{DriverProfessionalInfo:'Professional'},'@/components/account/SharedAccountParts':{AccountLogout:'Logout'},
   '@/components/navigation/AppHeader':{AppHeader:'Header'},'@/components/ui/AppButton':{AppButton:'Button'},'@/components/ui/AppModal':{AppModal:'Modal'},
   '@/constants/theme':{Typography:{},Spacing:{}},'@/context/AuthContext':{useAuth:()=>({user:{id:owner}})},
   '@/context/ThemeContext':{useTheme:()=>({colors:{}})},'@/hooks/usePersonalAccount':{usePersonalAccount:()=>({data:profile,error,reload:()=>retries++})},
  });
  const walk=node=>Array.isArray(node)?node.flatMap(walk):node?.props?[node,...walk(node.props.children)]:[];
  const initial=m.default(),render=()=>walk(hooks.render(()=>initial.type(initial.props)));
  const tree=render();assert.equal(tree.find(node=>node.type==='Profile').props.name,'اسم السائق');
  assert.equal(tree.find(node=>node.type==='Profile').props.accessory.props.summary,true);
  assert(!tree.some(node=>node.type==='Professional'));
  assert(tree.some(node=>node.props.children==='9.8.7'));
  const links=tree.filter(node=>node.type==='Menu');assert(links.every(node=>node.props.compact));
  links.forEach(node=>node.props.onPress());
  assert.deepEqual(routes,['/driver/credentials','/driver/cash-account','/personal-info','/notifications','/driver/settings','/security','/privacy','/terms','/about']);
  assert.deepEqual(links.slice(0,5).map(node=>node.props.title),['بيانات الاعتماد','المالية والفواتير','المعلومات الشخصية','الإشعارات','الإعدادات']);
  const header=tree.find(node=>node.type==='Shell').props.header.props;
  assert.equal(header.title,'حسابي');assert.equal(header.showNotifications,false);
  assert(!tree.some(node=>node.type==='Modal'||node.props.title==='الدعم والمساعدة'));
  assert(render().some(node=>node.type==='Logout'&&node.props.compact));
  error='offline';render().find(node=>node.type==='Button').props.onPress();assert.equal(retries,1);
  profile={role:'merchant',full_name:'اسم حساب آخر',email:'other@example.invalid'};
  assert.equal(render().find(node=>node.type==='Profile').props.name,'حساب السائق');
  owner='other';assert.notEqual(m.default().key,initial.key);
 });
 await test('merchant account shows the scoped profile, moved links once and the Expo version',()=>{
  const hooks=hookHarness(),routes=[];let state={data:{role:'merchant',full_name:'اسم التاجر',email:'merchant@example.invalid'},loading:true,error:'',reload:()=>{}};let retries=0;
  const m=load('src/components/merchant/MerchantAccountScreens.tsx',{
   'react/jsx-runtime':hooks.jsx,'expo-router':{useRouter:()=>({push:route=>routes.push(plain(route))})},
   'expo-constants':{__esModule:true,default:{expoConfig:{name:'اسم التطبيق الفعلي',version:'9.8.7'}}},
   'react-native':{ActivityIndicator:'Spinner',StyleSheet:{create:v=>v,hairlineWidth:1},Text:'Text',View:'View'},
   '@/components/account/AccountShell':{AccountShell:'Shell'},'@/components/account/SharedAccountParts':{AccountLogout:'Logout'},
   '@/components/account/PersonalInfoScreen':{PersonalInfoScreen:'PersonalInfo'},'@/components/account/AccountMenuItem':{AccountMenuItem:'MenuItem'},
   '@/components/ui/AppButton':{AppButton:'Button'},'@/components/ui/AppIcon':{AppIcon:'Icon'},
   '@/constants/theme':{Typography:{},Spacing:{},Radius:{}},'@/context/MerchantWorkspaceContext':{},
   '@/context/ThemeContext':{useTheme:()=>({colors:{}})},'@/hooks/usePersonalAccount':{usePersonalAccount:()=>state},
  });
  const walk=node=>Array.isArray(node)?node.flatMap(walk):node?.props?[node,...walk(node.props.children)]:[];
  const nodes=()=>walk(m.MerchantAccountHub());
  let tree=nodes();assert.ok(tree.some(n=>n.props.children==='اسم التاجر'));assert.ok(!tree.some(n=>n.type==='Spinner'));
  const items=tree.filter(n=>n.type==='MenuItem');assert.equal(items.length,10);assert.ok(items.every(n=>n.props.compact));
  assert.ok(tree.some(n=>n.props.children==='اسم التطبيق الفعلي'));assert.ok(tree.some(n=>n.props.children==='9.8.7'));
  assert.ok(!tree.some(n=>n.props.children==='الكرك الشرقي'));
  items.forEach(n=>n.props.onPress());
  assert.deepEqual(routes,['/merchant/store-info','/merchant/finance',{pathname:'/merchant/finance',params:{search:'SUB-'}},'/merchant/personal-info','/notifications','/merchant/settings','/merchant/security','/privacy','/terms','/about']);
  assert.ok(tree.some(n=>n.type==='Logout'&&n.props.compact));
  state={...state,loading:false,error:'failed',reload:()=>retries++};tree=nodes();
  assert.ok(tree.some(n=>n.props.children==='اسم التاجر'));tree.find(n=>n.props.title==='إعادة المحاولة').props.onPress();assert.equal(retries,1);
  state={...state,error:'',data:{role:'customer',full_name:'اسم حساب آخر',email:'other@example.invalid'}};
  assert.ok(!nodes().some(n=>['اسم التاجر','اسم حساب آخر','other@example.invalid'].includes(n.props.children)));
 });
 await test('merchant and driver settings share the three appearance controls and other roles retain their links',()=>{
  const hooks=hookHarness(),paths=[],themes=[];let role;
  const settings=load('src/components/account/SettingsScreen.tsx',{
   'react/jsx-runtime':hooks.jsx,'expo-router':{useRouter:()=>({push:path=>paths.push(path),canGoBack:()=>false,replace:path=>paths.push(path)})},
   'react-native':{Pressable:'Pressable',ScrollView:'ScrollView',StyleSheet:{create:v=>v},Text:'Text',View:'View'},
   '@/hooks/usePersonalAccount':{usePersonalAccount:()=>({data:role?{role}:null})},'@/components/navigation/AppHeader':{AppHeader:'Header'},
   '@/components/ui/AppIcon':{AppIcon:'Icon'},'@/components/ui/SyriaFlag':{SyriaFlag:'Flag'},
   '@/constants/theme':{FontSizes:{},Fonts:{},Radius:{},Spacing:{}},'@/context/CartContext':{useCart:()=>({itemCount:0})},
   '@/context/SettingsContext':{useSettings:()=>({themeMode:'system',settingsReady:true,setThemeMode:mode=>themes.push(mode)})},
   '@/context/ThemeContext':{useTheme:()=>({colors:{}})},
  }).default;
  const walk=node=>Array.isArray(node)?node.flatMap(walk):node?.props?[node,...walk(node.props.children)]:[];
  const merchant=walk(settings({embedded:true,preferencesOnly:true}));
  assert.ok(!merchant.some(n=>['الخصوصية والأمان','حول التطبيق','اللغة','الإصدار 1.0.0'].includes(n.props.children)));
  merchant.filter(n=>n.props.mode).forEach(n=>n.props.onPress());assert.deepEqual(themes,['system','light','dark']);
  const shared=walk(settings());for(const title of ['تغيير كلمة المرور','الخصوصية','شروط الاستخدام','عن تسوق'])shared.find(n=>n.props.title===title).props.onPress();
  assert.deepEqual(paths,['/security','/privacy','/terms','/about']);
  const driverRoute=load('src/app/driver/settings.tsx',{'react/jsx-runtime':hooks.jsx,
   '@/components/account/SettingsScreen':{__esModule:true,default:settings}}).default();
  assert.equal(driverRoute.type,settings);
  const driver=walk(settings(driverRoute.props));
  assert.deepEqual(plain(driver.find(n=>n.type==='ScrollView')),plain(merchant.find(n=>n.type==='ScrollView')));
  driver.find(n=>n.type==='Header').props.onBack();assert.equal(paths.at(-1),'/driver/account');
  role='driver';assert(!walk(settings()).some(n=>n.props.title==='الخصوصية'||n.props.title==='عن تسوق'));
 });
 await test('moved account links keep their original back behavior',()=>{
  const hooks=hookHarness(),history=[];
  const walk=node=>Array.isArray(node)?node.flatMap(walk):node?.props?[node,...walk(node.props.children)]:[];
  const mocks={
   'react/jsx-runtime':hooks.jsx,'expo-router':{Link:'Link',useRouter:()=>({back:()=>history.pop()})},
   'react-native':{Pressable:'Pressable',ScrollView:'ScrollView',StyleSheet:{create:v=>v,hairlineWidth:1},Text:'Text',View:'View'},
   'react-native-safe-area-context':{SafeAreaProvider:'Safe',SafeAreaView:'SafeView'},
   '@/components/ui/AppIcon':{AppIcon:'Icon'},'@/constants/theme':{Fonts:{},FontSizes:{},Spacing:{},Radius:{}},
   '@/context/ThemeContext':{useTheme:()=>({colors:{}})},'@/components/legal/LegalRelatedDocument':{},'@/components/legal/LegalSection':{},
   '@/components/about/AboutContent':{},'@/components/about/AboutHeader':{},
  };
  const legal=load('src/components/legal/LegalPageLayout.tsx',mocks).LegalPageLayout;
  const about=load('src/app/about.tsx',mocks).default;
  for(const parent of ['/merchant/account','/driver/account']) for(const route of ['/privacy','/terms','/about']){
   history.length=0;history.push(parent);
   history.push(route);
   const screen=route==='/about'?about():legal({intro:{},sections:[],relatedDocument:{}});
   walk(screen).find(node=>node.props.accessibilityLabel==='رجوع').props.onPress();
   assert.deepEqual(history,[parent]);
  }
  const navigation=load('src/lib/merchant-navigation.ts').merchantNavigation;
  assert.equal(navigation('/merchant/security').parent,'/merchant/account');
  assert.equal(navigation('/merchant/settings').parent,'/merchant/account');
 });
 await test('shared logout cancels, locks duplicate confirms, reports failure and routes success for all roles',async()=>{
  const consumers={merchant:'src/components/merchant/MerchantAccountScreens.tsx',customer:'src/app/home/account.tsx',driver:'src/app/driver/account.tsx',admin:'src/app/admin/more.tsx'};
  for(const [role,file] of Object.entries(consumers)){
   assert.match(fs.readFileSync(file,'utf8'),/<AccountLogout\b/);
   const hooks=hookHarness(),paths=[];let calls=0,finish;
   const shared=load('src/components/account/SharedAccountParts.tsx',{
    react:hooks.react,'react/jsx-runtime':hooks.jsx,'expo-router':{useRouter:()=>({replace:path=>paths.push(path)})},
    'react-native':{ActivityIndicator:'Spinner',Text:'Text',View:'View',StyleSheet:{create:v=>v}},
    '@/components/account/AccountProfileHeader':{},'@/components/account/AccountSection':{},'@/components/account/AccountMenuItem':{},
    '@/components/ui/AppButton':{AppButton:'Button'},'@/components/ui/AppModal':{AppModal:'Modal'},
    '@/context/ThemeContext':{useTheme:()=>({colors:{}})},'@/context/AuthContext':{useAuth:()=>({user:{id:role}})},
    '@/hooks/usePersonalAccount':{},'@/lib/personal-account':{logoutPersonalAccount:id=>{assert.equal(id,role);calls++;return new Promise(resolve=>{finish=resolve;});}},
    '@/constants/theme':{Spacing:{},Typography:{}},
   });
   const wrapper=shared.AccountLogout({compact:role==='merchant'});
   const render=()=>hooks.render(()=>wrapper.type(wrapper.props)).props.children;
   let [trigger,modal]=render();hooks.effects();trigger.props.onPress();[,modal]=render();assert.equal(modal.props.visible,true);
   assert.equal(modal.props.icon,'log-out-outline');modal.props.onCancel();[,modal]=render();assert.equal(modal.props.visible,false);assert.equal(calls,0);
   trigger.props.onPress();[,modal]=render();const confirm=()=>modal.props.actions.props.children[1].props.children.props.onPress();
   confirm();confirm();assert.equal(calls,1);modal.props.onCancel();[,modal]=render();assert.equal(modal.props.visible,true);assert.equal(modal.props.busy,true);
   finish(false);await tick();[,modal]=render();assert.equal(modal.props.children.props.accessibilityRole,'alert');assert.deepEqual(paths,[]);
   confirm();finish(true);await tick();assert.equal(calls,2);assert.deepEqual(paths,['/login']);
  }
 });
 await test('merchant personal form edits only the name and guards navigation to the account',async()=>{
  const hooks=hookHarness(),routes=[];let saved;
  const profile={id:'merchant',role:'merchant',full_name:'الاسم السابق',email:'merchant@example.invalid',loginPhone:'123',personalPhone:'456',birth_date:'1990-01-01',age_range:null,gender:null,updated_at:'v1'};
  const page=load('src/components/account/PersonalInfoScreen.tsx',{
   react:hooks.react,'react/jsx-runtime':hooks.jsx,'expo-router':{useRouter:()=>({canGoBack:()=>false,replace:path=>routes.push(path)})},
   'react-native':{Text:'Text',View:'View',StyleSheet:{create:v=>v,hairlineWidth:1}},
   '@/context/AuthContext':{useAuth:()=>({user:{id:profile.id}})},'@/context/ThemeContext':{useTheme:()=>({colors:{}})},
   '@/hooks/usePersonalAccount':{usePersonalAccount:()=>({data:profile,error:''})},
   '@/hooks/useAccountDraftGuard':{useAccountDraftGuard:(dirty,_busy,back)=>({back:()=>{if(!dirty)back();},modal:null})},
   '@/components/account/AccountShell':{},'@/components/account/AccountSection':{},'@/components/account/SharedAccountParts':{},
   '@/components/navigation/AppHeader':{},'@/components/ui/AppTextField':{AppTextField:'Field'},'@/components/ui/AppButton':{AppButton:'Button'},
   '@/components/ui/KeyboardAwareScrollView':{KeyboardAwareScrollView:'KeyboardScroll'},
   '@/lib/personal-account':{savePersonalAccount:async(owner,base,draft)=>{assert.equal(owner,profile.id);assert.equal(base,profile);saved=plain(draft);return {...profile,...draft};}},
   '@/constants/theme':{Typography:{},Spacing:{},Radius:{}},
  });
  const wrapper=page.PersonalInfoScreen({embedded:true}),form=wrapper.type(wrapper.props);
  const walk=node=>Array.isArray(node)?node.flatMap(walk):node?.props?[node,...walk(node.props.children)]:[];
  const render=()=>walk(hooks.render(()=>form.type(form.props)));
  let tree=render();hooks.effects();
  assert.equal(tree.filter(n=>n.type==='Field').length,1);assert.ok(tree.some(n=>n.type==='KeyboardScroll'));
  assert.equal(tree.find(n=>n.props.title==='حفظ الاسم').props.disabled,true);
  tree.find(n=>n.type==='Field').props.onChangeText('الاسم الجديد');tree=render();
  tree.find(n=>n.props.title==='العودة').props.onPress();assert.deepEqual(routes,[]);
  tree.find(n=>n.props.title==='حفظ الاسم').props.onPress();await tick();assert.equal(saved.full_name,'الاسم الجديد');assert.equal(saved.email,undefined);
  render().find(n=>n.props.title==='العودة').props.onPress();assert.deepEqual(routes,['/merchant/account']);
 });
 await test('merchant security validates locally, locks writes and hides another account',async()=>{
  const hooks=hookHarness(),routes=[],writes=[];let finish;
  const user={id:'merchant'};
  const state={data:{id:'merchant',role:'merchant',email:'merchant@example.invalid'},loading:false,error:''};
  const screen=load('src/components/account/SecurityScreen.tsx',{
   react:hooks.react,'react/jsx-runtime':hooks.jsx,'expo-router':{useRouter:()=>({canGoBack:()=>false,replace:path=>routes.push(path)})},
   'react-native':{Text:'Text',View:'View',StyleSheet:{create:v=>v,hairlineWidth:1}},
   '@/context/AuthContext':{useAuth:()=>({user})},'@/context/ThemeContext':{useTheme:()=>({colors:{}})},
   '@/hooks/usePersonalAccount':{usePersonalAccount:()=>state},'@/hooks/useAccountDraftGuard':{useAccountDraftGuard:(_dirty,_busy,back)=>({back,modal:null})},
   '@/components/account/AccountShell':{},'@/components/account/AccountSection':{},'@/components/account/SharedAccountParts':{},
   '@/components/navigation/AppHeader':{},'@/components/ui/AppTextField':{AppTextField:'Field'},'@/components/ui/AppButton':{AppButton:'Button'},
   '@/components/ui/AppIcon':{AppIcon:'Icon'},'@/components/ui/KeyboardAwareScrollView':{KeyboardAwareScrollView:'KeyboardScroll'},
   '@/lib/personal-account':{changePersonalPassword:(...args)=>{writes.push(args);return new Promise(resolve=>{finish=resolve;});}},
   '@/constants/theme':{Typography:{},Spacing:{},Radius:{}},
  }).default;
  const wrapper=screen({embedded:true});
  const walk=node=>Array.isArray(node)?node.flatMap(walk):node?.props?[node,...walk(node.props.children)]:[];
  const render=()=>walk(hooks.render(()=>wrapper.type(wrapper.props)));
  let tree=render();hooks.effects();
  const submit=()=>tree.find(n=>n.props.title==='تغيير كلمة المرور').props.onPress();
  submit();tree=render();assert.equal(writes.length,0);assert.equal(tree.filter(n=>n.type==='Field'&&n.props.error).length,3);
  tree.filter(n=>n.type==='Field').forEach((field,index)=>field.props.onChangeText(['old-password','new-password','new-password'][index]));
  tree=render();submit();submit();assert.equal(writes.length,1);assert.deepEqual(writes[0],['merchant','merchant@example.invalid','old-password','new-password']);
  finish();await tick();tree=render();assert.ok(tree.filter(n=>n.type==='Field').every(n=>n.props.value===''));
  tree.find(n=>n.props.title==='العودة').props.onPress();assert.deepEqual(routes,['/merchant/account']);
  state.data={id:'another-owner',role:'merchant',email:'another@example.invalid'};
  tree=render();assert.ok(!tree.some(n=>n.type==='Field'||n.props.children==='another@example.invalid'));
 });
 await test('UI contracts: one editor, draft guards, safe navigation and no phone writes',async()=>{
  const src=p=>fs.readFileSync(p,'utf8');assert.match(src('src/hooks/useAccountDraftGuard.tsx'),/usePreventRemove/);assert.match(src('src/hooks/useAccountDraftGuard.tsx'),/hardwareBackPress/);assert.match(src('src/components/account/PersonalInfoScreen.tsx'),/key=\{user\?\.id/);assert.match(src('src/components/merchant/MerchantAccountScreens.tsx'),/PersonalInfoScreen embedded/);assert.match(src('src/app/admin/more.tsx'),/SharedAccountMenu role="admin"/);assert.doesNotMatch(src('src/components/account/SettingsScreen.tsx'),/accountRole|notificationsEnabled|Switch/);assert.match(src('src/context/SettingsContext.tsx'),/THEME_MODE_STORAGE_KEY/);assert.match(src('src/context/SettingsContext.tsx'),/setTheme\(mode\)/);assert.doesNotMatch(src('src/lib/personal-account.ts'),/updateUser\(\{\s*(data|email|phone)/);
 });
 console.log(`${count} shared-account production logic/adapter checks passed (offline; no live Auth/RLS claims).`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
