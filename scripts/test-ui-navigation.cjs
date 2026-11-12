const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code, {exports, require:name=>{if(Object.hasOwn(mocks,name))return mocks[name];throw Error(name);}});
  return exports;
}
const destinations=load('src/lib/safe-back.ts',{});
for (const [path,account,expected] of [
 ['/financial-invoice','/admin','/admin/finance'], ['/financial-invoice','/merchant','/merchant/finance'],
 ['/financial-invoice','/driver','/driver/cash-account'], ['/financial-invoice','/home','/invoice'],
 ['/driver/task-details','/driver','/driver/orders'],
 ['/order-details','/home','/orders'], ['/orders','/home','/home/account'],
 ['/financial-invoice','/application-status','/application-status'], ['/notifications','/admin','/admin']
]) assert.equal(destinations.backDestination(path,account),expected);
async function main(){
 let owner='A',history=false,loading=false,resolve,fail=false,back=0;
 const routes=[],refs=[],stackActions=[];let cursor=0,cleanup;
 const router={canGoBack:()=>history,back:()=>back++,replace:r=>routes.push(r),push:r=>stackActions.push(["push",r]),dismissTo:r=>stackActions.push(["dismissTo",r])};
 const hook=load('src/hooks/useSafeBack.ts',{
  react:{useRef:v=>refs[cursor++]??(refs[cursor-1]={current:v}),useLayoutEffect:fn=>{cleanup=fn();}},
  'expo-router':{useRouter:()=>router,usePathname:()=>'/financial-invoice'},
  '@/context/AuthContext':{useAuth:()=>({user:owner?{id:owner}:null,loading})},
  '@/lib/account-routing':{getAccountRoute:()=>fail?Promise.reject(Error('offline')):new Promise(r=>resolve=r)},
  '@/lib/safe-back':destinations
 });
 const render=()=>{cursor=0;return hook.useSafeBack();};
 let go=render();history=true;await go();assert.equal(back,1);assert.equal(routes.length,0);
 history=false;go=render();let pending=go();resolve('/driver');await pending;assert.equal(routes.pop(),'/driver/cash-account');
 go=render();pending=go();owner='B';render();resolve('/admin');await pending;assert.equal(routes.length,0,'old account must not redirect the new one');
 go=render();pending=go();cleanup();resolve('/merchant');await pending;assert.equal(routes.length,0,'unmounted header must not redirect');
 fail=true;go=render();await go();assert.equal(routes.pop(),'/');
 owner=null;go=render();await go();assert.equal(routes.pop(),'/login');
 owner='B';loading=true;go=render();await go();assert.equal(routes.length,0);
 // Exercise the actual tab component: labels, active state and destination.
 const jsx=(type,props)=>({type,props});let pathname='/driver/cash-account';
 const nav=load('src/components/navigation/AppBottomNav.tsx',{
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'expo-router':{useRouter:()=>router,usePathname:()=>pathname,useGlobalSearchParams:()=>({})},
  'react-native':{Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{create:x=>x}},
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:24})},
  '@/components/ui/AppIcon':{AppIcon:'Icon'},
  '@/constants/theme':{FontSizes:{},Fonts:{},Radius:{},Shadows:{},Spacing:{}},
  '@/context/ThemeContext':{useTheme:()=>({colors:{}})},
  '@/lib/merchant-navigation':{merchantNavigation:()=>({section:'/merchant'})}
 });
 const tabs=()=>nav.AppBottomNav().props.children.props.children;
 let items=tabs();assert.deepEqual(Array.from(items,x=>x.props.accessibilityLabel),['الرئيسية','توصيلاتي','المالية','حسابي']);
 assert.equal(items[2].props.accessibilityState.selected,true);items[2].props.onPress();assert.equal(routes.length,0);
 pathname='/driver';items=tabs();items[2].props.onPress();assert.equal(routes.pop(),'/driver/cash-account');
 for(let repeat=0;repeat<3;repeat++){
   pathname='/home';tabs()[1].props.onPress();
   pathname='/home/search';tabs()[0].props.onPress();
   assert.deepEqual(stackActions.splice(0),[['push','/home/search'],['dismissTo','/home']]);
   assert.equal(routes.length,0,'home/search round trip cannot replace the retained home route');
 }
 // Render the production role gate with controlled account reads (no database).
 let actor='admin-A',roleLoading=false,state=[],stateIndex=0,effect,dispose,accountResolve;
 const Gate=load('src/components/auth/RoleRouteGuard.tsx',{
  react:{useState:v=>{const i=stateIndex++;if(!(i in state))state[i]=v;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},useEffect:fn=>effect=fn},
  'react/jsx-runtime':{jsx,jsxs:jsx},'expo-router':{useRouter:()=>router},
  'react-native':{ActivityIndicator:'Loading',StyleSheet:{create:x=>x},Text:'Text',View:'View'},
  '@/components/ui/AppButton':{AppButton:'Button'},'@/constants/theme':{Fonts:{},FontSizes:{},Spacing:{}},
  '@/context/AuthContext':{useAuth:()=>({user:actor?{id:actor}:null,loading:roleLoading})},
  '@/context/ThemeContext':{useTheme:()=>({colors:{}})},
  '@/lib/account-routing':{getAccountRoute:()=>new Promise(r=>accountResolve=r),getAccountRoutingErrorMessage:()=> 'تعذر التحقق'}
 });
 const renderGate=()=>{stateIndex=0;return Gate.RoleRouteGuard({role:'admin',children:'PRIVATE'});};
 assert.notEqual(renderGate(),'PRIVATE');dispose=effect();accountResolve('/admin');await Promise.resolve();assert.equal(renderGate(),'PRIVATE');
 dispose();actor='customer-B';assert.notEqual(renderGate(),'PRIVATE','account switch immediately hides protected children');dispose=effect();accountResolve('/home');await Promise.resolve();assert.equal(routes.pop(),'/home');assert.notEqual(renderGate(),'PRIVATE');
 dispose();actor='driver-C';renderGate();dispose=effect();dispose();actor='admin-D';renderGate();dispose=effect();accountResolve('/admin');await Promise.resolve();assert.equal(renderGate(),'PRIVATE');
 dispose();actor=null;assert.notEqual(renderGate(),'PRIVATE');dispose=effect();assert.equal(routes.pop(),'/login');
 // Keep route wiring checked together; permission/event behavior is exercised by the notification suites.
 const src=p=>fs.readFileSync(p,'utf8');
 assert.match(src('src/app/_layout.tsx'),/"\/driver\/cash-account"/);
 assert.match(src('src/app/admin/_layout.tsx'),/showNotifications mode="business"/);
 assert.match(src('src/app/merchant/subscription.tsx'),/search:"SUB-"/);
 assert.doesNotMatch(src('src/app/admin/more.tsx'),/title: "عهد السائقين"/);
 console.log('UI-01: destination matrix, real safe-back hook (history/session switch/unmount/failure), actual driver tabs and route wiring passed. Offline; no live RLS or phone claims.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
