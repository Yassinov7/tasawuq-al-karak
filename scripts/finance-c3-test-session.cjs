// Persistent LOCAL test connection. Identity must ACK before any test SQL is sent.
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {identityAssertion}=require('./finance-c2-test-guard.cjs');
async function openSession(config,launch=spawn){
 const child=launch(config.psqlPath,config.args,{env:config.env,windowsHide:true,shell:false});
 let buffer='',errors='',pending=null,closed=false;
 const lifetime=setTimeout(()=>child.kill(),30000);
 child.stdout.on('data',chunk=>{buffer+=chunk;drain();});
 child.stderr.on('data',chunk=>{errors+=chunk;});
 child.once('error',error=>fail(error));
 child.once('close',code=>{closed=true;clearTimeout(lifetime);fail(new Error(errors||`psql closed (${code})`));});
 function fail(error){if(pending){clearTimeout(pending.timer);const reject=pending.reject;pending=null;reject(error);}}
 function drain(){if(!pending)return;const lines=buffer.split(/\r?\n/);const end=lines.findIndex(line=>line===pending.marker);if(end<0)return;const result=lines.slice(0,end).join('\n').trim();buffer=lines.slice(end+1).join('\n');const resolve=pending.resolve;clearTimeout(pending.timer);pending=null;resolve(result);}
 function run(statement){
  if(closed||pending)return Promise.reject(new Error('Session closed or busy'));
  return new Promise((resolve,reject)=>{const marker=`C3_ACK_${randomUUID().replaceAll('-','')}`;
   pending={marker,resolve,reject,timer:setTimeout(()=>{fail(new Error('session ACK timeout'));child.kill();},12000)};
   child.stdin.write(statement+`\n\\echo ${marker}\n`);
  });
 }
 try{
  await run(identityAssertion(config));
  const pid=Number(await run('select pg_backend_pid();'));
  if(!Number.isSafeInteger(pid)||pid<=0)throw new Error('Unverified backend PID');
  return{pid,run,close(){if(!closed)child.stdin.end();},abort(){child.kill();}};
 }catch(error){child.kill();throw error;}
}
async function overlap(config,observer,firstStatement,secondStatement,expectedFailure){
 const first=await openSession(config),second=await openSession(config);
 let outcome;
 try{
  await first.run(`begin; set local lock_timeout='8s'; set local statement_timeout='10s'; ${firstStatement}`);
  outcome=second.run(`begin; set local lock_timeout='8s'; set local statement_timeout='10s'; ${secondStatement} commit;`).then(value=>({ok:true,value}),error=>({ok:false,error}));
  let blocked=false;
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){
   const seen=await observer(`begin read only; select exists(select 1 from pg_stat_activity where pid=${second.pid} and wait_event_type='Lock' and ${first.pid}=any(pg_blocking_pids(pid))); rollback;`);
   if(seen==='t'){blocked=true;break;}
   await new Promise(resolve=>setTimeout(resolve,25));
  }
  if(!blocked)throw new Error('Concurrency NOT proven: second session never blocked on first');
  await first.run('commit;');
  const result=await outcome;
  if(expectedFailure){if(result.ok||!expectedFailure.test(result.error.message))throw new Error('Expected legal-transition rejection, not a timeout/deadlock');}
  else if(!result.ok)throw result.error;
  return{first: first.pid,second: second.pid,blocked:true};
 }finally{first.abort();second.abort();if(outcome)await outcome;}
}
module.exports={openSession,overlap};
