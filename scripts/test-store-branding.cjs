const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let tests=0;function check(name,fn){fn();tests++;console.log('PASS',name);}
function harness(persisted){
 let owner='owner',row=null,fail=null,uploads=0,publishes=0;const storage=persisted||new Map();
 const transpile=(file,req)=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Set,Date,Number,JSON,Uint8Array,String,AbortController,setTimeout,clearTimeout,process:{env:{EXPO_PUBLIC_SUPABASE_URL:'https://invalid',EXPO_PUBLIC_SUPABASE_KEY:'test'}},require:req,fetch:async(url,options)=>{
  const body=options.body?JSON.parse(options.body):null;
  if(url.includes('register_store_branding')){row??={id:'id',store_id:'store',storage_path:'store/logo/id.png',state:'registered',is_current:false,kind:body.asset_kind,mime_type:body.asset_mime,byte_size:body.asset_bytes};if(fail==='register'){fail=null;throw Error('timeout');}return {ok:true,status:200,json:async()=>row};}
  if(url.includes('unpublish_store_branding')){row={...row,is_current:false,state:'retired'};if(fail==='unpublish'){fail=null;throw Error('timeout');}return {ok:true,status:204,json:async()=>null};}
  if(url.includes('publish_store_branding')){publishes++;if(fail==='publish-denied')return {ok:false,status:409,json:async()=>({})};row={...row,is_current:true,state:'current'};if(fail==='publish'){fail=null;throw Error('timeout');}return {ok:true,status:200,json:async()=>row};}
  if(fail==='switch'){owner='other';fail=null;}
  return {ok:true,status:200,json:async()=>{if(fail==='json-switch'){owner='other';fail=null;}return row?[row]:[];}};
 }});return exports;};
 const contract=transpile('src/lib/store-branding-contract.ts',()=>{});
 const api=transpile('src/lib/store-branding.ts',name=>{
  if(name.includes('contract'))return contract;
  if(name.includes('async-storage'))return {__esModule:true,default:{getItem:async k=>storage.get(k)||null,setItem:async(k,v)=>storage.set(k,v),removeItem:async k=>storage.delete(k)}};
  return {supabase:{auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'x'}},error:null})},storage:{from:bucket=>{assert.ok(['store-logos','store-videos'].includes(bucket));return ({upload:async()=>{uploads++;return {error:fail==='upload'?Error('lost reply'):null};},createSignedUrl:async()=>({data:{signedUrl:'temporary'},error:null})});}}}};
 });
 return {api,storage,get row(){return row;},set row(v){row=v;},get uploads(){return uploads;},get publishes(){return publishes;},fail:v=>fail=v};
}
async function main(){
 const a={owner:'owner',id:'id',store:'store',kind:'logo',mime:'image/png',size:100,expectedCurrent:null};
 let h=harness();await h.api.registerBranding(a);assert.equal((await h.api.resumeBrandingAttempt('store')).attempt.id,'id');tests++;
 const bytes=new Uint8Array(100);bytes.set([137,80,78,71,13,10,26,10]);await h.api.uploadBranding(a,bytes.buffer);await assert.rejects(h.api.uploadBranding(a,bytes.buffer));assert.equal(h.uploads,1);tests++;
 h.fail('publish');await h.api.publishBranding(a);assert.equal(h.publishes,1);assert.equal(h.storage.size,0);tests++;
 const link=await h.api.brandingDisplayUrl(h.row);assert.ok(link.expiresAt>Date.now());tests++;
 await h.api.unpublishBranding(a.owner,a.id);assert.equal(h.row.state,'retired');tests++;
 h=harness();await h.api.registerBranding(a);h.fail('upload');await assert.rejects(h.api.uploadBranding(a,bytes.buffer));assert.equal(h.row.is_current,false);const restarted=harness(h.storage);restarted.row=h.row;await assert.rejects(restarted.api.uploadBranding(a,bytes.buffer));assert.equal(restarted.uploads,0);tests++;
 h.fail('switch');await assert.rejects(h.api.readBrandingAttempt(a));tests++;
 h=harness();const first=h.api.registerBranding(a);await assert.rejects(h.api.registerBranding(a));await first;tests++;
 await assert.rejects(h.api.resumeBrandingAttempt('other-store'));tests++;
 h=harness();await h.api.registerBranding({...a,signedUrl:'secret-link'});assert.ok(![...h.storage.values()][0].includes('secret-link'));tests++;
 const contract={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/store-branding-contract.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:contract,Uint8Array});
 for(const [kind,mime,size] of [['logo','image/png',4194304],['promo_video','video/mp4',52428800]]){contract.validateBrandingInput(kind,mime,size);assert.throws(()=>contract.validateBrandingInput(kind,mime,size+1));tests++;}
 assert.throws(()=>contract.validateBrandingInput('logo','video/mp4',100));assert.throws(()=>contract.checkBrandingSignature('image/png',new Uint8Array(20).buffer));tests++;
 h=harness();await h.api.registerBranding({...a,kind:'promo_video',mime:'video/mp4'});tests++;
 const mp4=new Uint8Array(100);mp4.set([102,116,121,112],4);mp4.set([105,115,111,109],8);await h.api.uploadBranding({...a,kind:'promo_video',mime:'video/mp4'},mp4.buffer);assert.equal(h.uploads,1);tests++;
 h=harness();await h.api.registerBranding(a);h.fail('publish-denied');await assert.rejects(h.api.publishBranding(a));assert.equal(h.row.is_current,false);tests++;
 const sql=fs.readFileSync('supabase/migrations/20261102000100_store_branding.sql','utf8');assert.ok(sql.includes('for update'));assert.ok(sql.includes('is distinct from expected_current'));assert.ok(sql.includes('branding_no_update'));assert.ok(sql.includes('branding_no_delete'));assert.ok(!sql.includes('complete_store_branding_verification'));assert.ok(!sql.includes('valid'));tests++;
 h=harness();await h.api.registerBranding(a);h.row=null;await h.api.cancelBrandingAttempt(a);assert.equal(h.storage.size,0);tests++;
 h=harness();await h.api.registerBranding(a);h.fail('unpublish');await h.api.unpublishBranding(a.owner,a.id);assert.equal(h.row.state,'retired');tests++;
 console.log(tests+' native branding offline checks passed. Actual PostgreSQL/RLS/Storage NOT VERIFIED.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
