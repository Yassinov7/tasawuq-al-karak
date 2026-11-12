const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const id='12345678-1234-1234-1234-123456789012';
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Promise,Error,require:n=>{assert(n in mocks,n);return mocks[n];}});return exports;}
const routing=load('src/lib/notification-routing.ts');
let actor='owner',role='customer',payload={orderId:id},visible=true,target=true,network=false,afterTarget=()=>{},marked=0;const queries=[];
const client={auth:{getUser:async()=>({data:{user:actor?{id:actor}:null},error:null})},from:table=>{
 const filters=[];let writing=false;const q={select:()=>q,eq:(key,value)=>{filters.push([key,value]);return q;},update:()=>{writing=true;return q;},maybeSingle:execute,then:(yes,no)=>execute().then(yes,no)};
 async function execute(){queries.push({table,filters,writing});if(writing){assert.equal(table,'notifications');assert(filters.some(([k,v])=>k==='user_id'&&v==='owner'));marked++;return{error:null};}if(table==='notifications')return{data:visible?{data:payload}:null,error:network?{message:'network'}:null};if(table==='profiles')return{data:{role},error:null};afterTarget();return{data:target?{id}:null,error:null};}return q;
}};
const m=load('src/lib/notification-opening.ts',{'@/lib/supabase':{supabase:client},'@/lib/account-routing':{isAccountRole:r=>['customer','merchant','driver','admin'].includes(r)},'@/lib/notification-routing':routing,'@/context/NotificationContext':{parseNotificationData:value=>value}});
const reset=()=>{actor='owner';role='customer';payload={orderId:id};visible=true;target=true;network=false;afterTarget=()=>{};marked=0;queries.length=0;};
async function main(){
 let href=await m.openOwnedNotification('owner',id,()=>true);assert.equal(href.pathname,'/order-details');assert.equal(marked,1);assert(queries.find(q=>q.table==='customer_orders').filters.some(([k,v])=>k==='customer_id'&&v==='owner'));
 for(const test of [()=>visible=false,()=>target=false,()=>actor=null,()=>network=true,()=>afterTarget=()=>actor='other']){reset();test();await assert.rejects(m.openOwnedNotification('owner',id,()=>true));assert.equal(marked,0,'unowned/expired/stale targets never mark or navigate');}
 reset();role='driver';payload={deliveryTaskId:id,route:'/driver/orders'};href=await m.openOwnedNotification('owner',id,()=>true);assert.equal(href.pathname,'/driver/task-details');assert(queries.find(q=>q.table==='delivery_tasks').filters.some(([k,v])=>k==='driver_id'&&v==='owner'));
 reset();role='driver';payload={deliveryTaskId:id,route:'/driver'};href=await m.openOwnedNotification('owner',id,()=>true);assert.equal(href.pathname,'/driver');assert.equal(href.params.taskId,id);assert(queries.find(q=>q.table==='delivery_tasks').filters.some(([k,v])=>k==='status'&&v==='available'));
 reset();role='admin';payload={applicationId:id,applicationRole:'merchant'};href=await m.openOwnedNotification('owner',id,()=>true);assert.equal(href.pathname,'/admin/application-details');assert.equal(href.params.applicationId,id);
 reset();payload={route:'https://external.invalid',invoiceId:'malformed'};await assert.rejects(m.openOwnedNotification('owner',id,()=>true));assert.equal(marked,0);
 console.log('PASS shared in-app/Push opener: owned row, target permission read, customer/driver binding, available task/admin application deep link, expired session, account-switch and external URL denial. Mocked adapters only.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

