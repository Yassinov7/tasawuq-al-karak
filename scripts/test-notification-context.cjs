// Executes the actual provider with minimal React/query adapters. No Auth server/network.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let owner='first',cursor=0,cells=[],effects=[],cleanup=[],updates=0;
const react={createContext:()=>({Provider:'Provider'}),useContext:()=>null,useCallback:fn=>fn,useMemo:fn=>fn(),
 useState(initial){const i=cursor++;if(!cells[i])cells[i]={value:initial};const target=cells[i];return[target.value,next=>{updates++;target.value=typeof next==='function'?next(target.value):next;}];},
 useRef(value){const i=cursor++;return cells[i]??(cells[i]={current:value});},useEffect(fn){effects.push(fn);}};
const requests=[];
const client={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from:()=>{
 const options={};const query={select:(columns,opts)=>{options.count=!!opts?.head;return query;},eq:(key,value)=>{if(key==='user_id')options.owner=value;return query;},order:()=>query,limit:()=>query,is:()=>query,then:(resolve,reject)=>new Promise(r=>requests.push({...options,resolve:r})).then(resolve,reject)};return query;
}};
const mocks={'react':react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'@/context/AuthContext':{useAuth:()=>({user:{id:owner}})},'@/hooks/usePushRegistration':{usePushRegistration:()=>({pushMessage:'',pushReady:false,pushBusy:false,enablePush:async()=>{}})},'@/hooks/useLiveUpdates':{useLiveUpdates:()=> 'live'},'@/lib/supabase':{supabase:client}};
const exportsValue={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/context/NotificationContext.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:exportsValue,require:n=>{assert(n in mocks,n);return mocks[n];},setTimeout:()=>0,clearTimeout:()=>{},Date,Promise,Error});
const render=()=>{cursor=0;const wrapper=exportsValue.NotificationProvider({children:'child'});return wrapper.type(wrapper.props).props.value;};
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const answer=(start,name,count)=>{requests[start].resolve({data:[{id:name,type:'system',title:name,body:'',data:{route:5,invoiceId:'invoice'},read_at:null,created_at:'2026-01-01'}],error:null});requests[start+1].resolve({count,error:null});};
async function main(){
 let value=render();cleanup=effects.map(fn=>fn()).filter(Boolean);effects=[];
 const old=value.refresh();await tick();const fresh=value.refresh();await tick();
 answer(2,'fresh',151);await fresh;value=render();assert.equal(value.notifications[0].id,'fresh');assert.equal(value.unreadCount,151,'count is independent of capped list');assert.equal(value.notifications[0].data.route,undefined,'invalid payload fields removed');
 answer(0,'stale',1);await old;value=render();assert.equal(value.notifications[0].id,'fresh');assert.equal(value.unreadCount,151);
 const late=value.refresh();await tick();cleanup.forEach(fn=>fn());const before=updates;
 owner='second';cells=[];effects=[];value=render();effects.forEach(fn=>fn());assert.equal(value.notifications.length,0);assert.equal(value.unreadCount,0);
 answer(4,'first-private',777);await late;assert.equal(updates,before,'unmounted account cannot commit a delayed response');
 const next=value.refresh();await tick();assert.equal(requests[6].owner,'second');assert.equal(requests[7].owner,'second');answer(6,'second-only',3);await next;value=render();assert.equal(value.notifications[0].id,'second-only');assert.equal(value.unreadCount,3);
 console.log('PASS actual NotificationContext: out-of-order reads, exact unread count over 100, payload validation, owner switch and late response isolation');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
