// Actual device service with Expo/Auth/storage adapters. No native device or network calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let actor='owner',granted=true,asks=0,tokenResolve,tokenPending=false,current=true,go=false;const calls=[];
const mocks={
 '@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async()=> '12345678-1234-1234-1234-123456789012',setItem:async()=>{throw Error('unexpected storage change');}}},
 expo:{isRunningInExpoGo:()=>go},'expo-constants':{__esModule:true,default:{easConfig:{projectId:'project'}}},'expo-device':{isDevice:true},'react-native':{Platform:{OS:'android'}},
 '@/lib/request-key':{newIdempotencyKey:()=>{throw Error('unexpected new install');}},
 '@/lib/supabase':{supabase:{auth:{getUser:async()=>({data:{user:actor?{id:actor}:null},error:null})},rpc:async(name,args)=>{calls.push({name,args});return{error:null};}}},
 '@/lib/financial-transport':{createFinancialTransport:api=>api.rpc},
 'expo-notifications':{AndroidImportance:{HIGH:4},AndroidNotificationVisibility:{PRIVATE:0},setNotificationChannelAsync:async()=>{},getPermissionsAsync:async()=>({granted,canAskAgain:true}),requestPermissionsAsync:async()=>{asks++;return{granted,canAskAgain:true};},getExpoPushTokenAsync:async()=>tokenPending?new Promise(resolve=>tokenResolve=resolve):{data:'ExpoPushToken[synthetic]'}},
};
const exportsValue={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/push-device.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsValue,Promise,Error,setTimeout,clearTimeout,require:n=>{assert(n in mocks,n);return mocks[n];}});
async function tick(){for(let i=0;i<14;i++)await Promise.resolve();}
async function main(){
 await exportsValue.registerPushDevice('owner',false,()=>current);assert.equal(asks,0);assert.equal(calls[0].name,'register_push_device');assert.equal(calls[0].args.expected_user,'owner');
 granted=false;await exportsValue.registerPushDevice('owner',false,()=>current);assert.equal(asks,0);assert.equal(calls.at(-1).name,'disable_push_device');await exportsValue.registerPushDevice('owner',true,()=>current);assert.equal(asks,1);
 granted=true;tokenPending=true;const before=calls.length,pending=exportsValue.registerPushDevice('owner',false,()=>current);await tick();current=false;actor='other';tokenResolve({data:'ExpoPushToken[old-account]'});await assert.rejects(pending);assert.equal(calls.length,before,'late token cannot register a changed account');
 current=true;actor='owner';go=true;const unavailable=await exportsValue.registerPushDevice('owner',true);assert.equal(unavailable.ready,false);assert.equal(calls.length,before,'Expo Go never touches native Push registration');
 console.log('PASS device registration: no automatic permission prompt, explicit prompt, revoked permission disables device, stale token/account cancellation and Expo Go gate');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
