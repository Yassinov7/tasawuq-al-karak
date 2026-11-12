// Actual native bridge lifecycle with a fake OS response API; not a device delivery test.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const effects=[],routes=[],alerts=[];let tap,resume,last,opened=0,network=false,resolveLate,late=false,removed=0;
class OpenError extends Error{constructor(reason){super(reason);this.reason=reason;}}
const response=id=>({notification:{request:{content:{data:{notificationId:id}}}}});last=response('first');
const native={setBadgeCountAsync:async()=>{},setNotificationHandler:()=>{},getLastNotificationResponse:()=>last,clearLastNotificationResponse:()=>last=null,addNotificationReceivedListener:()=>({remove:()=>removed++}),addNotificationResponseReceivedListener:fn=>{tap=fn;return{remove:()=>removed++};}};
const mocks={react:{useEffect:fn=>effects.push(fn)},'expo-router':{useRouter:()=>({push:href=>routes.push(href)})},'react-native':{AppState:{addEventListener:(_,fn)=>{resume=fn;return{remove:()=>removed++};}}},'@/context/AuthContext':{useAuth:()=>({user:{id:'owner'}})},'@/context/NotificationContext':{useNotifications:()=>({refresh:async()=>{},unreadCount:2})},'@/context/AppDialogContext':{useAppDialog:()=>({alert:(...args)=>alerts.push(args)})},'@/lib/push-device':{pushUnavailableReason:()=>null},'expo-notifications':native,'@/lib/notification-opening':{NotificationOpenError:OpenError,openOwnedNotification:async(owner,id)=>{assert.equal(owner,'owner');opened++;if(network)throw new OpenError('network');if(late)return new Promise(r=>resolveLate=r);return{pathname:'/order-details',params:{id}};}}};
const result={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/notifications/PushBridge.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:result,Promise,Set,Error,require:n=>{assert(n in mocks,n);return mocks[n];}});
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
async function main(){
 result.PushBridge();const cleanup=effects.map(fn=>fn()).filter(Boolean);await tick();assert.equal(routes.length,1);assert.equal(last,null);tap(response('first'));await tick();assert.equal(opened,1,'cold/live duplicate cannot navigate twice');
 network=true;last=response('retry');tap(last);await tick();assert.equal(routes.length,1);assert(last,'network failure retains cold response');assert.equal(alerts.length,1);
 network=false;resume('active');await tick();assert.equal(routes.length,2);assert.equal(last,null);
 late=true;last=response('late-account');tap(last);await tick();cleanup.forEach(fn=>fn());resolveLate('/admin');await tick();assert.equal(routes.length,2,'late old-account response never navigates');assert.equal(removed,3);
 console.log('PASS native bridge adapters: cold tap, duplicate tap suppression, transient error retry on resume, and late result/listener cleanup after logout');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
