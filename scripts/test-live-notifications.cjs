// Deterministic production lifecycle/worker tests. No network or device claims.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Promise,Set,Response,Request,AbortSignal,fetch:()=>{throw Error('No network');},...globals});return exports;}
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
async function main(){
 let now=0,serial=0;const timers=new Map();
 const advance=async ms=>{now+=ms;for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn();}await tick();};
 const {startLiveUpdates}=load('src/lib/live-updates.ts',{setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)});
 const channels=[],states=[];let app,reads=0,release,blocked=false;
 const stop=startLiveUpdates({foreground:true,watchApp:fn=>{app=fn;return()=>app=null;},listen:(event,status)=>{const c={event,status,removed:false};channels.push(c);return()=>c.removed=true;},status:s=>states.push(s),refresh:()=>{reads++;if(blocked)return new Promise(r=>release=r);}});
 channels[0].status('SUBSCRIBED');await advance(349);assert.equal(reads,0);await advance(1);assert.equal(reads,1,'first subscription rereads');
 for(let i=0;i<30;i++)channels[0].event();await advance(350);assert.equal(reads,2,'burst collapsed');
 blocked=true;channels[0].event();await advance(350);channels[0].event();channels[0].event();release();await tick();blocked=false;await advance(350);assert.equal(reads,4,'one followup after in-flight events');
 app(false);assert(channels[0].removed);channels[0].status('SUBSCRIBED');channels[0].event();await advance(1000);assert.equal(reads,4);
 app(true);assert.equal(channels.length,2);channels[1].status('SUBSCRIBED');await advance(350);assert.equal(reads,5);
 channels[1].status('CHANNEL_ERROR');assert.equal(states.at(-1),'disconnected');await advance(30000);assert.equal(channels.length,2,'SDK retries must not cause app channel churn');assert.equal(states.at(-1),'disconnected');await advance(30000);assert.equal(channels.length,3);channels[2].status('SUBSCRIBED');await advance(350);assert.equal(reads,6);
 blocked=true;channels[2].event();await advance(350);const oldRelease=release;assert.equal(reads,7);
 app(false);app(true);blocked=false;channels[3].status('SUBSCRIBED');await advance(350);assert.equal(reads,8,'resume cannot be blocked by an old hung read');oldRelease();await tick();
 stop();assert(channels[3].removed);assert.equal(app,null);channels[3].event();await advance(10000);assert.equal(reads,8);assert.equal(timers.size,0);
 const scope=load('src/lib/read-scope.ts').createReadScope();scope.open();const first=scope.begin(),last=scope.begin();assert(!scope.current(first));assert(scope.current(last));scope.close();scope.open();assert(!scope.current(last));
 console.log('PASS first subscribe, batching, in-flight followup, background/resume, reconnect, stale callbacks, cleanup and read generations');
 const driverChannels=[];let driverReads=0,driverApp;
 const startDriver=()=>startLiveUpdates({foreground:true,sdkManagedRecovery:true,
  watchApp:fn=>{driverApp=fn;return()=>{driverApp=null;};},status:()=>{},refresh:()=>{driverReads++;},
  listen:(event,status)=>{const channel={event,status,removed:false};driverChannels.push(channel);return()=>channel.removed=true;}});
 const stopHome=startDriver();driverChannels[0].status('SUBSCRIBED');await advance(350);
 await advance(180000);assert.equal(driverChannels.length,1);assert.equal(driverReads,1);
 driverChannels[0].status('CHANNEL_ERROR');driverChannels[0].status('TIMED_OUT');await advance(180000);
 assert.equal(driverChannels.length,1,'driver recovery leaves rejoin to SDK');assert.equal(driverReads,1);
 driverChannels[0].status('SUBSCRIBED');driverChannels[0].status('SUBSCRIBED');await advance(350);assert.equal(driverReads,2);
 stopHome();const stopOrders=startDriver();assert(driverChannels[0].removed);
 driverChannels[0].event();driverChannels[1].status('SUBSCRIBED');await advance(350);assert.equal(driverReads,3);
 driverChannels[1].status('CLOSED');await advance(5000);assert(driverChannels[1].removed);
 driverChannels[2].status('CLOSED');await advance(180000);assert.equal(driverChannels.length,3,'terminal close cannot create a replacement loop');
 driverApp(false);driverApp(true);driverChannels[3].status('SUBSCRIBED');await advance(350);
 assert.equal(driverReads,4);stopOrders();assert.equal(timers.size,0);
 console.log('PASS driver idle, SDK recovery, tab handoff, bounded terminal replacement and foreground recovery');
 const route=load('src/lib/notification-routing.ts').resolveNotificationDestination,id='12345678-1234-1234-1234-123456789012';
 assert.equal(route('merchant',{storeOrderId:id}).storeOrderId,id);assert.equal(route('driver',{deliveryTaskId:id}).taskId,id);
 assert.equal(route('admin',{orderId:id}).type,'admin-order');assert.equal(route('customer',{invoiceId:id}).invoiceId,id);
 assert.equal(route('driver',{route:'https://external.invalid/driver/orders',orderId:id}).type,'none');
 assert.equal(route('merchant',{route:'/admin',deliveryTaskId:id}).type,'none');
 console.log('PASS role-bound invoice/order/task targets and arbitrary-link rejection');
 const {createPushDispatcher}=load('supabase/functions/push-dispatch/handler.ts');
 const finish=[],sent=[];let claims=0;
 const deliveries=[{id:'one',notification_id:'n1',lease:'l1',token:'secret-token',ticket:null},{id:'two',notification_id:'n2',lease:'l2',token:'secret-token',ticket:'receipt'},{id:'three',notification_id:'n3',lease:'l3',token:'secret-token',ticket:null},{id:'four',notification_id:'n4',lease:'l4',token:'secret-token',ticket:'missing'},{id:'five',notification_id:'n5',lease:'l5',token:'old-account-token',ticket:null}];
 const fake=async(url,options)=>{const b=JSON.parse(options.body);if(url.endsWith('reconcile_push_deliveries'))return new Response(null,{status:204});if(url.endsWith('authorize_push_delivery'))return Response.json(b.delivery_value!=='five');if(url.endsWith('claim_push_deliveries')){claims++;return Response.json(deliveries);}if(url.endsWith('finish_push_delivery')){finish.push(b);return new Response(null,{status:204});}if(url.endsWith('/getReceipts'))return Response.json({data:b.ids[0]==='receipt'?{receipt:{status:'ok'}}:{}});sent.push(b);return Response.json({data:b.data.notificationId==='n3'?{status:'error',details:{error:'DeviceNotRegistered'}}:{status:'ok',id:'ticket1'}});};
 const handler=createPushDispatcher({url:'https://example.invalid',serviceKey:'server-only',dispatchSecret:'dispatch'},fake);
 assert.equal((await handler(new Request('https://worker.invalid',{method:'POST'}))).status,401);assert.equal(claims,0);
 const result=await handler(new Request('https://worker.invalid',{method:'POST',headers:{Authorization:'Bearer dispatch'}}));assert.equal(result.status,200);
 const outcome=id=>finish.find(x=>x.delivery_value===id).result_kind;
 assert.equal(outcome('one'),'ticket');assert.equal(outcome('two'),'sent');assert.equal(outcome('three'),'device_gone');assert.equal(outcome('four'),'retry');assert.equal(outcome('five'),'dead');
 assert.equal(sent.length,2,'receipts are polled, not resent');assert.equal(Object.keys(sent[0].data).join(','),'notificationId');assert.equal(sent[0].collapseId,'n1');assert(!JSON.stringify(sent[0]).includes('amount'));
 const start=finish.length;
 const offline=createPushDispatcher({url:'https://example.invalid',serviceKey:'server-only',dispatchSecret:'dispatch'},async(url,options)=>{if(url.endsWith('/send'))throw Error('private-token-transport-failure');return fake(url,options);});
 assert.equal((await offline(new Request('https://worker.invalid',{method:'POST',headers:{Authorization:'Bearer dispatch'}}))).status,200);
 const retries=finish.slice(start).filter(v=>v.delivery_value==='one'||v.delivery_value==='three');assert(retries.every(v=>v.result_kind==='retry'&&v.error_value==='TransportUnavailable'));assert(!JSON.stringify(finish).includes('private-token-transport-failure'));
 console.log('PASS worker authorization, generic payload, tickets/receipts, unknown receipt retry, stale-device suppression, transport failure and sanitized errors');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
