// OWNER-RUN real local Auth/JWT. Reuses C9's pinned-DB binding and role checks; never hosted APIs.
const fs=require('node:fs'),assert=require('node:assert/strict');
const c9=require('./test-finance-c9-jwt.cjs');
async function main(){
 if(process.env.C10_JWT_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C10 JWT opt-in required; NO connection attempted');
 // C9 independently requires its own opt-in, loopback URL, pinned manifest/psql and valid real tokens.
 await c9.main();
 const url=c9.localApiUrl(process.env.C9_TEST_API_URL),m=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8'));
 const roles={ADMIN:m.fixtures.admin,APPROVER:m.c9Completion.approver,OWNER:m.c9Completion.owner,NO_PERMISSION:m.c9Jwt.noPermissionAdmin,DRIVER:m.fixtures.driver,CUSTOMER:m.fixtures.customer,MERCHANT:m.fixtures.merchantOwner};
 async function read(role,expected){const r=await fetch(new URL('rest/v1/rpc/read_financial_reconciliation',url),{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:process.env.C9_TEST_ANON_KEY,Authorization:'Bearer '+process.env['C9_TEST_JWT_'+role],'Content-Type':'application/json'},body:JSON.stringify({expected_user:expected,page_number:0,scope_value:'all'})});return{status:r.status,data:await r.json()};}
 const allowed=await read('ADMIN',roles.ADMIN);assert.equal(allowed.status,200,'Fixture ADMIN must have explicit c10 may_reconcile');assert.equal(allowed.data.read_only,true);
 for(const [role,id]of Object.entries(roles).filter(([role])=>role!=='ADMIN')){const denied=await read(role,id);assert.equal(denied.data.code,'42501','Unexpected reconciliation authority: '+role);const forged=await read(role,roles.ADMIN);assert.equal(forged.data.code,'42501');}
 console.log('C10 real local JWT reconciliation permission and expected-user checks PASS. SQL concurrency/device proofs remain separate.');
}
if(require.main===module)main().catch(()=>{console.error('C10 real JWT checks failed; prerequisites/assertions require owner review. Tokens/responses suppressed.');process.exitCode=1;});
module.exports={main};
