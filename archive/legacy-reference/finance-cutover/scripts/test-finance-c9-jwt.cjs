// REAL HTTP JWT tests. OWNER-RUN ONLY; requires a pinned disposable DB + local Auth/PostgREST.
// Never prints tokens or Auth responses; NEVER accepts hosted Supabase endpoints.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {buildConfig}=require('./finance-c2-test-guard.cjs'),{createPsql}=require('./test-finance-c2-postgres.cjs');
function localApiUrl(value){const url=new URL(value);if(url.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('Numeric-loopback HTTP API only');return url;}
async function main(){
 if(process.env.C9_JWT_ALLOW_DISPOSABLE_TEST!=='yes')throw Error('C9 HTTP JWT opt-in required; NO connection attempted');
 const url=localApiUrl(process.env.C9_TEST_API_URL||'');
 if(!path.isAbsolute(process.env.C2_TEST_MANIFEST||''))throw Error('Pinned absolute manifest required');
 const manifest=JSON.parse(fs.readFileSync(process.env.C2_TEST_MANIFEST,'utf8')),config=buildConfig(process.env,manifest),f=config.fixtures,x=manifest.c9Completion,j=manifest.c9Jwt;
 for(const id of [x?.approver,x?.owner,j?.request,j?.noPermissionAdmin])if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id||''))throw Error('Pinned JWT fixture identities required');
 const sql=createPsql(config),roles={ADMIN:[f.admin,'admin'],APPROVER:[x.approver,'admin'],OWNER:[x.owner,'admin'],NO_PERMISSION:[j.noPermissionAdmin,'admin'],DRIVER:[f.driver,'driver'],CUSTOMER:[f.customer,'customer'],MERCHANT:[f.merchantOwner,'merchant']};
 const key=process.env.C9_TEST_ANON_KEY;if(!key)throw Error('Local public API key required');
 for(const name of Object.keys(roles))if(!process.env['C9_TEST_JWT_'+name])throw Error('Local JWT missing for '+name);
 assert.equal(await sql("begin read only;select (select enabled from finance_private.c9_control where singleton) and finance_private.c6_treasury_balance()>=0.01;rollback;"),'t','Local owner must prepare gates/funding before JWT tests');
 const fixture=JSON.parse(await sql(`begin read only;select jsonb_build_object('id',id,'operation_id',operation_id,'requested_by',requested_by,'kind',kind) from public.treasury_finance_requests where id='${j.request}' and requested_by='${f.admin}' and kind='expense';rollback;`));
 async function http(name,route,body,method=body===undefined?'GET':'POST'){
  const response=await fetch(new URL(route,url),{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:'Bearer '+process.env['C9_TEST_JWT_'+name],'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let data;try{data=await response.json();}catch{throw Error('Non-JSON local API response');}return{status:response.status,data};
 }
 // Verify actual Auth user AND public profile role for every token, without decoding/trusting JWT claims locally.
 for(const [name,[id,role]]of Object.entries(roles)){
  const auth=await http(name,'auth/v1/user');assert.equal(auth.status,200,'Local Auth verification failed: '+name);assert.equal(auth.data.id,id);
  const profile=await http(name,`rest/v1/profiles?select=id,role&id=eq.${id}`);assert.equal(profile.status,200);assert.equal(profile.data.length,1);assert.equal(profile.data[0].role,role);
 }
 // Bind the HTTP service to a pre-existing immutable, uniquely identified record in the pinned SQL database.
 const observed=await http('ADMIN',`rest/v1/treasury_finance_requests?select=id,operation_id,requested_by,kind&id=eq.${j.request}`);
 assert.equal(observed.status,200);assert.deepEqual(observed.data,[fixture],'HTTP service does not match pinned database fixture');
 const read=(name,kind='expense',expected=roles[name][0])=>http(name,'rest/v1/rpc/read_treasury_finance',{expected_user:expected,kind_value:kind,page_number:0});
 for(const name of ['DRIVER','CUSTOMER','MERCHANT','NO_PERMISSION']){
  const denied=await read(name);assert.equal(denied.data.code,'42501','Role unexpectedly read treasury: '+name);
  const forged=await read(name,'expense',f.admin);assert.equal(forged.data.code,'42501');
  const rows=await http(name,'rest/v1/treasury_finance_requests?select=id');assert.equal(rows.status,200);assert.deepEqual(rows.data,[],'RLS leaked requests: '+name);
  const direct=await http(name,'rest/v1/treasury_finance_postings',{});assert.equal(direct.data.code,'42501','Direct financial DML not denied');
 }
 const owner=await read('OWNER','opening');assert.equal(owner.status,200);assert.equal(owner.data.permissions.approve,true,'Mapped owner permission required');
 const ordinary=await read('APPROVER','opening');if(ordinary.status===200)assert.equal(ordinary.data.permissions.approve,false,'Admin must not impersonate owner');else assert.equal(ordinary.data.code,'42501');
 const requested=await http('ADMIN','rest/v1/rpc/request_treasury_finance',{expected_user:f.admin,attempt_key:randomUUID(),request_input:{kind:'expense',amount:'0.01',expense_type:'real local JWT fixture',reason:'explicit isolated HTTP test'}});
 assert.equal(requested.status,200);assert.equal(requested.data.stage,'requested');const requestId=requested.data.request_id;
 const act=(name,action,keyValue=randomUUID())=>http(name,'rest/v1/rpc/act_on_treasury_finance',{expected_user:roles[name][0],attempt_key:keyValue,target_request:requestId,action_value:action,action_reason:'isolated HTTP JWT test',owner_confirmed:false});
 const self=await act('ADMIN','approve');assert.equal(self.status,200,'Prepare admin approval permission for adversarial self-approval test');assert.equal(self.data.code,'self_approval');
 const approved=await act('APPROVER','approve');assert.equal(approved.data.stage,'approved');assert.equal(approved.data.posted,false);
 const forbidden=await act('NO_PERMISSION','pay');assert.equal(forbidden.data.code,'42501');
 const payKey=randomUUID(),paid=await act('APPROVER','pay',payKey);assert.equal(paid.data.stage,'posted');assert.match(paid.data.reference,/^PAY-/);
 const recovery=await http('APPROVER','rest/v1/rpc/recover_treasury_action',{expected_user:x.approver,attempt_key:payKey});assert.deepEqual(recovery.data,paid.data);
 const duplicate=await act('APPROVER','pay');assert.equal(duplicate.data.posting_id,paid.data.posting_id);
 assert.equal(await sql(`begin read only;select count(*) from public.treasury_finance_postings where request_id='${requestId}';rollback;`),'1');
 process.stdout.write('Local real Auth JWT / RLS / independent approval / payment recovery checks PASS. Synthetic rows retained.\n');
}
if(require.main===module)main().catch(()=>{process.stderr.write('C9 JWT verification failed; check local prerequisites and role assertions. Tokens/responses suppressed.\n');process.exitCode=1;});
module.exports={main,localApiUrl};
