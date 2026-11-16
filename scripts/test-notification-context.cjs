// Executes the actual provider with minimal React/query adapters. No Auth server/network.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let owner='first',cursor=0,cells=[],effects=[],cleanup=[],updates=0;
const react={createContext:()=>({Provider:'Provider'}),useContext:()=>null,useCallback:fn=>fn,useMemo:fn=>fn(),
 useState(initial){const i=cursor++;if(!cells[i])cells[i]={value:initial};const target=cells[i];return[target.value,next=>{updates++;target.value=typeof next==='function'?next(target.value):next;}];},
 useRef(value){const i=cursor++;return cells[i]??(cells[i]={current:value});},useEffect(fn){effects.push(fn);}};
const requests=[];
const client={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from:()=>{
 const options={order:[]};const query={select:(columns,opts)=>{options.count=!!opts?.head;return query;},eq:(key,value)=>{if(key==='user_id')options.owner=value;return query;},order:(column,opts)=>{options.order.push([column,opts.ascending]);return query;},limit:value=>{options.limit=value;return query;},or:value=>{options.cursor=value;return query;},is:()=>query,then:(resolve,reject)=>new Promise(r=>requests.push({...options,resolve:r})).then(resolve,reject)};return query;
}};
const inbox={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/notification-inbox.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:inbox,Date});
const mocks={'react':react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'@/context/AuthContext':{useAuth:()=>({user:{id:owner}})},'@/hooks/usePushRegistration':{usePushRegistration:()=>({pushMessage:'',pushReady:false,pushBusy:false,enablePush:async()=>{}})},'@/hooks/useLiveUpdates':{useLiveUpdates:()=> 'live'},'@/lib/supabase':{supabase:client}};
mocks['@/lib/notification-inbox']=inbox;
const exportsValue={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/context/NotificationContext.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:exportsValue,require:n=>{assert(n in mocks,n);return mocks[n];},setTimeout:()=>0,clearTimeout:()=>{},Date,Promise,Error});
const render=()=>{cursor=0;const wrapper=exportsValue.NotificationProvider({children:'child'});return wrapper.type(wrapper.props).props.value;};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const answer=(start,name,count)=>{requests[start].resolve({data:[{id:name,type:'system',title:name,body:'',data:{route:5,invoiceId:'invoice',event:'invoice-INV'},read_at:null,created_at:'2026-01-01'}],error:null});requests[start+1].resolve({count,error:null});};
async function main(){
 let value=render();assert.equal(value.initialLoading,true);cleanup=effects.map(fn=>fn()).filter(Boolean);effects=[];
 const old=value.refresh();await tick();const fresh=value.refresh();await tick();
 answer(2,'fresh',151);await fresh;value=render();assert.equal(value.initialLoading,false);assert.equal(value.notifications[0].id,'fresh');assert.equal(value.unreadCount,151,'count is independent of capped list');assert.equal(value.notifications[0].data.route,undefined,'invalid payload fields removed');assert.equal(value.notifications[0].data.event,'invoice-INV');
 answer(0,'stale',1);await old;value=render();assert.equal(value.notifications[0].id,'fresh');assert.equal(value.unreadCount,151);
 const late=value.refresh();await tick();cleanup.forEach(fn=>fn());const before=updates;
 owner='second';cells=[];effects=[];value=render();effects.forEach(fn=>fn());assert.equal(value.notifications.length,0);assert.equal(value.unreadCount,0);
 answer(4,'first-private',777);await late;assert.equal(updates,before,'unmounted account cannot commit a delayed response');
 const next=value.refresh();await tick();assert.equal(requests[6].owner,'second');assert.equal(requests[7].owner,'second');answer(6,'second-only',3);await next;value=render();assert.equal(value.notifications[0].id,'second-only');assert.equal(value.unreadCount,3);
 const row=id=>({id:String(id).padStart(3,'0'),type:'order',title:'طلب',body:'',data:null,read_at:null,created_at:'2026-01-01T12:00:00.123456+00:00'});
 const rows=(start,count)=>Array.from({length:count},(_,i)=>row(start-i));
 owner='third';cells=[];effects=[];value=render();effects.forEach(fn=>fn());
 const initial=value.refresh();await tick();
 assert.equal(requests[8].limit,16);
 assert.deepEqual(requests[8].order,[['created_at',false],['id',false]]);
 requests[8].resolve({data:rows(99,16),error:null});requests[9].resolve({count:150,error:null});await initial;
 value=render();assert.equal(value.notifications.length,15);assert.equal(value.unreadCount,150);
 const failed=value.loadMore();await value.loadMore();await tick();assert.equal(requests.length,11);
 assert.match(requests[10].cursor,/created_at\.eq\..*123456.*id\.lt\.085/);
 requests[10].resolve({error:{code:'502'}});await failed;value=render();assert.equal(value.pageError,true);
 assert.equal(value.notifications.length,15);await value.loadMore();assert.equal(requests.length,11);
 const retry=value.loadMore(true);await tick();requests[11].resolve({data:rows(84,15),error:null});await retry;
 value=render();assert.equal(value.notifications.length,30);await value.loadMore();assert.equal(requests.length,12);
 const live=value.refresh();await tick();requests[12].resolve({data:rows(100,16),error:null});requests[13].resolve({count:151,error:null});await tick();
 requests[14].resolve({data:rows(85,16),error:null});await tick();requests[15].resolve({data:[row(70)],error:null});await live;
 value=render();assert.equal(value.notifications.length,31);assert.equal(value.unreadCount,151);assert.equal(value.notifications.at(-1).id,'070');
 assert.equal(new Set(value.notifications.map(item=>item.id)).size,31);

 const local = new Date(2026, 10, 17, 0, 30);
 const at=(day,hour,minute)=>({id:`${day}-${hour}-${minute}`,createdAt:new Date(2026,10,day,hour,minute).toISOString()});
 const grouped=inbox.groupNotifications([at(17,0,20),at(16,23,50),at(16,23,30),at(15,10,0)],+local);
 assert.equal(grouped.map(s=>s.title).join(','),'آخر ساعة,أمس,الأقدم');
 assert.equal(grouped[0].data.length,2);assert.equal(grouped[1].data.length,1);
 assert.equal(inbox.nextNotificationGroupChange([at(16,23,50)],+local),+new Date(2026,10,17,0,50));
 assert.equal(inbox.groupNotifications([at(17,9,0)],+new Date(2026,10,17,13))[0].title,'اليوم');
 assert.equal(inbox.groupNotifications([at(17,9,0)],+new Date(2026,10,18,0))[0].title,'أمس');
 console.log('PASS inbox: keyset order, 15 rows, lock, retry, end, realtime refresh, count, account isolation and local time groups');
}
const timeout=setTimeout(()=>{console.error('Inbox test did not finish');process.exit(1);},3000);
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(timeout));
