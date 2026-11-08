// REAL local JWT only. Uses C9's existing Auth/DB binding. No hosted endpoints allowed.
const fs=require('node:fs'),assert=require('node:assert/strict'),c9=require('./test-finance-c9-jwt.cjs');
async function main(){
 if(process.env.C11_JWT_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C11 JWT opt-in required; NO connection attempted');
 await c9.main(); // Independent opt-in, pinned identity, actual Auth IDs and profile roles.
 const m=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8')),url=c9.localApiUrl(process.env.C9_TEST_API_URL);
 const roles={ADMIN:m.fixtures.admin,NO_PERMISSION:m.c9Jwt.noPermissionAdmin,CUSTOMER:m.fixtures.customer,MERCHANT:m.fixtures.merchantOwner,DRIVER:m.fixtures.driver};
 async function rpc(role,name,args){const r=await fetch(new URL('rest/v1/rpc/'+name,url),{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:process.env.C9_TEST_ANON_KEY,Authorization:'Bearer '+process.env['C9_TEST_JWT_'+role],'Content-Type':'application/json'},body:JSON.stringify(args)});return{status:r.status,data:await r.json()};}
 const read=await rpc('ADMIN','read_finance_transition',{expected_user:roles.ADMIN,page_number:0});assert.equal(read.status,200);assert.equal(read.data.balances_combined,false);
 for(const [role,id] of Object.entries(roles).filter(([role])=>role!=='ADMIN')){
  for(const expected of [id,roles.ADMIN]){
   assert.equal((await rpc(role,'read_finance_transition',{expected_user:expected})).data.code,'42501');
   assert.equal((await rpc(role,'set_finance_transition_gate',{expected_user:expected,path_value:'new_orders',enabled_value:true,change_reason:'must be denied real JWT attempt'})).data.code,'42501');
  }
 }
 console.log('C11 actual local JWT read/control and expected-user denials PASS. No production connection.');
}
if(require.main===module)main().catch(()=>{console.error(process.env.C11_JWT_ALLOW_DISPOSABLE_TEST!=='yes'?'C11 JWT opt-in required; NO connection attempted':'C11 local JWT prerequisites/assertions failed; tokens and responses suppressed.');process.exitCode=1;});module.exports={main};
